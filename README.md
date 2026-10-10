# Reusable Agent Platform on Cloudflare

A single-tenant, multi-agent control plane and runtime. Deploy one instance per customer, configure it in the browser, then connect the same agent to Preview, Generic API/webhooks, or Zernio.

This is a public source template. Production secrets and customer credentials live only in Cloudflare or an approved password manager and are never committed.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/sonle282/reusable-agent-platform)

## Project handoff

- [Full product and architecture plan](./docs/PLATFORM-PLAN.md)
- [Current implementation and production state](./docs/CURRENT-STATE.md)
- [Operations and new-machine runbook](./docs/OPERATIONS-RUNBOOK.md)
- [Master prompt for a new Codex session](./docs/MASTER-PROMPT.md)
- [Documentation index](./docs/README.md)

## What is implemented

- React admin UI in English (Apple HIG style, one assistant per instance) with first-run setup, Assistant, Data, Conversations, Channels, and Settings. Industry-neutral: the assistant is configured from a short profile (business, job, voice, always/never, hand-off, contact details) plus an optional detailed playbook.
- Hono API and static assets in one Cloudflare Worker deployment.
- Agent draft, immutable versions, publish, rollback, Preview traces, and critical eval gates.
- Conversation-scoped Cloudflare Agent/Durable Object state with persistent message history and pinned agent version.
- Anthropic through Cloudflare AI Gateway with an explicit model allowlist.
- D1 generic collections, atomic CSV import/upsert, validity dates, contacts, audit logs, idempotency, and delivery state.
- R2 knowledge originals and temporary chat attachments.
- AI Search ingestion/retrieval with source traces.
- Queue-backed webhook processing, knowledge ingestion, callback/Zernio delivery, retry, and DLQ.
- Generic sync/async API, signed generic webhook, and signed Zernio adapter.
- AES-GCM credentials, PBKDF2 passwords, signed server sessions, CSRF/origin checks, login lockout, per-key rate limiting, and SSRF/MIME limits.
- Mr Spa fixture migration command without tenant-specific runtime branches.

## Architecture

```text
Browser / Zernio / Client API
            │
            ▼
┌──────────────── Cloudflare Worker ────────────────┐
│ React assets  →  Hono ingress  → normalize input │
│                              │                    │
│                              ▼                    │
│                    ConversationAgent DO           │
│                  history + pinned version         │
│                    │       │       │              │
│                    ▼       ▼       ▼              │
│                   D1   AI Search  AI Gateway      │
│                    │       ▲       │ Anthropic    │
│                    ▼       │       ▼              │
│                   R2    Queue → outbound adapter  │
└───────────────────────────────────────────────────┘
```

All ingress paths call the same `CloudflareAgentRuntime.handleMessage()` contract. Connectors only verify, normalize, enqueue, and deliver.

## Deploy

Prerequisites:

- A Cloudflare account with Workers paid features required by your expected usage.
- An AI Gateway and its ID.
- An Anthropic API key (or adapt the provider to use a key already stored in AI Gateway).

The deployment requires three Worker secrets:

- `BOOTSTRAP_TOKEN`: one-time first-admin token, 32+ random characters.
- `SESSION_SIGNING_KEY`: independent 32+ character session signing secret.
- `CREDENTIAL_ENCRYPTION_KEY`: independent 32+ character credential encryption secret.

For the existing Mr Spa instance, resources have already been provisioned and Git push to `main` is the normal release path. For a new customer instance, create or bind the Cloudflare resources described in [wrangler.jsonc](./wrangler.jsonc), set the secrets outside Git, then apply D1 migrations before deployment.

After deployment:

1. Open the Worker URL.
2. Enter the bootstrap token and create the admin.
3. Add Cloudflare account ID, AI Gateway ID, and Anthropic key.
4. Test the model connection.
5. Create an agent, add sources, Preview, evaluate, publish, then activate a connection.

The bootstrap token is rejected after setup completes. API keys and webhook tokens are shown only once.

### Continuous deployment

For Cloudflare Workers Builds, use branch `main` with:

```text
Build command:  npm run ci
Deploy command: npm run deploy:ci
```

The build gate runs type checking, tests, and the production build. The deploy step applies pending remote D1 migrations before publishing the Worker.

### Continue on another machine

```bash
gh auth login
gh repo clone sonle282/reusable-agent-platform
cd reusable-agent-platform
npm ci
npm run ci
npx wrangler whoami
```

Read [the operations runbook](./docs/OPERATIONS-RUNBOOK.md) before deploying or rotating secrets. Cloudflare production secrets are stored remotely and are intentionally not present in this public repository.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars
npm run cf:typegen
npm run db:migrate:local
npm run dev
```

Open `http://127.0.0.1:5173`. Never commit `.dev.vars`.

Validation commands:

```bash
npm run check
npm test
npm run build
npm run deploy:dry
```

`npm run deploy:dry` does not publish. `npm run deploy` publishes and applies remote D1 migrations.

## Generic API

Create and activate a Generic API connection in the UI, then copy its one-time API key.

```http
POST /api/v1/messages
Authorization: Bearer <connection-api-key>
Idempotency-Key: order-123-message-1
Content-Type: application/json

{
  "conversation_id": "customer-123",
  "user_id": "customer-123",
  "message": { "text": "Tôi cần tư vấn", "attachments": [] },
  "customer": { "name": "An", "locale": "vi" }
}
```

For async execution, add `"response_mode": "async"`. The callback is always the allowlisted HTTPS URL stored on the Connection; a message cannot redirect results to an arbitrary URL.

Supported chat attachments are JPEG, PNG, WebP, `.md`, and `.txt` by HTTPS URL. The runtime verifies declared and received MIME types, enforces byte limits/timeouts, never executes content, and stores a temporary R2 copy with expiry metadata. Configure an R2 lifecycle rule for the `conversation-attachments/` prefix to delete objects after one day.

## Webhooks and Zernio

Provider endpoint:

```text
POST /api/v1/webhooks/:adapter/:connectionToken
```

Zernio requests use:

- `X-Zernio-Signature`: HMAC-SHA256 of the raw request body.
- `X-Zernio-Event-Id` or `payload.id`: deduplication key.
- A configured HTTPS Inbox API URL and encrypted API token for outbound delivery.

The Worker verifies and persists idempotency before enqueueing, then returns `202`. Outbound requests reuse `request_id:output_index` as their idempotency key. Queue retry policy is exponential and ultimately routes exhausted jobs to the configured dead-letter queue.

## Data versus Knowledge

- Put stable explanatory text in Knowledge (`text`, `.md`, `.txt`, or one HTTPS URL).
- Put prices, promotions, inventory, validity dates, and filterable facts in Data Collections.
- CSV is only accepted by the structured-data importer.

The model never receives SQL access. Bound collections become constrained read-only tools. Expired or archived records are filtered before results reach the model.

## Mr Spa migration

The original fixture is expected at `../ai-agent-blueprint/tenants/mrspa`, or set `MRSPA_FIXTURE_ROOT`.

PowerShell:

```powershell
$env:AGENT_PLATFORM_URL='http://127.0.0.1:5173'
$env:AGENT_ADMIN_EMAIL='admin@example.com'
$env:AGENT_ADMIN_PASSWORD='<admin-password>'
npm run migrate:mrspa
```

The importer is idempotent by agent name, collection slug, source name, record external key, and eval name. It imports compiled Behavior, Markdown knowledge, product/offer CSVs, validity dates, and critical eval cases. Wait for knowledge status `ready`, run evaluations, and publish from the UI.

## Operational notes

- Existing conversations stay pinned to their first production version. Rollback only changes the active pointer for new conversations.
- Human takeover prevents runtime output for that conversation until resumed.
- Export omits credentials and raw secrets.
- Password recovery in v1 is operational/CLI-assisted; there is no email reset flow.
- Change secrets with `wrangler secret put`. Rotating `CREDENTIAL_ENCRYPTION_KEY` requires decrypt/re-encrypt support before replacing the previous key.
- Back up D1/R2 according to the customer’s recovery requirements before upgrades.

## Source map

- `src/worker/api.ts` — ingress and admin control plane.
- `src/worker/agent.ts` — durable conversation runtime and tool loop.
- `src/worker/connectors.ts` — Generic/Zernio verification and delivery.
- `src/worker/knowledge.ts` — safe URL ingestion and AI Search.
- `src/client/App.tsx` — admin UI.
- `migrations/` — D1 schema.
- `scripts/migrate-mrspa.mjs` — fixture importer.

## License

MIT. See [LICENSE](./LICENSE).
