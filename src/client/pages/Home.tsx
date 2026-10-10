import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { displayName, formatDate, parseDate, previewSnippet } from "../format";
import { parseRichMessage } from "../RichMessage";
import type { AgentSummary, Connection, Conversation, Dashboard } from "../types";
import { Avatar, Badge, Banner, Button, EmptyState, Icon, PageHeader, Section, SkeletonLine, errorMessage, type TileTone } from "../ui";

type Go = (page: "assistant" | "conversations" | "connections", ...params: string[]) => void;

type Attention = { id: string; tone: TileTone; icon: string; title: string; sub: string; label: string; act: () => void };

const DAY = 86_400_000;

// The owner's morning view: is the assistant live, what needs a person, how the last day went, what customers asked.
export function HomePage({
  agent,
  connections,
  liveVersion,
  unpublished,
  go,
}: {
  agent: AgentSummary;
  connections: Connection[];
  liveVersion: number | null;
  unpublished: boolean;
  go: Go;
}) {
  const [summary, setSummary] = useState<Dashboard | null>(null);
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [dashboard, list] = await Promise.all([api<Dashboard>("/api/admin/dashboard"), api<Conversation[]>("/api/admin/conversations")]);
      setSummary(dashboard);
      setConversations(list);
      setUpdatedAt(new Date());
      setError("");
    } catch (caught) {
      // Keep whatever was already on screen; say what happened and offer a retry.
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => void load(), [load]);

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

  // Items built from what the server already knows; Fix this answer adds more types later.
  const now = Date.now();
  const items: Attention[] = (conversations ?? []).flatMap<Attention>((conversation) => {
    const name = displayName(conversation);
    const at = parseDate(conversation.last_activity_at)?.getTime() ?? 0;
    if (conversation.human_takeover)
      return [{ id: `team-${conversation.id}`, tone: "soft-gray", icon: "pause", title: "Your team is replying", sub: `${name} · assistant paused · ${formatDate(conversation.last_activity_at)}`, label: "Open", act: () => go("conversations", conversation.id) }];
    if (conversation.stage === "lead_captured" && now - at < DAY)
      return [{ id: `lead-${conversation.id}`, tone: "soft-blue", icon: "person-plus", title: "New lead to contact", sub: `${name} left contact details · ${formatDate(conversation.last_activity_at)}`, label: "Open", act: () => go("conversations", conversation.id) }];
    return [];
  });
  const recent = conversations?.slice(0, 5) ?? [];

  return (
    <div className="page">
      <PageHeader title="Home" subtitle={today} />

      {error && (
        <Banner
          tone="error"
          title="Couldn't refresh Home"
          text={updatedAt ? `Showing what we had at ${formatDate(updatedAt.toISOString())}. Check your connection, then try again.` : "Check your connection, then try again."}
          actions={
            <Button variant="gray" size="small" busy={busy} onClick={() => void load()}>
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
          <Section title="Needs attention" badge={items.length ? <Badge count>{items.length}</Badge> : undefined}>
            {items.length ? (
              items.map((item) => (
                <div className="row" key={item.id}>
                  <span className={`tile tile-${item.tone}`} aria-hidden="true">
                    <Icon name={item.icon} size={18} />
                  </span>
                  <div className="row-body">
                    <div className="row-text">
                      <span className="row-title strong">{item.title}</span>
                      <span className="row-subtitle truncate">{item.sub}</span>
                    </div>
                    <div className="attn-actions">
                      <Button variant="gray" size="small" onClick={item.act}>
                        {item.label}
                      </Button>
                    </div>
                  </div>
                </div>
              ))
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
