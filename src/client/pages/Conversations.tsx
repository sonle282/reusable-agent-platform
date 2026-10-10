import { useEffect, useState } from "react";
import { api, post } from "../api";
import { displayName, previewSnippet } from "../format";
import { RichBubbles, parseRichMessage } from "../RichMessage";
import type { Conversation, TranscriptMessage } from "../types";
import { Banner, EmptyState, PageHeader, Row, SearchField, Section, Spinner, StatusBadge, Toggle, errorMessage, formatDate, useToast } from "../ui";

const previewText = (value?: string) => previewSnippet(value, parseRichMessage);

type Detail = { conversation: Conversation & { custom_json?: string | null }; messages: TranscriptMessage[] };

export function ConversationsPage() {
  const toast = useToast();
  const [items, setItems] = useState<Conversation[] | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  async function load(value = query) {
    setItems(await api<Conversation[]>(`/api/admin/conversations${value ? `?q=${encodeURIComponent(value)}` : ""}`));
  }
  async function open(id: string) {
    setSelectedId(id);
    setDetail(null);
    try {
      setDetail(await api<Detail>(`/api/admin/conversations/${encodeURIComponent(id)}`));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }
  useEffect(() => {
    void load("").catch((caught) => setError(errorMessage(caught)));
  }, []);
  async function setTakeover(conversation: Conversation, enabled: boolean) {
    try {
      await post(`/api/admin/conversations/${encodeURIComponent(conversation.id)}/takeover`, { enabled });
      toast(enabled ? "The assistant stopped replying in this chat" : "The assistant is replying again");
      await load();
      if (selectedId === conversation.id) await open(conversation.id);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }
  const selected = items?.find((item) => item.id === selectedId) ?? detail?.conversation;
  return (
    <div className="page">
      <PageHeader title="Conversations" subtitle="Every customer chat across your channels. Turn on “Your team replies” to pause the assistant in a chat." />
      {error && <Banner onClose={() => setError("")}>{error}</Banner>}
      {items && items.length === 0 && !query ? (
        <EmptyState icon="conversations" title="No conversations yet" text="Chats appear here when customers message you on a connected channel." />
      ) : (
        <div className={`master-detail ${selectedId ? "has-detail" : ""}`}>
          <div className="master">
            <SearchField value={query} onChange={setQuery} onSubmit={() => void load()} placeholder="Search name, phone or customer ID" />
            {!items ? (
              <div className="page-loading"><Spinner /></div>
            ) : items.length === 0 ? (
              <EmptyState icon="search" title="No matches" text="Try another name, phone number or customer ID." />
            ) : (
              <Section>
                {items.map((item) => (
                  <Row
                    key={item.id}
                    icon="person"
                    tone={item.human_takeover ? "orange" : "blue"}
                    title={displayName(item)}
                    subtitle={previewText(item.last_message_preview)}
                    detail={<small>{formatDate(item.last_activity_at)}</small>}
                    selected={item.id === selectedId}
                    onClick={() => void open(item.id)}
                  />
                ))}
              </Section>
            )}
          </div>
          <div className="detail">
            {!selectedId || !selected ? (
              <EmptyState icon="conversations" title="Choose a conversation" text="See the messages and contact details, and take over when needed." />
            ) : (
              <>
                <button className="back-link mobile-only" onClick={() => setSelectedId(null)}>
                  ‹ Conversations
                </button>
                <Section>
                  <Row title={displayName(selected)} subtitle={[selected.phone, selected.email].filter(Boolean).join(" · ") || "No contact details yet"} accessory={<StatusBadge value={selected.stage} />} />
                  <Row
                    title="Your team replies"
                    subtitle="The assistant stays quiet while this is on"
                    accessory={<Toggle label="Your team replies" checked={Boolean(selected.human_takeover)} onChange={(enabled) => void setTakeover(selected, enabled)} />}
                  />
                </Section>
                <div className="transcript">
                  {!detail ? (
                    <div className="page-loading"><Spinner /></div>
                  ) : detail.messages.length === 0 ? (
                    <p className="text-secondary center">No messages yet.</p>
                  ) : (
                    detail.messages.map((message) => (
                      <div className={`message-row ${message.role === "user" ? "user" : "assistant"}`} key={message.id}>
                        <RichBubbles role={message.role === "user" ? "user" : "assistant"} text={message.content} />
                        <time>{formatDate(message.created_at)}</time>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
