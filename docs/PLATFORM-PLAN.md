# Reusable Agent Platform — product and implementation plan

## 1. Product direction

### Goal

Build one reusable source template that can be deployed as a separate Cloudflare instance for each customer. After deployment, an admin can:

1. Configure the model provider.
2. Create one or more agents.
3. Add behavior, semantic knowledge, and structured business data.
4. Test drafts in Preview with traces.
5. Publish a version.
6. Connect Zernio or another system through API/webhook adapters.
7. Manage conversations, contacts, delivery failures, and basic branding.

The core product promise is:

> Deploy source → configure Claude → create an agent → verify answers → copy an endpoint → go live.

The platform is conceptually similar to a self-hosted, deployable GPT builder: the middle runtime is channel-independent, while ingress and outbound adapters can be replaced or added.

### Primary user

An agency owner or software engineer who deploys and operates one instance for each client.

### Locked v1 scope

Included:

- One Cloudflare deployment per customer.
- One admin and multiple agents per instance.
- Anthropic Claude BYOK through Cloudflare AI Gateway.
- Generic synchronous/async API and webhook connector.
- Production-ready Zernio connector.
- Behavior, Knowledge, and generic Data Collections.
- Internal read tools, lead capture, external read-only HTTP tools, and read-only code plugins.
- Conversation history, customer profile, contacts/leads, and human takeover.
- Draft, validation, evaluation, publish, immutable versions, and rollback.
- Chat input: text, JPEG/PNG/WebP, `.md`, and `.txt`.
- Knowledge input: text, `.md`, `.txt`, and a single HTTPS URL.
- CSV import for structured data only.
- Basic branding and operational dashboards.

Excluded:

- Multi-tenant SaaS, billing, or team RBAC.
- Audio/STT, PDF/DOCX, archives, or executable attachments.
- Website or sitemap crawling.
- Booking, order creation, payments, or other external write actions.
- Visual workflow builder, marketplace, or multi-agent orchestration.

## 2. Architecture

### One Worker application

```text
Cloudflare Worker
├── React admin UI via Static Assets
├── Hono HTTP API
├── Channel-independent AgentRuntime
├── ConversationAgent Durable Object / Agents SDK
├── Queue producer and consumer
├── D1 bindings
├── R2 binding
├── AI Search binding
└── Cloudflare AI Gateway client for Anthropic
```

Resource responsibilities:

| Resource | Responsibility |
| --- | --- |
| Worker | HTTP ingress, admin API, channel adapters, static UI |
| Agents SDK + Durable Objects | Per-conversation coordination, message history, pinned version, profile and summary state |
| D1 | Agents, drafts, immutable versions, collections, contacts, connections, events, audits, idempotency |
| R2 | Knowledge originals and temporary chat attachments |
| AI Search | Chunking, indexing, and semantic knowledge retrieval |
| Queue | Webhook execution, ingestion, callbacks, outbound delivery, retry and DLQ |
| AI Gateway | Anthropic routing, observability, and request control |
| Worker secrets | Bootstrap, session signing, and credential-encryption keys |

### Runtime boundary

Every source calls the same internal contract:

```ts
interface AgentRuntime {
  handleMessage(input: NormalizedMessage): Promise<AgentResult>;
}

type NormalizedMessage = {
  eventId: string;
  connectionId: string;
  agentId: string;
  conversationId: string;
  externalUserId: string;
  content: {
    text?: string;
    images?: Attachment[];
    textFiles?: Attachment[];
  };
  customer?: {
    name?: string;
    locale?: string;
    metadata?: Record<string, unknown>;
  };
  receivedAt: string;
};
```

`AgentRuntime` never contains Zernio-, Preview-, or generic-API-specific behavior. Adapters own verification, normalization, context needed for delivery, and outbound formatting.

### Ingress

Generic synchronous API:

```http
POST /api/v1/messages
Authorization: Bearer <connection-api-key>
Idempotency-Key: <unique-id>
```

The request carries conversation/user IDs, message content, attachments, and optional customer metadata. Synchronous requests return normalized output messages. Async requests set `response_mode: "async"`; their callback destination must be the allowlisted URL stored on the Connection, never an arbitrary per-message URL.

Provider webhooks use:

```http
POST /api/v1/webhooks/:adapter/:connectionToken
```

The adapter reads the raw body, verifies signatures, normalizes the event, claims idempotency, enqueues work, and returns `202` quickly. Zernio uses `X-Zernio-Signature` with HMAC-SHA256 and `X-Zernio-Event-Id` or `payload.id` for deduplication.

### Outbound adapter contract

```ts
interface ChannelAdapter {
  verify(request: Request, connection: Connection): Promise<boolean>;
  normalize(request: Request, connection: Connection): Promise<NormalizedMessage>;
  send(result: AgentResult, context: ChannelContext): Promise<SendResult>;
}
```

Outbound delivery uses deterministic idempotency keys based on `request_id + output_index`. Transient failures retry with exponential backoff; auth and validation failures do not. Delivery state is persisted in D1.

### Conversation identity and version pinning

```text
agentId:connectionId:externalConversationId
```

Each Durable Object owns one conversation. It stores the agent/version identity, external identities, language, stage, profile, rolling summary, takeover state, processed event IDs, message history, and last activity. A conversation remains pinned to the version with which it began. New conversations use the current production version. Migration of existing conversations must be explicit.

### Model provider

The runtime calls a provider abstraction rather than Anthropic directly. v1 uses a Cloudflare AI Gateway provider with Anthropic BYOK, an allowlisted model, low default temperature, bounded tool iterations, a hard turn timeout, and at most one model retry before external output exists. Model configuration is versioned; credentials are referenced separately and encrypted at rest.

## 3. Control plane and UX

### Five-step onboarding

```text
1. Setup → 2. Create Agent → 3. Add Sources → 4. Preview → 5. Connect
```

1. **Setup** — consume the one-time bootstrap token, create the admin, set branding, configure AI Gateway/Anthropic, and test the model.
2. **Create Agent** — name, job-to-be-done, primary language, and starter template (Blank, Sales Consultant, Customer Support).
3. **Add Sources** — Behavior, Knowledge, and Data are presented as distinct concepts.
4. **Preview** — show conversation, draft/version, retrieved sources, collection/tool calls, structured output, errors, and latency.
5. **Connect** — create Generic API, Generic webhook, or Zernio connection; activation requires a successful test.

After onboarding, the navigation remains: Agents, Data, Connections, Conversations, Settings. Tools live under Sources/Actions instead of becoming a separate top-level section.

### Agent lifecycle

```text
Draft → Validate → Evaluate → Publish → Active
                               └──────→ Rollback
```

An immutable `agent_versions` snapshot includes instructions, model configuration, response policy, knowledge IDs, collection/tool bindings, customer field schema, and handoff rules. Publish fails when the model connection is unhealthy, required sources are not ready, a binding is missing, instructions are empty, response schema is invalid, or a critical eval fails. Rollback only changes the active-version pointer.

## 4. Data and knowledge

### Generic Data Collections

Industry concepts are templates, not hard-coded tables. Products, Promotions, Properties, Policies, and Leads are examples created with the same primitives:

```text
data_collections
data_fields
data_records
data_record_values
```

Supported field types are text, long text, number, boolean, date, datetime, enum, multi-enum, URL, image URL, and relation. Each record holds complete JSON, normalized search text, lifecycle status, optional validity dates, and typed values for safe filtering/sorting.

CSV import provides column mapping, validation preview, and atomic upsert by an admin-selected unique field. Invalid imports do not partially apply. The model never receives SQL access. It can only use constrained tools such as `searchRecords`, `getRecord`, and `listActiveRecords`; expired or archived rows are excluded before model context is built.

### Knowledge

Knowledge is explanatory semantic content; dynamic price, stock, offer, and validity data belongs in Data Collections.

```text
Upload / paste / fetch one URL
→ validate
→ store original in R2
→ enqueue ingestion
→ normalize text
→ index in AI Search
→ mark ready
```

URL ingestion is HTTPS-only, one URL per source, without linked-page crawling. It blocks private/loopback destinations, limits redirects, size and content type, and resynchronizes only on explicit admin action. Retrieval defaults to five chunks filtered by agent/source. Retrieved content is untrusted context and cannot override system policy. Preview always exposes citations/sources used.

### Chat attachments

Images go to Claude vision. `.md` and `.txt` are safely extracted and attached as user content. Every attachment passes an allowlisted MIME check, byte/timeout limit, non-execution handling, and temporary R2 lifecycle. HTML is not rendered. Audio, PDF, DOCX, CSV-in-chat, archives, and executables are rejected.

## 5. Tools, contacts, and security

### v1 tools

Allowed:

- Internal collection read tools.
- Validated internal contact/lead capture.
- External read-only HTTP GET tools with fixed URL templates, schemas, timeout, cache, and credential references.
- Read-only TypeScript plugins reviewed with the source.

Not allowed: external POST, PUT, PATCH, DELETE, booking, ordering, payment, or arbitrary code execution. Agents provide links or handoff instructions for those operations.

### Contacts and conversations

Core entities are `contacts`, `contact_identities`, `conversations`, `conversation_summaries`, and `runtime_events`. External identity is scoped by channel, external account, and external user. The model can update contacts only through a schema-validated internal tool; it never emits raw database operations.

### Authentication and credentials

- Bootstrap token is accepted exactly once.
- Admin password uses a salted PBKDF2 hash compatible with Workers limits.
- Sessions use HttpOnly, Secure, SameSite cookies with signing and expiry.
- Login is rate-limited and temporarily locks repeated failures.
- Mutation endpoints enforce same-origin/CSRF protections.
- Connection API keys are one-time-visible, hashed, scoped to one Connection and Agent, rate-limited, revocable, and rotatable.
- Third-party credentials are encrypted with AES-GCM using `CREDENTIAL_ENCRYPTION_KEY`; only ciphertext, IV, and key version live in D1.
- Logs redact authorization headers, API keys, webhook secrets, and provider credentials.

## 6. Delivery milestones

### M1 — Deployable shell

One Worker contains UI/API/runtime bindings, migrations, starter templates, and a reproducible build. Acceptance: clean-account deployment, binding health, setup wizard before admin creation, and disabled bootstrap after setup.

### M2 — Agent control plane

Agent CRUD, draft editing, model settings, validation, immutable versions, publish/rollback, cache invalidation, and audit. Acceptance: draft changes do not alter production; every runtime event records the exact version used.

### M3 — Generic Data and Knowledge

Schema builder, record editor, CSV mapping/upsert, templates, R2 uploads, queued ingestion, AI Search, retries/status. Acceptance: new industries need no code; expired promotions stay hidden; CSV is atomic; structured and semantic data remain separate.

### M4 — Agent runtime

Normalized handler, ConversationAgent Durable Object, context builder, Anthropic via AI Gateway, bounded tool loop, summary/profile state, response validation, fallbacks, and supported attachments. Acceptance: conversations are isolated, history survives eviction/restart, duplicates do not produce duplicate replies, timeouts produce safe fallback events, and dynamic facts require collection tools.

### M5 — Preview and evaluation

Draft chat, trace panel, reset/new conversation, eval cases/runner, critical publish checks, and draft-versus-production diff. Acceptance: admins see model, sources, calls, errors, latency; evals support include/exclude phrases, expected tool, and max length.

### M6 — Connections

Generic sync/async API, allowlisted callback delivery, key lifecycle, adapter registry, connection testing, and Zernio. Acceptance: consistent runtime output across Preview/API/Zernio; webhook `202` within five seconds; invalid HMAC is `401`; duplicates are suppressed; outbound retries are idempotent.

### M7 — Operations UI

Conversation/contact views, external-ID search, human takeover, failed jobs, safe retry, basic usage/latency/error dashboard, and branding. Acceptance: takeover stops replies; failures are inspectable/retryable; branding changes need no rebuild.

### M8 — Mr Spa migration

Convert tenant YAML to settings/draft, prompts to Behavior, Markdown to Knowledge, catalogs/offers/policies to Collections, eval rows to Eval Cases, and leads to Contacts. Acceptance: no Mr Spa runtime branch; another industry can be built entirely through UI and templates; prompt/data changes need no Worker redeploy.

Implementation progress is tracked in [CURRENT-STATE.md](./CURRENT-STATE.md).

## 7. Test and release gates

Unit coverage targets serialization, field validation, CSV upsert, validity filtering, session/password handling, credential cryptography, signatures, idempotency, context budgeting, structured responses, and tool schemas.

Integration coverage targets empty-database migrations, Durable Object persistence, Queue retry/DLQ, R2 lifecycle behavior, AI Search ingestion/query, Anthropic through AI Gateway, Generic sync/async, Zernio verify/enqueue/send/retry, and publish/rollback during active conversations.

Security gates cover unauthenticated admin rejection, CSRF, login throttling, key isolation, SSRF, prompt injection from Knowledge, secret redaction, MIME spoofing/oversize rejection, collection-filter injection, and stored/reflected XSS in data, prompts, traces, and conversations.

End-to-end release scenario:

1. Deploy a clean instance and finish setup.
2. Create a Sales Agent.
3. Import a product CSV and a Markdown policy.
4. Preview answers and inspect sources/tools.
5. Publish v1 and test the Generic API.
6. Connect Zernio and verify inbound/outbound idempotency.
7. Capture a contact and toggle human takeover.
8. Edit a draft without changing production.
9. Publish v2, confirm new conversations use it, then roll back to v1.
10. Create an agent for another industry without source changes.

Production release requires clean-account deployment, automatic idempotent migrations, passing critical evals, Zernio duplicate/retry tests, no plaintext credentials, API rate limits/idempotency, tested config/data export, and complete deploy/update/rollback documentation.
