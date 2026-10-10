# Security policy

## Supported version

Only the latest commit on the default branch is supported during v1 development.

## Reporting

Do not open a public issue for a suspected vulnerability. Send a private report to the repository owner with reproduction steps, impact, and the affected commit.

## Deployment responsibilities

- Generate independent high-entropy bootstrap, session, and credential-encryption secrets.
- Restrict AI Gateway tokens to the minimum required Run permission.
- Configure an R2 lifecycle rule for `conversation-attachments/`.
- Keep connector callback/tool hosts on an explicit business-approved allowlist.
- Review D1/R2 backup and retention requirements for each customer deployment.
- Run `npm audit`, `npm test`, `npm run check`, and `npm run build` before release.
- Treat provider payloads, retrieved knowledge, tool output, traces, and customer messages as untrusted content.

External write actions are intentionally not supported in v1.

