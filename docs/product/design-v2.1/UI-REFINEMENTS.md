# Admin UI refinements: 25 polish items (review of agent.mrspainc.com)

Reviewed on 2026-10-11 against the live site (v2.1 tokens, Manrope, live version v8).

**How it was checked**
- Every page and builder tab was measured at 1280 px, including the lead drawer, the Data table page and its row drawer, and a conversation thread.
- Text contrast was computed for every text element on each page.
- Control sizes were measured.

**Not seen visually (verify locally with Playwright)**
- The 390 px phone layout (the Chrome window stayed in the background, so it could not be resized).
- Dark mode.
- Sign-in and setup.
- The Fix this answer sheet.

**Scope:** polish only. No new features, pages, settings, data fields or backend changes, except the one bug below, which blocks a page.

---

## Blocker (a bug, not polish; fix first)

**Conversations › thread: every chat fails to open.**
- `GET /api/admin/conversations/:id` returns **500** for all 3 conversations: the real Messenger one and both smoke tests.
- The list loads (200), but the thread shows "Couldn't open this chat · Request failed".
- The ids contain `:` and are URL-encoded as `%3A`. Check the route decoding and the Durable Object or D1 lookup first.
- The owner cannot read any chat until this is fixed.

---

## Global (all pages)

### 1. Touch targets under 44 px on phone (Effort M)
- **Where:** everywhere. There are **no `@media (pointer: coarse)` rules** in the CSS. Measured sizes:
  - `.btn-sm` 28 px tall (Publish, Fix, Export, Check, Manage, Restore, Add a rule…)
  - `.btn-icon.btn-sm` 28×28 (•••, row Open, ✕ remove rule)
  - `.chip` 28
  - segmented 28 (Theme, Reply pace, lead Status)
  - `.switch` 32×19
  - `.nav-item` 36
  - search inputs 35
- **Change:** add one block in `styles.css`:
  ```css
  @media (pointer: coarse) {
    .btn-sm, .chip, .segmented button { min-height: 36px; }
    .btn-icon.btn-sm { width: 36px; height: 36px; }
    .btn, .chip, .switch, .segmented button, .nav-item { position: relative; }
    .btn::after, .chip::after, .switch::after, .segmented button::after {
      content: ""; position: absolute; inset: 50% auto auto 50%;
      width: max(100%, 44px); height: max(100%, 44px); transform: translate(-50%, -50%);
    }
  }
  ```
  Keep the desktop sizes unchanged.
- **Why:** the owner uses a phone. Toggling Required, changing a lead's status or tapping ••• misfires.

### 2. Draft status is written four different ways (Effort S)
- **Where:**
  - Home › Assistant card: "Live · version 8 · the draft has unpublished changes"
  - Builder top bar: "Unpublished changes · customers see version 8"
  - Versions › Draft row: "Unpublished changes · saved" + "Not live"
  - Needs attention: "customers still see version 8"
- **Change:**
  - Add one helper, `agentStatusLine(agent)`, and use it everywhere: **"Live · version 8 · unpublished changes"**, with the orange status dot.
  - In Versions, the Draft row badge becomes **"Not published"** (gray `Badge`), not "Not live".
- **Why:** one state should read the same way on every screen. "Not live" next to "Live" is easy to misread.

### 3. Control heights drift from the 28/32/36/40 scale (Effort S)
- **Where:**
  - Search fields are 35 px (Conversations, Data table).
  - The date input in the row drawer is 37 px.
  - Follow-ups selects are 32 px, but Behavior selects are 36 px.
- **Change:**
  - `.search input, .input, select, input[type=date] { height: var(--control-md); box-sizing: border-box; }` (36).
  - The Follow-ups inline selects use the same 36.
- **Why:** fields on the same screen line up. It looks finished.

### 4. Phone numbers are shown raw (Effort S)
- **Where:**
  - Leads table: "0900000000"
  - Lead drawer: "Call 0900000000"
  - Conversations thread header: "Messenger via Zernio · 0900000000"
- **Change:**
  - Add a display-only `formatPhone()`: 10 US digits (or +1 and 10) becomes `(215) 772-1111`; anything else stays as entered.
  - Keep the raw value in `tel:`.
  - Add `font-variant-numeric: tabular-nums`.
  - Button copy: **"Call (215) 772-1111"**.
- **Why:** faster to read and to dial-check before calling a lead.

### 5. Channel badge covers the avatar initials (Effort S)
- **Where:** Leads table, Home › Recent conversations, Conversations list. The Messenger mark sits on top of "LH".
- **Change:**
  - Badge 14 px at `right:-3px; bottom:-3px`, with a 2 px ring `box-shadow: 0 0 0 2px var(--color-surface)`.
  - Avatar initials font 12/600, centered.
  - Use the same `AvatarWithChannel` component in all three places.
- **Why:** the initials are the quickest way to recognise a customer.

### 6. Times without a date (Effort S)
- **Where:**
  - Versions 1–5 all show just "Yesterday".
  - Data list shows "Updated 1:16 PM".
  - Sources rows show "Updated yesterday".
- **Change:**
  - Use `formatWhen()`: today shows "1:16 PM", yesterday shows "Yesterday 4:12 PM", older shows "Oct 8, 4:12 PM".
  - Add `title=` with the full date and time.
- **Why:** the owner picks a version to restore by time. Five identical "Yesterday" rows are useless for that.

### 7. The same things are named differently (Effort S)
- **Where:**
  - Builder tab "Checks", card head "Answer checks", Behavior help text "Answer checks fail…".
  - Home row button "Fix", Preview "Fix this answer".
  - Phone tab "Chats", sidebar and page "Conversations".
- **Change:**
  - Use **"Checks"** for the tab and the card head. Subtitle: "Questions it must answer right before you publish". Behavior help: "Checks fail when a reply is longer".
  - Home row button: **"Fix answer"**.
  - Keep "Chats" only in the phone tab bar, because of width. That is acceptable, but nowhere else.
- **Why:** plain words, one name per thing.

---

## Home

### 8. Needs attention repeats the same item three times (Effort M, client-side only)
- **Where:** three identical rows, "Price given without checking Data · Lê Hoàng Khắc Sơn · 2:35 PM / 2:27 PM / Yesterday", each with its own Fix button. The count shows "4".
- **Change:**
  - Group items with the same type and conversation into one row: **"Price given without checking Data · 3 times"** · name · latest time.
  - Fix opens the latest one; ••• › Open chat.
  - The header count counts groups (2).
- **Why:** the list should be a to-do list, not a log. Three rows for one problem feels broken.

### 9. Metric label is hard to parse (Effort S)
- **Where:** "Chats · last 24 hours **3** 3 this week".
- **Change:**
  - Label: "Chats today". Value 3. Sub line in `--color-text-3`: "3 this week".
  - Apply the same pattern to the other two metrics: label, then value, then sub line.
- **Why:** you read the number first and the label second, so one glance is enough.

### 10. Recent conversations don't show who spoke last (Effort S)
- **Where:** the preview line is the assistant's long reply ("Dạ da ghế Mr Spa kháng acetone ạ…").
- **Change:**
  - Prefix assistant messages with "AI: " in `--color-text-3`.
  - Customer messages have no prefix.
  - Clamp to 1 line at 1080 px and up, 2 lines below.
  - Use the same rule in the Conversations list.
- **Why:** the owner needs to see at a glance whether the customer is waiting.

---

## Leads

### 11. "No summary yet" fills the table column (Effort S)
- **Where:** the "What they want" cell for leads without a summary is gray filler text.
- **Change:**
  - In the table, show "—" in `--color-text-3`.
  - Keep the explanation only in the drawer: "No summary yet. It's written when the customer leaves contact details."
- **Why:** less noise. The column reads as data, not a status message.

### 12. Zero counts on chips (Effort S)
- **Where:** Leads "Called 0 · Won 0 · Not a fit 0"; Data table "Scheduled 0 · Ended or off 0".
- **Change:**
  - Render the count only when it is above 0.
  - Counts use `--color-text-3` and weight 500 inside the chip.
  - The selected chip's count inherits the chip text color.
- **Why:** the eye goes to the chips that have something in them.

### 13. Two primary buttons in the lead drawer (Effort S)
- **Where:** "Call …" is `.btn-primary` at the top, and "Done" is also `.btn-primary` in the footer.
- **Change:**
  - Footer: "Delete lead" `.btn-danger-ghost` on the left, then **"Close"** `.btn-outline` on the right. Notes autosave, so show "Saved" in `--color-text-3` after an edit.
  - Call stays the only primary.
- **Why:** one primary action per screen. Calling is the job.

### 14. Activity timeline is noisy and in the wrong order (Effort S)
- **Where:** "Left contact details — lead created · Yesterday", then "Marked Called · 2:41 PM", "Marked Won · 2:41 PM", "Marked New · 2:41 PM".
- **Change:**
  - Newest first.
  - Status changes less than 2 minutes apart collapse into the last one: "Status set to New · 2:41 PM".
  - Use the `.timeline` dot plus the line from the tokens.
- **Why:** quick clicks while testing or fixing a mistake shouldn't read like a history.

---

## Assistant (builder)

### 15. Publish gives no progress while the required checks run (Effort S)
- **Where:** the top bar Publish button. Publish first runs the 17 required checks.
- **Change:**
  - While running: the button is disabled, with a spinner and "Checking 17…".
  - On a fail: an `Alert` under the top bar, "2 checks failed — Publish stopped", with a **"See failed checks"** link that opens the Checks tab.
  - On success: a toast, "Version 9 is live".
- **Why:** publishing takes seconds. Without feedback the owner clicks twice or thinks it hung.

### 16. Always/Never lists: a ✕ on every line (Effort S)
- **Where:** Instructions. 7 Always + 5 Never + other lists each show a 28×28 remove button all the time.
- **Change:**
  - With `@media (hover: hover)`, show ✕ only on row `:hover` and `:focus-within`, at `opacity` 0 → 1 over 120 ms.
  - Always visible on touch.
  - `aria-label` stays.
- **Why:** 14 ✕ icons make the form look like a delete screen.

### 17. Fallback reply textarea has no accessible name (Effort S)
- **Where:** Instructions › "When something goes wrong". The second textarea has no label or placeholder (found as a bare `TEXTAREA`).
- **Change:** wrap it in `Field label="Fallback reply"` with `htmlFor`/`id`. Placeholder: "Sorry, I can't answer right now. Our team will reply soon."
- **Why:** screen readers and autofill need it. It also matches every other field.

### 18. Checks: action hierarchy and a flat list of 34 (Effort M)
- **Where:**
  - Checks tab: "Test all" is `.btn-ghost`, but "Add check" is `.btn-outline`, so the secondary action looks stronger.
  - 34 rows, with no way to see the 17 required or the failing ones.
- **Change:**
  - "Test all" becomes `.btn-outline` with a play icon. "Add check" becomes `.btn-ghost` with a plus icon.
  - Add `Chips`: All 34 · Required 17 · Failed n (filtered on the client from data already loaded; "Failed" only after a run).
  - Show a pass/fail dot before each name after a run.
- **Why:** before publishing, the owner only cares about what fails.

### 19. Versions: a Restore button on every row (Effort S)
- **Where:** 7 outline "Restore" buttons stacked.
- **Change:**
  - Restore becomes `.btn-ghost.btn-sm`, shown on row hover or focus on desktop, and always on touch.
  - Live row: green "Live" `Badge` only.
  - Restore opens a `Dialog`: "Restore version 6? New chats use it after you publish. Chats in progress keep their version." with the buttons Restore (primary) and Cancel.
- **Why:** restoring is rare and risky. It shouldn't be the loudest thing on the tab.

---

## Data

### 20. Table header line repeats itself (Effort S)
- **Where:** "Mr Spa Policies · 34 in use · 34 rows · Used by MS Mr Spa Consultant".
- **Change:**
  - Use **"34 rows · all in use · used by Mr Spa Consultant"**.
  - When some rows are off: "34 rows · 30 in use · used by …".
  - Drop the avatar from the meta line; it is in `--color-text-2`.
- **Why:** shorter, no duplicate number.

### 21. Raw keys and over-long cells in the table (Effort S)
- **Where:**
  - The Topic column shows lowercase keys ("shipping", "payment").
  - The "Customer asks" cell joins three questions and truncates at 252 px.
- **Change:**
  - Topic becomes a gray `Badge` with the first letter capitalised.
  - "Customer asks" shows the first question only (split on "?"), with "+2" in `--color-text-3` and the full text in `title`.
- **Why:** the table becomes scannable. The full text lives in the drawer.

### 22. Row drawer: seven textareas all 64 px tall (Effort S)
- **Where:** Topic, Customer asks, Rule, Numbers, Applies to, Exceptions, Source are all the same height. Short fields look empty and long rules scroll inside a tiny box.
- **Change:**
  - Autosize: min 1 row for Topic, Numbers and Source; 2 rows for the others; max 10 (`field-sizing: content` with a JS fallback).
  - Group the fields with 24 px gaps: "What customers ask" (Customer asks, Topic), "Answer" (Rule, Numbers, Exceptions, Applies to), "Source".
- **Why:** editing a policy should feel like editing text, not a database form.

---

## Conversations

### 23. Error state is technical and has no way out (Effort S)
- **Where:** the thread shows "Couldn't open this chat · Request failed. The customer is not affected. Try again" as plain text. "Request failed" is jargon.
- **Change:**
  - Use the `EmptyState` with an alert icon: "Couldn't load this chat", with the sub line "The customer isn't affected." and a **"Try again"** `.btn-outline` button that refetches.
  - Keep the `thread-foot` hint hidden while in the error state.
- **Why:** plain words, and an error always comes with a next step.

---

## Channels

### 24. Platform cards are redundant and uneven (Effort S)
- **Where:**
  - "Add another channel": titles are "Zernio Messenger", "Zernio Instagram"… while the sub line also says "Through Zernio".
  - Card heights differ (111 px vs 129 px).
  - Connected rows open on click but also have a separate 28 px "Open" icon button.
- **Change:**
  - Title = platform name only ("Messenger"), sub line "Through Zernio". API and Webhook keep "Built in" as the sub line, not the title.
  - Grid `align-items: stretch` with cards `min-height: 120px`.
  - Replace the Open icon button with a decorative chevron (`aria-hidden`); the whole row is the button.
- **Why:** less to read, cleaner grid, one tap target per row.

---

## Settings

### 25. AI key status is unclear (Effort S)
- **Where:** AI connection shows "Key saved · check that it works", then a [Check] button, then "Saved", then [Replace].
- **Change:**
  - One status line with a `Badge`: gray "Saved, not checked", green "Working · checked 2:41 PM", or red "Not working" plus an `Alert` saying "Replace the key or check your Anthropic account" with Replace focused.
  - Buttons: Check (`.btn-outline.btn-sm`), Replace (`.btn-ghost.btn-sm`).
- **Why:** if the key breaks, the assistant stops answering customers. The state must be obvious.

---

## Cross-page checks

**Inconsistencies:** items 2, 3, 5, 6 and 7, plus Publish being `.btn-sm` on Home but the default size (32) in the builder top bar. That is fine (list row vs page header), but keep it to those two contexts only.

**AA contrast**
- An automated scan of all desktop pages (light mode) found **no failures** in visible text.
- One element was flagged: Settings › Chat color, the "Chat color #172126, change" text at contrast 1.19 on its swatch. If this text is visible, show the hex next to the swatch in `--color-text-2` instead of on it. If it is a visually hidden label, it is fine.
- Dark mode was **not scanned**. Run the same check with `data-theme="dark"`.

**Touch targets under 44 px:** see item 1 for the full list. The builder tabs (44 px) and the starter chips in Preview (40 px, raise to 44 on coarse pointers) are the only near-passes.

**Empty, loading and error states to verify locally** (not visible on production because data exists)
- Leads with 0 leads, and with 0 in a filtered chip.
- Conversations with 0 chats, and with none selected on desktop.
- Checks with 0, while running, and after a run.
- Data table with 0 rows or no search match.
- Home with nothing in Needs attention ("All caught up").
- Skeletons on first load for Home metrics, the Leads table and the Conversations list.
- Error states for Leads, Data and Channels fetch failures. They should use the same `EmptyState` + Try again pattern as item 23.

## Prompt for Claude Code

```
Read docs/product/design-v2.1/UI-REFINEMENTS.md. First fix the Blocker (GET /api/admin/conversations/:id returns 500 for every conversation; ids contain ':' URL-encoded as %3A) and deploy. Then apply items 1–25 as UI-only changes in src/client (styles.css, ui.tsx, pages/*). No new features, settings, data fields or API changes. Every value comes from design-v2.1/styles.css tokens. Commit by section (Global, Home, Leads, Assistant, Data, Conversations + Channels + Settings), with `npm run ci` green after each. Verify with Playwright at 1440×900, 1080×800 and 390×844, light and dark. Check: no target under 44 px on a coarse pointer, AA contrast in dark mode, and the empty, loading and error states listed at the end. Update docs/CURRENT-STATE.md.
```
