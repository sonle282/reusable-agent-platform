import { useState, type FormEvent, type ReactNode } from "react";
import { post, setCsrf } from "../api";
import type { Brand } from "../types";
import { Alert, Button, errorMessage, TextInput } from "../ui";

export function AppIcon({ brand, size = 64 }: { brand: Brand; size?: number }) {
  return (
    <span className="app-icon" style={{ width: size, height: size, borderRadius: size * 0.225, background: brand.logoUrl ? "var(--color-surface)" : brand.primaryColor }}>
      {brand.logoUrl ? <img src={brand.logoUrl} alt="" /> : <b style={{ fontSize: size * 0.42 }}>{brand.name.slice(0, 1)}</b>}
    </span>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A";

// Split layout: form on the left, brand panel with an example chat on the right (hidden on narrow screens).
function AuthLayout({ brand, children }: { brand: Brand; children: ReactNode }) {
  return (
    <div className="auth">
      <main className="auth-main">
        <div className="auth-brand">
          <span className="auth-mark" aria-hidden="true" style={brand.logoUrl ? { background: "var(--color-surface)" } : undefined}>
            {brand.logoUrl ? <img src={brand.logoUrl} alt="" /> : initials(brand.name)}
          </span>
          <span>{brand.name}</span>
        </div>
        {children}
        <div className="auth-foot">
          <span>{brand.name} workspace</span>
        </div>
      </main>
      <aside className="auth-side" aria-hidden="true">
        <div className="auth-side-copy">
          <p className="auth-display">Every message answered. Every lead in one place.</p>
          <p className="auth-side-sub">Your assistant replies in seconds, checks your real offers and lists the customers who are ready for a quote.</p>
        </div>
        <div className="mock-chat">
          <div className="mc-user">Do you deliver to Houston?</div>
          <div className="typing-dots">
            <span />
            <span />
            <span />
          </div>
          <div className="mc-ai">Yes, we deliver across the US. Leave your phone number and a consultant will send you a detailed quote.</div>
          <div className="mc-lead">
            <span className="lead-status ls-new">New lead</span>
            <span className="truncate">Example customer · (555) 010-0142 · Quote request</span>
          </div>
        </div>
        <span className="auth-side-note">Example conversation</span>
      </aside>
    </div>
  );
}

function PasswordField({ id, label, value, onChange, autoComplete, strength }: { id: string; label: string; value: string; onChange: (value: string) => void; autoComplete: string; strength?: boolean }) {
  const [shown, setShown] = useState(false);
  const score = value.length >= 16 ? 3 : value.length >= 12 ? 2 : value.length > 0 ? 1 : 0;
  const hint = value.length === 0 ? "At least 12 characters. A short sentence works well." : value.length < 12 ? `${12 - value.length} more characters` : "Good password";
  return (
    <div className="auth-field">
      <label htmlFor={id} className="auth-label">
        {label}
      </label>
      <div className="pw-wrap">
        <TextInput id={id} type={shown ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} required />
        <Button type="button" variant="ghost" size="sm" icon={shown ? "eye-slash" : "eye"} className="pw-toggle" aria-label={shown ? "Hide password" : "Show password"} aria-pressed={shown} onClick={() => setShown(!shown)} />
      </div>
      {strength && (
        <>
          <div className="strength" aria-hidden="true">
            {[1, 2, 3].map((bar) => (
              <span key={bar} className={bar <= score ? "on" : ""} />
            ))}
          </div>
          <span className={value.length >= 12 ? "auth-help text-green" : "auth-help"} aria-live="polite">
            {hint}
          </span>
        </>
      )}
    </div>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return (
    <label className="auth-field">
      <span className="auth-label">{label}</span>
      {children}
      {help && <span className="auth-help">{help}</span>}
    </label>
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
  const locked = /too many attempts/i.test(error);
  return (
    <AuthLayout brand={brand}>
      <form className="auth-form" onSubmit={submit} aria-labelledby="login-title">
        <div className="auth-head">
          <h1 id="login-title" className="auth-title">
            Sign in to {brand.name}
          </h1>
          <p className="auth-lead">Manage your assistants, data and conversations.</p>
        </div>
        {error && (
          <Alert
            tone="error"
            title={locked ? "Sign-in is paused" : /invalid email or password/i.test(error) ? "Email or password is wrong" : "Couldn't sign in"}
            text={locked ? "Too many tries. Wait 15 minutes, then try again." : /invalid email or password/i.test(error) ? "Check both and try again. After 5 tries, sign-in pauses for 15 minutes." : error}
          />
        )}
        <Field label="Email">
          <TextInput type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@business.com" required />
        </Field>
        <PasswordField id="login-password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
        <Button size="lg" block busy={busy} disabled={!email.trim() || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <p className="auth-help auth-center">Only the workspace owner can sign in here. Forgot the password? Reset it with the admin reset command.</p>
      </form>
    </AuthLayout>
  );
}

export function Setup({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ bootstrapToken: "", email: "", password: "", name: "", logoUrl: "", primaryColor: "#1d2b36" });
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (step === 1) {
      setStep(2);
      return;
    }
    setBusy(true);
    setError("");
    try {
      // The AI key moved out of setup: Settings › AI connection and the Home checklist cover it.
      const result = await post<{ csrfToken: string }>("/api/setup", {
        bootstrapToken: form.bootstrapToken,
        email: form.email,
        password: form.password,
        brand: { name: form.name.trim(), logoUrl: form.logoUrl.trim(), primaryColor: form.primaryColor, supportUrl: "" },
      });
      setCsrf(result.csrfToken);
      onDone();
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't finish setup"));
    } finally {
      setBusy(false);
    }
  }
  const brand: Brand = { name: form.name.trim() || "Your business", logoUrl: form.logoUrl, primaryColor: form.primaryColor, supportUrl: "" };
  const cant = step === 1 ? !form.bootstrapToken || !form.email.trim() || form.password.length < 12 : !form.name.trim();
  return (
    <AuthLayout brand={brand}>
      <form className="auth-form wide" onSubmit={submit} aria-labelledby="setup-title">
        <div className="auth-head">
          <div className="auth-steps" aria-hidden="true">
            <span className="on" />
            <span className={step === 2 ? "on" : ""} />
          </div>
          <span className="auth-step">Step {step} of 2</span>
          <h1 id="setup-title" className="auth-title">
            {step === 1 ? "Create the owner account" : "Your business"}
          </h1>
          <p className="auth-lead">{step === 1 ? "This account manages everything in this workspace." : "Shown to customers in website chat. You can change it later."}</p>
        </div>
        {step === 1 ? (
          <>
            <Field label="Setup code" help="One-time code. It stops working after setup.">
              <TextInput className="mono" type="password" autoComplete="off" value={form.bootstrapToken} onChange={(event) => update("bootstrapToken", event.target.value)} placeholder="From your install message" required data-autofocus />
            </Field>
            <Field label="Your email">
              <TextInput type="email" autoComplete="username" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="you@business.com" required />
            </Field>
            <PasswordField id="setup-password" label="Password" value={form.password} onChange={(value) => update("password", value)} autoComplete="new-password" strength />
          </>
        ) : (
          <>
            <Field label="Business name">
              <TextInput value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="Your business" autoComplete="organization" required />
            </Field>
            <Field label="Logo" help="Square image, at least 256 px · optional">
              <TextInput type="url" value={form.logoUrl} onChange={(event) => update("logoUrl", event.target.value)} placeholder="Image address (https://)" />
            </Field>
            <div className="auth-row">
              <span className="auth-row-text">
                <span className="auth-label">Chat color</span>
                <span className="auth-help">Used in the website chat</span>
              </span>
              <input className="color-input" type="color" aria-label="Chat color" value={form.primaryColor} onChange={(event) => update("primaryColor", event.target.value)} />
            </div>
            <Alert tone="info" title="AI key comes next, inside the app" text="Home shows it as the first step of the checklist. Nothing answers customers until you add it." />
          </>
        )}
        {error && <Alert tone="error" title="Couldn't finish setup" text={error} />}
        <div className="auth-actions">
          {step === 2 && (
            <Button type="button" variant="outline" size="lg" onClick={() => setStep(1)}>
              Back
            </Button>
          )}
          <Button size="lg" className="grow" busy={busy} disabled={cant}>
            {step === 1 ? "Continue" : "Open the app"}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
