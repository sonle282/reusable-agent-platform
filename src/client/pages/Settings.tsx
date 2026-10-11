import { useState } from "react";
import { patch, post } from "../api";
import { formatDate } from "../format";
import type { ThemeChoice } from "../theme";
import type { Brand } from "../types";
import { Banner, Button, Disclosure, FieldRow, Icon, PageHeader, Section, Segmented, TextInput, errorMessage, useToast } from "../ui";
import { AnswerChecks, modelLabel } from "./Assistant";

type Check = { state: "idle" | "checking" | "ok" | "failed"; detail?: string };

export function SettingsPage({
  agentId,
  brand,
  modelDefaults,
  reload,
  logout,
  themeChoice,
  setThemeChoice,
}: {
  agentId: string;
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
          <Banner
            tone="error"
            title="The AI isn't accepting your key"
            text={`Customers get the fallback reply until this is fixed. ${check.detail ?? ""}`.trim()}
            actions={
              <Button variant="gray" size="small" onClick={() => setKeyOpen(true)}>
                Replace key
              </Button>
            }
          />
        )}
        {!hasKey && <Banner tone="info" title="Add your AI key to start" text="Your assistant needs it to answer customers. It takes a minute." />}
        {error && <Banner tone="error" title={error.title} text={error.text} onClose={() => setError(null)} />}

        <Section title="AI" footer="Your key is encrypted and never shown again. A new key is used by customers after your next publish.">
          {hasKey && (
            <div className="row">
              <span className="tile tile-indigo" aria-hidden="true">
                <Icon name="sparkles" size={18} />
              </span>
              <div className="row-body">
                <span className="row-title spacer">Connection</span>
                {check.state === "ok" ? (
                  <span className="status-line text-green check-line">
                    <Icon name="check-circle" size={16} />
                    Connected · {check.detail}
                  </span>
                ) : check.state === "failed" ? (
                  <span className="status-line text-red check-line">
                    <Icon name="error" size={16} />
                    Not working
                  </span>
                ) : null}
                <Button variant="gray" size="small" busy={check.state === "checking"} onClick={() => void testConnection()}>
                  {check.state === "idle" ? "Check" : "Check again"}
                </Button>
              </div>
            </div>
          )}
          <div className="row">
            <span className="tile tile-gray" aria-hidden="true">
              <Icon name="key" size={18} />
            </span>
            <div className="row-body">
              <span className="row-text">
                <span className="row-title">AI key</span>
                <span className="row-subtitle">{hasKey ? ["Saved", keyHint && `ends in ${keyHint}`, savedAt && formatDate(savedAt)].filter(Boolean).join(" · ") : "Not added yet"}</span>
              </span>
              {!keyOpen && (
                <Button variant="gray" size="small" onClick={() => setKeyOpen(true)}>
                  {hasKey ? "Replace" : "Add key"}
                </Button>
              )}
            </div>
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
                <input className="input mono-value" type="password" placeholder="sk-ant-…" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoFocus />
              </label>
              {idsMissing && <p className="field-hint">Fill in the Cloudflare details under Advanced first.</p>}
              <div className="key-actions">
                <Button
                  type="button"
                  variant="gray"
                  size="small"
                  onClick={() => {
                    setKeyOpen(false);
                    setApiKey("");
                  }}
                >
                  Cancel
                </Button>
                {apiKey.length >= 10 && !idsMissing && (
                  <Button type="submit" size="small" busy={busy === "key"}>
                    Test and save
                  </Button>
                )}
              </div>
            </form>
          )}
          <Disclosure title="Advanced" defaultOpen={idsMissing}>
            <FieldRow label="Cloudflare account ID">
              <TextInput className="mono-value" value={ids.accountId} onChange={(event) => setIds({ ...ids, accountId: event.target.value })} />
            </FieldRow>
            <FieldRow label="AI Gateway ID">
              <TextInput className="mono-value" value={ids.gatewayId} onChange={(event) => setIds({ ...ids, gatewayId: event.target.value })} />
            </FieldRow>
          </Disclosure>
        </Section>

        <Section title="Brand" footer="Customers see your brand on the sign-in screen and in the chat. This admin keeps system colors so status stays readable.">
          <FieldRow label="Name">
            <TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </FieldRow>
          <div className="field">
            <span className="field-label">Logo</span>
            <span className="brand-tile" role="img" aria-label="Current logo">
              {form.logoUrl ? <img src={form.logoUrl} alt="" /> : form.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}
            </span>
            <TextInput type="url" value={form.logoUrl} onChange={(event) => setForm({ ...form, logoUrl: event.target.value })} placeholder="Image address (https://)" aria-label="Logo image address" />
          </div>
          <div className="field">
            <span className="field-label spacer">Accent color</span>
            <span className="row-detail mono-value">{form.primaryColor.toUpperCase()}</span>
            <label className="swatch" style={{ background: form.primaryColor }}>
              <span className="sr-only">Accent color {form.primaryColor}, change</span>
              <input type="color" value={form.primaryColor} onChange={(event) => setForm({ ...form, primaryColor: event.target.value })} />
            </label>
          </div>
          <FieldRow label="Help page" hint="Optional">
            <TextInput type="url" value={form.supportUrl} onChange={(event) => setForm({ ...form, supportUrl: event.target.value })} placeholder="https://" />
          </FieldRow>
          {brandChanged && (
            <div className="row row-actions">
              <Button variant="gray" size="small" onClick={() => setForm(brand)}>
                Cancel
              </Button>
              <Button size="small" busy={busy === "brand"} onClick={() => void saveBrand()}>
                Save
              </Button>
            </div>
          )}
        </Section>

        <Section title="Appearance" footer="System follows your device's light or dark setting.">
          <div className="field">
            <span className="field-label spacer">Theme</span>
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
          </div>
        </Section>

        <Section title="Answer checks" footer="Publish already checks the required answers for you. Run every check here after a big change.">
          <AnswerChecks agentId={agentId} />
        </Section>

        <Section title="Backup">
          <div className="row">
            <span className="tile tile-gray" aria-hidden="true">
              <Icon name="archive" size={18} />
            </span>
            <div className="row-body">
              <span className="row-text">
                <span className="row-title">Download a backup</span>
                <span className="row-subtitle">Instructions, knowledge, data and versions in one file. Never includes keys or passwords.</span>
              </span>
              <a className="btn btn-gray btn-sm" href="/api/admin/export" download>
                <Icon name="download" size={15} />
                <span>Download</span>
              </a>
            </div>
          </div>
        </Section>

        <section className="section" aria-label="Account">
          <div className="section-card">
            <button type="button" className="row signout-row" onClick={logout}>
              <span className="row-body">
                <span className="row-title">Sign out</span>
              </span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
