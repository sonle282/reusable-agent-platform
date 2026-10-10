import { useState } from "react";
import { patch, post } from "../api";
import type { Brand } from "../types";
import { Banner, Button, FieldRow, PageHeader, Row, Section, TextInput, errorMessage, useToast } from "../ui";
import { modelLabel } from "./Assistant";

export function SettingsPage({
  brand,
  modelDefaults,
  model,
  reload,
  logout,
}: {
  brand: Brand;
  modelDefaults: Record<string, unknown>;
  model?: string;
  reload: () => Promise<void>;
  logout: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState(brand);
  const [credential, setCredential] = useState({
    apiKey: "",
    accountId: String(modelDefaults.accountId ?? ""),
    gatewayId: String(modelDefaults.gatewayId ?? "default"),
  });
  const [busy, setBusy] = useState<"" | "brand" | "key" | "test">("");
  const [error, setError] = useState("");
  const brandChanged = JSON.stringify(form) !== JSON.stringify(brand);
  const hasKey = Boolean(modelDefaults.credentialId);
  async function run(kind: "brand" | "key" | "test", action: () => Promise<void>) {
    setBusy(kind);
    setError("");
    try {
      await action();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="page narrow">
      <PageHeader title="Settings" />
      {error && <Banner onClose={() => setError("")}>{error}</Banner>}
      <Section title="AI" footer="Your Anthropic API key is encrypted when saved and never shown again. After changing it, publish the assistant so customers use the new key.">
        <Row title="Status" detail={hasKey ? "API key saved" : "No API key yet"} />
        <FieldRow label={hasKey ? "New API key" : "API key"}>
          <TextInput type="password" autoComplete="off" value={credential.apiKey} placeholder="sk-ant-…" onChange={(event) => setCredential({ ...credential, apiKey: event.target.value })} />
        </FieldRow>
        <details className="advanced in-group">
          <summary>Advanced</summary>
          <FieldRow label="Cloudflare account ID">
            <TextInput value={credential.accountId} onChange={(event) => setCredential({ ...credential, accountId: event.target.value })} />
          </FieldRow>
          <FieldRow label="AI Gateway ID">
            <TextInput value={credential.gatewayId} onChange={(event) => setCredential({ ...credential, gatewayId: event.target.value })} />
          </FieldRow>
        </details>
        <div className="row row-actions">
          <Button
            variant="gray"
            size="small"
            busy={busy === "test"}
            disabled={!hasKey}
            onClick={() =>
              void run("test", async () => {
                const result = await post<{ connected: boolean; model: string }>("/api/admin/settings/anthropic/test", model ? { model } : {});
                toast(result.connected ? `Connected · ${modelLabel(result.model)}` : "Couldn't connect", result.connected ? "default" : "error");
              })
            }
          >
            Test connection
          </Button>
          <Button
            size="small"
            busy={busy === "key"}
            disabled={credential.apiKey.length < 10 || !credential.accountId || !credential.gatewayId}
            onClick={() =>
              void run("key", async () => {
                await post("/api/admin/settings/anthropic", credential);
                setCredential({ ...credential, apiKey: "" });
                await reload();
                toast("API key saved");
              })
            }
          >
            Save
          </Button>
        </div>
      </Section>
      <Section title="Brand" footer="Shown on the sign-in screen and the sidebar. Changes apply immediately.">
        <FieldRow label="Name">
          <TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </FieldRow>
        <FieldRow label="Accent color">
          <input className="color-input" type="color" value={form.primaryColor} onChange={(event) => setForm({ ...form, primaryColor: event.target.value })} />
        </FieldRow>
        <FieldRow label="Logo URL">
          <TextInput type="url" value={form.logoUrl} onChange={(event) => setForm({ ...form, logoUrl: event.target.value })} placeholder="https://" />
        </FieldRow>
        <FieldRow label="Support page">
          <TextInput type="url" value={form.supportUrl} onChange={(event) => setForm({ ...form, supportUrl: event.target.value })} placeholder="https://" />
        </FieldRow>
        {brandChanged && (
          <div className="row row-actions">
            <Button variant="gray" size="small" onClick={() => setForm(brand)}>Cancel</Button>
            <Button
              size="small"
              busy={busy === "brand"}
              onClick={() =>
                void run("brand", async () => {
                  await patch("/api/admin/settings/brand", form);
                  await reload();
                  toast("Brand saved");
                })
              }
            >
              Save
            </Button>
          </div>
        )}
      </Section>
      <Section title="Backup" footer="Includes the assistant setup, versions, data and test scenarios. Never includes keys or passwords.">
        <Row href="/api/admin/export" download title={<span className="text-tint">Download backup (JSON)</span>} />
      </Section>
      <Section>
        <Row onClick={logout} title={<span className="text-red">Sign out</span>} />
      </Section>
    </div>
  );
}
