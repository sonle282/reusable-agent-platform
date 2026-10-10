import { id } from "./db";

export function assertSafeHttpsUrl(rawUrl: string): URL {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") throw new Error("Only HTTPS URLs are allowed");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "0.0.0.0" || host === "::1") {
    throw new Error("Private hosts are not allowed");
  }
  const ipv4 = host.split(".").map(Number);
  if (ipv4.length === 4 && ipv4.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    if (ipv4[0] === 10 || ipv4[0] === 127 || ipv4[0] === 0 || (ipv4[0] === 169 && ipv4[1] === 254) ||
      (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31) || (ipv4[0] === 192 && ipv4[1] === 168)) {
      throw new Error("Private IP addresses are not allowed");
    }
  }
  if (host.includes(":") && (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80") || host === "::1")) {
    throw new Error("Private IP addresses are not allowed");
  }
  return url;
}

export async function fetchKnowledgeUrl(rawUrl: string) {
  let current = assertSafeHttpsUrl(rawUrl);
  for (let redirect = 0; redirect <= 3; redirect++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(current, { redirect: "manual", signal: controller.signal, headers: { "user-agent": "ReusableAgentPlatform/1.0" } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirect === 3) throw new Error("Too many redirects");
        current = assertSafeHttpsUrl(new URL(location, current).toString());
        continue;
      }
      if (!response.ok) throw new Error(`URL returned ${response.status}`);
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!contentType.includes("text/plain") && !contentType.includes("text/markdown") && !contentType.includes("text/html")) {
        throw new Error("URL must return text, Markdown, or HTML");
      }
      const length = Number(response.headers.get("content-length") ?? 0);
      if (length > 2_000_000) throw new Error("URL content is too large");
      const text = (await response.text()).slice(0, 2_000_000);
      const normalized = contentType.includes("html")
        ? text.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
        : text;
      return { text: normalized, finalUrl: current.toString(), contentType };
    } finally { clearTimeout(timer); }
  }
  throw new Error("Unable to fetch URL");
}

// AI Search only filters on declared custom metadata; field names are stored lowercase.
const knowledgeMetadataFields = [
  { field_name: "agentid", data_type: "text" },
  { field_name: "sourceid", data_type: "text" },
  { field_name: "name", data_type: "text" },
] as const;
let metadataSchemaReady = false;

async function searchInstance(env: Env) {
  const instance = env.AI_SEARCH.get(env.AI_SEARCH_INSTANCE);
  let info: Awaited<ReturnType<typeof instance.info>> | undefined;
  try { info = await instance.info(); }
  catch { await env.AI_SEARCH.create({ id: env.AI_SEARCH_INSTANCE, custom_metadata: [...knowledgeMetadataFields] }); metadataSchemaReady = true; }
  if (info && !metadataSchemaReady) {
    const declared = new Set((info.custom_metadata ?? []).map((field) => field.field_name.toLowerCase()));
    if (!knowledgeMetadataFields.every((field) => declared.has(field.field_name))) {
      const extra = (info.custom_metadata ?? []).filter((field) => !knowledgeMetadataFields.some((known) => known.field_name === field.field_name.toLowerCase()));
      await instance.update({ custom_metadata: [...knowledgeMetadataFields, ...extra] });
    }
    metadataSchemaReady = true;
  }
  return env.AI_SEARCH.get(env.AI_SEARCH_INSTANCE);
}

function metadataValue(metadata: Record<string, unknown> | undefined, field: string) {
  if (!metadata) return undefined;
  const key = Object.keys(metadata).find((candidate) => candidate.toLowerCase() === field);
  return key === undefined ? undefined : metadata[key];
}

export async function ingestKnowledgeSource(env: Env, sourceId: string) {
  const source = await env.DB.prepare("SELECT * FROM knowledge_sources WHERE id = ?").bind(sourceId).first<{
    id: string; agent_id: string; name: string; r2_key: string | null; source_url: string | null;
  }>();
  if (!source) throw new Error("Knowledge source not found");
  await env.DB.prepare("UPDATE knowledge_sources SET status = 'processing', error = NULL, updated_at = datetime('now') WHERE id = ?").bind(sourceId).run();
  try {
    let text = "";
    let sourceUrl = source.source_url;
    if (sourceUrl) {
      const fetched = await fetchKnowledgeUrl(sourceUrl);
      text = fetched.text;
      sourceUrl = fetched.finalUrl;
      const key = `knowledge/${source.agent_id}/${source.id}.txt`;
      await env.FILES.put(key, text, { httpMetadata: { contentType: "text/plain; charset=utf-8" } });
      await env.DB.prepare("UPDATE knowledge_sources SET r2_key = ?, source_url = ? WHERE id = ?").bind(key, sourceUrl, sourceId).run();
    } else if (source.r2_key) {
      const object = await env.FILES.get(source.r2_key);
      if (!object) throw new Error("Knowledge object is missing");
      text = await object.text();
    }
    if (!text.trim()) throw new Error("Knowledge source is empty");
    const instance = await searchInstance(env);
    await instance.items.upload(`${source.agent_id}__${source.id}.md`, text, { metadata: { sourceid: sourceId, agentid: source.agent_id, name: source.name } });
    await env.DB.prepare("UPDATE knowledge_sources SET status = 'ready', updated_at = datetime('now') WHERE id = ?").bind(sourceId).run();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Knowledge ingestion failed";
    await env.DB.prepare("UPDATE knowledge_sources SET status = 'failed', error = ?, updated_at = datetime('now') WHERE id = ?").bind(message.slice(0, 1000), sourceId).run();
    throw error;
  }
}

export async function retrieveKnowledge(env: Env, agentId: string, sourceIds: string[], query: string) {
  if (!query.trim() || sourceIds.length === 0) return [];
  const instance = await searchInstance(env);
  const result = await instance.search({
    query,
    ai_search_options: { retrieval: { max_num_results: 5, match_threshold: 0.35, filters: { agentid: { $eq: agentId } } } },
  });
  return result.chunks
    .filter((chunk) => sourceIds.includes(String(metadataValue(chunk.item.metadata, "sourceid") ?? "")))
    .slice(0, 5)
    .map((chunk) => ({
      id: String(metadataValue(chunk.item.metadata, "sourceid") ?? chunk.id),
      name: String(metadataValue(chunk.item.metadata, "name") ?? chunk.item.key),
      score: chunk.score,
      text: chunk.text,
    }));
}

export async function createTextKnowledge(env: Env, agentId: string, name: string, text: string, type: "text" | "file" = "text") {
  const sourceId = id("ks");
  const key = `knowledge/${agentId}/${sourceId}.md`;
  await env.FILES.put(key, text, { httpMetadata: { contentType: "text/markdown; charset=utf-8" } });
  await env.DB.prepare("INSERT INTO knowledge_sources(id, agent_id, type, name, r2_key) VALUES(?,?,?,?,?)")
    .bind(sourceId, agentId, type, name, key).run();
  await env.JOBS.send({ kind: "knowledge_ingest", sourceId });
  return sourceId;
}

