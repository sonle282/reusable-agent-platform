import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, patch, post } from "../api";
import { modelSupportsTemperature, type AnthropicModel } from "../../shared/models";
import { RichBubbles } from "../RichMessage";
import type { AgentDetail, AgentDraft, AgentResult, Collection, EvalRun } from "../types";
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  FieldRow,
  Icon,
  PageHeader,
  Row,
  Section,
  Segmented,
  Sheet,
  Spinner,
  StatusBadge,
  TextInput,
  Toggle,
  errorMessage,
  formatDate,
  useToast,
} from "../ui";

export type AssistantTab = "test" | "instructions" | "sources" | "versions";

export const modelOptions: Array<{ value: AnthropicModel; label: string; note: string }> = [
  { value: "claude-haiku-5-5", label: "Claude Haiku 5.5", note: "Nhanh, chi phí thấp" },
  { value: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", note: "Cân bằng" },
  { value: "claude-opus-5-5", label: "Claude Opus 5.5", note: "Mạnh nhất" },
  { value: "claude-sonnet-5", label: "Claude Sonnet 5", note: "Thế hệ trước" },
  { value: "claude-opus-5", label: "Claude Opus 5", note: "Thế hệ trước" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", note: "Thế hệ trước" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", note: "Thế hệ trước" },
];

export const modelLabel = (model?: string) => modelOptions.find((option) => option.value === model)?.label ?? model ?? "—";

export function AssistantPage({
  agentId,
  collections,
  tab,
  onTab,
  refresh,
  openSettings,
}: {
  agentId: string;
  collections: Collection[];
  tab: AssistantTab;
  onTab: (tab: AssistantTab) => void;
  refresh: () => Promise<void>;
  openSettings: () => void;
}) {
  const toast = useToast();
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">("saved");
  const [publishing, setPublishing] = useState<"" | "evaluating" | "publishing">("");
  const [evalRun, setEvalRun] = useState<EvalRun | null>(null);
  const [error, setError] = useState("");
  const latest = useRef<AgentDetail | null>(null);
  latest.current = agent;
  async function load() {
    setAgent(await api<AgentDetail>(`/api/admin/agents/${agentId}`));
  }
  useEffect(() => {
    void load().catch((caught) => setError(errorMessage(caught)));
  }, [agentId]);

  // Drafts never affect production, so they save automatically.
  async function save() {
    const current = latest.current;
    if (!current) return false;
    setSaveState("saving");
    try {
      await patch(`/api/admin/agents/${current.id}`, { name: current.name, description: current.description, draft: current.draft });
      setSaveState(latest.current === current ? "saved" : "dirty");
      return true;
    } catch (caught) {
      setSaveState("dirty");
      setError(errorMessage(caught, "Không thể lưu bản nháp"));
      return false;
    }
  }
  useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = setTimeout(() => void save(), 800);
    return () => clearTimeout(timer);
  }, [agent, saveState]);
  const flush = async () => (saveState === "saved" ? true : save());

  function mutate(fn: (draft: AgentDraft) => AgentDraft) {
    setAgent((current) => (current ? { ...current, draft: fn(structuredClone(current.draft)) } : current));
    setSaveState("dirty");
  }
  function rename(field: "name" | "description", value: string) {
    setAgent((current) => (current ? { ...current, [field]: value } : current));
    setSaveState("dirty");
  }

  // One action: save, run the evaluation gate, then publish when it passes.
  async function publish() {
    if (!agent || !(await flush())) return;
    setError("");
    try {
      if (agent.evalCases.length) {
        setPublishing("evaluating");
        const run = await post<EvalRun>(`/api/admin/agents/${agentId}/evaluate`);
        setEvalRun(run);
        if (!run.passed) {
          onTab("test");
          setError("Chưa xuất bản: có tình huống đánh giá chưa đạt. Xem chi tiết ở mục Đánh giá.");
          return;
        }
      }
      setPublishing("publishing");
      const result = await post<{ version: number }>(`/api/admin/agents/${agentId}/publish`);
      await load();
      await refresh();
      toast(`Đã xuất bản phiên bản ${result.version}`);
    } catch (caught) {
      setError(errorMessage(caught, "Không thể xuất bản"));
    } finally {
      setPublishing("");
    }
  }

  if (!agent) return error ? <Banner>{error}</Banner> : <div className="page-loading"><Spinner /></div>;
  const live = agent.versions.find((version) => version.id === agent.active_version_id);
  const missing = [
    !agent.draft.modelConfig.credentialId && { text: "Chưa có API key Anthropic.", action: "Mở Cài đặt", go: openSettings },
    !agent.draft.instructions.trim() && { text: "Chưa có hướng dẫn cho trợ lý.", action: "Viết hướng dẫn", go: () => onTab("instructions") },
    agent.sources.some((source) => source.status === "failed") && { text: "Có nguồn kiến thức xử lý lỗi.", action: "Xem nguồn", go: () => onTab("sources") },
  ].filter(Boolean) as Array<{ text: string; action: string; go: () => void }>;
  return (
    <div className="page">
      <PageHeader
        title={agent.name}
        subtitle={
          <>
            {live ? <Badge tone="green">Đang chạy · v{live.version}</Badge> : <Badge>Chưa xuất bản</Badge>}
            <span>{modelLabel(agent.draft.modelConfig.model)}</span>
            <span className="save-state" aria-live="polite">
              {saveState === "saving" ? "Đang lưu…" : saveState === "dirty" ? "Chưa lưu" : "Đã lưu nháp"}
            </span>
          </>
        }
        actions={
          <Button onClick={() => void publish()} busy={Boolean(publishing)}>
            {publishing === "evaluating" ? "Đang đánh giá…" : publishing === "publishing" ? "Đang xuất bản…" : "Xuất bản"}
          </Button>
        }
      />
      {missing.length > 0 && (
        <Banner tone="orange">
          {missing.map((item) => (
            <div key={item.text} className="banner-line">
              {item.text}
              <Button variant="plain" size="small" onClick={item.go}>
                {item.action}
              </Button>
            </div>
          ))}
        </Banner>
      )}
      <div className="toolbar">
        <Segmented<AssistantTab>
          label="Phần cấu hình"
          value={tab}
          onChange={onTab}
          options={[
            { value: "test", label: "Thử nghiệm" },
            { value: "instructions", label: "Hướng dẫn" },
            { value: "sources", label: "Nguồn" },
            { value: "versions", label: "Phiên bản" },
          ]}
        />
      </div>
      {error && (
        <Banner onClose={() => setError("")}>
          {error.split("\n").map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </Banner>
      )}
      {tab === "test" && <TestTab agent={agent} flush={flush} reload={load} run={evalRun} setRun={setEvalRun} />}
      {tab === "instructions" && <BehaviorTab agent={agent} mutate={mutate} rename={rename} />}
      {tab === "sources" && (
        <>
          <KnowledgeTab agent={agent} mutate={mutate} reload={load} />
          <ToolsTab agent={agent} collections={collections} mutate={mutate} reload={load} />
        </>
      )}
      {tab === "versions" && <VersionsTab agent={agent} reload={async () => { await load(); await refresh(); }} />}
    </div>
  );
}

function BehaviorTab({
  agent,
  mutate,
  rename,
}: {
  agent: AgentDetail;
  mutate: (fn: (draft: AgentDraft) => AgentDraft) => void;
  rename: (field: "name" | "description", value: string) => void;
}) {
  const { draft } = agent;
  const sampling = modelSupportsTemperature(draft.modelConfig.model);
  const setModel = (value: Partial<AgentDraft["modelConfig"]>) => mutate((current) => ({ ...current, modelConfig: { ...current.modelConfig, ...value } }));
  return (
    <div className="split">
      <div className="split-main">
        <Section
          title="Hướng dẫn"
          action={<span className="caption">{draft.instructions.length.toLocaleString("vi-VN")} ký tự</span>}
          footer="Mô tả vai trò, giọng điệu, giới hạn và khi nào chuyển cho nhân viên. Giá, ưu đãi và dữ liệu thay đổi thường xuyên nên đặt trong Dữ liệu."
        >
          <textarea
            className="editor"
            value={draft.instructions}
            spellCheck={false}
            aria-label="Hướng dẫn cho trợ lý"
            onChange={(event) => mutate((current) => ({ ...current, instructions: event.target.value }))}
          />
        </Section>
      </div>
      <div className="split-side">
        <Section title="Thông tin">
          <FieldRow label="Tên" stacked>
            <TextInput value={agent.name} onChange={(event) => rename("name", event.target.value)} />
          </FieldRow>
          <FieldRow label="Mô tả" stacked>
            <TextInput value={agent.description} onChange={(event) => rename("description", event.target.value)} />
          </FieldRow>
        </Section>
        <Section title="Mô hình" footer={sampling ? undefined : "Model này tự điều chỉnh độ sáng tạo; nhiệt độ không áp dụng."}>
          <FieldRow label="Model">
            <select className="select" value={draft.modelConfig.model} onChange={(event) => setModel({ model: event.target.value as AnthropicModel })}>
              {modelOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label} — {option.note}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Nhiệt độ">
            <TextInput type="number" min={0} max={1} step={0.1} disabled={!sampling} value={draft.modelConfig.temperature} onChange={(event) => setModel({ temperature: Number(event.target.value) })} />
          </FieldRow>
          <FieldRow label="Token tối đa">
            <TextInput type="number" min={128} max={8192} step={128} value={draft.modelConfig.maxTokens} onChange={(event) => setModel({ maxTokens: Number(event.target.value) })} />
          </FieldRow>
        </Section>
        <Section title="Phản hồi" footer="Câu trả lời dự phòng được gửi khi mô hình gặp lỗi hoặc quá thời gian.">
          <FieldRow label="Độ dài tối đa">
            <TextInput
              type="number"
              min={100}
              max={8000}
              value={draft.responsePolicy.maxLength}
              onChange={(event) => mutate((current) => ({ ...current, responsePolicy: { ...current.responsePolicy, maxLength: Number(event.target.value) } }))}
            />
          </FieldRow>
          <FieldRow label="Câu dự phòng" stacked>
            <textarea
              className="text-area"
              rows={3}
              value={draft.responsePolicy.fallbackMessage}
              onChange={(event) => mutate((current) => ({ ...current, responsePolicy: { ...current.responsePolicy, fallbackMessage: event.target.value } }))}
            />
          </FieldRow>
        </Section>
      </div>
    </div>
  );
}

function KnowledgeTab({ agent, mutate, reload }: { agent: AgentDetail; mutate: (fn: (draft: AgentDraft) => AgentDraft) => void; reload: () => Promise<void> }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const pending = agent.sources.some((source) => source.status === "pending" || source.status === "processing");
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => void reload(), 4000);
    return () => clearInterval(timer);
  }, [pending]);
  const toggle = (sourceId: string, on: boolean) =>
    mutate((current) => ({
      ...current,
      knowledgeSourceIds: on ? [...new Set([...current.knowledgeSourceIds, sourceId])] : current.knowledgeSourceIds.filter((item) => item !== sourceId),
    }));
  const used = agent.sources.filter((source) => agent.draft.knowledgeSourceIds.includes(source.id)).length;
  return (
    <>
      <Section
        title={`Nguồn kiến thức · ${used}/${agent.sources.length} đang dùng`}
        action={
          <Button variant="tinted" size="small" icon="plus" onClick={() => setAdding(true)}>
            Thêm nguồn
          </Button>
        }
        footer="Kiến thức dành cho nội dung giải thích ổn định như chính sách, hướng dẫn, câu hỏi thường gặp. Trợ lý trích dẫn nguồn trong phần Thử nghiệm."
      >
        {agent.sources.length === 0 && <EmptyState icon="doc" title="Chưa có nguồn" text="Thêm văn bản, Markdown hoặc một trang web." />}
        {agent.sources.map((source) => (
          <Row
            key={source.id}
            icon={source.type === "url" ? "globe" : "doc"}
            iconTint={source.type === "url" ? "var(--teal)" : "var(--indigo)"}
            title={source.name}
            subtitle={source.error ? <span className="text-red">{source.error}</span> : `Cập nhật ${formatDate(source.updated_at)}`}
            accessory={
              <>
                <StatusBadge value={source.status} />
                {source.status === "failed" && (
                  <Button
                    variant="plain"
                    size="small"
                    icon="refresh"
                    aria-label="Thử lại"
                    onClick={async () => {
                      await post(`/api/admin/knowledge/${source.id}/retry`);
                      toast("Đang xử lý lại nguồn");
                      await reload();
                    }}
                  />
                )}
                <Toggle label={`Dùng ${source.name}`} checked={agent.draft.knowledgeSourceIds.includes(source.id)} onChange={(on) => toggle(source.id, on)} />
              </>
            }
          />
        ))}
      </Section>
      {adding && (
        <AddKnowledgeSheet
          agentId={agent.id}
          onClose={() => setAdding(false)}
          onDone={async (sourceId) => {
            setAdding(false);
            toggle(sourceId, true);
            await reload();
            toast("Đã thêm nguồn");
          }}
        />
      )}
    </>
  );
}

function AddKnowledgeSheet({ agentId, onClose, onDone }: { agentId: string; onClose: () => void; onDone: (sourceId: string) => void }) {
  const [kind, setKind] = useState<"text" | "url">("text");
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await post<{ id?: string; sourceId?: string }>(`/api/admin/agents/${agentId}/knowledge/${kind}`, kind === "text" ? { name, text: content } : { name, url: content });
      onDone(String(result.id ?? result.sourceId ?? ""));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      title="Thêm nguồn kiến thức"
      onClose={onClose}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>Huỷ</Button>
          <Button form="add-knowledge" busy={busy} disabled={!name || !content}>Thêm</Button>
        </>
      }
    >
      <form id="add-knowledge" onSubmit={submit} className="sheet-form">
        <Segmented label="Loại nguồn" value={kind} onChange={setKind} options={[{ value: "text", label: "Văn bản" }, { value: "url", label: "Trang web" }]} />
        <Section footer={kind === "url" ? "Chỉ một URL HTTPS; không tự động đọc các trang liên kết." : "Dán nội dung .md hoặc .txt."}>
          <FieldRow label="Tên">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="Chính sách bảo hành" required />
          </FieldRow>
          {kind === "url" ? (
            <FieldRow label="URL">
              <TextInput type="url" value={content} onChange={(event) => setContent(event.target.value)} placeholder="https://" required />
            </FieldRow>
          ) : (
            <FieldRow label="Nội dung" stacked>
              <textarea className="text-area" rows={10} value={content} onChange={(event) => setContent(event.target.value)} required />
            </FieldRow>
          )}
        </Section>
        {error && <Banner>{error}</Banner>}
      </form>
    </Sheet>
  );
}

function ToolsTab({
  agent,
  collections,
  mutate,
  reload,
}: {
  agent: AgentDetail;
  collections: Collection[];
  mutate: (fn: (draft: AgentDraft) => AgentDraft) => void;
  reload: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const bindCollection = (collection: Collection, on: boolean) =>
    mutate((current) => ({
      ...current,
      collectionBindings: on
        ? [...current.collectionBindings, { collectionId: collection.id, toolName: `search_${collection.slug.replaceAll("-", "_")}`, purpose: `Tìm ${collection.name} phù hợp với câu hỏi của khách` }]
        : current.collectionBindings.filter((item) => item.collectionId !== collection.id),
    }));
  const bindTool = (name: string, on: boolean) =>
    mutate((current) => ({ ...current, toolBindings: on ? [...new Set([...current.toolBindings, name])] : current.toolBindings.filter((item) => item !== name) }));
  return (
    <>
      <Section
        title="Dữ liệu có cấu trúc"
        footer="Mỗi bộ dữ liệu bật lên trở thành một công cụ chỉ đọc. Trợ lý phải tra cứu trước khi nói về giá, ưu đãi hoặc tồn kho; bản ghi hết hạn hoặc lưu trữ luôn bị ẩn."
      >
        {collections.map((collection) => {
          const binding = agent.draft.collectionBindings.find((item) => item.collectionId === collection.id);
          return (
            <Row
              key={collection.id}
              icon="data"
              iconTint="var(--green)"
              title={collection.name}
              subtitle={binding ? <code>{binding.toolName}</code> : collection.description}
              accessory={<Toggle label={`Dùng ${collection.name}`} checked={Boolean(binding)} onChange={(on) => bindCollection(collection, on)} />}
            />
          );
        })}
      </Section>
      <Section
        title="Công cụ chỉ đọc"
        action={
          <Button variant="tinted" size="small" icon="plus" onClick={() => setAdding(true)}>
            Thêm công cụ
          </Button>
        }
        footer="Chỉ hỗ trợ HTTP GET với URL cố định và plugin đọc. Không có thao tác ghi ra hệ thống bên ngoài."
      >
        {agent.tools.length === 0 && <Row title={<span className="text-secondary">Chưa có công cụ</span>} />}
        {agent.tools.map((tool) => (
          <Row
            key={tool.id}
            icon={tool.kind === "http_get" ? "globe" : "wrench"}
            iconTint="var(--orange)"
            title={<code>{tool.name}</code>}
            subtitle={tool.description}
            accessory={<Toggle label={`Dùng ${tool.name}`} checked={agent.draft.toolBindings.includes(tool.name)} onChange={(on) => bindTool(tool.name, on)} />}
          />
        ))}
      </Section>
      {adding && (
        <AddToolSheet
          agentId={agent.id}
          onClose={() => setAdding(false)}
          onDone={async (name) => {
            setAdding(false);
            bindTool(name, true);
            await reload();
          }}
        />
      )}
    </>
  );
}

function AddToolSheet({ agentId, onClose, onDone }: { agentId: string; onClose: () => void; onDone: (name: string) => void }) {
  const [tool, setTool] = useState({ name: "", description: "", kind: "http_get" as "http_get" | "plugin", urlTemplate: "", pluginId: "normalize_contact" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const inputSchema =
      tool.kind === "http_get"
        ? { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
        : { type: "object", properties: { name: { type: "string" }, phone: { type: "string" }, email: { type: "string" } } };
    try {
      await post(`/api/admin/agents/${agentId}/tools`, { ...tool, inputSchema, outputSchema: { type: "object" } });
      onDone(tool.name);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      title="Thêm công cụ chỉ đọc"
      onClose={onClose}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>Huỷ</Button>
          <Button form="add-tool" busy={busy} disabled={!tool.name || !tool.description || (tool.kind === "http_get" && !tool.urlTemplate)}>Thêm</Button>
        </>
      }
    >
      <form id="add-tool" className="sheet-form" onSubmit={submit}>
        <Segmented label="Loại công cụ" value={tool.kind} onChange={(kind) => setTool({ ...tool, kind })} options={[{ value: "http_get", label: "HTTP GET" }, { value: "plugin", label: "Plugin" }]} />
        <Section footer={tool.kind === "http_get" ? "Dùng {query} trong URL để chèn từ khoá. Chỉ HTTPS công khai." : undefined}>
          <FieldRow label="Tên">
            <TextInput value={tool.name} placeholder="check_stock" onChange={(event) => setTool({ ...tool, name: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} required />
          </FieldRow>
          <FieldRow label="Khi nào dùng" stacked>
            <TextInput value={tool.description} onChange={(event) => setTool({ ...tool, description: event.target.value })} required />
          </FieldRow>
          {tool.kind === "http_get" ? (
            <FieldRow label="URL" stacked>
              <TextInput type="url" value={tool.urlTemplate} placeholder="https://api.example.com/search?q={query}" onChange={(event) => setTool({ ...tool, urlTemplate: event.target.value })} required />
            </FieldRow>
          ) : (
            <FieldRow label="Plugin">
              <select className="select" value={tool.pluginId} onChange={(event) => setTool({ ...tool, pluginId: event.target.value })}>
                <option value="normalize_contact">normalize_contact</option>
                <option value="active_at">active_at</option>
              </select>
            </FieldRow>
          )}
        </Section>
        {error && <Banner>{error}</Banner>}
      </form>
    </Sheet>
  );
}

type ChatTurn = { role: "user" | "assistant"; text: string; result?: AgentResult };

function TestTab({
  agent,
  flush,
  reload,
  run,
  setRun,
}: {
  agent: AgentDetail;
  flush: () => Promise<boolean>;
  reload: () => Promise<void>;
  run: EvalRun | null;
  setRun: (run: EvalRun) => void;
}) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [selected, setSelected] = useState<AgentResult | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState(() => crypto.randomUUID());
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);
  async function send(event?: FormEvent) {
    event?.preventDefault();
    const message = text.trim();
    if (!message || busy) return;
    if (!(await flush())) return;
    setText("");
    setError("");
    setTurns((current) => [...current, { role: "user", text: message }]);
    setBusy(true);
    try {
      const result = await post<AgentResult>(`/api/admin/agents/${agent.id}/preview`, { text: message, conversationId });
      setTurns((current) => [...current, ...result.messages.map((item) => ({ role: "assistant" as const, text: item.text, result }))]);
      setSelected(result);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="test-layout">
        <div className="chat-window">
          <div className="chat-header">
            <div>
              <b>Bản nháp</b>
              <span>Cuộc trò chuyện thử, không ảnh hưởng khách thật</span>
            </div>
            <Button
              variant="plain"
              size="small"
              icon="refresh"
              onClick={() => {
                setTurns([]);
                setSelected(null);
                setConversationId(crypto.randomUUID());
              }}
            >
              Cuộc mới
            </Button>
          </div>
          <div className="chat-scroll" ref={scroller}>
            {turns.length === 0 && !busy && (
              <EmptyState icon="conversations" title="Thử như một khách hàng" text="Hỏi về sản phẩm, ưu đãi hoặc chính sách. Chọn một câu trả lời để xem nguồn và công cụ đã dùng." />
            )}
            {turns.map((turn, index) =>
              turn.role === "user" ? (
                <div className="message-row user" key={index}>
                  <RichBubbles role="user" text={turn.text} />
                </div>
              ) : (
                <button className={`message-row assistant ${selected === turn.result ? "selected" : ""}`} key={index} onClick={() => setSelected(turn.result ?? null)}>
                  <RichBubbles role="assistant" text={turn.text} />
                </button>
              ),
            )}
            {busy && (
              <div className="message-row assistant">
                <div className="bubble assistant typing" aria-label="Đang trả lời">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            )}
          </div>
          {error && <Banner onClose={() => setError("")}>{error}</Banner>}
          <form className="composer" onSubmit={send}>
            <textarea
              rows={1}
              value={text}
              placeholder="Tin nhắn"
              aria-label="Tin nhắn thử"
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
            <button className="send-button" disabled={!text.trim() || busy} aria-label="Gửi">
              <Icon name="send" size={18} />
            </button>
          </form>
        </div>
        <TraceInspector result={selected} />
      </div>
      <Evaluations agent={agent} flush={flush} reload={reload} run={run} setRun={setRun} />
    </>
  );
}

function TraceInspector({ result }: { result: AgentResult | null }) {
  if (!result?.trace)
    return (
      <aside className="inspector">
        <h3>Chi tiết</h3>
        <p className="text-secondary">Chọn một câu trả lời để xem mô hình, nguồn kiến thức, công cụ và thời gian xử lý.</p>
      </aside>
    );
  const { trace } = result;
  return (
    <aside className="inspector">
      <h3>Chi tiết</h3>
      <Section>
        <Row title="Trạng thái" accessory={<StatusBadge value={result.status} />} />
        <Row title="Thời gian" detail={`${(trace.latencyMs / 1000).toFixed(1)} giây`} />
        <Row title="Mô hình" detail={modelLabel(trace.model)} />
      </Section>
      <Section title="Kiến thức đã dùng">
        {trace.sources.length ? (
          trace.sources.map((source, index) => <Row key={index} icon="doc" iconTint="var(--indigo)" title={source.name} detail={source.score ? `${Math.round(source.score * 100)}%` : undefined} />)
        ) : (
          <Row title={<span className="text-secondary">Không dùng nguồn nào</span>} />
        )}
      </Section>
      <Section title="Công cụ đã gọi">
        {trace.toolCalls.length ? (
          trace.toolCalls.map((tool, index) => (
            <details className="disclosure" key={index}>
              <summary>
                <code>{tool.name}</code>
                <span className="text-secondary">{Array.isArray(tool.output) ? `${tool.output.length} kết quả` : ""}</span>
              </summary>
              <pre>{JSON.stringify({ input: tool.input, output: tool.output }, null, 2)}</pre>
            </details>
          ))
        ) : (
          <Row title={<span className="text-secondary">Không gọi công cụ</span>} />
        )}
      </Section>
      {trace.error && <Banner>{trace.error}</Banner>}
    </aside>
  );
}

function Evaluations({
  agent,
  flush,
  reload,
  run,
  setRun,
}: {
  agent: AgentDetail;
  flush: () => Promise<boolean>;
  reload: () => Promise<void>;
  run: EvalRun | null;
  setRun: (run: EvalRun) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  async function evaluate() {
    if (!(await flush())) return;
    setBusy(true);
    setError("");
    try {
      const result = await post<EvalRun>(`/api/admin/agents/${agent.id}/evaluate`);
      setRun(result);
      toast(result.passed ? "Tất cả tình huống đều đạt" : "Có tình huống chưa đạt", result.passed ? "default" : "error");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Section
        title="Đánh giá"
        action={
          <div className="inline-actions">
            <Button variant="plain" size="small" icon="plus" onClick={() => setAdding(true)}>
              Thêm tình huống
            </Button>
            <Button variant="tinted" size="small" busy={busy} onClick={() => void evaluate()} disabled={!agent.evalCases.length}>
              Chạy đánh giá
            </Button>
          </div>
        }
        footer="Nút Xuất bản tự chạy đánh giá; tình huống bắt buộc phải đạt thì mới xuất bản."
      >
        {agent.evalCases.length === 0 && <Row title={<span className="text-secondary">Chưa có tình huống đánh giá</span>} />}
        {agent.evalCases.map((testCase) => {
          const result = run?.results.find((item) => item.caseId === testCase.id);
          const assertions = JSON.parse(testCase.assertions_json || "{}") as { expectedTool?: string; mustInclude?: string[]; mustNotInclude?: string[]; maxLength?: number };
          const rules = [
            assertions.expectedTool && `gọi ${assertions.expectedTool}`,
            assertions.mustInclude?.length && `có “${assertions.mustInclude.join("”, “")}”`,
            assertions.mustNotInclude?.length && `không có “${assertions.mustNotInclude.join("”, “")}”`,
            assertions.maxLength && `≤ ${assertions.maxLength} ký tự`,
          ].filter(Boolean);
          return (
            <Row
              key={testCase.id}
              multiline
              title={
                <>
                  {testCase.name} {testCase.critical ? <Badge tone="orange">Bắt buộc</Badge> : null}
                </>
              }
              subtitle={
                <>
                  “{testCase.input}” · {rules.join(" · ")}
                  {result && !result.passed && <span className="text-red"> — {result.failures.join(", ") || `trạng thái ${result.output.status}`}</span>}
                </>
              }
              accessory={result ? <StatusBadge value={result.passed ? "passed" : "failed"} /> : undefined}
            />
          );
        })}
      </Section>
      {error && <Banner onClose={() => setError("")}>{error}</Banner>}
      {adding && (
        <AddEvalSheet
          agentId={agent.id}
          onClose={() => setAdding(false)}
          onDone={async () => {
            setAdding(false);
            await reload();
          }}
        />
      )}
    </>
  );
}

function AddEvalSheet({ agentId, onClose, onDone }: { agentId: string; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ name: "", input: "", expectedTool: "", mustInclude: "", mustNotInclude: "", maxLength: "", critical: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post(`/api/admin/agents/${agentId}/eval-cases`, {
        name: form.name,
        input: form.input,
        critical: form.critical,
        assertions: {
          expectedTool: form.expectedTool || undefined,
          mustInclude: list(form.mustInclude).length ? list(form.mustInclude) : undefined,
          mustNotInclude: list(form.mustNotInclude).length ? list(form.mustNotInclude) : undefined,
          maxLength: form.maxLength ? Number(form.maxLength) : undefined,
        },
      });
      onDone();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      title="Thêm tình huống đánh giá"
      onClose={onClose}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>Huỷ</Button>
          <Button form="add-eval" busy={busy} disabled={!form.name || !form.input}>Thêm</Button>
        </>
      }
    >
      <form id="add-eval" className="sheet-form" onSubmit={submit}>
        <Section>
          <FieldRow label="Tên">
            <TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </FieldRow>
          <FieldRow label="Câu hỏi của khách" stacked>
            <TextInput value={form.input} onChange={(event) => setForm({ ...form, input: event.target.value })} required />
          </FieldRow>
          <FieldRow label="Bắt buộc đạt">
            <Toggle label="Bắt buộc đạt" checked={form.critical} onChange={(critical) => setForm({ ...form, critical })} />
          </FieldRow>
        </Section>
        <Section title="Điều kiện" footer="Phân tách nhiều cụm từ bằng dấu phẩy.">
          <FieldRow label="Công cụ phải gọi">
            <TextInput value={form.expectedTool} placeholder="search_products" onChange={(event) => setForm({ ...form, expectedTool: event.target.value })} />
          </FieldRow>
          <FieldRow label="Phải có">
            <TextInput value={form.mustInclude} onChange={(event) => setForm({ ...form, mustInclude: event.target.value })} />
          </FieldRow>
          <FieldRow label="Không được có">
            <TextInput value={form.mustNotInclude} onChange={(event) => setForm({ ...form, mustNotInclude: event.target.value })} />
          </FieldRow>
          <FieldRow label="Độ dài tối đa">
            <TextInput type="number" min={1} value={form.maxLength} onChange={(event) => setForm({ ...form, maxLength: event.target.value })} />
          </FieldRow>
        </Section>
        {error && <Banner>{error}</Banner>}
      </form>
    </Sheet>
  );
}

function VersionsTab({ agent, reload }: { agent: AgentDetail; reload: () => Promise<void> }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState<AgentDetail["versions"][number] | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Section title="Lịch sử xuất bản" footer="Mỗi phiên bản là bản chụp không đổi. Hội thoại đang diễn ra giữ phiên bản lúc bắt đầu; khôi phục chỉ áp dụng cho hội thoại mới.">
        {agent.versions.length === 0 && <EmptyState icon="clock" title="Chưa có phiên bản" text="Xuất bản bản nháp để tạo phiên bản đầu tiên." />}
        {agent.versions.map((version) => {
          const live = version.id === agent.active_version_id;
          return (
            <Row
              key={version.id}
              icon="clock"
              iconTint={live ? "var(--green)" : "var(--gray)"}
              title={`Phiên bản ${version.version}`}
              subtitle={formatDate(version.published_at)}
              accessory={
                live ? (
                  <Badge tone="green">Đang chạy</Badge>
                ) : (
                  <Button variant="gray" size="small" onClick={() => setConfirm(version)}>
                    Khôi phục
                  </Button>
                )
              }
            />
          );
        })}
      </Section>
      {confirm && (
        <Sheet
          title={`Khôi phục phiên bản ${confirm.version}?`}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <Button variant="gray" onClick={() => setConfirm(null)}>Huỷ</Button>
              <Button
                busy={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await post(`/api/admin/agents/${agent.id}/rollback/${confirm.id}`);
                    toast(`Hội thoại mới sẽ dùng phiên bản ${confirm.version}`);
                    setConfirm(null);
                    await reload();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Khôi phục
              </Button>
            </>
          }
        >
          <p className="sheet-text">Hội thoại mới sẽ dùng phiên bản {confirm.version}. Hội thoại đang diễn ra vẫn giữ phiên bản hiện tại. Bản nháp không thay đổi.</p>
        </Sheet>
      )}
    </>
  );
}
