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
- The v2 visual redesign (`docs/product/design-v2/`) is **not** ported; v2.1 screens were built on the current tokens.
- Deployed 2026-10-11 (`165539b`, migration 0006 applied). **Production version v6 live** with behavior and follow-ups on (Vietnamese AI notice and follow-up texts set in the draft; owner to review the wording). Conversations started before v6 stay on their version.
- `165539b` fixed history order: a customer message, the AI notice and the reply share one timestamp; history now breaks ties by insertion order.

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

- One deployment per customer, one admin, one assistant in the UI (API remains agent-generic).
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
