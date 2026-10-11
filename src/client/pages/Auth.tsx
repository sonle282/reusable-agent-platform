import { useState, type FormEvent, type ReactNode } from "react";
import { post, setCsrf } from "../api";
import type { Brand } from "../types";
import { Alert, Button, errorMessage, Field, Icon, initialsOf, LeadStatus, SettingRow, Steps, TextInput, TypingDots } from "../ui";

// Split layout: form on the left, brand panel with an example chat on the right (hidden on narrow screens).
export function AuthLayout({ brand, children }: { brand: Brand; children: ReactNode }) {
  return (
    <div className="auth">
      <main className="auth-main">
        <div className="auth-brand">
          <span className="auth-mark" aria-hidden="true" style={brand.logoUrl ? { background: "var(--color-surface)" } : undefined}>
            {brand.logoUrl ? <img src={brand.logoUrl} alt="" /> : initialsOf(brand.name) || "A"}
          </span>
          <span>{brand.name}</span>
        </div>
        {children}
        <div className="auth-foot">
          <span>{brand.name} workspace</span>
        </div>
      </main>
      <aside className="auth-side" aria-hidden="true">
        <div className="stack" style={{ gap: 16 }}>
          <p className="display">Every message answered. Every lead in one place.</p>
          <p className="t2" style={{ margin: 0, font: "var(--text-md)", maxWidth: 440 }}>
            Your assistant replies in seconds, checks your real offers and lists the customers who are ready for a quote.
          </p>
        </div>
        <div className="mock-chat">
          <div className="mc-user">Do you deliver to Houston?</div>
          <TypingDots />
          <div className="mc-ai">Yes, we deliver across the US. Leave your phone number and a consultant will send you a detailed quote.</div>
          <div className="mc-lead">
            <LeadStatus status="new" />
            <span className="spacer truncate">Example customer · (555) 010-0142 · Quote request</span>
            <Icon name="phone" size={18} />
          </div>
        </div>
        <span className="xs t2">Example conversation</span>
      </aside>
    </div>
  );
}

function PasswordField({ id, label, value, onChange, autoComplete, strength }: { id: string; label: string; value: string; onChange: (value: string) => void; autoComplete: string; strength?: boolean }) {
  const [shown, setShown] = useState(false);
  const score = value.length >= 16 ? 3 : value.length >= 12 ? 2 : value.length > 0 ? 1 : 0;
  const hint = value.length === 0 ? "At least 12 characters. A short sentence works well." : value.length < 12 ? `${12 - value.length} more characters` : "Good password";
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="pw-wrap">
        <TextInput id={id} type={shown ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} required />
        <Button type="button" variant="ghost" size="sm" icon={shown ? "eye-off" : "eye"} className="pw-toggle" aria-label={shown ? "Hide password" : "Show password"} aria-pressed={shown} onClick={() => setShown(!shown)} />
      </div>
      {strength && (
        <>
          <div className="strength" aria-hidden="true">
            {[1, 2, 3].map((bar) => (
              <span key={bar} className={bar <= score ? "on" : ""} />
            ))}
          </div>
          <span className={value.length >= 12 ? "help text-success" : "help"} aria-live="polite">
            {hint}
          </span>
        </>
      )}
    </div>
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
        <div className="stack" style={{ gap: 12 }}>
          <h1 id="login-title" className="auth-title">
            Sign in to {brand.name}
          </h1>
          <p className="auth-lead">Manage your assistant, data and conversations.</p>
        </div>
        {error && (
          <Alert
            tone="danger"
            title={locked ? "Sign-in is paused" : /invalid email or password/i.test(error) ? "Email or password is wrong" : "Couldn't sign in"}
            text={locked ? "Too many tries. Wait 15 minutes, then try again." : /invalid email or password/i.test(error) ? "Check both and try again. After 5 tries, sign-in pauses for 15 minutes." : error}
          />
        )}
        <Field label="Email">
          <TextInput type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@business.com" required />
        </Field>
        <PasswordField id="login-password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
        <Button size="xl" block busy={busy} disabled={!email.trim() || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <p className="help" style={{ textAlign: "center" }}>
          Only the workspace owner can sign in here. Forgot the password? Reset it with the admin reset command.
        </p>
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
      <form className="auth-form" style={{ maxWidth: 420 }} onSubmit={submit} aria-labelledby="setup-title">
        <div className="stack" style={{ gap: 12 }}>
          <Steps total={2} current={step} />
          <span className="xs t3">Step {step} of 2</span>
          <h1 id="setup-title" className="auth-title">
            {step === 1 ? "Create the owner account" : "Your business"}
          </h1>
          <p className="auth-lead">{step === 1 ? "This account manages everything in this workspace." : "Shown to customers in website chat. You can change it later."}</p>
        </div>
        {step === 1 ? (
          <>
            <Field label="Setup code" hint="One-time code. It stops working after setup.">
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
            <Field label="Logo" hint="Square image, at least 256 px · optional">
              <TextInput type="url" value={form.logoUrl} onChange={(event) => update("logoUrl", event.target.value)} placeholder="Image address (https://)" />
            </Field>
            <SettingRow title="Chat color" sub="Used in the website chat">
              <input className="color-input" type="color" aria-label="Chat color" value={form.primaryColor} onChange={(event) => update("primaryColor", event.target.value)} />
            </SettingRow>
            <Alert tone="info" icon="key" title="AI key comes next, inside the app" text="Home shows it as the first step of the checklist. Nothing answers customers until you add it." />
          </>
        )}
        {error && <Alert tone="danger" title="Couldn't finish setup" text={error} />}
        <div className="row-flex">
          {step === 2 && (
            <Button type="button" variant="outline" size="xl" onClick={() => setStep(1)}>
              Back
            </Button>
          )}
          <Button size="xl" className="grow" busy={busy} disabled={cant}>
            {step === 1 ? "Continue" : "Open the app"}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
