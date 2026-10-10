import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Papa from "papaparse";
import { api, patch, post, setCsrf } from "./api";
import { modelSupportsTemperature, type AnthropicModel } from "../shared/contracts";

type Page = "agents" | "data" | "connections" | "conversations" | "settings";
type Brand = {
  name: string;
  logoUrl: string;
  primaryColor: string;
  supportUrl: string;
};
type Tool = {
  id: string;
  name: string;
  description: string;
  kind: "http_get" | "plugin";
  status: string;
};
type Agent = {
  id: string;
  name: string;
  description: string;
  primary_language?: string;
  status: string;
  active_version_id?: string | null;
  draft_json?: string;
  draft?: AgentDraft;
  versions?: Array<{ id: string; version: number; published_at: string }>;
  sources?: KnowledgeSource[];
  tools?: Tool[];
};
type AgentDraft = {
  instructions: string;
  modelConfig: {
    model: AnthropicModel;
    credentialId?: string | null;
    accountId?: string | null;
    gatewayId?: string | null;
    temperature: number;
    maxTokens: number;
    timeoutMs: number;
  };
  responsePolicy: { fallbackMessage: string; maxLength: number };
  knowledgeSourceIds: string[];
  collectionBindings: Array<{
    collectionId: string;
    toolName: string;
    purpose: string;
  }>;
  toolBindings: string[];
  customerFieldSchema: unknown[];
  handoffRules: unknown[];
};
type Collection = {
  id: string;
  name: string;
  slug: string;
  description: string;
  schema_json: string;
  updated_at?: string;
};
type Connection = {
  id: string;
  agent_id: string;
  type: string;
  name: string;
  status: string;
  callback_url?: string | null;
  config_json: string;
};
type KnowledgeSource = {
  id: string;
  name: string;
  type: string;
  status: string;
  error?: string | null;
};
type Bootstrap = {
  brand: Brand;
  modelDefaults: Record<string, unknown>;
  agents: Agent[];
  collections: Collection[];
  connections: Connection[];
};
type Conversation = {
  id: string;
  agent_id: string;
  external_user_id: string;
  display_name?: string | null;
  phone?: string | null;
  email?: string | null;
  stage: string;
  human_takeover: number;
  last_message_preview: string;
  last_activity_at: string;
};
type AgentResult = {
  requestId: string;
  status: string;
  messages: Array<{ text: string }>;
  trace?: {
    model?: string;
    latencyMs: number;
    sources: Array<{ name: string; score?: number }>;
    toolCalls: Array<{ name: string; input: unknown; output: unknown }>;
    error?: string;
  };
};

const defaultBrand: Brand = {
  name: "Agent Platform",
  logoUrl: "",
  primaryColor: "#c6ff4a",
  supportUrl: "",
};

function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    agents: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path d="M5 20v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2" />
        <path d="M4 5h2M18 5h2M12 1v2" />
      </>
    ),
    data: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
        <path d="M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" />
      </>
    ),
    connections: (
      <>
        <path d="M9 7H6a4 4 0 0 0 0 8h3M15 7h3a4 4 0 0 1 0 8h-3M8 11h8v2H8z" />
      </>
    ),
    conversations: (
      <>
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
        <path d="M8 9h8M8 13h5" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z" />
      </>
    ),
  };
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function Button({
  children,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button className={`button ${variant}`} {...props}>
      {children}
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function BrandLogo({ brand, large = false }: { brand: Brand; large?: boolean }) {
  return (
    <div className={`brand-mark ${large ? "large" : ""}`}>
      {brand.logoUrl ? <img src={brand.logoUrl} alt="" /> : brand.name.slice(0, 1)}
    </div>
  );
}

function Setup({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    bootstrapToken: "",
    email: "",
    password: "",
    name: "Agent Platform",
    logoUrl: "",
    primaryColor: "#c6ff4a",
    supportUrl: "",
    anthropicApiKey: "",
    accountId: "",
    gatewayId: "",
  });
  const update = (key: string, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await post<{ csrfToken: string }>("/api/setup", {
        bootstrapToken: form.bootstrapToken,
        email: form.email,
        password: form.password,
        brand: {
          name: form.name,
          logoUrl: form.logoUrl,
          primaryColor: form.primaryColor,
          supportUrl: form.supportUrl,
        },
        anthropicApiKey: form.anthropicApiKey || undefined,
        accountId: form.accountId || undefined,
        gatewayId: form.gatewayId || undefined,
      });
      setCsrf(result.csrfToken);
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Setup failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-shell">
      <div className="auth-art">
        <div className="brand-mark large">M</div>
        <div>
          <p className="eyebrow">Reusable Agent Platform</p>
          <h1>
            Một runtime.
            <br />
            Mọi kênh.
          </h1>
          <p>
            Build agent một lần, kết nối vào API, webhook hoặc Zernio khi sẵn
            sàng.
          </p>
        </div>
        <div className="signal">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <div className="setup-steps">
          <span className={step === 0 ? "active" : "done"}>01</span>
          <i />
          <span className={step === 1 ? "active" : ""}>02</span>
        </div>
        {step === 0 ? (
          <>
            <p className="eyebrow">Bước 1 / 2</p>
            <h2>Khởi tạo instance</h2>
            <p className="muted">
              Bootstrap token chỉ được chấp nhận đúng một lần.
            </p>
            <Field label="Bootstrap token">
              <input
                type="password"
                value={form.bootstrapToken}
                onChange={(e) => update("bootstrapToken", e.target.value)}
                required
              />
            </Field>
            <Field label="Admin email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                required
              />
            </Field>
            <Field label="Admin password" hint="Tối thiểu 12 ký tự">
              <input
                type="password"
                minLength={12}
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                required
              />
            </Field>
            <Button
              type="button"
              onClick={() => setStep(1)}
              disabled={
                !form.bootstrapToken || !form.email || form.password.length < 12
              }
            >
              Tiếp tục →
            </Button>
          </>
        ) : (
          <>
            <p className="eyebrow">Bước 2 / 2</p>
            <h2>Brand & model</h2>
            <div className="two-col">
              <Field label="Tên thương hiệu">
                <input
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  required
                />
              </Field>
              <Field label="Màu chính">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => update("primaryColor", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Logo URL">
              <input
                type="url"
                value={form.logoUrl}
                onChange={(e) => update("logoUrl", e.target.value)}
                placeholder="https://…"
              />
            </Field>
            <Field label="Support URL">
              <input
                type="url"
                value={form.supportUrl}
                onChange={(e) => update("supportUrl", e.target.value)}
                placeholder="https://…"
              />
            </Field>
            <Field label="Anthropic API key">
              <input
                type="password"
                value={form.anthropicApiKey}
                onChange={(e) => update("anthropicApiKey", e.target.value)}
                placeholder="sk-ant-…"
              />
            </Field>
            <Field label="Cloudflare account ID">
              <input
                value={form.accountId}
                onChange={(e) => update("accountId", e.target.value)}
              />
            </Field>
            <Field label="AI Gateway ID">
              <input
                value={form.gatewayId}
                onChange={(e) => update("gatewayId", e.target.value)}
              />
            </Field>
            {error && <div className="error-box">{error}</div>}
            <div className="button-row">
              <Button type="button" variant="ghost" onClick={() => setStep(0)}>
                ← Quay lại
              </Button>
              <Button disabled={busy}>
                {busy ? "Đang tạo…" : "Hoàn tất setup"}
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

function Login({ brand, onDone }: { brand: Brand; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await post<{ csrfToken: string }>("/api/auth/login", {
        email,
        password,
      });
      setCsrf(result.csrfToken);
      onDone();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login failed");
    }
  }
  return (
    <div className="login-shell">
      <form className="auth-card compact" onSubmit={submit}>
        <BrandLogo brand={brand} />
        <p className="eyebrow">Control plane</p>
        <h2>Đăng nhập {brand.name}</h2>
        <p className="muted">
          Quản lý agent, dữ liệu và các kết nối của instance.
        </p>
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        {error && <div className="error-box">{error}</div>}
        <Button>Đăng nhập</Button>
      </form>
    </div>
  );
}

function AgentList({
  agents,
  onSelect,
  onCreate,
}: {
  agents: Agent[];
  onSelect: (agent: Agent) => void;
  onCreate: () => void;
}) {
  return (
    <section>
      <div className="page-head">
        <div>
          <p className="eyebrow">Build & govern</p>
          <h1>Agents</h1>
          <p>Tạo behavior, gắn nguồn dữ liệu, test và publish.</p>
        </div>
        <Button onClick={onCreate}>+ Tạo agent</Button>
      </div>
      {agents.length === 0 ? (
        <Empty
          title="Tạo agent đầu tiên"
          text="Bắt đầu với một template đơn giản. Bạn có thể thêm knowledge và data sau."
          action={<Button onClick={onCreate}>Tạo Sales Agent</Button>}
        />
      ) : (
        <div className="card-grid">
          {agents.map((agent) => (
            <button
              className="agent-card"
              key={agent.id}
              onClick={() => onSelect(agent)}
            >
              <div className="agent-orb">
                {agent.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="card-title">
                  <h3>{agent.name}</h3>
                  <Status value={agent.status} />
                </div>
                <p>{agent.description || "Chưa có mô tả"}</p>
                <small>
                  {agent.active_version_id
                    ? "Đã publish"
                    : "Draft chưa publish"}
                </small>
              </div>
              <span className="arrow">→</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function AgentBuilder({
  agentId,
  collections,
  onBack,
  refresh,
}: {
  agentId: string;
  collections: Collection[];
  onBack: () => void;
  refresh: () => Promise<void>;
}) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [tab, setTab] = useState("behavior");
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<AgentResult | null>(null);
  const [previewText, setPreviewText] = useState("");
  const [conversationId, setConversationId] = useState(crypto.randomUUID());
  async function load() {
    setAgent(await api<Agent>(`/api/admin/agents/${agentId}`));
  }
  useEffect(() => {
    void load();
  }, [agentId]);
  const draft = agent?.draft;
  function mutate(fn: (draft: AgentDraft) => AgentDraft) {
    if (!draft) return;
    setAgent((current) =>
      current ? { ...current, draft: fn(structuredClone(draft)) } : current,
    );
    setSaved(false);
  }
  async function save() {
    if (!agent?.draft) return;
    setError("");
    try {
      await patch(`/api/admin/agents/${agent.id}`, {
        name: agent.name,
        description: agent.description,
        draft: agent.draft,
      });
      setSaved(true);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed");
    }
  }
  async function publish() {
    await save();
    try {
      await post(`/api/admin/agents/${agentId}/publish`);
      await load();
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Publish failed");
    }
  }
  async function sendPreview(event: FormEvent) {
    event.preventDefault();
    if (!previewText.trim()) return;
    setPreview(null);
    try {
      setPreview(
        await post<AgentResult>(`/api/admin/agents/${agentId}/preview`, {
          text: previewText,
          conversationId,
        }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Preview failed");
    }
  }
  if (!agent || !draft) return <Loader />;
  return (
    <section>
      <div className="builder-head">
        <button className="back" onClick={onBack}>
          ←
        </button>
        <div>
          <div className="title-line">
            <h1>{agent.name}</h1>
            <Status value={agent.status} />
          </div>
          <p>{agent.description || "Agent configuration"}</p>
        </div>
        <div className="builder-actions">
          <span className={saved ? "save-state" : "save-state unsaved"}>
            {saved ? "Saved" : "Unsaved changes"}
          </span>
          <Button variant="secondary" onClick={save}>
            Lưu draft
          </Button>
          <Button onClick={publish}>Publish</Button>
        </div>
      </div>
      {error && <div className="error-box">{error}</div>}
      <div className="builder-tabs">
        {["behavior", "sources", "preview", "versions"].map((item) => (
          <button
            className={tab === item ? "active" : ""}
            onClick={() => setTab(item)}
            key={item}
          >
            {item === "behavior"
              ? "Behavior"
              : item === "sources"
                ? "Sources & Actions"
                : item === "preview"
                  ? "Preview"
                  : "Versions"}
          </button>
        ))}
      </div>
      {tab === "behavior" && (
        <div className="split-layout">
          <div className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Core behavior</p>
                <h2>Instructions</h2>
              </div>
              <span className="counter">{draft.instructions.length} chars</span>
            </div>
            <textarea
              className="instruction-editor"
              value={draft.instructions}
              onChange={(e) =>
                mutate((value) => ({ ...value, instructions: e.target.value }))
              }
              placeholder="Mô tả vai trò, mục tiêu, tone, boundaries và handoff rules…"
            />
            <div className="hint-card">
              <b>Nguyên tắc tốt</b>
              <p>
                Đặt vai trò và giới hạn trong Behavior. Giá, ưu đãi và dữ liệu
                thay đổi nên nằm trong Data Collections.
              </p>
            </div>
          </div>
          <aside className="panel settings-panel">
            <p className="eyebrow">Model settings</p>
            <Field label="Model">
              <select
                value={draft.modelConfig.model}
                onChange={(e) =>
                  mutate((value) => ({
                    ...value,
                    modelConfig: {
                      ...value.modelConfig,
                      model: e.target
                        .value as AgentDraft["modelConfig"]["model"],
                    },
                  }))
                }
              >
                <option value="claude-sonnet-5-5">Claude Sonnet 5.5</option>
                <option value="claude-opus-5-5">Claude Opus 5.5</option>
                <option value="claude-haiku-5-5">Claude Haiku 5.5</option>
                <option value="claude-sonnet-5">Claude Sonnet 5</option>
                <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                <option value="claude-haiku-4-5-20251001">
                  Claude Haiku 4.5
                </option>
                <option value="claude-opus-5">Claude Opus 5</option>
              </select>
            </Field>
            <div className="two-col">
              <Field
                label="Temperature"
                hint={
                  modelSupportsTemperature(draft.modelConfig.model)
                    ? undefined
                    : "Model này dùng sampling mặc định"
                }
              >
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  disabled={!modelSupportsTemperature(draft.modelConfig.model)}
                  value={draft.modelConfig.temperature}
                  onChange={(e) =>
                    mutate((value) => ({
                      ...value,
                      modelConfig: {
                        ...value.modelConfig,
                        temperature: Number(e.target.value),
                      },
                    }))
                  }
                />
              </Field>
              <Field label="Max tokens">
                <input
                  type="number"
                  value={draft.modelConfig.maxTokens}
                  onChange={(e) =>
                    mutate((value) => ({
                      ...value,
                      modelConfig: {
                        ...value.modelConfig,
                        maxTokens: Number(e.target.value),
                      },
                    }))
                  }
                />
              </Field>
            </div>
            <Field label="Fallback message">
              <textarea
                rows={4}
                value={draft.responsePolicy.fallbackMessage}
                onChange={(e) =>
                  mutate((value) => ({
                    ...value,
                    responsePolicy: {
                      ...value.responsePolicy,
                      fallbackMessage: e.target.value,
                    },
                  }))
                }
              />
            </Field>
          </aside>
        </div>
      )}
      {tab === "sources" && (
        <Sources
          agent={agent}
          collections={collections}
          mutate={mutate}
          reload={load}
        />
      )}{" "}
      {tab === "preview" && (
        <div className="preview-layout">
          <div className="chat-panel">
            <div className="chat-top">
              <div>
                <b>Draft Preview</b>
                <small>Isolated test conversation</small>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setConversationId(crypto.randomUUID());
                  setPreview(null);
                }}
              >
                New conversation
              </Button>
            </div>
            <div className="chat-body">
              {!preview && (
                <div className="preview-empty">
                  <div className="pulse-orb" />
                  <h3>Test như một khách hàng</h3>
                  <p>
                    Trace sẽ cho biết source, tool và latency của lượt trả lời.
                  </p>
                </div>
              )}
              {preview && (
                <>
                  <div className="bubble user">{previewText}</div>
                  {preview.messages.map((message, index) => (
                    <div className="bubble agent" key={index}>
                      {message.text}
                    </div>
                  ))}
                </>
              )}
            </div>
            <form className="chat-input" onSubmit={sendPreview}>
              <textarea
                rows={2}
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                placeholder="Nhập câu hỏi để test…"
              />
              <Button>Gửi</Button>
            </form>
          </div>
          <Trace result={preview} />
        </div>
      )}
      {tab === "versions" && (
        <div className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Immutable history</p>
              <h2>Versions</h2>
            </div>
          </div>
          <div className="version-list">
            {agent.versions?.map((version) => (
              <div className="version-row" key={version.id}>
                <div className="version-number">v{version.version}</div>
                <div>
                  <b>
                    {agent.active_version_id === version.id
                      ? "Production"
                      : "Published snapshot"}
                  </b>
                  <small>
                    {new Date(version.published_at).toLocaleString("vi-VN")}
                  </small>
                </div>
                {agent.active_version_id !== version.id && (
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      await post(
                        `/api/admin/agents/${agent.id}/rollback/${version.id}`,
                      );
                      await load();
                    }}
                  >
                    Rollback
                  </Button>
                )}
              </div>
            ))}
            {!agent.versions?.length && (
              <Empty
                title="Chưa có version"
                text="Publish draft để tạo immutable version đầu tiên."
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Sources({
  agent,
  collections,
  mutate,
  reload,
}: {
  agent: Agent;
  collections: Collection[];
  mutate: (fn: (draft: AgentDraft) => AgentDraft) => void;
  reload: () => Promise<void>;
}) {
  const [kind, setKind] = useState<"text" | "url">("text");
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [tool, setTool] = useState({
    name: "",
    description: "",
    kind: "http_get",
    urlTemplate: "",
    pluginId: "normalize_contact",
  });
  const draft = agent.draft!;
  async function addSource() {
    if (!name || !content) return;
    await post(
      `/api/admin/agents/${agent.id}/knowledge/${kind}`,
      kind === "text" ? { name, text: content } : { name, url: content },
    );
    setName("");
    setContent("");
    await reload();
  }
  function bind(collection: Collection) {
    if (
      draft.collectionBindings.some(
        (item) => item.collectionId === collection.id,
      )
    )
      mutate((value) => ({
        ...value,
        collectionBindings: value.collectionBindings.filter(
          (item) => item.collectionId !== collection.id,
        ),
      }));
    else
      mutate((value) => ({
        ...value,
        collectionBindings: [
          ...value.collectionBindings,
          {
            collectionId: collection.id,
            toolName: `search_${collection.slug.replaceAll("-", "_")}`,
            purpose: `Tìm ${collection.name} phù hợp với câu hỏi của khách`,
          },
        ],
      }));
  }
  async function addTool() {
    const inputSchema =
      tool.kind === "http_get"
        ? {
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query"],
          }
        : {
            type: "object",
            properties: {
              name: { type: "string" },
              phone: { type: "string" },
              email: { type: "string" },
            },
          };
    await post(`/api/admin/agents/${agent.id}/tools`, {
      ...tool,
      inputSchema,
      outputSchema: { type: "object" },
    });
    setTool({
      name: "",
      description: "",
      kind: "http_get",
      urlTemplate: "",
      pluginId: "normalize_contact",
    });
    await reload();
  }
  function bindTool(name: string) {
    mutate((value) => ({
      ...value,
      toolBindings: value.toolBindings.includes(name)
        ? value.toolBindings.filter((item) => item !== name)
        : [...value.toolBindings, name],
    }));
  }
  return (
    <div className="source-grid">
      <div className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Semantic knowledge</p>
            <h2>Knowledge</h2>
          </div>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "text" | "url")}
          >
            <option value="text">Text / Markdown</option>
            <option value="url">Single URL</option>
          </select>
        </div>
        <div className="inline-form">
          <input
            placeholder="Tên nguồn"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {kind === "text" ? (
            <textarea
              rows={5}
              placeholder="Paste nội dung .md hoặc .txt…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          ) : (
            <input
              type="url"
              placeholder="https://…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          )}
          <Button onClick={addSource}>Thêm source</Button>
        </div>
        <div className="source-list">
          {agent.sources?.map((source) => (
            <label className="source-row" key={source.id}>
              <input
                type="checkbox"
                checked={draft.knowledgeSourceIds.includes(source.id)}
                onChange={() =>
                  mutate((value) => ({
                    ...value,
                    knowledgeSourceIds: value.knowledgeSourceIds.includes(
                      source.id,
                    )
                      ? value.knowledgeSourceIds.filter(
                          (item) => item !== source.id,
                        )
                      : [...value.knowledgeSourceIds, source.id],
                  }))
                }
              />
              <div>
                <b>{source.name}</b>
                <small>{source.type}</small>
              </div>
              <Status value={source.status} />
            </label>
          ))}
        </div>
      </div>
      <div className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Structured truth</p>
            <h2>Data Collections</h2>
          </div>
        </div>
        <p className="muted">
          Bind collection thành read-only tool. Agent phải gọi tool trước khi
          nói về giá hoặc ưu đãi.
        </p>
        <div className="source-list">
          {collections.map((collection) => (
            <button
              className={`binding-row ${draft.collectionBindings.some((item) => item.collectionId === collection.id) ? "selected" : ""}`}
              onClick={() => bind(collection)}
              key={collection.id}
            >
              <div>
                <b>{collection.name}</b>
                <small>{collection.description}</small>
              </div>
              <span>
                {draft.collectionBindings.some(
                  (item) => item.collectionId === collection.id,
                )
                  ? "Bound ✓"
                  : "Bind +"}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="panel full">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Read-only actions</p>
            <h2>HTTP Tools & Code Plugins</h2>
          </div>
        </div>
        <div className="tool-builder">
          <input
            placeholder="tool_name"
            value={tool.name}
            onChange={(e) =>
              setTool({
                ...tool,
                name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
              })
            }
          />
          <input
            placeholder="Mô tả lúc nào agent nên gọi tool"
            value={tool.description}
            onChange={(e) => setTool({ ...tool, description: e.target.value })}
          />
          <select
            value={tool.kind}
            onChange={(e) => setTool({ ...tool, kind: e.target.value })}
          >
            <option value="http_get">HTTP GET</option>
            <option value="plugin">Code plugin</option>
          </select>
          {tool.kind === "http_get" ? (
            <input
              type="url"
              placeholder="https://api.example.com/search?q={query}"
              value={tool.urlTemplate}
              onChange={(e) =>
                setTool({ ...tool, urlTemplate: e.target.value })
              }
            />
          ) : (
            <select
              value={tool.pluginId}
              onChange={(e) => setTool({ ...tool, pluginId: e.target.value })}
            >
              <option value="normalize_contact">normalize_contact</option>
              <option value="active_at">active_at</option>
            </select>
          )}
          <Button
            onClick={addTool}
            disabled={
              !tool.name ||
              !tool.description ||
              (tool.kind === "http_get" && !tool.urlTemplate)
            }
          >
            Create tool
          </Button>
        </div>
        <div className="source-list">
          {agent.tools?.map((item) => (
            <button
              className={`binding-row ${draft.toolBindings.includes(item.name) ? "selected" : ""}`}
              key={item.id}
              onClick={() => bindTool(item.name)}
            >
              <div>
                <b>{item.name}</b>
                <small>
                  {item.kind} · {item.description}
                </small>
              </div>
              <span>
                {draft.toolBindings.includes(item.name) ? "Bound ✓" : "Bind +"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Trace({ result }: { result: AgentResult | null }) {
  return (
    <aside className="trace-panel">
      <p className="eyebrow">Execution trace</p>
      {!result?.trace ? (
        <p className="muted">Gửi một message để xem runtime trace.</p>
      ) : (
        <>
          <div className="trace-metric">
            <span>Status</span>
            <b>{result.status}</b>
          </div>
          <div className="trace-metric">
            <span>Latency</span>
            <b>{result.trace.latencyMs} ms</b>
          </div>
          <div className="trace-metric">
            <span>Model</span>
            <b>{result.trace.model}</b>
          </div>
          <h4>Knowledge sources</h4>
          {result.trace.sources.length ? (
            result.trace.sources.map((source, index) => (
              <div className="trace-item" key={index}>
                <b>{source.name}</b>
                <span>
                  {source.score ? `${Math.round(source.score * 100)}%` : "used"}
                </span>
              </div>
            ))
          ) : (
            <p className="muted small">No source retrieved</p>
          )}
          <h4>Tool calls</h4>
          {result.trace.toolCalls.length ? (
            result.trace.toolCalls.map((tool, index) => (
              <details key={index}>
                <summary>{tool.name}</summary>
                <pre>{JSON.stringify(tool, null, 2)}</pre>
              </details>
            ))
          ) : (
            <p className="muted small">No tool called</p>
          )}
          {result.trace.error && (
            <div className="error-box">{result.trace.error}</div>
          )}
        </>
      )}
    </aside>
  );
}

function DataPage({
  collections,
  reload,
}: {
  collections: Collection[];
  reload: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<Collection | null>(
    collections[0] ?? null,
  );
  const [records, setRecords] = useState<Array<Record<string, unknown>>>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (selected)
      void api<Array<Record<string, unknown>>>(
        `/api/admin/collections/${selected.id}/records`,
      ).then(setRecords);
  }, [selected?.id]);
  async function importCsv(file: File) {
    const parsed = Papa.parse<Record<string, unknown>>(await file.text(), {
      header: true,
      skipEmptyLines: true,
    });
    if (parsed.errors.length) {
      setError(parsed.errors[0].message);
      return;
    }
    try {
      await post(`/api/admin/collections/${selected!.id}/import`, {
        rows: parsed.data,
        mapping: {},
        uniqueKey: undefined,
      });
      setRecords(await api(`/api/admin/collections/${selected!.id}/records`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import failed");
    }
  }
  return (
    <section>
      <div className="page-head">
        <div>
          <p className="eyebrow">Structured data</p>
          <h1>Data</h1>
          <p>
            Catalog, offers và facts có schema — tách biệt khỏi semantic
            knowledge.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Collection</Button>
      </div>
      {error && <div className="error-box">{error}</div>}
      <div className="data-layout">
        <aside className="collection-list">
          {collections.map((collection) => (
            <button
              className={selected?.id === collection.id ? "active" : ""}
              onClick={() => setSelected(collection)}
              key={collection.id}
            >
              <div className="collection-icon">
                {collection.name.slice(0, 1)}
              </div>
              <div>
                <b>{collection.name}</b>
                <small>{collection.slug}</small>
              </div>
            </button>
          ))}
        </aside>
        <div className="panel data-panel">
          {selected ? (
            <>
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Collection</p>
                  <h2>{selected.name}</h2>
                  <p>{selected.description}</p>
                </div>
                <label className="button secondary file-button">
                  Import CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) =>
                      e.target.files?.[0] && void importCsv(e.target.files[0])
                    }
                  />
                </label>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Data</th>
                      <th>Status</th>
                      <th>Valid until</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr key={String(record.id)}>
                        <td>
                          <code>{String(record.id).slice(-8)}</code>
                        </td>
                        <td>
                          {Object.entries(
                            JSON.parse(String(record.data_json ?? "{}")),
                          )
                            .slice(0, 3)
                            .map(([key, value]) => (
                              <span className="data-chip" key={key}>
                                <b>{key}</b> {String(value)}
                              </span>
                            ))}
                        </td>
                        <td>
                          <Status value={String(record.status)} />
                        </td>
                        <td>{String(record.valid_until ?? "—")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!records.length && (
                  <Empty
                    title="Collection đang trống"
                    text="Import CSV hoặc thêm record qua API."
                  />
                )}
              </div>
            </>
          ) : (
            <Empty
              title="Chọn một collection"
              text="Collection là nguồn dữ liệu động có schema."
            />
          )}
        </div>
      </div>
      {showCreate && (
        <CreateCollection
          onClose={() => setShowCreate(false)}
          onDone={async () => {
            setShowCreate(false);
            await reload();
          }}
        />
      )}
    </section>
  );
}

function CreateCollection({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [fields, setFields] = useState([
    { key: "name", label: "Name", type: "text", required: true },
    {
      key: "description",
      label: "Description",
      type: "long_text",
      required: false,
    },
  ]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    await post("/api/admin/collections", {
      name,
      slug,
      description: "Custom structured data",
      schema: { fields },
    });
    onDone();
  }
  function updateField(index: number, value: Partial<(typeof fields)[number]>) {
    setFields((current) =>
      current.map((field, itemIndex) =>
        itemIndex === index ? { ...field, ...value } : field,
      ),
    );
  }
  return (
    <Modal title="New collection" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_"));
            }}
            required
          />
        </Field>
        <Field label="Slug">
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            pattern="[a-z][a-z0-9_-]*"
            required
          />
        </Field>
        <div className="field-builder">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Schema</p>
              <h3>Fields</h3>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setFields((current) => [
                  ...current,
                  {
                    key: `field_${current.length + 1}`,
                    label: "New field",
                    type: "text",
                    required: false,
                  },
                ])
              }
            >
              + Field
            </Button>
          </div>
          {fields.map((field, index) => (
            <div className="field-row" key={index}>
              <input
                value={field.label}
                onChange={(e) =>
                  updateField(index, {
                    label: e.target.value,
                    key: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "_"),
                  })
                }
              />
              <input
                value={field.key}
                onChange={(e) => updateField(index, { key: e.target.value })}
              />
              <select
                value={field.type}
                onChange={(e) => updateField(index, { type: e.target.value })}
              >
                <option value="text">Text</option>
                <option value="long_text">Long text</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="date">Date</option>
                <option value="datetime">Datetime</option>
                <option value="enum">Enum</option>
                <option value="multi_enum">Multi enum</option>
                <option value="url">URL</option>
                <option value="image_url">Image URL</option>
                <option value="relation">Relation</option>
              </select>
              <label>
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) =>
                    updateField(index, { required: e.target.checked })
                  }
                />{" "}
                Required
              </label>
              <button
                type="button"
                disabled={fields.length === 1}
                onClick={() =>
                  setFields((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="button-row">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button>Tạo collection</Button>
        </div>
      </form>
    </Modal>
  );
}

function ConnectionsPage({
  connections,
  agents,
  reload,
}: {
  connections: Connection[];
  agents: Agent[];
  reload: () => Promise<void>;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [secret, setSecret] = useState<Record<string, string> | null>(null);
  return (
    <section>
      <div className="page-head">
        <div>
          <p className="eyebrow">Channels</p>
          <h1>Connections</h1>
          <p>Mọi channel normalize về cùng một AgentRuntime.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Connection</Button>
      </div>
      <div className="connection-grid">
        {connections.map((connection) => (
          <div className="connection-card" key={connection.id}>
            <div className={`provider-logo ${connection.type}`}>
              {connection.type === "zernio" ? "Z" : "↗"}
            </div>
            <div>
              <div className="card-title">
                <h3>{connection.name}</h3>
                <Status value={connection.status} />
              </div>
              <p>{connection.type.replaceAll("_", " ")}</p>
              <code>
                /api/v1/
                {connection.type === "generic_api"
                  ? "messages"
                  : `webhooks/${connection.type}`}
              </code>
            </div>
            {connection.status !== "active" && (
              <Button
                variant="secondary"
                onClick={async () => {
                  await post(
                    `/api/admin/connections/${connection.id}/activate`,
                  );
                  await reload();
                }}
              >
                Activate
              </Button>
            )}
          </div>
        ))}
      </div>
      {!connections.length && (
        <Empty
          title="Chưa có connection"
          text="Publish agent trước, sau đó kết nối Generic API hoặc Zernio."
          action={
            <Button onClick={() => setShowCreate(true)}>Tạo connection</Button>
          }
        />
      )}{" "}
      {showCreate && (
        <CreateConnection
          agents={agents}
          onClose={() => setShowCreate(false)}
          onDone={async (value) => {
            setShowCreate(false);
            setSecret(value);
            await reload();
          }}
        />
      )}{" "}
      {secret && (
        <Modal title="Copy credentials now" onClose={() => setSecret(null)}>
          <div className="warning-box">Các key này chỉ hiển thị một lần.</div>
          {Object.entries(secret).map(([key, value]) => (
            <Field label={key} key={key}>
              <div className="copy-value">
                <code>{value}</code>
                <button onClick={() => navigator.clipboard.writeText(value)}>
                  Copy
                </button>
              </div>
            </Field>
          ))}
        </Modal>
      )}
    </section>
  );
}

function CreateConnection({
  agents,
  onClose,
  onDone,
}: {
  agents: Agent[];
  onClose: () => void;
  onDone: (value: Record<string, string>) => void;
}) {
  const [form, setForm] = useState({
    agentId: agents[0]?.id ?? "",
    type: "generic_api",
    name: "",
    callbackUrl: "",
    inboxApiUrl: "",
    apiCredential: "",
    webhookSecret: "",
  });
  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await post<Record<string, string>>(
      "/api/admin/connections",
      {
        agentId: form.agentId,
        type: form.type,
        name: form.name,
        callbackUrl: form.callbackUrl || null,
        config: form.inboxApiUrl ? { inboxApiUrl: form.inboxApiUrl } : {},
        apiCredential: form.apiCredential || undefined,
        webhookSecret: form.webhookSecret || undefined,
      },
    );
    onDone({
      apiKey: result.apiKey,
      webhookToken: result.webhookToken,
      webhookPath: result.webhookPath,
    });
  }
  return (
    <Modal title="New connection" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Agent">
          <select
            value={form.agentId}
            onChange={(e) => setForm({ ...form, agentId: e.target.value })}
          >
            {agents.map((agent) => (
              <option value={agent.id} key={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type">
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            <option value="generic_api">Generic API</option>
            <option value="generic_webhook">Generic webhook</option>
            <option value="zernio">Zernio</option>
          </select>
        </Field>
        <Field label="Name">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </Field>
        {form.type !== "zernio" && (
          <Field label="Allowlisted callback URL">
            <input
              type="url"
              value={form.callbackUrl}
              onChange={(e) =>
                setForm({ ...form, callbackUrl: e.target.value })
              }
              placeholder="https://client.example.com/agent-result"
            />
          </Field>
        )}
        {form.type === "zernio" && (
          <>
            <Field label="Zernio Inbox API URL">
              <input
                type="url"
                value={form.inboxApiUrl}
                onChange={(e) =>
                  setForm({ ...form, inboxApiUrl: e.target.value })
                }
                required
              />
            </Field>
            <Field label="Zernio API token">
              <input
                type="password"
                value={form.apiCredential}
                onChange={(e) =>
                  setForm({ ...form, apiCredential: e.target.value })
                }
                required
              />
            </Field>
            <Field label="Webhook signing secret">
              <input
                type="password"
                value={form.webhookSecret}
                onChange={(e) =>
                  setForm({ ...form, webhookSecret: e.target.value })
                }
                required
              />
            </Field>
          </>
        )}
        <div className="button-row">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button>Tạo connection</Button>
        </div>
      </form>
    </Modal>
  );
}

function ConversationsPage() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [query, setQuery] = useState("");
  async function load(value = query) {
    setItems(
      await api(
        `/api/admin/conversations${value ? `?q=${encodeURIComponent(value)}` : ""}`,
      ),
    );
  }
  useEffect(() => {
    void load("");
  }, []);
  return (
    <section>
      <div className="page-head">
        <div>
          <p className="eyebrow">Customer memory</p>
          <h1>Conversations</h1>
          <p>Conversation identity, contact và human takeover.</p>
        </div>
        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <input
            placeholder="Tìm external user ID, tên, phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
      </div>
      <div className="panel">
        <div className="conversation-list">
          {items.map((conversation) => (
            <div className="conversation-row" key={conversation.id}>
              <div className="avatar">
                {(conversation.display_name || conversation.external_user_id)
                  .slice(0, 1)
                  .toUpperCase()}
              </div>
              <div className="conversation-main">
                <div>
                  <b>
                    {conversation.display_name || conversation.external_user_id}
                  </b>
                  <Status value={conversation.stage} />
                </div>
                <p>
                  {conversation.last_message_preview || "No message preview"}
                </p>
                <small>
                  {conversation.phone ||
                    conversation.email ||
                    conversation.external_user_id}
                </small>
              </div>
              <div className="conversation-time">
                {new Date(conversation.last_activity_at).toLocaleString(
                  "vi-VN",
                )}
              </div>
              <Button
                variant={conversation.human_takeover ? "danger" : "secondary"}
                onClick={async () => {
                  await post(
                    `/api/admin/conversations/${encodeURIComponent(conversation.id)}/takeover`,
                    { enabled: !conversation.human_takeover },
                  );
                  await load();
                }}
              >
                {conversation.human_takeover ? "Resume bot" : "Take over"}
              </Button>
            </div>
          ))}
          {!items.length && (
            <Empty
              title="Chưa có conversation"
              text="Conversation sẽ xuất hiện sau khi Preview hoặc một connection nhận message."
            />
          )}
        </div>
      </div>
    </section>
  );
}

function SettingsPage({
  brand,
  reload,
}: {
  brand: Brand;
  reload: () => Promise<void>;
}) {
  const [form, setForm] = useState(brand);
  const [model, setModel] = useState({
    apiKey: "",
    accountId: "",
    gatewayId: "",
  });
  const [notice, setNotice] = useState("");
  return (
    <section>
      <div className="page-head">
        <div>
          <p className="eyebrow">Instance</p>
          <h1>Settings</h1>
          <p>Branding, model connection và export.</p>
        </div>
      </div>
      <div className="settings-grid">
        <div className="panel">
          <h2>Brand</h2>
            <Field label="Brand name">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <div className="two-col">
            <Field label="Primary color">
              <input
                type="color"
                value={form.primaryColor}
                onChange={(e) =>
                  setForm({ ...form, primaryColor: e.target.value })
                }
              />
            </Field>
            <Field label="Logo URL">
              <input
                type="url"
                value={form.logoUrl}
                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              />
            </Field>
            <Field label="Support URL">
              <input
                value={form.supportUrl}
                onChange={(e) =>
                  setForm({ ...form, supportUrl: e.target.value })
                }
              />
            </Field>
          </div>
          <Button
            onClick={async () => {
              await patch("/api/admin/settings/brand", form);
              setNotice("Đã lưu brand");
              await reload();
            }}
          >
            Lưu branding
          </Button>
        </div>
        <div className="panel">
          <h2>Anthropic via AI Gateway</h2>
          <Field label="Anthropic API key">
            <input
              type="password"
              value={model.apiKey}
              onChange={(e) => setModel({ ...model, apiKey: e.target.value })}
              placeholder="Chỉ nhập khi rotate"
            />
          </Field>
          <Field label="Cloudflare account ID">
            <input
              value={model.accountId}
              onChange={(e) =>
                setModel({ ...model, accountId: e.target.value })
              }
            />
          </Field>
          <Field label="Gateway ID">
            <input
              value={model.gatewayId}
              onChange={(e) =>
                setModel({ ...model, gatewayId: e.target.value })
              }
            />
          </Field>
          <div className="button-row">
            <Button
              variant="secondary"
              onClick={async () => {
                const result = await post<{
                  connected: boolean;
                  model: string;
                }>("/api/admin/settings/anthropic/test");
                setNotice(
                  result.connected
                    ? `Connected · ${result.model}`
                    : "Connection failed",
                );
              }}
            >
              Test connection
            </Button>
            <Button
              onClick={async () => {
                await post("/api/admin/settings/anthropic", model);
                setNotice("Credential đã được mã hóa và lưu");
              }}
            >
              Save credential
            </Button>
          </div>
        </div>
        <div className="panel">
          <h2>Backup</h2>
          <p className="muted">
            Export agent config, versions và structured data. Secrets không bao
            giờ nằm trong export.
          </p>
          <a className="button secondary" href="/api/admin/export" download>
            Download export
          </a>
        </div>
      </div>
      {notice && <div className="toast">{notice}</div>}
    </section>
  );
}

function CreateAgent({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (id: string) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    primaryLanguage: "vi",
    template: "sales",
  });
  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await post<{ id: string }>("/api/admin/agents", form);
    onDone(result.id);
  }
  return (
    <Modal title="Create agent" onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Agent name">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Mr Spa Consultant"
            required
          />
        </Field>
        <Field label="Agent này giúp khách hàng làm gì?">
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <div className="two-col">
          <Field label="Primary language">
            <select
              value={form.primaryLanguage}
              onChange={(e) =>
                setForm({ ...form, primaryLanguage: e.target.value })
              }
            >
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </Field>
          <Field label="Starter template">
            <select
              value={form.template}
              onChange={(e) => setForm({ ...form, template: e.target.value })}
            >
              <option value="sales">Sales Consultant</option>
              <option value="support">Customer Support</option>
              <option value="blank">Blank</option>
            </select>
          </Field>
        </div>
        <div className="button-row">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button>Tạo agent</Button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal">
        <div className="modal-head">
          <h2>{title}</h2>
          <button onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-symbol">✦</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className={`status status-${value.replaceAll("_", "-")}`}>
      <i />
      {value.replaceAll("_", " ")}
    </span>
  );
}
function Loader() {
  return (
    <div className="loader">
      <span />
      <span />
      <span />
    </div>
  );
}

function Shell({
  data,
  reload,
  logout,
}: {
  data: Bootstrap;
  reload: () => Promise<void>;
  logout: () => void;
}) {
  const [page, setPage] = useState<Page>("agents");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [createAgent, setCreateAgent] = useState(false);
  const nav: Array<{ id: Page; label: string }> = [
    { id: "agents", label: "Agents" },
    { id: "data", label: "Data" },
    { id: "connections", label: "Connections" },
    { id: "conversations", label: "Conversations" },
    { id: "settings", label: "Settings" },
  ];
  const active = data.agents.filter(
    (agent) => agent.status === "active",
  ).length;
  return (
    <div
      className="app-shell"
      style={{ "--accent": data.brand.primaryColor } as React.CSSProperties}
    >
      <aside className="sidebar">
        <div className="brand">
          <BrandLogo brand={data.brand} />
          <div>
            <b>{data.brand.name}</b>
            <small>Agent control plane</small>
          </div>
        </div>
        <nav>
          {nav.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "active" : ""}
              onClick={() => {
                setPage(item.id);
                setSelectedAgent(null);
              }}
            >
              <Icon name={item.id} />
              <span>{item.label}</span>
              {item.id === "agents" && data.agents.length > 0 && (
                <em>{data.agents.length}</em>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="runtime-health">
            <span />
            <div>
              <b>Runtime online</b>
              <small>
                {active} active agent{active === 1 ? "" : "s"}
              </small>
            </div>
          </div>
          <button className="logout" onClick={logout}>
            Sign out ↗
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Instance</span>
            <b>/</b>
            <strong>
              {selectedAgent
                ? data.agents.find((agent) => agent.id === selectedAgent)?.name
                : nav.find((item) => item.id === page)?.label}
            </strong>
          </div>
          <div className="top-actions">
            <span className="env-badge">Production</span>
            <div className="admin-avatar">A</div>
          </div>
        </header>
        <div className="content">
          {page === "agents" &&
            (selectedAgent ? (
              <AgentBuilder
                agentId={selectedAgent}
                collections={data.collections}
                onBack={() => setSelectedAgent(null)}
                refresh={reload}
              />
            ) : (
              <AgentList
                agents={data.agents}
                onSelect={(agent) => setSelectedAgent(agent.id)}
                onCreate={() => setCreateAgent(true)}
              />
            ))}
          {page === "data" && (
            <DataPage collections={data.collections} reload={reload} />
          )}{" "}
          {page === "connections" && (
            <ConnectionsPage
              connections={data.connections}
              agents={data.agents}
              reload={reload}
            />
          )}{" "}
          {page === "conversations" && <ConversationsPage />}
          {page === "settings" && (
            <SettingsPage brand={data.brand} reload={reload} />
          )}
        </div>
      </main>
      {createAgent && (
        <CreateAgent
          onClose={() => setCreateAgent(false)}
          onDone={async (agentId) => {
            setCreateAgent(false);
            await reload();
            setSelectedAgent(agentId);
          }}
        />
      )}
    </div>
  );
}

export function App() {
  const [state, setState] = useState<"loading" | "setup" | "login" | "ready">(
    "loading",
  );
  const [brand, setBrand] = useState<Brand>(defaultBrand);
  const [data, setData] = useState<Bootstrap | null>(null);
  async function loadAdmin() {
    try {
      const session = await api<{ csrfToken: string }>("/api/admin/session");
      setCsrf(session.csrfToken);
      const bootstrap = await api<Bootstrap>("/api/admin/bootstrap");
      setBrand({ ...defaultBrand, ...bootstrap.brand });
      setData(bootstrap);
      setState("ready");
    } catch {
      setState("login");
    }
  }
  async function boot() {
    try {
      const status = await api<{ setupComplete: boolean; brand: Brand }>(
        "/api/setup/status",
      );
      setBrand({ ...defaultBrand, ...status.brand });
      if (!status.setupComplete) setState("setup");
      else await loadAdmin();
    } catch {
      setState("setup");
    }
  }
  useEffect(() => {
    void boot();
  }, []);
  const value = useMemo(
    () =>
      data ? { ...data, brand: { ...defaultBrand, ...data.brand } } : null,
    [data],
  );
  if (state === "loading") return <Loader />;
  if (state === "setup") return <Setup onDone={() => void loadAdmin()} />;
  if (state === "login")
    return <Login brand={brand} onDone={() => void loadAdmin()} />;
  return (
    value && (
      <Shell
        data={value}
        reload={async () => {
          const bootstrap = await api<Bootstrap>("/api/admin/bootstrap");
          setData(bootstrap);
        }}
        logout={async () => {
          await post("/api/admin/logout");
          setData(null);
          setState("login");
        }}
      />
    )
  );
}
