import type { MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { constantTimeEqual, hmacHex, sha256 } from "./crypto";

export type AuthVariables = { adminId: string; role: "owner" | "manager" | "staff"; csrfToken: string; requestId: string };

export async function createSession(db: D1Database, adminId: string, ttlSeconds: number, signingKey: string) {
  const rawToken = crypto.randomUUID() + crypto.randomUUID();
  const sessionToken = `${rawToken}.${await hmacHex(signingKey, rawToken)}`;
  const csrfToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  await db.prepare("INSERT INTO sessions(id_hash, admin_id, csrf_hash, expires_at) VALUES(?,?,?,?)")
    .bind(await sha256(sessionToken), adminId, await sha256(csrfToken), expiresAt).run();
  return { sessionToken, csrfToken, expiresAt };
}

export function setSessionCookies(c: { header(name: string, value: string, options?: { append?: boolean }): void }, sessionToken: string, csrfToken: string, ttlSeconds: number) {
  setCookie(c as never, "agent_session", sessionToken, { httpOnly: true, secure: true, sameSite: "Strict", path: "/", maxAge: ttlSeconds });
  setCookie(c as never, "agent_csrf", csrfToken, { httpOnly: false, secure: true, sameSite: "Strict", path: "/", maxAge: ttlSeconds });
}

export function clearSessionCookies(c: Parameters<typeof deleteCookie>[0]) {
  deleteCookie(c, "agent_session", { path: "/", secure: true });
  deleteCookie(c, "agent_csrf", { path: "/", secure: true });
}

export const requireAdmin: MiddlewareHandler<{ Bindings: Env; Variables: AuthVariables }> = async (c, next) => {
  const token = getCookie(c, "agent_session");
  if (!token) return c.json({ error: "Unauthorized" }, 401);
  const separator = token.lastIndexOf(".");
  if (separator < 1 || !await constantTimeEqual(token.slice(separator + 1), await hmacHex(c.env.SESSION_SIGNING_KEY, token.slice(0, separator)))) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const row = await c.env.DB.prepare("SELECT s.admin_id, s.csrf_hash, a.role FROM sessions s JOIN admins a ON a.id = s.admin_id WHERE s.id_hash = ? AND s.expires_at > datetime('now')")
    .bind(await sha256(token)).first<{ admin_id: string; csrf_hash: string; role: AuthVariables["role"] }>();
  if (!row) return c.json({ error: "Unauthorized" }, 401);
  const csrfToken = getCookie(c, "agent_csrf") ?? "";
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    const submitted = c.req.header("X-CSRF-Token") ?? "";
    if (!submitted || submitted !== csrfToken || await sha256(submitted) !== row.csrf_hash) return c.json({ error: "Invalid CSRF token" }, 403);
    const origin = c.req.header("Origin");
    if (origin && new URL(origin).origin !== new URL(c.req.url).origin) return c.json({ error: "Invalid origin" }, 403);
  }
  c.set("adminId", row.admin_id);
  c.set("role", row.role);
  c.set("csrfToken", csrfToken);
  await c.env.DB.prepare("UPDATE sessions SET last_seen_at = datetime('now') WHERE id_hash = ?").bind(await sha256(token)).run();
  await next();
};
