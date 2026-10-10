import { describe, expect, it } from "vitest";
import { parseZernioEvent } from "../src/worker/connectors";
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

describe("Zernio events", () => {
  const event = (overrides: Record<string, unknown> = {}, message: Record<string, unknown> = {}) => ({
    id: "evt_1",
    event: "message.received",
    message: { id: "m1", conversationId: "conv_1", platform: "facebook", direction: "incoming", text: "Xin chào", sender: { id: "psid_1", name: "An" }, ...message },
    conversation: { id: "conv_1" },
    account: { accountId: "acc_1" },
    metadata: null,
    ...overrides,
  });
  it("maps message.received to the shared runtime contract", () => {
    const parsed = parseZernioEvent(event(), connection, "hdr_evt");
    expect(parsed.kind).toBe("message");
    if (parsed.kind !== "message") return;
    expect(parsed.accountId).toBe("acc_1");
    expect(parsed.input).toMatchObject({ eventId: "hdr_evt", connectionId: "conn_1", agentId: "agent_1", conversationId: "conv_1", externalUserId: "psid_1", content: { text: "Xin chào" }, customer: { name: "An" } });
  });
  it("ignores tests, our own sends and threads owned by another app", () => {
    expect(parseZernioEvent({ event: "webhook.test" }, connection).kind).toBe("ignore");
    expect(parseZernioEvent(event({}, { direction: "outgoing" }), connection).kind).toBe("ignore");
    expect(parseZernioEvent(event({ metadata: { standby: true } }), connection).kind).toBe("ignore");
  });
  it("turns a photo-only message into a short note plus the image", () => {
    const parsed = parseZernioEvent(event({}, { text: "", attachments: [{ type: "image", url: "https://cdn.example.com/a.jpg", mimeType: "image/jpeg" }] }), connection);
    expect(parsed.kind === "message" && parsed.input.content).toMatchObject({ text: "(sent a photo)", images: [{ url: "https://cdn.example.com/a.jpg" }] });
  });
});
