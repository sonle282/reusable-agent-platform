import { useId, useState, type ReactNode } from "react";
import { patch, post } from "../api";
import { formatDate } from "../format";
import type { ThemeChoice } from "../theme";
import type { Brand } from "../types";
import { Alert, Button, Disclosure, errorMessage, Field, Icon, initialsOf, PageHeader, Segmented, SettingRow, TextInput, Tile, useToast } from "../ui";
import { AnswerChecks, modelLabel } from "./Assistant";

type Check = { state: "idle" | "checking" | "ok" | "failed"; detail?: string };

export function SettingsPage({
  agentId,
  zernio,
  onManageChannels,
  brand,
  modelDefaults,
  reload,
  logout,
  themeChoice,
  setThemeChoice,
}: {
  agentId: string;
  zernio: boolean;
  onManageChannels: () => void;
  brand: Brand;
  modelDefaults: Record<string, unknown>;
  reload: () => Promise<void>;
  logout: () => void;
  themeChoice: ThemeChoice;
  setThemeChoice: (choice: ThemeChoice) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState(brand);
  const [keyOpen, setKeyOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [ids, setIds] = useState({ accountId: String(modelDefaults.accountId ?? ""), gatewayId: String(modelDefaults.gatewayId ?? "default") });
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const [busy, setBusy] = useState<"" | "brand" | "key">("");
  const [error, setError] = useState<{ title: string; text: string } | null>(null);
  const brandChanged = JSON.stringify(form) !== JSON.stringify(brand);
  const hasKey = Boolean(modelDefaults.credentialId);
  const keyHint = typeof modelDefaults.keyHint === "string" ? modelDefaults.keyHint : "";
  const savedAt = typeof modelDefaults.savedAt === "string" ? modelDefaults.savedAt : "";
  const idsMissing = !ids.accountId.trim() || !ids.gatewayId.trim();

  async function testConnection() {
    setCheck({ state: "checking" });
    try {
      const result = await post<{ connected: boolean; model: string }>("/api/admin/settings/anthropic/test", {});
      setCheck(result.connected ? { state: "ok", detail: modelLabel(result.model) } : { state: "failed", detail: "The AI didn't answer" });
      return result.connected;
    } catch (caught) {
      setCheck({ state: "failed", detail: errorMessage(caught) });
      return false;
    }
  }
  async function saveKey() {
    setBusy("key");
    setError(null);
    try {
      await post("/api/admin/settings/anthropic", { apiKey, ...ids });
      setApiKey("");
      setKeyOpen(false);
      await reload();
      const ok = await testConnection();
      toast(ok ? "Key saved · publish the assistant so customers use it" : "Key saved, but the AI didn't accept it", ok ? "default" : "error");
    } catch (caught) {
      setError({ title: "Couldn't save the key", text: `${errorMessage(caught)}. Your current key is unchanged.` });
    } finally {
      setBusy("");
    }
  }
  async function saveBrand() {
    setBusy("brand");
    setError(null);
    try {
      await patch("/api/admin/settings/brand", form);
      await reload();
      toast("Brand saved");
    } catch (caught) {
      setError({ title: "Couldn't save the brand", text: errorMessage(caught) });
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="page">
      <PageHeader title="Settings" />
      <div className="form-col">
        {check.state === "failed" && (
          <Alert
            tone="danger"
            title="The AI isn't accepting your key"
            text={`Customers get the fallback reply until this is fixed. ${check.detail ?? ""}`.trim()}
            actions={
              <Button variant="outline" size="sm" onClick={() => setKeyOpen(true)}>
                Replace key
              </Button>
            }
          />
        )}
        {!hasKey && <Alert tone="info" icon="key" title="Add your AI key to start" text="Your assistant needs it to answer customers. It takes a minute." />}
        {error && <Alert tone="danger" title={error.title} text={error.text} onClose={() => setError(null)} />}

        <Group title="Appearance">
          <div className="card card-pad">
            <SettingRow title="Theme" sub="System follows your device">
              <Segmented<ThemeChoice>
                label="Theme"
                value={themeChoice}
                onChange={setThemeChoice}
                options={[
                  { value: "system", label: "System" },
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                ]}
              />
            </SettingRow>
          </div>
        </Group>

        <Group title="Workspace" help="Customers see your brand on the sign-in screen and in the website chat. This admin keeps its own colors so status stays readable.">
          <div className="card card-pad stack" style={{ gap: 16 }}>
            <Field label="Name">
              <TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Field>
            <Field label="Logo" hint="Square image, at least 256 px">
              <div className="row-flex">
                <span className="ws-logo" role="img" aria-label="Current logo" style={{ width: 36, height: 36 }}>
                  {form.logoUrl ? <img src={form.logoUrl} alt="" /> : initialsOf(form.name)}
                </span>
                <TextInput type="url" value={form.logoUrl} onChange={(event) => setForm({ ...form, logoUrl: event.target.value })} placeholder="Image address (https://)" />
              </div>
            </Field>
            <SettingRow title="Chat color" sub="Used in the website chat customers see">
              <span className="row-flex">
                <span className="xs t3 mono">{form.primaryColor.toUpperCase()}</span>
                <label className="swatch" style={{ background: form.primaryColor }}>
                  <span className="sr-only">Chat color {form.primaryColor}, change</span>
                  <input type="color" value={form.primaryColor} onChange={(event) => setForm({ ...form, primaryColor: event.target.value })} />
                </label>
              </span>
            </SettingRow>
            <Field label="Help page" hint="Optional">
              <TextInput type="url" value={form.supportUrl} onChange={(event) => setForm({ ...form, supportUrl: event.target.value })} placeholder="https://" />
            </Field>
            {brandChanged && (
              <div className="row-flex" style={{ justifyContent: "flex-end" }}>
                <Button variant="outline" size="sm" onClick={() => setForm(brand)}>
                  Cancel
                </Button>
                <Button size="sm" busy={busy === "brand"} onClick={() => void saveBrand()}>
                  Save
                </Button>
              </div>
            )}
          </div>
        </Group>

        <Group title="AI connection" help="Your key is encrypted and never shown again. A new key is used after your next publish.">
          <div className="card">
            <div className="row compact">
              <Tile icon="sparkle" />
              <span className="row-text">
                <span className="row-title">Anthropic</span>
                {check.state === "ok" ? (
                  <span className="row-sub xs text-success">Connected · {check.detail}</span>
                ) : check.state === "failed" ? (
                  <span className="row-sub xs text-danger">Not working</span>
                ) : (
                  <span className="row-sub xs">{hasKey ? "Key saved · check that it works" : "Not connected"}</span>
                )}
              </span>
              {hasKey && (
                <Button variant="outline" size="sm" busy={check.state === "checking"} onClick={() => void testConnection()}>
                  {check.state === "idle" ? "Check" : "Check again"}
                </Button>
              )}
            </div>
            <div className="row compact">
              <Tile icon="key" />
              <span className="row-text">
                <span className="row-title">AI key</span>
                <span className="row-sub xs">{hasKey ? ["Saved", keyHint && `ends in ${keyHint}`, savedAt && formatDate(savedAt)].filter(Boolean).join(" · ") : "Not added yet"}</span>
              </span>
              {!keyOpen && (
                <Button variant="outline" size="sm" onClick={() => setKeyOpen(true)}>
                  {hasKey ? "Replace" : "Add key"}
                </Button>
              )}
            </div>
            {keyOpen && (
              <form
                className="key-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveKey();
                }}
              >
                <label>
                  <span className="sr-only">New AI key</span>
                  <input className="input mono" type="password" placeholder="sk-ant-…" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoFocus />
                </label>
                {idsMissing && <p className="help">Fill in the Cloudflare details under Advanced first.</p>}
                <div className="row-flex" style={{ justifyContent: "flex-end" }}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setKeyOpen(false);
                      setApiKey("");
                    }}
                  >
                    Cancel
                  </Button>
                  {apiKey.length >= 10 && !idsMissing && (
                    <Button type="submit" size="sm" busy={busy === "key"}>
                      Test and save
                    </Button>
                  )}
                </div>
              </form>
            )}
            <Disclosure title="Advanced" defaultOpen={idsMissing}>
              <div className="field-grid">
                <Field label="Cloudflare account ID">
                  <TextInput className="mono" value={ids.accountId} onChange={(event) => setIds({ ...ids, accountId: event.target.value })} />
                </Field>
                <Field label="AI Gateway ID">
                  <TextInput className="mono" value={ids.gatewayId} onChange={(event) => setIds({ ...ids, gatewayId: event.target.value })} />
                </Field>
              </div>
            </Disclosure>
          </div>
        </Group>

        <Group title="Messaging platforms">
          <div className="card">
            <div className="row compact">
              <Tile icon="link" />
              <span className="row-text">
                <span className="row-title">Zernio</span>
                <span className="row-sub xs">Connects Messenger, Instagram, WhatsApp, Telegram and TikTok</span>
              </span>
              <span className="status xs hide-phone">
                <span className={`dot ${zernio ? "dot-green" : "dot-gray"}`} aria-hidden="true" />
                {zernio ? "Connected" : "Not connected"}
              </span>
              <Button variant="outline" size="sm" onClick={onManageChannels}>
                {zernio ? "Manage" : "Connect"}
              </Button>
            </div>
          </div>
        </Group>

        <Group title="Answer checks" help="Publish already checks the required answers for you. Run every check here after a big change.">
          <div className="card">
            <AnswerChecks agentId={agentId} />
          </div>
        </Group>

        <Group title="Backup">
          <div className="card">
            <div className="row compact">
              <Tile icon="archive" />
              <span className="row-text">
                <span className="row-title">Download a backup</span>
                <span className="row-sub xs">Instructions, knowledge, data and versions in one file. Never includes keys or passwords.</span>
              </span>
              <a className="btn btn-outline btn-sm" href="/api/admin/export" download>
                <Icon name="download" size={16} />
                <span>Download</span>
              </a>
            </div>
          </div>
        </Group>

        <section aria-label="Account" className="card">
          <div className="row compact">
            <span className="row-text">
              <span className="row-title">Signed in as owner</span>
              <span className="row-sub xs">{brand.name} workspace</span>
            </span>
            <Button variant="danger-ghost" size="sm" icon="logout" onClick={logout}>
              Sign out
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Group({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className="stack" style={{ gap: 12 }} aria-labelledby={id}>
      <h2 id={id} className="section-title">
        {title}
      </h2>
      {children}
      {help && <p className="help">{help}</p>}
    </section>
  );
}
