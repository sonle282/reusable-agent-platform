import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { knownFailure } from "../src/worker/errors";

// Conversation ids are "<agent>:<connection>:<external id>"; the admin client sends them URL-encoded.
describe("conversation ids with ':'", () => {
  const id = "agent_9ba6982812:conn_8eea8d456e:6aba37578d28";
  const app = new Hono();
  app.get("/api/admin/conversations/:id", (c) => c.json({ id: c.req.param("id") }));
  app.get("/api/admin/conversations/:id/customer-data", (c) => c.json({ id: c.req.param("id"), export: true }));

  it("decodes %3A back to the stored id", async () => {
    const response = await app.request(`/api/admin/conversations/${encodeURIComponent(id)}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id });
  });

  it("still routes sub-paths of an encoded id", async () => {
    const response = await app.request(`/api/admin/conversations/${encodeURIComponent(id)}/customer-data`);
    expect(await response.json()).toEqual({ id, export: true });
  });

  it("explains the chat store's daily limit instead of a bare 500", () => {
    expect(knownFailure("Exceeded allowed duration in Durable Objects free tier.")).toMatchObject({ status: 503, code: "chat_store_limit" });
    expect(knownFailure("something else")).toBeNull();
  });
});
