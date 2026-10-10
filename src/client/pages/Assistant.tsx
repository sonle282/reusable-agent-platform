import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api, del, patch, post } from "../api";
import { modelSupportsTemperature, type AnthropicModel } from "../../shared/models";
import { emptyProfile, hasProfile, type AssistantProfile } from "../../shared/prompt";
import { formatDate, timeSeparator, titleField } from "../format";
import { useFixAnswer } from "../FixSheet";
import { RichBubbles, parseRichMessage } from "../RichMessage";
import type { AgentDetail, AgentDraft, AgentResult, Collection, EvalCase, EvalRun, KnowledgeSource } from "../types";
import {
  Alert,
  Badge,
  Banner,
  Button,
  DetailsCard,
  Disclosure,
  EmptyState,
  FieldRow,
  Icon,
  MetaChip,
  MiniList,
  PageHeader,
  Section,
  Segmented,
  Sheet,
  Skeleton,
  SkeletonLine,
  Spinner,
  StatusLine,
  TextArea,
  TextInput,
  Toggle,
  errorMessage,
  useToast,
} from "../ui";

export type AssistantTab = "test" | "instructions" | "sources" | "versions";
type EditorTab = Exclude<AssistantTab, "test">;
type Navigate = (page: "data" | "conversations" | "connections" | "settings", ...params: string[]) => void;
type Mutate = (fn: (draft: AgentDraft) => AgentDraft) => void;

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

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

// "Updated today" reads better than a bare time in a list of sources.
function updatedLabel(value?: string | null) {
  const label = formatDate(value);
  if (/\d:\d\d [AP]M$/.test(label)) return "Updated today";
  if (label === "Yesterday") return "Updated yesterday";
  return `Updated ${label}`;
}

// GPT-builder layout: the editor on the left, a live Preview of the draft on the right.
export function AssistantPage({
  agentId,
  collections,
  tab,
  onTab,
  refresh,
  navigate,
  onUnpublished,
}: {
  agentId: string;
  collections: Collection[];
  tab: AssistantTab;
  onTab: (tab: AssistantTab) => void;
  refresh: () => Promise<void>;
  navigate: Navigate;
  onUnpublished?: (value: boolean) => void;
}) {
  const toast = useToast();
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">("saved");
  const [saveFailed, setSaveFailed] = useState(false);
  const [publishing, setPublishing] = useState<"" | "evaluating" | "publishing">("");
  const [publishFailure, setPublishFailure] = useState<string | null>(null);
  const [evalRun, setEvalRun] = useState<EvalRun | null>(null);
  const [scenOpen, setScenOpen] = useState(false);
  const [editedSinceLoad, setEditedSinceLoad] = useState(false);
  const [error, setError] = useState("");
  const latest = useRef<AgentDetail | null>(null);
  latest.current = agent;
  async function load() {
    setAgent(await api<AgentDetail>(`/api/admin/agents/${agentId}`));
    setEditedSinceLoad(false);
    setError("");
  }
  useEffect(() => {
    void load().catch((caught) => setError(errorMessage(caught)));
  }, [agentId]);

  // Drafts never affect customers, so they save automatically; a failed save retries on its own.
  async function save() {
    const current = latest.current;
    if (!current) return false;
    setSaveState("saving");
    try {
      await patch(`/api/admin/agents/${current.id}`, { name: current.name, description: current.description, draft: current.draft });
      setSaveState(latest.current === current ? "saved" : "dirty");
      setSaveFailed(false);
      return true;
    } catch {
      setSaveState("dirty");
      setSaveFailed(true);
      return false;
    }
  }
  useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = setTimeout(() => void save(), saveFailed ? 5000 : 800);
    return () => clearTimeout(timer);
  }, [agent, saveState, saveFailed]);
  const flush = async () => (saveState === "saved" ? true : save());

  const mutate: Mutate = (fn) => {
    setAgent((current) => (current ? { ...current, draft: fn(structuredClone(current.draft)) } : current));
    setSaveState("dirty");
    setEditedSinceLoad(true);
  };
  function rename(field: "name" | "description", value: string) {
    setAgent((current) => (current ? { ...current, [field]: value } : current));
    setSaveState("dirty");
    setEditedSinceLoad(true);
  }

  // One action: save, run the test scenarios, then publish when the required ones pass.
  async function publish() {
    if (!agent || !(await flush())) return;
    setError("");
    setPublishFailure(null);
    try {
      if (agent.evalCases.length) {
        setPublishing("evaluating");
        const run = await post<EvalRun>(`/api/admin/agents/${agentId}/evaluate`);
        setEvalRun(run);
        if (!run.passed) {
          const failed = agent.evalCases.find((item) => run.results.some((result) => result.caseId === item.id && !result.passed));
          setPublishFailure(failed?.name ?? "A scenario");
          setScenOpen(true);
          return;
        }
      }
      setPublishing("publishing");
      const result = await post<{ version: number }>(`/api/admin/agents/${agentId}/publish`);
      await load();
      await refresh();
      toast(`Version ${result.version} is live`);
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't publish"));
    } finally {
      setPublishing("");
    }
  }

  const live = agent?.versions.find((version) => version.id === agent.active_version_id);
  const upToDate = Boolean(live) && Boolean(agent?.draftMatchesLive) && !editedSinceLoad && saveState === "saved";
  useEffect(() => {
    if (agent) onUnpublished?.(!upToDate);
  }, [agent, upToDate, onUnpublished]);

  if (!agent)
    return error ? (
      <div className="page">
        <PageHeader title="Assistant" />
        <Banner
          tone="error"
          title="Couldn't open the assistant"
          text={`${error}. Customers are not affected.`}
          actions={
            <Button variant="gray" size="small" onClick={() => void load().catch((caught) => setError(errorMessage(caught)))}>
              Try again
            </Button>
          }
        />
      </div>
    ) : (
      <AssistantSkeleton />
    );

  const editorTab: EditorTab = tab === "test" ? "instructions" : tab;
  const saving = saveState === "saving" ? " · saving…" : "";
  const status = !live ? (
    <StatusLine tone="gray">Not live yet · test it, then publish{saving}</StatusLine>
  ) : upToDate ? (
    <StatusLine tone="green">Live · version {live.version} · draft saved</StatusLine>
  ) : (
    <StatusLine tone="orange">
      Unpublished changes · customers see version {live.version}
      {saving}
    </StatusLine>
  );
  const missing = [
    !agent.draft.modelConfig.credentialId && { text: "Add your Anthropic API key so the assistant can answer.", action: "Open Settings", go: () => navigate("settings") },
    !agent.draft.instructions.trim() && !hasProfile(agent.draft) && { text: "Tell the assistant what its job is.", action: "Write instructions", go: () => onTab("instructions") },
    agent.sources.some((source) => source.status === "failed") && { text: "A knowledge source couldn't be read.", action: "View sources", go: () => onTab("sources") },
  ].filter(Boolean) as Array<{ text: string; action: string; go: () => void }>;
  const requiredCount = agent.evalCases.length;

  return (
    <div className="page assistant-page">
      <PageHeader
        title={agent.name}
        status={status}
        actions={
          publishing ? (
            <Button busy>{publishing === "evaluating" ? `Checking ${plural(requiredCount, "scenario")}…` : "Publishing…"}</Button>
          ) : upToDate ? (
            <span className="status-line published-line">
              <Icon name="check-circle" size={18} />
              Published
            </span>
          ) : (
            <Button onClick={() => void publish()}>Publish</Button>
          )
        }
      />

      {publishFailure && (
        <Banner
          tone="error"
          title="Not published — a required scenario failed"
          text={`“${publishFailure}” failed on the draft. ${live ? `Customers still see version ${live.version}.` : "Nothing is live yet."}`}
          actions={
            <>
              <Button variant="gray" size="small" onClick={() => setScenOpen(true)}>
                Show scenario
              </Button>
              <Button variant="plain" size="small" onClick={() => setPublishFailure(null)}>
                Dismiss
              </Button>
            </>
          }
        />
      )}
      {saveFailed && (
        <Banner
          tone="warning"
          title="Your last change isn't saved yet"
          text="We'll keep trying. Your edits stay on this page until the connection is back."
          actions={
            <Button variant="gray" size="small" onClick={() => void save()}>
              Try again
            </Button>
          }
        />
      )}
      {error && <Banner tone="error" title="Couldn't publish" text={`${error}. Customers still see the current version.`} onClose={() => setError("")} />}
      {missing.length > 0 && (
        <Banner
          tone="warning"
          title={missing.length === 1 ? missing[0].text : "A few things before customers can use it"}
          text={missing.length > 1 ? missing.map((item) => item.text).join(" ") : undefined}
          actions={missing.map((item) => (
            <Button key={item.action} variant="gray" size="small" onClick={item.go}>
              {item.action}
            </Button>
          ))}
        />
      )}

      <Segmented<EditorTab>
        label="Assistant sections"
        value={editorTab}
        onChange={onTab}
        options={[
          { value: "instructions", label: "Instructions" },
          { value: "sources", label: "Sources" },
          { value: "versions", label: "Versions" },
        ]}
      />

      <div className="assistant-grid">
        <div className="editor-pane">
          {editorTab === "instructions" && <InstructionsTab agent={agent} mutate={mutate} rename={rename} />}
          {editorTab === "sources" && (
            <SourcesTab
              agent={agent}
              collections={collections.filter((collection) => !collection.archived_at || agent.draft.collectionBindings.some((item) => item.collectionId === collection.id))}
              mutate={mutate}
              reload={load}
            />
          )}
          {editorTab === "versions" && (
            <VersionsTab
              agent={agent}
              unpublished={!upToDate}
              saving={saveState === "saving"}
              reload={async () => {
                await load();
                await refresh();
              }}
            />
          )}
        </div>
        <PreviewPane
          agent={agent}
          collections={collections}
          flush={flush}
          reload={load}
          run={evalRun}
          setRun={setEvalRun}
          scenOpen={scenOpen}
          setScenOpen={setScenOpen}
          navigate={navigate}
        />
      </div>
    </div>
  );
}

function AssistantSkeleton() {
  return (
    <div className="page assistant-page" aria-busy="true">
      <header className="page-header">
        <div className="page-heading">
          <SkeletonLine width={280} height={34} />
          <SkeletonLine width={220} />
        </div>
      </header>
      <div className="assistant-grid">
        <div className="editor-pane">
          <Skeleton rows={4} />
        </div>
        <section className="preview-pane">
          <div className="chat">
            <span className="skel" style={{ alignSelf: "flex-end", width: "55%", height: 36, borderRadius: 18 }} />
            <span className="skel" style={{ width: "75%", height: 96, borderRadius: 18 }} />
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------- Instructions (single column, GPT style) ----------

function InstructionsTab({ agent, mutate, rename }: { agent: AgentDetail; mutate: Mutate; rename: (field: "name" | "description", value: string) => void }) {
  const { draft } = agent;
  const profile: AssistantProfile = { ...emptyProfile, ...draft.profile };
  const sampling = modelSupportsTemperature(draft.modelConfig.model);
  const setProfile = (value: Partial<AssistantProfile>) => mutate((current) => ({ ...current, profile: { ...emptyProfile, ...current.profile, ...value } }));
  const setModel = (value: Partial<AgentDraft["modelConfig"]>) => mutate((current) => ({ ...current, modelConfig: { ...current.modelConfig, ...value } }));
  const setPolicy = (value: Partial<AgentDraft["responsePolicy"]>) => mutate((current) => ({ ...current, responsePolicy: { ...current.responsePolicy, ...value } }));
  return (
    <>
      <Section title="Assistant" footer="Only you see this. Customers see the business name.">
        <FieldRow label="Name">
          <TextInput value={agent.name} onChange={(event) => rename("name", event.target.value)} />
        </FieldRow>
        <FieldRow label="Description" stacked>
          <TextArea rows={1} value={agent.description} onChange={(event) => rename("description", event.target.value)} placeholder="What this assistant is for" />
        </FieldRow>
      </Section>

      <Section title="Your business" footer="Facts that rarely change. Prices, offers and stock belong in Data so they stay current.">
        <FieldRow label="Business name">
          <TextInput value={profile.businessName} onChange={(event) => setProfile({ businessName: event.target.value })} placeholder="Acme Furniture" />
        </FieldRow>
        <FieldRow label="What you offer" stacked>
          <TextArea rows={2} value={profile.offering} onChange={(event) => setProfile({ offering: event.target.value })} placeholder="Products or services you sell, and who they are for" />
        </FieldRow>
        <FieldRow label="Contact and hours" stacked>
          <TextArea rows={2} value={profile.contactInfo} onChange={(event) => setProfile({ contactInfo: event.target.value })} placeholder="Phone, email, address, opening hours" />
        </FieldRow>
        <FieldRow label="Website">
          <TextInput type="url" value={profile.website} onChange={(event) => setProfile({ website: event.target.value })} placeholder="https://" />
        </FieldRow>
      </Section>

      <Section title="Your assistant's job" footer="What it should do for customers, and what a good conversation ends with.">
        <label className="field stacked">
          <span className="sr-only">Your assistant's job</span>
          <TextArea rows={2} value={profile.job} onChange={(event) => setProfile({ job: event.target.value })} placeholder="Answer questions, recommend the right product and collect contact details when the customer is ready to buy." />
        </label>
      </Section>

      <Section title="Voice and style" footer="It always replies in the customer's language.">
        <label className="field stacked">
          <span className="sr-only">Voice and style</span>
          <TextArea rows={2} value={profile.voice} onChange={(event) => setProfile({ voice: event.target.value })} placeholder="Warm and polite, short messages, one question at a time." />
        </label>
      </Section>

      <RuleSection title="Always" footer="One rule per line." addLabel="Add a rule" placeholder="Check Data before stating a price or offer" value={profile.alwaysDo} onChange={(alwaysDo) => setProfile({ alwaysDo })} />
      <RuleSection title="Never" footer="One rule per line." addLabel="Add a rule" placeholder="Invent prices, discounts or delivery dates" value={profile.neverDo} onChange={(neverDo) => setProfile({ neverDo })} />
      <RuleSection
        title="Hand off to a person when"
        footer="The assistant tells the customer someone from the team will follow up."
        addLabel="Add a reason"
        placeholder="The customer has a complaint or asks for a person"
        value={profile.handoffWhen}
        onChange={(handoffWhen) => setProfile({ handoffWhen })}
      />
      <RuleSection
        title="Contact details to collect"
        footer="Asked politely when the customer wants a quote or a person."
        addLabel="Add a detail"
        placeholder="Phone number"
        value={profile.collectDetails}
        onChange={(collectDetails) => setProfile({ collectDetails })}
      />
      <Section footer="Said once, before the first time the assistant asks for contact details. Saved with each contact as proof of what they were told.">
        <FieldRow label="Privacy notice" stacked>
          <TextArea rows={2} value={profile.consentNotice} onChange={(event) => setProfile({ consentNotice: event.target.value })} placeholder="We only use your phone number to send your quote and follow up on this request." />
        </FieldRow>
      </Section>

      <Section title="When something goes wrong" footer="Sent only if the AI is unavailable or takes too long.">
        <FieldRow label="Fallback reply" stacked>
          <TextArea rows={1} value={draft.responsePolicy.fallbackMessage} onChange={(event) => setPolicy({ fallbackMessage: event.target.value })} />
        </FieldRow>
      </Section>

      <Section footer="The playbook is for long, detailed guidance. When it disagrees with the sections above, the sections above win.">
        <Disclosure
          title={
            <>
              Detailed playbook <span className="muted">(advanced)</span>
            </>
          }
          detail={plural(draft.instructions.length, "character").replace(/^\d+/, (n) => Number(n).toLocaleString("en-US"))}
        >
          <label className="playbook">
            <span className="sr-only">Detailed playbook</span>
            <TextArea mono spellCheck={false} value={draft.instructions} onChange={(event) => mutate((current) => ({ ...current, instructions: event.target.value }))} placeholder="Optional. Long-form guidance, written in Markdown." />
          </label>
        </Disclosure>
        <Disclosure
          title={
            <>
              Model and reply length <span className="muted">(advanced)</span>
            </>
          }
        >
          <FieldRow label="Model">
            <select className="select" value={draft.modelConfig.model} onChange={(event) => setModel({ model: event.target.value as AnthropicModel })}>
              {modelOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label} — {option.note}
                </option>
              ))}
            </select>
          </FieldRow>
          {sampling && (
            <FieldRow label="Temperature">
              <TextInput className="tabular" type="number" min={0} max={1} step={0.1} value={draft.modelConfig.temperature} onChange={(event) => setModel({ temperature: Number(event.target.value) })} />
            </FieldRow>
          )}
          <FieldRow label="Max tokens">
            <TextInput className="tabular" type="number" min={128} max={8192} step={128} value={draft.modelConfig.maxTokens} onChange={(event) => setModel({ maxTokens: Number(event.target.value) })} />
          </FieldRow>
          <FieldRow label="Max reply length" hint="Characters">
            <TextInput className="tabular" type="number" min={100} max={8000} value={draft.responsePolicy.maxLength} onChange={(event) => setPolicy({ maxLength: Number(event.target.value) })} />
          </FieldRow>
        </Disclosure>
      </Section>
    </>
  );
}

// One field per rule; Enter adds the next one, Backspace on an empty rule removes it.
function RuleSection({
  title,
  footer,
  addLabel,
  placeholder,
  value,
  onChange,
}: {
  title: string;
  footer: string;
  addLabel: string;
  placeholder: string;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const [focus, setFocus] = useState<number | null>(null);
  useEffect(() => {
    if (focus === null) return;
    inputs.current[focus]?.focus();
    setFocus(null);
  }, [focus, value.length]);
  const rules = value;
  const insert = (index: number) => {
    onChange([...rules.slice(0, index), "", ...rules.slice(index)]);
    setFocus(index);
  };
  const remove = (index: number) => onChange(rules.filter((_, i) => i !== index));
  return (
    <Section title={title} footer={footer}>
      {rules.map((rule, index) => (
        <label className="field rule-field" key={index}>
          <span className="dot dot-gray rule-dot" aria-hidden="true" />
          <input
            ref={(node) => {
              inputs.current[index] = node;
            }}
            className="text-input rule-input"
            value={rule}
            placeholder={placeholder}
            aria-label={`${title}, ${index + 1} of ${rules.length}`}
            onChange={(event) => onChange(rules.map((item, i) => (i === index ? event.target.value : item)))}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                insert(index + 1);
              } else if (event.key === "Backspace" && !rule) {
                event.preventDefault();
                remove(index);
                setFocus(Math.max(0, index - 1));
              }
            }}
            onBlur={(event) => {
              const next = event.relatedTarget as HTMLElement | null;
              if (!rule.trim() && !next?.closest?.(".rule-field")) remove(index);
            }}
          />
        </label>
      ))}
      <button type="button" className="row add-row" onClick={() => insert(rules.length)}>
        <Icon name="plus" size={18} />
        <span className="row-body">
          <span className="row-title">{addLabel}</span>
        </span>
      </button>
    </Section>
  );
}

// ---------- Sources ----------

function SourcesTab({ agent, collections, mutate, reload }: { agent: AgentDetail; collections: Collection[]; mutate: Mutate; reload: () => Promise<void> }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [addingTool, setAddingTool] = useState(false);
  const [editing, setEditing] = useState<KnowledgeSource | null>(null);
  const [showCorrected, setShowCorrected] = useState(false);
  const corrected = agent.draft.correctedAnswers ?? [];
  const pending = agent.sources.some((source) => source.status === "pending" || source.status === "processing");
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => void reload(), 4000);
    return () => clearInterval(timer);
  }, [pending]);
  const toggleSource = (sourceId: string, on: boolean) =>
    mutate((current) => ({
      ...current,
      knowledgeSourceIds: on ? [...new Set([...current.knowledgeSourceIds, sourceId])] : current.knowledgeSourceIds.filter((item) => item !== sourceId),
    }));
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
      <Section
        title="Knowledge"
        action={
          agent.sources.length > 0 || corrected.length > 0 ? (
            <Button variant="plain" icon="plus" onClick={() => setAdding(true)}>
              Add
            </Button>
          ) : undefined
        }
        footer="For explanations that rarely change: policies, guides, FAQs. Answers you fix land in Corrected answers."
      >
        {corrected.length > 0 && (
          <button type="button" className="row" onClick={() => setShowCorrected(true)}>
            <span className="tile tile-soft-green" aria-hidden="true">
              <Icon name="check-bubble" size={18} />
            </span>
            <span className="row-body">
              <span className="row-text">
                <span className="row-title">Corrected answers</span>
                <span className="row-subtitle">{plural(corrected.length, "answer")} you fixed</span>
              </span>
              <Icon name="chevron-right" className="row-chevron" size={14} />
            </span>
          </button>
        )}
        {agent.sources.length === 0 && corrected.length === 0 ? (
          <EmptyState
            icon="doc"
            title="No knowledge yet"
            text="Add your policies, buying guides or a web page. The assistant reads them before it answers."
            action={
              <Button variant="tinted" onClick={() => setAdding(true)}>
                Add knowledge
              </Button>
            }
          />
        ) : (
          agent.sources.map((source) => {
            const failed = source.status === "failed";
            const processing = source.status === "pending" || source.status === "processing";
            return (
              <div className="row" key={source.id}>
                <span className="tile tile-soft-indigo" aria-hidden="true">
                  <Icon name={source.type === "url" ? "globe" : "doc"} size={18} />
                </span>
                <div className="row-body">
                  <button type="button" className="row-text row-open" onClick={() => setEditing(source)}>
                    <span className="row-title">{source.name}</span>
                    <span className={`row-subtitle${failed ? " text-red" : ""}`}>
                      {failed ? source.error || "Couldn't read this source" : processing ? "Reading it now…" : updatedLabel(source.updated_at)}
                    </span>
                  </button>
                  {failed && (
                    <Button
                      variant="gray"
                      size="small"
                      onClick={async () => {
                        await post(`/api/admin/knowledge/${source.id}/retry`);
                        toast("Reading the source again");
                        await reload();
                      }}
                    >
                      Retry
                    </Button>
                  )}
                  <Toggle label={`Use ${source.name}`} checked={agent.draft.knowledgeSourceIds.includes(source.id)} onChange={(on) => toggleSource(source.id, on)} />
                </div>
              </div>
            );
          })
        )}
      </Section>

      <Section title="Data it can look up" footer="It always checks these before talking about prices, offers or stock. Ended or switched-off rows are never used.">
        {collections.length === 0 ? (
          <div className="row">
            <div className="row-body">
              <span className="row-text">
                <span className="row-subtitle">No tables yet. Add one in Data.</span>
              </span>
            </div>
          </div>
        ) : (
          collections.map((collection) => (
            <div className="row" key={collection.id}>
              <span className="tile tile-soft-green" aria-hidden="true">
                <Icon name="table" size={18} />
              </span>
              <div className="row-body">
                <span className="row-text">
                  <span className="row-title">{collection.name}</span>
                  {collection.description && <span className="row-subtitle truncate">{collection.description}</span>}
                </span>
                <Toggle label={`Use ${collection.name}`} checked={agent.draft.collectionBindings.some((item) => item.collectionId === collection.id)} onChange={(on) => bindCollection(collection, on)} />
              </div>
            </div>
          ))
        )}
      </Section>

      <Section footer="Read-only checks against your own systems, such as live stock. The assistant can never change anything outside.">
        <Disclosure
          title={
            <>
              Live lookups <span className="muted">(advanced)</span>
            </>
          }
          detail={agent.tools.length ? String(agent.tools.length) : "None"}
        >
          {agent.tools.map((tool) => (
            <div className="row" key={tool.id}>
              <span className="tile tile-soft-orange" aria-hidden="true">
                <Icon name={tool.kind === "http_get" ? "globe" : "bolt"} size={18} />
              </span>
              <div className="row-body">
                <span className="row-text">
                  <span className="row-title">{tool.name}</span>
                  <span className="row-subtitle truncate">{tool.description}</span>
                </span>
                <Toggle label={`Use ${tool.name}`} checked={agent.draft.toolBindings.includes(tool.name)} onChange={(on) => bindTool(tool.name, on)} />
              </div>
            </div>
          ))}
          <button type="button" className="row add-row" onClick={() => setAddingTool(true)}>
            <Icon name="plus" size={18} />
            <span className="row-body">
              <span className="row-title">Add a lookup</span>
            </span>
          </button>
        </Disclosure>
      </Section>

      {showCorrected && (
        <Sheet title="Corrected answers" subtitle="Part of the draft · publish to send changes to customers" onClose={() => setShowCorrected(false)} footer={<Button onClick={() => setShowCorrected(false)}>Done</Button>}>
          {corrected.length === 0 ? (
            <EmptyState icon="check-bubble" title="No corrected answers" text="Answers you fix with Fix this answer show up here." />
          ) : (
            <Section footer="Removing one also removes it from the draft; its test scenario stays until you delete it.">
              {corrected.map((item, index) => (
                <div className="row top" key={item.fixId ?? index}>
                  <div className="row-body">
                    <span className="row-text">
                      <span className="row-title strong">{item.question}</span>
                      <span className="row-subtitle">{item.answer}</span>
                    </span>
                    <Button
                      variant="plain"
                      size="small"
                      destructive
                      onClick={() => mutate((current) => ({ ...current, correctedAnswers: (current.correctedAnswers ?? []).filter((_, i) => i !== index) }))}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </Section>
          )}
        </Sheet>
      )}
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
            toggleSource(sourceId, true);
            await reload();
            toast("Saved to the draft");
          }}
        />
      )}
      {addingTool && (
        <AddToolSheet
          agentId={agent.id}
          onClose={() => setAddingTool(false)}
          onDone={async (name) => {
            setAddingTool(false);
            bindTool(name, true);
            await reload();
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
          <Button variant="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-knowledge" busy={busy} disabled={!name || !content}>
            Add
          </Button>
        </>
      }
    >
      <form id="add-knowledge" onSubmit={submit} className="sheet-form">
        <Segmented label="Source type" value={kind} onChange={setKind} options={[{ value: "text", label: "Text" }, { value: "url", label: "Web page" }]} />
        <Section footer={kind === "url" ? "One HTTPS page; linked pages are not followed." : "Paste text or Markdown. Changes go into the draft; publish to make them live."}>
          <FieldRow label="Title">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="Warranty policy" required data-autofocus />
          </FieldRow>
          {kind === "url" ? (
            <FieldRow label="Address">
              <TextInput type="url" value={content} onChange={(event) => setContent(event.target.value)} placeholder="https://" required />
            </FieldRow>
          ) : (
            <FieldRow label="Content" stacked>
              <TextArea rows={6} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Paste text or Markdown" required />
            </FieldRow>
          )}
        </Section>
        {error && <Banner tone="error" title="Couldn't add it" text={error} />}
      </form>
    </Sheet>
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
      subtitle="Usually set up once by your developer"
      onClose={onClose}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-tool" busy={busy} disabled={!tool.name || !tool.description || (tool.kind === "http_get" && !tool.urlTemplate)}>
            Add
          </Button>
        </>
      }
    >
      <form id="add-tool" className="sheet-form" onSubmit={submit}>
        <Segmented label="Lookup type" value={tool.kind} onChange={(kind) => setTool({ ...tool, kind })} options={[{ value: "http_get", label: "Web address" }, { value: "plugin", label: "Built-in" }]} />
        <Section footer={tool.kind === "http_get" ? "Use {query} in the address for the search words. Public HTTPS only." : undefined}>
          <FieldRow label="Name">
            <TextInput value={tool.name} placeholder="check_stock" onChange={(event) => setTool({ ...tool, name: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} required />
          </FieldRow>
          <FieldRow label="When to use it" stacked>
            <TextArea rows={1} value={tool.description} onChange={(event) => setTool({ ...tool, description: event.target.value })} required />
          </FieldRow>
          {tool.kind === "http_get" ? (
            <FieldRow label="Address" stacked>
              <TextInput type="url" value={tool.urlTemplate} placeholder="https://api.example.com/search?q={query}" onChange={(event) => setTool({ ...tool, urlTemplate: event.target.value })} required />
            </FieldRow>
          ) : (
            <FieldRow label="Lookup">
              <select className="select" value={tool.pluginId} onChange={(event) => setTool({ ...tool, pluginId: event.target.value })}>
                <option value="normalize_contact">Tidy contact details</option>
                <option value="active_at">Check a date range</option>
              </select>
            </FieldRow>
          )}
        </Section>
        {error && <Banner tone="error" title="Couldn't add it" text={error} />}
      </form>
    </Sheet>
  );
}

// ---------- Versions ----------

function VersionsTab({ agent, unpublished, saving, reload }: { agent: AgentDetail; unpublished: boolean; saving: boolean; reload: () => Promise<void> }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState<AgentDetail["versions"][number] | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Section title="Versions" footer="Each version is a frozen copy. Chats in progress keep the version they started with; restoring affects new chats only.">
        {agent.versions.length === 0 ? (
          <EmptyState icon="clock" title="No versions yet" text="Publish the draft to make it live. Every publish is saved here so you can go back." />
        ) : (
          <>
            {unpublished && (
              <div className="row">
                <span className="tile tile-soft-orange" aria-hidden="true">
                  <Icon name="pencil" size={18} />
                </span>
                <div className="row-body">
                  <span className="row-text">
                    <span className="row-title">Draft</span>
                    <span className="row-subtitle">{saving ? "Unpublished changes · saving…" : "Unpublished changes · saved"}</span>
                  </span>
                  <Badge tone="orange">Not live</Badge>
                </div>
              </div>
            )}
            {agent.versions.map((version) => {
              const live = version.id === agent.active_version_id;
              return (
                <div className="row" key={version.id}>
                  <span className={`tile tile-${live ? "green" : "gray"}`} aria-hidden="true">
                    <Icon name="clock" size={18} />
                  </span>
                  <div className="row-body">
                    <span className="row-text">
                      <span className="row-title">Version {version.version}</span>
                      <span className="row-subtitle">{formatDate(version.published_at)}</span>
                    </span>
                    {live ? (
                      <Badge tone="green">Live</Badge>
                    ) : (
                      <Button variant="gray" size="small" onClick={() => setConfirm(version)}>
                        Restore
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </Section>
      {confirm && (
        <Alert
          title={`Restore version ${confirm.version}?`}
          text={`New chats will use version ${confirm.version} right away. Chats already in progress keep their version, and your draft doesn't change.`}
          confirmLabel="Restore"
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await post(`/api/admin/agents/${agent.id}/rollback/${confirm.id}`);
              toast(`Version ${confirm.version} is live again`);
              setConfirm(null);
              await reload();
            } catch (caught) {
              toast(errorMessage(caught, "Couldn't restore"), "error");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </>
  );
}

// ---------- Preview (always visible on desktop) ----------

type ChatTurn = { role: "user" | "assistant"; text: string; at: string; result?: AgentResult; last?: boolean };
type TracedRecord = { record_id?: string; id?: string } & Record<string, unknown>;

// A readable label for a looked-up row: the table's title column, else its first short text value.
const recordTitle = (record: TracedRecord, titleKey?: string) =>
  String(
    (titleKey && record[titleKey]) ??
      Object.entries(record).find(([key, value]) => !["id", "record_id", "valid_from", "valid_until"].includes(key) && typeof value === "string" && value.length > 0 && value.length < 90 && !/^https?:/.test(value))?.[1] ??
      "Row",
  );

const fallbackStarters = ["What do you offer?", "How much does it cost?", "How can I reach you?"];

function PreviewPane({
  agent,
  collections,
  flush,
  reload,
  run,
  setRun,
  scenOpen,
  setScenOpen,
  navigate,
}: {
  agent: AgentDetail;
  collections: Collection[];
  flush: () => Promise<boolean>;
  reload: () => Promise<void>;
  run: EvalRun | null;
  setRun: (run: EvalRun) => void;
  scenOpen: boolean;
  setScenOpen: (open: boolean) => void;
  navigate: Navigate;
}) {
  const titleId = useId();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState(() => crypto.randomUUID());
  const [editingSource, setEditingSource] = useState<KnowledgeSource | null>(null);
  const toast = useToast();
  const scroller = useRef<HTMLDivElement>(null);
  const { startFix, fixSheet } = useFixAnswer({ agentId: agent.id, onChanged: reload, onOpenSettings: () => navigate("settings") });
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy, openId]);
  // The reply being fixed is every message of that result; the question is the customer turn before it.
  async function fixTurn(index: number) {
    const result = turns[index].result;
    if (!result || !(await flush())) return;
    const question = [...turns.slice(0, index)].reverse().find((turn) => turn.role === "user")?.text ?? "";
    const reply = turns
      .filter((turn) => turn.result === result)
      .flatMap((turn) => parseRichMessage(turn.text).map((part) => part.text ?? ""))
      .filter(Boolean)
      .join("\n")
      .trim();
    const lookups = (result.trace?.toolCalls ?? []).flatMap((call) => (Array.isArray(call.output) ? (call.output as TracedRecord[]) : []).filter((row) => row.record_id).map((row) => ({ toolName: call.name, recordId: String(row.record_id) })));
    startFix({ origin: "test", customerMessage: question, badReply: reply, lookups });
  }

  const collectionFor = (toolName: string) => {
    const binding = agent.draft.collectionBindings.find((item) => item.toolName === toolName);
    return binding ? collections.find((item) => item.id === binding.collectionId) : undefined;
  };
  const titleKeyFor = (toolName: string) => {
    const collection = collectionFor(toolName);
    return collection ? titleField(JSON.parse(collection.schema_json).fields as Array<{ key: string; type: string; required?: boolean }>)?.key : undefined;
  };

  async function ask(message: string) {
    if (!message || busy) return;
    if (!(await flush())) return;
    setText("");
    setError("");
    setTurns((current) => [...current, { role: "user", text: message, at: new Date().toISOString() }]);
    setBusy(true);
    try {
      const result = await post<AgentResult>(`/api/admin/agents/${agent.id}/preview`, { text: message, conversationId });
      const at = new Date().toISOString();
      setTurns((current) => [...current, ...result.messages.map((item, index) => ({ role: "assistant" as const, text: item.text, at, result, last: index === result.messages.length - 1 }))]);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  const starters = agent.evalCases.length ? agent.evalCases.slice(0, 3).map((item) => item.input) : fallbackStarters;

  return (
    <section className="preview-pane" aria-labelledby={titleId}>
      <div className="pane-head">
        <div className="spacer">
          <div id={titleId} className="pane-title">
            Preview
          </div>
          <div className="pane-sub">The draft · customers never see this</div>
        </div>
        <Button
          variant="gray"
          size="small"
          icon="refresh"
          onClick={() => {
            setTurns([]);
            setOpenId(null);
            setError("");
            setConversationId(crypto.randomUUID());
          }}
        >
          New chat
        </Button>
      </div>
      <div className="pane-scroll" ref={scroller}>
        {turns.length === 0 && !busy ? (
          <div className="empty preview-empty">
            <span className="empty-icon" aria-hidden="true">
              <Icon name="sparkles" size={28} />
            </span>
            <h3 className="empty-title">Chat like a customer</h3>
            <p className="empty-text">Tap a reply to see what it read and looked up.</p>
            <div className="starters">
              {starters.map((starter) => (
                <button type="button" key={starter} className="btn btn-gray starter" onClick={() => void ask(starter)}>
                  {starter}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat" aria-live="polite">
            {turns.map((turn, index) => {
              const separator = timeSeparator(index ? turns[index - 1].at : null, turn.at);
              const key = `${index}`;
              if (turn.role === "user")
                return (
                  <ChatGroup key={key} separator={separator}>
                    <RichBubbles side="out" text={turn.text} />
                  </ChatGroup>
                );
              const requestId = turn.result?.requestId ?? key;
              const open = openId === requestId;
              const trace = turn.result?.trace;
              return (
                <ChatGroup key={key} separator={separator}>
                  <div className={`reply${trace ? " has-trace" : ""}`} onClick={() => trace && setOpenId(open ? null : requestId)}>
                    <RichBubbles side="in" text={turn.text} selected={open} />
                  </div>
                  {turn.last && trace && (
                    <ReplyDetails
                      trace={trace}
                      open={open}
                      toggle={() => setOpenId(open ? null : requestId)}
                      collectionFor={collectionFor}
                      titleKeyFor={titleKeyFor}
                      openSource={(id) => setEditingSource(agent.sources.find((source) => source.id === id) ?? null)}
                      openRecord={(toolName, recordId) => {
                        const collection = collectionFor(toolName);
                        if (collection) navigate("data", collection.id, recordId);
                      }}
                      onFix={() => void fixTurn(index)}
                    />
                  )}
                </ChatGroup>
              );
            })}
            {busy && (
              <div className="bubble bubble-in typing" aria-label="Typing">
                <Spinner label="Typing" />
              </div>
            )}
          </div>
        )}
        {error && (
          <div className="pane-banner">
            <Banner tone="error" title="No reply" text={`${error}. Nothing was sent to customers.`} onClose={() => setError("")} />
          </div>
        )}
      </div>
      <ScenarioBar agent={agent} flush={flush} reload={reload} run={run} setRun={setRun} open={scenOpen} setOpen={setScenOpen} />
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(text.trim());
        }}
      >
        <label htmlFor={`${titleId}-msg`} className="sr-only">
          Message the draft
        </label>
        <input id={`${titleId}-msg`} type="text" placeholder="Message the draft" value={text} onChange={(event) => setText(event.target.value)} autoComplete="off" />
        <button type="submit" className="send" aria-label="Send" disabled={!text.trim() || busy}>
          <Icon name="arrow-up" size={16} />
        </button>
      </form>
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
      {fixSheet}
    </section>
  );
}

function ChatGroup({ separator, children }: { separator: string | null; children: ReactNode }) {
  return (
    <>
      {separator && <span className="time-sep">{separator}</span>}
      {children}
    </>
  );
}

function ReplyDetails({
  trace,
  open,
  toggle,
  collectionFor,
  titleKeyFor,
  openSource,
  openRecord,
  onFix,
}: {
  trace: NonNullable<AgentResult["trace"]>;
  open: boolean;
  toggle: () => void;
  collectionFor: (toolName: string) => Collection | undefined;
  titleKeyFor: (toolName: string) => string | undefined;
  openSource: (id: string) => void;
  openRecord: (toolName: string, recordId: string) => void;
  onFix: () => void;
}) {
  const sources = trace.sources.filter((source, index, all) => all.findIndex((item) => item.name === source.name) === index);
  const lookups = trace.toolCalls.map((call) => ({ call, rows: Array.isArray(call.output) ? (call.output as TracedRecord[]) : [] }));
  const rowCount = lookups.reduce((total, item) => total + item.rows.length, 0);
  const summary = [sources.length && `Read ${plural(sources.length, "source")}`, lookups.length && `looked up ${plural(rowCount, "row")}`].filter(Boolean).join(" · ") || "Answered without sources or data";
  const seconds = Math.max(1, Math.round(trace.latencyMs / 1000));
  return (
    <>
      <MetaChip expanded={open} onClick={toggle}>
        {summary.charAt(0).toUpperCase() + summary.slice(1)}
      </MetaChip>
      {open && (
        <DetailsCard title="This reply" sub={`Answered in ${plural(seconds, "second")}${sources.length || rowCount ? " · tap a source or row to edit it" : ""}`}>
          {sources.length > 0 && (
            <MiniList
              label="Knowledge read"
              items={sources.map((source, index) => ({
                key: `${source.name}-${index}`,
                label: source.name,
                icon: "doc",
                tone: "indigo",
                onClick: source.id ? () => openSource(String(source.id)) : undefined,
              }))}
            />
          )}
          {lookups.map(({ call, rows }, index) => (
            <MiniList
              key={`${call.name}-${index}`}
              label={`Data looked up · ${collectionFor(call.name)?.name ?? "Live lookup"}`}
              items={
                rows.length
                  ? rows.slice(0, 8).map((record, rowIndex) => ({
                      key: `${rowIndex}`,
                      label: recordTitle(record, titleKeyFor(call.name)),
                      icon: "table",
                      tone: "green",
                      wrap: true,
                      onClick: record.record_id ? () => openRecord(call.name, String(record.record_id)) : undefined,
                    }))
                  : [{ key: "none", label: "Nothing matched", icon: "search" }]
              }
            />
          ))}
          {trace.error && <p className="details-sub text-red">{trace.error}</p>}
          <Button variant="tinted" icon="wrench" block onClick={onFix}>
            Fix this answer
          </Button>
        </DetailsCard>
      )}
    </>
  );
}

// ---------- Test scenarios (bottom of the Preview) ----------

type Assertions = { criteria?: string; expectedTool?: string; mustInclude?: string[]; mustNotInclude?: string[]; maxLength?: number; fromFix?: string };

function ScenarioBar({
  agent,
  flush,
  reload,
  run,
  setRun,
  open,
  setOpen,
}: {
  agent: AgentDetail;
  flush: () => Promise<boolean>;
  reload: () => Promise<void>;
  run: EvalRun | null;
  setRun: (run: EvalRun) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const toast = useToast();
  const listId = useId();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<EvalCase | "new" | null>(null);
  const cases = agent.evalCases;
  const resultFor = (id: string) => run?.results.find((item) => item.caseId === id);
  const ran = cases.filter((item) => resultFor(item.id));
  const failing = ran.filter((item) => !resultFor(item.id)?.passed).length;
  async function evaluate() {
    if (!(await flush())) return;
    setBusy(true);
    setOpen(true);
    try {
      const result = await post<EvalRun>(`/api/admin/agents/${agent.id}/evaluate`);
      setRun(result);
      const failed = result.results.filter((item) => !item.passed).length;
      toast(failed ? `${plural(failed, "scenario")} failing` : `All ${plural(result.results.length, "scenario")} passed`, failed ? "error" : "default");
    } catch (caught) {
      toast(errorMessage(caught, "Couldn't run the scenarios"), "error");
    } finally {
      setBusy(false);
    }
  }
  const summary = busy ? (
    <span className="muted">Running…</span>
  ) : !cases.length ? (
    <span className="muted">None yet</span>
  ) : !ran.length ? (
    <span className="muted">{plural(cases.length, "scenario")}</span>
  ) : failing ? (
    <Badge tone="red">
      {failing} of {cases.length} failing
    </Badge>
  ) : (
    <Badge tone="green">
      {ran.length} of {cases.length} passed
    </Badge>
  );
  return (
    <div className="scen-bar">
      <div className="scen-head">
        <button type="button" className="scen-toggle" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(!open)}>
          <Icon name="chevron-right" className="chev" size={12} />
          <b>Test scenarios</b>
          {summary}
        </button>
        {cases.length > 0 && (
          <Button variant="plain" size="small" busy={busy} onClick={() => void evaluate()}>
            Run all
          </Button>
        )}
      </div>
      {open && (
        <div className="scen-list" id={listId}>
          {cases.map((testCase) => {
            const result = resultFor(testCase.id);
            const assertions = JSON.parse(testCase.assertions_json || "{}") as Assertions;
            const rules = [
              assertions.criteria && `passes when ${assertions.criteria}`,
              assertions.expectedTool && "checks Data",
              assertions.mustInclude?.length && `says “${assertions.mustInclude.join("”, “")}”`,
              assertions.mustNotInclude?.length && `never says “${assertions.mustNotInclude.join("”, “")}”`,
            ].filter(Boolean);
            return (
              <button type="button" className="scen-item" key={testCase.id} onClick={() => setEditing(testCase)}>
                <span className="spacer" style={{ minWidth: 0 }}>
                  <span className="scen-name">
                    <span>{testCase.name}</span>
                    {Boolean(testCase.critical) && <Badge tone="outline">Required</Badge>}
                    {assertions.fromFix && <Badge tone="neutral">From a fix</Badge>}
                  </span>
                  <span className="truncate muted scen-msg">{[`“${testCase.input}”`, ...rules].join(" · ")}</span>
                  {result && !result.passed && <span className="scen-msg text-red">{result.failures.join(", ") || "Didn't pass"}</span>}
                </span>
                {result && (result.passed ? <Badge tone="green">Passed</Badge> : result.failures.some((item) => item.startsWith("Not checked")) && result.failures.every((item) => item.startsWith("Not checked")) ? <Badge tone="neutral">Not checked</Badge> : <Badge tone="red">Failed</Badge>)}
              </button>
            );
          })}
          <Button variant="plain" size="small" icon="plus" className="scen-add" onClick={() => setEditing("new")}>
            Add scenario
          </Button>
        </div>
      )}
      {editing && (
        <ScenarioSheet
          agentId={agent.id}
          existing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDone={async () => {
            setEditing(null);
            await reload();
          }}
        />
      )}
    </div>
  );
}

function ScenarioSheet({ agentId, existing, onClose, onDone }: { agentId: string; existing: EvalCase | null; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState(() => {
    const assertions = JSON.parse(existing?.assertions_json || "{}") as Assertions;
    return {
      name: existing?.name ?? "",
      input: existing?.input ?? "",
      criteria: assertions.criteria ?? "",
      expectedTool: assertions.expectedTool ?? "",
      mustInclude: (assertions.mustInclude ?? []).join(", "),
      mustNotInclude: (assertions.mustNotInclude ?? []).join(", "),
      maxLength: assertions.maxLength ? String(assertions.maxLength) : "",
      critical: existing ? Boolean(existing.critical) : true,
      fromFix: assertions.fromFix,
    };
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fix, setFix] = useState<{ undoable: boolean; target_kind: string | null } | null>(null);
  const [undo, setUndo] = useState<{ reason: string; busy: boolean } | null>(null);
  const toast = useToast();
  useEffect(() => {
    if (form.fromFix) void api<{ undoable: boolean; target_kind: string | null }>(`/api/admin/fixes/${form.fromFix}`).then(setFix, () => setFix(null));
  }, [form.fromFix]);
  async function undoFix() {
    if (!undo || !form.fromFix) return;
    setUndo({ ...undo, busy: true });
    try {
      const result = await post<{ live: boolean }>(`/api/admin/fixes/${form.fromFix}/undo`, { reason: undo.reason });
      toast(result.live ? "Fix undone — customers see the old value again" : "Fix undone — publish to remove it for customers");
      onDone();
    } catch (caught) {
      setUndo(null);
      setError(errorMessage(caught, "Couldn't undo the fix"));
    }
  }
  const list = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = {
        name: form.name,
        input: form.input,
        critical: form.critical,
        assertions: {
          criteria: form.criteria.trim() || undefined,
          expectedTool: form.expectedTool || undefined,
          mustInclude: list(form.mustInclude).length ? list(form.mustInclude) : undefined,
          mustNotInclude: list(form.mustNotInclude).length ? list(form.mustNotInclude) : undefined,
          maxLength: form.maxLength ? Number(form.maxLength) : undefined,
          fromFix: form.fromFix,
        },
      };
      await (existing ? patch(`/api/admin/eval-cases/${existing.id}`, body) : post(`/api/admin/agents/${agentId}/eval-cases`, body));
      onDone();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Sheet
        title={existing ? existing.name : "Add test scenario"}
        subtitle="Publish runs these first; required ones must pass"
        onClose={onClose}
        footer={
          <>
            {existing && fix?.undoable ? (
              <Button variant="plain" destructive onClick={() => setUndo({ reason: "", busy: false })}>
                Undo fix
              </Button>
            ) : (
              existing && (
                <Button variant="plain" destructive onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              )
            )}
            <span className="spacer" />
            <Button variant="gray" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="scenario" busy={busy} disabled={!form.name || !form.input}>
              {existing ? "Save" : "Add"}
            </Button>
          </>
        }
      >
        <form id="scenario" className="sheet-form" onSubmit={submit}>
          <Section>
            <FieldRow label="Name">
              <TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Never invent a price" required data-autofocus={existing ? undefined : true} />
            </FieldRow>
            <FieldRow label="Customer message" stacked>
              <TextArea rows={1} value={form.input} onChange={(event) => setForm({ ...form, input: event.target.value })} required />
            </FieldRow>
            <FieldRow label="Required to publish">
              <Toggle label="Required to publish" checked={form.critical} onChange={(critical) => setForm({ ...form, critical })} />
            </FieldRow>
          </Section>
          <Section title="Passes when" footer="Write it the way you'd tell a new hire. The AI checks each reply against it, so wording can differ.">
            <FieldRow label="Passes when" stacked>
              <TextArea rows={2} value={form.criteria} onChange={(event) => setForm({ ...form, criteria: event.target.value })} placeholder="Says returns cost 20% and asks for the order number" />
            </FieldRow>
          </Section>
          <Section footer="Exact checks. Separate several phrases with commas.">
            <Disclosure title={<>Exact words and lookups <span className="muted">(advanced)</span></>} defaultOpen={Boolean(form.mustInclude || form.mustNotInclude || form.expectedTool || form.maxLength) && !form.criteria}>
              <FieldRow label="Says">
                <TextInput value={form.mustInclude} onChange={(event) => setForm({ ...form, mustInclude: event.target.value })} />
              </FieldRow>
              <FieldRow label="Never says">
                <TextInput value={form.mustNotInclude} onChange={(event) => setForm({ ...form, mustNotInclude: event.target.value })} />
              </FieldRow>
              <FieldRow label="Checks Data" hint="Lookup name">
                <TextInput value={form.expectedTool} placeholder="search_products" onChange={(event) => setForm({ ...form, expectedTool: event.target.value })} />
              </FieldRow>
              <FieldRow label="Max length" hint="Characters">
                <TextInput className="tabular" type="number" min={1} value={form.maxLength} onChange={(event) => setForm({ ...form, maxLength: event.target.value })} />
              </FieldRow>
            </Disclosure>
          </Section>
          {error && <Banner tone="error" title="Couldn't save it" text={error} />}
        </form>
      </Sheet>
      {undo && (
        <Alert
          title="Undo this fix?"
          text={
            <>
              {fix?.target_kind === "data" ? "The data row goes back to its old value right away." : "The added answer or rule is removed from your changes."} This scenario is removed too.
              <TextInput aria-label="Why (optional)" placeholder="Why (optional)" value={undo.reason} onChange={(event) => setUndo({ ...undo, reason: event.target.value })} style={{ marginTop: 12 }} />
            </>
          }
          confirmLabel="Undo fix"
          destructive
          busy={undo.busy}
          onCancel={() => setUndo(null)}
          onConfirm={() => void undoFix()}
        />
      )}
      {confirmDelete && existing && (
        <Alert
          title="Delete this scenario?"
          text="Publish will no longer check it."
          confirmLabel="Delete"
          destructive
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await del(`/api/admin/eval-cases/${existing.id}`);
            onDone();
          }}
        />
      )}
    </>
  );
}

// ---------- Knowledge sheet (shared by Sources and Preview) ----------

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
      onDone(contentChanged ? "Saved — the assistant uses it in a minute" : "Saved");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      title={source.name}
      subtitle={isUrl ? "Web page" : updatedLabel(source.updated_at)}
      onClose={onClose}
      footer={
        <>
          {isUrl && (
            <Button
              variant="plain"
              onClick={async () => {
                await post(`/api/admin/knowledge/${source.id}/retry`);
                onDone("Reading the page again");
              }}
            >
              Read the page again
            </Button>
          )}
          <span className="spacer" />
          <Button variant="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-knowledge" busy={busy} disabled={!name.trim() || text === null}>
            Save
          </Button>
        </>
      }
    >
      <form id="edit-knowledge" className="sheet-form" onSubmit={save}>
        <Section footer={isUrl ? "Web pages update when the page is read again." : "Saving new text re-reads this source; replies use it after a minute."}>
          <FieldRow label="Title">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} required />
          </FieldRow>
          {!isUrl && (
            <FieldRow label="Content" stacked>
              {text === null ? (
                <span className="sheet-loading">
                  <SkeletonLine width="90%" />
                  <SkeletonLine width="75%" />
                  <SkeletonLine width="60%" />
                </span>
              ) : (
                <TextArea rows={6} value={text} onChange={(event) => setText(event.target.value)} />
              )}
            </FieldRow>
          )}
        </Section>
        {error && <Banner tone="error" title="Couldn't save it" text={error} />}
      </form>
    </Sheet>
  );
}
