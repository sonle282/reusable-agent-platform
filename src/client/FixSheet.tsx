import { useCallback, useState, type ReactNode } from "react";
import { post } from "./api";
import { maskContact } from "../shared/mask";
import { publishWithChecks } from "./publish";
import { parseRichMessage } from "./RichMessage";
import { Alert, Badge, Button, Card, Dialog, Diff, errorMessage, Icon, Segmented, Sheet, Spinner, Steps, TextArea, useToast } from "./ui";

type Kind = "data" | "knowledge" | "rule";
type RuleSection = "alwaysDo" | "neverDo" | "handoffWhen";

export type FixInput = {
  origin: "test" | "conversation" | "attention";
  conversationId?: string;
  customerMessage: string;
  badReply: string;
  lookups?: Array<{ toolName: string; recordId: string }>;
  correctReply?: string;
  fixId?: string;
};

type Suggestion = {
  recommended: Kind;
  reason: string;
  name: string;
  checks: { mustInclude: string[]; mustNotInclude: string[] };
  data: null | { collectionId: string; collectionName: string; toolName: string; recordId: string; recordTitle: string; field: string; fieldLabel: string; before: string; after: string };
  knowledge: { question: string; answer: string };
  rule: { section: RuleSection; line: string };
  aiError?: "no_key" | "failed";
};
type Outcome = { state: "running" } | { state: "pass"; reply: string; scenario: string } | { state: "fail"; reply: string; failures: string[] };
export type FixFinished = { kind: Kind; kept?: boolean };

const sectionLabel: Record<RuleSection, string> = { alwaysDo: "Always", neverDo: "Never", handoffWhen: "Hand off to a person when" };
const places: Record<Kind, { title: string; tile: string; icon: string; choice: string }> = {
  data: { title: "Update a row in Data", tile: "soft-green", icon: "table", choice: "Update the row it looked up" },
  knowledge: { title: "Add to Corrected answers", tile: "soft-indigo", icon: "check-bubble", choice: "Save the question and the right answer" },
  rule: { title: "Add a line to Instructions", tile: "soft-orange", icon: "sparkles", choice: "A rule for every conversation" },
};
const stepLabels = ["What it should say", "Where to fix it", "Result"];

// Assistants may reply with a structured channel payload; show only the text a customer would read.
// The server joins several messages with new lines, so try the whole reply first, then each line.
export function readable(value: string) {
  const textOf = (chunk: string) =>
    parseRichMessage(chunk)
      .map((part) => part.text ?? "")
      .filter(Boolean)
      .join("\n");
  const whole = textOf(value);
  if (whole !== value || !value.includes('"content"')) return whole.trim() || value;
  return (
    value
      .split("\n")
      .map(textOf)
      .filter(Boolean)
      .join("\n")
      .trim() || value
  );
}

function friendlyFailure(failures: string[]) {
  const first = failures[0] ?? "";
  if (first === "The assistant couldn't answer") return "The draft couldn't answer at all — check the AI key in Settings.";
  if (first.startsWith("Missing: ")) return `With this change the draft still doesn't say “${first.slice(9)}”.`;
  if (first.startsWith("Forbidden: ")) return `With this change the draft still says “${first.slice(11)}”.`;
  if (first.startsWith("Tool not called")) return "With this change the draft still answers without checking Data.";
  return "With this change the draft still doesn't give the right answer.";
}

export function FixSheet({ agentId, input, onClose, onFinished, onOpenSettings }: { agentId: string; input: FixInput; onClose: () => void; onFinished: (result: FixFinished) => void; onOpenSettings?: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [answer, setAnswer] = useState(input.correctReply ?? input.badReply);
  const [replyOpen, setReplyOpen] = useState(false);
  const [fix, setFix] = useState<{ id: string; suggestion: Suggestion } | null>(null);
  const [kind, setKind] = useState<Kind>("knowledge");
  const [edit, setEdit] = useState({ value: "", answer: "", section: "alwaysDo" as RuleSection, line: "" });
  const [showOthers, setShowOthers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [confirmKeep, setConfirmKeep] = useState(false);
  const question = maskContact(input.customerMessage);

  async function suggest() {
    setBusy(true);
    setError(null);
    try {
      const result = await post<{ id: string; suggestion: Suggestion }>(`/api/admin/agents/${agentId}/fixes`, {
        origin: input.origin,
        conversationId: input.conversationId,
        customerMessage: input.customerMessage,
        badReply: input.badReply,
        correctReply: answer,
        lookups: input.lookups ?? [],
        fixId: fix?.id ?? input.fixId,
      });
      const suggestion = result.suggestion;
      setFix({ id: result.id, suggestion });
      setKind(suggestion.recommended);
      setEdit({ value: suggestion.data?.after ?? "", answer: suggestion.knowledge.answer, section: suggestion.rule.section, line: suggestion.rule.line });
      setShowOthers(false);
      setStep(2);
    } catch (caught) {
      setError(`Couldn't get a suggestion — ${errorMessage(caught)}. Your answer is kept.`);
    } finally {
      setBusy(false);
    }
  }

  function changeFor(target: Kind, suggestion: Suggestion) {
    if (target === "data" && suggestion.data) return { kind: "data" as const, collectionId: suggestion.data.collectionId, recordId: suggestion.data.recordId, field: suggestion.data.field, value: edit.value };
    if (target === "rule") return { kind: "rule" as const, section: edit.section, line: edit.line.trim() };
    return { kind: "knowledge" as const, question: suggestion.knowledge.question, answer: edit.answer.trim() };
  }

  async function apply(keep = false) {
    if (!fix) return;
    setError(null);
    if (!keep) {
      setStep(3);
      setOutcome({ state: "running" });
    }
    setBusy(true);
    const name = fix.suggestion.name;
    try {
      const result = await post<{ passed: boolean; kept?: boolean; reply?: string; failures?: string[]; scenario?: { name: string } }>(`/api/admin/fixes/${fix.id}/apply`, {
        change: changeFor(kind, fix.suggestion),
        name,
        mustInclude: fix.suggestion.checks.mustInclude,
        mustNotInclude: fix.suggestion.checks.mustNotInclude,
        keep,
      });
      if (result.kept) return onFinished({ kind, kept: true });
      const reply = readable(result.reply ?? "");
      setOutcome(result.passed ? { state: "pass", reply, scenario: result.scenario?.name ?? name } : { state: "fail", reply, failures: result.failures ?? [] });
    } catch (caught) {
      setStep(2);
      setOutcome(null);
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
      setConfirmKeep(false);
    }
  }

  const running = outcome?.state === "running";
  const suggestion = fix?.suggestion;
  const kinds: Kind[] = suggestion?.data ? ["data", "knowledge", "rule"] : ["knowledge", "rule"];

  const footer: ReactNode =
    step === 1 ? (
      <>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <span className="spacer" />
        <Button busy={busy} disabled={!answer.trim()} onClick={() => void suggest()}>
          {busy ? "Thinking…" : "Continue"}
        </Button>
      </>
    ) : step === 2 ? (
      <>
        <Button variant="outline" onClick={() => setStep(1)}>
          Back
        </Button>
        <span className="spacer" />
        <Button busy={busy} disabled={(kind === "rule" && !edit.line.trim()) || (kind === "knowledge" && !edit.answer.trim())} onClick={() => void apply()}>
          Apply and test
        </Button>
      </>
    ) : running ? (
      <>
        <span className="spacer" />
        <Button busy>Testing…</Button>
      </>
    ) : outcome?.state === "pass" ? (
      <>
        <span className="spacer" />
        <Button onClick={() => onFinished({ kind })}>Done</Button>
      </>
    ) : (
      <>
        <Button variant="ghost" destructive onClick={() => setConfirmKeep(true)}>
          Keep it anyway
        </Button>
        <span className="spacer" />
        <Button
          onClick={() => {
            setStep(2);
            setOutcome(null);
            setShowOthers(true);
          }}
        >
          Try another fix
        </Button>
      </>
    );

  return (
    <>
      <Sheet title="Fix this answer" subtitle={`Step ${step} of 3 · ${stepLabels[step - 1]}`} onClose={() => !running && onClose()} footer={footer}>
        <Steps total={3} current={step} />

        {step === 1 && (
          <>
            <div className="fix-quotes">
              <span className="mini-label">The customer asked</span>
              <div className="quote bubble-out fix-customer">{question}</div>
              <span className="mini-label">Your assistant replied</span>
              <div className="quote bubble-in fix-reply">
                <span className={replyOpen ? undefined : "clamp-2"}>{input.badReply}</span>
                {input.badReply.length > 120 && (
                  <button type="button" className="btn btn-ghost btn-sm fix-more" onClick={() => setReplyOpen(!replyOpen)}>
                    {replyOpen ? "Show less" : "Show all"}
                  </button>
                )}
              </div>
            </div>
            {error && <Alert tone="error" title="No suggestion yet" text={error} />}
            <Card footer="Edit the reply until it's right. The facts are enough — we'll find where to fix it.">
              <label className="field stacked">
                <span className="field-label">What it should have said</span>
                <TextArea rows={4} value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Write the answer you'd give, in your own words." data-autofocus />
              </label>
            </Card>
          </>
        )}

        {step === 2 && suggestion && (
          <>
            {suggestion.aiError === "no_key" && (
              <Alert
                tone="warning"
                title="Suggestions need your AI key"
                text="We picked Corrected answers for now. Add the key in Settings, or choose another place below."
                actions={
                  onOpenSettings ? (
                    <Button variant="outline" size="sm" onClick={onOpenSettings}>
                      Open Settings
                    </Button>
                  ) : undefined
                }
              />
            )}
            {suggestion.aiError === "failed" && <Alert tone="warning" title="The AI didn't suggest a place" text="We picked Corrected answers. Choose another place below if it fits better." />}
            {error && <Alert tone="error" title="Couldn't apply the fix" text={error} />}
            <Card title={kind === suggestion.recommended ? "Best place to fix it" : "You chose"}>
              <div className="fix-card">
                <div className="fix-card-head">
                  <span className={`tile tile-${places[kind].tile}`} aria-hidden="true">
                    <Icon name={places[kind].icon} size={18} />
                  </span>
                  <span className="row-text">
                    <span className="row-title strong">{places[kind].title}</span>
                    <span className="row-subtitle">
                      {kind === "data" && suggestion.data ? `${suggestion.data.collectionName} › ${suggestion.data.recordTitle}` : kind === "rule" ? `Instructions › ${sectionLabel[edit.section]}` : "Sources › Corrected answers"}
                    </span>
                  </span>
                  {kind === suggestion.recommended && <Badge tone="blue">Suggested</Badge>}
                </div>
                {kind === suggestion.recommended && <p className="fix-reason">{suggestion.reason}</p>}
                {kind === "data" && suggestion.data && (
                  <Diff head={suggestion.data.fieldLabel} removed={suggestion.data.before || undefined} added={<TextArea className="diff-input" rows={1} value={edit.value} onChange={(event) => setEdit({ ...edit, value: event.target.value })} aria-label={`New ${suggestion.data.fieldLabel}`} />} />
                )}
                {kind === "knowledge" && (
                  <Diff
                    head="New corrected answer"
                    added={
                      <span className="fix-qa">
                        <span className="muted">Q: {suggestion.knowledge.question}</span>
                        <TextArea className="diff-input" rows={2} value={edit.answer} onChange={(event) => setEdit({ ...edit, answer: event.target.value })} aria-label="Corrected answer" />
                      </span>
                    }
                  />
                )}
                {kind === "rule" && (
                  <>
                    <Segmented<RuleSection>
                      label="Rule list"
                      value={edit.section}
                      onChange={(section) => setEdit({ ...edit, section })}
                      options={[
                        { value: "alwaysDo", label: "Always" },
                        { value: "neverDo", label: "Never" },
                        { value: "handoffWhen", label: "Hand off" },
                      ]}
                    />
                    <Diff head={`${sectionLabel[edit.section]} · new line`} added={<TextArea className="diff-input" rows={1} value={edit.line} onChange={(event) => setEdit({ ...edit, line: event.target.value })} aria-label="New rule" />} />
                  </>
                )}
                <p className="status-line fix-note">
                  <Icon name="info" size={16} />
                  {kind === "data" ? "Data changes reach customers right away — no publish needed." : "Goes into the draft. Publish to make it live."}
                </p>
              </div>
            </Card>
            <Card>
              <button type="button" className="disclosure" aria-expanded={showOthers} onClick={() => setShowOthers(!showOthers)}>
                <span className="spacer fix-other">Choose another place</span>
                <Icon name="chevron-right" className="chev" size={13} />
              </button>
              {showOthers && (
                <div role="radiogroup" aria-label="Where to fix it" className="disclosure-body">
                  {kinds.map((option) => (
                    <button type="button" key={option} className="row" role="radio" aria-checked={kind === option} onClick={() => setKind(option)}>
                      <span className={`tile tile-${places[option].tile}`} aria-hidden="true">
                        <Icon name={places[option].icon} size={18} />
                      </span>
                      <span className="row-body">
                        <span className="row-text">
                          <span className="row-title">{option === "data" ? "Data" : option === "knowledge" ? "Corrected answers" : "Instructions"}</span>
                          <span className="row-subtitle">{places[option].choice}</span>
                        </span>
                        {kind === option && <Icon name="check" className="choice-check" size={18} />}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {step === 3 && outcome?.state === "running" && (
          <div className="result fix-running" role="status" aria-live="polite">
            <Spinner large label="Testing the fix" />
            <h3 className="result-title">Testing the fix…</h3>
            <p className="result-text">Asking the draft “{question}” again.</p>
          </div>
        )}
        {step === 3 && outcome?.state === "pass" && (
          <>
            <div className="result" role="status">
              <span className="result-icon result-pass" aria-hidden="true">
                <Icon name="check" size={28} />
              </span>
              <h3 className="result-title">Fixed and protected</h3>
              <p className="result-text">
                {kind === "data"
                  ? "The draft now gives the right answer, and customers get it right away. We saved a test scenario so it stays fixed."
                  : "The draft now gives the right answer. We saved a test scenario so it stays fixed. Publish to make it live."}
              </p>
            </div>
            <Card title="New reply">
              <div className="quote bubble-in fix-new">{outcome.reply}</div>
            </Card>
            <Card title="Saved as a test scenario">
              <div className="row">
                <span className="tile tile-soft-green" aria-hidden="true">
                  <Icon name="check-circle" size={18} />
                </span>
                <div className="row-body">
                  <span className="row-text">
                    <span className="row-title">{outcome.scenario}</span>
                    <span className="row-subtitle truncate">“{question}”</span>
                  </span>
                  <Badge tone="outline">Required</Badge>
                </div>
              </div>
            </Card>
          </>
        )}
        {step === 3 && outcome?.state === "fail" && (
          <>
            <div className="result" role="alert">
              <span className="result-icon result-fail" aria-hidden="true">
                <Icon name="xmark" size={28} />
              </span>
              <h3 className="result-title">Not applied — the scenario still fails</h3>
              <p className="result-text">{friendlyFailure(outcome.failures)} Nothing was changed for customers.</p>
            </div>
            {outcome.reply && (
              <Card title="What the draft says now">
                <div className="quote bubble-in fix-new">{outcome.reply}</div>
              </Card>
            )}
          </>
        )}
      </Sheet>
      {confirmKeep && (
        <Dialog
          title="Keep a fix that still fails?"
          text={kind === "data" ? "Customers see the new value right away. It stays in Needs attention until its scenario passes." : "It goes into the draft anyway and stays in Needs attention until its scenario passes."}
          confirmLabel="Keep it"
          destructive
          busy={busy}
          onCancel={() => setConfirmKeep(false)}
          onConfirm={() => void apply(true)}
        />
      )}
    </>
  );
}

// One way to start a fix from anywhere, with the same toasts afterwards (Publish for draft-only fixes).
export function useFixAnswer({ agentId, onChanged, onOpenSettings }: { agentId: string; onChanged?: () => void | Promise<void>; onOpenSettings?: () => void }) {
  const toast = useToast();
  const [input, setInput] = useState<FixInput | null>(null);
  const publish = useCallback(async () => {
    try {
      const result = await publishWithChecks(agentId);
      if (result.ok) toast(`Version ${result.version} is live`);
      else toast(`Not published — “${result.failed}” failed. Open Assistant to see it.`, "error");
      await onChanged?.();
    } catch (caught) {
      toast(errorMessage(caught, "Couldn't publish"), "error");
    }
  }, [agentId, onChanged, toast]);
  const sheet = input ? (
    <FixSheet
      agentId={agentId}
      input={input}
      onOpenSettings={onOpenSettings}
      onClose={() => {
        setInput(null);
        void onChanged?.();
      }}
      onFinished={(result) => {
        setInput(null);
        if (result.kept && result.kind === "data") toast("Kept · customers see the new value; it stays in Needs attention");
        else if (result.kept) toast("Kept in the draft · it stays in Needs attention", { actionLabel: "Publish", onAction: () => void publish() });
        else if (result.kind === "data") toast("Fixed · customers get it now");
        else toast("Fixed in the draft", { actionLabel: "Publish", onAction: () => void publish() });
        void onChanged?.();
      }}
    />
  ) : null;
  return { startFix: setInput, fixSheet: sheet };
}
