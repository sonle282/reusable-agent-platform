# Operations and new-machine runbook

This runbook is for maintainers of the public source repository and authorized operators of the Mr Spa Cloudflare account.

## 1. Security rules

- Never commit `.dev.vars`, `.env*`, passwords, Anthropic keys, webhook secrets, connection API keys, cookies, or exported credentials.
- Never paste secrets into issues, PR descriptions, prompts, screenshots, terminal command arguments, or build logs.
- Enter secrets through the application UI or Wrangler's protected/interactive secret workflow.
- Keep the admin password and provider keys in an approved password manager.
- Do not rotate `CREDENTIAL_ENCRYPTION_KEY` until stored credentials can be re-encrypted with a new key version.
- Treat Cloudflare account ID, resource IDs, and URLs as operational metadata, not authentication.

## 2. Continue from a new machine

Install current Node.js LTS, Git, GitHub CLI, and a browser. Then:

```powershell
gh auth login
gh repo clone sonle282/reusable-agent-platform
Set-Location reusable-agent-platform
npm ci
npm run ci
npx wrangler whoami
```

Expected GitHub repository: `sonle282/reusable-agent-platform`, public, default branch `main`. Authentication is still required to push changes.

`npx wrangler whoami` must show access to Cloudflare account ID `759105f65ba94c85759b0b2a03f1c39a`. If it does not, authenticate the correct Cloudflare account before any remote command.

Read [CURRENT-STATE.md](./CURRENT-STATE.md) and check:

```powershell
git status --short --branch
git log --oneline -10
Invoke-RestMethod https://agent.mrspainc.com/health
```

Cloudflare stores production secret values remotely. Cloning onto a new machine does not copy them, and ordinary deployments do not require their plaintext values.

## 3. Local development

Create local-only secrets from the example without committing them:

```powershell
Copy-Item .dev.vars.example .dev.vars
npm run cf:typegen
npm run db:migrate:local
npm run dev
```

Open `http://127.0.0.1:5173`.

Before a commit:

```powershell
npm run check
npm test
npm run build
npm run deploy:dry
git diff --check
git status --short
```

`deploy:dry` validates packaging but does not prove remote bindings or runtime behavior.

## 4. Normal production release

Normal releases use the connected Cloudflare Workers Builds pipeline:

1. Make a focused change on a branch or `main` according to the current collaboration flow.
2. Run `npm run ci` locally.
3. Review `git diff` and scan for secrets.
4. Commit and push to `main`.
5. In Cloudflare Workers Builds, verify the build command `npm run ci` and deploy command `npm run deploy:ci` both succeed.
6. Verify `/health`, login, and the affected feature in production.
7. Update `CURRENT-STATE.md` after material resource, model, migration, or production-data changes.

The deploy command applies remote D1 migrations before publishing. Migrations must remain forward-only and idempotent. Never edit a migration that has already run in production; create a new numbered migration.

Manual deployment is a fallback, not the normal path:

```powershell
npm run ci
npm run deploy
```

Confirm the account and target first. The current `deploy` script publishes the Worker and then applies D1 migrations; the CI path applies migrations before publish. For schema changes required by new code, prefer the connected CI path or explicitly apply the migration before a manual deploy.

## 5. Health and diagnostics

Production health:

```powershell
Invoke-RestMethod https://agent.mrspainc.com/health
```

Useful checks:

```powershell
npx wrangler whoami
npx wrangler deployments list
npx wrangler d1 migrations list DB --remote
npx wrangler tail reusable-agent-platform
```

Use structured logs and Cloudflare traces for request failures. Redact tokens before sharing any output. For queue incidents, inspect the failed-job/delivery state in the admin UI and retry only operations designed to be idempotent.

## 6. Secrets and credentials

Required Worker secrets:

```text
BOOTSTRAP_TOKEN
SESSION_SIGNING_KEY
CREDENTIAL_ENCRYPTION_KEY
```

`BOOTSTRAP_TOKEN` is a one-time setup guard and is rejected after an admin exists. Keeping or rotating it does not reopen setup.

Use Wrangler interactive input when a Worker secret genuinely must be changed:

```powershell
npx wrangler secret put SESSION_SIGNING_KEY
```

Remember that changing a Worker secret creates and deploys a new Worker version. Rotating the session key invalidates active sessions. Rotating the encryption key without a credential migration makes existing encrypted credentials unreadable.

Anthropic, Zernio, webhook, and connection credentials are managed by the application and encrypted in D1. The UI never returns stored plaintext after save. One-time connection/API keys must be captured directly into the destination password manager or integration.

## 7. Configure the model and finish Mr Spa activation

The pending production task is to provide an Anthropic API key securely.

1. Sign in at `https://agent.mrspainc.com`.
2. Open model/provider settings.
3. Set Cloudflare account ID `759105f65ba94c85759b0b2a03f1c39a`.
4. Set AI Gateway ID `default` unless a named gateway has been deliberately created. Model calls go through the Worker `AI` binding (`env.AI.gateway(id).run`), which is pre-authenticated, so Authenticated Gateway works without an extra `AI Gateway Run` API token. `AI_GATEWAY_TOKEN` is only used by the direct-HTTP fallback.
5. Paste the Anthropic API key without exposing it to terminal output or Git.
6. Select an allowlisted Claude model and test the connection.
7. Preview the imported Mr Spa agent with product, offer, and policy questions.
8. Confirm the trace shows relevant Data Collection tools for dynamic facts and Knowledge sources for explanatory content.
9. Run critical evals, resolve failures, and publish the first production version.

## 8. Mr Spa data import

The importer expects the fixture at `../ai-agent-blueprint/tenants/mrspa`, or a path supplied in `MRSPA_FIXTURE_ROOT`. It authenticates through the admin API and is idempotent by stable business keys.

```powershell
$env:AGENT_PLATFORM_URL='https://agent.mrspainc.com'
$env:AGENT_ADMIN_EMAIL='sonle@nhi.sg'
$env:AGENT_ADMIN_PASSWORD='<retrieve-securely>'
npm run migrate:mrspa
Remove-Item Env:AGENT_ADMIN_PASSWORD
```

Do not place the password directly into a committed script or shell history. After import, verify record counts, knowledge readiness, evals, and Preview behavior before publishing.

## 9. Rollback and recovery

There are two independent rollback concepts:

- **Agent rollback** (Restore) changes the active agent-version pointer. Every chat, including chats in progress, uses the live version from the customer's next message (since 2026-10-12).
- **Worker rollback** restores a prior code version in Cloudflare. It does not roll back D1, R2, Queue, Durable Object, or other resource data.

Before Worker rollback, determine whether the prior code is compatible with all migrations already applied. Never assume a code rollback reverses schema or data changes.

A person who forgot their password gets a new one from an owner: Settings › People › ••• › Password link (one-time, 7 days). When no owner can sign in, use the supported recovery command. It verifies the Wrangler account, rotates `BOOTSTRAP_TOKEN` (the new value is copied to the clipboard, never printed), removes the owners (managers and staff keep their accounts), every session and the login lockouts, and reopens first-run setup. Agents, data, knowledge, credentials, connections and conversations are kept.

```powershell
$env:EXPECTED_CF_ACCOUNT_ID='759105f65ba94c85759b0b2a03f1c39a'
npm run admin:reset -- --confirm
```

It resets only the sign-in, not the data: the assistant, versions, Data, knowledge, channels, conversations, contacts and saved keys stay, and customers keep getting replies.

Complete setup immediately afterwards: until it is done, anyone holding the new bootstrap token can claim the instance. Paste the code (Ctrl+V) into Setup code before copying anything else or taking a screenshot, because either replaces the clipboard; "Invalid bootstrap token" usually means the clipboard no longer held the code, and re-running the command makes a new one. The wizard sets only name, logo and color and clears the support link, so afterwards restore the brand in Settings (Mr Spa: logo `https://mrspainc.com/assets/homepage/mrspa-logo.png`, color `#172126`, support link `https://mrspainc.com`). Do not directly replace password fields with ad hoc SQL and do not expose password hashes.

Before destructive migrations or bulk imports, create appropriate D1/R2 backups or exports according to the customer's recovery requirement. Exported agent configuration must omit credentials and raw secrets.

## 10. Public repository and Cloudflare Git integration

The GitHub repository is public and reusable as a source template. Cloudflare Workers Builds remains connected through the GitHub account/app for automatic production deployment. After changing repository visibility or GitHub-app permissions:

1. Push a harmless documentation commit.
2. Confirm Cloudflare detects the commit.
3. Confirm build and deploy succeed.
4. Confirm production `/health` remains healthy.

If Cloudflare stops receiving pushes, reconnect the Git integration or grant the Cloudflare GitHub app access to `sonle282/reusable-agent-platform`.
