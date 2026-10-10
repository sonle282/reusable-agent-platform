# Current state and handoff snapshot

Snapshot date: **2026-10-10** (Asia/Saigon), updated after AI activation and the UI redesign

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

## Production data and AI state (2026-10-10)

Setup was re-run on 2026-10-10 with `npm run admin:reset` because the original admin password was unavailable; agents, data and knowledge were preserved. The bootstrap path is closed again.

- Production URL: `https://agent.mrspainc.com` (Workers Custom Domain; `workers.dev` and preview URLs are disabled in `wrangler.jsonc`)
- Brand: `Mr Spa AI`, support URL `https://mrspainc.com`
- Admin email: `sonle@nhi.sg` (password held by the owner, never in Git)
- Assistant: `Mr Spa Consultant` (`agent_9ba698281216469095698ed4c28c928a`), model `claude-haiku-5-5`, max tokens 4096
- **Production version v1 published** (`ver_647de5c138cc459aa0d0716d6b72356e`) after both critical evals passed
- Collections: 5; records 75 (72 products + 3 example offers that are `archived`)
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
- The three real standing offers (OF-001 free shipping from 6 chairs, OF-002 $100/chair self-install, OF-003 volume discount) currently live inside the compiled Behavior instructions, not in the Offers collection. Moving them into the collection is the open data-modelling follow-up.
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

1. Zernio: when the owner provides the Inbox API URL, API token and webhook signing secret, create the Zernio connection in the UI and verify invalid HMAC → 401, duplicate event ignored, webhook 202 quickly, queue → outbound delivery, idempotent retry.
2. Move the three standing offers from Behavior into the Offers collection with validity dates, remove them from the instructions, re-run evals and publish v2.
3. Exercise contact capture, human takeover on a real channel conversation, and a forced failed delivery → inspect → retry.
4. Backup/export validation and public-template release gates.

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
