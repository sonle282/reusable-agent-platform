import { useEffect, useState, type FormEvent } from "react";
import { api, patch, post } from "../api";
import { formatDate, parseDate } from "../format";
import type { AgentSummary, Connection, Delivery } from "../types";
import { Alert, Badge, Banner, Button, CopyField, Disclosure, EmptyState, FieldRow, Icon, PageHeader, Section, Segmented, Sheet, TextInput, errorMessage, useToast, type TileTone } from "../ui";

type ConnectionType = "generic_api" | "generic_webhook" | "zernio";

const typeInfo: Record<
  ConnectionType,
  {
    label: string;
    name: string;
    icon: string;
    tone: TileTone;
    sub: string;
    help: string;
  }
> = {
  zernio: {
    label: "Zernio",
    name: "Zernio inbox",
    icon: "inbox",
    tone: "green",
    sub: "Reply in your Zernio inbox",
    help: "Connect a Zernio inbox so the assistant replies to customer messages there.",
  },
  generic_webhook: {
    label: "Webhook",
    name: "Webhook",
    icon: "webhook",
    tone: "indigo",
    sub: "Another system sends signed events",
    help: "Another system sends signed events; replies go to the address you give.",
  },
  generic_api: {
    label: "API",
    name: "API",
    icon: "bolt",
    tone: "blue",
    sub: "Your website, app or CRM",
    help: "Your website, app or CRM sends customer messages and gets replies right away or at an address you give.",
  },
};
const order: ConnectionType[] = ["zernio", "generic_webhook", "generic_api"];
const infoOf = (connection: Connection) => typeInfo[connection.type as ConnectionType] ?? typeInfo.generic_api;
const keyHintOf = (connection: Connection) => {
  try {
    return (JSON.parse(connection.config_json || "{}") as { keyHint?: string }).keyHint;
  } catch {
    return undefined;
  }
};

type Secrets = { apiKey?: string; webhookPath?: string; type: ConnectionType };

export function ConnectionsPage({ agent, connections, reload, onOpenAssistant }: { agent: AgentSummary; connections: Connection[]; reload: () => Promise<void>; onOpenAssistant: () => void }) {
  const toast = useToast();
  const [creating, setCreating] = useState<ConnectionType | null>(null);
  const [secrets, setSecrets] = useState<Secrets | null>(null);
  const [opened, setOpened] = useState<Connection | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function loadDeliveries() {
    try {
      setDeliveries(await api<Delivery[]>("/api/admin/deliveries"));
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }
  useEffect(() => void loadDeliveries(), []);
  const failed = (deliveries ?? []).filter((delivery) => delivery.status === "failed");
  const failedFor = (connectionId: string) => failed.filter((delivery) => delivery.connection_id === connectionId).length;
  const nameOf = (connectionId: string) => connections.find((connection) => connection.id === connectionId)?.name ?? "a channel";

  async function retry(ids: string[], key: string) {
    setRetrying(key);
    try {
      for (const deliveryId of ids) await post(`/api/admin/deliveries/${deliveryId}/retry`);
      toast(ids.length === 1 ? "Sending it again" : `Sending ${ids.length} replies again`);
      await Promise.all([loadDeliveries(), reload()]);
    } catch (caught) {
      toast(errorMessage(caught, "Couldn't retry"), "error");
    } finally {
      setRetrying(null);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Channels"
        subtitle="Where customers reach your assistant."
        actions={
          <Button icon="plus" onClick={() => setCreating("generic_api")}>
            Add channel
          </Button>
        }
      />
      <div className="form-col">
        {!agent.active_version_id && connections.length > 0 && (
          <Banner
            tone="warning"
            title="Channels can't reply yet"
            text="Publish the assistant first; channels always use the live version."
            actions={
              <Button variant="gray" size="small" onClick={onOpenAssistant}>
                Open Assistant
              </Button>
            }
          />
        )}
        {error && (
          <Banner
            tone="error"
            title="Couldn't check deliveries"
            text={`${error}. Customers are still being answered.`}
            actions={
              <Button variant="gray" size="small" onClick={() => void loadDeliveries()}>
                Try again
              </Button>
            }
          />
        )}

        {failed.length > 0 && (
          <Section
            title="Replies not delivered"
            badge={<span className="badge badge-count badge-count-red">{failed.length}</span>}
            action={
              failed.length > 1 ? (
                <Button
                  variant="plain"
                  busy={retrying === "all"}
                  onClick={() =>
                    void retry(
                      failed.map((delivery) => delivery.id),
                      "all",
                    )
                  }
                >
                  Retry all
                </Button>
              ) : undefined
            }
            footer="Customers haven't received these replies yet. Retrying never sends a reply twice."
          >
            {failed.map((delivery) => (
              <div className="row" key={delivery.id}>
                <span className="tile tile-soft-red" aria-hidden="true">
                  <Icon name="warning" size={18} />
                </span>
                <div className="row-body">
                  <span className="row-text">
                    <span className="row-title">
                      Reply on {nameOf(delivery.connection_id)} · {formatDate(delivery.updated_at)}
                    </span>
                    <span className="row-subtitle truncate">{plainError(delivery.last_error)}</span>
                  </span>
                  <Button variant="gray" size="small" busy={retrying === delivery.id} onClick={() => void retry([delivery.id], delivery.id)}>
                    Retry
                  </Button>
                </div>
              </div>
            ))}
          </Section>
        )}

        {connections.length === 0 ? (
          <div className="section-card">
            <EmptyState icon="link" title="No channels yet" text="Connect a channel so customers can reach your assistant. Every channel uses the live version." />
          </div>
        ) : (
          <Section title="Connected" footer="Every channel uses the same assistant and its live version.">
            {connections.map((connection) => {
              const info = infoOf(connection);
              const failures = failedFor(connection.id);
              const off = connection.status !== "active";
              return (
                <button type="button" className="row" key={connection.id} onClick={() => setOpened(connection)}>
                  <span className={`tile tile-${off ? "gray" : info.tone}`} aria-hidden="true">
                    <Icon name={info.icon} size={18} />
                  </span>
                  <span className="row-body">
                    <span className="row-text">
                      <span className="row-title">{connection.name}</span>
                      <span className="row-subtitle">
                        {info.label}
                        {connection.created_at ? ` · added ${formatDate(connection.created_at)}` : ""}
                      </span>
                    </span>
                    {failures > 0 && <Badge tone="red">{failures} not delivered</Badge>}
                    {off && failures === 0 && <Badge tone="neutral">{connection.status === "draft" ? "Not on yet" : "Off"}</Badge>}
                    <Icon name="chevron-right" className="row-chevron" size={14} />
                  </span>
                </button>
              );
            })}
          </Section>
        )}

        <Section title={connections.length ? "Add another channel" : "Add a channel"}>
          {order.map((type) => (
            <button type="button" className="row" key={type} onClick={() => setCreating(type)}>
              <span className={`tile tile-${typeInfo[type].tone}`} aria-hidden="true">
                <Icon name={typeInfo[type].icon} size={18} />
              </span>
              <span className="row-body">
                <span className="row-text">
                  <span className="row-title">{typeInfo[type].name}</span>
                  <span className="row-subtitle">{typeInfo[type].sub}</span>
                </span>
                <Icon name="chevron-right" className="row-chevron" size={14} />
              </span>
            </button>
          ))}
        </Section>
      </div>

      {creating && (
        <CreateConnectionSheet
          agent={agent}
          initialType={creating}
          onClose={() => setCreating(null)}
          onDone={async (value) => {
            setCreating(null);
            setSecrets(value);
            await reload();
          }}
        />
      )}
      {secrets && <SecretsSheet secrets={secrets} onClose={() => setSecrets(null)} />}
      {opened && (
        <ConnectionSheet
          connection={connections.find((item) => item.id === opened.id) ?? opened}
          canTurnOn={Boolean(agent.active_version_id)}
          onClose={() => setOpened(null)}
          onSecrets={(value) => {
            setOpened(null);
            setSecrets(value);
          }}
          reload={reload}
        />
      )}
    </div>
  );
}

// Delivery errors come from other systems; keep them short and readable.
function plainError(value?: string | null) {
  if (!value) return "The other system didn't confirm it got the reply";
  if (/timeout|timed out|abort/i.test(value)) return "The other system didn't answer in time";
  if (/\b(401|403)\b/.test(value)) return "The other system refused the reply (check its key)";
  if (/\b5\d\d\b/.test(value)) return "The other system had an error";
  return value.length > 120 ? `${value.slice(0, 117)}…` : value;
}

function CreateConnectionSheet({ agent, initialType, onClose, onDone }: { agent: AgentSummary; initialType: ConnectionType; onClose: () => void; onDone: (secrets: Secrets) => void }) {
  const [type, setType] = useState<ConnectionType>(initialType);
  const [form, setForm] = useState({
    name: "",
    callbackUrl: "",
    inboxApiUrl: "",
    apiCredential: "",
    webhookSecret: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await post<{
        id: string;
        apiKey: string;
        webhookToken: string;
        webhookPath: string;
      }>("/api/admin/connections", {
        agentId: agent.id,
        type,
        name: form.name || typeInfo[type].name,
        callbackUrl: type === "zernio" ? null : form.callbackUrl || null,
        config: type === "zernio" ? { inboxApiUrl: form.inboxApiUrl } : {},
        apiCredential: type === "zernio" ? form.apiCredential : undefined,
        webhookSecret: type !== "generic_api" ? form.webhookSecret || undefined : undefined,
      });
      // Turn it on right away when the assistant is live; otherwise it waits for the first publish.
      if (agent.active_version_id) await post(`/api/admin/connections/${result.id}/activate`).catch(() => undefined);
      onDone({
        type,
        apiKey: type === "generic_api" ? result.apiKey : undefined,
        webhookPath: type === "generic_api" ? undefined : result.webhookPath,
      });
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
          <Button variant="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-connection" busy={busy} disabled={!valid}>
            Add
          </Button>
        </>
      }
    >
      <form id="create-connection" className="sheet-form" onSubmit={submit}>
        <Segmented<ConnectionType>
          full
          label="Channel type"
          value={type}
          onChange={setType}
          options={order.map((value) => ({
            value,
            label: typeInfo[value].label,
          }))}
        />
        <Section footer={typeInfo[type].help}>
          <FieldRow label="Name">
            <TextInput value={form.name} placeholder={typeInfo[type].name} onChange={(event) => setForm({ ...form, name: event.target.value })} data-autofocus />
          </FieldRow>
          {type !== "zernio" && (
            <FieldRow label="Send replies to" hint={type === "generic_api" ? "Optional" : undefined}>
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
          <Section title="Zernio details" footer="The token and signing secret are encrypted when saved and never shown again.">
            <FieldRow label="Inbox address">
              <TextInput type="url" value={form.inboxApiUrl} placeholder="https://" onChange={(event) => setForm({ ...form, inboxApiUrl: event.target.value })} required />
            </FieldRow>
            <FieldRow label="Access token">
              <TextInput type="password" autoComplete="off" value={form.apiCredential} onChange={(event) => setForm({ ...form, apiCredential: event.target.value })} required />
            </FieldRow>
            <FieldRow label="Signing secret">
              <TextInput type="password" autoComplete="off" value={form.webhookSecret} onChange={(event) => setForm({ ...form, webhookSecret: event.target.value })} required />
            </FieldRow>
          </Section>
        )}
        {error && <Banner tone="error" title="Couldn't add the channel" text={error} />}
      </form>
    </Sheet>
  );
}

function SecretsSheet({ secrets, onClose }: { secrets: Secrets; onClose: () => void }) {
  const origin = window.location.origin;
  return (
    <Sheet title="Save this now" subtitle="It's shown only once" onClose={onClose} footer={<Button onClick={onClose}>Done</Button>}>
      <Banner tone="warning" title="You won't see it again" text="Copy it into your app or password manager before you close this. If you lose it, make a new key." />
      {secrets.apiKey && (
        <>
          <CopyField label="Address" value={`${origin}/api/v1/messages`} />
          <CopyField label="Key" value={secrets.apiKey} />
        </>
      )}
      {secrets.webhookPath && <CopyField label="Webhook address" value={`${origin}${secrets.webhookPath}`} />}
    </Sheet>
  );
}

function ConnectionSheet({
  connection,
  canTurnOn,
  onClose,
  onSecrets,
  reload,
}: {
  connection: Connection;
  canTurnOn: boolean;
  onClose: () => void;
  onSecrets: (secrets: Secrets) => void;
  reload: () => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState(connection.name);
  const [busy, setBusy] = useState<"" | "save" | "status" | "rotate">("");
  const [confirm, setConfirm] = useState<"off" | "rotate" | null>(null);
  const [error, setError] = useState("");
  const type = (connection.type as ConnectionType) in typeInfo ? (connection.type as ConnectionType) : "generic_api";
  const info = typeInfo[type];
  const origin = window.location.origin;
  const active = connection.status === "active";
  const keyHint = keyHintOf(connection);
  const added = parseDate(connection.created_at) ? `added ${formatDate(connection.created_at)}` : "";

  async function run(kind: "save" | "status" | "rotate", fn: () => Promise<void>) {
    setBusy(kind);
    setError("");
    try {
      await fn();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy("");
      setConfirm(null);
    }
  }
  const done = () =>
    name.trim() && name.trim() !== connection.name
      ? run("save", async () => {
          await patch(`/api/admin/connections/${connection.id}`, {
            name: name.trim(),
          });
          await reload();
          toast("Saved");
          onClose();
        })
      : onClose();

  return (
    <>
      <Sheet
        title={connection.name}
        subtitle={[info.label, active ? "on" : connection.status === "draft" ? "not on yet" : "off", added].filter(Boolean).join(" · ")}
        onClose={onClose}
        footer={
          <>
            {active ? (
              <Button variant="plain" destructive onClick={() => setConfirm("off")}>
                Turn off channel
              </Button>
            ) : (
              canTurnOn && (
                <Button
                  variant="plain"
                  busy={busy === "status"}
                  onClick={() =>
                    void run("status", async () => {
                      await post(`/api/admin/connections/${connection.id}/activate`);
                      await reload();
                      toast("Channel is on");
                    })
                  }
                >
                  Turn on channel
                </Button>
              )
            )}
            <span className="spacer" />
            <Button busy={busy === "save"} onClick={() => void done()}>
              Done
            </Button>
          </>
        }
      >
        {!active && !canTurnOn && <Banner tone="info" title="Publish the assistant to turn this on" text="Channels always use the live version." />}
        {error && <Banner tone="error" title="That didn't work" text={error} onClose={() => setError("")} />}
        <Section footer={type === "generic_api" ? "A new key stops the old one right away. Update your app before you make one." : "A new webhook address stops the old one right away."}>
          <FieldRow label="Name">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} />
          </FieldRow>
          {type === "generic_api" ? (
            <>
              <div className="field">
                <span className="field-label">Address</span>
                <span className="field-value truncate mono-value">{`${origin}/api/v1/messages`}</span>
                <CopyButton value={`${origin}/api/v1/messages`} label="Copy address" />
              </div>
              <div className="field">
                <span className="field-label">Key</span>
                <span className="field-value mono-value">{keyHint ? `•••• ${keyHint}` : "••••"}</span>
                <Button variant="gray" size="small" onClick={() => setConfirm("rotate")}>
                  New key
                </Button>
              </div>
            </>
          ) : (
            <div className="field">
              <span className="field-label">Webhook address</span>
              <span className="field-value muted">Shown once when made</span>
              <Button variant="gray" size="small" onClick={() => setConfirm("rotate")}>
                New address
              </Button>
            </div>
          )}
          {connection.callback_url && (
            <div className="field">
              <span className="field-label">Replies go to</span>
              <span className="field-value truncate">{connection.callback_url}</span>
            </div>
          )}
        </Section>
        {type === "generic_api" && (
          <Section>
            <Disclosure title="For your developer">
              <pre className="code-block flush">{`POST ${origin}/api/v1/messages
Authorization: Bearer <key>
Idempotency-Key: <unique id per message>

{ "conversation_id": "customer-123",
  "user_id": "customer-123",
  "message": { "text": "Hello" } }`}</pre>
            </Disclosure>
          </Section>
        )}
      </Sheet>
      {confirm === "off" && (
        <Alert
          title={`Turn off ${connection.name}?`}
          text="Customers on this channel stop getting replies until you turn it back on."
          confirmLabel="Turn off"
          destructive
          busy={busy === "status"}
          onCancel={() => setConfirm(null)}
          onConfirm={() =>
            void run("status", async () => {
              await post(`/api/admin/connections/${connection.id}/deactivate`);
              await reload();
              toast("Channel is off");
            })
          }
        />
      )}
      {confirm === "rotate" && (
        <Alert
          title={type === "generic_api" ? "Make a new key?" : "Make a new webhook address?"}
          text="The current one stops working right away. Anything still using it is refused until you update it."
          confirmLabel={type === "generic_api" ? "New key" : "New address"}
          destructive
          busy={busy === "rotate"}
          onCancel={() => setConfirm(null)}
          onConfirm={() =>
            void run("rotate", async () => {
              const result = await post<{
                apiKey: string;
                webhookToken: string;
              }>(`/api/admin/connections/${connection.id}/rotate`);
              await reload();
              onSecrets(
                type === "generic_api"
                  ? { type, apiKey: result.apiKey }
                  : {
                      type,
                      webhookPath: `/api/v1/webhooks/${type === "zernio" ? "zernio" : "generic"}/${result.webhookToken}`,
                    },
              );
            })
          }
        />
      )}
    </>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const toast = useToast();
  return (
    <Button
      type="button"
      variant="gray"
      size="small"
      icon="copy"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          toast("Copied");
        } catch {
          toast("Couldn't copy. Select the text and copy it.", "error");
        }
      }}
    />
  );
}
