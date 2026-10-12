import { useState, type FormEvent } from "react";
import { del, post } from "../api";
import { platformOf } from "../platform";
import type { AgentSummary, Brand, Connection } from "../types";
import { AgentAvatar, Alert, BrandLogo, Button, Dialog, errorMessage, Field, Icon, Menu, PageHeader, Sheet, TextArea, TextInput, Tile, useToast, type agentStatus } from "../ui";

type Status = ReturnType<typeof agentStatus>;
type Start = { kind: "template"; template: "blank" | "sales" | "support" } | { kind: "copy"; agentId: string };

const templates: Array<{ template: "sales" | "support" | "blank"; icon: string; title: string; sub: string }> = [
  { template: "sales", icon: "sparkle", title: "Sales consultant", sub: "Answers product questions, recommends, collects leads" },
  { template: "support", icon: "chat", title: "Customer support", sub: "Policies, orders and after-sales questions" },
  { template: "blank", icon: "edit", title: "Blank", sub: "Start from an empty page" },
];

// Every assistant has its own instructions, knowledge, versions and channels; Data tables are shared.
export function AssistantsPage({
  agents,
  statusOf,
  connections,
  brand,
  creating,
  onCreate,
  onOpen,
  reload,
}: {
  agents: AgentSummary[];
  statusOf: (agent: AgentSummary) => Status;
  connections: Connection[];
  brand: Brand;
  creating: boolean;
  onCreate: (open: boolean) => void;
  onOpen: (id: string) => void;
  reload: () => Promise<void>;
}) {
  const toast = useToast();
  const [copyFrom, setCopyFrom] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AgentSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const channelsOf = (agentId: string) => connections.filter((connection) => connection.agent_id === agentId);

  return (
    <div className="page">
      <PageHeader
        title="Assistants"
        subtitle="Each assistant has its own instructions, knowledge and channels. Data tables are shared."
        actions={
          <Button icon="plus" onClick={() => onCreate(true)}>
            New assistant
          </Button>
        }
      />
      <div className="agent-grid">
        {agents.map((agent) => {
          const status = statusOf(agent);
          const channels = channelsOf(agent.id);
          return (
            <div className="agent-card" key={agent.id}>
              <div className="row-flex" style={{ alignItems: "flex-start" }}>
                <AgentAvatar id={agent.id} name={agent.name} />
                <span className="spacer" />
                <Menu
                  label={`Actions for ${agent.name}`}
                  items={[
                    { label: "Edit", icon: "edit", onSelect: () => onOpen(agent.id) },
                    {
                      label: "Duplicate",
                      icon: "copy",
                      onSelect: () => {
                        setCopyFrom(agent.id);
                        onCreate(true);
                      },
                    },
                    { separator: true },
                    { label: "Delete…", icon: "trash", destructive: true, onSelect: () => setDeleting(agent) },
                  ]}
                />
              </div>
              <button type="button" className="agent-open" onClick={() => onOpen(agent.id)}>
                <span className="strong" style={{ font: "var(--text-heading-xs)" }}>
                  {agent.name}
                </span>
                <span className="t2 clamp-2">{agent.description || "No description yet"}</span>
              </button>
              <div className="agent-foot">
                <span className="status">
                  <span className={`dot ${status.dot}`} aria-hidden="true" />
                  <span className="truncate">{status.text}</span>
                </span>
                <span className="spacer" />
                {channels.length > 0 ? (
                  <span className="logo-stack" title={channels.map((channel) => channel.name).join(", ")}>
                    {channels.slice(0, 4).map((channel) => (
                      <BrandLogo key={channel.id} platform={platformOf(channel)} size="sm" />
                    ))}
                  </span>
                ) : (
                  <span>No channel</span>
                )}
              </div>
            </div>
          );
        })}
        <button type="button" className="agent-card new" onClick={() => onCreate(true)}>
          <span className="empty-icon" style={{ margin: 0 }} aria-hidden="true">
            <Icon name="plus" size={24} />
          </span>
          <span className="medium">New assistant</span>
          <span className="xs t3">From a template, a copy or blank</span>
        </button>
      </div>

      {creating && (
        <NewAssistantSheet
          agents={agents}
          brand={brand}
          initial={copyFrom ? { kind: "copy", agentId: copyFrom } : { kind: "template", template: "sales" }}
          onClose={() => {
            setCopyFrom(null);
            onCreate(false);
          }}
          onDone={async (id, name) => {
            setCopyFrom(null);
            await reload();
            toast(`“${name}” created as a draft`);
            onOpen(id);
          }}
        />
      )}
      {deleting && (
        <Dialog
          title={`Delete ${deleting.name}?`}
          text="Its instructions, knowledge and versions are deleted. Only assistants without channels or customer chats can be deleted; Data tables stay."
          confirmLabel="Delete"
          destructive
          busy={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await del(`/api/admin/agents/${deleting.id}`);
              await reload();
              toast(`${deleting.name} deleted`);
            } catch (caught) {
              toast(errorMessage(caught, "Couldn't delete it"), "error");
            } finally {
              setBusy(false);
              setDeleting(null);
            }
          }}
        />
      )}
    </div>
  );
}

function NewAssistantSheet({ agents, brand, initial, onClose, onDone }: { agents: AgentSummary[]; brand: Brand; initial: Start; onClose: () => void; onDone: (id: string, name: string) => Promise<void> }) {
  const [start, setStart] = useState<Start>(initial);
  const source = start.kind === "copy" ? agents.find((agent) => agent.id === start.agentId) : undefined;
  const [name, setName] = useState(source ? `${source.name} (copy)` : "");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pick = (next: Start) => {
    setStart(next);
    if (next.kind === "copy") {
      const from = agents.find((agent) => agent.id === next.agentId);
      if (from && (!name || name.endsWith("(copy)"))) setName(`${from.name} (copy)`);
    }
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result =
        start.kind === "copy"
          ? await post<{ id: string }>(`/api/admin/agents/${start.agentId}/duplicate`, { name: name.trim(), description: description.trim() || undefined })
          : await post<{ id: string }>("/api/admin/agents", { name: name.trim(), description: description.trim(), template: start.template, businessName: brand.name, primaryLanguage: "en" });
      await onDone(result.id, name.trim());
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't create the assistant"));
      setBusy(false);
    }
  }
  const isOn = (option: Start) => (option.kind === "copy" ? start.kind === "copy" && start.agentId === option.agentId : start.kind === "template" && start.template === option.template);
  const options: Array<{ start: Start; icon: string; title: string; sub: string; agent?: AgentSummary }> = [
    ...templates.map((item) => ({ start: { kind: "template" as const, template: item.template }, icon: item.icon, title: item.title, sub: item.sub })),
    ...agents.map((agent) => ({ start: { kind: "copy" as const, agentId: agent.id }, icon: "copy", title: `Copy of ${agent.name}`, sub: "Same instructions, behavior and Data; add knowledge again", agent })),
  ];
  return (
    <Sheet
      wide
      title="New assistant"
      subtitle="It starts as a private draft. Test it, then publish when you're happy."
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="new-assistant" busy={busy} disabled={!name.trim()}>
            Create assistant
          </Button>
        </>
      }
    >
      <form id="new-assistant" className="sheet-form" onSubmit={submit}>
        <div className="field">
          <span className="field-label">Start from</span>
          <div className="template-grid" role="radiogroup" aria-label="Start from">
            {options.map((option) => (
              <button type="button" key={option.title} className="choice" role="radio" aria-checked={isOn(option.start)} style={{ alignItems: "flex-start" }} onClick={() => pick(option.start)}>
                {option.agent ? <AgentAvatar id={option.agent.id} name={option.agent.name} size="sm" /> : <Tile icon={option.icon} />}
                <span className="row-text">
                  <span className="row-title">{option.title}</span>
                  <span className="xs t2">{option.sub}</span>
                </span>
                <span className="radio-dot" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
        <Field label="Name" hint="Only you see this name. Customers see your business name.">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Booking assistant" required data-autofocus />
        </Field>
        <Field label="What should it do?" hint="One or two sentences. You can add details in Instructions next.">
          <TextArea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Book showroom visits and collect the customer's phone number." />
        </Field>
        <Alert tone="info" text="Data tables are shared by all assistants. You choose which tables this one can look up in its Sources." />
        {error && <Alert tone="danger" title="Couldn't create the assistant" text={error} />}
      </form>
    </Sheet>
  );
}
