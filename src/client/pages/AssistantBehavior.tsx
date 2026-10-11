import { useEffect, useState } from "react";
import { api } from "../api";
import type { Behavior, FollowUps } from "../../shared/contracts";
import { DELAY_LABEL, DELAY_MS, WINDOW_MS } from "../../shared/followups";
import type { AgentDraft } from "../types";
import { Button, Card, Field, Icon, Row, Segmented, Switch, TextArea, TextInput } from "../ui";

type Mutate = (fn: (draft: AgentDraft) => AgentDraft) => void;

// Settings live in the draft and publish with the version, like every other part of the assistant.
export function BehaviorTab({ draft, mutate, hasZernio }: { draft: AgentDraft; mutate: Mutate; hasZernio: boolean }) {
  const behavior = draft.behavior;
  const set = (value: Partial<Behavior>) => mutate((current) => ({ ...current, behavior: { ...current.behavior, ...value } }));
  const toggles: Array<{ key: "markSeen" | "typing" | "splitReplies"; icon: string; title: string; sub: string; note?: string }> = [
    { key: "markSeen", icon: "check-circle", title: "Mark messages as seen", sub: "Right away, so they know the message arrived", note: hasZernio ? "Messenger and Instagram may not show “Seen” through Zernio yet. WhatsApp shows blue ticks." : undefined },
    { key: "typing", icon: "bubbles", title: "Show typing while it writes", sub: "Typing dots until the reply is sent" },
    { key: "splitReplies", icon: "doc", title: "Split long replies", sub: "Into 2–3 short messages, like a person texting" },
  ];
  return (
    <>
      <Card title="Feel like a person" footer="Messenger and Instagram through Zernio. Preview shows the same steps.">
        {toggles.map((item) => (
          <Row
            key={item.key}
            icon={item.icon}
            tone="info"
            title={item.title}
            subtitle={item.note ? `${item.sub}. ${item.note}` : item.sub}
            multiline
            accessory={<Switch label={item.title} checked={behavior[item.key]} onChange={(on) => set({ [item.key]: on })} />}
          />
        ))}
        <Field label="Reply length" hint="Test scenarios fail when a reply is longer">
          <select className="select" value={behavior.maxSentences} onChange={(event) => set({ maxSentences: Number(event.target.value) })}>
            {[2, 3, 4, 5].map((count) => (
              <option key={count} value={count}>
                At most {count} sentences
              </option>
            ))}
            <option value={0}>No limit</option>
          </select>
        </Field>
        <Field label="Reply pace" hint="Natural waits 1–3 seconds per message, like typing">
          <Segmented
            label="Reply pace"
            value={behavior.pace}
            onChange={(pace) => set({ pace })}
            options={[
              { value: "instant", label: "Instant" },
              { value: "natural", label: "Natural" },
              { value: "slow", label: "Slow" },
            ]}
          />
        </Field>
      </Card>

      <Card
        title="Tell customers it’s AI"
        action={<Switch label="Tell customers it is AI" checked={behavior.aiNotice} onChange={(aiNotice) => set({ aiNotice })} />}
        footer={behavior.aiNotice ? "Sent once, before the first reply in each conversation. Required for customers in the EU (AI Act, Article 50) and builds trust everywhere." : undefined}
      >
        {behavior.aiNotice ? (
          <Field label="Notice">
            <TextInput value={behavior.aiNoticeText} maxLength={300} onChange={(event) => set({ aiNoticeText: event.target.value })} />
          </Field>
        ) : (
          <Row icon="warning" tone="warning" title="Customers won’t know it’s AI" subtitle="Not allowed for customers in the EU. In the US, people who find out later trust you less." multiline />
        )}
      </Card>

      <Card title="Outside business hours" footer="Hours come from Contact and hours in Instructions. The assistant always answers.">
        <Field label="Outside hours">
          <select className="select" value={behavior.outsideHours} onChange={(event) => set({ outsideHours: event.target.value as Behavior["outsideHours"] })}>
            <option value="callback">Say the team calls back next business day</option>
            <option value="none">Answer as usual, say nothing</option>
          </select>
        </Field>
      </Card>
    </>
  );
}

// Up to 2 nudges inside Meta's 24-hour window. Texts go out exactly as written.
export function FollowUpsTab({ agentId, draft, mutate, onPreview }: { agentId: string; draft: AgentDraft; mutate: Mutate; onPreview: (text: string, step: number) => void }) {
  const followUps = draft.followUps;
  const [broughtBack, setBroughtBack] = useState(0);
  useEffect(() => {
    void api<{ broughtBack: number }>(`/api/admin/agents/${agentId}/followups/stats`).then(
      (stats) => setBroughtBack(stats.broughtBack),
      () => setBroughtBack(0),
    );
  }, [agentId]);
  const set = (value: Partial<FollowUps>) => mutate((current) => ({ ...current, followUps: { ...current.followUps, ...value } }));
  const setStep = (index: number, value: Partial<FollowUps["steps"][number]>) => set({ steps: followUps.steps.map((step, at) => (at === index ? { ...step, ...value } : step)) });
  const firstDelays: Array<FollowUps["steps"][number]["delay"]> = ["30m", "1h", "2h", "4h"];
  const laterDelays: Array<FollowUps["steps"][number]["delay"]> = ["4h", "12h", "20h", "23h"];
  return (
    <>
      {broughtBack > 0 && (
        <div className="fu-hero" role="status">
          <Icon name="bolt" />
          <span>
            <b>
              Follow-ups brought back {broughtBack} {broughtBack === 1 ? "lead" : "leads"} in the last 30 days
            </b>
            <span className="fu-hero-sub">Customers who went quiet, then left a phone number or email after a nudge.</span>
          </span>
        </div>
      )}
      <Card
        title="Within 24 hours"
        action={<Switch label="Follow up within 24 hours" checked={followUps.enabled} onChange={(enabled) => set({ enabled })} />}
        footer="At most 2 per conversation. Make each one useful (an active offer, a next step), never just “are you there?”."
      >
        <div className="fu-window" aria-hidden="true">
          <div className="window-bar">
            <span className="wb-in" />
            {followUps.steps.map((step, index) => (
              <span key={index} className="wb-mark" style={{ left: `${(DELAY_MS[step.delay] / WINDOW_MS) * 100}%` }} />
            ))}
          </div>
          <div className="fu-window-labels">
            <span>Customer’s last message</span>
            <span>24 h · Meta closes the window</span>
          </div>
        </div>
        {followUps.enabled &&
          followUps.steps.map((step, index) => (
            <div className="fu-step" key={index}>
              <span className="fu-num" aria-hidden="true">
                {index + 1}
              </span>
              <div className="fu-body">
                <div className="inline-select">
                  <span>Send</span>
                  <select className="select" aria-label={`Follow-up ${index + 1} wait time`} value={step.delay} onChange={(event) => setStep(index, { delay: event.target.value as typeof step.delay })}>
                    {(index === 0 ? firstDelays : laterDelays).map((delay) => (
                      <option key={delay} value={delay}>
                        {DELAY_LABEL[delay]}
                      </option>
                    ))}
                  </select>
                  <span className="muted">after they go quiet, if they</span>
                  <select className="select" aria-label={`Follow-up ${index + 1} condition`} value={step.condition} onChange={(event) => setStep(index, { condition: event.target.value as typeof step.condition })}>
                    <option value="price_no_contact">asked about price but left no contact</option>
                    <option value="any_no_contact">asked anything and left no contact</option>
                  </select>
                </div>
                <TextArea aria-label={`Follow-up ${index + 1} message`} rows={2} maxLength={1000} value={step.text} onChange={(event) => setStep(index, { text: event.target.value })} />
                <div className="fu-foot">
                  <span className="muted">{index === followUps.steps.length - 1 && index > 0 ? "Sent exactly as written · last chance before the 24-hour window closes" : "Sent exactly as written"}</span>
                  <Button variant="ghost" size="sm" disabled={!step.text.trim()} onClick={() => onPreview(step.text, index + 1)}>
                    Show in Preview
                  </Button>
                </div>
              </div>
            </div>
          ))}
      </Card>
      <Card title="After 24 hours" footer="Meta doesn’t allow free-form messages after 24 hours. Your team can still reply by hand for 7 days with Meta’s Human Agent tag.">
        <Row
          icon="reply"
          tone="info"
          title="Add “Contact again” to Needs attention"
          subtitle="So your team can reply by hand from the page, or call if they left a number"
          multiline
          accessory={<Switch label="Add contact again to Needs attention" checked={followUps.contactAgain} onChange={(contactAgain) => set({ contactAgain })} />}
        />
      </Card>
      <Card title="Stops automatically when">
        {["The customer replies", "They leave a phone number or email", "They say they’re not interested or ask you to stop", "You mark the lead Won or Not a fit, or your team takes over"].map((text) => (
          <Row key={text} icon="check" tone="success" title={text} />
        ))}
      </Card>
    </>
  );
}
