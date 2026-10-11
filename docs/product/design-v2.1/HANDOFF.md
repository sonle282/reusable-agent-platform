# Admin v2.1 — handoff for implementation (Mr Spa first, KISS)

This builds on v2 (`docs/product/design-v2/`). Read v2's HANDOFF first; v2.1 only adds to it.

**Scope rule from the owner (2026-10-11):** build what Mr Spa uses now, scale later. Keep the single-owner install. Do **not** add SMS or email alerts, password reset by email, sign-up, onboarding, billing or multi-workspace in this round.

**Business plan lives outside the repo:** `..\repnow-plan\` (sibling folder of this repo). Read it for context. Never copy it into the repo, never commit it.

| File | What it is |
|---|---|
| `styles.css` | v2 styles plus §25–29 (typing dots, auth, leads, follow-ups) and one bug fix (below). Replaces `docs/product/design-v2/styles.css`. |
| `reference/PAuth.dc.html` | Sign in + first setup. Use mode **“Mr Spa · build now”**. The “Repnow SaaS · later” screens are reference only. |
| `reference/PLeads.dc.html` | **New** Leads page + lead drawer. |
| `reference/PAssistant.dc.html` | Builder with **two new tabs: Follow-ups, Behavior**, and Preview with Seen → typing dots → reply. |
| `reference/Main.dc.html` | Shell: **Leads** nav item (2nd, count = new leads), route, phone tab bar without Data. |
| `reference/SpecV21.dc.html` | What’s in / later, new components, rules. |

Canvas (all boards, clickable): https://claude.ai/artifact/L1h2PvsWyVUcjRJ8SaL4Gs — private to the owner.

---

## Phase 0 — CSS bug fix (do first)

v2 `styles.css` had `.app button, .app input, .app textarea, .app select { color: inherit }` — specificity (0,1,1) beats `.btn-primary` (0,1,0), so **primary button text turns black on black**. Fixed with:

```css
:where(.app) :where(button, input, textarea, select) { font: inherit; color: inherit; }
:where(.app) a { color: var(--color-link); text-decoration: none; }
```

Check whether the ported `src/client/styles.css` has the same bug and apply the same fix.

## Phase 1 — Sign in + first setup (UI only, no API change)

- Rebuild `Login` and `Setup` in `pages/Auth.tsx` to match `PAuth.dc.html` (mode Mr Spa): `.auth` split layout, form max 380, gradient side panel with the example chat (hidden < 860), show/hide password button (`aria-pressed`), error alert with the lockout note.
- No “Forgot password?” link. Under the button: “Only the workspace owner can sign in here. Forgot the password? Reset it with the admin reset command.” (`npm run admin:reset` already exists.)
- Setup: 2 steps — (1) setup code, email, password with 3-segment strength bar (≥12 chars to continue); (2) business name, logo, chat color. AI key fields leave setup (the API already treats them as optional); Settings → AI connection and the Home checklist cover it.
- Keep `/api/setup`, `/api/admin/session`, lockout and PBKDF2 exactly as they are.

## Phase 2 — Leads (built on existing contacts)

Contacts and lead capture already exist. Add only what the page needs.

- **Data:** on the contact (or a `leads` view over contacts with a phone or email): `lead_status` (`new` | `called` | `won` | `not_fit`, default `new`), `lead_notes`, `lead_summary` (one line, customer language), `lead_created_at`, `agent_id`, `platform`. Migration must be idempotent; backfill existing contacts with phone/email as `new` (or `called` if older than 7 days — ask the owner if unsure).
- **Summary:** add an optional `need` / summary field to the lead-capture tool schema so the model writes one line (“8 pedicure chairs, new salon in Houston, TX”) when it saves contact details. No extra model call.
- **API:** `GET /api/admin/leads?status=&agentId=` (list + counts per status), `PATCH /api/admin/leads/:id` (status, notes), `GET /api/admin/leads/export.csv`. CSRF/same-origin like other admin mutations.
- **UI** (`PLeads.dc.html`): header + Export; 3 metrics (New · call these, This month, Won this month); chips All / New / Called / Won / Not a fit with counts; assistant filter; table (avatar + channel badge, name, phone/email, what they want, assistant, follow-up note, status pill, received). Phone: status and time move under the name. Row → right **Drawer**: Call (`tel:` link), Open conversation, Status segmented, Summary, Details collected, Activity timeline, Notes, Delete lead.
- Nav: **Leads** second in the sidebar, badge = count of `new`. Home → Needs attention keeps “New lead to contact” and links to the lead.
- Changing status to Won / Not a fit stops follow-ups for that conversation.

## Phase 3 — Behavior tab: seen, typing, split, AI notice

Builder tabs become: Instructions · Sources · **Follow-ups** · **Behavior** · Versions (phone: scrolling underline tabs, `.tabs.scroll`). Settings are per agent and part of the draft/version like other config.

- `behavior.markSeen` (default on), `behavior.typing` (on), `behavior.splitReplies` (on), `behavior.pace` (`instant` | `natural` | `slow`, default natural = 1–3 s between split messages), `behavior.aiNotice` (on) + `behavior.aiNoticeText` (default “Em là trợ lý ảo của Mr Spa. Anh/chị cần gặp người thật cứ nhắn “gặp nhân viên” nhé.”), outside-hours line choice.
- **Runtime:** on inbound message → mark seen; before generating → typing on, repeat about every 15 s while the model runs (Meta clears it by itself after ~20 s or when a message is sent). Each sender action is its own request, separate from the message. Split: the v2 message JSON already has `messages[]` — send them as separate outbound messages with the pace delay. AI notice: prepend to the first reply of each conversation only.
- **Zernio first:** check Zernio’s inbox API for typing / mark-read (sender action) support. If it isn’t there, keep the settings, show a muted “Not available on Zernio channels yet” under the switches, and still do typing in website chat and Preview. Write what you found into `..\repnow-plan\04-zernio-capabilities.md`. Do not build a separate Meta app in this round.
- **Preview** mirrors it: “Seen” under the customer bubble, then `.typing-dots`, then the reply (see `PAssistant` `ask()`).

## Phase 4 — Follow-ups (within Meta’s 24-hour window only)

- Config per agent (`followUps`): `enabled` (default on), steps (max 2): `{ delay: '2h' | …, condition: 'price_no_contact' | 'any_no_contact', text }`. Defaults: 2 h and 20 h, condition `price_no_contact`, texts from the design. **Text is sent exactly as written** — no model call.
- **Condition `price_no_contact`:** the conversation called `search_products` or `search_offers` and no phone/email was captured. `any_no_contact`: no contact captured.
- **Scheduling:** the conversation Durable Object already owns the conversation — use a DO alarm. On every customer message: store `lastCustomerAt`, cancel pending follow-ups, schedule the next step at `lastCustomerAt + delay`. On alarm: re-check stop rules, then send through the normal outbound adapter with an idempotency key `followup:<conversationId>:<step>:<lastCustomerAt>`.
- **Hard rule:** never send if `now - lastCustomerAt >= 24h` (Meta policy). Steps that would land after 23h 50m are skipped.
- **Stop rules:** customer replied, contact captured, opt-out words (“stop”, “không cần”, “not interested”, “đừng nhắn”), lead status Won / Not a fit, human takeover on.
- **After 24 h:** no message. Add a “Contact again” item to Needs attention (switch in the card, default on).
- Log every follow-up as a runtime event (`followup_sent`, `followup_skipped` + reason) so Conversations shows them and the plan can measure “follow-ups brought back N leads”. The hero line on the tab can show the real count (leads captured after a follow-up was sent, last 30 days); hide it when 0.
- “Show in Preview” appends the step text to the Preview chat (no send).

## Phase 5 — Measure the Mr Spa baseline (output outside the repo)

Write `..\repnow-plan\03-mrspa-baseline.md` from production D1 (read-only queries): conversations per month, share of customer messages outside 10:00–18:00 America/New_York and on Saturday, median time from customer message to assistant reply, share of conversations with a phone or email captured, leads per month. Add a short “how measured” section. No customer names, phones or message text in that file — counts only. The owner adds pre-AI response time from Meta Business Suite and close rate himself.

## Backend checklist

1. Migration: lead fields on contacts (idempotent) + backfill.
2. Leads list / patch / export endpoints.
3. Lead-capture tool: optional one-line summary.
4. Agent config: `behavior` and `followUps` in draft + immutable version; validation.
5. Runtime: mark seen, typing loop, split + pace, AI notice on first reply.
6. ConversationAgent DO: follow-up alarms, stop rules, 24 h guard, idempotent send, events.
7. Needs attention: “Contact again” item.
8. Zernio capability check (typing / mark-read) → plan note.

## Acceptance

- [ ] Primary buttons show white text in light mode and black text in dark mode.
- [ ] Sign in and setup match PAuth (Mr Spa mode) at 1440, 1080 and 390 widths; no forgot-password flow; API unchanged.
- [ ] Leads page lists contacts with phone/email, counts per status are correct, status and notes save, export works, nav badge = new leads.
- [ ] Builder has Follow-ups and Behavior tabs; changes mark the draft unpublished and publish with the version.
- [ ] Preview shows Seen → typing dots → reply; split replies arrive one by one with the chosen pace.
- [ ] AI notice appears on the first reply only.
- [ ] A test conversation that asks a price and goes quiet gets follow-up 1 after the delay; replying cancels follow-up 2; no message is ever sent 24 h after the customer’s last message; replay of the alarm sends nothing twice.
- [ ] No SMS, email-alert, sign-up, billing or multi-workspace code was added.
- [ ] `..\repnow-plan\03-mrspa-baseline.md` and `04-zernio-capabilities.md` exist outside the repo; nothing from `repnow-plan` is committed.
- [ ] `docs/CURRENT-STATE.md` updated (what shipped, the KISS rule, where the plan lives — path only).
