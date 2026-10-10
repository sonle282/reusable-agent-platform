import { useEffect, useState, type FormEvent } from "react";
import { api, post } from "../api";
import type { AgentSummary, Connection, Delivery } from "../types";
import { Banner, Button, CopyField, EmptyState, FieldRow, PageHeader, Row, Section, Segmented, Sheet, StatusBadge, TextInput, errorMessage, formatDate, useToast } from "../ui";

type ConnectionType = "generic_api" | "generic_webhook" | "zernio";

const typeInfo: Record<ConnectionType, { label: string; icon: string; tint: string; description: string }> = {
  generic_api: { label: "API", icon: "bolt", tint: "var(--blue)", description: "Hệ thống của bạn gọi trợ lý qua HTTP và nhận câu trả lời ngay hoặc qua callback." },
  generic_webhook: { label: "Webhook", icon: "connections", tint: "var(--purple)", description: "Nhận sự kiện có chữ ký HMAC từ hệ thống khác; trả lời qua callback." },
  zernio: { label: "Zernio", icon: "conversations", tint: "var(--green)", description: "Kết nối hộp thư Zernio: nhận tin nhắn khách và tự trả lời." },
};

type Secrets = { apiKey?: string; webhookToken?: string; webhookPath?: string; type: ConnectionType };

export function ConnectionsPage({ agent, connections, reload }: { agent: AgentSummary; connections: Connection[]; reload: () => Promise<void> }) {
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [secrets, setSecrets] = useState<Secrets | null>(null);
  const [opened, setOpened] = useState<Connection | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [error, setError] = useState("");
  async function loadDeliveries() {
    setDeliveries(await api<Delivery[]>("/api/admin/deliveries"));
  }
  useEffect(() => {
    void loadDeliveries().catch(() => undefined);
  }, []);
  const failed = deliveries.filter((delivery) => delivery.status === "failed");
  return (
    <div className="page">
      <PageHeader
        title="Kết nối"
        subtitle="Đưa trợ lý vào các kênh. Mọi kênh dùng chung một trợ lý và cùng phiên bản đang chạy."
        actions={
          <Button icon="plus" onClick={() => setCreating(true)}>
            Thêm kết nối
          </Button>
        }
      />
      {!agent.active_version_id && <Banner tone="orange">Xuất bản trợ lý trước để kết nối có thể hoạt động.</Banner>}
      {error && <Banner onClose={() => setError("")}>{error}</Banner>}
      {failed.length > 0 && (
        <Section title={`Gửi không thành công · ${failed.length}`} footer="Thử lại an toàn: mỗi tin dùng cùng khoá idempotency nên kênh nhận không bị trùng.">
          {failed.map((delivery) => (
            <Row
              key={delivery.id}
              icon="warning"
              iconTint="var(--red)"
              title={connections.find((connection) => connection.id === delivery.connection_id)?.name ?? "Kết nối"}
              subtitle={`${delivery.last_error ?? "Lỗi không rõ"} · ${delivery.attempts} lần · ${formatDate(delivery.updated_at)}`}
              accessory={
                <Button
                  variant="gray"
                  size="small"
                  icon="refresh"
                  onClick={async () => {
                    try {
                      await post(`/api/admin/deliveries/${delivery.id}/retry`);
                      toast("Đã đưa vào hàng đợi gửi lại");
                      await loadDeliveries();
                    } catch (caught) {
                      setError(errorMessage(caught));
                    }
                  }}
                >
                  Thử lại
                </Button>
              }
            />
          ))}
        </Section>
      )}
      {connections.length === 0 ? (
        <EmptyState icon="connections" title="Chưa có kết nối" text="Thêm API cho hệ thống của bạn hoặc kết nối Zernio để trả lời khách." action={<Button onClick={() => setCreating(true)}>Thêm kết nối</Button>} />
      ) : (
        <Section>
          {connections.map((connection) => {
            const info = typeInfo[connection.type as ConnectionType] ?? typeInfo.generic_api;
            return (
              <Row
                key={connection.id}
                icon={info.icon}
                iconTint={info.tint}
                title={connection.name}
                subtitle={info.label}
                accessory={<StatusBadge value={connection.status} />}
                chevron
                onClick={() => setOpened(connection)}
              />
            );
          })}
        </Section>
      )}
      {creating && (
        <CreateConnectionSheet
          agent={agent}
          onClose={() => setCreating(false)}
          onDone={async (value) => {
            setCreating(false);
            setSecrets(value);
            await reload();
          }}
        />
      )}
      {secrets && <SecretsSheet secrets={secrets} onClose={() => setSecrets(null)} />}
      {opened && (
        <ConnectionSheet
          connection={opened}
          onClose={() => setOpened(null)}
          onSecrets={(value) => {
            setOpened(null);
            setSecrets(value);
          }}
          reload={async () => {
            await reload();
            setOpened(null);
          }}
        />
      )}
    </div>
  );
}

function CreateConnectionSheet({ agent, onClose, onDone }: { agent: AgentSummary; onClose: () => void; onDone: (secrets: Secrets) => void }) {
  const [type, setType] = useState<ConnectionType>("generic_api");
  const [form, setForm] = useState({ name: "", callbackUrl: "", inboxApiUrl: "", apiCredential: "", webhookSecret: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await post<{ id: string; apiKey: string; webhookToken: string; webhookPath: string }>("/api/admin/connections", {
        agentId: agent.id,
        type,
        name: form.name || typeInfo[type].label,
        callbackUrl: type === "zernio" ? null : form.callbackUrl || null,
        config: type === "zernio" ? { inboxApiUrl: form.inboxApiUrl } : {},
        apiCredential: type === "zernio" ? form.apiCredential : undefined,
        webhookSecret: type !== "generic_api" ? form.webhookSecret || undefined : undefined,
      });
      // Activate right away when the assistant is live; otherwise it stays a draft until publish.
      if (agent.active_version_id) await post(`/api/admin/connections/${result.id}/activate`).catch(() => undefined);
      onDone({ type, apiKey: type === "generic_api" ? result.apiKey : undefined, webhookToken: type === "generic_api" ? undefined : result.webhookToken, webhookPath: type === "generic_api" ? undefined : result.webhookPath });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  const valid = type !== "zernio" || (form.inboxApiUrl && form.apiCredential && form.webhookSecret);
  return (
    <Sheet
      title="Thêm kết nối"
      onClose={onClose}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>Huỷ</Button>
          <Button form="create-connection" busy={busy} disabled={!valid}>Tạo</Button>
        </>
      }
    >
      <form id="create-connection" className="sheet-form" onSubmit={submit}>
        <Segmented<ConnectionType>
          label="Loại kết nối"
          value={type}
          onChange={setType}
          options={[
            { value: "generic_api", label: "API" },
            { value: "zernio", label: "Zernio" },
            { value: "generic_webhook", label: "Webhook" },
          ]}
        />
        <p className="sheet-text">{typeInfo[type].description}</p>
        <Section>
          <FieldRow label="Tên">
            <TextInput value={form.name} placeholder={typeInfo[type].label} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </FieldRow>
          {type !== "zernio" && (
            <FieldRow label="Callback URL" hint={type === "generic_api" ? "Tuỳ chọn, cho chế độ async" : undefined}>
              <TextInput type="url" value={form.callbackUrl} placeholder="https://" onChange={(event) => setForm({ ...form, callbackUrl: event.target.value })} />
            </FieldRow>
          )}
          {type === "generic_webhook" && (
            <FieldRow label="Khoá ký HMAC">
              <TextInput type="password" autoComplete="off" value={form.webhookSecret} onChange={(event) => setForm({ ...form, webhookSecret: event.target.value })} />
            </FieldRow>
          )}
        </Section>
        {type === "zernio" && (
          <Section footer="Token và khoá ký được mã hoá khi lưu và không hiển thị lại.">
            <FieldRow label="Inbox API URL">
              <TextInput type="url" value={form.inboxApiUrl} placeholder="https://" onChange={(event) => setForm({ ...form, inboxApiUrl: event.target.value })} required />
            </FieldRow>
            <FieldRow label="API token">
              <TextInput type="password" autoComplete="off" value={form.apiCredential} onChange={(event) => setForm({ ...form, apiCredential: event.target.value })} required />
            </FieldRow>
            <FieldRow label="Khoá ký webhook">
              <TextInput type="password" autoComplete="off" value={form.webhookSecret} onChange={(event) => setForm({ ...form, webhookSecret: event.target.value })} required />
            </FieldRow>
          </Section>
        )}
        {error && <Banner>{error}</Banner>}
      </form>
    </Sheet>
  );
}

function SecretsSheet({ secrets, onClose }: { secrets: Secrets; onClose: () => void }) {
  const origin = window.location.origin;
  return (
    <Sheet title="Lưu thông tin kết nối" onClose={onClose} footer={<Button onClick={onClose}>Đã lưu</Button>}>
      <Banner tone="orange">Khoá chỉ hiển thị một lần. Lưu ngay vào hệ thống tích hợp hoặc trình quản lý mật khẩu.</Banner>
      {secrets.apiKey && (
        <>
          <CopyField label="Endpoint" value={`${origin}/api/v1/messages`} />
          <CopyField label="API key (Bearer)" value={secrets.apiKey} />
        </>
      )}
      {secrets.webhookPath && <CopyField label="Webhook URL" value={`${origin}${secrets.webhookPath}`} />}
    </Sheet>
  );
}

function ConnectionSheet({ connection, onClose, onSecrets, reload }: { connection: Connection; onClose: () => void; onSecrets: (secrets: Secrets) => void; reload: () => Promise<void> }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [error, setError] = useState("");
  const type = (connection.type as ConnectionType) in typeInfo ? (connection.type as ConnectionType) : "generic_api";
  const origin = window.location.origin;
  return (
    <Sheet title={connection.name} onClose={onClose}>
      <Section>
        <Row title="Loại" detail={typeInfo[type].label} />
        <Row title="Trạng thái" accessory={<StatusBadge value={connection.status} />} />
        {connection.callback_url && <Row title="Callback" subtitle={connection.callback_url} />}
        <Row title="Tạo lúc" detail={formatDate(connection.created_at)} />
      </Section>
      {type === "generic_api" && (
        <Section title="Cách gọi" plain>
          <pre className="code-block">{`POST ${origin}/api/v1/messages
Authorization: Bearer <API key>
Idempotency-Key: <mã duy nhất mỗi tin>

{ "conversation_id": "khach-123",
  "user_id": "khach-123",
  "message": { "text": "Xin chào" } }`}</pre>
        </Section>
      )}
      {error && <Banner>{error}</Banner>}
      <div className="sheet-actions">
        {connection.status !== "active" && (
          <Button
            busy={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await post(`/api/admin/connections/${connection.id}/activate`);
                toast("Đã kích hoạt");
                await reload();
              } catch (caught) {
                setError(errorMessage(caught));
              } finally {
                setBusy(false);
              }
            }}
          >
            Kích hoạt
          </Button>
        )}
        {confirmRotate ? (
          <>
            <p className="sheet-text">Khoá cũ ngừng hoạt động ngay. Hệ thống đang dùng khoá cũ sẽ bị từ chối cho đến khi cập nhật khoá mới.</p>
            <Button
              variant="destructive"
              busy={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await post<{ apiKey: string; webhookToken: string }>(`/api/admin/connections/${connection.id}/rotate`);
                  onSecrets(
                    type === "generic_api"
                      ? { type, apiKey: result.apiKey }
                      : { type, webhookToken: result.webhookToken, webhookPath: `/api/v1/webhooks/${type === "zernio" ? "zernio" : "generic"}/${result.webhookToken}` },
                  );
                } catch (caught) {
                  setError(errorMessage(caught));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Tạo khoá mới
            </Button>
          </>
        ) : (
          <Button variant="gray" onClick={() => setConfirmRotate(true)}>
            {type === "generic_api" ? "Đổi API key" : "Đổi webhook URL"}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
