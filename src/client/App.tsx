import { useEffect, useState, type FormEvent } from "react";
import { api, post, setCsrf } from "./api";
import { AppIcon, Login, Setup } from "./pages/Auth";
import { AssistantPage, type AssistantTab } from "./pages/Assistant";
import { ConnectionsPage } from "./pages/Connections";
import { ConversationsPage } from "./pages/Conversations";
import { DataPage } from "./pages/Data";
import { SettingsPage } from "./pages/Settings";
import type { Bootstrap, Brand } from "./types";
import { Banner, Button, FieldRow, Icon, Section, Segmented, Spinner, TextInput, ToastProvider, errorMessage } from "./ui";

type Page = "assistant" | "data" | "conversations" | "connections" | "settings";

const nav: Array<{ id: Page; label: string; icon: string }> = [
  { id: "assistant", label: "Trợ lý", icon: "assistant" },
  { id: "data", label: "Dữ liệu", icon: "data" },
  { id: "conversations", label: "Hội thoại", icon: "conversations" },
  { id: "connections", label: "Kết nối", icon: "connections" },
  { id: "settings", label: "Cài đặt", icon: "settings" },
];
const assistantTabs: AssistantTab[] = ["test", "instructions", "sources", "versions"];

const defaultBrand: Brand = { name: "Agent Platform", logoUrl: "", primaryColor: "#007aff", supportUrl: "" };

// Route lives in the hash (#/assistant/sources) so reload and the back button keep the place.
function readRoute(): { page: Page; tab: AssistantTab } {
  const [page, tab] = window.location.hash.replace(/^#\/?/, "").split("/");
  return {
    page: nav.some((item) => item.id === page) ? (page as Page) : "assistant",
    tab: assistantTabs.includes(tab as AssistantTab) ? (tab as AssistantTab) : "test",
  };
}

function useRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const go = (page: Page, tab?: AssistantTab) => {
    window.location.hash = page === "assistant" ? `/assistant/${tab ?? route.tab}` : `/${page}`;
  };
  return { ...route, go };
}

function Shell({ data, reload, logout }: { data: Bootstrap; reload: () => Promise<void>; logout: () => void }) {
  const { page, tab, go } = useRoute();
  // One assistant per deployment; the backend still stores agents generically.
  const agent = data.agents[0];
  useEffect(() => {
    document.title = `${nav.find((item) => item.id === page)?.label ?? ""} · ${data.brand.name}`;
  }, [page, data.brand.name]);
  if (!agent) return <CreateAssistant brand={data.brand} onDone={reload} />;
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <AppIcon brand={data.brand} size={30} />
          <b>{data.brand.name}</b>
        </div>
        <nav aria-label="Điều hướng chính">
          {nav.map((item) => (
            <button key={item.id} className={page === item.id ? "active" : ""} aria-current={page === item.id ? "page" : undefined} onClick={() => go(item.id)}>
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className={`live-dot ${agent.active_version_id ? "on" : ""}`} />
          {agent.active_version_id ? "Trợ lý đang chạy" : "Chưa xuất bản"}
        </div>
      </aside>
      <main className="content">
        {page === "assistant" && <AssistantPage agentId={agent.id} collections={data.collections} tab={tab} onTab={(next) => go("assistant", next)} refresh={reload} openSettings={() => go("settings")} />}
        {page === "data" && <DataPage collections={data.collections} reload={reload} />}
        {page === "conversations" && <ConversationsPage />}
        {page === "connections" && <ConnectionsPage agent={agent} connections={data.connections} reload={reload} />}
        {page === "settings" && <SettingsPage brand={data.brand} modelDefaults={data.modelDefaults} reload={reload} logout={logout} />}
      </main>
      <nav className="tab-bar" aria-label="Điều hướng chính">
        {nav.map((item) => (
          <button key={item.id} className={page === item.id ? "active" : ""} aria-current={page === item.id ? "page" : undefined} onClick={() => go(item.id)}>
            <Icon name={item.icon} size={22} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function CreateAssistant({ brand, onDone }: { brand: Brand; onDone: () => Promise<void> }) {
  const [form, setForm] = useState({ name: "", description: "", template: "sales" as "sales" | "support" | "blank", primaryLanguage: "vi" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("/api/admin/agents", form);
      await onDone();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }
  return (
    <main className="auth-screen">
      <form className="auth-panel" onSubmit={submit}>
        <AppIcon brand={brand} />
        <h1>Tạo trợ lý</h1>
        <p className="auth-lead">Chọn mẫu khởi đầu. Bạn có thể chỉnh hướng dẫn, thêm kiến thức và dữ liệu ngay sau đó.</p>
        <Segmented
          label="Mẫu"
          value={form.template}
          onChange={(template) => setForm({ ...form, template })}
          options={[
            { value: "sales", label: "Tư vấn bán hàng" },
            { value: "support", label: "Chăm sóc khách" },
            { value: "blank", label: "Trống" },
          ]}
        />
        <Section>
          <FieldRow label="Tên">
            <TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={`${brand.name} Assistant`} required />
          </FieldRow>
          <FieldRow label="Giúp khách việc gì" stacked>
            <TextInput value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Tư vấn sản phẩm, ưu đãi và chính sách" />
          </FieldRow>
        </Section>
        {error && <Banner>{error}</Banner>}
        <div className="auth-actions">
          <Button size="large" busy={busy}>
            Tạo trợ lý
          </Button>
        </div>
      </form>
    </main>
  );
}

export function App() {
  const [state, setState] = useState<"loading" | "setup" | "login" | "ready">("loading");
  const [brand, setBrand] = useState<Brand>(defaultBrand);
  const [data, setData] = useState<Bootstrap | null>(null);
  async function loadAdmin() {
    try {
      const session = await api<{ csrfToken: string }>("/api/admin/session");
      setCsrf(session.csrfToken);
      await reload();
      setState("ready");
    } catch {
      setState("login");
    }
  }
  async function reload() {
    const bootstrap = await api<Bootstrap>("/api/admin/bootstrap");
    const merged = { ...bootstrap, brand: { ...defaultBrand, ...bootstrap.brand } };
    setBrand(merged.brand);
    setData(merged);
  }
  useEffect(() => {
    void (async () => {
      try {
        const status = await api<{ setupComplete: boolean; brand: Brand }>("/api/setup/status");
        setBrand({ ...defaultBrand, ...status.brand });
        if (!status.setupComplete) setState("setup");
        else await loadAdmin();
      } catch {
        setState("login");
      }
    })();
  }, []);
  return (
    <ToastProvider>
      {state === "loading" && (
        <div className="page-loading full">
          <Spinner />
        </div>
      )}
      {state === "setup" && <Setup onDone={() => void loadAdmin()} />}
      {state === "login" && <Login brand={brand} onDone={() => void loadAdmin()} />}
      {state === "ready" && data && (
        <Shell
          data={data}
          reload={reload}
          logout={async () => {
            await post("/api/admin/logout").catch(() => undefined);
            setData(null);
            setState("login");
          }}
        />
      )}
    </ToastProvider>
  );
}
