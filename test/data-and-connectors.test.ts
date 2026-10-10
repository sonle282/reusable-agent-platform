import { describe, expect, it } from "vitest";
import { normalizeZernio } from "../src/worker/connectors";
import { validateCollectionData, type ConnectionRow } from "../src/worker/db";
import { assertSafeHttpsUrl } from "../src/worker/knowledge";

const connection: ConnectionRow = {
  id: "conn_1", agent_id: "agent_1", type: "zernio", name: "Zernio", status: "active",
  token_hash: "hash", api_key_hash: null, callback_url: null, config_json: "{}", credential_id: null,
};

describe("structured data", () => {
  const schema = JSON.stringify({ fields: [
    { key: "name", label: "Name", type: "text", required: true },
    { key: "price", label: "Price", type: "number", required: true },
  ] });

  it("normalizes typed fields and rejects invalid rows atomically", () => {
    expect(validateCollectionData(schema, { name: "Serum", price: "125000" })).toEqual({ data: { name: "Serum", price: 125000 }, errors: [] });
    expect(validateCollectionData(schema, { name: "Serum", price: "not-a-number" }).errors).toContain("Price must be a number");
  });
});

describe("SSRF boundaries", () => {
  it.each(["http://example.com", "https://localhost/a", "https://127.0.0.1/a", "https://10.0.0.1/a", "https://192.168.1.1/a", "https://[::1]/a"])("blocks %s", (url) => {
    expect(() => assertSafeHttpsUrl(url)).toThrow();
  });
  it("allows public HTTPS URLs", () => expect(assertSafeHttpsUrl("https://example.com/policy").hostname).toBe("example.com"));
});

describe("Zernio normalization", () => {
  it("maps provider payload to the shared runtime contract", () => {
    const message = normalizeZernio({ id: "evt_1", data: { conversation_id: "chat_1", message: { text: "Xin chào" }, contact: { id: "user_1", name: "An", locale: "vi" } } }, connection);
    expect(message).toMatchObject({ eventId: "evt_1", connectionId: "conn_1", agentId: "agent_1", conversationId: "chat_1", externalUserId: "user_1", content: { text: "Xin chào" } });
  });
});

