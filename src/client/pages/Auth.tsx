import { useState, type FormEvent } from "react";
import { post, setCsrf } from "../api";
import type { Brand } from "../types";
import { Banner, Button, FieldRow, Section, TextInput, errorMessage } from "../ui";

export function AppIcon({ brand, size = 64 }: { brand: Brand; size?: number }) {
  return (
    <span className="app-icon" style={{ width: size, height: size, borderRadius: size * 0.225, background: brand.logoUrl ? "var(--color-surface)" : brand.primaryColor }}>
      {brand.logoUrl ? <img src={brand.logoUrl} alt="" /> : <b style={{ fontSize: size * 0.42 }}>{brand.name.slice(0, 1)}</b>}
    </span>
  );
}

export function Setup({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<0 | 1>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    bootstrapToken: "",
    email: "",
    password: "",
    name: "",
    logoUrl: "",
    primaryColor: "#007aff",
    supportUrl: "",
    anthropicApiKey: "",
    accountId: "",
    gatewayId: "default",
  });
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await post<{ csrfToken: string }>("/api/setup", {
        bootstrapToken: form.bootstrapToken,
        email: form.email,
        password: form.password,
        brand: { name: form.name, logoUrl: form.logoUrl, primaryColor: form.primaryColor, supportUrl: form.supportUrl },
        anthropicApiKey: form.anthropicApiKey || undefined,
        accountId: form.accountId || undefined,
        gatewayId: form.gatewayId || undefined,
      });
      setCsrf(result.csrfToken);
      onDone();
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't finish setup"));
    } finally {
      setBusy(false);
    }
  }
  const brand: Brand = { name: form.name || "A", logoUrl: form.logoUrl, primaryColor: form.primaryColor, supportUrl: form.supportUrl };
  return (
    <main className="auth-screen">
      <form className="auth-panel wide" onSubmit={submit}>
        <AppIcon brand={brand} />
        <p className="step-label">Step {step + 1} of 2</p>
        <h1>{step === 0 ? "Create your admin account" : "Brand and AI"}</h1>
        <p className="auth-lead">
          {step === 0 ? "Use the one-time setup code to create the single admin account for this workspace." : "You can change all of this later in Settings."}
        </p>
        {step === 0 ? (
          <Section footer="At least 12 characters. Save it in your password manager.">
            <FieldRow label="Setup code">
              <TextInput type="password" autoComplete="off" value={form.bootstrapToken} onChange={(e) => update("bootstrapToken", e.target.value)} required />
            </FieldRow>
            <FieldRow label="Email">
              <TextInput type="email" autoComplete="username" value={form.email} onChange={(e) => update("email", e.target.value)} required />
            </FieldRow>
            <FieldRow label="Password">
              <TextInput type="password" autoComplete="new-password" minLength={12} value={form.password} onChange={(e) => update("password", e.target.value)} required />
            </FieldRow>
          </Section>
        ) : (
          <>
            <Section title="Brand">
              <FieldRow label="Name">
                <TextInput value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Your business" required />
              </FieldRow>
              <FieldRow label="Accent color">
                <input className="color-input" type="color" value={form.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} />
              </FieldRow>
              <FieldRow label="Logo URL">
                <TextInput type="url" value={form.logoUrl} onChange={(e) => update("logoUrl", e.target.value)} placeholder="https://" />
              </FieldRow>
              <FieldRow label="Support page">
                <TextInput type="url" value={form.supportUrl} onChange={(e) => update("supportUrl", e.target.value)} placeholder="https://" />
              </FieldRow>
            </Section>
            <Section title="Anthropic" footer="The API key is encrypted before it is stored and is never shown again.">
              <FieldRow label="API key">
                <TextInput type="password" autoComplete="off" value={form.anthropicApiKey} onChange={(e) => update("anthropicApiKey", e.target.value)} placeholder="sk-ant-…" />
              </FieldRow>
              <FieldRow label="Cloudflare account ID">
                <TextInput value={form.accountId} onChange={(e) => update("accountId", e.target.value)} />
              </FieldRow>
              <FieldRow label="AI Gateway ID">
                <TextInput value={form.gatewayId} onChange={(e) => update("gatewayId", e.target.value)} />
              </FieldRow>
            </Section>
          </>
        )}
        {error && <Banner>{error}</Banner>}
        <div className="auth-actions">
          {step === 1 && (
            <Button type="button" variant="gray" size="large" onClick={() => setStep(0)}>
              Back
            </Button>
          )}
          {step === 0 ? (
            <Button type="button" size="large" onClick={() => setStep(1)} disabled={!form.bootstrapToken || !form.email || form.password.length < 12}>
              Continue
            </Button>
          ) : (
            <Button size="large" busy={busy}>
              Finish
            </Button>
          )}
        </div>
      </form>
    </main>
  );
}

export function Login({ brand, onDone }: { brand: Brand; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await post<{ csrfToken: string }>("/api/auth/login", { email, password });
      setCsrf(result.csrfToken);
      onDone();
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't sign in"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-screen">
      <form className="auth-panel" onSubmit={submit}>
        <AppIcon brand={brand} />
        <h1>{brand.name}</h1>
        <p className="auth-lead">Sign in to manage your AI assistant.</p>
        <Section>
          <FieldRow label="Email">
            <TextInput type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </FieldRow>
          <FieldRow label="Password">
            <TextInput type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </FieldRow>
        </Section>
        {error && <Banner>{error}</Banner>}
        <div className="auth-actions">
          <Button size="large" busy={busy}>
            Sign in
          </Button>
        </div>
      </form>
    </main>
  );
}
