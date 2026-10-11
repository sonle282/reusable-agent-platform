# Port the v2 design system to the live admin (master prompt)

Audit of https://agent.mrspainc.com on 2026-10-11 18:57 (Asia/Saigon). The features of v2.1 are live (sign-in, Leads, Behavior, Follow-ups, Fix this answer), but the **look is still v1 (Apple)**. `docs/CURRENT-STATE.md` already says: "The v2 visual redesign (`docs/product/design-v2/`) is not ported."

## What the audit found

| Area | Live today | Target (design) |
|---|---|---|
| Tokens | `src/client/styles.css` header says "source: docs/product/design/styles.css" (v1). Ground `#F2F2F7`, blue tint `#0071E3`, `--color-label*`, `--color-separator` | `docs/product/design-v2.1/styles.css` (v2 + v2.1): white/near-black grounds, monochrome primary, `--color-text*`, `--color-border*`, pastels, `--gradient-soft` |
| Font | `-apple-system, "SF Pro Text", Inter…`; `index.html` loads **Inter** | **Manrope** 400–800 (`index.html`), `--font-sans` from the token file |
| Buttons | `btn-filled / btn-tinted / btn-gray / btn-plain` | `btn-primary / outline / soft / ghost / danger / danger-ghost / link`, pill radius, sizes sm/md/lg/xl |
| Containers | `Section` inset grouped cards (`section-card`, `section-header`) | `Card` (head / body / foot), full-width row dividers |
| Inputs | `FieldRow` label-left inline | `Field` label above; `Switch` 32×19 instead of iOS `Toggle` |
| Missing primitives | — | `Tabs` (underline), `Chips`, `Table`, `Drawer` (right 480), `Dialog`, `AgentAvatar` (pastel square), `BrandLogo` (platform marks), `TypingDots`, `LeadStatus` |
| Icons | SF-style stroke icons | Apps SDK UI filled glyphs from `docs/product/design-v2/reference/Icons.dc.html` (keep `Icon` API) |
| Sidebar | "Assistant" (singular), no workspace button, no assistant quick list | Workspace button, nav, "Assistants" heading with the one assistant (avatar + status dot), account row |
| Builder | Tabs + "Chat like a customer" preview — check it is one screen | One screen: 56 px top bar, editor scrolls alone (max 680), Preview 440 full height with Test scenarios bar + composer always visible |
| Test scenarios | Under Settings › "Answer checks" | Also in the Preview's Test scenarios bar (keep the Settings entry as the full list) |
| Data | List and the first table shown together ("Tables \| Mr Spa Policies") | `/data` = tables list only; `/data/:tableId` = records page with breadcrumb, chips, table, row **Drawer** |
| Channels (`#/connections`) | Rows: Freedom Business, Generic API smoke test, Zernio inbox, Webhook, API | Card with brand logos per platform (Simple Icons, CC0) + "Answered by"; platform grid; route renamed `#/channels` (keep `#/connections` as a redirect) |
| Settings | AI, Brand, Appearance, Answer checks, Backup | Same sections in v2 cards + **Messaging platforms** (Zernio status + Manage) |
| Theme | System/Light/Dark exists | Keep; dark tokens from the v2 file (ChatGPT dark) |

## Prompt to paste into Claude Code

```
Port the v2 design system to the live admin. Features stay exactly as they are; only the look and the layout change.

Read first, in this order:
1. docs/product/design-v2/PORT-MASTER-PROMPT.md (this audit: what is live vs. the target)
2. docs/product/design-v2/HANDOFF.md (v2 components, layouts, breakpoints, acceptance)
3. docs/product/design-v2.1/HANDOFF.md and design-v2.1/styles.css (v2 tokens + v2.1 additions: auth, Leads, Follow-ups, Behavior, typing dots). Use design-v2.1/styles.css as the single token/component source.
4. The reference screens in docs/product/design-v2/reference/ and design-v2.1/reference/ (.dc.html: ignore <x-dc>/<sc-if>/<sc-for>, use markup, class names and renderVals logic).

Rules:
- KISS / Mr Spa first: no new product features. Do not add the multi-assistant Assistants page, sign-up, billing, SMS or onboarding. Keep the single assistant; show it in the sidebar "Assistants" list (avatar + status dot) and keep its route.
- Production is live for Mr Spa (version v8 on the Freedom Business page). Do not change API behaviour, data, migrations, published versions, prompts or the runtime. UI only.
- No OpenAI logo, name or OpenAI Sans. Manrope via Google Fonts. Keep the Apps SDK UI MIT notice for the icons.
- Every color/size/radius from tokens. Light, dark and System must work. AA contrast.

Phases, one commit each, `npm run ci` green after each:
0. Tokens + font: replace the token section of src/client/styles.css with design-v2.1/styles.css §1–1c (light, dark, `prefers-color-scheme` mirror for System), add Manrope to index.html, remove Inter/SF. Keep the `:where(.app)` zero-specificity reset.
1. Primitives in ui.tsx: Button variants (map filled→primary, tinted→soft, gray→outline, plain→ghost, destructive→danger-ghost), Card (replaces Section), Row, Field (label above), Switch (replaces Toggle), Segmented, Tabs, Chips, SearchField, Badge, Alert (was Banner), Table, Sheet, Drawer, Dialog, Menu, EmptyState, Skeleton, Spinner, toast, AgentAvatar, BrandLogo, TypingDots, LeadStatus. Swap Icon glyphs to the sprite in design-v2/reference/Icons.dc.html (fill, same API). Delete v1 classes that no longer exist.
2. Shell: sidebar per v2 (workspace button, nav with counts, Assistants heading with the single assistant, account row), container-query breakpoints ≥1080 / 860–1079 icon rail / <860 tab bar (6 items: Home, Leads, Assistant(s), Chats, Channels, Settings; Data reachable from Home and the builder). Rename route #/connections → #/channels with a redirect.
3. Pages, restyled to the references, same data and handlers: Sign in + Setup (PAuth, Mr Spa mode), Home, Leads (+ drawer), Builder one screen (Instructions · Sources · Follow-ups · Behavior · Versions + Preview with Seen → typing dots → reply and the Test scenarios bar), Data list (#/data) and records page (#/data/:tableId, row Drawer — keep the existing #/data/<table>/<row> deep links working), Conversations (full-height split), Channels (brand logos, Answered by, platform grid), Settings (+ Messaging platforms card), Fix this answer sheet.
4. Verify: run the app locally, take Playwright screenshots of every page at 1440×900, 1080×800 and 390×844, light and dark, and compare side by side with the reference .dc.html (render them the same way). Fix differences. Check: builder composer visible without scrolling at 1440×900 and 1280×720; no horizontal scroll at 390; focus rings, switches and dialogs keyboard-usable; Vietnamese renders in Manrope.

When done: deploy as usual, update docs/CURRENT-STATE.md (remove "v2 visual redesign is not ported", list the commits), and report the acceptance checklist from design-v2/HANDOFF.md with the screenshots you compared.
```
