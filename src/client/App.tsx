import { useEffect, useState, type FormEvent } from "react";
import { api, post, setCsrf } from "./api";
import { AppIcon, Login, Setup } from "./pages/Auth";
import { AssistantPage, type AssistantTab } from "./pages/Assistant";
import { ConnectionsPage } from "./pages/Connections";
import { ConversationsPage } from "./pages/Conversations";
import { DataPage } from "./pages/Data";
import { HomePage } from "./pages/Home";
import { LeadsPage } from "./pages/Leads";
import { SettingsPage } from "./pages/Settings";
import { useTheme, type ThemeChoice } from "./theme";
import type { Bootstrap, Brand } from "./types";
import { Alert, Button, Card, errorMessage, Field, Icon, Segmented, Spinner, TextInput, ToastProvider } from "./ui";

type Page = "home" | "leads" | "assistant" | "data" | "conversations" | "connections" | "settings";

const nav: Array<{ id: Page; label: string; icon: string }> = [
  { id: "home", label: "Home", icon: "house" },
  { id: "leads", label: "Leads", icon: "person-plus" },
  { id: "assistant", label: "Assistant", icon: "sparkles" },
  { id: "data", label: "Data", icon: "table" },
  { id: "conversations", label: "Conversations", icon: "bubbles" },
  { id: "connections", label: "Channels", icon: "link" },
  { id: "settings", label: "Settings", icon: "gear" },
];
const assistantTabs: AssistantTab[] = ["test", "instructions", "sources", "followups", "behavior", "versions"];

const defaultBrand: Brand = { name: "Assistant", logoUrl: "", primaryColor: "#007aff", supportUrl: "" };

// Route lives in the hash (#/assistant/sources) so reload and the back button keep the place.
function readRoute(): { page: Page; tab: AssistantTab; params: string[] } {
  const [page, ...rest] = window.location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  const known = nav.some((item) => item.id === page);
  return {
    page: known ? (page as Page) : "home",
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

function BrandTile({ brand }: { brand: Brand }) {
  const initials = brand.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <span className="brand-tile" role="img" aria-label={`${brand.name} logo`}>
      {brand.logoUrl ? <img src={brand.logoUrl} alt="" /> : initials}
    </span>
  );
}

function Shell({ data, reload, logout, themeChoice, setThemeChoice }: { data: Bootstrap; reload: () => Promise<void>; logout: () => void; themeChoice: ThemeChoice; setThemeChoice: (choice: ThemeChoice) => void }) {
  const { page, tab, params, go } = useRoute();
  // One assistant per workspace; the backend still stores agents generically.
  const agent = data.agents[0];
  const [unpublished, setUnpublished] = useState(Boolean(data.attention?.unpublished));
  useEffect(() => setUnpublished(Boolean(data.attention?.unpublished)), [data.attention?.unpublished]);
  const failed = data.attention?.failedDeliveries ?? 0;
  const newLeads = data.attention?.newLeads ?? 0;
  useEffect(() => {
    document.title = `${nav.find((item) => item.id === page)?.label ?? ""} · ${data.brand.name}`;
  }, [page, data.brand.name]);
  if (!agent) return <CreateAssistant brand={data.brand} onDone={reload} />;
  const signal = (id: Page) => ({
    dot: id === "assistant" && unpublished,
    badge: id === "connections" && failed > 0 ? failed : id === "leads" ? newLeads : 0,
    hint: id === "assistant" && unpublished ? ", unpublished changes" : id === "connections" && failed > 0 ? `, ${failed} not delivered` : id === "leads" && newLeads > 0 ? `, ${newLeads} new` : "",
  });
  return (
    <div className="app-shell">
      <nav className="sidebar" aria-label="Main">
        <div className="brand">
          <BrandTile brand={data.brand} />
          <span className="brand-name truncate">{data.brand.name}</span>
        </div>
        {nav.map((item) => {
          const { dot, badge, hint } = signal(item.id);
          return (
            <button
              type="button"
              key={item.id}
              className="nav-item"
              aria-current={page === item.id ? "page" : undefined}
              aria-label={`${item.label}${hint}`}
              title={item.label}
              onClick={() => go(item.id)}
            >
              <Icon name={item.icon} size={18} />
              <span className="nav-label">{item.label}</span>
              {dot && <span className="nav-dot" aria-hidden="true" />}
              {badge > 0 && <span className="nav-badge" aria-hidden="true">{badge}</span>}
            </button>
          );
        })}
      </nav>
      <main className="content">
        {page === "home" && <HomePage agent={agent} connections={data.connections} liveVersion={data.attention?.liveVersion ?? null} unpublished={unpublished} refresh={reload} go={(target, ...rest) => go(target, undefined, ...rest)} />}
        {page === "leads" && <LeadsPage openId={params[0]} onOpen={(id) => (id ? go("leads", undefined, id) : go("leads"))} onOpenConversation={(id) => go("conversations", undefined, id)} onChanged={() => void reload()} />}
        {page === "assistant" && (
          <AssistantPage
            agentId={agent.id}
            collections={data.collections}
            tab={tab}
            onTab={(next) => go("assistant", next)}
            refresh={reload}
            navigate={(target, ...rest) => go(target, undefined, ...rest)}
            onUnpublished={setUnpublished}
            hasZernio={data.connections.some((connection) => connection.type === "zernio")}
          />
        )}
        {page === "data" && <DataPage collections={data.collections} reload={reload} openCollectionId={params[0]} openRecordId={params[1]} onSelect={(id) => go("data", undefined, id)} />}
        {page === "conversations" && <ConversationsPage agentId={agent.id} connections={data.connections} openId={params[0]} onOpen={(id) => go("conversations", undefined, id)} onOpenSettings={() => go("settings")} />}
        {page === "connections" && <ConnectionsPage agent={agent} connections={data.connections} reload={reload} onOpenAssistant={() => go("assistant")} />}
        {page === "settings" && <SettingsPage agentId={agent.id} brand={data.brand} modelDefaults={data.modelDefaults} reload={reload} logout={logout} themeChoice={themeChoice} setThemeChoice={setThemeChoice} />}
      </main>
      {/* Phone tab bar: unchanged for now; the phone layout is a later pass. */}
      <nav className="tab-bar" aria-label="Main">
        {nav.filter((item) => item.id !== "data").map((item) => (
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
        <Card>
          <Field label="Business name">
            <TextInput value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} required />
          </Field>
          <Field label="What do you offer?">
            <TextInput value={form.offering} onChange={(event) => setForm({ ...form, offering: event.target.value })} placeholder="e.g. Handmade furniture for homes and offices" />
          </Field>
        </Card>
        {error && <Alert>{error}</Alert>}
        <div className="auth-actions">
          <Button size="lg" busy={busy} disabled={!form.businessName.trim()}>
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
  const { theme, choice, setChoice } = useTheme();
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
    <div className="app" data-theme={theme}>
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
          themeChoice={choice}
          setThemeChoice={setChoice}
          logout={async () => {
            await post("/api/admin/logout").catch(() => undefined);
            setData(null);
            setState("login");
          }}
        />
      )}
    </ToastProvider>
    </div>
  );
}
