import { useEffect, useState, type FormEvent } from "react";
import { api, post, setCsrf } from "./api";
import { AcceptLink, AuthLayout, Login, Setup } from "./pages/Auth";
import { AssistantPage, type AssistantTab } from "./pages/Assistant";
import { AssistantsPage } from "./pages/Assistants";
import { ConnectionsPage } from "./pages/Connections";
import { ConversationsPage } from "./pages/Conversations";
import { DataPage } from "./pages/Data";
import { HomePage } from "./pages/Home";
import { LeadsPage } from "./pages/Leads";
import { SettingsPage } from "./pages/Settings";
import { useTheme, type ThemeChoice } from "./theme";
import type { AgentSummary, Bootstrap, Brand, Role } from "./types";
import { roleInfo } from "./pages/People";
import { AgentAvatar, agentStatus, Alert, Button, errorMessage, Field, Icon, initialsOf, Segmented, Spinner, TextInput, ToastProvider } from "./ui";

type Page = "home" | "leads" | "assistants" | "data" | "conversations" | "channels" | "settings";

const nav: Array<{ id: Page; label: string; short: string; icon: string }> = [
  { id: "home", label: "Home", short: "Home", icon: "home" },
  { id: "leads", label: "Leads", short: "Leads", icon: "phone" },
  { id: "assistants", label: "Assistants", short: "Assistants", icon: "assistant" },
  { id: "data", label: "Data", short: "Data", icon: "table" },
  { id: "conversations", label: "Conversations", short: "Chats", icon: "chats" },
  { id: "channels", label: "Channels", short: "Channels", icon: "link" },
  { id: "settings", label: "Settings", short: "Settings", icon: "settings" },
];
const pages: Page[] = nav.map((item) => item.id);
// Phone tab bar: six items; Data is reached from Home and from each assistant's Sources.
const tabs = nav.filter((item) => item.id !== "data");
// What each role sees. The server enforces the same split (src/worker/users.ts); this only keeps the screens tidy.
const allowedPages: Record<Role, Page[]> = {
  owner: pages,
  manager: pages.filter((id) => id !== "channels"),
  staff: ["home", "leads", "conversations", "settings"],
};
const assistantTabs: AssistantTab[] = ["test", "instructions", "sources", "followups", "behavior", "versions"];

const defaultBrand: Brand = { name: "Assistant", logoUrl: "", primaryColor: "#007aff", supportUrl: "" };

// Route lives in the hash (#/assistants/<id>/sources) so reload and the back button keep the place.
function readRoute(): { page: Page; params: string[] } {
  const [raw, ...rest] = window.location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  // Old links: #/connections is #/channels; #/assistant/<tab> is the first assistant (resolved in Shell).
  const page = raw === "connections" ? "channels" : raw === "assistant" ? "assistants" : raw;
  const params = raw === "assistant" ? ["", ...rest] : rest;
  return pages.includes(page as Page) ? { page: page as Page, params } : { page: "home", params: [] };
}

function useRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    if (/^#\/?connections\b/.test(window.location.hash)) window.history.replaceState(null, "", window.location.hash.replace(/connections/, "channels"));
  }, []);
  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const go = (page: Page, ...params: string[]) => {
    window.location.hash = [`/${page}`, ...params.filter((part) => part !== undefined).map(encodeURIComponent)].join("/");
  };
  return { ...route, go };
}

function BrandTile({ brand }: { brand: Brand }) {
  return (
    <span className="ws-logo" role="img" aria-label={`${brand.name} logo`}>
      {brand.logoUrl ? <img src={brand.logoUrl} alt="" /> : initialsOf(brand.name)}
    </span>
  );
}

function Shell({ data, reload, logout, themeChoice, setThemeChoice }: { data: Bootstrap; reload: () => Promise<void>; logout: () => void; themeChoice: ThemeChoice; setThemeChoice: (choice: ThemeChoice) => void }) {
  const { page, params, go } = useRoute();
  const agents = data.agents;
  const role: Role = data.me?.role ?? "owner";
  const can = (id: Page) => allowedPages[role].includes(id);
  // A link to a page this role can't open lands on Home.
  useEffect(() => {
    if (!can(page)) go("home");
  }, [page, role]);
  // The builder reports unpublished changes as you edit, before the next bootstrap.
  const [drafts, setDrafts] = useState<Record<string, boolean>>({});
  useEffect(() => setDrafts({}), [data]);
  const failed = data.attention?.failedDeliveries ?? 0;
  const newLeads = data.attention?.newLeads ?? 0;
  const openAgent = page === "assistants" ? agents.find((agent) => agent.id === params[0]) : undefined;
  // #/assistant/<tab> (old link) and #/assistants/<unknown id> fall back to the first assistant or the list.
  useEffect(() => {
    if (page === "assistants" && params[0] === "" && agents[0]) window.history.replaceState(null, "", `#/assistants/${agents[0].id}/${params[1] ?? "test"}`);
    if (page === "assistants" && params[0] === "") window.dispatchEvent(new HashChangeEvent("hashchange"));
  }, [page, params[0]]);
  useEffect(() => {
    document.title = `${openAgent?.name ?? nav.find((item) => item.id === page)?.label ?? ""} · ${data.brand.name}`;
  }, [page, openAgent?.name, data.brand.name]);
  if (!agents.length && role !== "staff") return <CreateAssistant brand={data.brand} onDone={reload} />;
  const statusOf = (agent: AgentSummary) => agentStatus(agent.active_version_id ? (agent.live_version ?? null) : null, drafts[agent.id] ?? Boolean(agent.unpublished));
  const count = (id: Page) => (id === "channels" ? failed : id === "leads" ? newLeads : 0);
  const hint = (id: Page) => (id === "channels" && failed > 0 ? `, ${failed} not delivered` : id === "leads" && newLeads > 0 ? `, ${newLeads} new` : "");
  const anyDraft = agents.some((agent) => statusOf(agent).dot !== "dot-green");
  const flush = Boolean(openAgent) || page === "conversations";
  const tab = assistantTabs.includes(params[1] as AssistantTab) ? (params[1] as AssistantTab) : "test";
  const navigate = (target: string, ...rest: string[]) => go((target === "home" ? "assistants" : target) as Page, ...rest);
  return (
    <div className="app-shell">
      <nav className="sidebar" aria-label="Main">
        <div className="workspace">
          <BrandTile brand={data.brand} />
          <span className="ws-name spacer strong truncate">{data.brand.name}</span>
        </div>
        {nav.filter((item) => can(item.id)).map((item) => (
          <button
            type="button"
            key={item.id}
            className="nav-item"
            aria-current={page === item.id && !(item.id === "assistants" && openAgent) ? "page" : undefined}
            aria-label={`${item.label}${hint(item.id)}`}
            title={item.label}
            onClick={() => go(item.id)}
          >
            <Icon name={item.icon} />
            <span className="nav-label">{item.label}</span>
            {count(item.id) > 0 && (
              <span className="nav-count" aria-hidden="true">
                {count(item.id)}
              </span>
            )}
          </button>
        ))}
        {can("assistants") && (
          <div className="nav-heading">
            <span>Assistants</span>
            <Button variant="ghost" size="sm" icon="plus" aria-label="New assistant" className="nav-add" onClick={() => go("assistants", "new")} />
          </div>
        )}
        {can("assistants") && agents.map((agent) => {
          const status = statusOf(agent);
          return (
            <button
              type="button"
              key={agent.id}
              className="nav-item"
              aria-current={openAgent?.id === agent.id ? "page" : undefined}
              aria-label={`${agent.name}, ${status.text}`}
              title={agent.name}
              onClick={() => go("assistants", agent.id, "test")}
            >
              <AgentAvatar id={agent.id} name={agent.name} size="xs" />
              <span className="nav-label">{agent.name}</span>
              <span className={`nav-dot ${status.dot}`} aria-hidden="true" />
            </button>
          );
        })}
        <button type="button" className="account" aria-label={`Your account: ${data.me?.name || data.me?.email || "Owner"}, ${roleInfo[role].label}`} title="Your account" onClick={() => go("settings")}>
          <span className="avatar" style={{ width: 28, height: 28, fontSize: 11 }} aria-hidden="true">
            {data.me?.name || data.me?.email ? initialsOf(data.me.name || data.me.email) : <Icon name="user" size={16} />}
          </span>
          <span className="account-name spacer stack" style={{ gap: 0 }}>
            <span className="medium truncate">{data.me?.name || data.me?.email || "Owner"}</span>
            <span className="xs t3 truncate">
              {roleInfo[role].label} · {data.brand.name}
            </span>
          </span>
        </button>
      </nav>
      <main className={`content${flush ? " is-flush" : ""}`}>
        {page === "home" && (
          <HomePage
            agents={agents}
            statusOf={statusOf}
            connections={data.connections}
            tableCount={data.collections.filter((collection) => !collection.archived_at).length}
            refresh={reload}
            role={role}
            go={(target, ...rest) => go(target as Page, ...rest)}
          />
        )}
        {page === "leads" && <LeadsPage role={role} openId={params[0]} onOpen={(id) => (id ? go("leads", id) : go("leads"))} onOpenConversation={(id) => go("conversations", id)} onChanged={() => void reload()} />}
        {page === "assistants" && !openAgent && params[0] !== "" && (
          <AssistantsPage
            agents={agents}
            statusOf={statusOf}
            connections={data.connections}
            brand={data.brand}
            creating={params[0] === "new"}
            onCreate={(open) => (open ? go("assistants", "new") : go("assistants"))}
            onOpen={(id) => go("assistants", id, "instructions")}
            reload={reload}
          />
        )}
        {openAgent && (
          <AssistantPage
            key={openAgent.id}
            agentId={openAgent.id}
            collections={data.collections}
            tab={tab}
            onTab={(next) => go("assistants", openAgent.id, next)}
            refresh={reload}
            navigate={navigate}
            onUnpublished={(value) => setDrafts((current) => (current[openAgent.id] === value ? current : { ...current, [openAgent.id]: value }))}
            hasZernio={data.connections.some((connection) => connection.type === "zernio" && connection.agent_id === openAgent.id)}
          />
        )}
        {page === "data" && <DataPage agents={agents} collections={data.collections} reload={reload} openCollectionId={params[0]} openRecordId={params[1]} onSelect={(id, recordId) => (id ? go("data", id, ...(recordId ? [recordId] : [])) : go("data"))} />}
        {page === "conversations" && <ConversationsPage role={role} agents={agents} connections={data.connections} openId={params[0]} onOpen={(id) => (id ? go("conversations", id) : go("conversations"))} onOpenSettings={() => go("settings")} />}
        {page === "channels" && <ConnectionsPage agents={agents} connections={data.connections} reload={reload} onOpenAssistant={(id) => go("assistants", id, "versions")} />}
        {page === "settings" && <SettingsPage me={data.me} zernio={data.connections.some((connection) => connection.type === "zernio" && connection.status === "active")} onManageChannels={() => go("channels")} brand={data.brand} modelDefaults={data.modelDefaults} reload={reload} logout={logout} themeChoice={themeChoice} setThemeChoice={setThemeChoice} />}
      </main>
      <nav className="tabbar" aria-label="Main">
        {tabs.filter((item) => can(item.id)).map((item) => (
          <button type="button" key={item.id} className="tab" aria-current={page === item.id ? "page" : undefined} aria-label={`${item.short}${hint(item.id)}`} onClick={() => go(item.id)}>
            <Icon name={item.icon} />
            <span>{item.short}</span>
            {count(item.id) > 0 && (
              <span className="nav-count" aria-hidden="true">
                {count(item.id)}
              </span>
            )}
            {item.id === "assistants" && anyDraft && <span className="nav-dot dot-orange" aria-hidden="true" />}
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
    <AuthLayout brand={brand}>
      <form className="auth-form" style={{ maxWidth: 420 }} onSubmit={submit} aria-labelledby="create-title">
        <div className="stack" style={{ gap: 12 }}>
          <h1 id="create-title" className="auth-title">
            Create your assistant
          </h1>
          <p className="auth-lead">It answers your customers like a trained team member — on your website, inbox or any channel you connect.</p>
        </div>
        <Segmented
          label="Assistant type"
          full
          value={form.template}
          onChange={(template) => setForm({ ...form, template })}
          options={[
            { value: "sales", label: "Sales" },
            { value: "support", label: "Support" },
            { value: "blank", label: "Blank" },
          ]}
        />
        <Field label="Business name">
          <TextInput value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} required />
        </Field>
        <Field label="What do you offer?">
          <TextInput value={form.offering} onChange={(event) => setForm({ ...form, offering: event.target.value })} placeholder="e.g. Handmade furniture for homes and offices" />
        </Field>
        {error && <Alert title="Couldn't create the assistant" text={error} />}
        <Button size="xl" block busy={busy} disabled={!form.businessName.trim()}>
          Create assistant
        </Button>
      </form>
    </AuthLayout>
  );
}

export function App() {
  const [state, setState] = useState<"loading" | "setup" | "login" | "link" | "ready">("loading");
  // #/invite/<token>: an invite or a password link the owner sent. The token stays in the #fragment.
  const [linkToken] = useState(() => window.location.hash.match(/^#\/invite\/([A-Za-z0-9_-]{20,200})$/)?.[1] ?? "");
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
        else if (linkToken) setState("link");
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
      {state === "link" && (
        <AcceptLink
          brand={brand}
          token={linkToken}
          onDone={() => {
            window.history.replaceState(null, "", "#/home");
            void loadAdmin();
          }}
        />
      )}
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
