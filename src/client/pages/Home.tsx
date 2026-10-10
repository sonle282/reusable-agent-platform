import { useCallback, useEffect, useState } from "react";
import { api, del, post } from "../api";
import { useFixAnswer } from "../FixSheet";
import { displayName, formatDate, parseDate, previewSnippet } from "../format";
import { publishWithChecks } from "../publish";
import { parseRichMessage } from "../RichMessage";
import type { AgentSummary, AttentionItem, Connection, Conversation, Dashboard, TranscriptMessage } from "../types";
import { Avatar, Badge, Banner, Button, EmptyState, Icon, Menu, PageHeader, Section, SkeletonLine, errorMessage, useToast, type TileTone } from "../ui";

type Go = (page: "assistant" | "conversations" | "connections" | "settings", ...params: string[]) => void;

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

// The owner's morning view: is the assistant live, what needs a person, how the last day went, what customers asked.
export function HomePage({
  agent,
  connections,
  liveVersion,
  unpublished,
  go,
  refresh,
}: {
  agent: AgentSummary;
  connections: Connection[];
  liveVersion: number | null;
  unpublished: boolean;
  go: Go;
  refresh: () => Promise<void>;
}) {
  const toast = useToast();
  const [summary, setSummary] = useState<Dashboard | null>(null);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [attention, setAttention] = useState<AttentionItem[] | null>(null);
  const [attentionError, setAttentionError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const loadAttention = useCallback(async () => {
    try {
      setAttention(await api<AttentionItem[]>(`/api/admin/agents/${agent.id}/attention`));
      setAttentionError(false);
    } catch {
      setAttentionError(true);
    }
  }, [agent.id]);
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
  const { startFix, fixSheet } = useFixAnswer({ agentId: agent.id, onChanged: changed, onOpenSettings: () => go("settings") });

  // An attention item points at a moment in a conversation; the reply is the last assistant message at that time.
  async function fixFromConversation(item: AttentionItem) {
    if (!item.conversationId) return;
    setBusy(item.key);
    try {
      const detail = await api<{ messages: TranscriptMessage[] }>(`/api/admin/conversations/${encodeURIComponent(item.conversationId)}`);
      const limit = (parseDate(item.at)?.getTime() ?? Date.now()) + 60_000;
      const messages = detail.messages.filter((message) => (parseDate(message.created_at)?.getTime() ?? 0) <= limit);
      const replyIndex = messages.map((message) => message.role).lastIndexOf("assistant");
      if (replyIndex < 0) return go("conversations", item.conversationId);
      const question = [...messages.slice(0, replyIndex)].reverse().find((message) => message.role === "user");
      startFix({ origin: "attention", conversationId: item.conversationId, customerMessage: plainText(question?.content ?? ""), badReply: plainText(messages[replyIndex].content) });
    } catch (caught) {
      toast(errorMessage(caught, "Couldn't open that conversation"), "error");
    } finally {
      setBusy(null);
    }
  }
  async function retryFix(item: AttentionItem) {
    if (!item.fixId) return;
    setBusy(item.key);
    try {
      const fix = await api<{ id: string; conversation_id: string | null; customer_message: string; bad_reply: string; correct_reply: string }>(`/api/admin/fixes/${item.fixId}`);
      startFix({ origin: "attention", conversationId: fix.conversation_id ?? undefined, customerMessage: fix.customer_message, badReply: fix.bad_reply, correctReply: fix.correct_reply, fixId: fix.id });
    } catch (caught) {
      toast(errorMessage(caught, "Couldn't open the fix"), "error");
    } finally {
      setBusy(null);
    }
  }
  async function publish(item: AttentionItem) {
    setBusy(item.key);
    try {
      const result = await publishWithChecks(agent.id);
      if (result.ok) toast(`Version ${result.version} is live`);
      else toast(`Not published — “${result.failed}” failed. Open Assistant to see it.`, "error");
      await changed();
    } catch (caught) {
      toast(errorMessage(caught, "Couldn't publish"), "error");
    } finally {
      setBusy(null);
    }
  }
  async function dismiss(item: AttentionItem, reason: (typeof reasons)[number]["value"]) {
    try {
      await post("/api/admin/attention/dismiss", { key: item.key, reason });
      setAttention((current) => current?.filter((entry) => entry.key !== item.key) ?? null);
      toast("Dismissed", {
        actionLabel: "Undo",
        onAction: async () => {
          await del(`/api/admin/attention/dismiss/${encodeURIComponent(item.key)}`);
          await loadAttention();
        },
      });
    } catch (caught) {
      toast(errorMessage(caught, "Couldn't dismiss. Try again."), "error");
    }
  }

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const loading = !summary && !conversations && !error;
  const live = Boolean(agent.active_version_id);
  const channelCount = connections.filter((connection) => connection.agent_id === agent.id && connection.status === "active").length;
  const statusText = !live
    ? "Not live yet · test it, then publish"
    : unpublished
      ? `Live · version ${liveVersion ?? "—"} · the draft has unpublished changes`
      : `Live · version ${liveVersion ?? "—"} · answering on ${channelCount} ${channelCount === 1 ? "channel" : "channels"}`;
  const channelName = (id?: string) => connections.find((connection) => connection.id === id)?.name ?? "";
  const recent = conversations?.slice(0, 5) ?? [];

  // What each item says and which single action it offers.
  const present = (item: AttentionItem): { tone: TileTone; icon: string; title: string; sub: string; label: string; variant: "gray" | "tinted" | "filled"; act: () => void } => {
    const name = item.person ? displayName(item.person) : "";
    const when = formatDate(item.at);
    const open = () => item.conversationId && go("conversations", item.conversationId);
    switch (item.type) {
      case "team":
        return { tone: "soft-gray", icon: "pause", title: "Your team is replying", sub: `${name} · assistant paused · ${when}`, label: "Open", variant: "gray", act: open };
      case "lead":
        return { tone: "soft-blue", icon: "person-plus", title: "New lead to contact", sub: `${name} left contact details · ${when}`, label: "Open", variant: "gray", act: open };
      case "backup":
        return { tone: "soft-orange", icon: "warning", title: "Sent the backup reply", sub: `${name} · the AI didn't answer · ${when}`, label: "Open", variant: "gray", act: open };
      case "price":
        return { tone: "soft-orange", icon: "warning", title: "Price given without checking Data", sub: `${name} · ${when}`, label: "Fix", variant: "tinted", act: () => void fixFromConversation(item) };
      case "fix_pending":
        return { tone: "soft-blue", icon: "wrench", title: "Fix not live yet", sub: `“${item.message}” · customers still see version ${liveVersion ?? "—"}`, label: "Publish", variant: "filled", act: () => void publish(item) };
      default:
        return { tone: "soft-red", icon: "error", title: "Fix kept but failing", sub: `“${item.message}” still fails its test scenario`, label: "Try again", variant: "tinted", act: () => void retryFix(item) };
    }
  };

  return (
    <div className="page">
      <PageHeader title="Home" subtitle={today} />

      {error && (
        <Banner
          tone="error"
          title="Couldn't refresh Home"
          text={updatedAt ? `Showing what we had at ${formatDate(updatedAt.toISOString())}. Check your connection, then try again.` : "Check your connection, then try again."}
          actions={
            <Button variant="gray" size="small" busy={busy === "load"} onClick={() => void load()}>
              Try again
            </Button>
          }
        />
      )}

      <section className="section-card" aria-label="Assistant status">
        <button type="button" className="status-card" onClick={() => go("assistant")}>
          <span className={`tile tile-lg tile-${live ? "green" : "gray"}`} aria-hidden="true">
            <Icon name="sparkles" size={22} />
          </span>
          <span className="row-text">
            <span className="status-card-title">{agent.name}</span>
            <span className="row-subtitle">{statusText}</span>
          </span>
          <Icon name="chevron-right" className="row-chevron" size={14} />
        </button>
      </section>

      {loading ? (
        <HomeSkeleton />
      ) : (
        <>
          <Section title="Needs attention" badge={attention?.length ? <Badge count>{attention.length}</Badge> : undefined}>
            {attentionError ? (
              <div className="pane-banner pane-banner-top">
                <Banner
                  tone="error"
                  title="Couldn't load Needs attention"
                  text="Other parts of the page still work."
                  actions={
                    <Button variant="gray" size="small" onClick={() => void loadAttention()}>
                      Try again
                    </Button>
                  }
                />
              </div>
            ) : attention && attention.length > 0 ? (
              attention.map((item) => {
                const view = present(item);
                return (
                  <div className="row" key={item.key}>
                    <span className={`tile tile-${view.tone}`} aria-hidden="true">
                      <Icon name={view.icon} size={18} />
                    </span>
                    <div className="row-body">
                      <div className="row-text">
                        <span className="row-title strong">{view.title}</span>
                        <span className="row-subtitle truncate">{view.sub}</span>
                      </div>
                      {item.waitingDays !== undefined && (
                        <Badge tone="orange">
                          Waiting {item.waitingDays} {item.waitingDays === 1 ? "day" : "days"}
                        </Badge>
                      )}
                      <div className="attn-actions">
                        <Button variant={view.variant} size="small" busy={busy === item.key} onClick={view.act}>
                          {view.label}
                        </Button>
                        <Menu
                          label={`More actions for ${view.title}`}
                          items={[
                            ...(item.conversationId && item.type !== "team" && item.type !== "lead" && item.type !== "backup"
                              ? [{ label: "Open conversation", icon: "bubbles", onSelect: () => go("conversations", item.conversationId!) }, { separator: true as const }]
                              : []),
                            { group: "Dismiss because…" },
                            ...reasons.map((reason) => ({ label: reason.label, onSelect: () => void dismiss(item, reason.value) })),
                          ]}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="row">
                <span className="tile tile-soft-green" aria-hidden="true">
                  <Icon name="check" size={18} />
                </span>
                <div className="row-body">
                  <div className="row-text">
                    <span className="row-title strong">Nothing needs you</span>
                    <span className="row-subtitle">Wrong answers, new leads and missed replies show up here.</span>
                  </div>
                </div>
              </div>
            )}
          </Section>

          {summary && (
            <Section title="Last 24 hours">
              <div className="metrics">
                <Metric value={summary.chats24h} label="Chats" sub={summary.chats7d ? `${summary.chats7d} this week` : "None this week"} />
                <Metric value={summary.waitingForTeam} label="Waiting for your team" sub={summary.waitingForTeam ? "Reply in Conversations" : "All handled"} />
                <Metric value={summary.failedDeliveries} label="Replies not delivered" sub={summary.failedDeliveries ? "Retry in Channels" : "All delivered"} />
              </div>
            </Section>
          )}

          <Section
            title="Recent conversations"
            action={
              recent.length > 0 ? (
                <Button variant="plain" onClick={() => go("conversations")}>
                  See all
                </Button>
              ) : undefined
            }
          >
            {conversations && recent.length === 0 ? (
              <EmptyState
                icon="bubbles"
                title="No conversations yet"
                text="When customers message you on a connected channel, their chats show up here."
                action={<Button onClick={() => go("connections")}>Add a channel</Button>}
              />
            ) : (
              recent.map((conversation) => {
                const name = displayName(conversation);
                return (
                  <button type="button" className="row top" key={conversation.id} onClick={() => go("conversations", conversation.id)}>
                    <Avatar name={conversation.display_name ? name : undefined} tone={conversation.display_name ? "indigo" : undefined} />
                    <span className="row-body recent-body">
                      <span className="row-text">
                        <span className="recent-line">
                          <span className="row-title strong truncate">{name}</span>
                          <span className="row-subtitle nowrap">{channelName(conversation.connection_id)}</span>
                          <span className="spacer" />
                          <span className="row-detail">{formatDate(conversation.last_activity_at)}</span>
                        </span>
                        <span className="row-subtitle clamp-2 recent-preview">{previewSnippet(conversation.last_message_preview, parseRichMessage)}</span>
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </Section>
        </>
      )}
      {fixSheet}
    </div>
  );
}

function Metric({ value, label, sub }: { value: number; label: string; sub: string }) {
  return (
    <div className="metric">
      <span className={`metric-value${value ? "" : " is-zero"}`}>{value}</span>
      <span className="metric-label">{label}</span>
      <span className="metric-sub">{sub}</span>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <>
      <Section title="Needs attention">
        {[0, 1].map((index) => (
          <div className="skel-row" key={index} aria-hidden="true">
            <span className="skel" style={{ width: 30, height: 30 }} />
            <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <SkeletonLine width={index ? "35%" : "50%"} />
              <SkeletonLine width={index ? "65%" : "75%"} />
            </span>
          </div>
        ))}
      </Section>
      <div className="section-card metrics" aria-busy="true" aria-label="Loading">
        {[0, 1, 2].map((index) => (
          <div className="metric" key={index}>
            <span className="skel" style={{ width: 32, height: 28 }} />
            <span className="skel skel-line" style={{ width: "70%", marginTop: 8 }} />
          </div>
        ))}
      </div>
    </>
  );
}
