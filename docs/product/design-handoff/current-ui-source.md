# Current admin UI source (React + plain CSS)

Design system lives in `styles.css` (tokens + components) and `ui.tsx` (primitives and SF Symbols–style icons). Pages compose those primitives.

## `src/client/styles.css`

```css
/* Apple Human Interface Guidelines, translated to the web:
   system font stack, semantic system colors with dark mode, inset grouped lists,
   44pt touch targets, 8pt spacing grid, restrained motion. */

:root {
  color-scheme: light dark;
  --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI Variable Text", "Segoe UI", system-ui, "Helvetica Neue", Arial, sans-serif;
  --mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;

  --tint: #007aff;
  --tint-hover: #0068d9;
  --tint-soft: rgba(0, 122, 255, 0.12);
  --blue: #007aff;
  --green: #34c759;
  --orange: #ff9500;
  --red: #ff3b30;
  --purple: #af52de;
  --indigo: #5856d6;
  --teal: #30b0c7;
  --gray: #8e8e93;

  --bg: #f2f2f7;
  --bg-elevated: #ffffff;
  --bg-secondary: #ffffff;
  --fill: rgba(120, 120, 128, 0.12);
  --fill-strong: rgba(120, 120, 128, 0.2);
  --label: #1d1d1f;
  --label-secondary: rgba(60, 60, 67, 0.6);
  --label-tertiary: rgba(60, 60, 67, 0.3);
  --separator: rgba(60, 60, 67, 0.18);
  --sidebar: rgba(246, 246, 248, 0.82);
  --bubble-in: #e9e9eb;
  --shadow-sheet: 0 24px 64px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.06);

  --radius: 12px;
  --radius-small: 8px;
  --ease: cubic-bezier(0.25, 0.1, 0.25, 1);
}

@media (prefers-color-scheme: dark) {
  :root {
    --tint: #0a84ff;
    --tint-hover: #409cff;
    --tint-soft: rgba(10, 132, 255, 0.2);
    --blue: #0a84ff;
    --green: #30d158;
    --orange: #ff9f0a;
    --red: #ff453a;
    --purple: #bf5af2;
    --indigo: #5e5ce6;
    --teal: #40c8e0;
    --gray: #98989d;

    --bg: #000000;
    --bg-elevated: #1c1c1e;
    --bg-secondary: #1c1c1e;
    --fill: rgba(118, 118, 128, 0.24);
    --fill-strong: rgba(118, 118, 128, 0.36);
    --label: #f5f5f7;
    --label-secondary: rgba(235, 235, 245, 0.6);
    --label-tertiary: rgba(235, 235, 245, 0.3);
    --separator: rgba(84, 84, 88, 0.6);
    --sidebar: rgba(28, 28, 30, 0.78);
    --bubble-in: #26252a;
    --shadow-sheet: 0 24px 64px rgba(0, 0, 0, 0.6);
  }
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  min-height: 100%;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--label);
  font: 400 15px/1.4 var(--font);
  letter-spacing: -0.01em;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

button,
input,
select,
textarea {
  font: inherit;
  color: inherit;
  letter-spacing: inherit;
}

button {
  cursor: pointer;
}

button:disabled {
  cursor: default;
}

a {
  color: var(--tint);
  text-decoration: none;
}

code,
pre {
  font-family: var(--mono);
  font-size: 0.86em;
}

:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--tint) 55%, transparent);
  outline-offset: 2px;
  border-radius: 6px;
}

.icon {
  flex: none;
}

.text-secondary {
  color: var(--label-secondary);
}

.text-red {
  color: var(--red);
}

.text-tint {
  color: var(--tint);
}

.center {
  text-align: center;
}

.nowrap {
  white-space: nowrap;
}

.caption {
  color: var(--label-secondary);
  font-size: 13px;
  font-weight: 400;
}

/* ---------- App layout ---------- */

.app {
  display: grid;
  grid-template-columns: 232px minmax(0, 1fr);
  min-height: 100vh;
}

.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 10px;
  background: var(--sidebar);
  backdrop-filter: saturate(180%) blur(24px);
  -webkit-backdrop-filter: saturate(180%) blur(24px);
  border-right: 0.5px solid var(--separator);
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 10px 16px;
  font-size: 15px;
}

.sidebar-brand b {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar nav {
  display: grid;
  gap: 2px;
}

.sidebar nav button {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 34px;
  padding: 6px 10px;
  border: 0;
  border-radius: var(--radius-small);
  background: transparent;
  color: var(--label);
  font-size: 14px;
  text-align: left;
  transition: background 120ms var(--ease);
}

.sidebar nav button .icon {
  color: var(--tint);
}

.sidebar nav button:hover {
  background: var(--fill);
}

.sidebar nav button.active {
  background: var(--fill-strong);
  font-weight: 600;
}

.sidebar-footer {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
  color: var(--label-secondary);
  font-size: 12px;
}

.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--gray);
}

.live-dot.on {
  background: var(--green);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--green) 25%, transparent);
}

.content {
  min-width: 0;
  padding: 0 32px 64px;
}

.tab-bar {
  display: none;
}

.page {
  max-width: 1120px;
  margin: 0 auto;
}

.page.narrow {
  max-width: 720px;
}

.page-loading {
  display: grid;
  place-items: center;
  padding: 48px;
}

.page-loading.full {
  min-height: 100vh;
}

/* ---------- Page header ---------- */

.page-header {
  padding: 36px 0 16px;
}

.page-header-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.large-title {
  margin: 0;
  font-size: 32px;
  line-height: 1.15;
  font-weight: 700;
  letter-spacing: -0.025em;
}

.page-subtitle {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 6px 0 0;
  color: var(--label-secondary);
  font-size: 15px;
  max-width: 68ch;
}

.page-actions,
.inline-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin: 0 0 8px -6px;
  padding: 4px 6px;
  border: 0;
  background: none;
  color: var(--tint);
  font-size: 15px;
}

.save-state {
  font-size: 13px;
}

.toolbar {
  display: flex;
  justify-content: flex-start;
  margin: 4px 0 20px;
  overflow-x: auto;
}

/* ---------- Buttons ---------- */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  padding: 6px 14px;
  border: 0;
  border-radius: var(--radius-small);
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  transition: background 120ms var(--ease), opacity 120ms var(--ease), transform 80ms var(--ease);
}

.btn:active:not(:disabled) {
  transform: scale(0.98);
}

.btn:disabled {
  opacity: 0.4;
}

.btn-small {
  min-height: 28px;
  padding: 4px 10px;
  font-size: 13px;
  border-radius: 7px;
}

.btn-large {
  min-height: 44px;
  padding: 10px 22px;
  font-size: 16px;
  font-weight: 600;
  border-radius: var(--radius);
}

.btn-filled {
  background: var(--tint);
  color: #fff;
}

.btn-filled:hover:not(:disabled) {
  background: var(--tint-hover);
}

.btn-tinted {
  background: var(--tint-soft);
  color: var(--tint);
}

.btn-gray {
  background: var(--fill);
  color: var(--label);
}

.btn-gray:hover:not(:disabled),
.btn-tinted:hover:not(:disabled) {
  background: var(--fill-strong);
}

.btn-plain {
  background: transparent;
  color: var(--tint);
  padding-inline: 6px;
}

.btn-destructive {
  background: var(--red);
  color: #fff;
}

.icon-button {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 50%;
  background: var(--fill);
  color: var(--label-secondary);
}

.icon-button:disabled {
  opacity: 0.35;
}

.spinner {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2.5px solid var(--fill-strong);
  border-top-color: var(--label-secondary);
  animation: spin 0.8s linear infinite;
}

.spinner.small {
  width: 14px;
  height: 14px;
  border-width: 2px;
  border-color: color-mix(in srgb, currentColor 25%, transparent);
  border-top-color: currentColor;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ---------- Inset grouped lists ---------- */

.section {
  margin: 0 0 28px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 28px;
  padding: 0 16px 6px;
}

.section-header h2 {
  margin: 0;
  color: var(--label-secondary);
  font-size: 13px;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.section-footer {
  margin: 6px 16px 0;
  color: var(--label-secondary);
  font-size: 13px;
  line-height: 1.4;
}

.inset-group {
  overflow: hidden;
  background: var(--bg-secondary);
  border-radius: var(--radius);
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 44px;
  padding: 8px 16px;
  border: 0;
  background: transparent;
  text-align: left;
  position: relative;
}

.inset-group > .row + .row::before,
.inset-group > .row + details::before,
.inset-group > details + .row::before,
.inset-group > details + details::before {
  content: "";
  position: absolute;
  top: 0;
  left: 16px;
  right: 0;
  border-top: 0.5px solid var(--separator);
}

.inset-group > .row:has(.row-icon) + .row::before {
  left: 56px;
}

.row-button {
  color: inherit;
  transition: background 100ms var(--ease);
}

.row-button:hover {
  background: var(--fill);
}

.row.selected {
  background: var(--tint-soft);
}

.row-icon {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: var(--gray);
  color: #fff;
}

.row-text {
  display: grid;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.row-title {
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.row-subtitle {
  color: var(--label-secondary);
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-text.multiline .row-subtitle {
  white-space: normal;
}

.row-detail {
  color: var(--label-secondary);
  font-size: 15px;
  white-space: nowrap;
}

.row > .icon:last-child {
  color: var(--label-tertiary);
}

.row-actions {
  justify-content: flex-end;
  gap: 8px;
}

.field-row {
  cursor: default;
}

.field-label {
  display: grid;
  flex: none;
  width: 38%;
  max-width: 220px;
  font-size: 15px;
}

.field-label small {
  color: var(--label-secondary);
  font-size: 12px;
}

.field-control {
  flex: 1;
  display: flex;
  justify-content: flex-end;
  min-width: 0;
}

.field-row.stacked {
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  padding-block: 10px;
}

.field-row.stacked .field-label {
  width: auto;
  max-width: none;
  color: var(--label-secondary);
  font-size: 13px;
}

.field-row.stacked .field-control {
  justify-content: stretch;
}

.text-input,
.select,
.text-area {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--label);
  font-size: 15px;
  outline: none;
}

.field-row:not(.stacked) .text-input,
.field-row:not(.stacked) .select {
  text-align: right;
  color: var(--label-secondary);
}

.field-row:not(.stacked) .text-input:focus {
  color: var(--label);
}

.text-input::placeholder,
.text-area::placeholder {
  color: var(--label-tertiary);
}

.text-input:disabled {
  opacity: 0.4;
}

.field-row.stacked .text-input,
.text-area {
  padding: 8px 10px;
  border-radius: var(--radius-small);
  background: var(--fill);
}

.text-area {
  resize: vertical;
  line-height: 1.45;
}

.select {
  appearance: none;
  padding-right: 18px;
  background: transparent url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='14' fill='none' stroke='%238e8e93' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2 5l3-3 3 3M2 9l3 3 3-3'/%3E%3C/svg%3E") right center no-repeat;
  cursor: pointer;
}

.select option {
  color: initial;
}

.color-input {
  width: 44px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: none;
  cursor: pointer;
}

.field-editor {
  gap: 10px;
}

.field-editor .text-input {
  flex: 1;
  padding: 6px 10px;
  border-radius: var(--radius-small);
  background: var(--fill);
}

.field-editor .select {
  width: 150px;
  flex: none;
}

/* ---------- Controls ---------- */

.toggle {
  position: relative;
  flex: none;
  width: 51px;
  height: 31px;
  padding: 0;
  border: 0;
  border-radius: 31px;
  background: var(--fill-strong);
  transition: background 200ms var(--ease);
}

.toggle span {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 27px;
  height: 27px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15), 0 1px 1px rgba(0, 0, 0, 0.16);
  transition: transform 200ms var(--ease);
}

.toggle.on {
  background: var(--green);
}

.toggle.on span {
  transform: translateX(20px);
}

.toggle:disabled {
  opacity: 0.4;
}

.segmented {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: 9px;
  background: var(--fill);
}

.segmented button {
  min-height: 28px;
  padding: 4px 14px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--label);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  transition: background 150ms var(--ease), box-shadow 150ms var(--ease);
}

.segmented button.active {
  background: var(--bg-elevated);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12), 0 1px 1px rgba(0, 0, 0, 0.04);
  font-weight: 600;
}

@media (prefers-color-scheme: dark) {
  .segmented button.active {
    background: #636366;
  }
}

.search-field {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 10px;
  margin-bottom: 12px;
  border-radius: 10px;
  background: var(--fill);
  color: var(--label-secondary);
}

.search-field.compact {
  margin: 0;
  min-height: 30px;
  width: 180px;
}

.search-field input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--label);
  outline: none;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.badge-gray {
  background: var(--fill);
  color: var(--label-secondary);
}

.badge-green {
  background: color-mix(in srgb, var(--green) 16%, transparent);
  color: color-mix(in srgb, var(--green) 70%, var(--label));
}

.badge-orange {
  background: color-mix(in srgb, var(--orange) 16%, transparent);
  color: color-mix(in srgb, var(--orange) 75%, var(--label));
}

.badge-red {
  background: color-mix(in srgb, var(--red) 14%, transparent);
  color: var(--red);
}

.badge-blue {
  background: var(--tint-soft);
  color: var(--tint);
}

.banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0 0 20px;
  padding: 12px 14px;
  border-radius: var(--radius);
  font-size: 14px;
  line-height: 1.45;
}

.banner > div {
  flex: 1;
  white-space: pre-line;
}

.banner-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.banner-line .btn {
  margin: -4px -6px;
  color: inherit;
  font-weight: 600;
}

.banner .icon {
  margin-top: 1px;
}

.banner-red {
  background: color-mix(in srgb, var(--red) 11%, var(--bg-secondary));
  color: color-mix(in srgb, var(--red) 80%, var(--label));
}

.banner-orange {
  background: color-mix(in srgb, var(--orange) 13%, var(--bg-secondary));
  color: color-mix(in srgb, var(--orange) 55%, var(--label));
}

.banner-green {
  background: color-mix(in srgb, var(--green) 13%, var(--bg-secondary));
}

.banner-blue {
  background: var(--tint-soft);
}

.empty-state {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 48px 24px;
  text-align: center;
}

.empty-icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  margin-bottom: 6px;
  border-radius: 50%;
  background: var(--fill);
  color: var(--label-secondary);
}

.empty-state h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}

.empty-state p {
  margin: 0 0 10px;
  max-width: 44ch;
  color: var(--label-secondary);
}

/* ---------- Sheets & toasts ---------- */

.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.32);
  animation: fade 160ms var(--ease);
}

.sheet {
  display: flex;
  flex-direction: column;
  width: min(560px, 100%);
  max-height: min(820px, calc(100vh - 48px));
  border-radius: 14px;
  background: var(--bg);
  box-shadow: var(--shadow-sheet);
  animation: rise 220ms var(--ease);
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px 8px;
}

.sheet-header h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}

.sheet-body {
  overflow: auto;
  padding: 8px 18px 4px;
}

.sheet-body .section {
  margin-bottom: 20px;
}

.sheet-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px 16px;
  border-top: 0.5px solid var(--separator);
}

.sheet-form {
  display: grid;
  gap: 16px;
}

.sheet-form .section {
  margin: 0;
}

.sheet-text {
  margin: 0 0 12px;
  color: var(--label-secondary);
  font-size: 14px;
  line-height: 1.45;
}

.sheet-actions {
  display: grid;
  gap: 8px;
  padding-bottom: 14px;
}

.copy-field {
  display: grid;
  gap: 6px;
  margin-bottom: 14px;
}

.copy-field .field-label {
  width: auto;
  max-width: none;
  color: var(--label-secondary);
  font-size: 13px;
}

.copy-field > div {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 8px 12px;
  border-radius: 10px;
  background: var(--bg-secondary);
}

.copy-field code {
  flex: 1;
  overflow-wrap: anywhere;
}

.code-block {
  margin: 0;
  padding: 12px 14px;
  overflow: auto;
  border-radius: var(--radius);
  background: var(--bg-secondary);
  line-height: 1.5;
}

.toast-region {
  position: fixed;
  left: 50%;
  bottom: 28px;
  z-index: 60;
  transform: translateX(-50%);
  pointer-events: none;
}

.toast {
  padding: 10px 18px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg-elevated) 86%, transparent);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.16);
  font-size: 14px;
  font-weight: 500;
  animation: rise 220ms var(--ease);
}

.toast.error {
  color: var(--red);
}

@keyframes fade {
  from {
    opacity: 0;
  }
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
}

/* ---------- Auth ---------- */

.auth-screen {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: 32px 16px;
}

.auth-panel {
  display: grid;
  justify-items: center;
  width: min(420px, 100%);
  text-align: center;
}

.auth-panel.wide {
  width: min(520px, 100%);
}

.auth-panel > .section,
.auth-panel > .banner,
.auth-panel > .segmented {
  width: 100%;
  text-align: left;
}

.auth-panel > .segmented {
  margin-bottom: 20px;
  display: flex;
}

.auth-panel > .segmented button {
  flex: 1;
}

.auth-panel h1 {
  margin: 18px 0 6px;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.auth-lead {
  margin: 0 0 24px;
  max-width: 40ch;
  color: var(--label-secondary);
}

.step-label {
  margin: 16px 0 -10px;
  color: var(--label-secondary);
  font-size: 13px;
}

.auth-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  width: 100%;
}

.auth-actions .btn {
  flex: 1;
  max-width: 240px;
}

.app-icon {
  display: inline-grid;
  place-items: center;
  flex: none;
  overflow: hidden;
  color: #fff;
  box-shadow: 0 0 0 0.5px var(--separator), 0 6px 16px rgba(0, 0, 0, 0.1);
}

.app-icon img {
  width: 82%;
  height: 82%;
  object-fit: contain;
}

/* ---------- Assistant ---------- */

.split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 24px;
  align-items: start;
}

.editor {
  display: block;
  width: 100%;
  min-height: 62vh;
  padding: 16px;
  border: 0;
  background: transparent;
  color: var(--label);
  font: 14px/1.6 var(--mono);
  resize: vertical;
  outline: none;
}

.test-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 24px;
  align-items: start;
  margin-bottom: 28px;
}

.chat-window {
  display: flex;
  flex-direction: column;
  height: min(680px, 72vh);
  overflow: hidden;
  border-radius: var(--radius);
  background: var(--bg-secondary);
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 0.5px solid var(--separator);
}

.chat-header div {
  display: grid;
}

.chat-header span {
  color: var(--label-secondary);
  font-size: 12px;
}

.chat-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chat-window .banner {
  margin: 0 12px 8px;
}

.message-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-width: 78%;
  padding: 0;
  border: 0;
  background: none;
  text-align: left;
}

.message-row.user {
  align-self: flex-end;
  align-items: flex-end;
}

.message-row.assistant {
  align-self: flex-start;
  align-items: flex-start;
}

button.message-row {
  border-radius: 20px;
}

button.message-row.selected .bubble.assistant {
  box-shadow: 0 0 0 2px var(--tint);
}

.message-row time {
  padding: 0 10px;
  color: var(--label-tertiary);
  font-size: 11px;
}

.bubble {
  padding: 8px 13px;
  border-radius: 18px;
  font-size: 15px;
  line-height: 1.38;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.bubble p {
  margin: 0;
}

.bubble.user {
  background: var(--tint);
  color: #fff;
  border-bottom-right-radius: 6px;
}

.bubble.assistant {
  background: var(--bubble-in);
  color: var(--label);
  border-bottom-left-radius: 6px;
  margin-bottom: 2px;
}

.bubble.media {
  padding: 0;
  overflow: hidden;
  width: 240px;
}

.bubble.media img {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  background: #fff;
}

.bubble.media p {
  padding: 8px 13px;
}

.bubble-buttons {
  display: grid;
  border-top: 0.5px solid var(--separator);
}

.bubble-buttons a {
  padding: 9px 13px;
  font-size: 14px;
  font-weight: 500;
  text-align: center;
}

.bubble-buttons a + a {
  border-top: 0.5px solid var(--separator);
}

.bubble.typing {
  display: inline-flex;
  gap: 4px;
  padding: 12px 14px;
}

.bubble.typing i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--label-tertiary);
  animation: typing 1.2s infinite ease-in-out;
}

.bubble.typing i:nth-child(2) {
  animation-delay: 0.15s;
}

.bubble.typing i:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes typing {
  0%,
  60%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
    transform: translateY(-3px);
  }
}

.composer {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 12px;
  border-top: 0.5px solid var(--separator);
}

.composer textarea {
  flex: 1;
  max-height: 140px;
  min-height: 36px;
  padding: 7px 14px;
  border: 0.5px solid var(--separator);
  border-radius: 18px;
  background: var(--bg);
  resize: none;
  outline: none;
  field-sizing: content;
}

.send-button {
  display: grid;
  place-items: center;
  flex: none;
  width: 32px;
  height: 32px;
  margin-bottom: 2px;
  border: 0;
  border-radius: 50%;
  background: var(--tint);
  color: #fff;
}

.send-button:disabled {
  opacity: 0.35;
}

.inspector h3 {
  margin: 4px 16px 10px;
  font-size: 17px;
  font-weight: 600;
}

.inspector > p {
  margin: 0 16px;
  font-size: 14px;
}

.inspector .section {
  margin-bottom: 20px;
}

.disclosure {
  position: relative;
}

.disclosure summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 44px;
  padding: 8px 16px;
  cursor: pointer;
  list-style: none;
}

.disclosure summary::-webkit-details-marker {
  display: none;
}

.disclosure summary::after {
  content: "›";
  color: var(--label-tertiary);
  font-size: 20px;
  transition: transform 150ms var(--ease);
}

.disclosure[open] summary::after {
  transform: rotate(90deg);
}

.disclosure summary .text-secondary {
  margin-left: auto;
  font-size: 13px;
}

.disclosure pre {
  max-height: 280px;
  margin: 0;
  padding: 0 16px 14px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.5;
}

.unsaved-dot {
  color: var(--orange);
}

/* ---------- Master / detail ---------- */

.master-detail {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.master {
  position: sticky;
  top: 16px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
}

.master .section {
  margin-bottom: 0;
}

.detail {
  min-width: 0;
}

.detail-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.detail-header h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.detail-header p {
  margin: 2px 0 0;
  font-size: 13px;
}

.table-card {
  overflow: auto;
  border-radius: var(--radius);
  background: var(--bg-secondary);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

th {
  position: sticky;
  top: 0;
  padding: 10px 14px;
  background: var(--bg-secondary);
  color: var(--label-secondary);
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  border-bottom: 0.5px solid var(--separator);
}

td {
  padding: 10px 14px;
  border-bottom: 0.5px solid var(--separator);
  vertical-align: top;
  max-width: 320px;
}

tr:last-child td {
  border-bottom: 0;
}

.transcript {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
  border-radius: var(--radius);
  background: var(--bg-secondary);
}

.mobile-only {
  display: none;
}

/* ---------- Responsive ---------- */

@media (max-width: 1080px) {
  .split,
  .test-layout {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 860px) {
  .app {
    grid-template-columns: minmax(0, 1fr);
  }

  .sidebar {
    display: none;
  }

  .content {
    padding: 0 16px calc(84px + env(safe-area-inset-bottom));
  }

  .tab-bar {
    position: fixed;
    inset: auto 0 0;
    z-index: 40;
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    padding: 6px 4px calc(6px + env(safe-area-inset-bottom));
    background: var(--sidebar);
    backdrop-filter: saturate(180%) blur(24px);
    -webkit-backdrop-filter: saturate(180%) blur(24px);
    border-top: 0.5px solid var(--separator);
  }

  .tab-bar button {
    display: grid;
    justify-items: center;
    gap: 2px;
    min-height: 44px;
    border: 0;
    background: none;
    color: var(--gray);
    font-size: 10px;
    font-weight: 500;
  }

  .tab-bar button.active {
    color: var(--tint);
  }

  .page-header {
    padding-top: 20px;
  }

  .large-title {
    font-size: 28px;
  }

  .page-header-row {
    flex-direction: column;
    align-items: stretch;
  }

  .master-detail {
    grid-template-columns: minmax(0, 1fr);
  }

  .master {
    position: static;
    max-height: none;
  }

  .master-detail:not(.stack).has-detail .master {
    display: none;
  }

  .master-detail:not(.stack):not(.has-detail) .detail {
    display: none;
  }

  .mobile-only {
    display: inline-flex;
  }

  .detail-header {
    flex-direction: column;
    align-items: stretch;
  }

  .search-field.compact {
    width: auto;
    flex: 1;
  }

  .field-label {
    width: 45%;
  }

  .message-row {
    max-width: 88%;
  }

  .sheet-backdrop {
    align-items: end;
    padding: 0;
  }

  .sheet {
    width: 100%;
    max-height: 92vh;
    border-radius: 14px 14px 0 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

tr.clickable {
  cursor: pointer;
  transition: background 100ms var(--ease);
}

tr.clickable:hover,
tr.clickable:focus-visible {
  background: var(--fill);
  outline: none;
}

.advanced > summary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px 10px;
  color: var(--tint);
  font-size: 15px;
  cursor: pointer;
  list-style: none;
}

.advanced > summary::-webkit-details-marker {
  display: none;
}

.advanced > summary::after {
  content: "›";
  font-size: 18px;
  transition: transform 150ms var(--ease);
}

.advanced[open] > summary::after {
  transform: rotate(90deg);
}

.advanced.in-group > summary {
  min-height: 44px;
  padding: 10px 16px;
  border-top: 0.5px solid var(--separator);
}

.text-area.plain {
  display: block;
  padding: 12px 16px;
  border-radius: 0;
  background: transparent;
}

.rule-list {
  display: block;
  padding: 12px 16px;
  border-radius: 0;
  background: transparent;
  line-height: 1.7;
}

.split-main > .advanced,
.split-side > .advanced {
  margin-bottom: 28px;
}

.summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 0 0 20px;
}

.summary-tile {
  display: grid;
  gap: 2px;
  padding: 14px 16px;
  border: 0;
  border-radius: var(--radius);
  background: var(--bg-secondary);
  text-align: left;
  transition: background 120ms var(--ease);
}

.summary-tile:hover {
  background: color-mix(in srgb, var(--bg-secondary) 85%, var(--fill-strong));
}

.summary-value {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.summary-label {
  font-size: 14px;
  font-weight: 500;
}

.summary-hint {
  color: var(--label-secondary);
  font-size: 12px;
}

.summary-tile.placeholder {
  min-height: 94px;
  background: var(--fill);
}

.summary-tile.orange .summary-value {
  color: var(--orange);
}

.summary-tile.red .summary-value {
  color: var(--red);
}

.trace-group + .trace-group {
  border-top: 0.5px solid var(--separator);
}

.trace-group > .row + .row {
  padding-left: 28px;
}

.footer-leading {
  margin-right: auto;
}

.hidden-tables {
  margin-top: 12px;
}

@media (max-width: 860px) {
  .summary {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

## `src/client/ui.tsx`

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

// Outline glyphs drawn to sit alongside SF Symbols at 1.6px stroke on a 24px grid.
const glyphs: Record<string, ReactNode> = {
  overview: <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" />,
  assistant: (
    <>
      <path d="M12 3.5l1.6 4.4 4.4 1.6-4.4 1.6L12 15.5l-1.6-4.4L6 9.5l4.4-1.6z" />
      <path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
    </>
  ),
  data: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10" />
    </>
  ),
  conversations: (
    <>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h7A2.5 2.5 0 0 1 16 6.5v4a2.5 2.5 0 0 1-2.5 2.5H9l-3.5 3v-3H6.5A2.5 2.5 0 0 1 4 10.5z" />
      <path d="M16 9h1.5A2.5 2.5 0 0 1 20 11.5v4a2.5 2.5 0 0 1-2.5 2.5H17v2.5L14 18h-2.5A2.5 2.5 0 0 1 9 15.5V15" />
    </>
  ),
  connections: (
    <>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8l1.7 2.3 2.8-.6.6 2.8 2.4 1.6-1.2 2.6 1.2 2.6-2.4 1.6-.6 2.8-2.8-.6L12 21.2l-1.7-2.3-2.8.6-.6-2.8-2.4-1.6L5.7 12 4.5 9.5l2.4-1.6.6-2.8 2.8.6z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  chevron: <path d="M9.5 6l6 6-6 6" />,
  back: <path d="M14.5 6l-6 6 6 6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </>
  ),
  refresh: (
    <>
      <path d="M19 12a7 7 0 1 1-2.05-4.95" />
      <path d="M19 4.5V8h-3.5" />
    </>
  ),
  send: <path d="M12 19V5M6 11l6-6 6 6" />,
  warning: (
    <>
      <path d="M12 4l9 15.5H3z" />
      <path d="M12 10v4M12 17v.01" />
    </>
  ),
  doc: (
    <>
      <path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z" />
      <path d="M14 3.5V8h4M9.5 12h6M9.5 15.5h6" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.3 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.3-3.5-8.5s1-5.9 3.5-8.5z" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />
      <path d="M5 19.5h14" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 19.5c.8-3.4 3.6-5 7-5s6.2 1.6 7 5" />
    </>
  ),
  bolt: <path d="M13 3 5.5 13.5H12L11 21l7.5-10.5H12z" />,
  wrench: <path d="M14.5 5.5a4 4 0 0 0 4.9 4.9L11 18.8a2.1 2.1 0 0 1-3-3l8.4-8.4a4 4 0 0 1-1.9-1.9z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  signout: (
    <>
      <path d="M14 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H14" />
      <path d="M10 12h10M16.5 8.5 20 12l-3.5 3.5" />
    </>
  ),
};

export function Icon({ name, size = 20, label }: { name: string; size?: number; label?: string }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {glyphs[name]}
    </svg>
  );
}

type ButtonVariant = "filled" | "tinted" | "gray" | "plain" | "destructive";

export function Button({
  variant = "filled",
  size = "regular",
  icon,
  busy,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "small" | "regular" | "large";
  icon?: string;
  busy?: boolean;
}) {
  return (
    <button
      className={`btn btn-${variant} btn-${size}${className ? ` ${className}` : ""}`}
      {...props}
      disabled={props.disabled || busy}
      aria-busy={busy || undefined}
    >
      {busy ? <Spinner small /> : icon && <Icon name={icon} size={size === "small" ? 15 : 17} />}
      {children && <span>{children}</span>}
    </button>
  );
}

export function Spinner({ small = false }: { small?: boolean }) {
  return <span className={`spinner ${small ? "small" : ""}`} role="status" aria-label="Loading" />;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  onBack,
  backLabel,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <header className="page-header">
      {onBack && (
        <button className="back-link" onClick={onBack}>
          <Icon name="back" size={18} />
          {backLabel ?? "Back"}
        </button>
      )}
      <div className="page-header-row">
        <div>
          <h1 className="large-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
    </header>
  );
}

export function Section({
  title,
  footer,
  action,
  children,
  plain = false,
}: {
  title?: ReactNode;
  footer?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  plain?: boolean;
}) {
  return (
    <section className="section">
      {(title || action) && (
        <div className="section-header">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      <div className={plain ? "section-plain" : "inset-group"}>{children}</div>
      {footer && <p className="section-footer">{footer}</p>}
    </section>
  );
}

export function Row({
  icon,
  iconTint,
  title,
  subtitle,
  detail,
  accessory,
  onClick,
  chevron,
  selected,
  multiline,
}: {
  icon?: string;
  iconTint?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  detail?: ReactNode;
  accessory?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  selected?: boolean;
  multiline?: boolean;
}) {
  const content = (
    <>
      {icon && (
        <span className="row-icon" style={iconTint ? { background: iconTint } : undefined}>
          <Icon name={icon} size={16} />
        </span>
      )}
      <span className={`row-text ${multiline ? "multiline" : ""}`}>
        <span className="row-title">{title}</span>
        {subtitle && <span className="row-subtitle">{subtitle}</span>}
      </span>
      {detail !== undefined && <span className="row-detail">{detail}</span>}
      {accessory}
      {chevron && <Icon name="chevron" size={15} />}
    </>
  );
  return onClick ? (
    <button className={`row row-button ${selected ? "selected" : ""}`} onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className={`row ${selected ? "selected" : ""}`}>{content}</div>
  );
}

export function FieldRow({
  label,
  hint,
  children,
  stacked,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  stacked?: boolean;
}) {
  return (
    <label className={`row field-row ${stacked ? "stacked" : ""}`}>
      <span className="field-label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <span className="field-control">{children}</span>
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`toggle ${checked ? "on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          role="tab"
          aria-selected={option.value === value}
          className={option.value === value ? "active" : ""}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  onSubmit,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder: string;
}) {
  return (
    <form
      className="search-field"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <Icon name="search" size={16} />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </form>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="text-input" {...props} />;
}

export function Badge({ tone = "gray", children }: { tone?: "green" | "orange" | "red" | "blue" | "gray"; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

const statusMap: Record<string, { tone: "green" | "orange" | "red" | "blue" | "gray"; label: string }> = {
  active: { tone: "green", label: "Active" },
  ready: { tone: "green", label: "Ready" },
  completed: { tone: "green", label: "Completed" },
  delivered: { tone: "green", label: "Delivered" },
  passed: { tone: "green", label: "Passed" },
  draft: { tone: "gray", label: "Draft" },
  archived: { tone: "gray", label: "Off" },
  pending: { tone: "orange", label: "Pending" },
  processing: { tone: "orange", label: "Processing" },
  accepted: { tone: "orange", label: "Received" },
  engaged: { tone: "blue", label: "In conversation" },
  lead_captured: { tone: "green", label: "Lead captured" },
  human_handoff: { tone: "orange", label: "With your team" },
  failed: { tone: "red", label: "Failed" },
};

export function StatusBadge({ value }: { value: string }) {
  const status = statusMap[value] ?? { tone: "gray" as const, label: value.replaceAll("_", " ") };
  return <Badge tone={status.tone}>{status.label}</Badge>;
}

export function Sheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("input, textarea, select, button")?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="sheet-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: string; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={28} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

export function Banner({ tone = "red", children, onClose }: { tone?: "red" | "orange" | "blue" | "green"; children: ReactNode; onClose?: () => void }) {
  return (
    <div className={`banner banner-${tone}`} role={tone === "red" ? "alert" : "status"}>
      <Icon name={tone === "green" ? "check" : "warning"} size={17} />
      <div>{children}</div>
      {onClose && (
        <button className="icon-button" onClick={onClose} aria-label="Close">
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
}

type ToastFn = (message: string, tone?: "default" | "error") => void;
const ToastContext = createContext<ToastFn>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; tone: "default" | "error"; key: number } | null>(null);
  const show = useCallback<ToastFn>((message, tone = "default") => setToast({ message, tone, key: Date.now() }), []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toast && (
          <div className={`toast ${toast.tone}`} key={toast.key}>
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

export function errorMessage(error: unknown, fallback = "Something went wrong") {
  return error instanceof Error ? error.message : fallback;
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  const normalized = /Z|[+-]\d\d:?\d\d$/.test(value) ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function CopyField({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  return (
    <div className="copy-field">
      <span className="field-label">{label}</span>
      <div>
        <code>{value}</code>
        <Button
          variant="gray"
          size="small"
          icon="copy"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            toast("Copied");
          }}
        >
          Copy
        </Button>
      </div>
    </div>
  );
}
```

## `src/client/App.tsx`

```tsx
import { useEffect, useState, type FormEvent } from "react";
import { api, post, setCsrf } from "./api";
import { AppIcon, Login, Setup } from "./pages/Auth";
import { AssistantPage, type AssistantTab } from "./pages/Assistant";
import { ConnectionsPage } from "./pages/Connections";
import { ConversationsPage } from "./pages/Conversations";
import { DataPage } from "./pages/Data";
import { HomePage } from "./pages/Home";
import { SettingsPage } from "./pages/Settings";
import type { Bootstrap, Brand } from "./types";
import { Banner, Button, FieldRow, Icon, Section, Segmented, Spinner, TextInput, ToastProvider, errorMessage } from "./ui";

type Page = "home" | "assistant" | "data" | "conversations" | "connections" | "settings";

const nav: Array<{ id: Page; label: string; icon: string }> = [
  { id: "home", label: "Home", icon: "overview" },
  { id: "assistant", label: "Assistant", icon: "assistant" },
  { id: "data", label: "Data", icon: "data" },
  { id: "conversations", label: "Conversations", icon: "conversations" },
  { id: "connections", label: "Channels", icon: "connections" },
  { id: "settings", label: "Settings", icon: "settings" },
];
const assistantTabs: AssistantTab[] = ["test", "instructions", "sources", "versions"];

const defaultBrand: Brand = { name: "Assistant", logoUrl: "", primaryColor: "#007aff", supportUrl: "" };

// Route lives in the hash (#/assistant/sources) so reload and the back button keep the place.
function readRoute(): { page: Page; tab: AssistantTab; params: string[] } {
  const [page, ...rest] = window.location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  const known = nav.some((item) => item.id === page);
  return {
    page: known ? (page as Page) : "home",
    tab: page === "assistant" && assistantTabs.includes(rest[0] as AssistantTab) ? (rest[0] as AssistantTab) : "test",
    params: known && page !== "assistant" ? rest : [],
  };
}

function useRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const go = (page: Page, tab?: AssistantTab, ...params: string[]) => {
    window.location.hash = page === "assistant" ? `/assistant/${tab ?? route.tab}` : [`/${page}`, ...params.map(encodeURIComponent)].join("/");
  };
  return { ...route, go };
}

function Shell({ data, reload, logout }: { data: Bootstrap; reload: () => Promise<void>; logout: () => void }) {
  const { page, tab, params, go } = useRoute();
  // One assistant per workspace; the backend still stores agents generically.
  const agent = data.agents[0];
  useEffect(() => {
    document.title = `${nav.find((item) => item.id === page)?.label ?? ""} · ${data.brand.name}`;
  }, [page, data.brand.name]);
  if (!agent) return <CreateAssistant brand={data.brand} onDone={reload} />;
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <AppIcon brand={data.brand} size={30} />
          <b>{data.brand.name}</b>
        </div>
        <nav aria-label="Main">
          {nav.map((item) => (
            <button key={item.id} className={page === item.id ? "active" : ""} aria-current={page === item.id ? "page" : undefined} onClick={() => go(item.id)}>
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className={`live-dot ${agent.active_version_id ? "on" : ""}`} />
          {agent.active_version_id ? "Assistant is live" : "Not live yet"}
        </div>
      </aside>
      <main className="content">
        {page === "home" && <HomePage agent={agent} go={(target) => go(target)} />}
        {page === "assistant" && (
          <AssistantPage
            agentId={agent.id}
            collections={data.collections}
            tab={tab}
            onTab={(next) => go("assistant", next)}
            refresh={reload}
            navigate={(target, ...rest) => go(target, undefined, ...rest)}
          />
        )}
        {page === "data" && <DataPage collections={data.collections} reload={reload} openCollectionId={params[0]} openRecordId={params[1]} onSelect={(id) => go("data", undefined, id)} />}
        {page === "conversations" && <ConversationsPage />}
        {page === "connections" && <ConnectionsPage agent={agent} connections={data.connections} reload={reload} />}
        {page === "settings" && <SettingsPage brand={data.brand} modelDefaults={data.modelDefaults} reload={reload} logout={logout} />}
      </main>
      <nav className="tab-bar" aria-label="Main">
        {nav.map((item) => (
          <button key={item.id} className={page === item.id ? "active" : ""} aria-current={page === item.id ? "page" : undefined} onClick={() => go(item.id)}>
            <Icon name={item.icon} size={22} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// First run: three answers give a working customer assistant; everything else can be refined later.
function CreateAssistant({ brand, onDone }: { brand: Brand; onDone: () => Promise<void> }) {
  const [form, setForm] = useState({ businessName: brand.name, offering: "", template: "sales" as "sales" | "support" | "blank" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("/api/admin/agents", {
        name: `${form.businessName} Assistant`,
        description: form.template === "support" ? "Customer support" : form.template === "sales" ? "Sales and customer questions" : "",
        primaryLanguage: "en",
        template: form.template,
        businessName: form.businessName,
        offering: form.offering,
      });
      await onDone();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }
  return (
    <main className="auth-screen">
      <form className="auth-panel" onSubmit={submit}>
        <AppIcon brand={brand} />
        <h1>Create your assistant</h1>
        <p className="auth-lead">It answers your customers like a trained team member — on your website, inbox or any channel you connect.</p>
        <Segmented
          label="Assistant type"
          value={form.template}
          onChange={(template) => setForm({ ...form, template })}
          options={[
            { value: "sales", label: "Sales" },
            { value: "support", label: "Support" },
            { value: "blank", label: "Blank" },
          ]}
        />
        <Section>
          <FieldRow label="Business name">
            <TextInput value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} required />
          </FieldRow>
          <FieldRow label="What do you offer?" stacked>
            <TextInput value={form.offering} onChange={(event) => setForm({ ...form, offering: event.target.value })} placeholder="e.g. Handmade furniture for homes and offices" />
          </FieldRow>
        </Section>
        {error && <Banner>{error}</Banner>}
        <div className="auth-actions">
          <Button size="large" busy={busy} disabled={!form.businessName.trim()}>
            Create assistant
          </Button>
        </div>
      </form>
    </main>
  );
}

export function App() {
  const [state, setState] = useState<"loading" | "setup" | "login" | "ready">("loading");
  const [brand, setBrand] = useState<Brand>(defaultBrand);
  const [data, setData] = useState<Bootstrap | null>(null);
  async function loadAdmin() {
    try {
      const session = await api<{ csrfToken: string }>("/api/admin/session");
      setCsrf(session.csrfToken);
      await reload();
      setState("ready");
    } catch {
      setState("login");
    }
  }
  async function reload() {
    const bootstrap = await api<Bootstrap>("/api/admin/bootstrap");
    const merged = { ...bootstrap, brand: { ...defaultBrand, ...bootstrap.brand } };
    setBrand(merged.brand);
    setData(merged);
  }
  useEffect(() => {
    void (async () => {
      try {
        const status = await api<{ setupComplete: boolean; brand: Brand }>("/api/setup/status");
        setBrand({ ...defaultBrand, ...status.brand });
        if (!status.setupComplete) setState("setup");
        else await loadAdmin();
      } catch {
        setState("login");
      }
    })();
  }, []);
  return (
    <ToastProvider>
      {state === "loading" && (
        <div className="page-loading full">
          <Spinner />
        </div>
      )}
      {state === "setup" && <Setup onDone={() => void loadAdmin()} />}
      {state === "login" && <Login brand={brand} onDone={() => void loadAdmin()} />}
      {state === "ready" && data && (
        <Shell
          data={data}
          reload={reload}
          logout={async () => {
            await post("/api/admin/logout").catch(() => undefined);
            setData(null);
            setState("login");
          }}
        />
      )}
    </ToastProvider>
  );
}
```

## `src/client/RichMessage.tsx`

```tsx
// Agents may answer with a structured channel payload ({version:"v2",content:{messages:[...]}}).
// Render it as the customer would see it; fall back to plain text for anything else.
type RichPart = {
  type: string;
  text?: string;
  url?: string;
  buttons?: Array<{ type?: string; caption?: string; url?: string }>;
};

export function parseRichMessage(text: string): RichPart[] {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { content?: { messages?: RichPart[] } };
      const parts = parsed.content?.messages;
      if (Array.isArray(parts) && parts.length) return parts;
    } catch {
      // Not structured output; render as text.
    }
  }
  return [{ type: "text", text }];
}

const safeUrl = (value?: string) => {
  try {
    const url = new URL(value ?? "");
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

export function RichBubbles({ text, role }: { text: string; role: "user" | "assistant" }) {
  if (role === "user") return <div className="bubble user">{text}</div>;
  return (
    <>
      {parseRichMessage(text).map((part, index) => {
        const buttons = (part.buttons ?? []).filter((button) => safeUrl(button.url));
        const image = part.type === "image" ? safeUrl(part.url) : undefined;
        return (
          <div className={`bubble assistant ${image ? "media" : ""}`} key={index}>
            {image && <img src={image} alt="" loading="lazy" />}
            {part.text && <p>{part.text}</p>}
            {buttons.length > 0 && (
              <div className="bubble-buttons">
                {buttons.map((button, buttonIndex) => (
                  <a href={safeUrl(button.url)} target="_blank" rel="noreferrer noopener" key={buttonIndex}>
                    {button.caption || "Open link"}
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
```

## `src/client/pages/Home.tsx`

```tsx
import { useEffect, useState } from "react";
import { api } from "../api";
import { previewSnippet } from "../format";
import { parseRichMessage } from "../RichMessage";
import type { AgentSummary, Conversation, Dashboard } from "../types";
import { Badge, Banner, EmptyState, PageHeader, Row, Section, errorMessage, formatDate } from "../ui";

type Go = (page: "assistant" | "conversations" | "connections") => void;

// The owner's morning view: is the assistant live, what needs a person, what customers asked.
export function HomePage({ agent, go }: { agent: AgentSummary; go: Go }) {
  const [summary, setSummary] = useState<Dashboard | null>(null);
  const [recent, setRecent] = useState<Conversation[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void Promise.all([api<Dashboard>("/api/admin/dashboard"), api<Conversation[]>("/api/admin/conversations")])
      .then(([dashboard, conversations]) => {
        setSummary(dashboard);
        setRecent(conversations.slice(0, 5));
      })
      .catch((caught) => setError(errorMessage(caught)));
  }, []);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const tiles = summary
    ? [
        { label: "Chats in the last 24 hours", value: summary.chats24h, hint: `${summary.chats7d} this week`, go: () => go("conversations"), tone: "" },
        { label: "Waiting for your team", value: summary.waitingForTeam, hint: summary.waitingForTeam ? "Reply in Conversations" : "All handled", go: () => go("conversations"), tone: summary.waitingForTeam ? "orange" : "" },
        { label: "Replies not delivered", value: summary.failedDeliveries, hint: summary.failedDeliveries ? "Retry in Channels" : "All delivered", go: () => go("connections"), tone: summary.failedDeliveries ? "red" : "" },
      ]
    : null;
  return (
    <div className="page">
      <PageHeader title="Home" subtitle={today} />
      {error && <Banner onClose={() => setError("")}>{`Couldn't load today's numbers. ${error}`}</Banner>}
      <Section>
        <Row
          icon="assistant"
          iconTint={agent.active_version_id ? "var(--green)" : "var(--gray)"}
          title={agent.name}
          subtitle={agent.active_version_id ? "Answering customers" : "Not live yet — test it, then publish"}
          accessory={agent.active_version_id ? <Badge tone="green">Live</Badge> : <Badge>Draft</Badge>}
          chevron
          onClick={() => go("assistant")}
        />
      </Section>
      <div className="summary" aria-busy={!tiles}>
        {(tiles ?? [0, 1, 2].map(() => null)).map((tile, index) =>
          tile ? (
            <button key={tile.label} className={`summary-tile ${tile.tone}`} onClick={tile.go}>
              <span className="summary-value">{tile.value}</span>
              <span className="summary-label">{tile.label}</span>
              <span className="summary-hint">{tile.hint}</span>
            </button>
          ) : (
            <div key={index} className="summary-tile placeholder" aria-hidden="true" />
          ),
        )}
      </div>
      <Section title="Recent conversations" action={recent && recent.length > 0 ? <button className="btn btn-plain btn-small" onClick={() => go("conversations")}>See all</button> : undefined}>
        {recent && recent.length === 0 && <EmptyState icon="conversations" title="No conversations yet" text="Chats appear here when customers message you on a connected channel." />}
        {recent?.map((conversation) => (
          <Row
            key={conversation.id}
            icon="person"
            iconTint={conversation.human_takeover ? "var(--orange)" : "var(--blue)"}
            title={conversation.display_name || conversation.phone || conversation.external_user_id}
            subtitle={previewSnippet(conversation.last_message_preview, parseRichMessage)}
            detail={<small>{formatDate(conversation.last_activity_at)}</small>}
            onClick={() => go("conversations")}
          />
        ))}
      </Section>
    </div>
  );
}
```

## `src/client/pages/Assistant.tsx`

```tsx
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, del, patch, post } from "../api";
import { modelSupportsTemperature, type AnthropicModel } from "../../shared/models";
import { emptyProfile, hasProfile, type AssistantProfile } from "../../shared/prompt";
import { titleField } from "../format";
import { RichBubbles } from "../RichMessage";
import type { AgentDetail, AgentDraft, AgentResult, Collection, EvalCase, EvalRun, KnowledgeSource } from "../types";
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  FieldRow,
  Icon,
  PageHeader,
  Row,
  Section,
  Segmented,
  Sheet,
  Spinner,
  StatusBadge,
  TextInput,
  Toggle,
  errorMessage,
  formatDate,
  useToast,
} from "../ui";

export type AssistantTab = "test" | "instructions" | "sources" | "versions";
type Navigate = (page: "data" | "conversations" | "connections" | "settings", ...params: string[]) => void;

export const modelOptions: Array<{ value: AnthropicModel; label: string; note: string }> = [
  { value: "claude-haiku-5-5", label: "Claude Haiku 5.5", note: "Fast, low cost" },
  { value: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", note: "Balanced" },
  { value: "claude-opus-5-5", label: "Claude Opus 5.5", note: "Most capable" },
  { value: "claude-sonnet-5", label: "Claude Sonnet 5", note: "Previous generation" },
  { value: "claude-opus-5", label: "Claude Opus 5", note: "Previous generation" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", note: "Previous generation" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", note: "Previous generation" },
];

export const modelLabel = (model?: string) => modelOptions.find((option) => option.value === model)?.label ?? model ?? "—";

export function AssistantPage({
  agentId,
  collections,
  tab,
  onTab,
  refresh,
  navigate,
}: {
  agentId: string;
  collections: Collection[];
  tab: AssistantTab;
  onTab: (tab: AssistantTab) => void;
  refresh: () => Promise<void>;
  navigate: Navigate;
}) {
  const toast = useToast();
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving">("saved");
  const [publishing, setPublishing] = useState<"" | "evaluating" | "publishing">("");
  const [evalRun, setEvalRun] = useState<EvalRun | null>(null);
  const [editedSinceLoad, setEditedSinceLoad] = useState(false);
  const [error, setError] = useState("");
  const latest = useRef<AgentDetail | null>(null);
  latest.current = agent;
  async function load() {
    setAgent(await api<AgentDetail>(`/api/admin/agents/${agentId}`));
    setEditedSinceLoad(false);
  }
  useEffect(() => {
    void load().catch((caught) => setError(errorMessage(caught)));
  }, [agentId]);

  // Drafts never affect customers, so they save automatically.
  async function save() {
    const current = latest.current;
    if (!current) return false;
    setSaveState("saving");
    try {
      await patch(`/api/admin/agents/${current.id}`, { name: current.name, description: current.description, draft: current.draft });
      setSaveState(latest.current === current ? "saved" : "dirty");
      return true;
    } catch (caught) {
      setSaveState("dirty");
      setError(errorMessage(caught, "Couldn't save the draft"));
      return false;
    }
  }
  useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = setTimeout(() => void save(), 800);
    return () => clearTimeout(timer);
  }, [agent, saveState]);
  const flush = async () => (saveState === "saved" ? true : save());

  function mutate(fn: (draft: AgentDraft) => AgentDraft) {
    setAgent((current) => (current ? { ...current, draft: fn(structuredClone(current.draft)) } : current));
    setSaveState("dirty");
    setEditedSinceLoad(true);
  }
  function rename(field: "name" | "description", value: string) {
    setAgent((current) => (current ? { ...current, [field]: value } : current));
    setSaveState("dirty");
    setEditedSinceLoad(true);
  }

  // One action: save, run the test gate, then publish when it passes.
  async function publish() {
    if (!agent || !(await flush())) return;
    setError("");
    try {
      if (agent.evalCases.length) {
        setPublishing("evaluating");
        const run = await post<EvalRun>(`/api/admin/agents/${agentId}/evaluate`);
        setEvalRun(run);
        if (!run.passed) {
          onTab("test");
          setError("Not published: some test scenarios failed. See Test scenarios below.");
          return;
        }
      }
      setPublishing("publishing");
      const result = await post<{ version: number }>(`/api/admin/agents/${agentId}/publish`);
      await load();
      await refresh();
      toast(`Published version ${result.version}`);
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't publish"));
    } finally {
      setPublishing("");
    }
  }

  if (!agent) return error ? <Banner>{error}</Banner> : <div className="page-loading"><Spinner /></div>;
  const live = agent.versions.find((version) => version.id === agent.active_version_id);
  const upToDate = Boolean(live) && agent.draftMatchesLive && !editedSinceLoad && saveState === "saved";
  const missing = [
    !agent.draft.modelConfig.credentialId && { text: "No Anthropic API key yet.", action: "Open Settings", go: () => navigate("settings") },
    !agent.draft.instructions.trim() && !hasProfile(agent.draft) && { text: "Tell the assistant what its job is.", action: "Write instructions", go: () => onTab("instructions") },
    agent.sources.some((source) => source.status === "failed") && { text: "A knowledge source failed to process.", action: "View sources", go: () => onTab("sources") },
  ].filter(Boolean) as Array<{ text: string; action: string; go: () => void }>;
  return (
    <div className="page">
      <PageHeader
        title={agent.name}
        subtitle={
          <>
            {live ? <Badge tone="green">Live · v{live.version}</Badge> : <Badge>Not live yet</Badge>}
            <span className="save-state" aria-live="polite">
              {saveState === "saving" ? "Saving…" : upToDate ? "Customers see this version" : live ? "Changes not live yet" : "Test it, then publish"}
            </span>
          </>
        }
        actions={
          <Button onClick={() => void publish()} busy={Boolean(publishing)} disabled={upToDate}>
            {publishing === "evaluating" ? "Running tests…" : publishing === "publishing" ? "Publishing…" : upToDate ? "Published" : "Publish"}
          </Button>
        }
      />
      {missing.length > 0 && (
        <Banner tone="orange">
          {missing.map((item) => (
            <div key={item.text} className="banner-line">
              {item.text}
              <Button variant="plain" size="small" onClick={item.go}>
                {item.action}
              </Button>
            </div>
          ))}
        </Banner>
      )}
      <div className="toolbar">
        <Segmented<AssistantTab>
          label="Assistant sections"
          value={tab}
          onChange={onTab}
          options={[
            { value: "test", label: "Test" },
            { value: "instructions", label: "Instructions" },
            { value: "sources", label: "Sources" },
            { value: "versions", label: "Versions" },
          ]}
        />
      </div>
      {error && (
        <Banner onClose={() => setError("")}>
          {error.split("\n").map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </Banner>
      )}
      {tab === "test" && <TestTab agent={agent} collections={collections} flush={flush} reload={load} run={evalRun} setRun={setEvalRun} navigate={navigate} />}
      {tab === "instructions" && <InstructionsTab agent={agent} mutate={mutate} rename={rename} />}
      {tab === "sources" && (
        <>
          <KnowledgeTab agent={agent} mutate={mutate} reload={load} />
          <ToolsTab agent={agent} collections={collections.filter((collection) => !collection.archived_at || agent.draft.collectionBindings.some((item) => item.collectionId === collection.id))} mutate={mutate} reload={load} />
        </>
      )}
      {tab === "versions" && <VersionsTab agent={agent} reload={async () => { await load(); await refresh(); }} />}
    </div>
  );
}

// One rule per line: the simplest list editor that still reads like a note.
function RuleList({ value, onChange, placeholder, label }: { value: string[]; onChange: (value: string[]) => void; placeholder: string; label: string }) {
  return (
    <textarea
      className="text-area rule-list"
      rows={Math.max(3, value.length + 1)}
      aria-label={label}
      placeholder={placeholder}
      value={value.join("\n")}
      onChange={(event) => onChange(event.target.value.split("\n"))}
    />
  );
}

function InstructionsTab({
  agent,
  mutate,
  rename,
}: {
  agent: AgentDetail;
  mutate: (fn: (draft: AgentDraft) => AgentDraft) => void;
  rename: (field: "name" | "description", value: string) => void;
}) {
  const { draft } = agent;
  const profile: AssistantProfile = { ...emptyProfile, ...draft.profile };
  const sampling = modelSupportsTemperature(draft.modelConfig.model);
  const setProfile = (value: Partial<AssistantProfile>) => mutate((current) => ({ ...current, profile: { ...emptyProfile, ...current.profile, ...value } }));
  const setModel = (value: Partial<AgentDraft["modelConfig"]>) => mutate((current) => ({ ...current, modelConfig: { ...current.modelConfig, ...value } }));
  return (
    <div className="split">
      <div className="split-main">
        <Section title="Your business" footer="Facts that rarely change. Prices, offers and stock belong in Data so they stay current.">
          <FieldRow label="Business name">
            <TextInput value={profile.businessName} onChange={(event) => setProfile({ businessName: event.target.value })} placeholder="Acme Furniture" />
          </FieldRow>
          <FieldRow label="What you offer" stacked>
            <textarea className="text-area" rows={2} value={profile.offering} onChange={(event) => setProfile({ offering: event.target.value })} placeholder="Products or services you sell, and who they are for" />
          </FieldRow>
          <FieldRow label="Contact and hours" stacked>
            <textarea className="text-area" rows={2} value={profile.contactInfo} onChange={(event) => setProfile({ contactInfo: event.target.value })} placeholder="Phone, email, address, opening hours" />
          </FieldRow>
          <FieldRow label="Website">
            <TextInput type="url" value={profile.website} onChange={(event) => setProfile({ website: event.target.value })} placeholder="https://" />
          </FieldRow>
        </Section>
        <Section title="Your assistant's job" footer="What it should do for customers — answer questions, recommend, take requests — and what a good conversation ends with.">
          <textarea className="text-area plain" rows={4} aria-label="Assistant's job" value={profile.job} onChange={(event) => setProfile({ job: event.target.value })} placeholder="Answer questions, recommend the right product and collect contact details when the customer is ready to buy." />
        </Section>
        <Section title="Voice and style" footer="How it should sound. It always replies in the customer's language.">
          <textarea className="text-area plain" rows={3} aria-label="Voice and style" value={profile.voice} onChange={(event) => setProfile({ voice: event.target.value })} placeholder="Warm and polite, short messages, one question at a time." />
        </Section>
        <Section title="Always" footer="One rule per line.">
          <RuleList label="Always" value={profile.alwaysDo} onChange={(alwaysDo) => setProfile({ alwaysDo })} placeholder="Check the data before stating a price or offer" />
        </Section>
        <Section title="Never" footer="One rule per line.">
          <RuleList label="Never" value={profile.neverDo} onChange={(neverDo) => setProfile({ neverDo })} placeholder="Invent prices, discounts or delivery dates" />
        </Section>
        <Section title="Hand off to a person when" footer="The assistant tells the customer someone from the team will follow up.">
          <RuleList label="Hand off to a person when" value={profile.handoffWhen} onChange={(handoffWhen) => setProfile({ handoffWhen })} placeholder="The customer has a complaint or asks for a person" />
        </Section>
        <Section title="Contact details to collect" footer="Asked politely when the customer is ready to buy, wants a quote, or needs a person. One per line.">
          <RuleList label="Contact details to collect" value={profile.collectDetails} onChange={(collectDetails) => setProfile({ collectDetails })} placeholder="Name" />
        </Section>
        <details className="advanced">
          <summary>Detailed playbook (advanced)</summary>
          <Section
            action={<span className="caption">{draft.instructions.length.toLocaleString("en-US")} characters</span>}
            footer="Optional long-form prompt for experts. When it disagrees with the sections above, the sections above win."
          >
            <textarea
              className="editor"
              value={draft.instructions}
              spellCheck={false}
              aria-label="Detailed playbook"
              onChange={(event) => mutate((current) => ({ ...current, instructions: event.target.value }))}
            />
          </Section>
        </details>
      </div>
      <div className="split-side">
        <Section title="Assistant">
          <FieldRow label="Name" stacked>
            <TextInput value={agent.name} onChange={(event) => rename("name", event.target.value)} />
          </FieldRow>
          <FieldRow label="Description" stacked>
            <TextInput value={agent.description} onChange={(event) => rename("description", event.target.value)} />
          </FieldRow>
        </Section>
        <Section title="When something goes wrong" footer="Sent if the AI is unavailable or times out.">
          <FieldRow label="Fallback reply" stacked>
            <textarea
              className="text-area"
              rows={3}
              value={draft.responsePolicy.fallbackMessage}
              onChange={(event) => mutate((current) => ({ ...current, responsePolicy: { ...current.responsePolicy, fallbackMessage: event.target.value } }))}
            />
          </FieldRow>
        </Section>
        <details className="advanced">
          <summary>Advanced</summary>
          <Section title="Model" footer={sampling ? undefined : "This model manages creativity itself; temperature doesn't apply."}>
            <FieldRow label="Model">
              <select className="select" value={draft.modelConfig.model} onChange={(event) => setModel({ model: event.target.value as AnthropicModel })}>
                {modelOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label} — {option.note}
                  </option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Temperature">
              <TextInput type="number" min={0} max={1} step={0.1} disabled={!sampling} value={draft.modelConfig.temperature} onChange={(event) => setModel({ temperature: Number(event.target.value) })} />
            </FieldRow>
            <FieldRow label="Max tokens">
              <TextInput type="number" min={128} max={8192} step={128} value={draft.modelConfig.maxTokens} onChange={(event) => setModel({ maxTokens: Number(event.target.value) })} />
            </FieldRow>
            <FieldRow label="Max reply length">
              <TextInput
                type="number"
                min={100}
                max={8000}
                value={draft.responsePolicy.maxLength}
                onChange={(event) => mutate((current) => ({ ...current, responsePolicy: { ...current.responsePolicy, maxLength: Number(event.target.value) } }))}
              />
            </FieldRow>
          </Section>
        </details>
      </div>
    </div>
  );
}

function KnowledgeTab({ agent, mutate, reload }: { agent: AgentDetail; mutate: (fn: (draft: AgentDraft) => AgentDraft) => void; reload: () => Promise<void> }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<KnowledgeSource | null>(null);
  const pending = agent.sources.some((source) => source.status === "pending" || source.status === "processing");
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => void reload(), 4000);
    return () => clearInterval(timer);
  }, [pending]);
  const toggle = (sourceId: string, on: boolean) =>
    mutate((current) => ({
      ...current,
      knowledgeSourceIds: on ? [...new Set([...current.knowledgeSourceIds, sourceId])] : current.knowledgeSourceIds.filter((item) => item !== sourceId),
    }));
  const used = agent.sources.filter((source) => agent.draft.knowledgeSourceIds.includes(source.id)).length;
  return (
    <>
      <Section
        title={`Knowledge · ${used} of ${agent.sources.length} in use`}
        action={
          <Button variant="tinted" size="small" icon="plus" onClick={() => setAdding(true)}>
            Add source
          </Button>
        }
        footer="For explanations that rarely change: policies, guides, FAQs. Test shows which sources each answer used."
      >
        {agent.sources.length === 0 && <EmptyState icon="doc" title="No knowledge yet" text="Add text, Markdown or a web page." />}
        {agent.sources.map((source) => (
          <Row
            key={source.id}
            icon={source.type === "url" ? "globe" : "doc"}
            iconTint={source.type === "url" ? "var(--teal)" : "var(--indigo)"}
            title={source.name}
            subtitle={source.error ? <span className="text-red">{source.error}</span> : `Updated ${formatDate(source.updated_at)}`}
            accessory={
              <>
                <StatusBadge value={source.status} />
                {source.status === "failed" && (
                  <Button
                    variant="plain"
                    size="small"
                    icon="refresh"
                    aria-label="Retry"
                    onClick={async () => {
                      await post(`/api/admin/knowledge/${source.id}/retry`);
                      toast("Processing the source again");
                      await reload();
                    }}
                  />
                )}
                <Button variant="plain" size="small" onClick={() => setEditing(source)}>
                  Edit
                </Button>
                <Toggle label={`Use ${source.name}`} checked={agent.draft.knowledgeSourceIds.includes(source.id)} onChange={(on) => toggle(source.id, on)} />
              </>
            }
          />
        ))}
      </Section>
      {editing && (
        <EditKnowledgeSheet
          source={editing}
          onClose={() => setEditing(null)}
          onDone={async (message) => {
            setEditing(null);
            toast(message);
            await reload();
          }}
        />
      )}
      {adding && (
        <AddKnowledgeSheet
          agentId={agent.id}
          onClose={() => setAdding(false)}
          onDone={async (sourceId) => {
            setAdding(false);
            toggle(sourceId, true);
            await reload();
            toast("Source added");
          }}
        />
      )}
    </>
  );
}

function AddKnowledgeSheet({ agentId, onClose, onDone }: { agentId: string; onClose: () => void; onDone: (sourceId: string) => void }) {
  const [kind, setKind] = useState<"text" | "url">("text");
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await post<{ id?: string; sourceId?: string }>(`/api/admin/agents/${agentId}/knowledge/${kind}`, kind === "text" ? { name, text: content } : { name, url: content });
      onDone(String(result.id ?? result.sourceId ?? ""));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      title="Add knowledge"
      onClose={onClose}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>Cancel</Button>
          <Button form="add-knowledge" busy={busy} disabled={!name || !content}>Add</Button>
        </>
      }
    >
      <form id="add-knowledge" onSubmit={submit} className="sheet-form">
        <Segmented label="Source type" value={kind} onChange={setKind} options={[{ value: "text", label: "Text" }, { value: "url", label: "Web page" }]} />
        <Section footer={kind === "url" ? "One HTTPS page; linked pages are not followed." : "Paste text or Markdown."}>
          <FieldRow label="Title">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="Warranty policy" required />
          </FieldRow>
          {kind === "url" ? (
            <FieldRow label="URL">
              <TextInput type="url" value={content} onChange={(event) => setContent(event.target.value)} placeholder="https://" required />
            </FieldRow>
          ) : (
            <FieldRow label="Content" stacked>
              <textarea className="text-area" rows={10} value={content} onChange={(event) => setContent(event.target.value)} required />
            </FieldRow>
          )}
        </Section>
        {error && <Banner>{error}</Banner>}
      </form>
    </Sheet>
  );
}

function ToolsTab({
  agent,
  collections,
  mutate,
  reload,
}: {
  agent: AgentDetail;
  collections: Collection[];
  mutate: (fn: (draft: AgentDraft) => AgentDraft) => void;
  reload: () => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const bindCollection = (collection: Collection, on: boolean) =>
    mutate((current) => ({
      ...current,
      collectionBindings: on
        ? [...current.collectionBindings, { collectionId: collection.id, toolName: `search_${collection.slug.replaceAll("-", "_")}`, purpose: `Find ${collection.name} that match the customer's question` }]
        : current.collectionBindings.filter((item) => item.collectionId !== collection.id),
    }));
  const bindTool = (name: string, on: boolean) =>
    mutate((current) => ({ ...current, toolBindings: on ? [...new Set([...current.toolBindings, name])] : current.toolBindings.filter((item) => item !== name) }));
  return (
    <>
      <Section title="Data" footer="Turn on the data the assistant may look up. It must check it before talking about prices, offers or stock; expired or switched-off rows are never shown.">
        {collections.map((collection) => {
          const binding = agent.draft.collectionBindings.find((item) => item.collectionId === collection.id);
          return (
            <Row
              key={collection.id}
              icon="data"
              iconTint="var(--green)"
              title={collection.name}
              subtitle={collection.description || undefined}
              accessory={<Toggle label={`Use ${collection.name}`} checked={Boolean(binding)} onChange={(on) => bindCollection(collection, on)} />}
            />
          );
        })}
      </Section>
      <details className="advanced">
        <summary>Live lookups (advanced)</summary>
        <Section
          action={
            <Button variant="tinted" size="small" icon="plus" onClick={() => setAdding(true)}>
              Add lookup
            </Button>
          }
          footer="Read-only HTTPS GET requests to your own systems, e.g. live stock. The assistant can never change anything outside."
        >
          {agent.tools.length === 0 && <Row title={<span className="text-secondary">No lookups</span>} />}
          {agent.tools.map((tool) => (
            <Row
              key={tool.id}
              icon={tool.kind === "http_get" ? "globe" : "wrench"}
              iconTint="var(--orange)"
              title={tool.name}
              subtitle={tool.description}
              accessory={<Toggle label={`Use ${tool.name}`} checked={agent.draft.toolBindings.includes(tool.name)} onChange={(on) => bindTool(tool.name, on)} />}
            />
          ))}
        </Section>
      </details>
      {adding && (
        <AddToolSheet
          agentId={agent.id}
          onClose={() => setAdding(false)}
          onDone={async (name) => {
            setAdding(false);
            bindTool(name, true);
            await reload();
          }}
        />
      )}
    </>
  );
}

function AddToolSheet({ agentId, onClose, onDone }: { agentId: string; onClose: () => void; onDone: (name: string) => void }) {
  const [tool, setTool] = useState({ name: "", description: "", kind: "http_get" as "http_get" | "plugin", urlTemplate: "", pluginId: "normalize_contact" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const inputSchema =
      tool.kind === "http_get"
        ? { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
        : { type: "object", properties: { name: { type: "string" }, phone: { type: "string" }, email: { type: "string" } } };
    try {
      await post(`/api/admin/agents/${agentId}/tools`, { ...tool, inputSchema, outputSchema: { type: "object" } });
      onDone(tool.name);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      title="Add live lookup"
      onClose={onClose}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>Cancel</Button>
          <Button form="add-tool" busy={busy} disabled={!tool.name || !tool.description || (tool.kind === "http_get" && !tool.urlTemplate)}>Add</Button>
        </>
      }
    >
      <form id="add-tool" className="sheet-form" onSubmit={submit}>
        <Segmented label="Lookup type" value={tool.kind} onChange={(kind) => setTool({ ...tool, kind })} options={[{ value: "http_get", label: "HTTP GET" }, { value: "plugin", label: "Plugin" }]} />
        <Section footer={tool.kind === "http_get" ? "Use {query} in the URL for the search words. Public HTTPS only." : undefined}>
          <FieldRow label="Name">
            <TextInput value={tool.name} placeholder="check_stock" onChange={(event) => setTool({ ...tool, name: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} required />
          </FieldRow>
          <FieldRow label="When to use it" stacked>
            <TextInput value={tool.description} onChange={(event) => setTool({ ...tool, description: event.target.value })} required />
          </FieldRow>
          {tool.kind === "http_get" ? (
            <FieldRow label="URL" stacked>
              <TextInput type="url" value={tool.urlTemplate} placeholder="https://api.example.com/search?q={query}" onChange={(event) => setTool({ ...tool, urlTemplate: event.target.value })} required />
            </FieldRow>
          ) : (
            <FieldRow label="Plugin">
              <select className="select" value={tool.pluginId} onChange={(event) => setTool({ ...tool, pluginId: event.target.value })}>
                <option value="normalize_contact">normalize_contact</option>
                <option value="active_at">active_at</option>
              </select>
            </FieldRow>
          )}
        </Section>
        {error && <Banner>{error}</Banner>}
      </form>
    </Sheet>
  );
}

type ChatTurn = { role: "user" | "assistant"; text: string; result?: AgentResult };

function TestTab({
  agent,
  collections,
  flush,
  reload,
  run,
  setRun,
  navigate,
}: {
  agent: AgentDetail;
  collections: Collection[];
  flush: () => Promise<boolean>;
  reload: () => Promise<void>;
  run: EvalRun | null;
  setRun: (run: EvalRun) => void;
  navigate: Navigate;
}) {
  const collectionFor = (name: string) => {
    const binding = agent.draft.collectionBindings.find((item) => item.toolName === name);
    return binding && collections.find((item) => item.id === binding.collectionId);
  };
  const toolLabel = (name: string) => {
    const binding = agent.draft.collectionBindings.find((item) => item.toolName === name);
    const collection = binding && collections.find((item) => item.id === binding.collectionId);
    return collection ? `Looked up ${collection.name}` : name;
  };
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [selected, setSelected] = useState<AgentResult | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState(() => crypto.randomUUID());
  const [editingSource, setEditingSource] = useState<KnowledgeSource | null>(null);
  const toast = useToast();
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);
  async function send(event?: FormEvent) {
    event?.preventDefault();
    const message = text.trim();
    if (!message || busy) return;
    if (!(await flush())) return;
    setText("");
    setError("");
    setTurns((current) => [...current, { role: "user", text: message }]);
    setBusy(true);
    try {
      const result = await post<AgentResult>(`/api/admin/agents/${agent.id}/preview`, { text: message, conversationId });
      setTurns((current) => [...current, ...result.messages.map((item) => ({ role: "assistant" as const, text: item.text, result }))]);
      setSelected(result);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="test-layout">
        <div className="chat-window">
          <div className="chat-header">
            <div>
              <b>Draft</b>
              <span>A private test chat — customers never see it</span>
            </div>
            <Button
              variant="plain"
              size="small"
              icon="refresh"
              onClick={() => {
                setTurns([]);
                setSelected(null);
                setConversationId(crypto.randomUUID());
              }}
            >
              New chat
            </Button>
          </div>
          <div className="chat-scroll" ref={scroller}>
            {turns.length === 0 && !busy && (
              <EmptyState icon="conversations" title="Chat like a customer" text="Ask about products, offers or policies. Tap a reply to see what it was based on." />
            )}
            {turns.map((turn, index) =>
              turn.role === "user" ? (
                <div className="message-row user" key={index}>
                  <RichBubbles role="user" text={turn.text} />
                </div>
              ) : (
                <button className={`message-row assistant ${selected === turn.result ? "selected" : ""}`} key={index} onClick={() => setSelected(turn.result ?? null)}>
                  <RichBubbles role="assistant" text={turn.text} />
                </button>
              ),
            )}
            {busy && (
              <div className="message-row assistant">
                <div className="bubble assistant typing" aria-label="Typing">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            )}
          </div>
          {error && <Banner onClose={() => setError("")}>{error}</Banner>}
          <form className="composer" onSubmit={send}>
            <textarea
              rows={1}
              value={text}
              placeholder="Message"
              aria-label="Test message"
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
            <button className="send-button" disabled={!text.trim() || busy} aria-label="Send">
              <Icon name="send" size={18} />
            </button>
          </form>
        </div>
        <TraceInspector
          result={selected}
          toolLabel={toolLabel}
          titleKeyFor={(toolName) => {
            const collection = collectionFor(toolName);
            if (!collection) return undefined;
            return titleField(JSON.parse(collection.schema_json).fields as Array<{ key: string; type: string; required?: boolean }>)?.key;
          }}
          openRecord={(toolName, recordId) => {
            const collection = collectionFor(toolName);
            if (collection) navigate("data", collection.id, recordId);
          }}
          openSource={(sourceId) => setEditingSource(agent.sources.find((source) => source.id === sourceId) ?? null)}
        />
      </div>
      <Evaluations agent={agent} flush={flush} reload={reload} run={run} setRun={setRun} />
      {editingSource && (
        <EditKnowledgeSheet
          source={editingSource}
          onClose={() => setEditingSource(null)}
          onDone={async (message) => {
            setEditingSource(null);
            toast(message);
            await reload();
          }}
        />
      )}
    </>
  );
}

type TracedRecord = { record_id?: string; id?: string } & Record<string, unknown>;

// A readable label for a looked-up row: the table's title column, else its first short text value.
const recordTitle = (record: TracedRecord, titleKey?: string) =>
  String(
    (titleKey && record[titleKey]) ??
      Object.entries(record).find(([key, value]) => !["id", "record_id", "valid_from", "valid_until"].includes(key) && typeof value === "string" && value.length > 0 && value.length < 90 && !/^https?:/.test(value))?.[1] ??
      record.id ??
      "Row",
  );

function TraceInspector({
  result,
  toolLabel,
  titleKeyFor,
  openRecord,
  openSource,
}: {
  result: AgentResult | null;
  toolLabel: (name: string) => string;
  titleKeyFor: (toolName: string) => string | undefined;
  openRecord: (toolName: string, recordId: string) => void;
  openSource: (sourceId: string) => void;
}) {
  if (!result?.trace)
    return (
      <aside className="inspector">
        <h3>Details</h3>
        <p className="text-secondary">Tap a reply to see what the assistant based it on, then tap a row or source to fix it.</p>
      </aside>
    );
  const { trace } = result;
  return (
    <aside className="inspector">
      <h3>Details</h3>
      <Section>
        <Row title="Status" accessory={<StatusBadge value={result.status} />} />
        <Row title="Time" detail={`${(trace.latencyMs / 1000).toFixed(1)} s`} />
        <Row title="Model" detail={modelLabel(trace.model)} />
      </Section>
      <Section title="Knowledge read">
        {trace.sources.length ? (
          trace.sources.map((source, index) => (
            <Row
              key={index}
              icon="doc"
              iconTint="var(--indigo)"
              title={source.name}
              detail={source.score ? `${Math.round(source.score * 100)}%` : undefined}
              chevron
              onClick={() => (source as { id?: string }).id && openSource(String((source as { id?: string }).id))}
            />
          ))
        ) : (
          <Row title={<span className="text-secondary">No knowledge read</span>} />
        )}
      </Section>
      <Section title="Data looked up">
        {trace.toolCalls.length ? (
          trace.toolCalls.map((tool, index) => {
            const rows = Array.isArray(tool.output) ? (tool.output as TracedRecord[]) : [];
            return (
              <div key={index} className="trace-group">
                <Row title={toolLabel(tool.name)} detail={rows.length ? `${rows.length} found` : "Nothing found"} />
                {rows.slice(0, 8).map((record, rowIndex) => (
                  <Row key={rowIndex} title={recordTitle(record, titleKeyFor(tool.name))} subtitle={record.id && record.id !== record.record_id ? String(record.id) : undefined} chevron onClick={() => record.record_id && openRecord(tool.name, String(record.record_id))} />
                ))}
              </div>
            );
          })
        ) : (
          <Row title={<span className="text-secondary">No data looked up</span>} />
        )}
      </Section>
      {trace.error && <Banner>{trace.error}</Banner>}
    </aside>
  );
}

function Evaluations({
  agent,
  flush,
  reload,
  run,
  setRun,
}: {
  agent: AgentDetail;
  flush: () => Promise<boolean>;
  reload: () => Promise<void>;
  run: EvalRun | null;
  setRun: (run: EvalRun) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<EvalCase | null>(null);
  async function evaluate() {
    if (!(await flush())) return;
    setBusy(true);
    setError("");
    try {
      const result = await post<EvalRun>(`/api/admin/agents/${agent.id}/evaluate`);
      setRun(result);
      toast(result.passed ? "All scenarios passed" : "Some scenarios failed", result.passed ? "default" : "error");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Section
        title="Test scenarios"
        action={
          <div className="inline-actions">
            <Button variant="plain" size="small" icon="plus" onClick={() => setAdding(true)}>
              Add scenario
            </Button>
            <Button variant="tinted" size="small" busy={busy} onClick={() => void evaluate()} disabled={!agent.evalCases.length}>
              Run all
            </Button>
          </div>
        }
        footer="Publish runs these automatically; required scenarios must pass before customers get a new version."
      >
        {agent.evalCases.length === 0 && <Row title={<span className="text-secondary">No scenarios yet</span>} />}
        {agent.evalCases.map((testCase) => {
          const result = run?.results.find((item) => item.caseId === testCase.id);
          const assertions = JSON.parse(testCase.assertions_json || "{}") as { expectedTool?: string; mustInclude?: string[]; mustNotInclude?: string[]; maxLength?: number };
          const rules = [
            assertions.expectedTool && `looks up ${assertions.expectedTool}`,
            assertions.mustInclude?.length && `says “${assertions.mustInclude.join("”, “")}”`,
            assertions.mustNotInclude?.length && `never says “${assertions.mustNotInclude.join("”, “")}”`,
            assertions.maxLength && `≤ ${assertions.maxLength} characters`,
          ].filter(Boolean);
          return (
            <Row
              key={testCase.id}
              multiline
              title={
                <>
                  {testCase.name} {testCase.critical ? <Badge tone="orange">Required</Badge> : null}
                </>
              }
              subtitle={
                <>
                  “{testCase.input}” · {rules.join(" · ")}
                  {result && !result.passed && <span className="text-red"> — {result.failures.join(", ") || `status ${result.output.status}`}</span>}
                </>
              }
              accessory={result ? <StatusBadge value={result.passed ? "passed" : "failed"} /> : undefined}
              chevron
              onClick={() => setEditing(testCase)}
            />
          );
        })}
      </Section>
      {error && <Banner onClose={() => setError("")}>{error}</Banner>}
      {(adding || editing) && (
        <AddEvalSheet
          agentId={agent.id}
          existing={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onDone={async () => {
            setAdding(false);
            setEditing(null);
            await reload();
          }}
        />
      )}
    </>
  );
}

function AddEvalSheet({ agentId, existing, onClose, onDone }: { agentId: string; existing: EvalCase | null; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState(() => {
    const assertions = JSON.parse(existing?.assertions_json || "{}") as { expectedTool?: string; mustInclude?: string[]; mustNotInclude?: string[]; maxLength?: number };
    return {
      name: existing?.name ?? "",
      input: existing?.input ?? "",
      expectedTool: assertions.expectedTool ?? "",
      mustInclude: (assertions.mustInclude ?? []).join(", "),
      mustNotInclude: (assertions.mustNotInclude ?? []).join(", "),
      maxLength: assertions.maxLength ? String(assertions.maxLength) : "",
      critical: existing ? Boolean(existing.critical) : true,
    };
  });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await (existing ? (body: unknown) => patch(`/api/admin/eval-cases/${existing.id}`, body) : (body: unknown) => post(`/api/admin/agents/${agentId}/eval-cases`, body))({
        name: form.name,
        input: form.input,
        critical: form.critical,
        assertions: {
          expectedTool: form.expectedTool || undefined,
          mustInclude: list(form.mustInclude).length ? list(form.mustInclude) : undefined,
          mustNotInclude: list(form.mustNotInclude).length ? list(form.mustNotInclude) : undefined,
          maxLength: form.maxLength ? Number(form.maxLength) : undefined,
        },
      });
      onDone();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      title={existing ? "Edit test scenario" : "Add test scenario"}
      onClose={onClose}
      footer={
        <>
          {existing && (
            <Button
              variant={confirmDelete ? "destructive" : "plain"}
              className="footer-leading"
              onClick={async () => {
                if (!confirmDelete) return setConfirmDelete(true);
                await del(`/api/admin/eval-cases/${existing.id}`);
                onDone();
              }}
            >
              {confirmDelete ? "Delete scenario" : "Delete"}
            </Button>
          )}
          <Button variant="gray" onClick={onClose}>Cancel</Button>
          <Button form="add-eval" busy={busy} disabled={!form.name || !form.input}>{existing ? "Save" : "Add"}</Button>
        </>
      }
    >
      <form id="add-eval" className="sheet-form" onSubmit={submit}>
        <Section>
          <FieldRow label="Name">
            <TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </FieldRow>
          <FieldRow label="Customer message" stacked>
            <TextInput value={form.input} onChange={(event) => setForm({ ...form, input: event.target.value })} required />
          </FieldRow>
          <FieldRow label="Required to publish">
            <Toggle label="Required to publish" checked={form.critical} onChange={(critical) => setForm({ ...form, critical })} />
          </FieldRow>
        </Section>
        <Section title="Pass when" footer="Separate several phrases with commas.">
          <FieldRow label="Looks up">
            <TextInput value={form.expectedTool} placeholder="search_products" onChange={(event) => setForm({ ...form, expectedTool: event.target.value })} />
          </FieldRow>
          <FieldRow label="Says">
            <TextInput value={form.mustInclude} onChange={(event) => setForm({ ...form, mustInclude: event.target.value })} />
          </FieldRow>
          <FieldRow label="Never says">
            <TextInput value={form.mustNotInclude} onChange={(event) => setForm({ ...form, mustNotInclude: event.target.value })} />
          </FieldRow>
          <FieldRow label="Max length">
            <TextInput type="number" min={1} value={form.maxLength} onChange={(event) => setForm({ ...form, maxLength: event.target.value })} />
          </FieldRow>
        </Section>
        {error && <Banner>{error}</Banner>}
      </form>
    </Sheet>
  );
}

function VersionsTab({ agent, reload }: { agent: AgentDetail; reload: () => Promise<void> }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState<AgentDetail["versions"][number] | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Section title="Published versions" footer="Each version is a frozen snapshot. Ongoing chats keep the version they started with; restoring affects new chats only.">
        {agent.versions.length === 0 && <EmptyState icon="clock" title="No versions yet" text="Publish the draft to create the first version." />}
        {agent.versions.map((version) => {
          const live = version.id === agent.active_version_id;
          return (
            <Row
              key={version.id}
              icon="clock"
              iconTint={live ? "var(--green)" : "var(--gray)"}
              title={`Version ${version.version}`}
              subtitle={formatDate(version.published_at)}
              accessory={
                live ? (
                  <Badge tone="green">Live</Badge>
                ) : (
                  <Button variant="gray" size="small" onClick={() => setConfirm(version)}>
                    Restore
                  </Button>
                )
              }
            />
          );
        })}
      </Section>
      {confirm && (
        <Sheet
          title={`Restore version ${confirm.version}?`}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <Button variant="gray" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button
                busy={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await post(`/api/admin/agents/${agent.id}/rollback/${confirm.id}`);
                    toast(`New chats will use version ${confirm.version}`);
                    setConfirm(null);
                    await reload();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Restore
              </Button>
            </>
          }
        >
          <p className="sheet-text">New chats will use version {confirm.version}. Ongoing chats keep their current version, and your draft is not changed.</p>
        </Sheet>
      )}
    </>
  );
}

function EditKnowledgeSheet({ source, onClose, onDone }: { source: KnowledgeSource; onClose: () => void; onDone: (message: string) => void }) {
  const isUrl = source.type === "url";
  const [name, setName] = useState(source.name);
  const [text, setText] = useState<string | null>(isUrl ? "" : null);
  const [original, setOriginal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (isUrl) return;
    void api<{ text: string }>(`/api/admin/knowledge/${source.id}/content`)
      .then((result) => {
        setText(result.text);
        setOriginal(result.text);
      })
      .catch((caught) => setError(errorMessage(caught)));
  }, [source.id]);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const contentChanged = !isUrl && text !== null && text !== original;
      await patch(`/api/admin/knowledge/${source.id}`, { name, text: contentChanged ? text : undefined });
      onDone(contentChanged ? "Saved — the assistant will use it in a minute" : "Saved");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      title="Edit knowledge"
      onClose={onClose}
      footer={
        <>
          {isUrl && (
            <Button
              variant="plain"
              className="footer-leading"
              onClick={async () => {
                await post(`/api/admin/knowledge/${source.id}/retry`);
                onDone("Fetching the page again");
              }}
            >
              Fetch page again
            </Button>
          )}
          <Button variant="gray" onClick={onClose}>Cancel</Button>
          <Button form="edit-knowledge" busy={busy} disabled={!name.trim() || text === null}>Save</Button>
        </>
      }
    >
      <form id="edit-knowledge" className="sheet-form" onSubmit={save}>
        <Section footer={isUrl ? "Web page sources update when you fetch the page again." : "Saving new text re-indexes this source; customers see the change after it is ready."}>
          <FieldRow label="Title">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} required />
          </FieldRow>
          {!isUrl && (
            <FieldRow label="Content" stacked>
              {text === null ? <Spinner small /> : <textarea className="text-area" rows={14} value={text} onChange={(event) => setText(event.target.value)} />}
            </FieldRow>
          )}
        </Section>
        {error && <Banner>{error}</Banner>}
      </form>
    </Sheet>
  );
}
```

## `src/client/pages/Data.tsx`

```tsx
import Papa from "papaparse";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, patch, post } from "../api";
import { nextKey, titleField } from "../format";
import type { Collection } from "../types";
import { Badge, Banner, Button, EmptyState, FieldRow, Icon, PageHeader, Row, Section, Sheet, Spinner, StatusBadge, TextInput, Toggle, errorMessage, formatDate, useToast } from "../ui";

type RecordRow = { id: string; data_json: string; status: string; valid_from?: string | null; valid_until?: string | null; external_key?: string | null };
type FieldDef = { key: string; label: string; type: string; required?: boolean; unique?: boolean; options?: string[] };

const fieldsOf = (collection: Collection): FieldDef[] => {
  try {
    return (JSON.parse(collection.schema_json) as { fields?: FieldDef[] }).fields ?? [];
  } catch {
    return [];
  }
};

// Re-importing the same CSV must update rows, not duplicate them.
const upsertKey = (fields: FieldDef[]) => fields.find((field) => field.unique)?.key ?? fields.find((field) => field.key === "id")?.key;
const day = (value?: string | null) => (value ? value.slice(0, 10) : "");
const shortDate = (value?: string | null) => (value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "…");

// Schedule and on/off are controlled by the row itself; imported columns that duplicate them are hidden in forms.
const scheduleColumns = new Set(["bat_dau", "ket_thuc", "dang_chay", "valid_from", "valid_until", "start_date", "end_date", "active", "is_active", "status"]);

export function DataPage({
  collections,
  reload,
  openCollectionId,
  openRecordId,
  onSelect,
}: {
  collections: Collection[];
  reload: () => Promise<void>;
  openCollectionId?: string;
  openRecordId?: string;
  onSelect: (id: string) => void;
}) {
  const toast = useToast();
  const visibleCollections = collections.filter((collection) => !collection.archived_at);
  const hiddenCollections = collections.filter((collection) => collection.archived_at);
  const selectedId = openCollectionId ?? visibleCollections[0]?.id ?? collections[0]?.id ?? "";
  const setSelectedId = onSelect;
  const [records, setRecords] = useState<RecordRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [editing, setEditing] = useState<RecordRow | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const selected = collections.find((collection) => collection.id === selectedId) ?? collections[0];
  async function loadRecords(collection = selected) {
    if (!collection) return;
    setRecords(await api<RecordRow[]>(`/api/admin/collections/${collection.id}/records`));
  }
  useEffect(() => {
    setRecords(null);
    void loadRecords().catch((caught) => setError(errorMessage(caught)));
  }, [selected?.id]);
  // Deep link from a Test reply: open the exact row once it is loaded.
  useEffect(() => {
    if (!openRecordId || !records) return;
    const record = records.find((row) => row.id === openRecordId);
    if (record) setEditing(record);
  }, [openRecordId, records]);

  async function importCsv(file: File) {
    if (!selected) return;
    setError("");
    const parsed = Papa.parse<Record<string, unknown>>(await file.text(), { header: true, skipEmptyLines: true });
    if (parsed.errors.length) {
      setError(`This CSV can't be read: ${parsed.errors[0].message}`);
      return;
    }
    setImporting(true);
    try {
      await post(`/api/admin/collections/${selected.id}/import`, { rows: parsed.data, mapping: {}, uniqueKey: upsertKey(fieldsOf(selected)) });
      toast(`Imported ${parsed.data.length} rows`);
      await loadRecords();
    } catch (caught) {
      setError(`Nothing was imported — no rows changed. ${errorMessage(caught)}`);
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const allFields = selected ? fieldsOf(selected) : [];
  const title = titleField(allFields);
  const columns = [title, ...allFields.filter((field) => field !== title && field.key !== "id" && field.type !== "url" && field.type !== "image_url" && !scheduleColumns.has(field.key))].filter(Boolean).slice(0, 3) as FieldDef[];
  const visible = (records ?? []).filter((record) => !query || record.data_json.toLowerCase().includes(query.toLowerCase()));
  const activeCount = (records ?? []).filter((record) => record.status === "active").length;
  return (
    <div className="page">
      <PageHeader
        title="Data"
        subtitle="Prices, offers, stock — anything that changes. Edits apply to the assistant immediately; no need to publish."
        actions={
          <Button variant="gray" icon="plus" onClick={() => setCreating(true)}>
            New table
          </Button>
        }
      />
      {error && <Banner onClose={() => setError("")}>{error}</Banner>}
      {collections.length === 0 ? (
        <EmptyState icon="data" title="No data yet" text="Create a table such as Products or Offers." action={<Button onClick={() => setCreating(true)}>Create table</Button>} />
      ) : (
        <div className="master-detail stack">
          <nav className="master" aria-label="Tables">
            <Section>
              {visibleCollections.map((collection) => (
                <Row key={collection.id} icon="data" iconTint="var(--green)" title={collection.name} onClick={() => setSelectedId(collection.id)} selected={collection.id === selected?.id} />
              ))}
            </Section>
            {hiddenCollections.length > 0 && (
              <details className="advanced hidden-tables">
                <summary>Hidden tables · {hiddenCollections.length}</summary>
                <Section>
                  {hiddenCollections.map((collection) => (
                    <Row key={collection.id} icon="data" iconTint="var(--gray)" title={collection.name} onClick={() => setSelectedId(collection.id)} selected={collection.id === selected?.id} />
                  ))}
                </Section>
              </details>
            )}
          </nav>
          {selected && (
            <div className="detail">
              <div className="detail-header">
                <div>
                  <h2>{selected.name}</h2>
                  <p className="text-secondary">{records ? `${activeCount} active · ${records.length} total` : "Loading…"}</p>
                </div>
                <div className="inline-actions">
                  <label className="search-field compact">
                    <Icon name="search" size={15} />
                    <input type="search" placeholder="Search" aria-label="Search rows" value={query} onChange={(event) => setQuery(event.target.value)} />
                  </label>
                  <Button icon="plus" onClick={() => setEditing("new")}>
                    Add
                  </Button>
                  <Button variant="gray" busy={importing} onClick={() => fileInput.current?.click()}>
                    Import CSV
                  </Button>
                  <Button variant="plain" onClick={() => setRenaming(true)}>
                    Rename
                  </Button>
                  <Button
                    variant="plain"
                    onClick={async () => {
                      try {
                        await patch(`/api/admin/collections/${selected.id}`, { archived: !selected.archived_at });
                        await reload();
                        toast(selected.archived_at ? "Table shown" : "Table hidden");
                      } catch (caught) {
                        setError(errorMessage(caught));
                      }
                    }}
                  >
                    {selected.archived_at ? "Show table" : "Hide table"}
                  </Button>
                  <input ref={fileInput} hidden type="file" accept=".csv,text/csv" onChange={(event) => event.target.files?.[0] && void importCsv(event.target.files[0])} />
                </div>
              </div>
              {!records ? (
                <div className="page-loading"><Spinner /></div>
              ) : visible.length === 0 ? (
                <EmptyState icon="data" title={query ? "No matches" : "No rows yet"} text={query ? "Try different words." : "Tap Add for a single row, or import many from a CSV."} />
              ) : (
                <div className="table-card">
                  <table>
                    <thead>
                      <tr>
                        {columns.map((field) => (
                          <th key={field.key}>{field.label}</th>
                        ))}
                        <th>When</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((record) => {
                        const data = JSON.parse(record.data_json || "{}") as Record<string, unknown>;
                        return (
                          <tr key={record.id} className="clickable" tabIndex={0} onClick={() => setEditing(record)} onKeyDown={(event) => event.key === "Enter" && setEditing(record)}>
                            {columns.map((field) => (
                              <td key={field.key}>{String(data[field.key] ?? "—")}</td>
                            ))}
                            <td className="nowrap">{record.valid_from || record.valid_until ? `${shortDate(record.valid_from)} – ${shortDate(record.valid_until)}` : "Always"}</td>
                            <td>{record.status === "active" ? <Badge tone="green">Active</Badge> : <StatusBadge value={record.status} />}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {creating && (
        <CreateCollectionSheet
          onClose={() => setCreating(false)}
          onDone={async (id) => {
            setCreating(false);
            await reload();
            setSelectedId(id);
          }}
        />
      )}
      {editing && selected && (
        <RecordSheet
          collection={selected}
          existingKeys={(records ?? []).map((row) => row.external_key ?? "").filter(Boolean)}
          record={editing === "new" ? null : editing}
          onClose={() => {
            setEditing(null);
            if (openRecordId) setSelectedId(selected.id);
          }}
          onDone={async (message) => {
            setEditing(null);
            if (openRecordId) setSelectedId(selected.id);
            toast(message);
            await loadRecords();
          }}
        />
      )}
      {renaming && selected && (
        <RenameSheet
          collection={selected}
          onClose={() => setRenaming(false)}
          onDone={async () => {
            setRenaming(false);
            await reload();
            toast("Renamed");
          }}
        />
      )}
    </div>
  );
}

function RecordSheet({
  collection,
  existingKeys,
  record,
  onClose,
  onDone,
}: {
  collection: Collection;
  existingKeys: string[];
  record: RecordRow | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const allFields = fieldsOf(collection);
  const key = upsertKey(allFields);
  const fields = allFields.filter((field) => field.key !== key && !scheduleColumns.has(field.key));
  const [data, setData] = useState<Record<string, unknown>>(() =>
    record ? (JSON.parse(record.data_json || "{}") as Record<string, unknown>) : key ? { [key]: nextKey(existingKeys) } : {},
  );
  const [active, setActive] = useState(record ? record.status === "active" : true);
  const [from, setFrom] = useState(day(record?.valid_from));
  const [until, setUntil] = useState(day(record?.valid_until));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (field: string, value: unknown) => setData((current) => ({ ...current, [field]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body = { data, status: active ? "active" : "archived", validFrom: from || null, validUntil: until || null };
    try {
      if (record) await patch(`/api/admin/collections/${collection.id}/records/${record.id}`, body);
      else await post(`/api/admin/collections/${collection.id}/records`, { ...body, externalKey: key && data[key] ? String(data[key]) : undefined });
      onDone(record ? "Saved — the assistant uses it now" : "Added — the assistant uses it now");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      title={record ? `Edit ${key && data[key] ? String(data[key]) : ""}`.trim() : `Add to ${collection.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>Cancel</Button>
          <Button form="record-form" busy={busy}>{record ? "Save" : "Add"}</Button>
        </>
      }
    >
      <form id="record-form" className="sheet-form" onSubmit={submit}>
        <Section>
          {fields.map((field) => {
            const value = data[field.key];
            const common = { "aria-label": field.label, required: field.required };
            return (
              <FieldRow key={field.key} label={field.label} stacked={field.type === "long_text" || field.type === "text" || field.type === "url" || field.type === "image_url"}>
                {field.type === "long_text" ? (
                  <textarea className="text-area" rows={3} value={String(value ?? "")} onChange={(event) => set(field.key, event.target.value)} {...common} />
                ) : field.type === "boolean" ? (
                  <Toggle label={field.label} checked={value === true || value === "true" || value === 1 || value === "1"} onChange={(on) => set(field.key, on)} />
                ) : field.type === "enum" && field.options?.length ? (
                  <select className="select" value={String(value ?? "")} onChange={(event) => set(field.key, event.target.value)} {...common}>
                    <option value="">—</option>
                    {field.options.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : (
                  <TextInput
                    type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "datetime" ? "datetime-local" : field.type === "url" || field.type === "image_url" ? "url" : "text"}
                    step={field.type === "number" ? "any" : undefined}
                    value={String(value ?? "")}
                    onChange={(event) => set(field.key, event.target.value)}
                    {...common}
                  />
                )}
              </FieldRow>
            );
          })}
        </Section>
        <Section title="Availability" footer="Leave dates empty to always apply. When it is switched off or expired, the assistant stops mentioning it.">
          <FieldRow label="Active">
            <Toggle label="Active" checked={active} onChange={setActive} />
          </FieldRow>
          <FieldRow label="Starts">
            <TextInput type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </FieldRow>
          <FieldRow label="Ends">
            <TextInput type="date" value={until} onChange={(event) => setUntil(event.target.value)} />
          </FieldRow>
        </Section>
        {error && <Banner>{error}</Banner>}
      </form>
    </Sheet>
  );
}

function RenameSheet({ collection, onClose, onDone }: { collection: Collection; onClose: () => void; onDone: () => void }) {
  const fields = fieldsOf(collection);
  const [name, setName] = useState(collection.name);
  const [labels, setLabels] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((field) => [field.key, field.label])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await patch(`/api/admin/collections/${collection.id}`, { name, labels });
      onDone();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      title="Rename"
      onClose={onClose}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>Cancel</Button>
          <Button form="rename-form" busy={busy}>Save</Button>
        </>
      }
    >
      <form id="rename-form" className="sheet-form" onSubmit={submit}>
        <Section>
          <FieldRow label="Table name">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} required />
          </FieldRow>
        </Section>
        <Section title="Column names" footer="Only the names you see change; data and CSV column keys stay the same.">
          {fields.map((field) => (
            <FieldRow key={field.key} label={field.key}>
              <TextInput value={labels[field.key] ?? ""} onChange={(event) => setLabels({ ...labels, [field.key]: event.target.value })} required />
            </FieldRow>
          ))}
        </Section>
        {error && <Banner>{error}</Banner>}
      </form>
    </Sheet>
  );
}

const fieldTypes: Array<[string, string]> = [
  ["text", "Text"],
  ["long_text", "Long text"],
  ["number", "Number"],
  ["boolean", "Yes / No"],
  ["date", "Date"],
  ["datetime", "Date and time"],
  ["enum", "Choice"],
  ["multi_enum", "Multiple choice"],
  ["url", "Link"],
  ["image_url", "Image link"],
  ["relation", "Relation"],
];

// Any label -> ascii identifier that starts with a letter (schema keys and slugs require it).
function identifier(label: string) {
  const ascii = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return /^[a-z]/.test(ascii) ? ascii : `f_${ascii || "field"}`;
}

function CreateCollectionSheet({ onClose, onDone }: { onClose: () => void; onDone: (id: string) => void }) {
  const [name, setName] = useState("");
  const [fields, setFields] = useState<FieldDef[]>([
    { key: "name", label: "Name", type: "text", required: true },
    { key: "price", label: "Price", type: "number", required: false },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (index: number, value: Partial<FieldDef>) => setFields((current) => current.map((field, i) => (i === index ? { ...field, ...value } : field)));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await post<{ id: string }>("/api/admin/collections", { name, slug: identifier(name), description: "", schema: { fields } });
      onDone(result.id);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      title="New table"
      onClose={onClose}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>Cancel</Button>
          <Button form="create-collection" busy={busy} disabled={!name || !fields.length}>Create</Button>
        </>
      }
    >
      <form id="create-collection" className="sheet-form" onSubmit={submit}>
        <Section>
          <FieldRow label="Name">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="Offers" required />
          </FieldRow>
        </Section>
        <Section
          title="Columns"
          action={
            <Button type="button" variant="plain" size="small" icon="plus" onClick={() => setFields((current) => [...current, { key: `field_${current.length + 1}`, label: `Column ${current.length + 1}`, type: "text", required: false }])}>
              Add column
            </Button>
          }
          footer="CSV headers should match the column names in lowercase with underscores, e.g. unit_price."
        >
          {fields.map((field, index) => (
            <div className="row field-editor" key={index}>
              <TextInput aria-label="Column name" value={field.label} placeholder="Column name" onChange={(event) => update(index, { label: event.target.value, key: identifier(event.target.value) })} />
              <select className="select" aria-label="Type" value={field.type} onChange={(event) => update(index, { type: event.target.value })}>
                {fieldTypes.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <Toggle label="Required" checked={Boolean(field.required)} onChange={(required) => update(index, { required })} />
              <button type="button" className="icon-button" aria-label="Remove column" disabled={fields.length === 1} onClick={() => setFields((current) => current.filter((_, i) => i !== index))}>
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
        </Section>
        {error && <Banner>{error}</Banner>}
      </form>
    </Sheet>
  );
}
```

## `src/client/pages/Conversations.tsx`

```tsx
import { useEffect, useState } from "react";
import { api, post } from "../api";
import { previewSnippet } from "../format";
import { RichBubbles, parseRichMessage } from "../RichMessage";
import type { Conversation, TranscriptMessage } from "../types";
import { Banner, EmptyState, PageHeader, Row, SearchField, Section, Spinner, StatusBadge, Toggle, errorMessage, formatDate, useToast } from "../ui";

const previewText = (value?: string) => previewSnippet(value, parseRichMessage);

type Detail = { conversation: Conversation & { custom_json?: string | null }; messages: TranscriptMessage[] };

export function ConversationsPage() {
  const toast = useToast();
  const [items, setItems] = useState<Conversation[] | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  async function load(value = query) {
    setItems(await api<Conversation[]>(`/api/admin/conversations${value ? `?q=${encodeURIComponent(value)}` : ""}`));
  }
  async function open(id: string) {
    setSelectedId(id);
    setDetail(null);
    try {
      setDetail(await api<Detail>(`/api/admin/conversations/${encodeURIComponent(id)}`));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }
  useEffect(() => {
    void load("").catch((caught) => setError(errorMessage(caught)));
  }, []);
  async function setTakeover(conversation: Conversation, enabled: boolean) {
    try {
      await post(`/api/admin/conversations/${encodeURIComponent(conversation.id)}/takeover`, { enabled });
      toast(enabled ? "The assistant stopped replying in this chat" : "The assistant is replying again");
      await load();
      if (selectedId === conversation.id) await open(conversation.id);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }
  const selected = items?.find((item) => item.id === selectedId) ?? detail?.conversation;
  return (
    <div className="page">
      <PageHeader title="Conversations" subtitle="Every customer chat across your channels. Turn on “Your team replies” to pause the assistant in a chat." />
      {error && <Banner onClose={() => setError("")}>{error}</Banner>}
      {items && items.length === 0 && !query ? (
        <EmptyState icon="conversations" title="No conversations yet" text="Chats appear here when customers message you on a connected channel." />
      ) : (
        <div className={`master-detail ${selectedId ? "has-detail" : ""}`}>
          <div className="master">
            <SearchField value={query} onChange={setQuery} onSubmit={() => void load()} placeholder="Search name, phone or customer ID" />
            {!items ? (
              <div className="page-loading"><Spinner /></div>
            ) : items.length === 0 ? (
              <EmptyState icon="search" title="No matches" text="Try another name, phone number or customer ID." />
            ) : (
              <Section>
                {items.map((item) => (
                  <Row
                    key={item.id}
                    icon="person"
                    iconTint={item.human_takeover ? "var(--orange)" : "var(--blue)"}
                    title={item.display_name || item.phone || item.external_user_id}
                    subtitle={previewText(item.last_message_preview)}
                    detail={<small>{formatDate(item.last_activity_at)}</small>}
                    selected={item.id === selectedId}
                    onClick={() => void open(item.id)}
                  />
                ))}
              </Section>
            )}
          </div>
          <div className="detail">
            {!selectedId || !selected ? (
              <EmptyState icon="conversations" title="Choose a conversation" text="See the messages and contact details, and take over when needed." />
            ) : (
              <>
                <button className="back-link mobile-only" onClick={() => setSelectedId(null)}>
                  ‹ Conversations
                </button>
                <Section>
                  <Row title={selected.display_name || selected.external_user_id} subtitle={[selected.phone, selected.email].filter(Boolean).join(" · ") || "No contact details yet"} accessory={<StatusBadge value={selected.stage} />} />
                  <Row
                    title="Your team replies"
                    subtitle="The assistant stays quiet while this is on"
                    accessory={<Toggle label="Your team replies" checked={Boolean(selected.human_takeover)} onChange={(enabled) => void setTakeover(selected, enabled)} />}
                  />
                </Section>
                <div className="transcript">
                  {!detail ? (
                    <div className="page-loading"><Spinner /></div>
                  ) : detail.messages.length === 0 ? (
                    <p className="text-secondary center">No messages yet.</p>
                  ) : (
                    detail.messages.map((message) => (
                      <div className={`message-row ${message.role === "user" ? "user" : "assistant"}`} key={message.id}>
                        <RichBubbles role={message.role === "user" ? "user" : "assistant"} text={message.content} />
                        <time>{formatDate(message.created_at)}</time>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

## `src/client/pages/Connections.tsx`

```tsx
import { useEffect, useState, type FormEvent } from "react";
import { api, post } from "../api";
import type { AgentSummary, Connection, Delivery } from "../types";
import { Banner, Button, CopyField, EmptyState, FieldRow, PageHeader, Row, Section, Segmented, Sheet, StatusBadge, TextInput, errorMessage, formatDate, useToast } from "../ui";

type ConnectionType = "generic_api" | "generic_webhook" | "zernio";

const typeInfo: Record<ConnectionType, { label: string; icon: string; tint: string; description: string }> = {
  generic_api: { label: "API", icon: "bolt", tint: "var(--blue)", description: "Your website, app or CRM sends customer messages over HTTP and gets replies instantly or by callback." },
  generic_webhook: { label: "Webhook", icon: "connections", tint: "var(--purple)", description: "Receive HMAC-signed events from another system; replies go to your callback URL." },
  zernio: { label: "Zernio", icon: "conversations", tint: "var(--green)", description: "Connect a Zernio inbox so the assistant replies to customer messages there." },
};

type Secrets = { apiKey?: string; webhookToken?: string; webhookPath?: string; type: ConnectionType };

export function ConnectionsPage({ agent, connections, reload }: { agent: AgentSummary; connections: Connection[]; reload: () => Promise<void> }) {
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [secrets, setSecrets] = useState<Secrets | null>(null);
  const [opened, setOpened] = useState<Connection | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [error, setError] = useState("");
  async function loadDeliveries() {
    setDeliveries(await api<Delivery[]>("/api/admin/deliveries"));
  }
  useEffect(() => {
    void loadDeliveries().catch(() => undefined);
  }, []);
  const failed = deliveries.filter((delivery) => delivery.status === "failed");
  return (
    <div className="page">
      <PageHeader
        title="Channels"
        subtitle="Where customers reach your assistant. Every channel uses the same assistant and the live version."
        actions={
          <Button icon="plus" onClick={() => setCreating(true)}>
            Add channel
          </Button>
        }
      />
      {!agent.active_version_id && <Banner tone="orange">Publish the assistant first so channels can reply.</Banner>}
      {error && <Banner onClose={() => setError("")}>{error}</Banner>}
      {failed.length > 0 && (
        <Section title={`Replies not delivered · ${failed.length}`} footer="Retrying is safe: each reply keeps the same idempotency key, so customers never get duplicates.">
          {failed.map((delivery) => (
            <Row
              key={delivery.id}
              icon="warning"
              iconTint="var(--red)"
              title={connections.find((connection) => connection.id === delivery.connection_id)?.name ?? "Channel"}
              subtitle={`${delivery.last_error ?? "Unknown error"} · ${delivery.attempts} attempts · ${formatDate(delivery.updated_at)}`}
              accessory={
                <Button
                  variant="gray"
                  size="small"
                  icon="refresh"
                  onClick={async () => {
                    try {
                      await post(`/api/admin/deliveries/${delivery.id}/retry`);
                      toast("Queued to send again");
                      await loadDeliveries();
                    } catch (caught) {
                      setError(errorMessage(caught));
                    }
                  }}
                >
                  Retry
                </Button>
              }
            />
          ))}
        </Section>
      )}
      {connections.length === 0 ? (
        <EmptyState icon="connections" title="No channels yet" text="Connect your website or app through the API, or connect a Zernio inbox." action={<Button onClick={() => setCreating(true)}>Add channel</Button>} />
      ) : (
        <Section>
          {connections.map((connection) => {
            const info = typeInfo[connection.type as ConnectionType] ?? typeInfo.generic_api;
            return (
              <Row
                key={connection.id}
                icon={info.icon}
                iconTint={info.tint}
                title={connection.name}
                subtitle={info.label}
                accessory={<StatusBadge value={connection.status} />}
                chevron
                onClick={() => setOpened(connection)}
              />
            );
          })}
        </Section>
      )}
      {creating && (
        <CreateConnectionSheet
          agent={agent}
          onClose={() => setCreating(false)}
          onDone={async (value) => {
            setCreating(false);
            setSecrets(value);
            await reload();
          }}
        />
      )}
      {secrets && <SecretsSheet secrets={secrets} onClose={() => setSecrets(null)} />}
      {opened && (
        <ConnectionSheet
          connection={opened}
          onClose={() => setOpened(null)}
          onSecrets={(value) => {
            setOpened(null);
            setSecrets(value);
          }}
          reload={async () => {
            await reload();
            setOpened(null);
          }}
        />
      )}
    </div>
  );
}

function CreateConnectionSheet({ agent, onClose, onDone }: { agent: AgentSummary; onClose: () => void; onDone: (secrets: Secrets) => void }) {
  const [type, setType] = useState<ConnectionType>("generic_api");
  const [form, setForm] = useState({ name: "", callbackUrl: "", inboxApiUrl: "", apiCredential: "", webhookSecret: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await post<{ id: string; apiKey: string; webhookToken: string; webhookPath: string }>("/api/admin/connections", {
        agentId: agent.id,
        type,
        name: form.name || typeInfo[type].label,
        callbackUrl: type === "zernio" ? null : form.callbackUrl || null,
        config: type === "zernio" ? { inboxApiUrl: form.inboxApiUrl } : {},
        apiCredential: type === "zernio" ? form.apiCredential : undefined,
        webhookSecret: type !== "generic_api" ? form.webhookSecret || undefined : undefined,
      });
      // Activate right away when the assistant is live; otherwise it waits for the first publish.
      if (agent.active_version_id) await post(`/api/admin/connections/${result.id}/activate`).catch(() => undefined);
      onDone({ type, apiKey: type === "generic_api" ? result.apiKey : undefined, webhookToken: type === "generic_api" ? undefined : result.webhookToken, webhookPath: type === "generic_api" ? undefined : result.webhookPath });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  const valid = type !== "zernio" || (form.inboxApiUrl && form.apiCredential && form.webhookSecret);
  return (
    <Sheet
      title="Add channel"
      onClose={onClose}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>Cancel</Button>
          <Button form="create-connection" busy={busy} disabled={!valid}>Add</Button>
        </>
      }
    >
      <form id="create-connection" className="sheet-form" onSubmit={submit}>
        <Segmented<ConnectionType>
          label="Channel type"
          value={type}
          onChange={setType}
          options={[
            { value: "generic_api", label: "API" },
            { value: "zernio", label: "Zernio" },
            { value: "generic_webhook", label: "Webhook" },
          ]}
        />
        <p className="sheet-text">{typeInfo[type].description}</p>
        <Section>
          <FieldRow label="Name">
            <TextInput value={form.name} placeholder={typeInfo[type].label} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </FieldRow>
          {type !== "zernio" && (
            <FieldRow label="Callback URL" hint={type === "generic_api" ? "Optional, for async replies" : undefined}>
              <TextInput type="url" value={form.callbackUrl} placeholder="https://" onChange={(event) => setForm({ ...form, callbackUrl: event.target.value })} />
            </FieldRow>
          )}
          {type === "generic_webhook" && (
            <FieldRow label="Signing secret">
              <TextInput type="password" autoComplete="off" value={form.webhookSecret} onChange={(event) => setForm({ ...form, webhookSecret: event.target.value })} />
            </FieldRow>
          )}
        </Section>
        {type === "zernio" && (
          <Section footer="The token and signing secret are encrypted when saved and never shown again.">
            <FieldRow label="Inbox API URL">
              <TextInput type="url" value={form.inboxApiUrl} placeholder="https://" onChange={(event) => setForm({ ...form, inboxApiUrl: event.target.value })} required />
            </FieldRow>
            <FieldRow label="API token">
              <TextInput type="password" autoComplete="off" value={form.apiCredential} onChange={(event) => setForm({ ...form, apiCredential: event.target.value })} required />
            </FieldRow>
            <FieldRow label="Webhook signing secret">
              <TextInput type="password" autoComplete="off" value={form.webhookSecret} onChange={(event) => setForm({ ...form, webhookSecret: event.target.value })} required />
            </FieldRow>
          </Section>
        )}
        {error && <Banner>{error}</Banner>}
      </form>
    </Sheet>
  );
}

function SecretsSheet({ secrets, onClose }: { secrets: Secrets; onClose: () => void }) {
  const origin = window.location.origin;
  return (
    <Sheet title="Save these details" onClose={onClose} footer={<Button onClick={onClose}>Done</Button>}>
      <Banner tone="orange">The key is shown only once. Save it now in your integration or password manager.</Banner>
      {secrets.apiKey && (
        <>
          <CopyField label="Endpoint" value={`${origin}/api/v1/messages`} />
          <CopyField label="API key (Bearer)" value={secrets.apiKey} />
        </>
      )}
      {secrets.webhookPath && <CopyField label="Webhook URL" value={`${origin}${secrets.webhookPath}`} />}
    </Sheet>
  );
}

function ConnectionSheet({ connection, onClose, onSecrets, reload }: { connection: Connection; onClose: () => void; onSecrets: (secrets: Secrets) => void; reload: () => Promise<void> }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [error, setError] = useState("");
  const type = (connection.type as ConnectionType) in typeInfo ? (connection.type as ConnectionType) : "generic_api";
  const origin = window.location.origin;
  return (
    <Sheet title={connection.name} onClose={onClose}>
      <Section>
        <Row title="Type" detail={typeInfo[type].label} />
        <Row title="Status" accessory={<StatusBadge value={connection.status} />} />
        {connection.callback_url && <Row title="Callback" subtitle={connection.callback_url} />}
        <Row title="Created" detail={formatDate(connection.created_at)} />
      </Section>
      {type === "generic_api" && (
        <Section title="How to call it" plain>
          <pre className="code-block">{`POST ${origin}/api/v1/messages
Authorization: Bearer <API key>
Idempotency-Key: <unique id per message>

{ "conversation_id": "customer-123",
  "user_id": "customer-123",
  "message": { "text": "Hello" } }`}</pre>
        </Section>
      )}
      {error && <Banner>{error}</Banner>}
      <div className="sheet-actions">
        {connection.status !== "active" && (
          <Button
            busy={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await post(`/api/admin/connections/${connection.id}/activate`);
                toast("Channel turned on");
                await reload();
              } catch (caught) {
                setError(errorMessage(caught));
              } finally {
                setBusy(false);
              }
            }}
          >
            Turn on
          </Button>
        )}
        {confirmRotate ? (
          <>
            <p className="sheet-text">The current key stops working immediately. Anything using it is rejected until you update it with the new key.</p>
            <Button
              variant="destructive"
              busy={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await post<{ apiKey: string; webhookToken: string }>(`/api/admin/connections/${connection.id}/rotate`);
                  onSecrets(
                    type === "generic_api"
                      ? { type, apiKey: result.apiKey }
                      : { type, webhookToken: result.webhookToken, webhookPath: `/api/v1/webhooks/${type === "zernio" ? "zernio" : "generic"}/${result.webhookToken}` },
                  );
                } catch (caught) {
                  setError(errorMessage(caught));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Create new key
            </Button>
          </>
        ) : (
          <Button variant="gray" onClick={() => setConfirmRotate(true)}>
            {type === "generic_api" ? "Replace API key" : "Replace webhook URL"}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
```

## `src/client/pages/Settings.tsx`

```tsx
import { useState } from "react";
import { patch, post } from "../api";
import type { Brand } from "../types";
import { Banner, Button, FieldRow, PageHeader, Row, Section, TextInput, errorMessage, useToast } from "../ui";
import { modelLabel } from "./Assistant";

export function SettingsPage({
  brand,
  modelDefaults,
  model,
  reload,
  logout,
}: {
  brand: Brand;
  modelDefaults: Record<string, unknown>;
  model?: string;
  reload: () => Promise<void>;
  logout: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState(brand);
  const [credential, setCredential] = useState({
    apiKey: "",
    accountId: String(modelDefaults.accountId ?? ""),
    gatewayId: String(modelDefaults.gatewayId ?? "default"),
  });
  const [busy, setBusy] = useState<"" | "brand" | "key" | "test">("");
  const [error, setError] = useState("");
  const brandChanged = JSON.stringify(form) !== JSON.stringify(brand);
  const hasKey = Boolean(modelDefaults.credentialId);
  async function run(kind: "brand" | "key" | "test", action: () => Promise<void>) {
    setBusy(kind);
    setError("");
    try {
      await action();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="page narrow">
      <PageHeader title="Settings" />
      {error && <Banner onClose={() => setError("")}>{error}</Banner>}
      <Section title="AI" footer="Your Anthropic API key is encrypted when saved and never shown again. After changing it, publish the assistant so customers use the new key.">
        <Row title="Status" detail={hasKey ? "API key saved" : "No API key yet"} />
        <FieldRow label={hasKey ? "New API key" : "API key"}>
          <TextInput type="password" autoComplete="off" value={credential.apiKey} placeholder="sk-ant-…" onChange={(event) => setCredential({ ...credential, apiKey: event.target.value })} />
        </FieldRow>
        <details className="advanced in-group">
          <summary>Advanced</summary>
          <FieldRow label="Cloudflare account ID">
            <TextInput value={credential.accountId} onChange={(event) => setCredential({ ...credential, accountId: event.target.value })} />
          </FieldRow>
          <FieldRow label="AI Gateway ID">
            <TextInput value={credential.gatewayId} onChange={(event) => setCredential({ ...credential, gatewayId: event.target.value })} />
          </FieldRow>
        </details>
        <div className="row row-actions">
          <Button
            variant="gray"
            size="small"
            busy={busy === "test"}
            disabled={!hasKey}
            onClick={() =>
              void run("test", async () => {
                const result = await post<{ connected: boolean; model: string }>("/api/admin/settings/anthropic/test", model ? { model } : {});
                toast(result.connected ? `Connected · ${modelLabel(result.model)}` : "Couldn't connect", result.connected ? "default" : "error");
              })
            }
          >
            Test connection
          </Button>
          <Button
            size="small"
            busy={busy === "key"}
            disabled={credential.apiKey.length < 10 || !credential.accountId || !credential.gatewayId}
            onClick={() =>
              void run("key", async () => {
                await post("/api/admin/settings/anthropic", credential);
                setCredential({ ...credential, apiKey: "" });
                await reload();
                toast("API key saved");
              })
            }
          >
            Save
          </Button>
        </div>
      </Section>
      <Section title="Brand" footer="Shown on the sign-in screen and the sidebar. Changes apply immediately.">
        <FieldRow label="Name">
          <TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </FieldRow>
        <FieldRow label="Accent color">
          <input className="color-input" type="color" value={form.primaryColor} onChange={(event) => setForm({ ...form, primaryColor: event.target.value })} />
        </FieldRow>
        <FieldRow label="Logo URL">
          <TextInput type="url" value={form.logoUrl} onChange={(event) => setForm({ ...form, logoUrl: event.target.value })} placeholder="https://" />
        </FieldRow>
        <FieldRow label="Support page">
          <TextInput type="url" value={form.supportUrl} onChange={(event) => setForm({ ...form, supportUrl: event.target.value })} placeholder="https://" />
        </FieldRow>
        {brandChanged && (
          <div className="row row-actions">
            <Button variant="gray" size="small" onClick={() => setForm(brand)}>Cancel</Button>
            <Button
              size="small"
              busy={busy === "brand"}
              onClick={() =>
                void run("brand", async () => {
                  await patch("/api/admin/settings/brand", form);
                  await reload();
                  toast("Brand saved");
                })
              }
            >
              Save
            </Button>
          </div>
        )}
      </Section>
      <Section title="Backup" footer="Includes the assistant setup, versions, data and test scenarios. Never includes keys or passwords.">
        <a className="row row-button" href="/api/admin/export" download>
          <span className="row-text">
            <span className="row-title text-tint">Download backup (JSON)</span>
          </span>
        </a>
      </Section>
      <Section>
        <button className="row row-button" onClick={logout}>
          <span className="row-text">
            <span className="row-title text-red">Sign out</span>
          </span>
        </button>
      </Section>
    </div>
  );
}
```

## `src/client/pages/Auth.tsx`

```tsx
import { useState, type FormEvent } from "react";
import { post, setCsrf } from "../api";
import type { Brand } from "../types";
import { Banner, Button, FieldRow, Section, TextInput, errorMessage } from "../ui";

export function AppIcon({ brand, size = 64 }: { brand: Brand; size?: number }) {
  return (
    <span className="app-icon" style={{ width: size, height: size, borderRadius: size * 0.225, background: brand.logoUrl ? "#fff" : brand.primaryColor }}>
      {brand.logoUrl ? <img src={brand.logoUrl} alt="" /> : <b style={{ fontSize: size * 0.42 }}>{brand.name.slice(0, 1)}</b>}
    </span>
  );
}

export function Setup({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<0 | 1>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    bootstrapToken: "",
    email: "",
    password: "",
    name: "",
    logoUrl: "",
    primaryColor: "#007aff",
    supportUrl: "",
    anthropicApiKey: "",
    accountId: "",
    gatewayId: "default",
  });
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await post<{ csrfToken: string }>("/api/setup", {
        bootstrapToken: form.bootstrapToken,
        email: form.email,
        password: form.password,
        brand: { name: form.name, logoUrl: form.logoUrl, primaryColor: form.primaryColor, supportUrl: form.supportUrl },
        anthropicApiKey: form.anthropicApiKey || undefined,
        accountId: form.accountId || undefined,
        gatewayId: form.gatewayId || undefined,
      });
      setCsrf(result.csrfToken);
      onDone();
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't finish setup"));
    } finally {
      setBusy(false);
    }
  }
  const brand: Brand = { name: form.name || "A", logoUrl: form.logoUrl, primaryColor: form.primaryColor, supportUrl: form.supportUrl };
  return (
    <main className="auth-screen">
      <form className="auth-panel wide" onSubmit={submit}>
        <AppIcon brand={brand} />
        <p className="step-label">Step {step + 1} of 2</p>
        <h1>{step === 0 ? "Create your admin account" : "Brand and AI"}</h1>
        <p className="auth-lead">
          {step === 0 ? "Use the one-time setup code to create the single admin account for this workspace." : "You can change all of this later in Settings."}
        </p>
        {step === 0 ? (
          <Section footer="At least 12 characters. Save it in your password manager.">
            <FieldRow label="Setup code">
              <TextInput type="password" autoComplete="off" value={form.bootstrapToken} onChange={(e) => update("bootstrapToken", e.target.value)} required />
            </FieldRow>
            <FieldRow label="Email">
              <TextInput type="email" autoComplete="username" value={form.email} onChange={(e) => update("email", e.target.value)} required />
            </FieldRow>
            <FieldRow label="Password">
              <TextInput type="password" autoComplete="new-password" minLength={12} value={form.password} onChange={(e) => update("password", e.target.value)} required />
            </FieldRow>
          </Section>
        ) : (
          <>
            <Section title="Brand">
              <FieldRow label="Name">
                <TextInput value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Your business" required />
              </FieldRow>
              <FieldRow label="Accent color">
                <input className="color-input" type="color" value={form.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} />
              </FieldRow>
              <FieldRow label="Logo URL">
                <TextInput type="url" value={form.logoUrl} onChange={(e) => update("logoUrl", e.target.value)} placeholder="https://" />
              </FieldRow>
              <FieldRow label="Support page">
                <TextInput type="url" value={form.supportUrl} onChange={(e) => update("supportUrl", e.target.value)} placeholder="https://" />
              </FieldRow>
            </Section>
            <Section title="Anthropic" footer="The API key is encrypted before it is stored and is never shown again.">
              <FieldRow label="API key">
                <TextInput type="password" autoComplete="off" value={form.anthropicApiKey} onChange={(e) => update("anthropicApiKey", e.target.value)} placeholder="sk-ant-…" />
              </FieldRow>
              <FieldRow label="Cloudflare account ID">
                <TextInput value={form.accountId} onChange={(e) => update("accountId", e.target.value)} />
              </FieldRow>
              <FieldRow label="AI Gateway ID">
                <TextInput value={form.gatewayId} onChange={(e) => update("gatewayId", e.target.value)} />
              </FieldRow>
            </Section>
          </>
        )}
        {error && <Banner>{error}</Banner>}
        <div className="auth-actions">
          {step === 1 && (
            <Button type="button" variant="gray" size="large" onClick={() => setStep(0)}>
              Back
            </Button>
          )}
          {step === 0 ? (
            <Button type="button" size="large" onClick={() => setStep(1)} disabled={!form.bootstrapToken || !form.email || form.password.length < 12}>
              Continue
            </Button>
          ) : (
            <Button size="large" busy={busy}>
              Finish
            </Button>
          )}
        </div>
      </form>
    </main>
  );
}

export function Login({ brand, onDone }: { brand: Brand; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await post<{ csrfToken: string }>("/api/auth/login", { email, password });
      setCsrf(result.csrfToken);
      onDone();
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't sign in"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-screen">
      <form className="auth-panel" onSubmit={submit}>
        <AppIcon brand={brand} />
        <h1>{brand.name}</h1>
        <p className="auth-lead">Sign in to manage your AI assistant.</p>
        <Section>
          <FieldRow label="Email">
            <TextInput type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </FieldRow>
          <FieldRow label="Password">
            <TextInput type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </FieldRow>
        </Section>
        {error && <Banner>{error}</Banner>}
        <div className="auth-actions">
          <Button size="large" busy={busy}>
            Sign in
          </Button>
        </div>
      </form>
    </main>
  );
}
```
