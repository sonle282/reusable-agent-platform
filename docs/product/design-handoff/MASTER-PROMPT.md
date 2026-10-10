# Master prompt — paste into a new Claude chat

**Đính kèm các file trong thư mục này** (`docs/product/design-handoff/`):
- `product-context.md`
- `current-ui-source.md`
- `fix-this-answer-prototype.html`
- 10 ảnh trong `screenshots/`
- tuỳ chọn: `01-prd.md`, `02-ux-flow.md`, `03-ui-spec.md` (đã có sẵn trong thư mục này)

Rồi copy toàn bộ khối dưới đây.

---

```text
You are a senior product designer at Apple level (Human Interface Guidelines, SF Symbols, System Settings / Notes / Reminders polish). I'm attaching everything about the admin UI of my product:
- product-context.md: product, users, principles, information architecture, the planned "Fix this answer" feature, my own audit of the current UI, and implementation constraints.
- current-ui-source.md: the current React + CSS source (tokens, primitives, every page).
- 10 screenshots of the live app (desktop, light mode).
- fix-this-answer-prototype.html: a rough clickable prototype of the planned feature.

Work in three rounds and stop after each round for my answer.

ROUND 1 — Review (no design yet)
1. Inspect the screenshots and the source. Give a prioritised critique: the 10 most important problems, each with the screen, what's wrong, and why it breaks Apple-quality craft. Confirm, refute or extend my audit in product-context.md section 6.
2. Say what you would keep (what already works).
3. Ask me at most 3 questions you need answered before designing.

ROUND 2 — Two directions
Build ONE self-contained HTML file (inline CSS + vanilla JS, no external libraries or fonts beyond a Google Fonts link if you choose one). It shows two visual directions side by side or behind a toggle, for the same two screens: Home and Assistant › Test with Details open. Use the real content from the screenshots. Include light and dark mode. The file must work when opened directly: include <meta charset="utf-8"> and a [hidden]{display:none!important} rule if you use the hidden attribute. I will pick one direction.

ROUND 3 — Full design for the chosen direction
Deliver ONE self-contained HTML file that is a clickable prototype of the whole admin:
- All 6 pages (Home, Assistant with Test / Instructions / Sources / Versions, Data, Conversations, Channels, Settings).
- The "Fix this answer" sheet (3 steps, including the failing path and "Keep it anyway").
- Needs attention on Home.
- Empty, loading and error states reachable from a small "State" switcher in the prototype.
- Desktop (≥1080px) and phone (~390px) layouts. Sidebar becomes a tab bar under 860px.
- Light and dark mode.
- SF Symbols–style outline icons drawn as inline SVG on a 24-unit grid, 1.6 stroke.
- All design tokens as CSS custom properties at the top (colors light/dark, type scale, spacing, radii, shadows, motion). No hard-coded colors in components.
- At the end of the file, a "Spec" section listing every primitive (Button variants and sizes, Section, Row, FieldRow, Toggle, Segmented, SearchField, Badge, Banner, Sheet, EmptyState, toast) with exact measurements, and every screen's layout per breakpoint.

Keep the information architecture, the copy principles (plain English, one primary action per screen, warnings only with a next step), and the primitives listed in product-context.md section 7, so the result can be implemented directly onto the existing code. Use realistic data from the screenshots and mark it "Example".
```

---

**Sau vòng 3:** tải file HTML cuối về `docs/product/design/` (hoặc dán link artifact), rồi nhắn Claude Code: **"follow the design in docs/product/design/"**.
