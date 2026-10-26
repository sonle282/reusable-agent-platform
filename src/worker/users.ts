import type { Context, Hono, MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { z } from "zod";
import { id, writeAudit } from "./db";
import { createSession, setSessionCookies, type AuthVariables } from "./security/auth";
import { hashPassword, randomToken, sha256, verifyPassword } from "./security/crypto";

type AppEnv = { Bindings: Env; Variables: AuthVariables };
export type Role = "owner" | "manager" | "staff";
export const roles: Role[] = ["owner", "manager", "staff"];
const rank: Record<Role, number> = { staff: 1, manager: 2, owner: 3 };

// Who may call which admin API. The first matching rule wins; anything not listed needs an owner, so a new
// endpoint is closed until someone decides otherwise. The client hides what a role can't use; this enforces it.
type Rule = [method: "*" | "GET" | "POST" | "PATCH" | "DELETE", path: RegExp, role: Role];
const rules: Rule[] = [
  // Everyone: their own account and the shared shell.
  ["*", /^\/api\/admin\/(session|logout|me)(\/.*)?$/, "staff"],
  ["GET", /^\/api\/admin\/(bootstrap|dashboard)$/, "staff"],
  // Staff: Home, Leads and Conversations.
  ["GET", /^\/api\/admin\/agents\/[^/]+\/(attention|followups\/stats)$/, "staff"],
  ["*", /^\/api\/admin\/attention\/dismiss(\/[^/]+)?$/, "staff"],
  ["GET", /^\/api\/admin\/conversations(\/[^/]+)?$/, "staff"],
  ["POST", /^\/api\/admin\/conversations\/[^/]+\/takeover$/, "staff"],
  ["GET", /^\/api\/admin\/leads\/export\.csv$/, "manager"],
  ["GET", /^\/api\/admin\/leads(\/[^/]+)?$/, "staff"],
  ["PATCH", /^\/api\/admin\/leads\/[^/]+$/, "staff"],
  // Managers: assistants (not deleting one, not live lookups that can hold credentials), Data, fixes, customer data.
  ["DELETE", /^\/api\/admin\/agents\/[^/]+$/, "owner"],
  ["*", /^\/api\/admin\/agents\/[^/]+\/tools$/, "owner"],
  ["*", /^\/api\/admin\/agents(\/.*)?$/, "manager"],
  ["*", /^\/api\/admin\/(collections|images|knowledge|fixes|deliveries|leads)(\/.*)?$/, "manager"],
  ["*", /^\/api\/admin\/conversations\/[^/]+\/(customer-data|erase)$/, "manager"],
  // Owners: channels, Zernio, settings, export, users, tool tests — the default below.
];

export function requiredRole(method: string, path: string): Role {
  for (const [ruleMethod, pattern, role] of rules) if ((ruleMethod === "*" || ruleMethod === method) && pattern.test(path)) return role;
  return "owner";
}

export const allows = (role: Role, needed: Role) => rank[role] >= rank[needed];

export const requireRole: MiddlewareHandler<AppEnv> = async (c, next) => {
  const needed = requiredRole(c.req.method, c.req.path);
  if (!allows(c.get("role"), needed)) return c.json({ error: `This needs the ${needed} role. Ask an owner if you need it.` }, 403);
  await next();
};

const password = z.string().min(12, "Use at least 12 characters").max(200);
const LINK_DAYS = 7;
const linkUrl = (c: Context, token: string) => `${new URL(c.req.url).origin}/#/invite/${token}`;

async function newLink(c: Context<AppEnv>, link: { kind: "invite" | "reset"; email: string; role?: Role; name?: string; adminId?: string }) {
  const token = randomToken(32);
  // One live link per person and kind: a new link replaces the previous one.
  await c.env.DB.prepare("UPDATE user_links SET used_at=datetime('now') WHERE email=? AND kind=? AND used_at IS NULL").bind(link.email, link.kind).run();
  await c.env.DB.prepare("INSERT INTO user_links(id,kind,email,role,name,admin_id,token_hash,created_by,expires_at) VALUES(?,?,?,?,?,?,?,?,datetime('now', ?))")
    .bind(id("link"), link.kind, link.email, link.role ?? null, link.name ?? "", link.adminId ?? null, await sha256(token), c.get("adminId"), `+${LINK_DAYS} day`).run();
  return linkUrl(c, token);
}

async function owners(db: D1Database) {
  return (await db.prepare("SELECT COUNT(*) AS count FROM admins WHERE role='owner'").first<{ count: number }>())?.count ?? 0;
}

// ---------- Signed in: my account, and (owners) the people who can sign in ----------
export function registerUserRoutes(app: Hono<AppEnv>) {
  app.get("/api/admin/me", async (c) => c.json(await c.env.DB.prepare("SELECT id,email,name,role FROM admins WHERE id=?").bind(c.get("adminId")).first()));

  app.patch("/api/admin/me", async (c) => {
    const body = z.object({ name: z.string().trim().max(80) }).parse(await c.req.json());
    await c.env.DB.prepare("UPDATE admins SET name=? WHERE id=?").bind(body.name, c.get("adminId")).run();
    await writeAudit(c.env.DB, "account.name", "admin", c.get("adminId"), c.get("adminId"));
    return c.json({ name: body.name });
  });

  const checkCurrent = async (c: Context<AppEnv>, current: string) => {
    const me = await c.env.DB.prepare("SELECT password_hash,password_salt,password_iterations FROM admins WHERE id=?").bind(c.get("adminId"))
      .first<{ password_hash: string; password_salt: string; password_iterations: number }>();
    return Boolean(me && (await verifyPassword(current, me.password_salt, me.password_iterations, me.password_hash)));
  };

  // A new password signs out every other device; this one stays signed in.
  app.post("/api/admin/me/password", async (c) => {
    const body = z.object({ current: z.string().min(1), password }).parse(await c.req.json());
    if (!(await checkCurrent(c, body.current))) return c.json({ error: "The current password isn't right." }, 400);
    const next = await hashPassword(body.password);
    const session = await sha256(getCookie(c, "agent_session") ?? "");
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE admins SET password_hash=?,password_salt=?,password_iterations=? WHERE id=?").bind(next.hash, next.salt, next.iterations, c.get("adminId")),
      c.env.DB.prepare("DELETE FROM sessions WHERE admin_id=? AND id_hash<>?").bind(c.get("adminId"), session),
    ]);
    await writeAudit(c.env.DB, "account.password", "admin", c.get("adminId"), c.get("adminId"));
    return c.json({ ok: true });
  });

  app.post("/api/admin/me/email", async (c) => {
    const body = z.object({ current: z.string().min(1), email: z.string().trim().email().max(200) }).parse(await c.req.json());
    if (!(await checkCurrent(c, body.current))) return c.json({ error: "The current password isn't right." }, 400);
    const email = body.email.toLowerCase();
    const taken = await c.env.DB.prepare("SELECT id FROM admins WHERE email=? AND id<>?").bind(email, c.get("adminId")).first();
    if (taken) return c.json({ error: "Someone already signs in with that email." }, 409);
    await c.env.DB.prepare("UPDATE admins SET email=? WHERE id=?").bind(email, c.get("adminId")).run();
    await writeAudit(c.env.DB, "account.email", "admin", c.get("adminId"), c.get("adminId"));
    return c.json({ email });
  });

  app.get("/api/admin/users", async (c) => {
    const [users, links] = await Promise.all([
      c.env.DB.prepare("SELECT a.id,a.email,a.name,a.role,a.created_at,(SELECT MAX(s.last_seen_at) FROM sessions s WHERE s.admin_id=a.id) AS last_seen_at FROM admins a ORDER BY CASE a.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, a.created_at").all(),
      c.env.DB.prepare("SELECT id,email,name,role,expires_at,created_at FROM user_links WHERE kind='invite' AND used_at IS NULL AND expires_at > datetime('now') ORDER BY created_at DESC").all(),
    ]);
    return c.json({ users: users.results, invites: links.results });
  });

  app.post("/api/admin/users/invites", async (c) => {
    const body = z.object({ email: z.string().trim().email().max(200), role: z.enum(["owner", "manager", "staff"]), name: z.string().trim().max(80).default("") }).parse(await c.req.json());
    const email = body.email.toLowerCase();
    if (await c.env.DB.prepare("SELECT id FROM admins WHERE email=?").bind(email).first()) return c.json({ error: "That person can already sign in." }, 409);
    const link = await newLink(c, { kind: "invite", email, role: body.role, name: body.name });
    await writeAudit(c.env.DB, "user.invite", "admin", email, c.get("adminId"), { role: body.role });
    return c.json({ link, expiresInDays: LINK_DAYS }, 201);
  });

  app.delete("/api/admin/users/invites/:id", async (c) => {
    await c.env.DB.prepare("UPDATE user_links SET used_at=datetime('now') WHERE id=? AND kind='invite' AND used_at IS NULL").bind(c.req.param("id")).run();
    await writeAudit(c.env.DB, "user.invite_cancel", "user_link", c.req.param("id"), c.get("adminId"));
    return c.json({ ok: true });
  });

  app.patch("/api/admin/users/:id", async (c) => {
    const body = z.object({ role: z.enum(["owner", "manager", "staff"]) }).parse(await c.req.json());
    const user = await c.env.DB.prepare("SELECT id,role FROM admins WHERE id=?").bind(c.req.param("id")).first<{ id: string; role: Role }>();
    if (!user) return c.json({ error: "User not found" }, 404);
    if (user.role === "owner" && body.role !== "owner" && (await owners(c.env.DB)) <= 1) return c.json({ error: "There must always be at least one owner." }, 409);
    await c.env.DB.prepare("UPDATE admins SET role=? WHERE id=?").bind(body.role, user.id).run();
    await writeAudit(c.env.DB, "user.role", "admin", user.id, c.get("adminId"), { from: user.role, to: body.role });
    return c.json({ id: user.id, role: body.role });
  });

  app.delete("/api/admin/users/:id", async (c) => {
    const user = await c.env.DB.prepare("SELECT id,email,role FROM admins WHERE id=?").bind(c.req.param("id")).first<{ id: string; email: string; role: Role }>();
    if (!user) return c.json({ error: "User not found" }, 404);
    if (user.id === c.get("adminId")) return c.json({ error: "You can't remove yourself. Ask another owner." }, 409);
    if (user.role === "owner" && (await owners(c.env.DB)) <= 1) return c.json({ error: "There must always be at least one owner." }, 409);
    // Sessions and links go with the user (ON DELETE CASCADE); their past actions stay in the audit log.
    await c.env.DB.prepare("DELETE FROM admins WHERE id=?").bind(user.id).run();
    await writeAudit(c.env.DB, "user.remove", "admin", user.id, c.get("adminId"), { email: user.email, role: user.role });
    return c.json({ ok: true });
  });

  // A forgotten password: the owner makes a one-time link and sends it to the person (Zalo, SMS…).
  app.post("/api/admin/users/:id/reset-link", async (c) => {
    const user = await c.env.DB.prepare("SELECT id,email FROM admins WHERE id=?").bind(c.req.param("id")).first<{ id: string; email: string }>();
    if (!user) return c.json({ error: "User not found" }, 404);
    const link = await newLink(c, { kind: "reset", email: user.email, adminId: user.id });
    await writeAudit(c.env.DB, "user.reset_link", "admin", user.id, c.get("adminId"));
    return c.json({ link, expiresInDays: LINK_DAYS }, 201);
  });
}

// ---------- Not signed in: open an invite or a reset link ----------
// The token travels in the page's #fragment and the request body, never in a URL the server logs.
export function registerLinkRoutes(app: Hono<AppEnv>) {
  const find = async (db: D1Database, token: string) =>
    db.prepare("SELECT id,kind,email,role,name,admin_id FROM user_links WHERE token_hash=? AND used_at IS NULL AND expires_at > datetime('now')").bind(await sha256(token))
      .first<{ id: string; kind: "invite" | "reset"; email: string; role: Role | null; name: string; admin_id: string | null }>();

  app.post("/api/links/check", async (c) => {
    const body = z.object({ token: z.string().min(20).max(200) }).parse(await c.req.json());
    const link = await find(c.env.DB, body.token);
    if (!link) return c.json({ error: "This link has expired or was already used. Ask an owner for a new one." }, 410);
    return c.json({ kind: link.kind, email: link.email, name: link.name, role: link.role });
  });

  app.post("/api/links/accept", async (c) => {
    const body = z.object({ token: z.string().min(20).max(200), password, name: z.string().trim().max(80).optional() }).parse(await c.req.json());
    const link = await find(c.env.DB, body.token);
    if (!link) return c.json({ error: "This link has expired or was already used. Ask an owner for a new one." }, 410);
    const hashed = await hashPassword(body.password);
    let adminId = link.admin_id;
    if (link.kind === "invite") {
      if (await c.env.DB.prepare("SELECT id FROM admins WHERE email=?").bind(link.email).first()) return c.json({ error: "That email can already sign in. Use Sign in instead." }, 409);
      adminId = id("admin");
      await c.env.DB.batch([
        c.env.DB.prepare("INSERT INTO admins(id,email,password_hash,password_salt,password_iterations,role,name) VALUES(?,?,?,?,?,?,?)")
          .bind(adminId, link.email, hashed.hash, hashed.salt, hashed.iterations, link.role ?? "staff", (body.name ?? link.name).trim()),
        c.env.DB.prepare("UPDATE user_links SET used_at=datetime('now') WHERE id=?").bind(link.id),
      ]);
    } else {
      if (!adminId) return c.json({ error: "User not found" }, 404);
      // A reset signs the person out everywhere before signing them in here.
      await c.env.DB.batch([
        c.env.DB.prepare("UPDATE admins SET password_hash=?,password_salt=?,password_iterations=? WHERE id=?").bind(hashed.hash, hashed.salt, hashed.iterations, adminId),
        c.env.DB.prepare("DELETE FROM sessions WHERE admin_id=?").bind(adminId),
        c.env.DB.prepare("UPDATE user_links SET used_at=datetime('now') WHERE id=?").bind(link.id),
      ]);
    }
    await writeAudit(c.env.DB, link.kind === "invite" ? "user.joined" : "user.password_reset", "admin", adminId!, adminId!);
    const session = await createSession(c.env.DB, adminId!, Number(c.env.SESSION_TTL_SECONDS), c.env.SESSION_SIGNING_KEY);
    setSessionCookies(c, session.sessionToken, session.csrfToken, Number(c.env.SESSION_TTL_SECONDS));
    return c.json({ ok: true, csrfToken: session.csrfToken }, 201);
  });
}
