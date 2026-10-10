import { useEffect, useState } from "react";
import { api } from "../api";
import { previewSnippet } from "../format";
import { parseRichMessage } from "../RichMessage";
import type { AgentSummary, Conversation, Dashboard } from "../types";
import { Badge, Banner, EmptyState, PageHeader, Row, Section, errorMessage, formatDate } from "../ui";

type Go = (page: "assistant" | "conversations" | "connections") => void;

// The owner's morning view: is the assistant live, what needs a person, what customers asked.
export function HomePage({ agent, go }: { agent: AgentSummary; go: Go }) {
  const [summary, setSummary] = useState<Dashboard | null>(null);
  const [recent, setRecent] = useState<Conversation[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void Promise.all([api<Dashboard>("/api/admin/dashboard"), api<Conversation[]>("/api/admin/conversations")])
      .then(([dashboard, conversations]) => {
        setSummary(dashboard);
        setRecent(conversations.slice(0, 5));
      })
      .catch((caught) => setError(errorMessage(caught)));
  }, []);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const tiles = summary
    ? [
        { label: "Chats in the last 24 hours", value: summary.chats24h, hint: `${summary.chats7d} this week`, go: () => go("conversations"), tone: "" },
        { label: "Waiting for your team", value: summary.waitingForTeam, hint: summary.waitingForTeam ? "Reply in Conversations" : "All handled", go: () => go("conversations"), tone: summary.waitingForTeam ? "orange" : "" },
        { label: "Replies not delivered", value: summary.failedDeliveries, hint: summary.failedDeliveries ? "Retry in Channels" : "All delivered", go: () => go("connections"), tone: summary.failedDeliveries ? "red" : "" },
      ]
    : null;
  return (
    <div className="page">
      <PageHeader title="Home" subtitle={today} />
      {error && <Banner onClose={() => setError("")}>{`Couldn't load today's numbers. ${error}`}</Banner>}
      <Section>
        <Row
          icon="assistant"
          iconTint={agent.active_version_id ? "var(--green)" : "var(--gray)"}
          title={agent.name}
          subtitle={agent.active_version_id ? "Answering customers" : "Not live yet — test it, then publish"}
          accessory={agent.active_version_id ? <Badge tone="green">Live</Badge> : <Badge>Draft</Badge>}
          chevron
          onClick={() => go("assistant")}
        />
      </Section>
      <div className="summary" aria-busy={!tiles}>
        {(tiles ?? [0, 1, 2].map(() => null)).map((tile, index) =>
          tile ? (
            <button key={tile.label} className={`summary-tile ${tile.tone}`} onClick={tile.go}>
              <span className="summary-value">{tile.value}</span>
              <span className="summary-label">{tile.label}</span>
              <span className="summary-hint">{tile.hint}</span>
            </button>
          ) : (
            <div key={index} className="summary-tile placeholder" aria-hidden="true" />
          ),
        )}
      </div>
      <Section title="Recent conversations" action={recent && recent.length > 0 ? <button className="btn btn-plain btn-small" onClick={() => go("conversations")}>See all</button> : undefined}>
        {recent && recent.length === 0 && <EmptyState icon="conversations" title="No conversations yet" text="Chats appear here when customers message you on a connected channel." />}
        {recent?.map((conversation) => (
          <Row
            key={conversation.id}
            icon="person"
            iconTint={conversation.human_takeover ? "var(--orange)" : "var(--blue)"}
            title={conversation.display_name || conversation.phone || conversation.external_user_id}
            subtitle={previewSnippet(conversation.last_message_preview, parseRichMessage)}
            detail={<small>{formatDate(conversation.last_activity_at)}</small>}
            onClick={() => go("conversations")}
          />
        ))}
      </Section>
    </div>
  );
}
