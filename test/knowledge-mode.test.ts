import { describe, expect, it } from "vitest";
import { FULL_KNOWLEDGE_BYTES, fullKnowledge, knowledgeSize } from "../src/worker/knowledge";

// Just enough of D1 and R2 for the knowledge loader.
function fakeEnv(files: Record<string, string>) {
  const rows = Object.keys(files).sort().map((id) => ({ id, name: `Source ${id}`, r2_key: `k/${id}.md` }));
  const DB = { prepare: () => ({ bind: (...ids: string[]) => ({ all: async () => ({ results: rows.filter((row) => ids.includes(row.id)) }) }) }) };
  const FILES = {
    head: async (key: string) => ({ size: new TextEncoder().encode(files[key.slice(2, -3)] ?? "").length }),
    get: async (key: string) => ({ text: async () => files[key.slice(2, -3)] ?? "" }),
  };
  return { DB, FILES } as unknown as Env;
}

describe("knowledge read in full or searched", () => {
  it("reads every source in use, in a stable order, while it fits", async () => {
    const env = fakeEnv({ ks_b: "Chính sách: đặt cọc 30%.", ks_a: "Ưu đãi: drain pump $99." });
    const full = await fullKnowledge(env, ["ks_b", "ks_a"]);
    expect(full?.map((source) => source.id)).toEqual(["ks_a", "ks_b"]);
    expect(full?.[1].text).toContain("30%");
    expect((await knowledgeSize(env, ["ks_a", "ks_b"])).inFull).toBe(true);
  });

  it("switches to search when the sources are too large together", async () => {
    const env = fakeEnv({ ks_a: "x".repeat(FULL_KNOWLEDGE_BYTES / 2 + 1), ks_b: "y".repeat(FULL_KNOWLEDGE_BYTES / 2 + 1) });
    expect(await fullKnowledge(env, ["ks_a", "ks_b"])).toBeNull();
    expect(await fullKnowledge(env, ["ks_a"])).not.toBeNull();
    expect((await knowledgeSize(env, ["ks_a", "ks_b"])).inFull).toBe(false);
  });

  it("has nothing to read when no source is in use", async () => {
    expect(await fullKnowledge(fakeEnv({}), [])).toEqual([]);
  });
});
