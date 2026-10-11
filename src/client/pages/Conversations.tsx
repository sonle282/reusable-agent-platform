import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, post } from "../api";
import { displayName, formatDate, previewSnippet, timeSeparator } from "../format";
import { useFixAnswer } from "../FixSheet";
import { RichBubbles, parseRichMessage } from "../RichMessage";
import type { Connection, Conversation, TranscriptMessage } from "../types";

// "Messenger via Zernio", "API" — how this chat reaches the customer.
const channelLabel = (connection?: Connection) => {
  if (!connection) return "";
  const name = platformName[platformOf(connection)] ?? connection.name;
  return connection.type === "zernio" ? `${name} via Zernio` : connection.name || name;
};
import { formatPhone } from "../../shared/contact";
import { platformName, platformOf } from "../platform";
import { AgentAvatar, Alert, AvatarWithChannel, Badge, Button, Chips, Dialog, EmptyState, errorMessage, Icon, Menu, SearchField, Skeleton, SkeletonLine, Switch, useToast } from "../ui";

const previewText = (value?: string) => previewSnippet(value, parseRichMessage);

type Detail = { conversation: Conversation & { custom_json?: string | null }; messages: TranscriptMessage[] };

// Full-height split: chats on the left, the thread on the right (customer as a gray bubble on the right, the assistant as plain text).
export function ConversationsPage({ agentId, agentName, connections, openId, onOpen, onOpenSettings }: { agentId: string; agentName: string; connections: Connection[]; openId?: string; onOpen: (id?: string) => void; onOpenSettings: () => void }) {
  const toast = useToast();
  const { startFix, fixSheet } = useFixAnswer({ agentId, onOpenSettings });
  const [items, setItems] = useState<Conversation[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "leads" | "team">("all");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [switching, setSwitching] = useState(false);
  const [erasing, setErasing] = useState<"ask" | "busy" | null>(null);
  const [moving, setMoving] = useState<"ask" | "busy" | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const selectedId = openId ?? items?.[0]?.id;

  async function load(value = query) {
    try {
      setItems(await api<Conversation[]>(`/api/admin/conversations${value ? `?q=${encodeURIComponent(value)}` : ""}`));
      setLoadedAt(new Date());
      setListError(null);
    } catch (caught) {
      setListError(errorMessage(caught));
    }
  }
  async function loadDetail(id: string) {
    try {
      setDetail(await api<Detail>(`/api/admin/conversations/${encodeURIComponent(id)}`));
      setDetailError(null);
    } catch (caught) {
      setDetailError(errorMessage(caught));
    }
  }
  useEffect(() => void load(""), []);
  // Search as the owner types, without a request per keystroke.
  useEffect(() => {
    if (items === null) return;
    const timer = setTimeout(() => void load(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    setDetail(null);
    if (selectedId) void loadDetail(selectedId);
  }, [selectedId]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [detail]);

  async function setTakeover(conversation: Conversation, enabled: boolean) {
    setSwitching(true);
    try {
      await post(`/api/admin/conversations/${encodeURIComponent(conversation.id)}/takeover`, { enabled });
      toast(enabled ? "The assistant is paused in this chat" : "The assistant is replying again");
      await Promise.all([load(), loadDetail(conversation.id)]);
    } catch (caught) {
      toast(errorMessage(caught, "Couldn't change who replies"), "error");
    } finally {
      setSwitching(false);
    }
  }

  // Hands the owner a JSON file of everything we hold about this customer (all their chats).
  async function exportCustomer(conversation: Conversation) {
    try {
      const data = await api<unknown>(`/api/admin/conversations/${encodeURIComponent(conversation.id)}/customer-data`);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      link.download = `customer-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast("Customer data downloaded");
    } catch (caught) {
      toast(errorMessage(caught, "Couldn't export the customer data"), "error");
    }
  }
  async function useLiveVersion(conversation: Conversation) {
    setMoving("busy");
    try {
      const result = await post<{ from: number | null; version: number | null }>(`/api/admin/conversations/${encodeURIComponent(conversation.id)}/use-live`);
      toast(result.from === result.version ? `This chat already uses version ${result.version}` : `This chat now uses version ${result.version}`);
    } catch (caught) {
      toast(errorMessage(caught, "Couldn't switch the version"), "error");
    } finally {
      setMoving(null);
    }
  }
  async function eraseCustomer(conversation: Conversation) {
    setErasing("busy");
    try {
      await post(`/api/admin/conversations/${encodeURIComponent(conversation.id)}/erase`, { confirm: true });
      toast("Customer data erased");
      await Promise.all([load(), loadDetail(conversation.id)]);
    } catch (caught) {
      toast(errorMessage(caught, "Couldn't erase the customer data"), "error");
    } finally {
      setErasing(null);
    }
  }

  const channelOf = (id?: string) => connections.find((connection) => connection.id === id);
  const selected = items?.find((item) => item.id === selectedId) ?? (detail?.conversation.id === selectedId ? detail?.conversation : undefined);
  const shown = (items ?? []).filter((item) => filter === "all" || (filter === "leads" ? item.stage === "lead_captured" : Boolean(item.human_takeover)));
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied");
    } catch {
      toast("Couldn't copy. Select the text and copy it.", "error");
    }
  };

  return (
    <div className="split">
      <section className={`split-list${openId ? " is-hidden-phone" : ""}`} aria-labelledby="conversations-title">
        <div className="split-list-head">
          <h1 id="conversations-title" style={{ margin: 0, font: "var(--text-heading-md)", letterSpacing: "var(--track-heading)" }}>
            Conversations
          </h1>
          <SearchField value={query} onChange={setQuery} onSubmit={() => void load(query.trim())} placeholder="Search name or phone" />
          <Chips
            label="Filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "leads", label: "Leads", count: items?.filter((item) => item.stage === "lead_captured").length || undefined },
              { value: "team", label: "Your team", count: items?.filter((item) => item.human_takeover).length || undefined },
            ]}
          />
        </div>
        <div className="split-scroll">
          {listError && (
            <div style={{ padding: "0 16px 12px" }}>
              <Alert
                tone="danger"
                title="Couldn't load new messages"
                text={`${loadedAt ? `Showing chats up to ${formatDate(loadedAt.toISOString())}. ` : ""}Customers are still being answered.`}
                actions={
                  <Button variant="outline" size="sm" onClick={() => void load()}>
                    Try again
                  </Button>
                }
              />
            </div>
          )}
          {items === null ? (
            listError ? null : <Skeleton rows={3} avatar card={false} />
          ) : items.length === 0 && !query ? (
            <EmptyState icon="chats" title="No conversations yet" text="When customers message a connected channel, every chat shows up here — and you can step in at any time." />
          ) : shown.length === 0 ? (
            <EmptyState icon="search" title="No matches" text={query ? "Try a name or the last digits of a phone number." : "No chats with this filter."} />
          ) : (
            shown.map((item) => {
              const name = displayName(item);
              const current = item.id === selectedId;
              return (
                <button type="button" key={item.id} className={`row top${current ? " is-selected" : ""}`} style={{ borderTop: 0 }} aria-current={current || undefined} onClick={() => onOpen(item.id)}>
                  <AvatarWithChannel name={item.display_name ? name : undefined} platform={platformOf(channelOf(item.connection_id))} />
                  <span className="row-text">
                    <span className="row-flex">
                      <span className="row-title truncate">{name}</span>
                      <span className="spacer" />
                      <span className="row-meta">{formatDate(item.last_activity_at)}</span>
                    </span>
                    <span className="row-sub clamp-2">{previewText(item.last_message_preview)}</span>
                    {(Boolean(item.human_takeover) || item.stage === "lead_captured") && (
                      <span className="row-flex" style={{ gap: 6, marginTop: 2 }}>
                        {Boolean(item.human_takeover) && <Badge tone="warning">Your team is replying</Badge>}
                        {item.stage === "lead_captured" && <Badge tone="info">New lead</Badge>}
                      </span>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </section>

      <section className={`split-detail${openId ? "" : " is-hidden-phone"}`} aria-labelledby="thread-name">
        {selected ? (
          <>
            <div className="thread-head">
              <Button variant="ghost" icon="chevron-left" className="back-link" aria-label="Back to conversations" onClick={() => onOpen(undefined)} />
              <AvatarWithChannel name={selected.display_name ? displayName(selected) : undefined} platform={platformOf(channelOf(selected.connection_id))} />
              <div className="spacer stack" style={{ gap: 0, minWidth: 160 }}>
                <span id="thread-name" className="strong truncate">
                  {displayName(selected)}
                </span>
                <span className="xs t2 truncate">
                  {selected.erased_at ? `Customer data erased ${formatDate(selected.erased_at)}` : [channelLabel(channelOf(selected.connection_id)), formatPhone(selected.phone), selected.email].filter(Boolean).join(" · ") || "No contact details yet"}
                </span>
              </div>
              <label className="row-flex" style={{ gap: 10 }}>
                <span className="medium">Your team replies</span>
                <Switch label="Your team replies" checked={Boolean(selected.human_takeover)} disabled={switching} onChange={(enabled) => void setTakeover(selected, enabled)} />
              </label>
              <Menu
                label="Conversation actions"
                size="md"
                items={[
                  { group: "Assistant" },
                  { label: "Use the live version…", icon: "reload", onSelect: () => setMoving("ask") },
                  { separator: true },
                  { group: "Customer data" },
                  { label: "Export", icon: "download", onSelect: () => void exportCustomer(selected) },
                  { label: "Erase…", icon: "trash", destructive: true, onSelect: () => setErasing("ask") },
                ]}
              />
            </div>
            {Boolean(selected.human_takeover) && (
              <div className="alert-box alert-info thread-alert" role="status">
                <Icon name="pause" />
                <div className="alert-body">
                  <span className="alert-text" style={{ color: "var(--color-text)" }}>
                    The assistant is paused here. Reply from the app this customer wrote in; turn this off to hand the chat back.
                  </span>
                </div>
              </div>
            )}
            <div className="thread-scroll" ref={scroller}>
              {detailError ? (
                <div className="thread">
                  <Alert
                    tone="danger"
                    title="Couldn't open this chat"
                    text={`${detailError}. The customer is not affected.`}
                    actions={
                      <Button variant="outline" size="sm" onClick={() => void loadDetail(selected.id)}>
                        Try again
                      </Button>
                    }
                  />
                </div>
              ) : !detail ? (
                <div className="thread" aria-busy="true">
                  <span className="skel" style={{ alignSelf: "flex-end", width: "60%", height: 40, borderRadius: 20 }} />
                  <span className="skel" style={{ width: "80%", height: 72 }} />
                  <SkeletonLine width="40%" />
                </div>
              ) : detail.messages.length === 0 ? (
                <EmptyState icon="chats" title="No messages yet" text="Messages appear here as soon as the customer writes." />
              ) : (
                <div className="thread">
                  {detail.messages.map((message, index) => {
                    const separator = timeSeparator(index ? detail.messages[index - 1].created_at : null, message.created_at);
                    if (message.role === "user")
                      return (
                        <MessageGroup key={message.id} separator={separator}>
                          <RichBubbles side="customer" text={message.content} />
                        </MessageGroup>
                      );
                    return (
                      <MessageGroup key={message.id} separator={separator}>
                        <div className="msg-ai">
                          <span className="row-flex xs t3" style={{ gap: 6 }}>
                            <AgentAvatar id={agentId} name={agentName} size="xs" />
                            {agentName} · {formatDate(message.created_at)}
                          </span>
                          <RichBubbles side="assistant" text={message.content} />
                          <div className="msg-actions">
                            <button type="button" className="msg-action" aria-label="Copy reply" onClick={() => void copy(plainText(message.content))}>
                              <Icon name="copy" size={16} />
                            </button>
                            <button
                              type="button"
                              className="msg-action"
                              onClick={() =>
                                startFix({
                                  origin: "conversation",
                                  conversationId: selected.id,
                                  customerMessage: plainText([...detail.messages.slice(0, index)].reverse().find((item) => item.role === "user")?.content ?? ""),
                                  badReply: plainText(message.content),
                                })
                              }
                            >
                              <Icon name="wrench" size={16} />
                              Fix this answer
                            </button>
                          </div>
                        </div>
                      </MessageGroup>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="thread-foot">{selected.human_takeover ? "Your team is replying in this chat. The assistant stays quiet until you hand it back." : "The assistant replies automatically. Turn on Your team replies to step in."}</div>
            {moving && (
              <Dialog
                title="Use the live version in this chat?"
                text="Chats keep the version they started on. This one switches to the version customers see now; the chat history stays. Other chats are not affected."
                confirmLabel="Switch"
                busy={moving === "busy"}
                onCancel={() => setMoving(null)}
                onConfirm={() => void useLiveVersion(selected)}
              />
            )}
            {erasing && (
              <Dialog
                title="Erase this customer's data?"
                text="Their name, phone, email and every chat with them are deleted for good. Export first if you need a copy. Business data and fixes you made stay."
                confirmLabel="Erase"
                destructive
                busy={erasing === "busy"}
                onCancel={() => setErasing(null)}
                onConfirm={() => void eraseCustomer(selected)}
              />
            )}
          </>
        ) : (
          items &&
          items.length > 0 && (
            <div className="thread-scroll">
              <EmptyState icon="chats" title="Choose a conversation" text="See the messages and contact details, and step in when needed." />
            </div>
          )
        )}
      </section>
      {fixSheet}
    </div>
  );
}

const plainText = (value: string) =>
  parseRichMessage(value)
    .map((part) => part.text ?? "")
    .filter(Boolean)
    .join("\n");

function MessageGroup({ separator, children }: { separator: string | null; children: ReactNode }) {
  return (
    <>
      {separator && <span className="time-sep">{separator}</span>}
      {children}
    </>
  );
}
