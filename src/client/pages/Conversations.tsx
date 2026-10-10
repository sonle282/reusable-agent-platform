import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, post } from "../api";
import { displayName, formatDate, previewSnippet, timeSeparator } from "../format";
import { useFixAnswer } from "../FixSheet";
import { RichBubbles, parseRichMessage } from "../RichMessage";
import type { Connection, Conversation, TranscriptMessage } from "../types";
import { Avatar, Badge, Banner, Button, EmptyState, Icon, PageHeader, SearchField, Skeleton, SkeletonLine, Toggle, errorMessage, useToast } from "../ui";

const previewText = (value?: string) => previewSnippet(value, parseRichMessage);

type Detail = { conversation: Conversation & { custom_json?: string | null }; messages: TranscriptMessage[] };

// Split view: chats on the left, the transcript on the right (customer left, assistant and team right).
export function ConversationsPage({ agentId, connections, openId, onOpen, onOpenSettings }: { agentId: string; connections: Connection[]; openId?: string; onOpen: (id: string) => void; onOpenSettings: () => void }) {
  const toast = useToast();
  const { startFix, fixSheet } = useFixAnswer({ agentId, onOpenSettings });
  const [items, setItems] = useState<Conversation[] | null>(null);
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const [openMessage, setOpenMessage] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
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
    setOpenMessage(null);
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

  const channelName = (id?: string) => connections.find((connection) => connection.id === id)?.name;
  const selected = items?.find((item) => item.id === selectedId) ?? (detail?.conversation.id === selectedId ? detail?.conversation : undefined);
  const empty = items !== null && items.length === 0 && !query;

  return (
    <div className="page conversations-page">
      <PageHeader title="Conversations" />
      {listError && (
        <Banner
          tone="error"
          title="Couldn't load new messages"
          text={`${loadedAt ? `You're seeing chats up to ${formatDate(loadedAt.toISOString())}. ` : ""}Customers are still being answered.`}
          actions={
            <Button variant="gray" size="small" onClick={() => void load()}>
              Try again
            </Button>
          }
        />
      )}

      {empty ? (
        <div className="section-card">
          <EmptyState icon="bubbles" title="No conversations yet" text="When customers message you on a connected channel, every chat shows up here — and you can step in at any time." />
        </div>
      ) : (
        <div className="split">
          <div className="master">
            <SearchField value={query} onChange={setQuery} onSubmit={() => void load(query.trim())} placeholder="Search name or phone" />
            {items === null ? (
              listError ? null : <Skeleton rows={3} avatar />
            ) : items.length === 0 ? (
              <div className="section-card">
                <EmptyState icon="search" title="No matches" text="Try a name or the last digits of a phone number." />
              </div>
            ) : (
              <div className="section-card">
                {items.map((item) => {
                  const name = displayName(item);
                  const current = item.id === selectedId;
                  return (
                    <button type="button" key={item.id} className={`row top${current ? " is-selected" : ""}`} aria-current={current || undefined} onClick={() => onOpen(item.id)}>
                      <Avatar name={item.display_name ? name : undefined} tone={item.human_takeover ? "orange" : item.display_name ? "indigo" : undefined} />
                      <span className="row-body recent-body">
                        <span className="row-text">
                          <span className="recent-line">
                            <span className="row-title strong truncate">{name}</span>
                            <span className="spacer" />
                            <span className="row-detail conversation-time">{formatDate(item.last_activity_at)}</span>
                          </span>
                          <span className="row-subtitle clamp-2">{previewText(item.last_message_preview)}</span>
                          {(Boolean(item.human_takeover) || item.stage === "lead_captured") && (
                            <span className="conversation-tags">
                              {Boolean(item.human_takeover) && <Badge tone="orange">Your team is replying</Badge>}
                              {item.stage === "lead_captured" && <Badge tone="blue">New lead</Badge>}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="detail">
            {selected ? (
              <section className="transcript-pane" aria-labelledby="transcript-name">
                <div className="pane-head transcript-head">
                  <Avatar name={selected.display_name ? displayName(selected) : undefined} tone={selected.human_takeover ? "orange" : selected.display_name ? "indigo" : undefined} />
                  <div className="spacer transcript-who">
                    <div id="transcript-name" className="pane-title truncate">
                      {displayName(selected)}
                    </div>
                    <div className="pane-sub truncate">{[selected.phone, selected.email, channelName(selected.connection_id)].filter(Boolean).join(" · ") || "No contact details yet"}</div>
                  </div>
                  <label className="takeover">
                    <span>Your team replies</span>
                    <Toggle label="Your team replies" checked={Boolean(selected.human_takeover)} disabled={switching} onChange={(enabled) => void setTakeover(selected, enabled)} />
                  </label>
                </div>
                {Boolean(selected.human_takeover) && (
                  <div className="banner banner-info takeover-banner" role="status">
                    <Icon name="pause" size={18} />
                    <div className="banner-body">
                      <span className="banner-text">The assistant is paused here. Reply from the app this customer wrote in; turn this off to hand the chat back.</span>
                    </div>
                  </div>
                )}
                <div className="pane-scroll" ref={scroller}>
                  {detailError ? (
                    <div className="pane-banner pane-banner-top">
                      <Banner
                        tone="error"
                        title="Couldn't open this chat"
                        text={`${detailError}. The customer is not affected.`}
                        actions={
                          <Button variant="gray" size="small" onClick={() => void loadDetail(selected.id)}>
                            Try again
                          </Button>
                        }
                      />
                    </div>
                  ) : !detail ? (
                    <div className="chat" aria-busy="true">
                      <span className="skel" style={{ width: "60%", height: 36, borderRadius: 18 }} />
                      <span className="skel" style={{ alignSelf: "flex-end", width: "70%", height: 72, borderRadius: 18 }} />
                      <SkeletonLine width="40%" />
                    </div>
                  ) : detail.messages.length === 0 ? (
                    <EmptyState icon="bubbles" title="No messages yet" text="Messages appear here as soon as the customer writes." />
                  ) : (
                    <div className="chat">
                      {detail.messages.map((message, index) => {
                        const separator = timeSeparator(index ? detail.messages[index - 1].created_at : null, message.created_at);
                        const customer = message.role === "user";
                        const open = openMessage === message.id;
                        return (
                          <MessageGroup key={message.id} separator={separator}>
                            {customer ? (
                              <RichBubbles side="in" text={message.content} />
                            ) : (
                              <>
                                <div className="reply has-trace" onClick={() => setOpenMessage(open ? null : message.id)}>
                                  <RichBubbles side="out" text={message.content} selected={open} />
                                </div>
                                {open && (
                                  <span className="reply-meta">
                                    <span>Sent by the assistant · {formatDate(message.created_at)}</span>
                                    <Button
                                      variant="tinted"
                                      size="small"
                                      icon="wrench"
                                      onClick={() =>
                                        startFix({
                                          origin: "conversation",
                                          conversationId: selected.id,
                                          customerMessage: plainText([...detail.messages.slice(0, index)].reverse().find((item) => item.role === "user")?.content ?? ""),
                                          badReply: plainText(message.content),
                                        })
                                      }
                                    >
                                      Fix this answer
                                    </Button>
                                  </span>
                                )}
                              </>
                            )}
                          </MessageGroup>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="transcript-foot">
                  {selected.human_takeover ? "Your team is replying in this chat. The assistant stays quiet until you hand it back." : "The assistant replies automatically. Turn on Your team replies to step in."}
                </div>
              </section>
            ) : items && items.length > 0 ? (
              <div className="section-card">
                <EmptyState icon="bubbles" title="Choose a conversation" text="See the messages and contact details, and step in when needed." />
              </div>
            ) : null}
          </div>
        </div>
      )}
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
