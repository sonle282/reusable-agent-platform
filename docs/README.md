# Documentation map

This directory is the handoff package for continuing the Reusable Agent Platform from any authorized machine.

## Read in this order

1. [CURRENT-STATE.md](./CURRENT-STATE.md) — what is deployed, what data exists, and the next unresolved work.
2. [PLATFORM-PLAN.md](./PLATFORM-PLAN.md) — product scope, architecture, contracts, milestones, and release gates.
3. [OPERATIONS-RUNBOOK.md](./OPERATIONS-RUNBOOK.md) — clone, local setup, Cloudflare deployment, recovery, and secret handling.
4. [MASTER-PROMPT.md](./MASTER-PROMPT.md) — paste into a new Codex session when moving to another machine.

## Source of truth

- Source code and migrations are authoritative for implementation details.
- `CURRENT-STATE.md` is a point-in-time operational snapshot and must be updated after material production changes.
- `PLATFORM-PLAN.md` records the agreed v1 product boundary; new scope should be explicitly added before implementation.
- Secret values never belong in this repository, issues, build logs, screenshots, or prompts.
