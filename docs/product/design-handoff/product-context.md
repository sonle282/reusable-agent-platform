# Product context for the redesign

## 1. The product in one sentence
A builder that lets any small business set up one AI assistant. The assistant answers its customers on chat channels the way a trained front-desk or sales staff member would. It looks up the business's real data before quoting prices or offers, and it hands off to a person when needed.

## 2. Who uses the admin
- **One business owner per workspace.** They are not technical and they are busy. They use a laptop most of the time and check on a phone.
- **What they do daily:**
  - Glance at Home.
  - Read conversations.
  - Fix a wrong answer.
  - Update an offer or price.
- **What they do occasionally:**
  - Edit instructions.
  - Add knowledge.
  - Publish.
  - Add a channel.
- **Admin language:** English. Customer conversations are in the customer's language (the first customer's are Vietnamese). That text appears inside chat bubbles and data rows, so the layouts must handle long Vietnamese strings.

## 3. Principles (non-negotiable)
- **KISS and fewest steps.** Drafts autosave. One Publish action runs the checks and publishes.
- **One primary action per screen.** Warnings appear only when something needs action, and always include a next step.
- **Plain words.** Never "tool", "eval", "prompt", "LLM", "trace", "webhook config".
- **Apple Human Interface Guidelines feel**, including SF Symbols–style outline icons (keep this icon family). The admin must feel like a first-party Apple app on the web.
- **Metrics live only on Home**, never on configuration pages.

## 4. Information architecture (keep)
Sidebar on desktop, tab bar on phone, 6 items:

| # | Page | Icon | Contents |
|---|---|---|---|
| 1 | Home | house | Assistant status · chats in the last 24 h · waiting for your team · replies not delivered · recent conversations · (planned) Needs attention |
| 2 | Assistant | sparkles | Segmented: **Test** · **Instructions** · **Sources** · **Versions**. Header: name, "Live · version 3", one Publish button |
| 3 | Data | table | Tables (Products, Offers…) master list + rows. Row edit sheet with Active / Starts / Ends. Add · Import CSV · Rename · Hide table |
| 4 | Conversations | two bubbles | Search, list, transcript bubbles, "Your team replies" switch |
| 5 | Channels | link | API · Webhook · Zernio inbox; failed deliveries with Retry only when present |
| 6 | Settings | gear | AI key (+ collapsed Cloudflare IDs), Brand, Backup, Sign out |

**Assistant › Instructions** sections:
- Your business: name, what you offer, contact and hours, website.
- Your assistant's job.
- Voice and style.
- Always (one rule per line).
- Never.
- Hand off to a person when.
- Contact details to collect.
- Collapsed "Detailed playbook (advanced)": a monospace editor that can hold 33,000 characters.
- Side column: name, description, fallback reply, collapsed Advanced (model, max tokens, max reply length).

**Assistant › Test:** chat with the draft. Tapping a reply opens Details, which shows status, time, model, "Knowledge read" (each source is tappable to edit) and "Data looked up" (each row is tappable to open its edit sheet). Below are **Test scenarios** (name, customer message, rules; Required badge; Passed/Failed) with Add / Run all.

## 5. Planned feature to design now: "Fix this answer"
Full spec: `01-prd.md`, `02-ux-flow.md`, `03-ui-spec.md` (Vietnamese). Clickable prototype: `fix-this-answer-prototype.html`.

**The sheet has three steps:**
1. Write what it should have said. The customer message and the reply are prefilled.
2. The AI suggests one place to fix it, with a before/after diff, plus "Choose another place". The three places:
   - Data: update a row.
   - Knowledge: add to Corrected answers.
   - Instructions: add a line.
3. Result.
   - Pass: "Fixed and protected", and a scenario is saved.
   - Fail: "Not applied — the scenario still fails", with **Try another fix** and **Keep it anyway** (which asks for confirmation).

**Needs attention** goes on Home. Item types:
- Your team is replying.
- Sent the backup reply.
- Price question without a lookup.
- New lead to contact (24 h).
- Fix not live yet.
- Fix kept but failing.
- Data request (72 h).

Each item offers **Fix** / **Open conversation** / **Dismiss** (with a reason).

## 6. Designer audit of the current UI (from the screenshots)
Starting points. Confirm, refute or extend them.

1. **Disabled "Published" button looks broken.** It is a pale blue filled button at full prominence. A finished state should read as status, not as a disabled action (`03`, `04`, `05`).
2. **The Data page header collapses.** The table title wraps onto two lines ("Mr Spa / Offers"), and five actions split across two rows (Search, Add, Import CSV, Rename, Hide table). Table columns wrap long Vietnamese text into tall rows, and the "When" column mostly says "Always", which wastes width (`06`).
3. **Instructions mixes two field styles.** Inline right-aligned values ("Business name … Mr Spa Inc.") sit next to grey filled text areas with their own scrollbars inside grouped cells. The side column reads as a second form, not as supporting info (`03`).
4. **Source rows are noisy.** Each row shows a "Ready" badge, an "Edit" link and a switch, even when everything is ready. Status should only appear when it is not normal (`04`).
5. **Conversations shows machine IDs as names** ("smoke-1791617919875-async"), and they wrap into three lines in the list. The list column is narrow, and previews truncate mid-word (`08`).
6. **Details in Test is a long scroll.** Status, time and model take three full rows before the useful part (knowledge and data used) (`02`).
7. **Page widths are inconsistent.** Settings is centred at 720px while other pages are full width, and page header heights differ between pages.
8. **Typography falls back to Segoe UI on Windows**, so the "Apple" feel is lost on the owner's Windows laptop. Decide on a deliberate web font stack, for example SF Pro on Apple devices and Inter or a similar face elsewhere, with tuned tracking.
9. **The sidebar brand tile shows a tiny logo**, and the "Assistant is live" footer is low-contrast.
10. **Empty and low-data states feel bare.** For example, Channels with a single row leaves a large empty canvas (`09`).

## 7. Constraints for implementation
- **Stack:** React + plain CSS, no CSS framework. Tokens are CSS custom properties in `styles.css`, with light and dark values.
- **Primitives in `ui.tsx`** (Claude Code will map your design onto them): `Button` (filled / tinted / gray / plain / destructive; small / regular / large) · `Section` (inset grouped list with header and footer) · `Row` (icon tile, title, subtitle, detail, accessory, chevron) · `FieldRow` · `Toggle` · `Segmented` · `SearchField` · `Badge` · `Banner` · `Sheet` · `EmptyState` · `Spinner` · toast. Propose changes to these primitives rather than one-off components.
- **Icons:** 24-unit grid, 1.6 stroke, round caps (SF Symbols–like). Add new glyphs in the same style.
- **Breakpoints:** sidebar collapses to a tab bar under 860px, and sheets become bottom sheets on phone. No horizontal scroll on phone (tables turn into rows).
- **Accessibility:** visible focus, 44pt touch targets, `role="switch"`, dialogs with focus management, reduced motion respected, and both themes at WCAG AA contrast.

## 8. Screenshots in this folder (desktop, light mode, live data)
- `01-home`
- `02-assistant-test` (a reply selected, Details open)
- `03-assistant-instructions`
- `04-assistant-sources`
- `05-assistant-versions`
- `06-data`
- `07-data-edit-row`
- `08-conversations`
- `09-channels`
- `10-settings`

Phone layouts are not captured; follow the breakpoint rules in section 7.
