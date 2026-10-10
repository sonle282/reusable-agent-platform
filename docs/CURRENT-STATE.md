# Current state and handoff snapshot

Snapshot date: **2026-10-10** (Asia/Saigon)

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

## Production data already loaded

The initial setup is complete and the one-time bootstrap path is disabled.

- Brand: `Mr Spa AI`
- Support URL: `https://mrspainc.com`
- Admin email: `sonle@nhi.sg`
- Agents: 1
- Collections: 5 total, including starter and Mr Spa collections
- Structured records: 75 total
  - Products: 72
  - Offers: 3
- Knowledge sources: 9, all ready at the time of import verification
- Eval cases: 2
- Imported agent ID: `agent_9ba698281216469095698ed4c28c928a`

The admin password was generated and delivered outside Git. If it is unavailable on another machine, use the operational recovery path rather than writing it into a file or prompt.

## Worker secrets present remotely

These bindings exist in Cloudflare and their values must remain outside Git:

- `BOOTSTRAP_TOKEN`
- `SESSION_SIGNING_KEY`
- `CREDENTIAL_ENCRYPTION_KEY`

Secrets remain on the Cloudflare account across laptop changes and normal Git deployments. A new machine does not need their plaintext values unless intentionally rotating or performing a supported recovery operation.

Do not rotate `CREDENTIAL_ENCRYPTION_KEY` until a decrypt/re-encrypt migration exists for stored credentials.

## Important compatibility fix

Cloudflare Workers permits a maximum of 100,000 PBKDF2 iterations for this runtime path. The original value of 210,000 caused first-admin setup to fail. The default was changed to 100,000 and protected by a regression test in commit:

```text
f9d1e87 fix: respect Workers PBKDF2 iteration limit
```

Latest known test state before this documentation update: **15/15 passing**.

## Immediate next work

The platform code and Mr Spa content are deployed, but end-to-end AI behavior is not yet complete because an Anthropic API key has not been configured.

Continue in this order:

1. Obtain the Anthropic key from the owner through a secure channel or clipboard; never echo it, log it, or commit it.
2. In the admin UI, configure Cloudflare account ID, AI Gateway ID `default`, the Anthropic key, and an allowlisted Claude model.
3. Run the built-in model connection test.
4. Open Mr Spa agent Preview and test product, promotion, and policy questions; inspect retrieved sources and collection tools.
5. Run both eval cases and resolve any critical failures.
6. Publish the first production agent version.
7. Create and activate a Generic API connection; test sync and async behavior, API-key scope, and idempotency.
8. Configure Zernio credentials and endpoint details; test HMAC rejection, duplicate event handling, queueing, and outbound delivery.
9. Verify human takeover, conversation search, contact capture, failed job inspection, and safe retry.
10. Add backup/export validation and finish the public-template release gates only if the product is later returned to public distribution.

## Known v1 boundaries

- One deployment per customer, one admin, multiple agents.
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
