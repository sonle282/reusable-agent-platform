# Admin redesign — handoff for implementation

Approved design: **Direction A visual style · Home layout A · Assistant layout B in the style of ChatGPT's GPT builder** (settings left, live Preview right).
Source of truth is this folder:

| File | What it is | How to use it |
|---|---|---|
| `styles.css` | **All design tokens + every primitive and page class.** Light/dark via `[data-theme]`, responsive via container queries on `.app`. | Port it into `src/client/styles.css`. Keep the token names and class names exactly. |
| `reference/Main.dc.html` | Shell: sidebar, phone tab bar, page switching, toasts, publish flow, Fix sheet wiring. | Markup reference for `App.tsx`. |
| `reference/PHome.dc.html` | Home + Needs attention. | Markup reference for `pages/Home.tsx`. |
| `reference/PAssistant.dc.html` | Assistant: header, segmented, Instructions / Sources / Versions editor, Preview (Test) pane, scenarios bar, restore alert, knowledge sheet. | Reference for `pages/Assistant.tsx`. |
| `reference/PData.dc.html` | Data: tables master list, rows, ••• menu, row editor sheet. | Reference for `pages/Data.tsx`. |
| `reference/PConversations.dc.html` | Conversations split view, takeover switch, transcript. | Reference for `pages/Conversations.tsx`. |
| `reference/PChannels.dc.html` | Channels: failed replies, connected, add channel, channel sheet. | Reference for `pages/Connections.tsx`. |
| `reference/PSettings.dc.html` | Settings: AI, Brand, Backup, Sign out. | Reference for `pages/Settings.tsx`. |
| `reference/FixSheet.dc.html` | "Fix this answer" 3-step sheet incl. failing path + "Keep it anyway". | New component. |
| `reference/Icons.dc.html` | 49 SF-Symbols-style icons (24 grid, 1.6 stroke) as `<symbol id="i-…">`. | Replace/extend the icon map in `ui.tsx`. |
| `reference/Spec.dc.html` | Token tables, primitive measurements, layouts per breakpoint, content rules (data is in its `renderVals()`). | Read for exact numbers. |

**How to read the `.dc.html` files:** they are design-canvas components. Ignore the `<x-dc>`, `<helmet>`, `<sc-if>`, `<sc-for>`, `<dc-import>` wrappers and `{{holes}}` — treat them like JSX conditionals/maps/props. The markup inside (elements + `class` names from `styles.css`) and the logic in `renderVals()` are what to implement. Data marked **"Example"** or with `[placeholders]` is not real; wire the real API data.

---

## 0. Ground rules

- Keep the information architecture and API calls. This is a UI change; only §6 adds behaviour.
- Components use tokens only (`var(--…)`). No raw hex in TSX or page CSS.
- One filled button per screen. Status only when not normal. Plain words (no tool / eval / prompt / LLM / trace / score / latency in primary UI).
- Accessibility: 44px targets, focus ring, `role="switch"`, dialog focus trap + Esc + return focus, `prefers-reduced-motion`, AA in both themes.
- Work in small commits per phase below; run `npm run build` and the tests after each phase.

## 1. Foundation (styles.css)

1. Replace the token block at the top of `src/client/styles.css` with sections 1–1c of `styles.css` here (colors light/dark, type, spacing, radii, shadows, motion, layout). Keep the old variable names only as aliases if something still needs them, then remove them.
2. Theme: set `data-theme` on the `.app` root from (a) a stored owner choice, else (b) `prefers-color-scheme`. Add a `@media (prefers-color-scheme: dark)` block mirroring `[data-theme="dark"]` for `:root:not([data-theme="light"])` so first paint is right.
3. Fonts: add the Inter Google Fonts link (`opsz,wght@14..32,400..700`) in `index.html`; the stack in `--font-sans` puts SF first, Inter second.
4. Port the primitive and page classes (sections 2–24). Delete superseded rules (old `.btn:disabled { opacity: .4 }`, old page widths, `.page.narrow`, sidebar footer, etc.).
5. Add `scrollbar-gutter: stable` (already on `.app`).
6. Responsive is **container queries** on `.app` (`container: app / inline-size`): ≥1080 full sidebar 240; 860–1079 icon-only sidebar 72; <860 tab bar. Keep the existing 860 breakpoint semantics.

## 2. Primitives (ui.tsx) — change, don't fork

| Primitive | Change |
|---|---|
| `Icon` | Glyph set from `reference/Icons.dc.html` (same names minus `i-`). Stroke 1.6, round caps/joins. Keep the existing `name/size/label` API; add new names: wrench, check-bubble, person-plus, team, pause, offline, restore, upload, download, key, palette, signout, eye-slash, pencil, trash, copy, globe, archive, sliders, webhook, inbox, error, warning, info, ellipsis. |
| `Button` | Variants `filled / tinted / gray / plain / destructive` + `plain` with `destructive` flag; sizes `small 28 / regular 36 / large 44`; pill radius; `busy` prop (spinner + label, keeps width); disabled = fill bg + label-3 (never faded tint); small gets ::after hit area. |
| `PageHeader` | Large title 34/41 (phone 30/36), optional `subtitle` (one line), optional `status` (StatusLine), `actions` on the right. Same height on every page. |
| `Section` | header 13/18 600 **sentence case** (no uppercase), optional header `action` (plain button) and `badge`; card radius 12; footer 12/16. |
| `Row` | min-h 44, inset separator starting at text, `tile` (solid/soft tones), `avatar`, `title` (+`strong`), `subtitle` (+`clamp2`), `detail`, `accessory`, `chevron`, `selected`, `top` alignment. Whole row clickable; remove separate "Edit" links. |
| `FieldRow` | inline (label left, value right) and `stacked` (label above, auto-growing textarea: `field-sizing: content` + JS fallback; no fill, no resize grip, no inner scroll). |
| `Toggle` | 46×28, knob 24, `role="switch"`, green on. |
| `Segmented` | track r9 p2, items 28h; `full` variant for phone. |
| `SearchField` | 36h r10 fill, icon 16. |
| `Badge` | tones green/orange/red/blue/neutral/outline + `count` variant. Remove `StatusBadge` defaults that render "Ready/Active/Completed" — only exceptions get a badge. |
| `Banner` | tones info/warning/error/success (soft fill, no border), `title`, `text`, `actions` (required for warning/error). |
| `Sheet` | desktop centered 560, phone bottom sheet with grabber; header (title, subtitle, × button), single scroll body, footer (destructive left, Cancel + primary right; stacked large on phone); focus trap, Esc, return focus. Remove nested scroll containers inside sheets. |
| `EmptyState` | 56 icon circle, title 17, text 13, one action. |
| toast | pill, bottom center (above tab bar on phone), check icon, optional action (e.g. Undo, Publish), 3.6 s. `useToast().show(msg, { actionLabel, onAction })`. |
| `Spinner` | 16 / 28. |
| **New** `Skeleton` | lines/rows for first load (replace page-level spinners). |
| **New** `Menu` | ••• popover with items, group label, separator, destructive item. |
| **New** `Alert` | small confirm dialog (Restore version, Keep failing fix). |
| **New** `StatusLine` | 8px dot + 13px text (Live · version 3 / Unpublished changes). |
| **New** `Disclosure` | collapsible row for advanced areas. |
| **New** `Steps`, `Diff` | for Fix sheet. |
| **New** `MetaChip` + `DetailsCard` | reply details in Preview. |

Also add `displayName(conversation)` and update `formatDate` in `format.ts`:
- Names: contact name → phone → `"Visitor " + last 4 chars of external id`. Never show raw ids anywhere (lists, titles, sheets).
- Dates: today `2:39 PM`, yesterday `Yesterday`, this week weekday, older `Oct 3`, year only if not current year. Transcripts use time separators (`Today 2:39 PM`) when the gap > 15 min instead of a time under each bubble.

## 3. Shell (App.tsx)

- Sidebar 240: brand tile 32 (uploaded logo from Settings › Brand) + name; 6 nav items 36h, selected = tint fill + white label/icon. Assistant shows an orange dot when the draft has unpublished changes; Channels shows a count badge when deliveries failed.
- **Remove** the "Assistant is live" sidebar footer.
- Tab bar <860: same 6 items, labels Home / Assistant / Data / Chats / Channels / Settings.
- One page container: max 1040, centered, padding 40/40/56 (compact 32/24/48, phone 12/16/24). Forms (Settings, Channels list) use `.form-col` max 720 left-aligned.

## 4. Pages

### Home (`PHome`)
Order: header (Home + date) → **status card** (green tile 40, "Mr Spa Consultant", "Live · version N · answering on K channels" or "· the draft has unpublished changes", chevron → Assistant) → **Needs attention** (§6) → **Last 24 hours** (one card, 3 metric cells with dividers; zero values in label-2) → **Recent conversations** (avatar, display name, channel, time, 2-line preview; See all).
States: loading = skeletons; empty = "Nothing needs you" row + zero metrics + EmptyState "No conversations yet" with **Add a channel**; error = Banner with last-updated time + Try again, keep stale data.

### Assistant (`PAssistant`) — GPT-builder layout
- Header: name as large title + StatusLine; right side shows **Publish** (filled) only when there are changes; while publishing: busy "Checking N scenarios…"; when up to date: green "✓ Published" text (not a button).
- Publish failure → error Banner "Not published — a required scenario failed" + Show scenario.
- Desktop: segmented **Instructions · Sources · Versions**; grid `editor 1fr | Preview 400px` (sticky, full height). Compact: Preview 340.
- Phone: segmented **Test · Instructions · Sources · Versions** (full width); Test shows the Preview pane, other tabs the editor. (IA kept on phone; on desktop Test is the always-visible Preview.)
- **Instructions** (single column, GPT-style): Assistant (Name, Description) → Your business → Your assistant's job → Voice and style → Always / Never / Hand off to a person when / Contact details to collect (one FieldRow per rule + "Add a rule" row) → When something goes wrong (Fallback reply) → Disclosure "Detailed playbook (advanced)" with character count `n of 33,000` → Disclosure "Model and reply length (advanced)". The old right side column is merged in. Autosave as today; any edit marks draft dirty.
- **Sources**: Knowledge rows (soft indigo doc tile, title, "Updated …", toggle; whole row opens the edit sheet; "Corrected answers" first, fed by Fix this answer); failed source shows its error + Retry; header Add. "Data it can look up" rows with toggles. Disclosure "Live lookups (advanced)" containing the existing HTTP lookup UI.
- **Versions**: optional Draft row (Not live) → versions; live one has green tile + Live badge; others Restore → Alert → toast "Version 2 is live again".
- **Preview pane**: head "Preview / The draft · customers never see this" + New chat; chat bubbles (owner as customer = right/blue, assistant = left/gray); empty chat shows suggested first questions (use the first 3 test-scenario messages or a fixed list); under each assistant reply that has a trace: MetaChip "Read N sources · looked up M rows" → DetailsCard (Answered in X seconds; Knowledge read list → opens source sheet; Data looked up list → opens Data row sheet; **Fix this answer** tinted full-width). No status/time/model rows, no relevance %. Bottom: Test scenarios bar (collapsed; "2 of 2 passed" / "1 of 2 failing" badge; Run all; list with Required badge; Add scenario) + composer.

### Data (`PData`)
Header "Data" + one-line subtitle. Split: Tables (300) with selected row, "Hidden tables · N", **New table** plain button below. Detail: single-line title (22, truncate) + "7 active · 10 total", Search 220, **Add** (small filled), ••• Menu (Import CSV, Rename, Hide table). Rows as list rows (title = offer, 2-line details, type in footnote); badges only for exceptions: `Starts <date>` (blue), `Ended <date>` / `Off` (neutral). Footer explains inactive rows are never used. Row tap → sheet titled with the row's name: Availability (Active toggle, Starts, Ends) first, then the row fields; footer Delete row / Cancel / Save. Phone: list → push detail with "‹ Tables".

### Conversations (`PConversations`)
No long subtitle. Split: list 300 (Search "Search name or phone", rows with avatar, display name, time, 2-line preview, tags: "Your team is replying" orange, "New lead" blue). Transcript pane (sticky, own scroll): head with avatar, name, contact/channel, **Your team replies** switch; when on, info banner "The assistant is paused here. Reply from the app this customer wrote in; turn this off to hand the chat back." Bubbles: **customer left (gray), assistant/team right (blue)** — changed from today. Rich message actions stay inside the bubble. Tapping an assistant reply reveals "Fix this answer". Footer line explains who is replying. Phone: list → push transcript with back.

### Channels (`PConnections`)
Header + **Add channel** (filled). Form column: "Replies not delivered" section only when failures exist (Retry per row + Retry all) → Connected (row per channel, badge only on problems) → "Add another channel" with 3 option rows (Zernio inbox, Webhook, API). Channel sheet: Name, Address (copy), Key (New key), Turn off channel. Add sheet: segmented type + fields.

### Settings (`PSettings`)
Form column: AI (Connection status row ✓/error, AI key row "Saved · ends in 7Qx" + Replace → inline password field + Test and save; Disclosure Advanced with Cloudflare IDs) → Brand (Name, Logo + Change, Accent color swatch; footer: brand shows to customers, admin keeps system colors) → Backup (Download) → Sign out row (red, centered). All section headers sentence case. Remove the disabled pale "Save" pattern.

## 5. States everywhere
- First load: Skeleton in the shape of the content.
- Empty: EmptyState with one action.
- Error: Banner on top with what happened + effect on customers + Try again; keep showing last data.

## 6. New behaviour (needs backend; see `docs/product/2026-10-builder-upgrade/01-prd.md`, `02-ux-flow.md`, `03-ui-spec.md`)
1. **Fix this answer** sheet (`FixSheet`): Step 1 customer message + current reply (clamped, Show all) + textarea prefilled with the reply → Continue. Step 2 suggested place (Data row / Corrected answers / Instructions line) with Diff and note (Data = live now; others = draft, publish needed) + "Choose another place" radio list → Apply and test. Step 3 running → pass ("Fixed and protected", new reply, saved Required scenario, Done) or fail ("Not applied — the scenario still fails", Keep it anyway → Alert → kept, or Try another fix → back to step 2). Entry points: Preview DetailsCard, Conversations assistant reply, Home item.
2. **Needs attention** on Home: item types — your team is replying · sent the backup reply · price given without checking Data · new lead to contact (24 h) · fix not live yet (Publish) · fix kept but failing (Try again) · data request (72 h). Each row: soft tile, title, one-line context, primary (Fix / Open / Publish), ••• Menu (Open conversation, Dismiss because… The answer was fine / Already handled / Not a real customer) → toast with Undo. Count badge in the section header.
3. Toast after a draft-only fix offers **Publish**.

## 7. Acceptance checklist
- [ ] No raw colors in components; both themes pass AA; dark mode follows OS and can be overridden.
- [ ] No machine IDs visible anywhere; dates follow the rules.
- [ ] No "Ready/Active/Completed/Live" badges in normal state; sidebar footer removed.
- [ ] Each screen has at most one filled button; finished states are text, not disabled buttons.
- [ ] No nested scroll areas in sheets/forms; textareas auto-grow.
- [ ] Right edge of content identical on every page (1040 container, stable gutter).
- [ ] 1440, 1000 and 390 widths work; tab bar <860; sheets become bottom sheets; no horizontal scroll on phone.
- [ ] Keyboard: every control reachable, visible focus, dialogs trap and return focus, Esc closes.
- [ ] Long Vietnamese text wraps in bubbles/rows, previews clamp to 2 lines.
