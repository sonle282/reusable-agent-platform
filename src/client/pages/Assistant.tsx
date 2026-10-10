import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, del, patch, post } from "../api";
import { modelSupportsTemperature, type AnthropicModel } from "../../shared/models";
import { emptyProfile, hasProfile, type AssistantProfile } from "../../shared/prompt";
import { titleField } from "../format";
import { RichBubbles } from "../RichMessage";
import type { AgentDetail, AgentDraft, AgentResult, Collection, EvalCase, EvalRun, KnowledgeSource } from "../types";
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
type Navigate = (page: "data" | "conversations" | "connections" | "settings", ...params: string[]) => void;

export const modelOptions: Array<{ value: AnthropicModel; label: string; note: string }> = [
  { value: "claude-haiku-5-5", label: "Claude Haiku 5.5", note: "Fast, low cost" },
  { value: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", note: "Balanced" },
  { value: "claude-opus-5-5", label: "Claude Opus 5.5", note: "Most capable" },
  { value: "claude-sonnet-5", label: "Claude Sonnet 5", note: "Previous generation" },
  { value: "claude-opus-5", label: "Claude Opus 5", note: "Previous generation" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", note: "Previous generation" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", note: "Previous generation" },
];

export const modelLabel = (model?: string) => modelOptions.find((option) => option.value === model)?.label ?? model ?? "—";

export function AssistantPage({
  agentId,
  collections,
  tab,
  onTab,
  refresh,
  navigate,
}: {
  agentId: string;
  collections: Collection[];
  tab: AssistantTab;
  onTab: (tab: AssistantTab) => void;
  refresh: () => Promise<void>;
  navigate: Navigate;
}) {
  const toast = useToast();
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">("saved");
  const [publishing, setPublishing] = useState<"" | "evaluating" | "publishing">("");
  const [evalRun, setEvalRun] = useState<EvalRun | null>(null);
  const [editedSinceLoad, setEditedSinceLoad] = useState(false);
  const [error, setError] = useState("");
  const latest = useRef<AgentDetail | null>(null);
  latest.current = agent;
  async function load() {
    setAgent(await api<AgentDetail>(`/api/admin/agents/${agentId}`));
    setEditedSinceLoad(false);
  }
  useEffect(() => {
    void load().catch((caught) => setError(errorMessage(caught)));
  }, [agentId]);

  // Drafts never affect customers, so they save automatically.
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
      setError(errorMessage(caught, "Couldn't save the draft"));
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
    setEditedSinceLoad(true);
  }
  function rename(field: "name" | "description", value: string) {
    setAgent((current) => (current ? { ...current, [field]: value } : current));
    setSaveState("dirty");
    setEditedSinceLoad(true);
  }

  // One action: save, run the test gate, then publish when it passes.
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
          setError("Not published: some test scenarios failed. See Test scenarios below.");
          return;
        }
      }
      setPublishing("publishing");
      const result = await post<{ version: number }>(`/api/admin/agents/${agentId}/publish`);
      await load();
      await refresh();
      toast(`Published version ${result.version}`);
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't publish"));
    } finally {
      setPublishing("");
    }
  }

  if (!agent) return error ? <Banner>{error}</Banner> : <div className="page-loading"><Spinner /></div>;
  const live = agent.versions.find((version) => version.id === agent.active_version_id);
  const upToDate = Boolean(live) && agent.draftMatchesLive && !editedSinceLoad && saveState === "saved";
  const missing = [
    !agent.draft.modelConfig.credentialId && { text: "No Anthropic API key yet.", action: "Open Settings", go: () => navigate("settings") },
    !agent.draft.instructions.trim() && !hasProfile(agent.draft) && { text: "Tell the assistant what its job is.", action: "Write instructions", go: () => onTab("instructions") },
    agent.sources.some((source) => source.status === "failed") && { text: "A knowledge source failed to process.", action: "View sources", go: () => onTab("sources") },
  ].filter(Boolean) as Array<{ text: string; action: string; go: () => void }>;
  return (
    <div className="page">
      <PageHeader
        title={agent.name}
        subtitle={
          <>
            {live ? <Badge tone="green">Live · v{live.version}</Badge> : <Badge>Not live yet</Badge>}
            <span className="save-state" aria-live="polite">
              {saveState === "saving" ? "Saving…" : upToDate ? "Customers see this version" : live ? "Changes not live yet" : "Test it, then publish"}
            </span>
          </>
        }
        actions={
          <Button onClick={() => void publish()} busy={Boolean(publishing)} disabled={upToDate}>
            {publishing === "evaluating" ? "Running tests…" : publishing === "publishing" ? "Publishing…" : upToDate ? "Published" : "Publish"}
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
          label="Assistant sections"
          value={tab}
          onChange={onTab}
          options={[
            { value: "test", label: "Test" },
            { value: "instructions", label: "Instructions" },
            { value: "sources", label: "Sources" },
            { value: "versions", label: "Versions" },
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
      {tab === "test" && <TestTab agent={agent} collections={collections} flush={flush} reload={load} run={evalRun} setRun={setEvalRun} navigate={navigate} />}
      {tab === "instructions" && <InstructionsTab agent={agent} mutate={mutate} rename={rename} />}
      {tab === "sources" && (
        <>
          <KnowledgeTab agent={agent} mutate={mutate} reload={load} />
          <ToolsTab agent={agent} collections={collections.filter((collection) => !collection.archived_at || agent.draft.collectionBindings.some((item) => item.collectionId === collection.id))} mutate={mutate} reload={load} />
        </>
      )}
      {tab === "versions" && <VersionsTab agent={agent} reload={async () => { await load(); await refresh(); }} />}
    </div>
  );
}

// One rule per line: the simplest list editor that still reads like a note.
function RuleList({ value, onChange, placeholder, label }: { value: string[]; onChange: (value: string[]) => void; placeholder: string; label: string }) {
  return (
    <textarea
      className="text-area rule-list"
      rows={Math.max(3, value.length + 1)}
      aria-label={label}
      placeholder={placeholder}
      value={value.join("\n")}
      onChange={(event) => onChange(event.target.value.split("\n"))}
    />
  );
}

function InstructionsTab({
  agent,
  mutate,
  rename,
}: {
  agent: AgentDetail;
  mutate: (fn: (draft: AgentDraft) => AgentDraft) => void;
  rename: (field: "name" | "description", value: string) => void;
}) {
  const { draft } = agent;
  const profile: AssistantProfile = { ...emptyProfile, ...draft.profile };
  const sampling = modelSupportsTemperature(draft.modelConfig.model);
  const setProfile = (value: Partial<AssistantProfile>) => mutate((current) => ({ ...current, profile: { ...emptyProfile, ...current.profile, ...value } }));
  const setModel = (value: Partial<AgentDraft["modelConfig"]>) => mutate((current) => ({ ...current, modelConfig: { ...current.modelConfig, ...value } }));
  return (
    <div className="split">
      <div className="split-main">
        <Section title="Your business" footer="Facts that rarely change. Prices, offers and stock belong in Data so they stay current.">
          <FieldRow label="Business name">
            <TextInput value={profile.businessName} onChange={(event) => setProfile({ businessName: event.target.value })} placeholder="Acme Furniture" />
          </FieldRow>
          <FieldRow label="What you offer" stacked>
            <textarea className="text-area" rows={2} value={profile.offering} onChange={(event) => setProfile({ offering: event.target.value })} placeholder="Products or services you sell, and who they are for" />
          </FieldRow>
          <FieldRow label="Contact and hours" stacked>
            <textarea className="text-area" rows={2} value={profile.contactInfo} onChange={(event) => setProfile({ contactInfo: event.target.value })} placeholder="Phone, email, address, opening hours" />
          </FieldRow>
          <FieldRow label="Website">
            <TextInput type="url" value={profile.website} onChange={(event) => setProfile({ website: event.target.value })} placeholder="https://" />
          </FieldRow>
        </Section>
        <Section title="Your assistant's job" footer="What it should do for customers — answer questions, recommend, take requests — and what a good conversation ends with.">
          <textarea className="text-area plain" rows={4} aria-label="Assistant's job" value={profile.job} onChange={(event) => setProfile({ job: event.target.value })} placeholder="Answer questions, recommend the right product and collect contact details when the customer is ready to buy." />
        </Section>
        <Section title="Voice and style" footer="How it should sound. It always replies in the customer's language.">
          <textarea className="text-area plain" rows={3} aria-label="Voice and style" value={profile.voice} onChange={(event) => setProfile({ voice: event.target.value })} placeholder="Warm and polite, short messages, one question at a time." />
        </Section>
        <Section title="Always" footer="One rule per line.">
          <RuleList label="Always" value={profile.alwaysDo} onChange={(alwaysDo) => setProfile({ alwaysDo })} placeholder="Check the data before stating a price or offer" />
        </Section>
        <Section title="Never" footer="One rule per line.">
          <RuleList label="Never" value={profile.neverDo} onChange={(neverDo) => setProfile({ neverDo })} placeholder="Invent prices, discounts or delivery dates" />
        </Section>
        <Section title="Hand off to a person when" footer="The assistant tells the customer someone from the team will follow up.">
          <RuleList label="Hand off to a person when" value={profile.handoffWhen} onChange={(handoffWhen) => setProfile({ handoffWhen })} placeholder="The customer has a complaint or asks for a person" />
        </Section>
        <Section title="Contact details to collect" footer="Asked politely when the customer is ready to buy, wants a quote, or needs a person. One per line.">
          <RuleList label="Contact details to collect" value={profile.collectDetails} onChange={(collectDetails) => setProfile({ collectDetails })} placeholder="Name" />
        </Section>
        <details className="advanced">
          <summary>Detailed playbook (advanced)</summary>
          <Section
            action={<span className="caption">{draft.instructions.length.toLocaleString("en-US")} characters</span>}
            footer="Optional long-form prompt for experts. When it disagrees with the sections above, the sections above win."
          >
            <textarea
              className="editor"
              value={draft.instructions}
              spellCheck={false}
              aria-label="Detailed playbook"
              onChange={(event) => mutate((current) => ({ ...current, instructions: event.target.value }))}
            />
          </Section>
        </details>
      </div>
      <div className="split-side">
        <Section title="Assistant">
          <FieldRow label="Name" stacked>
            <TextInput value={agent.name} onChange={(event) => rename("name", event.target.value)} />
          </FieldRow>
          <FieldRow label="Description" stacked>
            <TextInput value={agent.description} onChange={(event) => rename("description", event.target.value)} />
          </FieldRow>
        </Section>
        <Section title="When something goes wrong" footer="Sent if the AI is unavailable or times out.">
          <FieldRow label="Fallback reply" stacked>
            <textarea
              className="text-area"
              rows={3}
              value={draft.responsePolicy.fallbackMessage}
              onChange={(event) => mutate((current) => ({ ...current, responsePolicy: { ...current.responsePolicy, fallbackMessage: event.target.value } }))}
            />
          </FieldRow>
        </Section>
        <details className="advanced">
          <summary>Advanced</summary>
          <Section title="Model" footer={sampling ? undefined : "This model manages creativity itself; temperature doesn't apply."}>
            <FieldRow label="Model">
              <select className="select" value={draft.modelConfig.model} onChange={(event) => setModel({ model: event.target.value as AnthropicModel })}>
                {modelOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label} — {option.note}
                  </option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Temperature">
              <TextInput type="number" min={0} max={1} step={0.1} disabled={!sampling} value={draft.modelConfig.temperature} onChange={(event) => setModel({ temperature: Number(event.target.value) })} />
            </FieldRow>
            <FieldRow label="Max tokens">
              <TextInput type="number" min={128} max={8192} step={128} value={draft.modelConfig.maxTokens} onChange={(event) => setModel({ maxTokens: Number(event.target.value) })} />
            </FieldRow>
            <FieldRow label="Max reply length">
              <TextInput
                type="number"
                min={100}
                max={8000}
                value={draft.responsePolicy.maxLength}
                onChange={(event) => mutate((current) => ({ ...current, responsePolicy: { ...current.responsePolicy, maxLength: Number(event.target.value) } }))}
              />
            </FieldRow>
          </Section>
        </details>
      </div>
    </div>
  );
}

function KnowledgeTab({ agent, mutate, reload }: { agent: AgentDetail; mutate: (fn: (draft: AgentDraft) => AgentDraft) => void; reload: () => Promise<void> }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<KnowledgeSource | null>(null);
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
        title={`Knowledge · ${used} of ${agent.sources.length} in use`}
        action={
          <Button variant="tinted" size="small" icon="plus" onClick={() => setAdding(true)}>
            Add source
          </Button>
        }
        footer="For explanations that rarely change: policies, guides, FAQs. Test shows which sources each answer used."
      >
        {agent.sources.length === 0 && <EmptyState icon="doc" title="No knowledge yet" text="Add text, Markdown or a web page." />}
        {agent.sources.map((source) => (
          <Row
            key={source.id}
            icon={source.type === "url" ? "globe" : "doc"}
            iconTint={source.type === "url" ? "var(--teal)" : "var(--indigo)"}
            title={source.name}
            subtitle={source.error ? <span className="text-red">{source.error}</span> : `Updated ${formatDate(source.updated_at)}`}
            accessory={
              <>
                <StatusBadge value={source.status} />
                {source.status === "failed" && (
                  <Button
                    variant="plain"
                    size="small"
                    icon="refresh"
                    aria-label="Retry"
                    onClick={async () => {
                      await post(`/api/admin/knowledge/${source.id}/retry`);
                      toast("Processing the source again");
                      await reload();
                    }}
                  />
                )}
                <Button variant="plain" size="small" onClick={() => setEditing(source)}>
                  Edit
                </Button>
                <Toggle label={`Use ${source.name}`} checked={agent.draft.knowledgeSourceIds.includes(source.id)} onChange={(on) => toggle(source.id, on)} />
              </>
            }
          />
        ))}
      </Section>
      {editing && (
        <EditKnowledgeSheet
          source={editing}
          onClose={() => setEditing(null)}
          onDone={async (message) => {
            setEditing(null);
            toast(message);
            await reload();
          }}
        />
      )}
      {adding && (
        <AddKnowledgeSheet
          agentId={agent.id}
          onClose={() => setAdding(false)}
          onDone={async (sourceId) => {
            setAdding(false);
            toggle(sourceId, true);
            await reload();
            toast("Source added");
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
      title="Add knowledge"
      onClose={onClose}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>Cancel</Button>
          <Button form="add-knowledge" busy={busy} disabled={!name || !content}>Add</Button>
        </>
      }
    >
      <form id="add-knowledge" onSubmit={submit} className="sheet-form">
        <Segmented label="Source type" value={kind} onChange={setKind} options={[{ value: "text", label: "Text" }, { value: "url", label: "Web page" }]} />
        <Section footer={kind === "url" ? "One HTTPS page; linked pages are not followed." : "Paste text or Markdown."}>
          <FieldRow label="Title">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="Warranty policy" required />
          </FieldRow>
          {kind === "url" ? (
            <FieldRow label="URL">
              <TextInput type="url" value={content} onChange={(event) => setContent(event.target.value)} placeholder="https://" required />
            </FieldRow>
          ) : (
            <FieldRow label="Content" stacked>
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
        ? [...current.collectionBindings, { collectionId: collection.id, toolName: `search_${collection.slug.replaceAll("-", "_")}`, purpose: `Find ${collection.name} that match the customer's question` }]
        : current.collectionBindings.filter((item) => item.collectionId !== collection.id),
    }));
  const bindTool = (name: string, on: boolean) =>
    mutate((current) => ({ ...current, toolBindings: on ? [...new Set([...current.toolBindings, name])] : current.toolBindings.filter((item) => item !== name) }));
  return (
    <>
      <Section title="Data" footer="Turn on the data the assistant may look up. It must check it before talking about prices, offers or stock; expired or switched-off rows are never shown.">
        {collections.map((collection) => {
          const binding = agent.draft.collectionBindings.find((item) => item.collectionId === collection.id);
          return (
            <Row
              key={collection.id}
              icon="data"
              iconTint="var(--green)"
              title={collection.name}
              subtitle={collection.description || undefined}
              accessory={<Toggle label={`Use ${collection.name}`} checked={Boolean(binding)} onChange={(on) => bindCollection(collection, on)} />}
            />
          );
        })}
      </Section>
      <details className="advanced">
        <summary>Live lookups (advanced)</summary>
        <Section
          action={
            <Button variant="tinted" size="small" icon="plus" onClick={() => setAdding(true)}>
              Add lookup
            </Button>
          }
          footer="Read-only HTTPS GET requests to your own systems, e.g. live stock. The assistant can never change anything outside."
        >
          {agent.tools.length === 0 && <Row title={<span className="text-secondary">No lookups</span>} />}
          {agent.tools.map((tool) => (
            <Row
              key={tool.id}
              icon={tool.kind === "http_get" ? "globe" : "wrench"}
              iconTint="var(--orange)"
              title={tool.name}
              subtitle={tool.description}
              accessory={<Toggle label={`Use ${tool.name}`} checked={agent.draft.toolBindings.includes(tool.name)} onChange={(on) => bindTool(tool.name, on)} />}
            />
          ))}
        </Section>
      </details>
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
      title="Add live lookup"
      onClose={onClose}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>Cancel</Button>
          <Button form="add-tool" busy={busy} disabled={!tool.name || !tool.description || (tool.kind === "http_get" && !tool.urlTemplate)}>Add</Button>
        </>
      }
    >
      <form id="add-tool" className="sheet-form" onSubmit={submit}>
        <Segmented label="Lookup type" value={tool.kind} onChange={(kind) => setTool({ ...tool, kind })} options={[{ value: "http_get", label: "HTTP GET" }, { value: "plugin", label: "Plugin" }]} />
        <Section footer={tool.kind === "http_get" ? "Use {query} in the URL for the search words. Public HTTPS only." : undefined}>
          <FieldRow label="Name">
            <TextInput value={tool.name} placeholder="check_stock" onChange={(event) => setTool({ ...tool, name: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} required />
          </FieldRow>
          <FieldRow label="When to use it" stacked>
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
  collections,
  flush,
  reload,
  run,
  setRun,
  navigate,
}: {
  agent: AgentDetail;
  collections: Collection[];
  flush: () => Promise<boolean>;
  reload: () => Promise<void>;
  run: EvalRun | null;
  setRun: (run: EvalRun) => void;
  navigate: Navigate;
}) {
  const collectionFor = (name: string) => {
    const binding = agent.draft.collectionBindings.find((item) => item.toolName === name);
    return binding && collections.find((item) => item.id === binding.collectionId);
  };
  const toolLabel = (name: string) => {
    const binding = agent.draft.collectionBindings.find((item) => item.toolName === name);
    const collection = binding && collections.find((item) => item.id === binding.collectionId);
    return collection ? `Looked up ${collection.name}` : name;
  };
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [selected, setSelected] = useState<AgentResult | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState(() => crypto.randomUUID());
  const [editingSource, setEditingSource] = useState<KnowledgeSource | null>(null);
  const toast = useToast();
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
              <b>Draft</b>
              <span>A private test chat — customers never see it</span>
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
              New chat
            </Button>
          </div>
          <div className="chat-scroll" ref={scroller}>
            {turns.length === 0 && !busy && (
              <EmptyState icon="conversations" title="Chat like a customer" text="Ask about products, offers or policies. Tap a reply to see what it was based on." />
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
                <div className="bubble assistant typing" aria-label="Typing">
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
              placeholder="Message"
              aria-label="Test message"
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
            <button className="send-button" disabled={!text.trim() || busy} aria-label="Send">
              <Icon name="send" size={18} />
            </button>
          </form>
        </div>
        <TraceInspector
          result={selected}
          toolLabel={toolLabel}
          titleKeyFor={(toolName) => {
            const collection = collectionFor(toolName);
            if (!collection) return undefined;
            return titleField(JSON.parse(collection.schema_json).fields as Array<{ key: string; type: string; required?: boolean }>)?.key;
          }}
          openRecord={(toolName, recordId) => {
            const collection = collectionFor(toolName);
            if (collection) navigate("data", collection.id, recordId);
          }}
          openSource={(sourceId) => setEditingSource(agent.sources.find((source) => source.id === sourceId) ?? null)}
        />
      </div>
      <Evaluations agent={agent} flush={flush} reload={reload} run={run} setRun={setRun} />
      {editingSource && (
        <EditKnowledgeSheet
          source={editingSource}
          onClose={() => setEditingSource(null)}
          onDone={async (message) => {
            setEditingSource(null);
            toast(message);
            await reload();
          }}
        />
      )}
    </>
  );
}

type TracedRecord = { record_id?: string; id?: string } & Record<string, unknown>;

// A readable label for a looked-up row: the table's title column, else its first short text value.
const recordTitle = (record: TracedRecord, titleKey?: string) =>
  String(
    (titleKey && record[titleKey]) ??
      Object.entries(record).find(([key, value]) => !["id", "record_id", "valid_from", "valid_until"].includes(key) && typeof value === "string" && value.length > 0 && value.length < 90 && !/^https?:/.test(value))?.[1] ??
      record.id ??
      "Row",
  );

function TraceInspector({
  result,
  toolLabel,
  titleKeyFor,
  openRecord,
  openSource,
}: {
  result: AgentResult | null;
  toolLabel: (name: string) => string;
  titleKeyFor: (toolName: string) => string | undefined;
  openRecord: (toolName: string, recordId: string) => void;
  openSource: (sourceId: string) => void;
}) {
  if (!result?.trace)
    return (
      <aside className="inspector">
        <h3>Details</h3>
        <p className="text-secondary">Tap a reply to see what the assistant based it on, then tap a row or source to fix it.</p>
      </aside>
    );
  const { trace } = result;
  return (
    <aside className="inspector">
      <h3>Details</h3>
      <Section>
        <Row title="Status" accessory={<StatusBadge value={result.status} />} />
        <Row title="Time" detail={`${(trace.latencyMs / 1000).toFixed(1)} s`} />
        <Row title="Model" detail={modelLabel(trace.model)} />
      </Section>
      <Section title="Knowledge read">
        {trace.sources.length ? (
          trace.sources.map((source, index) => (
            <Row
              key={index}
              icon="doc"
              iconTint="var(--indigo)"
              title={source.name}
              detail={source.score ? `${Math.round(source.score * 100)}%` : undefined}
              chevron
              onClick={() => (source as { id?: string }).id && openSource(String((source as { id?: string }).id))}
            />
          ))
        ) : (
          <Row title={<span className="text-secondary">No knowledge read</span>} />
        )}
      </Section>
      <Section title="Data looked up">
        {trace.toolCalls.length ? (
          trace.toolCalls.map((tool, index) => {
            const rows = Array.isArray(tool.output) ? (tool.output as TracedRecord[]) : [];
            return (
              <div key={index} className="trace-group">
                <Row title={toolLabel(tool.name)} detail={rows.length ? `${rows.length} found` : "Nothing found"} />
                {rows.slice(0, 8).map((record, rowIndex) => (
                  <Row key={rowIndex} title={recordTitle(record, titleKeyFor(tool.name))} subtitle={record.id && record.id !== record.record_id ? String(record.id) : undefined} chevron onClick={() => record.record_id && openRecord(tool.name, String(record.record_id))} />
                ))}
              </div>
            );
          })
        ) : (
          <Row title={<span className="text-secondary">No data looked up</span>} />
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
  const [editing, setEditing] = useState<EvalCase | null>(null);
  async function evaluate() {
    if (!(await flush())) return;
    setBusy(true);
    setError("");
    try {
      const result = await post<EvalRun>(`/api/admin/agents/${agent.id}/evaluate`);
      setRun(result);
      toast(result.passed ? "All scenarios passed" : "Some scenarios failed", result.passed ? "default" : "error");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Section
        title="Test scenarios"
        action={
          <div className="inline-actions">
            <Button variant="plain" size="small" icon="plus" onClick={() => setAdding(true)}>
              Add scenario
            </Button>
            <Button variant="tinted" size="small" busy={busy} onClick={() => void evaluate()} disabled={!agent.evalCases.length}>
              Run all
            </Button>
          </div>
        }
        footer="Publish runs these automatically; required scenarios must pass before customers get a new version."
      >
        {agent.evalCases.length === 0 && <Row title={<span className="text-secondary">No scenarios yet</span>} />}
        {agent.evalCases.map((testCase) => {
          const result = run?.results.find((item) => item.caseId === testCase.id);
          const assertions = JSON.parse(testCase.assertions_json || "{}") as { expectedTool?: string; mustInclude?: string[]; mustNotInclude?: string[]; maxLength?: number };
          const rules = [
            assertions.expectedTool && `looks up ${assertions.expectedTool}`,
            assertions.mustInclude?.length && `says “${assertions.mustInclude.join("”, “")}”`,
            assertions.mustNotInclude?.length && `never says “${assertions.mustNotInclude.join("”, “")}”`,
            assertions.maxLength && `≤ ${assertions.maxLength} characters`,
          ].filter(Boolean);
          return (
            <Row
              key={testCase.id}
              multiline
              title={
                <>
                  {testCase.name} {testCase.critical ? <Badge tone="orange">Required</Badge> : null}
                </>
              }
              subtitle={
                <>
                  “{testCase.input}” · {rules.join(" · ")}
                  {result && !result.passed && <span className="text-red"> — {result.failures.join(", ") || `status ${result.output.status}`}</span>}
                </>
              }
              accessory={result ? <StatusBadge value={result.passed ? "passed" : "failed"} /> : undefined}
              chevron
              onClick={() => setEditing(testCase)}
            />
          );
        })}
      </Section>
      {error && <Banner onClose={() => setError("")}>{error}</Banner>}
      {(adding || editing) && (
        <AddEvalSheet
          agentId={agent.id}
          existing={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onDone={async () => {
            setAdding(false);
            setEditing(null);
            await reload();
          }}
        />
      )}
    </>
  );
}

function AddEvalSheet({ agentId, existing, onClose, onDone }: { agentId: string; existing: EvalCase | null; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState(() => {
    const assertions = JSON.parse(existing?.assertions_json || "{}") as { expectedTool?: string; mustInclude?: string[]; mustNotInclude?: string[]; maxLength?: number };
    return {
      name: existing?.name ?? "",
      input: existing?.input ?? "",
      expectedTool: assertions.expectedTool ?? "",
      mustInclude: (assertions.mustInclude ?? []).join(", "),
      mustNotInclude: (assertions.mustNotInclude ?? []).join(", "),
      maxLength: assertions.maxLength ? String(assertions.maxLength) : "",
      critical: existing ? Boolean(existing.critical) : true,
    };
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await (existing ? (body: unknown) => patch(`/api/admin/eval-cases/${existing.id}`, body) : (body: unknown) => post(`/api/admin/agents/${agentId}/eval-cases`, body))({
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
      title={existing ? "Edit test scenario" : "Add test scenario"}
      onClose={onClose}
      footer={
        <>
          {existing && (
            <Button
              variant={confirmDelete ? "destructive" : "plain"}
              className="footer-leading"
              onClick={async () => {
                if (!confirmDelete) return setConfirmDelete(true);
                await del(`/api/admin/eval-cases/${existing.id}`);
                onDone();
              }}
            >
              {confirmDelete ? "Delete scenario" : "Delete"}
            </Button>
          )}
          <Button variant="gray" onClick={onClose}>Cancel</Button>
          <Button form="add-eval" busy={busy} disabled={!form.name || !form.input}>{existing ? "Save" : "Add"}</Button>
        </>
      }
    >
      <form id="add-eval" className="sheet-form" onSubmit={submit}>
        <Section>
          <FieldRow label="Name">
            <TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </FieldRow>
          <FieldRow label="Customer message" stacked>
            <TextInput value={form.input} onChange={(event) => setForm({ ...form, input: event.target.value })} required />
          </FieldRow>
          <FieldRow label="Required to publish">
            <Toggle label="Required to publish" checked={form.critical} onChange={(critical) => setForm({ ...form, critical })} />
          </FieldRow>
        </Section>
        <Section title="Pass when" footer="Separate several phrases with commas.">
          <FieldRow label="Looks up">
            <TextInput value={form.expectedTool} placeholder="search_products" onChange={(event) => setForm({ ...form, expectedTool: event.target.value })} />
          </FieldRow>
          <FieldRow label="Says">
            <TextInput value={form.mustInclude} onChange={(event) => setForm({ ...form, mustInclude: event.target.value })} />
          </FieldRow>
          <FieldRow label="Never says">
            <TextInput value={form.mustNotInclude} onChange={(event) => setForm({ ...form, mustNotInclude: event.target.value })} />
          </FieldRow>
          <FieldRow label="Max length">
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
      <Section title="Published versions" footer="Each version is a frozen snapshot. Ongoing chats keep the version they started with; restoring affects new chats only.">
        {agent.versions.length === 0 && <EmptyState icon="clock" title="No versions yet" text="Publish the draft to create the first version." />}
        {agent.versions.map((version) => {
          const live = version.id === agent.active_version_id;
          return (
            <Row
              key={version.id}
              icon="clock"
              iconTint={live ? "var(--green)" : "var(--gray)"}
              title={`Version ${version.version}`}
              subtitle={formatDate(version.published_at)}
              accessory={
                live ? (
                  <Badge tone="green">Live</Badge>
                ) : (
                  <Button variant="gray" size="small" onClick={() => setConfirm(version)}>
                    Restore
                  </Button>
                )
              }
            />
          );
        })}
      </Section>
      {confirm && (
        <Sheet
          title={`Restore version ${confirm.version}?`}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <Button variant="gray" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button
                busy={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await post(`/api/admin/agents/${agent.id}/rollback/${confirm.id}`);
                    toast(`New chats will use version ${confirm.version}`);
                    setConfirm(null);
                    await reload();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Restore
              </Button>
            </>
          }
        >
          <p className="sheet-text">New chats will use version {confirm.version}. Ongoing chats keep their current version, and your draft is not changed.</p>
        </Sheet>
      )}
    </>
  );
}

function EditKnowledgeSheet({ source, onClose, onDone }: { source: KnowledgeSource; onClose: () => void; onDone: (message: string) => void }) {
  const isUrl = source.type === "url";
  const [name, setName] = useState(source.name);
  const [text, setText] = useState<string | null>(isUrl ? "" : null);
  const [original, setOriginal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (isUrl) return;
    void api<{ text: string }>(`/api/admin/knowledge/${source.id}/content`)
      .then((result) => {
        setText(result.text);
        setOriginal(result.text);
      })
      .catch((caught) => setError(errorMessage(caught)));
  }, [source.id]);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const contentChanged = !isUrl && text !== null && text !== original;
      await patch(`/api/admin/knowledge/${source.id}`, { name, text: contentChanged ? text : undefined });
      onDone(contentChanged ? "Saved — the assistant will use it in a minute" : "Saved");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      title="Edit knowledge"
      onClose={onClose}
      footer={
        <>
          {isUrl && (
            <Button
              variant="plain"
              className="footer-leading"
              onClick={async () => {
                await post(`/api/admin/knowledge/${source.id}/retry`);
                onDone("Fetching the page again");
              }}
            >
              Fetch page again
            </Button>
          )}
          <Button variant="gray" onClick={onClose}>Cancel</Button>
          <Button form="edit-knowledge" busy={busy} disabled={!name.trim() || text === null}>Save</Button>
        </>
      }
    >
      <form id="edit-knowledge" className="sheet-form" onSubmit={save}>
        <Section footer={isUrl ? "Web page sources update when you fetch the page again." : "Saving new text re-indexes this source; customers see the change after it is ready."}>
          <FieldRow label="Title">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} required />
          </FieldRow>
          {!isUrl && (
            <FieldRow label="Content" stacked>
              {text === null ? <Spinner small /> : <textarea className="text-area" rows={14} value={text} onChange={(event) => setText(event.target.value)} />}
            </FieldRow>
          )}
        </Section>
        {error && <Banner>{error}</Banner>}
      </form>
    </Sheet>
  );
}
