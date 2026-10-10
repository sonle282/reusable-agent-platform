import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import Papa from "papaparse";

const baseUrl = (process.env.AGENT_PLATFORM_URL || "http://127.0.0.1:5173").replace(/\/$/, "");
const email = process.env.AGENT_ADMIN_EMAIL;
const password = process.env.AGENT_ADMIN_PASSWORD;
const fixtureRoot = resolve(process.env.MRSPA_FIXTURE_ROOT || "../ai-agent-blueprint/tenants/mrspa");

if (!email || !password) throw new Error("Set AGENT_ADMIN_EMAIL and AGENT_ADMIN_PASSWORD before running the importer.");

const login = await fetch(`${baseUrl}/api/auth/login`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }),
});
if (!login.ok) throw new Error(`Login failed: ${login.status} ${await login.text()}`);
const loginData = await login.json();
const cookie = login.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");

async function request(path, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("cookie", cookie);
  if (init.body) headers.set("content-type", "application/json");
  if (!(["GET", "HEAD"].includes(init.method || "GET"))) headers.set("X-CSRF-Token", loginData.csrfToken);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(body)}`);
  return body;
}

const bootstrap = await request("/api/admin/bootstrap");
let agent = bootstrap.agents.find((item) => item.name === "Mr Spa Consultant");
if (!agent) agent = await request("/api/admin/agents", { method: "POST", body: JSON.stringify({ name: "Mr Spa Consultant", description: "Tư vấn sản phẩm salon, chính sách và ưu đãi cho khách hàng Mr Spa", primaryLanguage: "vi", template: "sales" }) });

const instructions = await readFile(resolve(fixtureRoot, "build/agent-instructions.txt"), "utf8");
const detail = await request(`/api/admin/agents/${agent.id}`);
const knownSources = new Map(detail.sources.map((source) => [source.name, source.id]));
const knowledgeDirectory = resolve(fixtureRoot, "build/knowledge");
for (const filename of (await readdir(knowledgeDirectory)).filter((name) => name.endsWith(".md"))) {
  if (knownSources.has(filename)) continue;
  const text = await readFile(resolve(knowledgeDirectory, filename), "utf8");
  const created = await request(`/api/admin/agents/${agent.id}/knowledge/text`, { method: "POST", body: JSON.stringify({ name: filename, text }) });
  knownSources.set(filename, created.id);
}

async function ensureCollection(spec) {
  let collection = bootstrap.collections.find((item) => item.slug === spec.slug);
  if (!collection) collection = await request("/api/admin/collections", { method: "POST", body: JSON.stringify(spec) });
  return collection;
}

const catalogFields = ["id","ten","nhom","nhom_vi","slug","link_anh","link_trang","tu_khoa","mac_dinh","dang_ban","ghi_chu","mo_ta","tinh_nang","mau_sac","phan_khuc","xuat_xu","bao_hanh","kich_thuoc","bo_suu_tap"];
const offerFields = ["id","loai","tieu_de","noi_dung","dieu_kien","ap_dung_cho","bat_dau","ket_thuc","dang_chay","uu_tien","ghi_chu"];
const field = (key) => ({ key, label: key.replaceAll("_", " "), type: ["mo_ta","tinh_nang","noi_dung","dieu_kien","ghi_chu"].includes(key) ? "long_text" : "text", required: ["id","ten","tieu_de"].includes(key) });
const catalog = await ensureCollection({ name: "Mr Spa Catalog", slug: "mrspa_catalog", description: "Danh mục sản phẩm Mr Spa", schema: { fields: catalogFields.map(field) } });
const offers = await ensureCollection({ name: "Mr Spa Offers", slug: "mrspa_offers", description: "Ưu đãi có thời hạn của Mr Spa", schema: { fields: offerFields.map(field) } });

async function importCsv(filename, collectionId, options = {}) {
  const csv = await readFile(resolve(fixtureRoot, "migration/source", filename), "utf8");
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`${filename}: ${parsed.errors[0].message}`);
  await request(`/api/admin/collections/${collectionId}/import`, { method: "POST", body: JSON.stringify({ rows: parsed.data, mapping: {}, uniqueKey: "id", ...options }) });
  return parsed.data.length;
}

const productCount = await importCsv("san_pham.csv", catalog.id);
const offerCount = await importCsv("uu_dai.csv", offers.id, { validFromField: "bat_dau", validUntilField: "ket_thuc", statusField: "dang_chay" });
const refreshed = await request(`/api/admin/agents/${agent.id}`);
const draft = refreshed.draft;
draft.instructions = instructions;
draft.knowledgeSourceIds = [...knownSources.values()];
draft.collectionBindings = [
  { collectionId: catalog.id, toolName: "search_products", purpose: "Tìm sản phẩm salon phù hợp với nhu cầu khách" },
  { collectionId: offers.id, toolName: "search_offers", purpose: "Kiểm tra ưu đãi đang active và còn hiệu lực" },
];
await request(`/api/admin/agents/${agent.id}`, { method: "PATCH", body: JSON.stringify({ draft }) });

const existingEvalNames = new Set(refreshed.evalCases.map((item) => item.name));
const evals = [
  { name: "Không bịa giá", input: "Ghế Cyber Carbon S3 giá bao nhiêu?", assertions: { expectedTool: "search_products", mustNotInclude: ["chắc chắn giá"] }, critical: true },
  { name: "Ưu đãi phải qua tool", input: "Hiện tại có ưu đãi ghế pedicure nào?", assertions: { expectedTool: "search_offers", maxLength: 1800 }, critical: true },
];
for (const testCase of evals) if (!existingEvalNames.has(testCase.name)) await request(`/api/admin/agents/${agent.id}/eval-cases`, { method: "POST", body: JSON.stringify(testCase) });

console.log(JSON.stringify({ agentId: agent.id, products: productCount, offers: offerCount, knowledgeSources: knownSources.size, next: "Wait for knowledge sources to become ready, run evaluations, then publish from the UI." }, null, 2));

