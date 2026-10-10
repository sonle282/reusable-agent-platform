# Design brief — Agent Builder admin UI (dán vào Claude chat)

**Cách dùng:**
1. Mở Claude chat, tạo cuộc trò chuyện mới.
2. Dán nguyên phần **PROMPT** bên dưới.
3. Đính kèm 4–6 ảnh chụp màn hình app hiện tại: Home, Assistant › Test, Assistant › Instructions, Data, Conversations, Settings. Trên Windows bấm Win+Shift+S để chụp.
4. Duyệt bản thiết kế Claude đưa ra, bằng mắt và bằng tay.
5. Khi ưng, tải hoặc copy file HTML cuối cùng vào `docs/product/design/` (hoặc dán link artifact) và báo Claude Code: "follow the design in docs/product/design/". Claude Code sẽ dựng đúng theo đó vào app thật.

---

## PROMPT

You are a senior product designer (Apple-calibre: iOS/macOS Human Interface Guidelines, SF Symbols, System Settings–level polish). Redesign the admin UI of my product so it looks and feels like a first-party Apple app — calm, precise, generous whitespace, perfect alignment, consistent rhythm. Today it is functional but does not look like a professional designer made it.

### The product
- **What it is:** an "AI assistant builder" for small businesses of any industry. The owner sets up one AI assistant that answers their customers on chat channels (website/app via API, a Zernio inbox for Facebook Messenger). It replaces a page-inbox / front-desk / sales staff member.
- **Who uses the admin:** a non-technical business owner, often busy, on a laptop or a phone. One admin per business, one assistant per business. UI language: English.
- **Principles:** KISS, fewest steps, plain words (no "tool", "eval", "prompt", "LLM"), one primary action per screen, warnings only when something needs action, always a next step.

### Navigation (keep this information architecture)
Sidebar on desktop, tab bar on phone, 6 items, each with an SF Symbols–style outline icon (keep this icon style):
1. **Home** (house): today's numbers + assistant status + recent conversations. Metrics live ONLY here, never on the configuration pages.
2. **Assistant** (sparkles): configuration, with a segmented control:
   - **Test:** chat with the draft. Tap a reply to see "Details": which knowledge and data rows it used; tap one to edit it.
   - **Instructions:** short form sections: Your business · Your assistant's job · Voice and style · Always · Never · Hand off to a person when · Contact details to collect. A collapsed "Detailed playbook (advanced)" holds a long expert prompt (up to 33,000 characters). A side column holds name, fallback reply, and a collapsed Advanced section (model, max tokens).
   - **Sources:** knowledge sources (title, status, Edit, on/off switch) + data tables the assistant may look up (on/off switch) + collapsed "Live lookups (advanced)".
   - **Versions:** published versions, Live badge, Restore.
   - Header shows the assistant name, "Live · version 3" and one primary button: **Publish** (disabled as "Published" when nothing changed). Drafts autosave.
3. **Data** (table): tables like Products and Offers. Master list of tables + detail table of rows. Tap a row opens an edit sheet with Active / Starts / Ends. Actions: Add, Import CSV, Rename, Hide table. Hidden tables collapse at the bottom.
4. **Conversations** (two speech bubbles): searchable list + transcript with chat bubbles, and a "Your team replies" switch that pauses the assistant.
5. **Channels** (link): API / Webhook / Zernio connections with status; "Replies not delivered" list with Retry only when something failed.
6. **Settings** (gear): AI key (+ collapsed Cloudflare IDs), Brand (name, accent color, logo, support page), Backup download, Sign out.

### Planned next feature (design it too)
**Fix this answer**, opened from a reply in Test or Conversations. One sheet, three steps:
1. The owner types what it should have said.
2. The AI suggests one place to fix it — update a data row, add to "Corrected answers" knowledge, or add a line to the instructions — showing a before/after diff. A "Choose another place" option is available.
3. "Fixed and protected": a scenario is saved automatically. If the check fails, the change is not applied and the owner can choose "Try another fix" or "Keep it anyway".

Plus a **Needs attention** list on Home with these items, each with Fix / Open conversation / Dismiss (reason):
- Your team is replying.
- Sent the backup reply.
- Price question without a lookup.
- New lead to contact.
- Data request.

### Visual system constraints
- **Typography:** system font stack (-apple-system / SF Pro). Large titles 34pt bold on page headers; section headers 13pt uppercase secondary. Body 15–17pt.
- **Color:** Apple system colors with automatic dark mode — systemBlue tint, systemGreen / Orange / Red for state. Grouped background #F2F2F7, cells #FFFFFF; dark mode #000 and #1C1C1E. Brand accent only for the app icon.
- **Components:**
  - Inset grouped lists: 44pt rows, hairline separators inset 16pt (or 56pt after an icon), icon tiles 28pt rounded 7pt in system colors.
  - Segmented control, iOS switches, sheets (centered on desktop, bottom sheet on phone), capsule badges, search field.
  - Buttons: filled, tinted, gray, plain, destructive.
- **Spacing:** 8pt grid; max content width around 1100px; split views where it helps (master/detail).
- **Behaviour:** no horizontal scrolling on phone (tables become rows); visible focus; 44pt touch targets; reduced motion respected.

### What I want back
1. **One self-contained HTML file** (inline CSS + vanilla JS, no external libraries) that is a clickable prototype of all 6 pages, plus the Fix sheet and Needs attention.
   - Use realistic example data, labelled "Example".
   - Light and dark mode.
   - It must work when opened directly as a file. Include `<meta charset="utf-8">`, and a `[hidden]{display:none!important}` rule if you use the hidden attribute.
2. **All design tokens as CSS custom properties** at the top (colors for light and dark, type scale, spacing, radii, shadows). They are used everywhere, with no hard-coded colors in components.
3. **A short spec section at the end of the HTML** (or a separate Markdown block) listing:
   - each component with its exact measurements (height, padding, radius, font size and weight);
   - each screen's layout at desktop (≥1080px), tablet (~860px) and phone (~390px) widths;
   - empty, loading and error states for each screen.
4. **Show me 2 visual directions side by side first** (for example "System Settings–style" and "Notes/Reminders–style") before polishing one, so I can choose by looking.

Ask me at most 2 clarifying questions, then start.

---

## Ghi chú cho Claude Code khi nhận bản thiết kế
- Map token của bản thiết kế vào `src/client/styles.css` (`:root` + dark). Không giữ hai bộ token song song.
- Map thành phần vào `src/client/ui.tsx`: `Button`, `Section`, `Row`, `FieldRow`, `Toggle`, `Segmented`, `Sheet`, `Badge`, `Banner`, `SearchField`, `EmptyState`. Không fork component mới cho cùng một vai.
- Giữ bộ icon kiểu SF Symbols trong `Icon` (`ui.tsx`). Icon mới vẽ cùng lưới 24px, nét 1.6.
- Giữ nguyên luồng, API và luật dữ liệu. Thiết kế chỉ đổi lớp giao diện.
