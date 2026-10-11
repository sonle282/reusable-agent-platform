import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api, del, patch, post } from "../api";
import { modelSupportsTemperature, type AnthropicModel } from "../../shared/models";
import { emptyProfile, hasProfile, type AssistantProfile } from "../../shared/prompt";
import { formatDate, timeSeparator, titleField } from "../format";
import { paceDelay, splitParts } from "../../shared/channel-parts";
import { readable, useFixAnswer } from "../FixSheet";
import { BehaviorTab, FollowUpsTab } from "./AssistantBehavior";
import { RichBubbles, parseRichMessage } from "../RichMessage";
import type { AgentDetail, AgentDraft, AgentResult, Collection, EvalCase, EvalRun, KnowledgeSource } from "../types";
import { AgentAvatar, Alert, Badge, Button, Card, DetailsCard, Dialog, Disclosure, EmptyState, errorMessage, Field, Icon, MetaChip, MiniList, PageHeader, Row, Segmented, Select, SettingRow, Sheet, Skeleton, SkeletonLine, Spinner, Switch, Tabs, TextArea, TextInput, Tile, TypingDots, useToast } from "../ui";

export type AssistantTab = "test" | "instructions" | "sources" | "followups" | "behavior" | "versions";
type EditorTab = Exclude<AssistantTab, "test">;
type Navigate = (page: "home" | "data" | "conversations" | "channels" | "settings", ...params: string[]) => void;

const editorTabs: Array<{ value: EditorTab; label: string }> = [
  { value: "instructions", label: "Instructions" },
  { value: "sources", label: "Sources" },
  { value: "followups", label: "Follow-ups" },
  { value: "behavior", label: "Behavior" },
  { value: "versions", label: "Versions" },
];
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
  hasZernio = false,
}: {
  agentId: string;
  collections: Collection[];
  hasZernio?: boolean;
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
  const [injected, setInjected] = useState<{ text: string; step: number; at: number } | null>(null);
  const [publishFailure, setPublishFailure] = useState<{ fromFix: boolean; input: string; reply: string; problem: string } | null>(null);
  const [discarding, setDiscarding] = useState<"ask" | "busy" | null>(null);
  const { startFix: startPublishFix, fixSheet: publishFixSheet } = useFixAnswer({ agentId, onChanged: () => load(), onOpenSettings: () => navigate("settings") });
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
      if (agent.evalCases.some((item) => item.critical)) {
        setPublishing("evaluating");
        const run = await post<EvalRun>(`/api/admin/agents/${agentId}/evaluate`);
        if (!run.passed) {
          const failing = agent.evalCases.filter((item) => item.critical && run.results.some((result) => result.caseId === item.id && !result.passed));
          // A broken fix is the most important one to show: it passed once and regressed.
          const failed = failing.find((item) => (JSON.parse(item.assertions_json || "{}") as Assertions).fromFix) ?? failing[0];
          const result = run.results.find((item) => item.caseId === failed?.id);
          const reply = result?.output?.messages?.map((message) => message.text).join("\n") ?? "";
          setPublishFailure({ fromFix: Boolean(failed && (JSON.parse(failed.assertions_json || "{}") as Assertions).fromFix), input: failed?.input ?? "", reply, problem: plainProblem(result?.failures ?? []) });
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
      <div className="page" style={{ padding: "32px 24px" }}>
        <PageHeader title="Assistant" />
        <Alert
          tone="error"
          title="Couldn't open the assistant"
          text={`${error}. Customers are not affected.`}
          actions={
            <Button variant="outline" size="sm" onClick={() => void load().catch((caught) => setError(errorMessage(caught)))}>
              Try again
            </Button>
          }
        />
      </div>
    ) : (
      <AssistantSkeleton />
    );

  const editorTab: EditorTab = tab === "test" ? "instructions" : tab;
  const status = !live
    ? { dot: "dot-gray", text: "Not live yet · test it, then publish" }
    : upToDate
      ? { dot: "dot-green", text: `Live · version ${live.version}` }
      : { dot: "dot-orange", text: `Unpublished changes · customers see version ${live.version}` };
  const saveText = saveFailed ? "Not saved yet" : saveState === "saving" ? "Saving…" : saveState === "dirty" ? "Editing…" : "Draft saved";
  const missing = [
    !agent.draft.modelConfig.credentialId && { text: "Add your Anthropic API key so the assistant can answer.", action: "Open Settings", go: () => navigate("settings") },
    !agent.draft.instructions.trim() && !hasProfile(agent.draft) && { text: "Tell the assistant what its job is.", action: "Write instructions", go: () => onTab("instructions") },
    agent.sources.some((source) => source.status === "failed") && { text: "A knowledge source couldn't be read.", action: "View sources", go: () => onTab("sources") },
  ].filter(Boolean) as Array<{ text: string; action: string; go: () => void }>;

  return (
    <div className="builder">
      <header className="builder-bar">
        <Button variant="ghost" icon="chevron-left" aria-label="Back to Home" onClick={() => navigate("home")} />
        <AgentAvatar id={agent.id} name={agent.name} size="sm" />
        <div className="stack spacer" style={{ gap: 0 }}>
          <h1 className="truncate" style={{ margin: 0, font: "var(--text-heading-xs)" }}>
            {agent.name}
          </h1>
          <span className="status xs">
            <span className={`dot ${status.dot}`} aria-hidden="true" />
            <span className="truncate">{status.text}</span>
          </span>
        </div>
        <span className="xs t3 hide-phone" aria-live="polite">
          {saveText}
        </span>
        {publishing ? (
          <Button busy>{publishing === "evaluating" ? "Checking answers…" : "Publishing…"}</Button>
        ) : upToDate ? (
          <span className="status medium text-success">
            <Icon name="check-circle" size={18} />
            Published
          </span>
        ) : (
          <Button onClick={() => void publish()}>{live ? "Publish" : "Publish first version"}</Button>
        )}
        <div className="only-phone" style={{ width: "100%" }}>
          <Tabs<AssistantTab> scroll label="Assistant sections" value={tab} onChange={onTab} options={[{ value: "test", label: "Test" }, ...editorTabs]} />
        </div>
      </header>

      <div className="builder-main">
        <section className={`editor${tab === "test" ? " is-hidden-phone" : ""}`} aria-label="Configure">
          <div className="editor-tabs only-desktop">
            <Tabs<EditorTab> label="Configure" value={editorTab} onChange={onTab} options={editorTabs} />
          </div>
          <div className="editor-scroll">
            <div className="editor-inner">
              {publishFailure && (
                <Alert
                  tone="danger"
                  title={publishFailure.fromFix ? "An answer you fixed is wrong again" : "Not published — an answer needs fixing"}
                  text={`“${publishFailure.input}”: ${publishFailure.problem}. ${live ? `Customers still see version ${live.version}.` : "Nothing is live yet."}`}
                  actions={
                    <>
                      {publishFailure.input && (
                        <Button variant="outline" size="sm" onClick={() => startPublishFix({ origin: "test", customerMessage: publishFailure.input, badReply: readable(publishFailure.reply) })}>
                          Fix this answer
                        </Button>
                      )}
                      {live && !agent.draftMatchesLive && (
                        <Button variant="danger-ghost" size="sm" onClick={() => setDiscarding("ask")}>
                          Discard unpublished changes
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setPublishFailure(null)}>
                        Dismiss
                      </Button>
                    </>
                  }
                />
              )}
              {saveFailed && (
                <Alert
                  tone="warning"
                  title="Your last change isn't saved yet"
                  text="We keep trying. Your edits stay on this page until the connection is back."
                  actions={
                    <Button variant="outline" size="sm" onClick={() => void save()}>
                      Try again
                    </Button>
                  }
                />
              )}
              {error && <Alert tone="danger" title="Couldn't publish" text={`${error}. Customers still see the current version.`} onClose={() => setError("")} />}
              {missing.length > 0 && (
                <Alert
                  tone="warning"
                  title={missing.length === 1 ? missing[0].text : "A few things before customers can use it"}
                  text={missing.length > 1 ? missing.map((item) => item.text).join(" ") : undefined}
                  actions={missing.map((item) => (
                    <Button key={item.action} variant="outline" size="sm" onClick={item.go}>
                      {item.action}
                    </Button>
                  ))}
                />
              )}
              {editorTab === "instructions" && <InstructionsTab agent={agent} mutate={mutate} rename={rename} />}
              {editorTab === "sources" && (
                <SourcesTab
                  agent={agent}
                  collections={collections.filter((collection) => !collection.archived_at || agent.draft.collectionBindings.some((item) => item.collectionId === collection.id))}
                  mutate={mutate}
                  reload={load}
                  onManageData={() => navigate("data")}
                />
              )}
              {editorTab === "followups" && <FollowUpsTab agentId={agent.id} draft={agent.draft} mutate={mutate} onPreview={(text, step) => setInjected({ text, step, at: Date.now() })} />}
              {editorTab === "behavior" && <BehaviorTab draft={agent.draft} mutate={mutate} hasZernio={hasZernio} />}
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
          </div>
        </section>
        <PreviewPane agent={agent} collections={collections} flush={flush} reload={load} navigate={navigate} injected={injected} hiddenOnPhone={tab !== "test"} />
      </div>

      {discarding && live && (
        <Dialog
          title="Discard unpublished changes?"
          text={`Instructions, knowledge choices and corrected answers go back to version ${live.version}, what customers see now. Data tables aren't changed.`}
          confirmLabel="Discard"
          destructive
          busy={discarding === "busy"}
          onCancel={() => setDiscarding(null)}
          onConfirm={async () => {
            setDiscarding("busy");
            try {
              await post(`/api/admin/agents/${agentId}/discard`);
              setPublishFailure(null);
              await load();
              toast(`Back to version ${live.version}`);
            } catch (caught) {
              toast(errorMessage(caught, "Couldn't discard the changes"), "error");
            } finally {
              setDiscarding(null);
            }
          }}
        />
      )}
      {publishFixSheet}
    </div>
  );
}

// What a failed check means, in the owner's words.
function plainProblem(failures: string[]) {
  const first = failures[0] ?? "";
  const quoted = (prefix: string) => first.slice(prefix.length).trim();
  if (first.startsWith("Missing: ")) return `the reply no longer says “${quoted("Missing: ")}”`;
  if (first.startsWith("Forbidden: ")) return `the reply says “${quoted("Forbidden: ")}”, which it shouldn't`;
  if (first.startsWith("Longer than")) return `the reply is too long (${first.replace(/^Longer than (\d+) sentences \((\d+)\)$/, "$2 sentences, limit $1")})`;
  if (first.startsWith("Tool not called")) return "the reply didn't check your Data first";
  if (first.startsWith("Didn't meet: ")) return quoted("Didn't meet: ");
  if (first.startsWith("Not checked")) return "the answer couldn't be checked this time; try Publish again";
  if (first === "The assistant couldn't answer") return "the assistant couldn't answer";
  return first || "the reply doesn't match what you set";
}

function AssistantSkeleton() {
  return (
    <div className="builder" aria-busy="true" aria-label="Loading">
      <header className="builder-bar">
        <span className="skel" style={{ width: 28, height: 28, borderRadius: 8 }} />
        <span className="stack spacer" style={{ gap: 6 }}>
          <SkeletonLine width={180} height={14} />
          <SkeletonLine width={240} height={10} />
        </span>
      </header>
      <div className="builder-main">
        <section className="editor">
          <div className="editor-scroll">
            <div className="editor-inner">
              <div className="stack" style={{ gap: 20 }}>
                <SkeletonLine width="30%" />
                <span className="skel" style={{ height: 36 }} />
                <SkeletonLine width="25%" />
                <span className="skel" style={{ height: 88 }} />
                <SkeletonLine width="35%" />
                <span className="skel" style={{ height: 64 }} />
              </div>
            </div>
          </div>
        </section>
        <section className="preview is-hidden-phone">
          <div className="chat">
            <span className="skel" style={{ alignSelf: "flex-end", width: "60%", height: 40, borderRadius: 20 }} />
            <span className="skel" style={{ height: 96 }} />
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
      <section className="stack" style={{ gap: 16 }}>
        <div className="field-grid">
          <Field label="Name">
            <TextInput value={agent.name} onChange={(event) => rename("name", event.target.value)} />
          </Field>
          <Field label="Business name">
            <TextInput value={profile.businessName} onChange={(event) => setProfile({ businessName: event.target.value })} placeholder="Acme Furniture" />
          </Field>
        </div>
        <Field label="Description" hint="Only you see this. Customers see the business name.">
          <TextInput value={agent.description} onChange={(event) => rename("description", event.target.value)} placeholder="What this assistant is for" />
        </Field>
      </section>

      <section className="stack" style={{ gap: 16 }}>
        <h2 className="section-title">Your business</h2>
        <Field label="What you offer">
          <TextArea rows={2} value={profile.offering} onChange={(event) => setProfile({ offering: event.target.value })} placeholder="Products or services you sell, and who they are for" />
        </Field>
        <Field label="Contact and hours">
          <TextArea rows={2} value={profile.contactInfo} onChange={(event) => setProfile({ contactInfo: event.target.value })} placeholder="Phone, email, address, opening hours" />
        </Field>
        <Field label="Website">
          <TextInput type="url" value={profile.website} onChange={(event) => setProfile({ website: event.target.value })} placeholder="https://" />
        </Field>
        <p className="help">Facts that rarely change. Prices, offers and stock belong in Data so they stay current.</p>
      </section>

      <section className="stack" style={{ gap: 16 }}>
        <h2 className="section-title">How it works</h2>
        <Field label="Its job" hint="What it should do for customers, and what a good conversation ends with.">
          <TextArea rows={2} value={profile.job} onChange={(event) => setProfile({ job: event.target.value })} placeholder="Answer questions, recommend the right product and collect contact details when the customer is ready to buy." />
        </Field>
        <Field label="Voice and style" hint="It always replies in the customer's language.">
          <TextArea rows={2} value={profile.voice} onChange={(event) => setProfile({ voice: event.target.value })} placeholder="Warm and polite, short messages, one question at a time." />
        </Field>
      </section>

      <RuleSection title="Always" hint="One rule per line" addLabel="Add a rule" placeholder="Check Data before stating a price or offer" value={profile.alwaysDo} onChange={(alwaysDo) => setProfile({ alwaysDo })} />
      <RuleSection title="Never" hint="One rule per line" addLabel="Add a rule" placeholder="Invent prices, discounts or delivery dates" value={profile.neverDo} onChange={(neverDo) => setProfile({ neverDo })} />
      <RuleSection
        title="Hand off to a person when"
        hint="Someone from the team follows up"
        addLabel="Add a reason"
        placeholder="The customer has a complaint or asks for a person"
        value={profile.handoffWhen}
        onChange={(handoffWhen) => setProfile({ handoffWhen })}
      />
      <RuleSection
        title="Contact details to collect"
        hint="Asked when they want a quote or a person"
        addLabel="Add a detail"
        placeholder="Phone number"
        value={profile.collectDetails}
        onChange={(collectDetails) => setProfile({ collectDetails })}
      />

      <section className="stack" style={{ gap: 16 }}>
        <h2 className="section-title">Privacy notice</h2>
        <Field label="Said once, before it first asks for contact details" hint="Saved with each contact as proof of what they were told.">
          <TextArea rows={2} value={profile.consentNotice} onChange={(event) => setProfile({ consentNotice: event.target.value })} placeholder="We only use your phone number to send your quote and follow up on this request." />
        </Field>
      </section>

      <section className="stack" style={{ gap: 16 }}>
        <h2 className="section-title">When something goes wrong</h2>
        <Field label="Fallback reply" hint="Sent only if the AI is unavailable or takes too long.">
          <TextArea rows={1} value={draft.responsePolicy.fallbackMessage} onChange={(event) => setPolicy({ fallbackMessage: event.target.value })} />
        </Field>
      </section>

      <section className="card">
        <Disclosure
          title={
            <>
              Detailed playbook <span className="t3" style={{ fontWeight: 400 }}>· advanced</span>
            </>
          }
          detail={plural(draft.instructions.length, "character").replace(/^\d+/, (n) => Number(n).toLocaleString("en-US"))}
        >
          <Field label="Detailed playbook" hideLabel hint="When it disagrees with the fields above, the fields above win.">
            <TextArea mono spellCheck={false} value={draft.instructions} onChange={(event) => mutate((current) => ({ ...current, instructions: event.target.value }))} placeholder="Optional. Long-form guidance, written in Markdown." />
          </Field>
        </Disclosure>
        <Disclosure
          title={
            <>
              Model and reply length <span className="t3" style={{ fontWeight: 400 }}>· advanced</span>
            </>
          }
        >
          <div className="field-grid narrow">
            <Field label="Model">
              <Select value={draft.modelConfig.model} onChange={(event) => setModel({ model: event.target.value as AnthropicModel })}>
                {modelOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label} — {option.note}
                  </option>
                ))}
              </Select>
            </Field>
            {sampling && (
              <Field label="Temperature">
                <TextInput className="tabular" type="number" min={0} max={1} step={0.1} value={draft.modelConfig.temperature} onChange={(event) => setModel({ temperature: Number(event.target.value) })} />
              </Field>
            )}
            <Field label="Max tokens">
              <TextInput className="tabular" type="number" min={128} max={8192} step={128} value={draft.modelConfig.maxTokens} onChange={(event) => setModel({ maxTokens: Number(event.target.value) })} />
            </Field>
            <Field label="Max reply length" hint="Characters">
              <TextInput className="tabular" type="number" min={100} max={8000} value={draft.responsePolicy.maxLength} onChange={(event) => setPolicy({ maxLength: Number(event.target.value) })} />
            </Field>
          </div>
        </Disclosure>
      </section>
    </>
  );
}

// One field per rule; Enter adds the next one, Backspace on an empty rule removes it.
function RuleSection({
  title,
  hint,
  addLabel,
  placeholder,
  value,
  onChange,
}: {
  title: string;
  hint: string;
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
    <section className="stack" style={{ gap: 8 }}>
      <div className="section-head">
        <h2 className="section-title spacer">{title}</h2>
        <span className="xs t3">{hint}</span>
      </div>
      {rules.map((rule, index) => (
        <div className="rule-row" key={index}>
          <input
            ref={(node) => {
              inputs.current[index] = node;
            }}
            className="input"
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
              if (!rule.trim() && !next?.closest?.(".rule-row")) remove(index);
            }}
          />
          <Button variant="ghost" size="sm" icon="x" aria-label={`Remove ${title.toLowerCase()} rule ${index + 1}`} onClick={() => remove(index)} />
        </div>
      ))}
      <Button variant="ghost" size="sm" icon="plus" style={{ alignSelf: "flex-start", marginLeft: -8 }} onClick={() => insert(rules.length)}>
        {addLabel}
      </Button>
    </section>
  );
}

// ---------- Sources ----------

function SourcesTab({ agent, collections, mutate, reload, onManageData }: { agent: AgentDetail; collections: Collection[]; mutate: Mutate; reload: () => Promise<void>; onManageData: () => void }) {
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
      <Card
        title="Knowledge"
        action={
          agent.sources.length > 0 || corrected.length > 0 ? (
            <Button variant="outline" size="sm" icon="plus" onClick={() => setAdding(true)}>
              Add
            </Button>
          ) : undefined
        }
        footer="For explanations that rarely change: policies, guides, FAQs. Answers you fix land in Corrected answers."
      >
        {corrected.length > 0 && <Row compact icon="chat" tone="success" title="Corrected answers" subtitle={`${plural(corrected.length, "answer")} you fixed`} onClick={() => setShowCorrected(true)} chevron />}
        {agent.sources.length === 0 && corrected.length === 0 ? (
          <EmptyState
            icon="book"
            title="No knowledge yet"
            text="Add your policies, buying guides or a web page. The assistant reads them before it answers."
            action={<Button onClick={() => setAdding(true)}>Add knowledge</Button>}
          />
        ) : (
          agent.sources.map((source) => {
            const failed = source.status === "failed";
            const processing = source.status === "pending" || source.status === "processing";
            return (
              <div className="row compact" key={source.id}>
                <Tile icon={source.type === "url" ? "globe" : "document"} tone={failed ? "danger" : "default"} />
                <button type="button" className="row-text row-open" onClick={() => setEditing(source)}>
                  <span className="row-title">{source.name}</span>
                  <span className={`row-sub xs${failed ? " text-danger" : ""}`}>{failed ? source.error || "Couldn't read this source" : processing ? "Reading it now…" : updatedLabel(source.updated_at)}</span>
                </button>
                {failed && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await post(`/api/admin/knowledge/${source.id}/retry`);
                      toast("Reading the source again");
                      await reload();
                    }}
                  >
                    Retry
                  </Button>
                )}
                <Switch label={`Use ${source.name}`} checked={agent.draft.knowledgeSourceIds.includes(source.id)} onChange={(on) => toggleSource(source.id, on)} />
              </div>
            );
          })
        )}
      </Card>

      <Card
        title="Data it can look up"
        action={
          <Button variant="ghost" size="sm" onClick={onManageData}>
            Manage in Data
          </Button>
        }
        footer="It always checks these before talking about prices, offers or stock. Ended or switched-off rows are never used."
      >
        {collections.length === 0 ? (
          <Row compact icon="table" title="No tables yet" subtitle="Add one in Data." />
        ) : (
          collections.map((collection) => (
            <div className="row compact" key={collection.id}>
              <Tile icon="table" />
              <span className="row-text">
                <span className="row-title">{collection.name}</span>
                <span className="row-sub xs truncate">{collection.description || plural(collection.record_count ?? 0, "row")}</span>
              </span>
              <Switch label={`Look up ${collection.name}`} checked={agent.draft.collectionBindings.some((item) => item.collectionId === collection.id)} onChange={(on) => bindCollection(collection, on)} />
            </div>
          ))
        )}
      </Card>

      <section className="card">
        <Disclosure
          title={
            <>
              Live lookups <span className="t3" style={{ fontWeight: 400 }}>· advanced</span>
            </>
          }
          detail={agent.tools.length ? String(agent.tools.length) : "None"}
        >
          <p className="help">Read-only checks against your own systems, such as live stock. The assistant can never change anything outside.</p>
          {agent.tools.map((tool) => (
            <div className="row compact flush" key={tool.id}>
              <Tile icon={tool.kind === "http_get" ? "globe" : "bolt"} />
              <span className="row-text">
                <span className="row-title">{tool.name}</span>
                <span className="row-sub xs truncate">{tool.description}</span>
              </span>
              <Switch label={`Use ${tool.name}`} checked={agent.draft.toolBindings.includes(tool.name)} onChange={(on) => bindTool(tool.name, on)} />
            </div>
          ))}
          <Button variant="ghost" size="sm" icon="plus" style={{ alignSelf: "flex-start", marginLeft: -8 }} onClick={() => setAddingTool(true)}>
            Add a lookup
          </Button>
        </Disclosure>
      </section>

      {showCorrected && (
        <Sheet title="Corrected answers" subtitle="Part of the draft · publish to send changes to customers" onClose={() => setShowCorrected(false)} footer={<Button onClick={() => setShowCorrected(false)}>Done</Button>}>
          {corrected.length === 0 ? (
            <EmptyState icon="chat" title="No corrected answers" text="Answers you fix with Fix this answer show up here." />
          ) : (
            <>
              <div className="card">
                {corrected.map((item, index) => (
                  <div className="row top" key={item.fixId ?? index}>
                    <span className="row-text">
                      <span className="row-title">{item.question}</span>
                      <span className="row-sub">{item.answer}</span>
                    </span>
                    <Button variant="danger-ghost" size="sm" onClick={() => mutate((current) => ({ ...current, correctedAnswers: (current.correctedAnswers ?? []).filter((_, i) => i !== index) }))}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
              <p className="help">Removing one also removes it from the draft; its answer check stays until you delete it.</p>
            </>
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
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-knowledge" busy={busy} disabled={!name || !content}>
            Add
          </Button>
        </>
      }
    >
      <form id="add-knowledge" onSubmit={submit} className="sheet-form">
        <div style={{ alignSelf: "flex-start" }}>
          <Segmented label="Source type" value={kind} onChange={setKind} options={[{ value: "text", label: "Text" }, { value: "url", label: "Web page" }]} />
        </div>
        <Field label="Title">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="Warranty policy" required data-autofocus />
          </Field>
          {kind === "url" ? (
            <Field label="Address">
              <TextInput type="url" value={content} onChange={(event) => setContent(event.target.value)} placeholder="https://" required />
            </Field>
          ) : (
            <Field label="Content">
              <TextArea rows={6} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Paste text or Markdown" required />
            </Field>
          )}
          <p className="help">{kind === "url" ? "One HTTPS page; linked pages are not followed." : "Paste text or Markdown. Changes go into the draft; publish to make them live."}</p>
        {error && <Alert tone="error" title="Couldn't add it" text={error} />}
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
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-tool" busy={busy} disabled={!tool.name || !tool.description || (tool.kind === "http_get" && !tool.urlTemplate)}>
            Add
          </Button>
        </>
      }
    >
      <form id="add-tool" className="sheet-form" onSubmit={submit}>
        <div style={{ alignSelf: "flex-start" }}>
          <Segmented label="Lookup type" value={tool.kind} onChange={(kind) => setTool({ ...tool, kind })} options={[{ value: "http_get", label: "Web address" }, { value: "plugin", label: "Built-in" }]} />
        </div>
        <Field label="Name">
            <TextInput value={tool.name} placeholder="check_stock" onChange={(event) => setTool({ ...tool, name: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} required />
          </Field>
          <Field label="When to use it">
            <TextArea rows={1} value={tool.description} onChange={(event) => setTool({ ...tool, description: event.target.value })} required />
          </Field>
          {tool.kind === "http_get" ? (
            <Field label="Address">
              <TextInput type="url" value={tool.urlTemplate} placeholder="https://api.example.com/search?q={query}" onChange={(event) => setTool({ ...tool, urlTemplate: event.target.value })} required />
            </Field>
          ) : (
            <Field label="Lookup">
              <Select value={tool.pluginId} onChange={(event) => setTool({ ...tool, pluginId: event.target.value })}>
                <option value="normalize_contact">Tidy contact details</option>
                <option value="active_at">Check a date range</option>
              </Select>
            </Field>
          )}
          {tool.kind === "http_get" && <p className="help">Use {"{query}"} in the address for the search words. Public HTTPS only.</p>}
        {error && <Alert tone="error" title="Couldn't add it" text={error} />}
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
      <Card title="Versions" footer="Each version is a frozen copy. Chats in progress keep the version they started with; restoring affects new chats only.">
        {agent.versions.length === 0 ? (
          <EmptyState icon="history" title="No versions yet" text="Publish the draft to make it live. Every publish is saved here so you can go back." />
        ) : (
          <>
            {unpublished && <Row icon="edit" tone="warning" title="Draft" subtitle={saving ? "Unpublished changes · saving…" : "Unpublished changes · saved"} accessory={<Badge tone="warning">Not live</Badge>} />}
            {agent.versions.map((version) => {
              const live = version.id === agent.active_version_id;
              return (
                <Row
                  key={version.id}
                  icon="clock"
                  tone={live ? "success" : "default"}
                  title={`Version ${version.version}`}
                  subtitle={formatDate(version.published_at)}
                  accessory={
                    live ? (
                      <Badge tone="success">Live</Badge>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => setConfirm(version)}>
                        Restore
                      </Button>
                    )
                  }
                />
              );
            })}
          </>
        )}
      </Card>
      {confirm && (
        <Dialog
          title={`Restore version ${confirm.version}?`}
          text={`New chats use version ${confirm.version} right away. Chats already in progress keep their version, and your draft doesn't change.`}
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
  navigate,
  injected,
  hiddenOnPhone,
}: {
  injected?: { text: string; step: number; at: number } | null;
  hiddenOnPhone?: boolean;
  agent: AgentDetail;
  collections: Collection[];
  flush: () => Promise<boolean>;
  reload: () => Promise<void>;
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
  // Mirrors the channel: Seen under the customer's message, typing dots, then the reply part by part.
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const toast = useToast();
  const scroller = useRef<HTMLDivElement>(null);
  const { startFix, fixSheet } = useFixAnswer({ agentId: agent.id, onChanged: reload, onOpenSettings: () => navigate("settings") });
  // "Show in Preview" from the Follow-ups tab: the step text appears as the assistant's next message (nothing is sent).
  useEffect(() => {
    if (!injected) return;
    setTurns((current) => [...current, { role: "assistant" as const, text: injected.text, at: new Date().toISOString(), last: true }]);
    toast(`Follow-up ${injected.step} added to Preview`);
  }, [injected?.at]);
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
    const sentAt = new Date().toISOString();
    const behavior = agent.draft.behavior;
    setTurns((current) => [...current, { role: "user", text: message, at: sentAt }]);
    setSeenAt(null);
    setBusy(true);
    const seen = behavior.markSeen ? setTimeout(() => setSeenAt(sentAt), 350) : undefined;
    const showTyping = behavior.typing ? setTimeout(() => setTyping(true), 600) : undefined;
    try {
      const result = await post<AgentResult>(`/api/admin/agents/${agent.id}/preview`, { text: message, conversationId });
      // Plain-text replies split into short messages; structured replies already arrive as parts.
      const texts = result.messages.flatMap((item) =>
        behavior.splitReplies && !item.text.trim().startsWith("{") ? splitParts([{ kind: "text", text: item.text }]).map((part) => (part.kind === "text" ? part.text : "")) : [item.text],
      );
      for (let index = 0; index < texts.length; index++) {
        const wait = index > 0 ? paceDelay(behavior.pace, { kind: "text", text: texts[index] }) : 0;
        if (wait) {
          setTyping(behavior.typing);
          await new Promise((resolve) => setTimeout(resolve, wait));
        }
        setTyping(false);
        const at = new Date().toISOString();
        setTurns((current) => [...current, { role: "assistant" as const, text: texts[index], at, result, last: index === texts.length - 1 }]);
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      clearTimeout(seen);
      clearTimeout(showTyping);
      setTyping(false);
      setBusy(false);
    }
  }
  const starters = agent.evalCases.length ? agent.evalCases.slice(0, 3).map((item) => item.input) : fallbackStarters;
  const replyText = (result?: AgentResult) =>
    turns
      .filter((turn) => turn.result && turn.result === result)
      .flatMap((turn) => parseRichMessage(turn.text).map((part) => part.text ?? ""))
      .filter(Boolean)
      .join("\n");

  return (
    <section className={`preview${hiddenOnPhone ? " is-hidden-phone" : ""}`} aria-labelledby={titleId}>
      <div className="preview-head">
        <h2 id={titleId} style={{ margin: 0, font: "var(--text-heading-xs)" }}>
          Preview
        </h2>
        <Badge>Draft</Badge>
        <span className="spacer" />
        <Button
          variant="ghost"
          size="sm"
          icon="compose"
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
      <div className="preview-scroll" ref={scroller}>
        {turns.length === 0 && !busy ? (
          <div className="empty" style={{ paddingTop: 56 }}>
            <AgentAvatar id={agent.id} name={agent.name} size="lg" />
            <h3 className="empty-title" style={{ marginTop: 8 }}>
              {agent.name}
            </h3>
            <p className="empty-text">Chat like a customer. Tap a reply to see what it read, and fix it if it’s wrong.</p>
            <div className="stack starters">
              {starters.map((starter) => (
                <button type="button" key={starter} className="btn btn-outline starter" onClick={() => void ask(starter)}>
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
                    <RichBubbles side="customer" text={turn.text} />
                    {seenAt === turn.at && <span className="seen">Seen</span>}
                  </ChatGroup>
                );
              const requestId = turn.result?.requestId ?? key;
              const open = openId === requestId;
              const trace = turn.result?.trace;
              return (
                <ChatGroup key={key} separator={separator}>
                  <div className={`msg-ai${open ? " is-selected" : ""}`}>
                    <RichBubbles side="assistant" text={turn.text} />
                    {turn.last && trace && (
                      <ReplyDetails
                        trace={trace}
                        open={open}
                        copyText={replyText(turn.result)}
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
                  </div>
                </ChatGroup>
              );
            })}
            {busy &&
              (typing ? (
                <TypingDots />
              ) : (
                !agent.draft.behavior.typing && (
                  <span className="row-flex xs t3" role="status">
                    <Spinner label="Writing a reply" />
                    Writing a reply…
                  </span>
                )
              ))}
          </div>
        )}
        {error && (
          <div style={{ padding: "0 16px 16px" }}>
            <Alert tone="danger" title="No reply" text={`${error}. Nothing was sent to customers.`} onClose={() => setError("")} />
          </div>
        )}
      </div>
      <div className="composer-wrap">
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
            <Icon name="arrow-up" size={18} />
          </button>
        </form>
      </div>
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
  copyText,
  toggle,
  collectionFor,
  titleKeyFor,
  openSource,
  openRecord,
  onFix,
}: {
  trace: NonNullable<AgentResult["trace"]>;
  open: boolean;
  copyText: string;
  toggle: () => void;
  collectionFor: (toolName: string) => Collection | undefined;
  titleKeyFor: (toolName: string) => string | undefined;
  openSource: (id: string) => void;
  openRecord: (toolName: string, recordId: string) => void;
  onFix: () => void;
}) {
  const toast = useToast();
  const sources = trace.sources.filter((source, index, all) => all.findIndex((item) => item.name === source.name) === index);
  const lookups = trace.toolCalls.map((call) => ({ call, rows: Array.isArray(call.output) ? (call.output as TracedRecord[]) : [] }));
  const rowCount = lookups.reduce((total, item) => total + item.rows.length, 0);
  const summary = [sources.length && plural(sources.length, "source"), lookups.length && plural(rowCount, "row")].filter(Boolean).join(" · ") || "No sources";
  const seconds = Math.max(1, Math.round(trace.latencyMs / 1000));
  return (
    <>
      <div className="msg-actions">
        <button
          type="button"
          className="msg-action"
          aria-label="Copy reply"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(copyText);
              toast("Copied");
            } catch {
              toast("Couldn't copy. Select the text and copy it.", "error");
            }
          }}
        >
          <Icon name="copy" size={16} />
        </button>
        <MetaChip expanded={open} onClick={toggle}>
          {summary}
        </MetaChip>
        <button type="button" className="msg-action" onClick={onFix}>
          <Icon name="wrench" size={16} />
          Fix this answer
        </button>
      </div>
      {open && (
        <DetailsCard title="What this reply used" sub={`Answered in ${plural(seconds, "second")}${sources.length || rowCount ? " · select a source or row to edit it" : ""}`}>
          {sources.length > 0 && (
            <MiniList
              label="Knowledge read"
              items={sources.map((source, index) => ({
                key: `${source.name}-${index}`,
                label: source.name,
                icon: "document",
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
                      wrap: true,
                      onClick: record.record_id ? () => openRecord(call.name, String(record.record_id)) : undefined,
                    }))
                  : [{ key: "none", label: "Nothing matched", icon: "search" }]
              }
            />
          ))}
          {trace.error && <p className="xs text-danger" style={{ margin: 0 }}>{trace.error}</p>}
        </DetailsCard>
      )}
    </>
  );
}

// ---------- Test scenarios (bottom of the Preview) ----------

type Assertions = { criteria?: string; expectedTool?: string; mustInclude?: string[]; mustNotInclude?: string[]; maxLength?: number; fromFix?: string };

// Settings › Answer checks (advanced): every saved check, run on demand.
export function AnswerChecks({ agentId }: { agentId: string }) {
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [run, setRun] = useState<EvalRun | null>(null);
  const [open, setOpen] = useState(false);
  const load = async () => setAgent(await api<AgentDetail>(`/api/admin/agents/${agentId}`));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);
  if (!agent) return <Skeleton rows={2} card={false} />;
  return <ScenarioBar agent={agent} flush={async () => true} reload={load} run={run} setRun={setRun} open={open} setOpen={setOpen} />;
}

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
      const result = await post<EvalRun>(`/api/admin/agents/${agent.id}/evaluate?scope=all`);
      setRun(result);
      const failed = result.results.filter((item) => !item.passed).length;
      toast(failed ? `${plural(failed, "answer")} need fixing` : `All ${plural(result.results.length, "answer")} are right`, failed ? "error" : "default");
    } catch (caught) {
      toast(errorMessage(caught, "Couldn't check the answers"), "error");
    } finally {
      setBusy(false);
    }
  }
  const summary = busy ? (
    <span className="xs t3">Running…</span>
  ) : !cases.length ? (
    <span className="xs t3">None yet</span>
  ) : !ran.length ? null : failing ? (
    <Badge tone="danger">
      {failing} of {cases.length} failing
    </Badge>
  ) : (
    <Badge tone="success">
      {ran.length} of {cases.length} passed
    </Badge>
  );
  return (
    <div className="scen">
      <div className="row-flex" style={{ paddingRight: 8 }}>
        <button type="button" className="scen-toggle" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(!open)}>
          <Icon name="chevron-right" className="chev" size={16} />
          {plural(cases.length, "check")}
          {summary}
        </button>
        {cases.length > 0 && (
          <Button variant="ghost" size="sm" icon="play" busy={busy} onClick={() => void evaluate()}>
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
                <span className="spacer stack" style={{ gap: 0 }}>
                  <span className="row-flex">
                    <span className="medium truncate">{testCase.name}</span>
                    {Boolean(testCase.critical) && <Badge tone="outline">Required</Badge>}
                    {assertions.fromFix && <Badge>From a fix</Badge>}
                  </span>
                  <span className="xs t3 truncate">{[`“${testCase.input}”`, ...rules].join(" · ")}</span>
                  {result && !result.passed && <span className="xs text-danger">{result.failures.join(", ") || "Didn't pass"}</span>}
                </span>
                {result && (result.passed ? <Badge tone="success">Passed</Badge> : result.failures.length > 0 && result.failures.every((item) => item.startsWith("Not checked")) ? <Badge>Not checked</Badge> : <Badge tone="danger">Failed</Badge>)}
              </button>
            );
          })}
          <Button variant="ghost" size="sm" icon="plus" style={{ margin: "6px 0 0 -8px" }} onClick={() => setEditing("new")}>
            Add a check
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
        title={existing ? existing.name : "Add an answer check"}
        subtitle="Publish runs the required ones first; they must pass"
        onClose={onClose}
        footer={
          <>
            {existing && fix?.undoable ? (
              <Button variant="danger-ghost" onClick={() => setUndo({ reason: "", busy: false })}>
                Undo fix
              </Button>
            ) : (
              existing && (
                <Button variant="danger-ghost" onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              )
            )}
            <span className="spacer" />
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="scenario" busy={busy} disabled={!form.name || !form.input}>
              {existing ? "Save" : "Add"}
            </Button>
          </>
        }
      >
        <form id="scenario" className="sheet-form" onSubmit={submit}>
          <Field label="Name">
            <TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Never invent a price" required data-autofocus={existing ? undefined : true} />
          </Field>
          <Field label="Customer message">
            <TextArea rows={1} value={form.input} onChange={(event) => setForm({ ...form, input: event.target.value })} required />
          </Field>
          <Field label="Passes when" hint="Write it the way you'd tell a new hire. The AI checks each reply against it, so wording can differ.">
            <TextArea rows={2} value={form.criteria} onChange={(event) => setForm({ ...form, criteria: event.target.value })} placeholder="Says returns cost 20% and asks for the order number" />
          </Field>
          <SettingRow title="Required to publish" sub="Publish checks the required ones first">
            <Switch label="Required to publish" checked={form.critical} onChange={(critical) => setForm({ ...form, critical })} />
          </SettingRow>
          <section className="card">
            <Disclosure title={<>Exact words and lookups <span className="t3" style={{ fontWeight: 400 }}>· advanced</span></>} defaultOpen={Boolean(form.mustInclude || form.mustNotInclude || form.expectedTool || form.maxLength) && !form.criteria}>
              <p className="help">Exact checks. Separate several phrases with commas.</p>
              <Field label="Says">
                <TextInput value={form.mustInclude} onChange={(event) => setForm({ ...form, mustInclude: event.target.value })} />
              </Field>
              <Field label="Never says">
                <TextInput value={form.mustNotInclude} onChange={(event) => setForm({ ...form, mustNotInclude: event.target.value })} />
              </Field>
              <Field label="Checks Data" hint="Lookup name">
                <TextInput value={form.expectedTool} placeholder="search_products" onChange={(event) => setForm({ ...form, expectedTool: event.target.value })} />
              </Field>
              <Field label="Max length" hint="Characters">
                <TextInput className="tabular" type="number" min={1} value={form.maxLength} onChange={(event) => setForm({ ...form, maxLength: event.target.value })} />
              </Field>
            </Disclosure>
          </section>
          {error && <Alert tone="error" title="Couldn't save it" text={error} />}
        </form>
      </Sheet>
      {undo && (
        <Dialog
          title="Undo this fix?"
          text={
            <>
              {fix?.target_kind === "data" ? "The data row goes back to its old value right away." : "The added answer or rule is removed from your changes."} This check is removed too.
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
        <Dialog
          title="Delete this check?"
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
      drawer
      title={source.name}
      subtitle={isUrl ? "Web page · changes go into the draft" : `Knowledge · ${updatedLabel(source.updated_at)}`}
      onClose={onClose}
      footer={
        <>
          {isUrl && (
            <Button
              variant="ghost"
              onClick={async () => {
                await post(`/api/admin/knowledge/${source.id}/retry`);
                onDone("Reading the page again");
              }}
            >
              Read the page again
            </Button>
          )}
          <span className="spacer" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-knowledge" busy={busy} disabled={!name.trim() || text === null}>
            Save
          </Button>
        </>
      }
    >
      <form id="edit-knowledge" className="sheet-form" onSubmit={save}>
          <Field label="Title">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} required />
          </Field>
          {!isUrl && (
            <Field label="Content">
              {text === null ? (
                <span className="stack" style={{ gap: 8 }}>
                  <SkeletonLine width="90%" />
                  <SkeletonLine width="75%" />
                  <SkeletonLine width="60%" />
                </span>
              ) : (
                <TextArea rows={10} value={text} onChange={(event) => setText(event.target.value)} />
              )}
            </Field>
          )}
          <p className="help">{isUrl ? "Web pages update when the page is read again." : "Saving new text re-reads this source; replies use it after a minute."}</p>
        {error && <Alert tone="error" title="Couldn't save it" text={error} />}
      </form>
    </Sheet>
  );
}
