import { useEffect, useState } from "react";
import { api, post } from "../api";
import { RichBubbles, parseRichMessage } from "../RichMessage";
import type { Conversation, TranscriptMessage } from "../types";
import { Banner, EmptyState, PageHeader, Row, SearchField, Section, Spinner, StatusBadge, Toggle, errorMessage, formatDate, useToast } from "../ui";

const previewText = (value?: string) => (value ? parseRichMessage(value).find((part) => part.text)?.text ?? "Đã gửi hình ảnh" : "—");

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
      toast(enabled ? "Trợ lý đã dừng trả lời hội thoại này" : "Trợ lý trả lời lại");
      await load();
      if (selectedId === conversation.id) await open(conversation.id);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }
  const selected = items?.find((item) => item.id === selectedId) ?? detail?.conversation;
  return (
    <div className="page">
      <PageHeader title="Hội thoại" subtitle="Lịch sử khách hàng trên mọi kênh. Bật “Nhân viên xử lý” để tạm dừng trợ lý." />
      {error && <Banner onClose={() => setError("")}>{error}</Banner>}
      {items && items.length === 0 && !query ? (
        <EmptyState icon="conversations" title="Chưa có hội thoại" text="Hội thoại xuất hiện khi khách nhắn qua một kết nối." />
      ) : (
      <div className={`master-detail ${selectedId ? "has-detail" : ""}`}>
        <div className="master">
          <SearchField value={query} onChange={setQuery} onSubmit={() => void load()} placeholder="Tìm theo tên, số điện thoại, mã khách" />
          {!items ? (
            <div className="page-loading"><Spinner /></div>
          ) : items.length === 0 ? (
            <EmptyState icon="search" title="Không tìm thấy" text="Thử tên, số điện thoại hoặc mã khách khác." />
          ) : (
            <Section>
              {items.map((item) => (
                <Row
                  key={item.id}
                  icon="person"
                  iconTint={item.human_takeover ? "var(--orange)" : "var(--blue)"}
                  title={item.display_name || item.phone || item.external_user_id}
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
            <EmptyState icon="conversations" title="Chọn một hội thoại" text="Xem tin nhắn, thông tin liên hệ và tạm dừng trợ lý khi cần." />
          ) : (
            <>
              <button className="back-link mobile-only" onClick={() => setSelectedId(null)}>
                ‹ Hội thoại
              </button>
              <Section>
                <Row title={selected.display_name || selected.external_user_id} subtitle={[selected.phone, selected.email].filter(Boolean).join(" · ") || "Chưa có thông tin liên hệ"} accessory={<StatusBadge value={selected.stage} />} />
                <Row
                  title="Nhân viên xử lý"
                  subtitle="Trợ lý không trả lời khi bật"
                  accessory={<Toggle label="Nhân viên xử lý" checked={Boolean(selected.human_takeover)} onChange={(enabled) => void setTakeover(selected, enabled)} />}
                />
              </Section>
              <div className="transcript">
                {!detail ? (
                  <div className="page-loading"><Spinner /></div>
                ) : detail.messages.length === 0 ? (
                  <p className="text-secondary center">Chưa có tin nhắn.</p>
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
