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

export function registerImageRoutes(app: Hono<AppEnv>) {
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
