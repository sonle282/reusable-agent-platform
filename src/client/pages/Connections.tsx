import { useEffect, useState, type FormEvent } from "react";
import { api, patch, post } from "../api";
import { formatDate, parseDate } from "../format";
import { platformKey, platformName, platformOf } from "../platform";
import type { AgentSummary, Connection, Delivery } from "../types";
import { AgentAvatar, Alert, Badge, BrandLogo, Button, CopyField, Dialog, Disclosure, Drawer, errorMessage, Field, Icon, LoadError, PageHeader, Segmented, SettingRow, Sheet, TextInput, useToast, type TileTone } from "../ui";

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
    tone: "success",
    sub: "Reply in your Zernio inbox",
    help: "Paste your Zernio API key, pick the page, and the assistant answers its messages.",
  },
  generic_webhook: {
    label: "Webhook",
    name: "Webhook",
    icon: "webhook",
    tone: "discovery",
    sub: "Another system sends signed events",
    help: "Another system sends signed events; replies go to the address you give.",
  },
  generic_api: {
    label: "API",
    name: "API",
    icon: "bolt",
    tone: "info",
    sub: "Your website, app or CRM",
    help: "Your website, app or CRM sends customer messages and gets replies right away or at an address you give.",
  },
};
const order: ConnectionType[] = ["zernio", "generic_webhook", "generic_api"];

// The platform grid: Zernio platforms open the Zernio flow (it lists the pages of every platform); API and Webhook are built in.
const platforms: Array<{ platform: string; name: string; sub: string; type: ConnectionType }> = [
  { platform: "messenger", name: "Messenger", sub: "Through Zernio", type: "zernio" },
  { platform: "instagram", name: "Instagram", sub: "Through Zernio", type: "zernio" },
  { platform: "whatsapp", name: "WhatsApp", sub: "Through Zernio", type: "zernio" },
  { platform: "telegram", name: "Telegram", sub: "Through Zernio", type: "zernio" },
  { platform: "tiktok", name: "TikTok", sub: "Through Zernio", type: "zernio" },
  { platform: "api", name: "API", sub: "Built in · your website, app or CRM", type: "generic_api" },
  { platform: "webhook", name: "Webhook", sub: "Built in · signed events from another system", type: "generic_webhook" },
];
// "Messenger via Zernio", "API", "Webhook".
const channelKind = (connection: Connection) => (connection.type === "zernio" ? `${platformName[platformOf(connection)] ?? "Messenger"} via Zernio` : infoOf(connection).label);
const infoOf = (connection: Connection) => typeInfo[connection.type as ConnectionType] ?? typeInfo.generic_api;
const keyHintOf = (connection: Connection) => {
  try {
    return (JSON.parse(connection.config_json || "{}") as { keyHint?: string }).keyHint;
  } catch {
    return undefined;
  }
};

const zernioPage = (connection: Connection) => {
  try {
    const config = JSON.parse(connection.config_json || "{}") as { accountName?: string; platform?: string };
    return [config.accountName, config.platform ? platformName[platformKey(config.platform)] ?? config.platform : undefined].filter(Boolean).join(" · ") || "Zernio";
  } catch {
    return "Zernio";
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
        subtitle="Where customers reach your assistant. Every channel uses its live version."
        actions={
          <Button icon="plus" onClick={() => setCreating("zernio")}>
            Add channel
          </Button>
        }
      />
      {!agent.active_version_id && connections.length > 0 && (
        <Alert
          tone="warning"
          title="Channels can't reply yet"
          text="Publish the assistant first; channels always use the live version."
          actions={
            <Button variant="outline" size="sm" onClick={onOpenAssistant}>
              Open Assistant
            </Button>
          }
        />
      )}
      {error && (
        <div className="card">
          <LoadError title="Couldn't check deliveries" text="Customers are still being answered." error={error} onRetry={() => void loadDeliveries()} />
        </div>
      )}

      {failed.length > 0 && (
        <section className="card card-danger" aria-labelledby="failed-title">
          <div className="card-head">
            <Icon name="warning" className="text-danger" />
            <h2 id="failed-title" className="card-title">
              {failed.length === 1 ? "1 reply not delivered" : `${failed.length} replies not delivered`}
            </h2>
            {failed.length > 1 && (
              <Button
                variant="outline"
                size="sm"
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
            )}
          </div>
          {failed.map((delivery) => (
            <div className="row compact" key={delivery.id}>
              <div className="row-text">
                <span className="row-title">
                  Reply on {nameOf(delivery.connection_id)} · {formatDate(delivery.updated_at)}
                </span>
                <span className="row-sub xs truncate">{plainError(delivery.last_error)}</span>
              </div>
              <Button variant="ghost" size="sm" busy={retrying === delivery.id} onClick={() => void retry([delivery.id], delivery.id)}>
                Retry
              </Button>
            </div>
          ))}
          <div className="card-foot">Customers haven't received these replies yet. Retrying never sends a reply twice.</div>
        </section>
      )}

      {connections.length === 0 ? (
        <div className="hero-block" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 className="display" style={{ fontSize: 28, lineHeight: "34px" }}>
            Meet customers where they already message you
          </h2>
          <p className="t2" style={{ margin: 0, maxWidth: 560 }}>
            Connect Messenger, Instagram, WhatsApp and more. Your assistant answers within seconds, any time of day.
          </p>
        </div>
      ) : (
        <section className="card" aria-labelledby="connected-title">
          <div className="card-head">
            <h2 id="connected-title" className="card-title">
              Connected
            </h2>
            <span className="xs t3">{connections.length}</span>
          </div>
          {connections.map((connection) => {
            const failures = failedFor(connection.id);
            const off = connection.status !== "active";
            const platform = platformOf(connection);
            return (
              <button type="button" className="row" key={connection.id} onClick={() => setOpened(connection)}>
                <BrandLogo platform={platform} label={platformName[platform] ?? connection.name} />
                <span className="row-text">
                  <span className="row-flex">
                    <span className="row-title truncate">{connection.name}</span>
                    {failures > 0 && <Badge tone="danger">{failures} not delivered</Badge>}
                    {off && failures === 0 && <Badge>{connection.status === "draft" ? "Not on yet" : "Off"}</Badge>}
                  </span>
                  <span className="row-sub xs">{[channelKind(connection), connection.created_at ? `added ${formatDate(connection.created_at)}` : ""].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="row-flex xs t3 hide-phone" style={{ gap: 6 }}>
                  Answered by <AgentAvatar id={agent.id} name={agent.name} size="xs" />
                  <span className="t2 truncate" style={{ maxWidth: 180 }}>
                    {agent.name}
                  </span>
                </span>
                <Icon name="chevron-right" className="chev" size={16} />
              </button>
            );
          })}
        </section>
      )}

      <section className="stack" style={{ gap: 12 }} aria-labelledby="add-title">
        <h2 id="add-title" className="section-title">
          {connections.length ? "Add another channel" : "Add a channel"}
        </h2>
        <div className="platform-grid">
          {platforms.map((item) => (
            <button type="button" key={item.platform} className="agent-card platform-card" onClick={() => setCreating(item.type)}>
              <BrandLogo platform={item.platform} />
              <span className="stack" style={{ gap: 2 }}>
                <span className="strong">{item.name}</span>
                <span className="xs t3">{item.sub}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="help">Messenger, Instagram, WhatsApp, Telegram and TikTok connect through Zernio, which handles the sign-in to each platform. Logos identify the platforms only.</p>
      </section>

      {creating && (
        <CreateConnectionSheet
          agent={agent}
          initialType={creating}
          onClose={() => setCreating(null)}
          onDone={async (value) => {
            setCreating(null);
            setSecrets(value);
            if (!value) toast(agent.active_version_id ? "Connected · the assistant answers this page now" : "Connected · publish the assistant to turn it on");
            await reload();
          }}
        />
      )}
      {secrets && <SecretsSheet secrets={secrets} onClose={() => setSecrets(null)} />}
      {opened && (
        <ConnectionSheet
          agent={agent}
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

type ZernioAccount = { id: string; platform: string; name: string; username: string | null; picture: string | null };

function CreateConnectionSheet({ agent, initialType, onClose, onDone }: { agent: AgentSummary; initialType: ConnectionType; onClose: () => void; onDone: (secrets: Secrets | null) => void }) {
  const [type, setType] = useState<ConnectionType>(initialType);
  const [form, setForm] = useState({ name: "", callbackUrl: "", apiCredential: "", webhookSecret: "" });
  const [accounts, setAccounts] = useState<ZernioAccount[] | null>(null);
  const [accountId, setAccountId] = useState("");
  const [busy, setBusy] = useState<"" | "find" | "add">("");
  const [error, setError] = useState("");
  const chosen = accounts?.find((account) => account.id === accountId);

  // The key is sent once to list the pages it can reach; it is saved only when the channel is added.
  async function findAccounts() {
    setBusy("find");
    setError("");
    try {
      const list = await post<ZernioAccount[]>("/api/admin/zernio/accounts", { apiKey: form.apiCredential.trim() });
      setAccounts(list);
      const first = list.find((account) => account.platform === "facebook") ?? list[0];
      setAccountId(first?.id ?? "");
    } catch (caught) {
      setAccounts(null);
      setError(errorMessage(caught));
    } finally {
      setBusy("");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy("add");
    setError("");
    try {
      const result = await post<{ id: string; apiKey?: string; webhookToken?: string; webhookPath?: string }>("/api/admin/connections", {
        agentId: agent.id,
        type,
        name: form.name || (type === "zernio" && chosen ? chosen.name : typeInfo[type].name),
        callbackUrl: type === "zernio" ? null : form.callbackUrl || null,
        config: type === "zernio" && chosen ? { accountId: chosen.id, accountName: chosen.name, platform: chosen.platform } : {},
        apiCredential: type === "zernio" ? form.apiCredential.trim() : undefined,
        webhookSecret: type === "generic_webhook" ? form.webhookSecret || undefined : undefined,
      });
      // Turn it on right away when the assistant is live; otherwise it waits for the first publish.
      if (agent.active_version_id) await post(`/api/admin/connections/${result.id}/activate`).catch(() => undefined);
      onDone(type === "zernio" ? null : { type, apiKey: type === "generic_api" ? result.apiKey : undefined, webhookPath: type === "generic_api" ? undefined : result.webhookPath });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy("");
    }
  }
  const valid = type !== "zernio" || Boolean(chosen);
  return (
    <Sheet
      title="Add channel"
      subtitle={type === "zernio" ? "Messenger, Instagram, WhatsApp and more, through Zernio" : typeInfo[type].sub}
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {valid && (
            <Button type="submit" form="create-connection" busy={busy === "add"}>
              Connect
            </Button>
          )}
        </>
      }
    >
      <form id="create-connection" className="sheet-form" onSubmit={submit}>
        <Segmented<ConnectionType> full label="Channel type" value={type} onChange={setType} options={order.map((value) => ({ value, label: typeInfo[value].label }))} />
        {type === "zernio" ? (
          <>
            <Field label="Zernio API key" hint="Find it in Zernio › API keys. It's encrypted when saved and never shown again. We set up the Zernio webhook for you.">
              <div className="row-flex">
                <TextInput type="password" autoComplete="off" value={form.apiCredential} placeholder="sk_…" onChange={(event) => setForm({ ...form, apiCredential: event.target.value })} data-autofocus />
                <Button type="button" variant="outline" busy={busy === "find"} disabled={form.apiCredential.trim().length < 20} onClick={() => void findAccounts()}>
                  Find my pages
                </Button>
              </div>
            </Field>
            {accounts && (
              <div className="field">
                <span className="field-label">Which page should it answer?</span>
                <div className="choice-list" role="radiogroup" aria-label="Page">
                  {accounts.map((account) => {
                    const platform = platformKey(account.platform);
                    return (
                      <button type="button" key={account.id} className="choice" role="radio" aria-checked={account.id === accountId} onClick={() => setAccountId(account.id)}>
                        <BrandLogo platform={platform} />
                        <span className="stack spacer" style={{ gap: 0 }}>
                          <span className="medium">{account.name}</span>
                          <span className="xs t3">{platformName[platform] ?? account.platform}</span>
                        </span>
                        <span className="radio-dot" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
                <span className="help">{accounts.length ? "The assistant answers new messages on this page with its live version." : "No connected pages. Connect one in Zernio › Connections, then try again."}</span>
              </div>
            )}
          </>
        ) : (
          <>
            <Field label="Name">
              <TextInput value={form.name} placeholder={typeInfo[type].name} onChange={(event) => setForm({ ...form, name: event.target.value })} data-autofocus />
            </Field>
            <Field label="Send replies to" hint={type === "generic_api" ? "Optional" : undefined}>
              <TextInput type="url" value={form.callbackUrl} placeholder="https://" onChange={(event) => setForm({ ...form, callbackUrl: event.target.value })} />
            </Field>
            {type === "generic_webhook" && (
              <Field label="Signing secret">
                <TextInput type="password" autoComplete="off" value={form.webhookSecret} onChange={(event) => setForm({ ...form, webhookSecret: event.target.value })} />
              </Field>
            )}
            <p className="help">{typeInfo[type].help}</p>
          </>
        )}
        <SettingRow title="Answered by" sub="Uses the assistant's live version">
          <span className="row-flex">
            <AgentAvatar id={agent.id} name={agent.name} size="xs" />
            <span className="medium truncate">{agent.name}</span>
          </span>
        </SettingRow>
        {error && <Alert tone="danger" title="Couldn't add the channel" text={error} />}
      </form>
    </Sheet>
  );
}

function SecretsSheet({ secrets, onClose }: { secrets: Secrets; onClose: () => void }) {
  const origin = window.location.origin;
  return (
    <Sheet
      title="Save this now"
      subtitle="It's shown only once"
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      <Alert tone="warning" title="You won't see it again" text="Copy it into your app or password manager before you close this. If you lose it, make a new key." />
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
  agent,
  connection,
  canTurnOn,
  onClose,
  onSecrets,
  reload,
}: {
  agent: AgentSummary;
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
  const origin = window.location.origin;
  const active = connection.status === "active";
  const keyHint = keyHintOf(connection);
  const added = parseDate(connection.created_at) ? `added ${formatDate(connection.created_at)}` : "";
  const platform = platformOf(connection);

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
      <Drawer
        title={connection.name}
        subtitle={[channelKind(connection), active ? "on" : connection.status === "draft" ? "not on yet" : "off", added].filter(Boolean).join(" · ")}
        leading={<BrandLogo platform={platform} />}
        onClose={onClose}
        footer={
          <>
            {active ? (
              <Button variant="danger-ghost" onClick={() => setConfirm("off")}>
                Turn off channel
              </Button>
            ) : (
              canTurnOn && (
                <Button
                  variant="ghost"
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
        {!active && !canTurnOn && <Alert tone="info" title="Publish the assistant to turn this on" text="Channels always use the live version." />}
        {error && <Alert tone="danger" title="That didn't work" text={error} onClose={() => setError("")} />}
        <Field label="Name">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <SettingRow title="Answered by" sub="Uses the assistant's live version">
          <span className="row-flex">
            <AgentAvatar id={agent.id} name={agent.name} size="xs" />
            <span className="medium truncate">{agent.name}</span>
          </span>
        </SettingRow>
        {type === "generic_api" ? (
          <>
            <div className="field">
              <span className="field-label">Address</span>
              <div className="row-flex">
                <input className="input mono" value={`${origin}/api/v1/messages`} readOnly aria-label="Address" onFocus={(event) => event.currentTarget.select()} />
                <CopyButton value={`${origin}/api/v1/messages`} label="Copy address" />
              </div>
            </div>
            <div className="field">
              <span className="field-label">Key</span>
              <div className="row-flex">
                <input className="input mono" value={keyHint ? `•••• ${keyHint}` : "••••"} readOnly aria-label="Key" />
                <Button variant="outline" onClick={() => setConfirm("rotate")}>
                  New key
                </Button>
              </div>
              <span className="help">A new key stops the old one right away. Update your app before you make one.</span>
            </div>
          </>
        ) : type === "zernio" ? (
          <Field label="Account" hint="Connected through Zernio. Manage sign-in there.">
            <TextInput value={zernioPage(connection)} readOnly />
          </Field>
        ) : (
          <div className="field">
            <span className="field-label">Webhook address</span>
            <div className="row-flex">
              <input className="input" value="Shown once when made" readOnly aria-label="Webhook address" />
              <Button variant="outline" onClick={() => setConfirm("rotate")}>
                New address
              </Button>
            </div>
            <span className="help">A new webhook address stops the old one right away.</span>
          </div>
        )}
        {connection.callback_url && (
          <Field label="Replies go to">
            <TextInput value={connection.callback_url} readOnly />
          </Field>
        )}
        {type === "generic_api" && (
          <section className="card">
            <Disclosure title="For your developer">
              <pre className="code-block">{`POST ${origin}/api/v1/messages
Authorization: Bearer <key>
Idempotency-Key: <unique id per message>

{ "conversation_id": "customer-123",
  "user_id": "customer-123",
  "message": { "text": "Hello" } }`}</pre>
            </Disclosure>
          </section>
        )}
      </Drawer>
      {confirm === "off" && (
        <Dialog
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
        <Dialog
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
      variant="outline"
      size="sm"
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
