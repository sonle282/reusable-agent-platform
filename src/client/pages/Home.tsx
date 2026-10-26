import { useCallback, useEffect, useState } from "react";
import { api, del, post } from "../api";
import { useFixAnswer } from "../FixSheet";
import { displayName, formatDate, parseDate, previewSnippet } from "../format";
import { publishDraft } from "../publish";
import { parseRichMessage } from "../RichMessage";
import { platformOf } from "../platform";
import type { AgentSummary, AttentionItem, Connection, Conversation, Dashboard, TranscriptMessage, Role } from "../types";
import { AgentAvatar, agentStatus, Alert, AvatarWithChannel, Badge, Button, Card, EmptyState, errorMessage, Icon, LoadError, Menu, PageHeader, Row, SkeletonLine, Tile, useToast, type TileTone } from "../ui";

type Go = (page: "assistants" | "conversations" | "channels" | "settings" | "leads" | "data", ...params: string[]) => void;
type Item = AttentionItem & { agentId: string };
// Attention keys are unique per assistant; the page needs them unique across assistants.
const uid = (item: Item) => `${item.agentId}:${item.key}`;

const plainText = (value: string) =>
  parseRichMessage(value)
    .map((part) => part.text ?? "")
    .filter(Boolean)
    .join("\n");

const reasons: Array<{ value: "answer_fine" | "handled" | "not_customer"; label: string }> = [
  { value: "answer_fine", label: "The answer was fine" },
  { value: "handled", label: "Already handled" },
  { value: "not_customer", label: "Not a real customer" },
];

// The owner's morning view: are the assistants live, what needs a person, how the last day went, what customers asked.
export function HomePage({
  agents,
  statusOf,
  connections,
  tableCount,
  go,
  refresh,
  role = "owner",
}: {
  role?: Role;
  agents: AgentSummary[];
  statusOf: (agent: AgentSummary) => ReturnType<typeof agentStatus>;
  connections: Connection[];
  tableCount: number;
  go: Go;
  refresh: () => Promise<void>;
}) {
  const toast = useToast();
  const [summary, setSummary] = useState<Dashboard | null>(null);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [attention, setAttention] = useState<Item[] | null>(null);
  const [attentionError, setAttentionError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const loadAttention = useCallback(async () => {
    try {
      // Needs attention covers every assistant; each item remembers which one it belongs to.
      const lists = await Promise.all(agents.map(async (agent) => (await api<AttentionItem[]>(`/api/admin/agents/${agent.id}/attention`)).map((item) => ({ ...item, agentId: agent.id }))));
      setAttention(lists.flat());
      setAttentionError(false);
    } catch {
      setAttentionError(true);
    }
  }, [agents.map((agent) => agent.id).join(",")]);
  const load = useCallback(async () => {
    setBusy("load");
    try {
      const [dashboard, list] = await Promise.all([api<Dashboard>("/api/admin/dashboard"), api<Conversation[]>("/api/admin/conversations"), loadAttention()]);
      setSummary(dashboard);
      setConversations(list);
      setUpdatedAt(new Date());
      setError("");
    } catch (caught) {
      // Keep whatever was already on screen; say what happened and offer a retry.
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }, [loadAttention]);
  useEffect(() => void load(), [load]);

  const changed = useCallback(async () => {
    await Promise.all([loadAttention(), refresh()]);
  }, [loadAttention, refresh]);
  const { startFix, fixSheet } = useFixAnswer({ onChanged: changed, onOpenSettings: () => go("settings") });
  const agentOf = (id: string) => agents.find((agent) => agent.id === id);

  // An attention item points at a moment in a conversation; the reply is the last assistant message at that time.
  async function fixFromConversation(item: Item) {
    if (!item.conversationId) return;
    setBusy(uid(item));
    try {
      const detail = await api<{ messages: TranscriptMessage[] }>(`/api/admin/conversations/${encodeURIComponent(item.conversationId)}`);
      const limit = (parseDate(item.at)?.getTime() ?? Date.now()) + 60_000;
      const messages = detail.messages.filter((message) => (parseDate(message.created_at)?.getTime() ?? 0) <= limit);
      const replyIndex = messages.map((message) => message.role).lastIndexOf("assistant");
      if (replyIndex < 0) return go("conversations", item.conversationId);
      const question = [...messages.slice(0, replyIndex)].reverse().find((message) => message.role === "user");
      startFix({ origin: "attention", agentId: item.agentId, conversationId: item.conversationId, customerMessage: plainText(question?.content ?? ""), badReply: plainText(messages[replyIndex].content) });
    } catch (caught) {
      toast(errorMessage(caught, "Couldn't open that conversation"), "error");
    } finally {
      setBusy(null);
    }
  }
  async function retryFix(item: Item) {
    if (!item.fixId) return;
    setBusy(uid(item));
    try {
      const fix = await api<{ id: string; conversation_id: string | null; customer_message: string; bad_reply: string; correct_reply: string }>(`/api/admin/fixes/${item.fixId}`);
      startFix({ origin: "attention", agentId: item.agentId, conversationId: fix.conversation_id ?? undefined, customerMessage: fix.customer_message, badReply: fix.bad_reply, correctReply: fix.correct_reply, fixId: fix.id });
    } catch (caught) {
      toast(errorMessage(caught, "Couldn't open the fix"), "error");
    } finally {
      setBusy(null);
    }
  }
  async function publish(item: Item) {
    setBusy(uid(item));
    try {
      const result = await publishDraft(item.agentId);
      toast(`Version ${result.version} is live`);
      await changed();
    } catch (caught) {
      toast(errorMessage(caught, "Couldn't publish"), "error");
    } finally {
      setBusy(null);
    }
  }
  async function dismiss(group: Item[], reason: (typeof reasons)[number]["value"]) {
    try {
      for (const item of group) await post("/api/admin/attention/dismiss", { key: item.key, reason });
      const keys = new Set(group.map(uid));
      setAttention((current) => current?.filter((entry) => !keys.has(uid(entry))) ?? null);
      toast("Dismissed", {
        actionLabel: "Undo",
        onAction: async () => {
          for (const item of group) await del(`/api/admin/attention/dismiss/${encodeURIComponent(item.key)}`);
          await loadAttention();
        },
      });
    } catch (caught) {
      toast(errorMessage(caught, "Couldn't dismiss. Try again."), "error");
    }
  }

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const loading = !summary && !conversations && !error;
  const recent = conversations?.slice(0, 5) ?? [];
  // The same problem in the same chat is one to-do: newest first, with how many times it happened.
  const groups = groupAttention(attention ?? []);

  // What each item says and which single action it offers.
  const present = (item: Item): { tone: TileTone; icon: string; title: string; sub: string; label: string; variant: "outline" | "soft" | "primary"; act: () => void } => {
    const name = item.person ? displayName(item.person) : "";
    const when = formatDate(item.at);
    const open = () => item.conversationId && go("conversations", item.conversationId);
    switch (item.type) {
      case "team":
        return { tone: "default", icon: "pause", title: "Your team is replying", sub: `${name} · assistant paused · ${when}`, label: "Open", variant: "outline", act: open };
      case "lead":
        return { tone: "info", icon: "user-add", title: "New lead to contact", sub: `${name} left contact details · ${when}`, label: "Open", variant: "outline", act: () => (item.leadId ? go("leads", item.leadId) : open()) };
      case "contact_again":
        return { tone: "warning", icon: "reply", title: "Contact again", sub: `${name} went quiet after a follow-up · reply by hand from the page · ${when}`, label: "Open", variant: "outline", act: open };
      case "backup":
        return { tone: "warning", icon: "warning", title: "Sent the backup reply", sub: `${name} · the AI didn't answer · ${when}`, label: "Open", variant: "outline", act: open };
      case "price":
        return { tone: "warning", icon: "warning", title: "Price given without checking Data", sub: `${name} · ${when}`, label: "Fix answer", variant: "soft", act: () => void fixFromConversation(item) };
      case "fix_pending":
        return { tone: "info", icon: "wrench", title: "Fix not live yet", sub: `“${item.message}” · not published yet`, label: "Publish", variant: "primary", act: () => void publish(item) };
      default:
        return { tone: "danger", icon: "error", title: "Fix kept but failing", sub: `“${item.message}” is still answered wrong by the draft`, label: "Try again", variant: "soft", act: () => void retryFix(item) };
    }
  };

  return (
    <div className="page">
      <PageHeader title="Home" subtitle={today} />

      {error && !summary && !conversations && (
        <div className="card">
          <LoadError title="Couldn't load Home" text="Your assistant keeps answering customers." error={error} busy={busy === "load"} onRetry={() => void load()} />
        </div>
      )}
      {error && (summary || conversations) && (
        <Alert
          tone="danger"
          title="Couldn't refresh Home"
          text={updatedAt ? `Showing what we had at ${formatDate(updatedAt.toISOString())}. Your assistant keeps answering customers.` : "Check your connection, then try again."}
          actions={
            <Button variant="outline" size="sm" busy={busy === "load"} onClick={() => void load()}>
              Try again
            </Button>
          }
        />
      )}

      {error && !summary && !conversations ? null : loading ? (
        <HomeSkeleton />
      ) : (
        <>
          <section className="card" aria-labelledby="attention-title" style={{ overflow: "visible" }}>
            <div className="card-head">
              <h2 id="attention-title" className="card-title" style={{ flex: "none" }}>
                Needs attention
              </h2>
              {groups.length > 0 && <Badge count>{groups.length}</Badge>}
            </div>
            {attentionError ? (
              <LoadError title="Couldn't load Needs attention" text="Other parts of the page still work." onRetry={() => void loadAttention()} />
            ) : groups.length > 0 ? (
              groups.map((group) => {
                const item = group[0];
                const view = present(item);
                return (
                  <div className="row" key={uid(item)}>
                    <Tile icon={view.icon} tone={view.tone} />
                    <div className="row-text">
                      <span className="row-title">
                        {view.title}
                        {group.length > 1 && <span className="t3"> · {group.length} times</span>}
                      </span>
                      <span className="row-sub truncate">
                        {agents.length > 1 && `${agentOf(item.agentId)?.name ?? "Assistant"} · `}
                        {view.sub}
                      </span>
                    </div>
                    {item.waitingDays !== undefined && (
                      <Badge tone="warning">
                        Waiting {item.waitingDays} {item.waitingDays === 1 ? "day" : "days"}
                      </Badge>
                    )}
                    <div className="row-flex" style={{ flex: "none" }}>
                      {/* Fixing answers and publishing need a manager; staff still see the item and can dismiss it. */}
                      {!(role === "staff" && ["price", "fix_pending", "fix_failing"].includes(item.type)) && (
                        <Button variant={view.variant} size="sm" busy={busy === uid(item)} onClick={view.act}>
                          {view.label}
                        </Button>
                      )}
                      <Menu
                        label={`More actions for ${view.title}`}
                        items={[
                          ...(item.conversationId && item.type !== "team" && item.type !== "lead" && item.type !== "backup"
                            ? [{ label: "Open conversation", icon: "chats", onSelect: () => go("conversations", item.conversationId!) }, { separator: true as const }]
                            : []),
                          { group: "Dismiss because…" },
                          ...reasons.map((reason) => ({ label: reason.label, onSelect: () => void dismiss(group, reason.value) })),
                        ]}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <Row icon="check" tone="success" title="All caught up" subtitle="Wrong answers, new leads and missed replies show up here." multiline />
            )}
          </section>

          {summary && (
            <section className="card metrics" aria-label="Last 24 hours">
              <Metric value={summary.chats24h} label="Chats in 24 hours" sub={summary.chats7d ? `${summary.chats7d} this week` : "None this week"} />
              <Metric value={summary.waitingForTeam} label="Waiting for your team" sub={summary.waitingForTeam ? "Reply in Conversations" : "All handled"} />
              <Metric value={summary.failedDeliveries} label="Replies not delivered" sub={summary.failedDeliveries ? "Retry in Channels" : "All delivered"} />
            </section>
          )}

          <div className="home-grid">
            {role !== "staff" && (
            <Card
              title="Assistants"
              action={
                <Button variant="ghost" size="sm" onClick={() => go("assistants")}>
                  View all
                </Button>
              }
            >
              {agents.slice(0, 4).map((agent) => {
                const status = statusOf(agent);
                return (
                  <button type="button" className="row" key={agent.id} onClick={() => go("assistants", agent.id, "test")}>
                    <AgentAvatar id={agent.id} name={agent.name} />
                    <span className="row-text">
                      <span className="row-title truncate">{agent.name}</span>
                      <span className="status xs">
                        <span className={`dot ${status.dot}`} aria-hidden="true" />
                        <span className="truncate">{status.text}</span>
                      </span>
                    </span>
                    <Icon name="chevron-right" className="chev" size={16} />
                  </button>
                );
              })}
              <Row icon="table" title="Data" subtitle={`${tableCount} ${tableCount === 1 ? "table" : "tables"} · products, offers and prices it looks up`} onClick={() => go("data")} chevron />
            </Card>
            )}

            <Card
              title="Recent conversations"
              action={
                recent.length > 0 ? (
                  <Button variant="ghost" size="sm" onClick={() => go("conversations")}>
                    View all
                  </Button>
                ) : undefined
              }
            >
              {conversations && recent.length === 0 ? (
                <EmptyState
                  icon="chats"
                  title="No conversations yet"
                  text="When customers message you on a connected channel, their chats show up here."
                  action={role === "owner" ? <Button onClick={() => go("channels")}>Add a channel</Button> : undefined}
                />
              ) : (
                recent.map((conversation) => {
                  const name = displayName(conversation);
                  const connection = connections.find((item) => item.id === conversation.connection_id);
                  return (
                    <button type="button" className="row top" key={conversation.id} onClick={() => go("conversations", conversation.id)}>
                      <AvatarWithChannel name={conversation.display_name ? name : undefined} platform={platformOf(connection)} />
                      <span className="row-text">
                        <span className="row-flex">
                          <span className="row-title truncate">{name}</span>
                          <span className="spacer" />
                          <span className="row-meta">{formatDate(conversation.last_activity_at)}</span>
                        </span>
                        <span className="row-sub preview-line">{previewSnippet(conversation.last_message_preview, parseRichMessage)}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </Card>
          </div>
        </>
      )}
      {fixSheet}
    </div>
  );
}

function Metric({ value, label, sub }: { value: number; label: string; sub: string }) {
  return (
    <div className="metric">
      <span className="xs t3">{label}</span>
      <span className={`metric-value${value ? "" : " is-zero"}`}>{value}</span>
      <span className="xs t3">{sub}</span>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <>
      <Card title="Needs attention">
        {[0, 1].map((index) => (
          <div className="skel-row" key={index} aria-hidden="true">
            <span className="skel" style={{ width: 32, height: 32 }} />
            <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <SkeletonLine width={index ? "35%" : "50%"} />
              <SkeletonLine width={index ? "65%" : "75%"} />
            </span>
          </div>
        ))}
      </Card>
      <div className="card metrics" aria-busy="true" aria-label="Loading">
        {[0, 1, 2].map((index) => (
          <div className="metric" key={index}>
            <span className="skel skel-line" style={{ width: "60%" }} />
            <span className="skel" style={{ width: 32, height: 28, marginTop: 4 }} />
          </div>
        ))}
      </div>
    </>
  );
}

function groupAttention(items: Item[]) {
  const groups = new Map<string, Item[]>();
  const time = (item: Item) => parseDate(item.at)?.getTime() ?? 0;
  for (const item of [...items].sort((a, b) => time(b) - time(a))) {
    // Items never group across assistants: each group's actions (publish, fix) belong to one assistant.
    const key = `${item.agentId}:${item.conversationId && ["price", "backup", "team", "contact_again"].includes(item.type) ? `${item.type}:${item.conversationId}` : item.key}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.values()];
}
