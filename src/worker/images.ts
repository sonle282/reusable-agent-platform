import type { Hono } from "hono";
import { writeAudit } from "./db";
import type { AuthVariables } from "./security/auth";

type AppEnv = { Bindings: Env; Variables: AuthVariables };

// Photos for Data rows (offers, products). Channels such as Messenger fetch them by link,
// so they are served without sign-in from an unguessable address.
// 1 MB keeps photos quick to load on a phone and in Messenger (owner's limit, 2026-10-12).
export const MAX_IMAGE_BYTES = 1024 * 1024;
const NAME = /^[a-f0-9]{32}\.(jpg|png|webp|gif)$/;
const types = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" } as const;

// Trust the file's first bytes, not its name or the browser's type.
export function sniffImage(bytes: Uint8Array): keyof typeof types | null {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (starts(0xff, 0xd8, 0xff)) return "jpg";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "gif";
  if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "webp";
  return null;
}

// Our own photo names inside a row's values (links look like https://<host>/media/images/<name>).
const OWN_LINK = /\/media\/images\/([a-f0-9]{32}\.(?:jpg|png|webp|gif))(?![\w./-])/g;
export function ownImageNames(value: unknown): Set<string> {
  const names = new Set<string>();
  const walk = (item: unknown) => {
    if (typeof item === "string") for (const match of item.matchAll(OWN_LINK)) names.add(match[1]);
    else if (Array.isArray(item)) item.forEach(walk);
    else if (item && typeof item === "object") Object.values(item).forEach(walk);
  };
  walk(value);
  return names;
}

// A photo stays while a Data row links to it, a customer has received it (chat history), or a fix that can
// still be undone would put it back. Everything else is deleted.
export async function imageInUse(env: Env, name: string) {
  const used = await env.DB.prepare(
    `SELECT 1 AS used WHERE EXISTS (SELECT 1 FROM data_records WHERE instr(data_json, ?1) > 0)
      OR EXISTS (SELECT 1 FROM sent_images WHERE name = ?1)
      OR EXISTS (SELECT 1 FROM answer_fixes WHERE target_kind = 'data' AND status IN ('verified','kept_failing','published') AND julianday(applied_at) >= julianday('now','-7 day') AND instr(change_json, ?1) > 0)`,
  ).bind(name).first();
  return Boolean(used);
}

export async function deleteUnusedImages(env: Env, names: Iterable<string>, actorId?: string) {
  const deleted: string[] = [];
  for (const name of names) {
    if (!NAME.test(name)) continue;
    if (await imageInUse(env, name)) continue;
    await env.FILES.delete(`images/${name}`);
    deleted.push(name);
  }
  if (deleted.length) await writeAudit(env.DB, "image.delete", "image", deleted.join(","), actorId, { count: deleted.length });
  return deleted;
}

// Remember photos a customer received so they are never deleted from under the chat history.
export async function rememberSentImages(env: Env, links: string[]) {
  const names = [...ownImageNames(links)];
  if (names.length) await env.DB.batch(names.map((name) => env.DB.prepare("INSERT OR IGNORE INTO sent_images(name) VALUES(?)").bind(name)));
}

// Daily sweep for photos left behind by paths that don't clean up on the spot (CSV import, Fix this answer after
// its 7-day undo window, a closed browser tab). Photos younger than a day are skipped: they may be in an open panel.
export async function sweepUnusedImages(env: Env) {
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const candidates: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.FILES.list({ prefix: "images/", cursor, limit: 1000 });
    for (const object of page.objects) if (object.uploaded.getTime() < dayAgo) candidates.push(object.key.slice("images/".length));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return deleteUnusedImages(env, candidates, "system:sweep");
}

export function registerImageRoutes(app: Hono<AppEnv>) {
  // Photos uploaded in the row panel but not kept (Cancel, or replaced before Save).
  app.delete("/api/admin/images/:name", async (c) => {
    const deleted = await deleteUnusedImages(c.env, [c.req.param("name")], c.get("adminId"));
    return c.json({ deleted: deleted.length > 0 });
  });

  app.post("/api/admin/images", async (c) => {
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!file || typeof file === "string") return c.json({ error: "Choose an image file" }, 400);
    if (file.size > MAX_IMAGE_BYTES) return c.json({ error: "The image is over 1 MB. Choose a smaller one or shrink it first." }, 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const ext = sniffImage(bytes);
    if (!ext) return c.json({ error: "Use a JPG, PNG, WebP or GIF image." }, 415);
    const random = crypto.getRandomValues(new Uint8Array(16));
    const name = `${[...random].map((byte) => byte.toString(16).padStart(2, "0")).join("")}.${ext}`;
    await c.env.FILES.put(`images/${name}`, bytes, { httpMetadata: { contentType: types[ext], cacheControl: "public, max-age=31536000, immutable" }, customMetadata: { originalName: file.name.slice(0, 200) } });
    await writeAudit(c.env.DB, "image.upload", "image", name, c.get("adminId"), { bytes: file.size });
    return c.json({ url: `${new URL(c.req.url).origin}/media/images/${name}` }, 201);
  });

  app.get("/media/images/:name", async (c) => {
    const name = c.req.param("name");
    if (!NAME.test(name)) return c.notFound();
    const object = await c.env.FILES.get(`images/${name}`);
    if (!object) return c.notFound();
    // Set on the context so they replace the app-wide defaults.
    c.header("Content-Type", types[name.split(".")[1] as keyof typeof types]);
    c.header("Cache-Control", "public, max-age=31536000, immutable");
    c.header("Content-Security-Policy", "default-src 'none'; sandbox");
    c.header("Cross-Origin-Resource-Policy", "cross-origin");
    return c.body(object.body);
  });
}
