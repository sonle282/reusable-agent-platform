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
      <PageHeader title="Cài đặt" />
      {error && <Banner onClose={() => setError("")}>{error}</Banner>}
      <Section
        title="Mô hình AI"
        footer="Gọi Anthropic qua Cloudflare AI Gateway. API key được mã hoá khi lưu và không bao giờ hiển thị lại. Lưu khoá mới sẽ áp dụng cho bản nháp; xuất bản để dùng cho khách."
      >
        <Row title="Trạng thái" detail={hasKey ? "Đã có API key" : "Chưa có API key"} />
        <FieldRow label={hasKey ? "API key mới" : "API key"}>
          <TextInput type="password" autoComplete="off" value={credential.apiKey} placeholder="sk-ant-…" onChange={(event) => setCredential({ ...credential, apiKey: event.target.value })} />
        </FieldRow>
        <FieldRow label="Cloudflare account ID">
          <TextInput value={credential.accountId} onChange={(event) => setCredential({ ...credential, accountId: event.target.value })} />
        </FieldRow>
        <FieldRow label="AI Gateway ID">
          <TextInput value={credential.gatewayId} onChange={(event) => setCredential({ ...credential, gatewayId: event.target.value })} />
        </FieldRow>
        <div className="row row-actions">
          <Button
            variant="gray"
            size="small"
            busy={busy === "test"}
            disabled={!hasKey}
            onClick={() =>
              void run("test", async () => {
                const result = await post<{ connected: boolean; model: string }>("/api/admin/settings/anthropic/test", model ? { model } : {});
                toast(result.connected ? `Kết nối tốt · ${modelLabel(result.model)}` : "Không kết nối được", result.connected ? "default" : "error");
              })
            }
          >
            Kiểm tra kết nối
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
                toast("Đã lưu API key");
              })
            }
          >
            Lưu
          </Button>
        </div>
      </Section>
      <Section title="Thương hiệu" footer="Hiển thị ở trang đăng nhập và thanh bên. Thay đổi có hiệu lực ngay.">
        <FieldRow label="Tên">
          <TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </FieldRow>
        <FieldRow label="Màu chủ đạo">
          <input className="color-input" type="color" value={form.primaryColor} onChange={(event) => setForm({ ...form, primaryColor: event.target.value })} />
        </FieldRow>
        <FieldRow label="Logo URL">
          <TextInput type="url" value={form.logoUrl} onChange={(event) => setForm({ ...form, logoUrl: event.target.value })} placeholder="https://" />
        </FieldRow>
        <FieldRow label="Trang hỗ trợ">
          <TextInput type="url" value={form.supportUrl} onChange={(event) => setForm({ ...form, supportUrl: event.target.value })} placeholder="https://" />
        </FieldRow>
        {brandChanged && (
          <div className="row row-actions">
            <Button variant="gray" size="small" onClick={() => setForm(brand)}>Huỷ</Button>
            <Button
              size="small"
              busy={busy === "brand"}
              onClick={() =>
                void run("brand", async () => {
                  await patch("/api/admin/settings/brand", form);
                  await reload();
                  toast("Đã lưu thương hiệu");
                })
              }
            >
              Lưu
            </Button>
          </div>
        )}
      </Section>
      <Section title="Sao lưu" footer="Gồm cấu hình trợ lý, các phiên bản, dữ liệu và tình huống đánh giá. Không bao gồm khoá hay mật khẩu.">
        <a className="row row-button" href="/api/admin/export" download>
          <span className="row-text">
            <span className="row-title text-tint">Tải bản sao lưu (JSON)</span>
          </span>
        </a>
      </Section>
      <Section>
        <button className="row row-button" onClick={logout}>
          <span className="row-text">
            <span className="row-title text-red">Đăng xuất</span>
          </span>
        </button>
      </Section>
    </div>
  );
}
