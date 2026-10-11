import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { formatDate } from "./format";
import { iconPaths, logoPaths } from "./icons";

export { formatDate };

// Names used before v2 keep working; they map onto the Apps SDK UI glyphs in icons.ts.
const aliases: Record<string, string> = {
  house: "home",
  overview: "home",
  sparkles: "sparkle",
  data: "table",
  bubbles: "chats",
  conversations: "chats",
  connections: "link",
  channels: "link",
  gear: "settings",
  chevron: "chevron-right",
  back: "chevron-left",
  xmark: "x",
  close: "x",
  ellipsis: "dots",
  refresh: "reload",
  send: "arrow-up",
  doc: "document",
  person: "user",
  "person-plus": "user-add",
  team: "users",
  webhook: "branch",
  inbox: "mail",
  palette: "color",
  signout: "logout",
  "eye-slash": "eye-off",
  pencil: "edit",
  offline: "unlink",
  "check-bubble": "chat",
};

export function Icon({ name, size = 20, label, className }: { name: string; size?: number; label?: string; className?: string }) {
  return (
    <svg
      className={`icon${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
      viewBox="0 0 24 24"
      fill="currentColor"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      dangerouslySetInnerHTML={{ __html: iconPaths[aliases[name] ?? name] ?? "" }}
    />
  );
}

// ---------- Platform marks (Simple Icons, CC0) — only to identify the platform ----------

const builtInPlatforms: Record<string, string> = { api: "link", web: "website", website: "website", webhook: "branch", email: "mail" };

export function BrandLogo({ platform, size, label, className }: { platform: string; size?: "sm" | "lg"; label?: string; className?: string }) {
  const key = platform.toLowerCase();
  const mark = logoPaths[key];
  const neutral = !mark;
  return (
    <span className={`logo logo-${neutral ? (key === "web" || key === "website" ? "web" : "api") : key}${size ? ` ${size}` : ""}${className ? ` ${className}` : ""}`} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {mark ? <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: mark }} /> : <Icon name={builtInPlatforms[key] ?? "link"} />}
    </span>
  );
}

// ---------- Avatars ----------

export const initialsOf = (name?: string) =>
  (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

// Pastel square per assistant; the color is stable for a given id.
export function AgentAvatar({ id, name, size }: { id: string; name: string; size?: "sm" | "xs" | "lg" }) {
  const tone = (Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5) + 1;
  const style = size === "lg" ? { width: 56, height: 56, borderRadius: "var(--radius-xl)", fontSize: 18 } : undefined;
  return (
    <span className={`agent-av av-${tone}${size && size !== "lg" ? ` ${size}` : ""}`} style={style} aria-hidden="true">
      {initialsOf(name) || "AI"}
    </span>
  );
}

export function Avatar({ name, icon, platform }: { name?: string; tone?: string; icon?: string; platform?: string }) {
  const initials = initialsOf(name);
  return (
    <span className="avatar" aria-hidden="true">
      {icon || !initials ? <Icon name={icon ?? "user"} /> : initials}
      {platform && <BrandLogo platform={platform} size="sm" className="avatar-badge" />}
    </span>
  );
}

// ---------- Button ----------

type ButtonVariant = "primary" | "outline" | "soft" | "ghost" | "danger" | "danger-ghost" | "link";
type ButtonSize = "sm" | "md" | "lg" | "xl";

// One primary button per screen. Busy keeps the label (and width) and shows a spinner in place of the icon.
// `destructive` turns primary into danger and anything else into danger-ghost.
export function Button({
  variant = "primary",
  size = "md",
  icon,
  busy,
  destructive,
  block,
  children,
  className,
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  busy?: boolean;
  destructive?: boolean;
  block?: boolean;
}) {
  const iconOnly = !children && Boolean(icon);
  const resolved = destructive ? (variant === "primary" || variant === "danger" ? "danger" : "danger-ghost") : variant;
  const classes = [`btn btn-${resolved}`, size !== "md" && `btn-${size}`, iconOnly && "btn-icon", block && "btn-block", className].filter(Boolean).join(" ");
  return (
    <button
      className={classes}
      {...props}
      aria-busy={busy || undefined}
      aria-disabled={busy || undefined}
      onClick={(event) => {
        if (busy) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {busy ? <Spinner /> : icon && <Icon name={icon} size={size === "sm" ? 16 : 18} />}
      {children && <span>{children}</span>}
    </button>
  );
}

export function Spinner({ large = false, label = "Loading" }: { large?: boolean; label?: string }) {
  return <span className={`spinner${large ? " spinner-lg" : ""}`} role="status" aria-label={label} />;
}

// ---------- Page ----------

export function StatusLine({ tone = "gray", children }: { tone?: "green" | "orange" | "gray" | "red"; children: ReactNode }) {
  return (
    <p className="status xs" style={{ margin: 0 }}>
      <span className={`dot dot-${tone}`} aria-hidden="true" />
      <span className="truncate">{children}</span>
    </p>
  );
}

export function PageHeader({
  title,
  subtitle,
  status,
  actions,
  onBack,
  backLabel,
}: {
  title: string;
  subtitle?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <header className="page-header">
      <div className="stack" style={{ gap: 2 }}>
        {onBack && (
          <nav className="crumbs xs" aria-label="Breadcrumb">
            <button type="button" onClick={onBack}>
              {backLabel ?? "Back"}
            </button>
            <Icon name="chevron-right" size={14} />
          </nav>
        )}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
        {status}
      </div>
      {actions && <div className="row-flex">{actions}</div>}
    </header>
  );
}

// ---------- Card (replaces the inset grouped Section) ----------

export function Card({
  title,
  footer,
  action,
  badge,
  sub,
  children,
  padded,
  className,
  label,
}: {
  title?: ReactNode;
  footer?: ReactNode;
  action?: ReactNode;
  badge?: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
  padded?: boolean;
  className?: string;
  label?: string;
}) {
  return (
    <section className={`card${className ? ` ${className}` : ""}`} aria-label={label}>
      {(title || action) && (
        <div className="card-head">
          <div className="stack spacer" style={{ gap: 0 }}>
            <h2 className="card-title row-flex">
              {title}
              {badge}
            </h2>
            {sub && <span className="xs t3">{sub}</span>}
          </div>
          {action}
        </div>
      )}
      {padded ? <div className="card-body">{children}</div> : children}
      {footer && <div className="card-foot">{footer}</div>}
    </section>
  );
}

// ---------- Row ----------

export type TileTone = "default" | "success" | "warning" | "danger" | "info" | "discovery";

export function Tile({ icon, tone = "default", large }: { icon: string; tone?: TileTone; large?: boolean }) {
  return (
    <span className={`tile${tone !== "default" ? ` tile-${tone}` : ""}${large ? " tile-lg" : ""}`} aria-hidden="true">
      <Icon name={icon} size={large ? 22 : 18} />
    </span>
  );
}

export function Row({
  icon,
  tone,
  avatar,
  title,
  strong,
  subtitle,
  clamp2,
  multiline,
  detail,
  accessory,
  onClick,
  href,
  download,
  chevron,
  selected,
  top,
  compact,
  label,
}: {
  icon?: string;
  tone?: TileTone;
  avatar?: ReactNode;
  title: ReactNode;
  strong?: boolean;
  subtitle?: ReactNode;
  clamp2?: boolean;
  multiline?: boolean;
  detail?: ReactNode;
  accessory?: ReactNode;
  onClick?: () => void;
  href?: string;
  download?: boolean;
  chevron?: boolean;
  selected?: boolean;
  top?: boolean;
  compact?: boolean;
  label?: string;
}) {
  const className = ["row", compact && "compact", selected && "is-selected", (top || clamp2 || multiline) && "top"].filter(Boolean).join(" ");
  const content = (
    <>
      {avatar}
      {icon && !avatar && <Tile icon={icon} tone={tone} />}
      <span className="row-text">
        <span className={`row-title${strong ? " strong" : ""}`}>{title}</span>
        {subtitle && <span className={`row-sub${clamp2 ? " clamp-2" : multiline ? "" : " truncate"}`}>{subtitle}</span>}
      </span>
      {detail !== undefined && detail !== null && <span className="row-meta">{detail}</span>}
      {accessory}
      {chevron && <Icon name="chevron-right" className="chev" size={16} />}
    </>
  );
  if (href)
    return (
      <a className={className} href={href} download={download || undefined} aria-label={label}>
        {content}
      </a>
    );
  if (onClick)
    return (
      <button type="button" className={className} onClick={onClick} aria-label={label} aria-current={selected || undefined}>
        {content}
      </button>
    );
  return <div className={className}>{content}</div>;
}

// ---------- Field (label above) ----------

export function Field({ label, hint, children, hideLabel, counter }: { label: string; hint?: ReactNode; children: ReactNode; hideLabel?: boolean; counter?: ReactNode }) {
  return (
    <label className="field">
      <span className={hideLabel ? "sr-only" : "field-label row-flex"}>
        <span className="spacer">{label}</span>
        {counter && <span className="counter">{counter}</span>}
      </span>
      {children}
      {hint && <span className="help">{hint}</span>}
    </label>
  );
}

// A setting with its label on the left and a control on the right (Switch, Segmented, Select).
export function SettingRow({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="field-row">
      <span className="stack" style={{ gap: 0 }}>
        <span className="medium">{title}</span>
        {sub && <span className="xs t3">{sub}</span>}
      </span>
      {children}
    </div>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input${className ? ` ${className}` : ""}`} {...props} />;
}

const supportsFieldSizing = typeof CSS !== "undefined" && CSS.supports?.("field-sizing", "content");

// Grows with its content (no inner scroll, no resize grip); JS fallback where field-sizing is missing.
export function TextArea({ className, mono, value, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || supportsFieldSizing) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} className={`textarea${mono ? " mono" : ""}${className ? ` ${className}` : ""}`} value={value} {...props} />;
}

export function Select({ className, children, block = true, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { block?: boolean }) {
  return (
    <span className="select-wrap" style={block ? { display: "flex" } : undefined}>
      <select className={`select${className ? ` ${className}` : ""}`} {...props}>
        {children}
      </select>
      <Icon name="chevron-down" size={16} />
    </span>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="switch"
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
    />
  );
}

// ---------- Segmented (pill), Tabs (underline), Chips ----------

function useArrowKeys<T extends string>(values: T[], value: T, onChange: (value: T) => void) {
  return (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const index = values.indexOf(value);
    const next = values[(index + (event.key === "ArrowRight" ? 1 : values.length - 1)) % values.length];
    onChange(next);
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(":scope > button");
    buttons?.[values.indexOf(next)]?.focus();
  };
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  full,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
  full?: boolean;
}) {
  const onKeyDown = useArrowKeys(
    options.map((option) => option.value),
    value,
    onChange,
  );
  return (
    <div className={`segmented${full ? " full" : ""}`} role="tablist" aria-label={label}>
      {options.map((option) => (
        <button type="button" key={option.value} role="tab" aria-selected={option.value === value} tabIndex={option.value === value ? 0 : -1} onClick={() => onChange(option.value)} onKeyDown={onKeyDown}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  options,
  onChange,
  label,
  scroll,
}: {
  value: T;
  options: Array<{ value: T; label: ReactNode; hint?: string }>;
  onChange: (value: T) => void;
  label: string;
  scroll?: boolean;
}) {
  const onKeyDown = useArrowKeys(
    options.map((option) => option.value),
    value,
    onChange,
  );
  const list = useRef<HTMLDivElement>(null);
  // Scrolling tabs (phone): keep the selected one in view.
  useEffect(() => {
    if (scroll) list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [scroll, value]);
  return (
    <div ref={list} className={`tabs${scroll ? " scroll" : ""}`} role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          role="tab"
          aria-selected={option.value === value}
          aria-label={option.hint}
          tabIndex={option.value === value ? 0 : -1}
          onClick={() => onChange(option.value)}
          onKeyDown={onKeyDown}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string; count?: number }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((option) => (
        <button type="button" key={option.value} className="chip" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
          {option.count !== undefined && <span className="count tabular">{option.count}</span>}
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
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <form
      className={`search${className ? ` ${className}` : ""}`}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <Icon name="search" size={16} />
      <input type="search" value={value} placeholder={placeholder} aria-label={placeholder} onChange={(event) => onChange(event.target.value)} />
    </form>
  );
}

// ---------- Badge, status ----------

type BadgeTone = "success" | "warning" | "danger" | "info" | "discovery" | "neutral" | "outline" | "example";
const badgeAlias: Record<string, BadgeTone> = { green: "success", orange: "warning", red: "danger", blue: "info", indigo: "discovery", gray: "neutral" };

export function Badge({ tone = "neutral", count, children }: { tone?: BadgeTone | "green" | "orange" | "red" | "blue" | "indigo" | "gray"; count?: boolean; children: ReactNode }) {
  if (count) return <span className="badge badge-count">{children}</span>;
  const resolved = badgeAlias[tone] ?? (tone as BadgeTone);
  const className = resolved === "neutral" ? "badge" : resolved === "example" ? "badge example" : `badge badge-${resolved}`;
  return <span className={className}>{children}</span>;
}

export type LeadStatusValue = "new" | "called" | "won" | "not_fit";
const leadStatusLabel: Record<LeadStatusValue, string> = { new: "New", called: "Called", won: "Won", not_fit: "Not a fit" };

export function LeadStatus({ status }: { status: LeadStatusValue }) {
  return <span className={`lead-status ls-${status === "not_fit" ? "lost" : status}`}>{leadStatusLabel[status]}</span>;
}

export function TypingDots({ label = "Typing" }: { label?: string }) {
  return (
    <div className="typing-dots" role="status" aria-label={label}>
      <span />
      <span />
      <span />
    </div>
  );
}

// ---------- Alert (banner) ----------

type AlertTone = "info" | "warning" | "danger" | "success";
const alertAlias: Record<string, AlertTone> = { error: "danger", red: "danger", orange: "warning", blue: "info", green: "success" };
const alertIcon: Record<AlertTone, string> = { info: "info", warning: "warning", danger: "error", success: "check-circle" };

// Warnings and errors say what happened and offer the next step (actions).
export function Alert({
  tone = "danger",
  title,
  text,
  actions,
  children,
  onClose,
  icon,
}: {
  tone?: AlertTone | "error" | "red" | "orange" | "blue" | "green";
  title?: ReactNode;
  text?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  onClose?: () => void;
  icon?: string;
}) {
  const resolved = alertAlias[tone] ?? (tone as AlertTone);
  return (
    <div className={`alert-box alert-${resolved}`} role={resolved === "danger" ? "alert" : "status"}>
      <Icon name={icon ?? alertIcon[resolved]} />
      <div className="alert-body">
        {title && <span className="alert-title">{title}</span>}
        {text && <span className="alert-text">{text}</span>}
        {children && <div className="alert-text">{children}</div>}
        {actions && <div className="alert-actions">{actions}</div>}
      </div>
      {onClose && <Button type="button" variant="ghost" size="sm" icon="x" aria-label="Dismiss" onClick={onClose} />}
    </div>
  );
}

// ---------- Dialog layer: focus trap, Esc for the top layer only, focus returns to the opener ----------

const layers: symbol[] = [];
const focusable = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useDialog(ref: RefObject<HTMLElement | null>, onClose: () => void, initial?: string) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const layer = Symbol("layer");
    layers.push(layer);
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = (initial && node?.querySelector<HTMLElement>(initial)) || node;
    first?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (layers[layers.length - 1] !== layer || !node) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        close.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = [...node.querySelectorAll<HTMLElement>(focusable)].filter((item) => item.offsetParent !== null);
      if (!items.length) return;
      const [start, end] = [items[0], items[items.length - 1]];
      if (event.shiftKey && (document.activeElement === start || document.activeElement === node)) {
        event.preventDefault();
        end.focus();
      } else if (!event.shiftKey && document.activeElement === end) {
        event.preventDefault();
        start.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      layers.splice(layers.indexOf(layer), 1);
      previous?.focus?.();
    };
  }, [ref, initial]);
}

// Modal sheet (center on desktop, bottom sheet on phone). `drawer` docks it to the right edge instead.
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
  lang,
  drawer,
  wide,
  leading,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  lang?: string;
  drawer?: boolean;
  wide?: boolean;
  leading?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialog(ref, onClose, "[data-autofocus]");
  return (
    <div className={drawer ? "drawer-backdrop" : "sheet-backdrop"} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={drawer ? "drawer" : `sheet${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1}>
        {!drawer && <span className="sheet-grabber" aria-hidden="true" />}
        <div className="sheet-header">
          {leading}
          <div className="spacer">
            <h2 id={titleId} className="sheet-title clamp-2" lang={lang}>
              {title}
            </h2>
            {subtitle && <p className="sheet-sub">{subtitle}</p>}
          </div>
          <Button type="button" variant="ghost" icon="x" aria-label="Close" onClick={onClose} />
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer(props: Omit<Parameters<typeof Sheet>[0], "drawer" | "wide">) {
  return <Sheet {...props} drawer />;
}

// Small confirm dialog (Restore version, Keep a failing fix, Discard).
export function Dialog({
  title,
  text,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  text?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialog(ref, onCancel, ".dialog-actions button:last-child");
  return (
    <div className="sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1}>
        <h2 id={titleId} className="dialog-title">
          {title}
        </h2>
        {text && <p className="dialog-text">{text}</p>}
        <div className="dialog-actions">
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={destructive ? "danger" : "primary"} busy={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- Menu ----------

export type MenuItem = { label: string; icon?: string; onSelect: () => void; destructive?: boolean } | { separator: true } | { group: string };

// "•••" popover. Arrow keys move, Esc or an outside click closes, focus returns to the trigger.
export function Menu({ label, items, size = "sm" }: { label: string; items: MenuItem[]; size?: "sm" | "md" }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return;
    anchor.current?.querySelector<HTMLElement>(".menu-item")?.focus();
    const onDown = (event: MouseEvent) => !anchor.current?.contains(event.target as Node) && setOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);
  const move = (event: ReactKeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const entries = [...(anchor.current?.querySelectorAll<HTMLElement>(".menu-item") ?? [])];
    const index = entries.indexOf(document.activeElement as HTMLElement);
    entries[(index + (event.key === "ArrowDown" ? 1 : entries.length - 1)) % entries.length]?.focus();
  };
  return (
    <div className="menu-anchor" ref={anchor}>
      <button
        ref={trigger}
        type="button"
        className={`btn btn-ghost btn-icon${size === "sm" ? " btn-sm" : ""}`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="dots" size={size === "sm" ? 16 : 18} />
      </button>
      {open && (
        <div className="menu" role="menu" id={menuId} aria-label={label} onKeyDown={move}>
          {items.map((item, index) =>
            "separator" in item ? (
              <div key={index} className="menu-sep" role="separator" />
            ) : "group" in item ? (
              <div key={index} className="menu-label" role="presentation">
                {item.group}
              </div>
            ) : (
              <button
                key={index}
                type="button"
                role="menuitem"
                className={`menu-item${item.destructive ? " is-danger" : ""}`}
                onClick={() => {
                  setOpen(false);
                  trigger.current?.focus();
                  item.onSelect();
                }}
              >
                {item.icon && <Icon name={item.icon} size={18} />}
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

// Collapsible row for advanced areas; lives inside a card.
export function Disclosure({ title, detail, defaultOpen = false, children }: { title: ReactNode; detail?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const regionId = useId();
  return (
    <>
      <button type="button" className="disclosure" aria-expanded={open} aria-controls={regionId} onClick={() => setOpen((value) => !value)}>
        <span className="spacer">{title}</span>
        {detail !== undefined && <span className="xs t3">{detail}</span>}
        <Icon name="chevron-right" className="chev" size={16} />
      </button>
      {open && (
        <div id={regionId} className="disclosure-body">
          {children}
        </div>
      )}
    </>
  );
}

// ---------- Fix sheet pieces ----------

export function Steps({ total, current, label }: { total: number; current: number; label?: string }) {
  return (
    <div className="steps" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current} aria-label={label ?? `Step ${current} of ${total}`}>
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={`step${index < current ? " is-done" : ""}`} />
      ))}
    </div>
  );
}

export function Diff({ head, removed, added }: { head: ReactNode; removed?: ReactNode; added: ReactNode }) {
  return (
    <div className="diff" role="group" aria-label="Change preview">
      <div className="diff-head">{head}</div>
      {removed && (
        <div className="diff-line diff-del">
          <span className="diff-sign" aria-label="Removed">
            −
          </span>
          <span className="diff-text">{removed}</span>
        </div>
      )}
      <div className="diff-line diff-add">
        <span className="diff-sign" aria-label="Added">
          +
        </span>
        <span>{added}</span>
      </div>
    </div>
  );
}

// ---------- Preview reply details ----------

// "5 sources · 2 offers" under an assistant reply; toggles its DetailsCard.
export function MetaChip({ expanded, onClick, children }: { expanded: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="msg-action" aria-expanded={expanded} onClick={onClick}>
      <Icon name="book" size={16} />
      {children}
    </button>
  );
}

export function DetailsCard({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="details" role="region" aria-label="Reply details">
      <div className="stack" style={{ gap: 0 }}>
        <span className="strong">{title}</span>
        {sub && <span className="xs t3">{sub}</span>}
      </div>
      {children}
    </div>
  );
}

export function MiniList({
  label,
  items,
}: {
  label: string;
  items: Array<{ key: string; label: ReactNode; icon: string; tone?: "discovery" | "success" | "indigo" | "green"; onClick?: () => void; wrap?: boolean }>;
}) {
  const toneClass = { discovery: "text-discovery", indigo: "text-discovery", success: "text-success", green: "text-success" } as const;
  return (
    <div className="stack" style={{ gap: 2 }}>
      <span className="mini-label">{label}</span>
      {items.map((item) => (
        <button type="button" key={item.key} className="mini-item" style={{ border: 0, background: "none", textAlign: "left", cursor: item.onClick ? "pointer" : "default" }} onClick={item.onClick}>
          <Icon name={item.icon} size={16} className={item.tone ? toneClass[item.tone] : undefined} />
          <span className={`spacer${item.wrap ? "" : " truncate"}`}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

// ---------- Table ----------

export function Table({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="table-wrap">
      <table className="table" aria-label={label}>
        {children}
      </table>
    </div>
  );
}

// ---------- Loading and empty ----------

// First-load placeholder in the shape of a list (replaces page-level spinners).
export function Skeleton({ rows = 3, avatar = false, card = true }: { rows?: number; avatar?: boolean; card?: boolean }) {
  const widths = [
    ["45%", "80%"],
    ["55%", "70%"],
    ["40%", "75%"],
  ];
  const body = Array.from({ length: rows }, (_, index) => (
    <div className="skel-row" key={index}>
      {avatar && <span className="skel" style={{ width: 36, height: 36, borderRadius: 18 }} />}
      <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="skel skel-line" style={{ width: widths[index % 3][0] }} />
        <span className="skel skel-line" style={{ width: widths[index % 3][1] }} />
      </span>
    </div>
  ));
  return (
    <div className={card ? "card" : undefined} aria-busy="true" aria-label="Loading">
      {body}
    </div>
  );
}

export function SkeletonLine({ width = "60%", height = 12 }: { width?: number | string; height?: number }) {
  return <span className="skel skel-line" style={{ width, height }} aria-hidden="true" />;
}

export function EmptyState({ icon, title, text, action }: { icon: string; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon" aria-hidden="true">
        <Icon name={icon} size={24} />
      </span>
      <h3 className="empty-title">{title}</h3>
      <p className="empty-text">{text}</p>
      {action}
    </div>
  );
}

// ---------- Toast: inverse pill, bottom center, 3.6 s, optional action (Undo, Publish) ----------

type ToastOptions = { tone?: "default" | "error"; actionLabel?: string; onAction?: () => void };
type ShowToast = (message: string, options?: ToastOptions | "default" | "error") => void;
type ToastApi = ShowToast & { show: ShowToast };
const noop = Object.assign(() => undefined, { show: () => undefined }) as ToastApi;
const ToastContext = createContext<ToastApi>(noop);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { message: string; key: number }) | null>(null);
  const show = useCallback<ShowToast>((message, options) => {
    const resolved = typeof options === "string" ? { tone: options } : (options ?? {});
    setToast({ message, ...resolved, key: Date.now() });
  }, []);
  const api = useRef<ToastApi>(Object.assign((...args: Parameters<ShowToast>) => show(...args), { show }));
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <ToastContext.Provider value={api.current}>
      {children}
      <div aria-live="polite">
        {toast && (
          <div className={`toast${toast.actionLabel ? "" : " no-action"}`} key={toast.key} role="status">
            <Icon name={toast.tone === "error" ? "error" : "check-circle"} size={18} />
            <span>{toast.message}</span>
            {toast.actionLabel && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  toast.onAction?.();
                  setToast(null);
                }}
              >
                {toast.actionLabel}
              </button>
            )}
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

export function CopyField({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="row-flex">
        <input className="input mono" value={value} readOnly aria-label={label} onFocus={(event) => event.currentTarget.select()} />
        <Button
          type="button"
          variant="outline"
          icon="copy"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              toast("Copied");
            } catch {
              toast("Couldn't copy. Select the text and copy it.", "error");
            }
          }}
        />
      </div>
    </div>
  );
}
