import { useEffect, useState, type FormEvent } from "react";
import { api, post } from "../api";
import type { AgentSummary, Connection, Delivery } from "../types";
import { Banner, Button, CopyField, EmptyState, FieldRow, PageHeader, Row, Section, Segmented, Sheet, StatusBadge, TextInput, errorMessage, formatDate, useToast, type TileTone } from "../ui";

type ConnectionType = "generic_api" | "generic_webhook" | "zernio";

const typeInfo: Record<ConnectionType, { label: string; icon: string; tint: TileTone; description: string }> = {
  generic_api: { label: "API", icon: "bolt", tint: "blue", description: "Your website, app or CRM sends customer messages over HTTP and gets replies instantly or by callback." },
  generic_webhook: { label: "Webhook", icon: "connections", tint: "indigo", description: "Receive HMAC-signed events from another system; replies go to your callback URL." },
  zernio: { label: "Zernio", icon: "conversations", tint: "green", description: "Connect a Zernio inbox so the assistant replies to customer messages there." },
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
        title="Channels"
        subtitle="Where customers reach your assistant. Every channel uses the same assistant and the live version."
        actions={
          <Button icon="plus" onClick={() => setCreating(true)}>
            Add channel
          </Button>
        }
      />
      {!agent.active_version_id && <Banner tone="orange">Publish the assistant first so channels can reply.</Banner>}
      {error && <Banner onClose={() => setError("")}>{error}</Banner>}
      {failed.length > 0 && (
        <Section title={`Replies not delivered · ${failed.length}`} footer="Retrying is safe: each reply keeps the same idempotency key, so customers never get duplicates.">
          {failed.map((delivery) => (
            <Row
              key={delivery.id}
              icon="warning"
              tone="soft-red"
              title={connections.find((connection) => connection.id === delivery.connection_id)?.name ?? "Channel"}
              subtitle={`${delivery.last_error ?? "Unknown error"} · ${delivery.attempts} attempts · ${formatDate(delivery.updated_at)}`}
              accessory={
                <Button
                  variant="gray"
                  size="small"
                  icon="refresh"
                  onClick={async () => {
                    try {
                      await post(`/api/admin/deliveries/${delivery.id}/retry`);
                      toast("Queued to send again");
                      await loadDeliveries();
                    } catch (caught) {
                      setError(errorMessage(caught));
                    }
                  }}
                >
                  Retry
                </Button>
              }
            />
          ))}
        </Section>
      )}
      {connections.length === 0 ? (
        <EmptyState icon="connections" title="No channels yet" text="Connect your website or app through the API, or connect a Zernio inbox." action={<Button onClick={() => setCreating(true)}>Add channel</Button>} />
      ) : (
        <Section>
          {connections.map((connection) => {
            const info = typeInfo[connection.type as ConnectionType] ?? typeInfo.generic_api;
            return (
              <Row
                key={connection.id}
                icon={info.icon}
                tone={info.tint}
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
      // Activate right away when the assistant is live; otherwise it waits for the first publish.
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
      title="Add channel"
      onClose={onClose}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>Cancel</Button>
          <Button form="create-connection" busy={busy} disabled={!valid}>Add</Button>
        </>
      }
    >
      <form id="create-connection" className="sheet-form" onSubmit={submit}>
        <Segmented<ConnectionType>
          label="Channel type"
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
          <FieldRow label="Name">
            <TextInput value={form.name} placeholder={typeInfo[type].label} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </FieldRow>
          {type !== "zernio" && (
            <FieldRow label="Callback URL" hint={type === "generic_api" ? "Optional, for async replies" : undefined}>
              <TextInput type="url" value={form.callbackUrl} placeholder="https://" onChange={(event) => setForm({ ...form, callbackUrl: event.target.value })} />
            </FieldRow>
          )}
          {type === "generic_webhook" && (
            <FieldRow label="Signing secret">
              <TextInput type="password" autoComplete="off" value={form.webhookSecret} onChange={(event) => setForm({ ...form, webhookSecret: event.target.value })} />
            </FieldRow>
          )}
        </Section>
        {type === "zernio" && (
          <Section footer="The token and signing secret are encrypted when saved and never shown again.">
            <FieldRow label="Inbox API URL">
              <TextInput type="url" value={form.inboxApiUrl} placeholder="https://" onChange={(event) => setForm({ ...form, inboxApiUrl: event.target.value })} required />
            </FieldRow>
            <FieldRow label="API token">
              <TextInput type="password" autoComplete="off" value={form.apiCredential} onChange={(event) => setForm({ ...form, apiCredential: event.target.value })} required />
            </FieldRow>
            <FieldRow label="Webhook signing secret">
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
    <Sheet title="Save these details" onClose={onClose} footer={<Button onClick={onClose}>Done</Button>}>
      <Banner tone="orange">The key is shown only once. Save it now in your integration or password manager.</Banner>
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
        <Row title="Type" detail={typeInfo[type].label} />
        <Row title="Status" accessory={<StatusBadge value={connection.status} />} />
        {connection.callback_url && <Row title="Callback" subtitle={connection.callback_url} />}
        <Row title="Created" detail={formatDate(connection.created_at)} />
      </Section>
      {type === "generic_api" && (
        <Section title="How to call it" plain>
          <pre className="code-block">{`POST ${origin}/api/v1/messages
Authorization: Bearer <API key>
Idempotency-Key: <unique id per message>

{ "conversation_id": "customer-123",
  "user_id": "customer-123",
  "message": { "text": "Hello" } }`}</pre>
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
                toast("Channel turned on");
                await reload();
              } catch (caught) {
                setError(errorMessage(caught));
              } finally {
                setBusy(false);
              }
            }}
          >
            Turn on
          </Button>
        )}
        {confirmRotate ? (
          <>
            <p className="sheet-text">The current key stops working immediately. Anything using it is rejected until you update it with the new key.</p>
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
              Create new key
            </Button>
          </>
        ) : (
          <Button variant="gray" onClick={() => setConfirmRotate(true)}>
            {type === "generic_api" ? "Replace API key" : "Replace webhook URL"}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
