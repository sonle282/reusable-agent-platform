# UI review brief — Agent Builder admin (dán vào Claude chat)

**Cách dùng:**
1. Mở Claude chat, tạo cuộc trò chuyện mới.
2. Dán nguyên phần **PROMPT** bên dưới.
3. Đính kèm ảnh chụp màn hình (Claude Code đã gửi sẵn bộ ảnh: máy tính 1440 px sáng/tối, điện thoại 390 px). Nếu muốn xem dữ liệu thật, tự chụp thêm trên https://agent.mrspainc.com (Win+Shift+S).
4. Đính kèm `docs/product/design-v2.1/styles.css` để Claude chat dùng đúng tên token và class.
5. Nhận lại danh sách tinh chỉnh, chọn những mục muốn làm, rồi đưa cho Claude Code: "apply these UI refinements".

---

## PROMPT

You are a senior product designer reviewing a live admin web app. Review the screenshots and the feature list below, then give me a prioritised list of **UI refinements** that make it feel finished and professional. Visual and interaction polish only: do not add product features, pages or settings.

### The product
- **What it is:** a single-business "AI assistant builder". The owner sets up **one** assistant that answers customers on chat channels (Facebook Messenger through Zernio today; API and webhook for websites and other systems). It replaces front-desk / page-inbox staff.
- **First customer:** Mr Spa, a pedicure-chair and salon-furniture seller in Philadelphia. Customers write in Vietnamese; the admin UI is English.
- **Who uses the admin:** one non-technical owner, on a laptop or a phone.
- **Principles:** KISS, fewest steps, plain words (never "tool", "eval", "prompt", "LLM"), one primary action per screen, warnings only when something needs action and always with a next step. Drafts autosave.

### Design system (already implemented — refine within it)
- Look of openai.com/brand with components modelled on OpenAI's open-source Apps SDK UI (MIT): white / near-black grounds, monochrome black pill primary buttons, hairline borders, pastel blocks, soft gradient on the sign-in panel. No OpenAI logo, name or font.
- Font: Manrope 400–800 (full Vietnamese). UI text 14px, chat text 16px, page titles 28px bold.
- Tokens in `design-v2.1/styles.css` (colors, type, radii, control sizes 28/32/36/40, motion). Light, dark (ChatGPT dark) and System. Text must pass WCAG AA; we deliberately set `--color-text-3` to #6B6B6B light / #9B9B9B dark and count badges to #C8450C.
- Icons: Apps SDK UI filled glyphs; platform logos from Simple Icons.
- Breakpoints: sidebar ≥1080 px, icon rail 860–1079 px, tab bar below 860 px.

### Navigation
Sidebar: workspace name, **Home · Leads · Data · Conversations · Channels · Settings**, then an "Assistants" heading with the one assistant (pastel avatar + status dot: green live, orange unpublished changes, gray not live), and the account row. Phone tab bar (6): Home · Leads · Assistant · Chats · Channels · Settings (Data is reached from Home and from the assistant's Sources).

### Pages and what they do today
1. **Sign in / first setup** — split screen: form left, gradient panel with an example chat right (hidden on phone). Sign in: email, password with show/hide, lockout message after 5 tries, no "forgot password" (owner resets from the server). Setup: 2 steps — setup code + email + password (strength bar, ≥12 chars), then business name, logo URL, chat color.
2. **Home** — Needs attention (new lead to contact, your team is replying, price given without checking Data, sent the backup reply, fix not live yet, fix kept but failing, contact again after 24 h; each with one action and a ••• menu to open the chat or dismiss with a reason), Last 24 hours metrics (chats, waiting for your team, replies not delivered), Assistant card (status + link to Data), Recent conversations with the channel logo on the avatar.
3. **Leads** — people who left a phone or email. Metrics (New · call these, This month, Won this month), status chips (All / New / Called / Won / Not a fit), table (person + channel logo, phone, one-line "what they want" written by the assistant, status pill, received). Row opens a right drawer: Call button, Open conversation, status segmented control, summary, details collected, activity timeline, private notes, Delete lead. Export CSV.
4. **Assistant (builder, one screen)** — top bar: back, avatar, name, status line, "Draft saved", **Publish** (runs the required checks first). Left: underline tabs, editor scrolls on its own; right: **Preview** always full height.
   - *Instructions:* name, business name, description; Your business (offer, contact and hours, website); How it works (its job, voice and style); rule lists Always / Never / Hand off when / Contact details to collect (one input per line, Enter adds, ✕ removes); privacy notice said before asking for contact details; fallback reply; advanced: detailed playbook (long Markdown), model and reply length.
   - *Sources:* Knowledge (text or web page, on/off switch, edit in a drawer, Corrected answers from fixes), Data it can look up (tables on/off, "Manage in Data"), Live lookups (advanced).
   - *Follow-ups:* up to 2 automatic nudges inside Meta's 24-hour window (wait time, condition, exact text, "Show in Preview"), "Contact again" in Needs attention after 24 h, and the stop rules.
   - *Behavior:* mark as seen, typing dots, split long replies, reply length (max sentences), reply pace, AI notice on the first reply, what to say outside business hours.
   - *Checks:* answer checks — a sample customer question plus what a right answer must say or do. Each shows its source (Added at setup / Added by you / From Fix this answer), a Required switch (required checks must pass before Publish), Add check, Test all.
   - *Versions:* published versions, Live badge, Restore (new chats only).
   - *Preview:* chat like a customer (starter buttons), shows Seen → typing dots → reply parts at the chosen pace. Each reply has Copy, "N sources · N rows" (what it read and looked up; tap to edit that source or row) and **Fix this answer**.
5. **Fix this answer** (sheet, 3 steps) — what it should have said → where to fix it (suggested place with a before/after diff: a Data row, Corrected answers or an Instructions line; "Choose another place") → it re-asks the draft: "Fixed and protected" (saved as a required check) or "Not applied — the check still fails" with Try another fix / Keep it anyway. Data fixes go live at once; other fixes need Publish.
6. **Data** — list of tables (rows, used by, updated, show hidden tables), New table. Table page: breadcrumb, "N in use · N rows · Used by", search, chips (All / Active / Scheduled / Ended or off), rows with availability ("Always" or Starts/Ended badge), Import CSV, Add row, Rename, Hide. Row opens a right drawer: Active switch, Starts/Ends dates, fields, Delete row.
7. **Conversations** — full-height split: list (search, chips All / Leads / Your team, avatar with channel logo, preview, tags) and thread (customer = gray bubble on the right, assistant = plain text with Copy and Fix this answer), "Your team replies" switch that pauses the assistant, ••• menu: use the live version in this chat, export or erase the customer's data.
8. **Channels** — Connected list (platform logo, "Messenger via Zernio", Answered by, opens a drawer with name, key/address or account, turn off), "Replies not delivered" with Retry when something failed, platform grid to add Messenger / Instagram / WhatsApp / Telegram / TikTok (through Zernio), API or Webhook.
9. **Settings** — Appearance (System/Light/Dark), Workspace (name, logo, chat color, help page), AI connection (Anthropic key, check, advanced Cloudflare IDs), Messaging platforms (Zernio status + Manage), Backup download, Sign out.

### Out of scope — do not propose
Multiple assistants or an Assistants page, sign-up, billing, onboarding wizards, SMS or email alerts, password reset by email, new settings, new data fields, or anything that needs a backend change. Do not invent business facts, prices or customer text.

### What I want back
A list grouped by page, highest impact first. For each item:
- **Where** (page › area) and **what is wrong now** (one line, point at the screenshot);
- **Change** — concrete: spacing in px, token or class to use (e.g. `--color-text-2`, `.btn-ghost`, `.card-head`), copy text, alignment, state;
- **Why** — the user problem it solves;
- **Effort** — S / M.
Also call out anything inconsistent between pages (same thing styled or named differently), any text that fails AA, touch targets under 44 px on phone, and missing empty / loading / error states. Keep it to the 25 most valuable items.
