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
  { id: "assistant", label: "Assistant", icon: "assistant" },
  { id: "data", label: "Data", icon: "data" },
  { id: "conversations", label: "Conversations", icon: "conversations" },
  { id: "connections", label: "Channels", icon: "connections" },
  { id: "settings", label: "Settings", icon: "settings" },
];
const assistantTabs: AssistantTab[] = ["test", "instructions", "sources", "versions"];

const defaultBrand: Brand = { name: "Assistant", logoUrl: "", primaryColor: "#007aff", supportUrl: "" };

// Route lives in the hash (#/assistant/sources) so reload and the back button keep the place.
function readRoute(): { page: Page; tab: AssistantTab; params: string[] } {
  const [page, ...rest] = window.location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  const known = nav.some((item) => item.id === page);
  return {
    page: known ? (page as Page) : "assistant",
    tab: page === "assistant" && assistantTabs.includes(rest[0] as AssistantTab) ? (rest[0] as AssistantTab) : "test",
    params: known && page !== "assistant" ? rest : [],
  };
}

function useRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const go = (page: Page, tab?: AssistantTab, ...params: string[]) => {
    window.location.hash = page === "assistant" ? `/assistant/${tab ?? route.tab}` : [`/${page}`, ...params.map(encodeURIComponent)].join("/");
  };
  return { ...route, go };
}

function Shell({ data, reload, logout }: { data: Bootstrap; reload: () => Promise<void>; logout: () => void }) {
  const { page, tab, params, go } = useRoute();
  // One assistant per workspace; the backend still stores agents generically.
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
        <nav aria-label="Main">
          {nav.map((item) => (
            <button key={item.id} className={page === item.id ? "active" : ""} aria-current={page === item.id ? "page" : undefined} onClick={() => go(item.id)}>
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className={`live-dot ${agent.active_version_id ? "on" : ""}`} />
          {agent.active_version_id ? "Assistant is live" : "Not live yet"}
        </div>
      </aside>
      <main className="content">
        {page === "assistant" && (
          <AssistantPage
            agentId={agent.id}
            collections={data.collections}
            tab={tab}
            onTab={(next) => go("assistant", next)}
            refresh={reload}
            navigate={(target, ...rest) => go(target, undefined, ...rest)}
          />
        )}
        {page === "data" && <DataPage collections={data.collections} reload={reload} openCollectionId={params[0]} openRecordId={params[1]} onSelect={(id) => go("data", undefined, id)} />}
        {page === "conversations" && <ConversationsPage />}
        {page === "connections" && <ConnectionsPage agent={agent} connections={data.connections} reload={reload} />}
        {page === "settings" && <SettingsPage brand={data.brand} modelDefaults={data.modelDefaults} reload={reload} logout={logout} />}
      </main>
      <nav className="tab-bar" aria-label="Main">
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

// First run: three answers give a working customer assistant; everything else can be refined later.
function CreateAssistant({ brand, onDone }: { brand: Brand; onDone: () => Promise<void> }) {
  const [form, setForm] = useState({ businessName: brand.name, offering: "", template: "sales" as "sales" | "support" | "blank" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("/api/admin/agents", {
        name: `${form.businessName} Assistant`,
        description: form.template === "support" ? "Customer support" : form.template === "sales" ? "Sales and customer questions" : "",
        primaryLanguage: "en",
        template: form.template,
        businessName: form.businessName,
        offering: form.offering,
      });
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
        <h1>Create your assistant</h1>
        <p className="auth-lead">It answers your customers like a trained team member — on your website, inbox or any channel you connect.</p>
        <Segmented
          label="Assistant type"
          value={form.template}
          onChange={(template) => setForm({ ...form, template })}
          options={[
            { value: "sales", label: "Sales" },
            { value: "support", label: "Support" },
            { value: "blank", label: "Blank" },
          ]}
        />
        <Section>
          <FieldRow label="Business name">
            <TextInput value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} required />
          </FieldRow>
          <FieldRow label="What do you offer?" stacked>
            <TextInput value={form.offering} onChange={(event) => setForm({ ...form, offering: event.target.value })} placeholder="e.g. Handmade furniture for homes and offices" />
          </FieldRow>
        </Section>
        {error && <Banner>{error}</Banner>}
        <div className="auth-actions">
          <Button size="large" busy={busy} disabled={!form.businessName.trim()}>
            Create assistant
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
