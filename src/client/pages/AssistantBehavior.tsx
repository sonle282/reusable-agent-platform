import type { Behavior } from "../../shared/contracts";
import type { AgentDraft } from "../types";
import { FieldRow, Row, Section, Segmented, TextInput, Toggle } from "../ui";

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
      <Section title="Feel like a person" footer="Messenger and Instagram through Zernio. Preview shows the same steps.">
        {toggles.map((item) => (
          <Row
            key={item.key}
            icon={item.icon}
            tone="blue"
            title={item.title}
            subtitle={item.note ? `${item.sub}. ${item.note}` : item.sub}
            multiline
            accessory={<Toggle label={item.title} checked={behavior[item.key]} onChange={(on) => set({ [item.key]: on })} />}
          />
        ))}
        <FieldRow label="Reply pace" hint="Natural waits 1–3 seconds per message, like typing">
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
        </FieldRow>
      </Section>

      <Section
        title="Tell customers it’s AI"
        action={<Toggle label="Tell customers it is AI" checked={behavior.aiNotice} onChange={(aiNotice) => set({ aiNotice })} />}
        footer={behavior.aiNotice ? "Sent once, before the first reply in each conversation. Required for customers in the EU (AI Act, Article 50) and builds trust everywhere." : undefined}
      >
        {behavior.aiNotice ? (
          <FieldRow label="Notice" stacked>
            <TextInput value={behavior.aiNoticeText} maxLength={300} onChange={(event) => set({ aiNoticeText: event.target.value })} />
          </FieldRow>
        ) : (
          <Row icon="warning" tone="orange" title="Customers won’t know it’s AI" subtitle="Not allowed for customers in the EU. In the US, people who find out later trust you less." multiline />
        )}
      </Section>

      <Section title="Outside business hours" footer="Hours come from Contact and hours in Instructions. The assistant always answers.">
        <FieldRow label="Outside hours">
          <select className="select" value={behavior.outsideHours} onChange={(event) => set({ outsideHours: event.target.value as Behavior["outsideHours"] })}>
            <option value="callback">Say the team calls back next business day</option>
            <option value="none">Answer as usual, say nothing</option>
          </select>
        </FieldRow>
      </Section>
    </>
  );
}
