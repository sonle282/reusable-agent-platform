# Current state and handoff snapshot

Snapshot date: **2026-10-11** (Asia/Saigon), updated after admin v2.1 (sign-in, Leads, Behavior, Follow-ups)

This document lets a new operator or coding session resume without reconstructing completed work. It intentionally contains identifiers and status only, never secret values.

## Repositories and deployment

| Item | Current value |
| --- | --- |
| GitHub repository | `sonle282/reusable-agent-platform` |
| Visibility | Public |
| Default branch | `main` |
| Cloudflare account | `Mrspainc Nail Furniture and Equipment` |
| Cloudflare account ID | `759105f65ba94c85759b0b2a03f1c39a` |
| Worker | `reusable-agent-platform` |
| Production URL | `https://agent.mrspainc.com` |
| D1 database UUID | `35e4f854-2a4c-4b60-ae6b-8807bf35d08d` |
| D1 binding | `DB` |
| R2 binding | `FILES` |
| Queue binding | `JOBS` |
| Durable Object binding | `ConversationAgent` |
| AI Search binding | `AI_SEARCH` |

Cloudflare Workers Builds is connected to the GitHub repository using account `sonle282`.

- Production branch: `main`
- Build command: `npm run ci`
- Deploy command: `npm run deploy:ci`
- Preview builds: disabled because this application uses Durable Objects
- Pushes to `main` should run type checking, tests, the Vite production build, D1 migrations, and Worker deploy.

Known successful build/deploy evidence before this handoff:

- Initial connected build: `222bf36a-...`, succeeded.
- PBKDF2 compatibility-fix build: `ee7d825a-...`, succeeded.
- Earlier deployed version identifiers included `6ce6a70e-444a-494d-8110-f351025cf1ba` and `5ce8f82b...`.

Use the Cloudflare dashboard as the source of truth for the latest full build and version IDs.

## Completed implementation

The repository contains a working single-tenant, multi-agent platform in one Cloudflare Worker application:

- React/Vite admin UI and Hono API in the same deployment.
- First-run setup and single-admin authentication.
- Agents, drafts, immutable versions, validation, publish, and rollback.
- Preview chat, traces, evaluation cases, and critical publish gates.
- Conversation-scoped Agents SDK/Durable Object state with persistent history and pinned agent versions.
- D1 generic data collections, schemas, records, typed filtering, active dates, and atomic CSV import/upsert.
- R2 file storage, knowledge source originals, and temporary conversation attachments.
- AI Search ingestion/retrieval with source traces.
- Anthropic provider abstraction through Cloudflare AI Gateway.
- Internal read tools, lead/contact capture, and constrained external read-only HTTP tools.
- Queue-backed webhook processing, indexing, callbacks, outbound delivery, retry, and DLQ.
- Generic synchronous/async message API, generic webhook, and Zernio adapter.
- Contacts, conversations, customer profile, human takeover, and runtime/delivery events.
- AES-GCM encrypted external credentials, PBKDF2 password hashes, signed HttpOnly sessions, CSRF/origin checks, login lockout, API-key rate limits, SSRF/MIME protections, and log redaction.
- Mr Spa fixture importer without tenant-specific runtime branches.

## Mr Spa go-live on Messenger (in progress, 2026-10-11)

Runbook and confirmed data live outside this repo in `../mrspa-agent-data/` (`GO-LIVE.md`, `final/`). Nothing from it is committed here.

- **Live version: v8** (`ver_8d4e56c709df4da69125292c784a809f`), published 2026-10-11. Data matches `final/`: 73 products (P071 kept), 14 offers (9 active; OF-010/OF-011 end 2027-01-31 ET), 34 policies, 7 knowledge sources (4 older sources switched off), 33 scenarios (30 from `final/` + 3 builder guards), 16 required.
- Data tables now use **English keys** (`Mr Spa Products/Offers/Policies`, slugs `mr-spa-*`); the old Vietnamese-key tables are archived as "… (old keys)".
- Last run on v8's draft: 16/16 required pass, 16/17 optional (the "Bớt thêm" wording check).
- **Testing order (owner, 2026-10-11):** Sơn tests v8 on the **Freedom Business** page first (Zernio channel `Freedom Business`, webhook active), then chị Quý and test customers there, then the Mr Spa Fanpage goes live. Sơn's own test thread was moved to v8 with Conversations › ••• › "Use the live version" (audited `conversation.version_moved`); other chats keep their version.
- **Go-live date: not yet.** Remaining: connect the Mr Spa Fanpage in Zernio (only Freedom Business is connected today), turn off ManyChat's auto replies on that page first, then add the channel in Channels; the owner upgrades Cloudflare to Workers Paid at go-live (decided 2026-10-12; the free Durable Objects quota stops chats for the rest of the UTC day when it runs out); owner test by chị Quý; offer pictures (`image_url` on OF-010/OF-011) when the files exist.

## Admin v2.1 (2026-10-11)

Source: `docs/product/design-v2.1/HANDOFF.md`. **Scope rule (owner, 2026-10-11): build what Mr Spa uses now, scale later (KISS).** Single-owner install stays. Not in this round: SMS or email lead alerts, password reset by email, sign-up, onboarding, billing, multi-workspace, an own Meta app.

The owner's business plan lives **outside this repo** at `../repnow-plan/` (sibling folder). Never copy it here or commit it.

Shipped (one commit per phase):

| Phase | Commit | What |
| --- | --- | --- |
| 0 | `816df75` | Zero-specificity reset (`:where(.app)`) so component classes always win; the primary-button bug from the v2 CSS was not present in this codebase, the fix prevents it |
| 1 | `a2a869b` | Split sign-in and two-step setup; no forgot-password flow (owner uses `npm run admin:reset`); AI key moved out of setup; `/api/setup` unchanged |
| 2 | `bba2480` | Leads on existing contacts (migration `0006_leads.sql`), list/detail/patch/delete/CSV export, Leads nav item with New badge, lead drawer, one-line `LEAD:` summary on capture (no extra model call), US phone formats recognised |
| 3 | `fc62aba` | Draft `behavior` (seen, typing, split, pace, AI notice, outside-hours line) and `followUps`; Zernio typing/mark-read; Preview shows Seen → typing dots → paced parts |
| 4 | `05c9534`, `88a7c72` | Follow-ups via the conversation DO scheduler: max 2 steps, 24 h guard (skip after 23h50m), stop rules, idempotent key, `followup_sent`/`followup_skipped` events, "Contact again" in Needs attention |
| 5 | — | Baseline written to `../repnow-plan/03-mrspa-baseline.md` (counts only); Zernio findings in `../repnow-plan/04-zernio-capabilities.md` |

Things to know:

- **Versions published before v2.1 run with behavior and follow-ups off** (`parseVersionSnapshot`). New drafts get the defaults on, so Mr Spa shows "Unpublished changes" until the owner reviews the Behavior and Follow-ups tabs and publishes.
- Follow-ups are sent only on Zernio channels. The website chat has no widget in this repo, so typing dots exist in Preview only.
- Zernio shows typing on Messenger/Instagram; its mark-read does not show "Seen" to Messenger customers (WhatsApp/iMessage only).
- The v2 look was ported afterwards; see "Admin v2 look" below. The UI review brief for Claude chat is `docs/product/design-brief-for-claude-chat.md`.
- Deployed 2026-10-11 (`165539b`, migration 0006 applied). **Production version v6 live** with behavior and follow-ups on (Vietnamese AI notice and follow-up texts set in the draft; owner to review the wording). Conversations started before v6 stay on their version.
- `165539b` fixed history order: a customer message, the AI notice and the reply share one timestamp; history now breaks ties by insertion order.

## Admin v2 look (2026-10-11)

Source: `docs/product/design-v2/PORT-MASTER-PROMPT.md`, `design-v2/HANDOFF.md`, and `design-v2.1/styles.css` as the single token and component file. UI only: no API, data, migration, prompt, runtime or published-version changes.

| Phase | Commit | What |
| --- | --- | --- |
| 0 | `92c2731` | v2.1 tokens §1–1c (light, dark, `prefers-color-scheme` mirror for System); Manrope 400–800 replaces Inter/SF |
| 1 | `419ecfd` | Primitives in `ui.tsx`: Button primary/outline/soft/ghost/danger/danger-ghost/link (sm–xl), Card, Row, Field (label above), Switch, Segmented, Tabs, Chips, Select, Table, Sheet, Drawer, Dialog, Menu, AgentAvatar, BrandLogo, TypingDots, LeadStatus; Apps SDK UI icons (`src/client/icons.ts`, MIT notice in `src/client/LICENSE-apps-sdk-ui.txt`) and Simple Icons platform marks (CC0) |
| 2 | `cd3552d` | Shell: workspace header, nav with counts, "Assistants" heading with the one assistant (avatar + live/unpublished/draft dot), account row; sidebar ≥1080, icon rail 860–1079, six-item tab bar below 860; `#/connections` → `#/channels` with a redirect |
| 3 | `0ea282f` | Pages to the references: Sign in/Setup, Home, Leads + drawer, one-screen builder, Data list (`#/data`) and records page (`#/data/<table>`, row drawer at `#/data/<table>/<row>`), full-height Conversations, Channels (logos, Answered by, platform grid), Settings (+ Messaging platforms), Fix this answer |
| 4 | `6e4c0a3` | Verification at 1440×900, 1080×800, 390×844, light and dark, against the references; contrast fixes |
| — | `60a1b16` | Assistant › Checks tab replaces Settings › Answer checks |

Things to know:

- **Superseded on 2026-10-12:** answer checks were removed entirely and the app now allows more than one assistant. See "Checks removed, more than one assistant (2026-10-12)" below.
- There is no sign-up, billing, SMS or onboarding.
- Data is reachable from Home (Assistant card › Data) and from the builder (Sources › Manage in Data); the phone tab bar has no Data tab.
- Not built because there is no data for it yet: conversation starters, the "Needs reply" chip, business-hours row in Behavior, Import CSV on the tables list (it lives on each table). The Conversations chips (All, Leads, Your team) filter the loaded list.
- Contrast deviations from the design file: `--color-text-3` is `#6B6B6B` light / `#9B9B9B` dark, and count badges use `--color-count` `#C8450C`, so small text passes AA on every surface.
- The platform grid offers Messenger, Instagram, WhatsApp, Telegram and TikTok through Zernio (the existing Zernio flow lists the pages of every platform) plus API and Webhook.

## UI refinements from the live review (2026-10-11)

Source: `docs/product/design-v2.1/UI-REFINEMENTS.md` (25 items). UI only except the blocker; no new features, settings, data fields, migrations or published versions.

**Blocker — every conversation returned 500 (`01133c0`).** Not route decoding: ids like `agent:conn:external` decode correctly (new test `test/conversation-route.test.ts` opens them, including sub-paths). The Worker log says `Exceeded allowed duration in Durable Objects free tier`: the account is still on **Workers Free** and today's DO quota has been used up since the morning outage. It comes back at 00:00 UTC (07:00 Vietnam) or at once after upgrading to **Workers Paid**. Until then the API answers 503 with a plain message (`code: chat_store_limit`) and the thread shows it with Try again. Opening the 3 threads on production still has to be confirmed after the reset or the upgrade.

| Section | Commit | Items |
| --- | --- | --- |
| Global | `c805ba4` | 1–7: coarse-pointer 44 px hit areas, `agentStatus()` one status line, 36 px fields, display-only phone format, `AvatarWithChannel`, `formatWhen()`/`When`, one name per thing (Checks, Fix answer) |
| Home | `39211d0` | 8–10: Needs attention grouped by type + chat ("· 3 times"), metric label/value/sub, one-line previews at ≥1080 |
| Leads | `852c883` | 11–14: "—" for no summary, zero chip counts hidden, Call is the only primary (Delete lead / Close), activity newest first with quick status clicks merged |
| Builder | `95f1d3e` | 15–19: "Checking N…" and "N checks failed — Publish stopped" + See failed checks, hover-only ✕ and Restore, fallback placeholder, Checks chips All/Required/Failed and result dots, ghost Restore |
| Data | `9387adb` | 20–22: "34 rows · all in use · used by …", key cells as tags and "first question +2", drawer fields sized 1/2 rows growing to 10 |
| Conversations, Channels, Settings | `d3461f7` | 23–25: `LoadError` (EmptyState + Try again) for every failed load, platform cards and one-button channel rows, one AI key status badge |
| Verification | `04f0e8a` + next | 44 px targets left over at 390 (tabs, composer, row links), AA on selected rows in dark; the password show/hide button stays inside the field on touch screens |

Skipped or changed, and why:

- **10, "AI:" prefix:** the conversation list stores only a preview, not who wrote it. Guessing from "your team replies" would mislabel some chats, so only the 1-line/2-line clamp shipped.
- **19, restore dialog wording:** the review's text said new chats switch "after you publish"; restore actually switches new chats right away, so the dialog keeps the true behaviour.
- **22, grouping drawer fields** ("What customers ask / Answer / Source"): column names differ per business; the generic table can't group them without new settings. Sizing shipped.
- **4, phone format:** the formatter already formats US numbers and keeps others as entered; "0900000000" (a Vietnamese number) stays as entered by design. Added tabular figures and "Call (215) 772-1111".

Verified locally (Playwright, mocked API) at 1440×900, 1080×800 and 390×844, light and dark: no target under 44 px with a coarse pointer, no horizontal scroll at 390, AA contrast in both themes (the Follow-ups gradient block is light in both themes; the scanner reads its dark page behind it), and the empty, loading and error states (Leads 0 / filtered 0 / skeleton / error, Conversations 0 / skeleton / error / thread error, Checks 0 / running / after a run, Data table 0 rows / no match / error, Home all caught up / skeleton / error, Channels deliveries error).

## Checks removed, more than one assistant (2026-10-12)

Owner decisions (2026-10-12): drop answer checks completely, keep **Fix this answer** (it is how the assistant learns), add the Assistants screen from the design so a business can run several assistants, and fix fields that showed a square focus ring inside rounded fields.

| Commit | What |
| --- | --- |
| `d45acc0` | Checks removed: no Checks tab, no scenario sheet, no eval gate in publish; the evaluate and eval-case endpoints are gone. **Publish publishes the draft right away.** Fix this answer still re-runs the customer's question on the draft to show the new reply (`runCase` in `fixes.ts`). Existing `eval_cases`/`eval_runs` rows are left in D1 untouched (no migration). Undo of a fix lost its button with the check sheet; it came back in `fbb8f07` (below). Discard draft moved to the Versions draft row. |
| `72c690e` | Focus rings: the Preview composer and search fields show the ring on the rounded wrapper (`:focus-within`), inputs/textarea/select use a 1 px ring that follows their radius instead of a square outline. |
| `1d49431` | More than one assistant (below). |
| `fbb8f07` | Undo for Fix this answer: an Undo button on the "Fixed" result, and Versions › Answer fixes lists fixes from the last 7 days (where each went, whether customers get it yet) with Undo and an optional reason. New `GET /api/admin/agents/:id/fixes`; undo is the existing 7-day `POST /api/admin/fixes/:id/undo`. |
| `cbc3fb1` | Long lists: Sources (Knowledge, Data it can look up, Live lookups), Versions and Answer fixes show three rows and "Show N more". Data table rows and Leads show 25 rows per page with a pager; the page header, search and filters stay put while rows scroll inside the card under a sticky column header. |
| `ede362e` | Photos for Data rows: image columns have Choose image (or drop a file), a preview and Remove; pasting a link still works. `POST /api/admin/images` stores JPG/PNG/WebP/GIF up to 1 MB (owner's limit) in R2 (`images/`, type checked from the first bytes); `GET /media/images/<32 hex>.<ext>` serves them without sign-in because channels fetch photos by link (`/media/*` added to `run_worker_first`). Tables with an image column show a thumbnail per row. Table menu "Edit table" renames columns and adds new ones to an existing table. Not built: deleting replaced photos from R2 (they stay, unlinked). |

More than one assistant:

- **Assistants page** `#/assistants`: one card per assistant (avatar, name, description, status line, its channel logos), a dashed New assistant card, and a ••• menu with Edit, Duplicate, Delete…. **New assistant** sheet: start from Sales consultant / Customer support / Blank templates or "Copy of X"; name and "What should it do?". It starts as a private draft and opens in the builder.
- **Duplicate** (`POST /api/admin/agents/:id/duplicate`) copies the draft (instructions, behavior, Data lookups) but not knowledge sources or live lookups, which belong to one assistant. Audit `agent.duplicate`.
- **Delete** (`DELETE /api/admin/agents/:id`) is refused (409) while the assistant has channels or customer chats, because deleting cascades its versions, knowledge, conversations and fixes. Audit `agent.delete`.
- **Builder route** `#/assistants/<id>/<tab>`; old `#/assistant/<tab>` links open the first assistant. The sidebar lists every assistant with its status dot and a + button.
- **Channels:** "Answered by" is a picker in the channel panel and in Add channel (a plain label when there is one assistant). Moving asks for confirmation; open chats on that channel start fresh with the new assistant (conversation ids include the agent id), their history stays in Conversations. A channel that is on can only move to a live assistant (picker and server, 422). Audit `connection.agent_changed`. The "can't reply yet" warning is per assistant.
- **Home** merges Needs attention from every assistant (rows say which assistant when there are several; items never group across assistants) and lists up to four assistants. **Data** shows which assistants use each table. **Conversations** and Fix this answer use the chat's own assistant.
- Bootstrap returns `live_version` and `unpublished` per assistant.
- **Not built:** pausing an assistant (needs a runtime change; turn its channels off instead), per-assistant Data permissions (tables are shared; each assistant picks which ones it looks up), moving knowledge between assistants.

Cloudflare Durable Objects: the free daily quota that blocked opening chats on 2026-10-11 reset at 00:00 UTC; on 2026-10-12 the Conversations list and three threads opened normally in about 2 seconds.

Verified locally (Playwright, mocked API with two assistants) at 1440×900 and 390×844, light and dark; `npm run ci` passes (64 tests).

## Production data and AI state (2026-10-10)

Setup was re-run on 2026-10-10 with `npm run admin:reset` because the original admin password was unavailable; agents, data and knowledge were preserved. The bootstrap path is closed again.

- Production URL: `https://agent.mrspainc.com` (Workers Custom Domain; `workers.dev` and preview URLs are disabled in `wrangler.jsonc`)
- Brand: `Mr Spa AI`, support URL `https://mrspainc.com`
- Admin email: `sonle@nhi.sg` (password held by the owner, never in Git)
- Assistant: `Mr Spa Consultant` (`agent_9ba698281216469095698ed4c28c928a`), model `claude-haiku-5-5`, max tokens 4096
- **Production version v3 live** (`ver_52d5f01207a24833beaf77ad739b03ae`) — first version driven by the structured profile; v2 (`ver_57fb65a3…`) and v1 (`ver_647de5c1…`) kept for rollback
- Collections: 5 (`Mr Spa Products`, `Mr Spa Offers`, empty starters Products/Offers/Policies); records 82 — 72 products, 7 standing offers `OF-001`…`OF-008` (no OF-005) active, 3 example offers `U001`–`U003` off. Column labels are English; customer-facing content stays Vietnamese
- Knowledge sources: 9, re-ingested with the lowercase AI Search metadata schema, all `ready`
- Eval cases: 2 critical (`search_products` price guard, `search_offers` offer guard)
- Anthropic key stored encrypted in D1; model calls go through the Workers `AI` binding to AI Gateway `default` (Authenticated Gateway compatible)
- Generic API connection `Generic API smoke test` exists and is active; its smoke-test key was rotated and discarded, so rotate again to obtain a usable key

### Verified end to end on production

- Model connection test through AI Gateway: pass.
- Preview: product question used `search_products`; policy question used Knowledge (`policies.md`, `kb-after-sales.md`); offer question called `search_offers`.
- Generic API: missing/invalid key 401; key cannot reach admin endpoints; sync 200; duplicate `Idempotency-Key` returns the identical public body without re-running the model or duplicating transcript messages; async 202 in about 1.5 s with later replay 200; 60 requests/minute limit returns 429; rotated key is rejected.
- Conversation search by external ID and transcript retrieval.

### Production behaviours worth knowing

- Requests from Vietnam reach the HKG colo, where Anthropic answers 403 "Request not allowed". The Worker uses `placement.region = aws:us-east-1`, and new ConversationAgent Durable Objects get location hint `enam` (`CONVERSATION_LOCATION_HINT`). Do not remove either without a replacement.
- v2 moved all seven standing offers out of the Behavior instructions into `Mr Spa Offers` (content and conditions verbatim). The instructions now say: always call `search_offers` (limit 10) before mentioning any offer, and always call `search_products` before answering about a specific product. With the product rule the price eval called the tool 5/5 times (1/4 before). Edit offers in Data, not in Instructions; no republish is needed for record changes.
- The imported instructions make the assistant answer in the structured `v2` message JSON; the admin UI renders it, API clients receive the JSON string in `messages[].text`.

## Worker secrets present remotely

These bindings exist in Cloudflare and their values must remain outside Git:

- `BOOTSTRAP_TOKEN` (rotated on 2026-10-10 by the recovery command; only useful while setup is open)
- `SESSION_SIGNING_KEY`
- `CREDENTIAL_ENCRYPTION_KEY`

Secrets remain on the Cloudflare account across laptop changes and normal Git deployments. Do not rotate `CREDENTIAL_ENCRYPTION_KEY` until a decrypt/re-encrypt migration exists for stored credentials. Cloudflare Workers allows at most 100,000 PBKDF2 iterations (`f9d1e87`); do not raise it.

## Changes on 2026-10-10

- `b100d68` Claude 5 compatibility: omit `temperature` where rejected; fixed the model test (schema minimum); current model IDs in the allowlist.
- `cddd015` Anthropic via the AI Gateway Worker binding; `npm run admin:reset` recovery command.
- `3887329` AI Search custom metadata schema (`agentid`, `sourceid`, `name`); custom domain `agent.mrspainc.com`.
- `c5ac107` Worker placement and Durable Object location hint for Anthropic-supported egress.
- `2865275` idempotent API replays return the public response shape.
- `05cd67e` and later: schema errors return 400, unique conflicts 409.
- Admin UI redesigned (Apple HIG, one assistant, autosave, one-step publish with eval gate).

## Immediate next work

Owner direction (2026-10-10): finish the agent builder first; plug in channels (Zernio, other integrations) only after that.

1. Agent builder backlog from the owner walkthrough — **done** (`f536f4c`, `4fe6408`, `6b29fbc`, `7c4a3b5`, `e85475b` and the title-column fix): row editing, hidden test chats, publish state, structured profile, English UI, fix-from-reply deep links (`#/data/<table>/<row>`), daily summary, hidden tables (migration `0003_collection_archive.sql`; tables in use cannot be hidden), editable/renamable knowledge, editable test scenarios. Production data: starter tables Products/Offers/Policies hidden, knowledge sources renamed to plain titles, scenarios renamed in English. Next builder work should come from real owner use.
2. **Next builder upgrade (In Review):** `docs/product/2026-10-builder-upgrade/` — competitive research, problem brief + roadmap, PRD / UX / UI spec for "Fix this answer" (fix once, never regress) plus customer-data consent/erase, and a clickable prototype. Blind craft score 88.5/100 (floor 90); main gap is a real owner session (owner: Sơn, due 17/10/2026).
3. Then Zernio: create the connection in the UI with the owner's Inbox API URL, API token and webhook secret; verify invalid HMAC → 401, duplicate ignored, fast 202, queue → outbound, idempotent retry.
4. Contact capture, human takeover on a real channel conversation, forced failed delivery → inspect → retry.
5. Backup/export validation and public-template release gates.

## Known v1 boundaries

- One deployment per customer and one admin; several assistants per deployment share the Data tables.
- No multi-tenant SaaS billing or team RBAC.
- No audio, PDF, DOCX, crawler, visual workflow builder, marketplace, or multi-agent orchestration.
- No external side-effect actions such as booking, ordering, payment, POST/PUT/PATCH/DELETE tools.
- Chat supports text, JPEG/PNG/WebP, `.md`, and `.txt` only.
- Knowledge accepts text, `.md`, `.txt`, or one HTTPS URL per source; CSV is structured-data import only.

## Commit history checkpoint

The following commits establish the initial production baseline:

```text
835c290 feat: initial reusable Cloudflare agent platform
7809cb6 ci: add Cloudflare Workers Builds pipeline
d765521 ci: trigger first Cloudflare build
f9d1e87 fix: respect Workers PBKDF2 iteration limit
```

The documentation commit created after this snapshot becomes the new handoff checkpoint.
