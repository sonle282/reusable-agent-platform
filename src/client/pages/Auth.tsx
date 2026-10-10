import { useState, type FormEvent } from "react";
import { post, setCsrf } from "../api";
import type { Brand } from "../types";
import { Banner, Button, FieldRow, Section, TextInput, errorMessage } from "../ui";

export function AppIcon({ brand, size = 64 }: { brand: Brand; size?: number }) {
  return (
    <span className="app-icon" style={{ width: size, height: size, borderRadius: size * 0.225, background: brand.logoUrl ? "#fff" : brand.primaryColor }}>
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
      setError(errorMessage(caught, "Không thể hoàn tất thiết lập"));
    } finally {
      setBusy(false);
    }
  }
  const brand: Brand = { name: form.name || "A", logoUrl: form.logoUrl, primaryColor: form.primaryColor, supportUrl: form.supportUrl };
  return (
    <main className="auth-screen">
      <form className="auth-panel wide" onSubmit={submit}>
        <AppIcon brand={brand} />
        <p className="step-label">Bước {step + 1} / 2</p>
        <h1>{step === 0 ? "Thiết lập quản trị" : "Thương hiệu và mô hình AI"}</h1>
        <p className="auth-lead">
          {step === 0
            ? "Dùng mã khởi tạo một lần để tạo tài khoản quản trị duy nhất cho hệ thống này."
            : "Bạn có thể thay đổi các thông tin này sau trong Cài đặt."}
        </p>
        {step === 0 ? (
          <Section footer="Mật khẩu tối thiểu 12 ký tự. Hãy lưu vào trình quản lý mật khẩu.">
            <FieldRow label="Mã khởi tạo">
              <TextInput type="password" autoComplete="off" value={form.bootstrapToken} onChange={(e) => update("bootstrapToken", e.target.value)} required />
            </FieldRow>
            <FieldRow label="Email">
              <TextInput type="email" autoComplete="username" value={form.email} onChange={(e) => update("email", e.target.value)} required />
            </FieldRow>
            <FieldRow label="Mật khẩu">
              <TextInput type="password" autoComplete="new-password" minLength={12} value={form.password} onChange={(e) => update("password", e.target.value)} required />
            </FieldRow>
          </Section>
        ) : (
          <>
            <Section title="Thương hiệu">
              <FieldRow label="Tên">
                <TextInput value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Mr Spa AI" required />
              </FieldRow>
              <FieldRow label="Màu chủ đạo">
                <input className="color-input" type="color" value={form.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} />
              </FieldRow>
              <FieldRow label="Logo URL">
                <TextInput type="url" value={form.logoUrl} onChange={(e) => update("logoUrl", e.target.value)} placeholder="https://" />
              </FieldRow>
              <FieldRow label="Trang hỗ trợ">
                <TextInput type="url" value={form.supportUrl} onChange={(e) => update("supportUrl", e.target.value)} placeholder="https://" />
              </FieldRow>
            </Section>
            <Section title="Anthropic qua AI Gateway" footer="API key được mã hoá trước khi lưu và không bao giờ hiển thị lại.">
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
              Quay lại
            </Button>
          )}
          {step === 0 ? (
            <Button type="button" size="large" onClick={() => setStep(1)} disabled={!form.bootstrapToken || !form.email || form.password.length < 12}>
              Tiếp tục
            </Button>
          ) : (
            <Button size="large" busy={busy}>
              Hoàn tất
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
      setError(errorMessage(caught, "Không thể đăng nhập"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-screen">
      <form className="auth-panel" onSubmit={submit}>
        <AppIcon brand={brand} />
        <h1>{brand.name}</h1>
        <p className="auth-lead">Đăng nhập để quản lý trợ lý AI.</p>
        <Section>
          <FieldRow label="Email">
            <TextInput type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </FieldRow>
          <FieldRow label="Mật khẩu">
            <TextInput type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </FieldRow>
        </Section>
        {error && <Banner>{error}</Banner>}
        <div className="auth-actions">
          <Button size="large" busy={busy}>
            Đăng nhập
          </Button>
        </div>
      </form>
    </main>
  );
}
