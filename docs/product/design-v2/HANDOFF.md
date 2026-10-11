# Admin redesign v2 — handoff for implementation

v2 replaces the Apple-style v1 (`docs/product/design/`). Source of truth is this folder.

**Design language:** the look of openai.com/brand (white/light gray, bold black type, black pill buttons, pastel blocks, soft gradients) with components from OpenAI's open-source **Apps SDK UI** (`@openai/apps-sdk-ui`, MIT) so the admin matches ChatGPT.
**Not allowed** (OpenAI brand terms): no OpenAI logo/Blossom/wordmark, no "OpenAI"/"GPT" in product names, no OpenAI Sans font without a license. `--font-sans` uses **Manrope** (Google Fonts, full Vietnamese).

| File | What it is |
|---|---|
| `styles.css` | All tokens (light/dark), type, radii, controls, motion + every component and page class. Port into `src/client/styles.css`, keep names. |
| `reference/Icons.dc.html` | Sprite: 67 OpenAI Apps SDK UI icons (`#i-*`, filled, 24 grid) + 11 platform logos from Simple Icons, CC0 (`#logo-*`). Copy the `<symbol>` paths into the `Icon` component / a `BrandLogo` component. Licenses: Apps SDK UI MIT (keep notice), Simple Icons CC0 (brand marks are trademarks — use only to identify the platform). |
| `reference/Main.dc.html` | Shell: sidebar (workspace, 6 nav items, Assistants quick list, account), tab bar, routing incl. `assistant/:id` and `data/:tableId`, toasts, publish, Fix sheet, create assistant. |
| `reference/PHome.dc.html` | Home: assistant filter, Needs attention, metrics, Assistants + Recent conversations, onboarding checklist (empty). |
| `reference/PAssistants.dc.html` | **New** Assistants page + New assistant sheet (templates) + delete dialog. |
| `reference/PAssistant.dc.html` | Builder, **one screen**: top bar, editor (tabs + own scroll), Preview full height. |
| `reference/PData.dc.html` | Data = tables list. |
| `reference/PTable.dc.html` | **New** table records page + row drawer. |
| `reference/PConversations.dc.html` | Full-height split, filters, ChatGPT-style thread. |
| `reference/PChannels.dc.html` | Channels with brand logos, "Answered by" per channel, connect sheet, channel drawer. |
| `reference/PSettings.dc.html` | Settings incl. Appearance and Messaging platforms (Zernio). |
| `reference/FixSheet.dc.html` | Fix this answer (3 steps, fail path, Keep it anyway). |
| `reference/Spec.dc.html` | What changed, tokens, components, layouts per breakpoint, product additions. |

Reading `.dc.html`: ignore `<x-dc>`, `<helmet>`, `<sc-if>` (= conditional), `<sc-for>` (= map), `<dc-import>` (= child component with props), `{{holes}}`; use the markup + class names and the logic in `renderVals()`. Anything tagged **Example** or `[placeholder]` is not real data.

---

## Phases (one commit each; build + tests after each)

### 1. Foundation
- Replace tokens with `styles.css` §1–1c (`[data-theme="light"|"dark"]`, also mirror dark under `@media (prefers-color-scheme: dark)` for `:root:not([data-theme="light"])` = "System").
- Manrope link in `index.html` (`family=Manrope:wght@400..800`).
- Port classes §2–24. Delete v1 classes that no longer exist (section-card inset lists, iOS toggle, field-row inline inputs, etc.).
- Container queries on `.app`: ≥1080 sidebar 260; 860–1079 icon sidebar 64; <860 tab bar.

### 2. Components (`ui.tsx`) — update existing, add new
- `Button` variants **primary · outline · soft · ghost · danger · danger-ghost · link**, sizes sm/md/lg/xl (28/32/36/40; phone md 40). Map old: filled→primary, tinted→soft, gray→outline, plain→ghost, destructive→danger-ghost.
- `Card` (replaces inset `Section`): head/title/actions, foot. `Row` (56 / compact 44, full-width dividers).
- `Field` (label above) wrapping `Input`/`Textarea` (auto-grow)/`Select`. `Switch` 32×19 (`role="switch"`). `Segmented` (pill), **new** `Tabs` (underline), **new** `Chips`, `SearchField` (pill).
- `Badge` (+ `example` tone), `Alert` (was Banner), **new** `Table`, `Sheet` (+ `wide`), **new** `Drawer` (right, 480), **new** `Dialog` (confirm), `Menu`, `EmptyState`, `Skeleton`, `Spinner`, toast (inverse pill).
- **New** `AgentAvatar` (pastel square, initials), **new** `BrandLogo` (platform → brand color + mark; api/web/webhook neutral with icon), `Avatar` with channel badge.
- `Icon`: swap to the OpenAI glyph paths from the sprite (fill, not stroke). Keep `name/size/label` API.

### 3. Shell + routing
- Routes: `/` Home · `/assistants` · `/assistants/:id` (builder) · `/data` · `/data/:tableId` · `/conversations` · `/channels` · `/settings`.
- Sidebar: workspace button (logo + name; switcher later), nav (Home, Assistants, Data, Conversations [needs-reply count], Channels [failed count], Settings), "Assistants" heading with + and one item per assistant (avatar, name, status dot: green live / orange unpublished / gray draft), account row at the bottom.
- Builder and Conversations render **flush** (no page padding) and own the full viewport height.

### 4. Pages
- **Home** — see PHome. Assistant filter applies to Needs attention and metrics. Empty workspace → onboarding checklist (6 steps, progress, next step is the only primary button).
- **Assistants** — grid of cards: avatar, name, description (2 lines), status, channel logos, chats today; ••• menu Edit / Duplicate / Pause|Resume / Delete (dialog). New assistant sheet: Start from (Blank, Copy existing, Sales consultant, Customer support, Appointment booking), Name, What should it do?, info that Data is shared → creates a draft and opens the builder.
- **Builder (one screen)** — `.builder` = `height: 100dvh` (minus nothing in production). Top bar 56: back, avatar, name + status line, autosave text, Publish / "Publish first version" (draft) / busy / "✓ Published". Left: underline tabs Instructions · Sources · Versions, content scrolls inside `.editor-scroll` (max 680 centered). Right: Preview 440 (head with Draft badge + New chat, chat scroll, Test scenarios bar, composer) — never scrolls with the page. Phone: segmented Test / Instructions / Sources / Versions in the top bar, one pane at a time.
  - Instructions fields (label above): Name, Business name, Description; Your business (What you offer, Contact and hours, Website); How it works (Its job, Voice and style); rule lists Always / Never / Hand off when / Contact details (input per line + remove + "Add"); **Conversation starters** (3); Fallback reply; Advanced card (Detailed playbook with `n of 33,000`, Model and reply length).
  - Sources: Knowledge card (rows + switch, row opens **Drawer** editor), Data it can look up (shared tables + switch, "Manage in Data"), Live lookups (advanced).
  - Preview messages: customer = right gray bubble; assistant = plain text + action row (Copy · "5 sources · 2 offers" toggles Details · Fix this answer).
- **Data** — tables list: Table (name + column summary), Rows, Used by (assistant avatars), Updated, chevron; "Show hidden tables (n)"; Import CSV + New table (sheet with templates Products / Offers / Opening hours / Blank). Row click → `/data/:id`.
- **Table records** — breadcrumb, title, meta + "Used by", Import CSV / Add row / ••• (Rename, Edit columns, Export CSV, Hide, Delete); search + chips (All, Active, Scheduled, Ended or off); records table (Offer, Details 2-line, Type, Availability = "Always" or exception badge); row → right **Drawer** (Active switch, Starts/Ends dates, fields, Delete row / Cancel / Save).
- **Conversations** — full-height split. List: title + assistant filter, search, chips (All, Needs reply, Leads, Your team), rows with avatar + channel logo badge, preview, assistant avatar + tags. Thread head: avatar, name, channel ("Messenger via Zernio"), answering assistant, "Your team replies" switch; paused alert; ChatGPT-style messages with Fix this answer on assistant replies.
- **Channels** — Connected card (logo, name, platform + last message, "Answered by" select, open → Drawer with name, assistant, address/key for API or account for Zernio, Turn off). Platform grid: Messenger, Instagram, WhatsApp, iMessage, Telegram, TikTok, X (via Zernio), Website chat, API, Webhook (built in), Zalo (Soon, disabled). Connect sheet per platform: Zernio steps + account select, or name/URL for built-ins, plus "Answered by".
- **Settings** — Appearance (System/Light/Dark), Workspace (name, logo, chat color), AI connection (status, key replace inline, Advanced), Messaging platforms (Zernio status + Manage), Backup, Sign out.

### 5. Backend changes needed (check what already exists — `connections.agent_id` already exists)
1. Multiple agents: list/create (from template or copy)/duplicate/pause/delete endpoints; per-agent draft, versions, knowledge, scenarios.
2. Data tables are workspace-level; agent ↔ table enable flags; "used by" lookup.
3. Channel: set `agent_id` from the UI; Zernio account list for the connect sheet; platform field for logos (from Zernio `message.platform` / account).
4. Conversation filters (agent, needs reply, leads, takeover); conversation carries channel platform + agent.
5. Conversation starters per agent (and push to Messenger ice breakers via Zernio if supported).
6. Theme preference per owner (System/Light/Dark).
7. Fix this answer + Needs attention as in `docs/product/2026-10-builder-upgrade/01-prd.md`.

## Acceptance checklist
- [ ] No OpenAI logo, name, or OpenAI Sans in the product; Manrope loads; Vietnamese renders correctly.
- [ ] Only tokens in components; light, dark and System work; AA contrast in both.
- [ ] Builder: at 1440×900 and 1280×720 the Preview composer is visible without scrolling; only the left editor scrolls.
- [ ] Data list and table records are separate routes; back via breadcrumb.
- [ ] Platform logos shown for every Zernio channel; neutral icons for API/Webhook/Website.
- [ ] Assistants can be created, opened, duplicated, paused, deleted; each channel shows which assistant answers.
- [ ] Phone (390): tab bar, one pane at a time in builder and conversations, bottom sheets, full-width drawers, no horizontal scroll.
- [ ] Keyboard and screen reader: focus ring, switches, dialogs trap/restore focus, icon buttons labelled.
