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
  type TextareaHTMLAttributes,
} from "react";
import { formatDate } from "./format";

export { formatDate };

// SF Symbols–style outline glyphs (24 grid, 1.6 stroke). Source: docs/product/design/reference/Icons.dc.html.
const glyphs: Record<string, ReactNode> = {
  house: <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />,
  sparkles: <path d="M10 3.5l1.6 4.4 4.4 1.6-4.4 1.6L10 15.5l-1.6-4.4L4 9.5l4.4-1.6zM17.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />,
  table: <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zM4 9.5h16M4 14.5h16M10 9.5V20" />,
  bubbles: <path d="M7 4.5h6a2.5 2.5 0 0 1 2.5 2.5v3.5A2.5 2.5 0 0 1 13 13H9.5L6.5 15.5V13H7a2.5 2.5 0 0 1-2.5-2.5V7A2.5 2.5 0 0 1 7 4.5zM15.5 9H17a2.5 2.5 0 0 1 2.5 2.5V15a2.5 2.5 0 0 1-2.5 2.5h-.5V20l-3-2.5H11A2.5 2.5 0 0 1 8.5 15v-.5" />,
  link: <path d="M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M5.6 18.4l1.6-1.6M16.8 7.2l1.6-1.6" />
    </>
  ),
  "chevron-right": <path d="M9.5 6l6 6-6 6" />,
  "chevron-left": <path d="M14.5 6l-6 6 6 6" />,
  "chevron-down": <path d="M6 9.5l6 6 6-6" />,
  xmark: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l4.5 4.5" />
    </>
  ),
  ellipsis: <path d="M6 12h.01M12 12h.01M18 12h.01" strokeWidth={3} />,
  refresh: <path d="M19 12a7 7 0 1 1-2.05-4.95M19 4.5V8h-3.5" />,
  "arrow-up": <path d="M12 18V6M6.5 11.5 12 6l5.5 5.5" />,
  doc: <path d="M7 3.5h6.5L18 8v11.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1zM13 3.5V8.5h5M9 12.5h6M9 16h6" />,
  wrench: <path d="M20 7.2a4.5 4.5 0 0 1-6 4.3L7.6 18a1.9 1.9 0 1 1-2.7-2.7l6.5-6.4a4.5 4.5 0 0 1 5.7-5.7l-2.6 2.6.5 2.4 2.4.5z" />,
  check: <path d="M5.5 12.5l4 4 9-9" />,
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.2l2.3 2.3 4.7-4.9" />
    </>
  ),
  warning: <path d="M10.3 5.2a2 2 0 0 1 3.4 0l6.6 11.4a2 2 0 0 1-1.7 3H5.4a2 2 0 0 1-1.7-3zM12 10v4M12 16.8v.2" />,
  error: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v4.5M12 15.8v.2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8v.2" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 19.5a7 7 0 0 1 14 0" />
    </>
  ),
  "person-plus": (
    <>
      <circle cx="10" cy="8.5" r="3.5" />
      <path d="M3.5 19.5a6.5 6.5 0 0 1 13 0M18.5 8v6M15.5 11h6" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <circle cx="16.5" cy="9.5" r="2.5" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0M14.5 15.2a4.5 4.5 0 0 1 6 3.8" />
    </>
  ),
  bolt: <path d="M13 3 5.5 13.5H12L11 21l7.5-10.5H12z" />,
  webhook: (
    <>
      <circle cx="6" cy="17.5" r="2" />
      <circle cx="18" cy="17.5" r="2" />
      <circle cx="12" cy="6" r="2" />
      <path d="M12 8v3.5l-5 4.5M12 11.5l5 4.5" />
    </>
  ),
  inbox: <path d="M4 13.5 6.5 5h11L20 13.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18zM4 13.5h4.5a3.5 3.5 0 0 0 7 0H20" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  restore: <path d="M9 6.5 5 10.5l4 4M5 10.5h9.5a5 5 0 0 1 0 10H12" />,
  download: <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />,
  upload: <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19.5h14" />,
  key: (
    <>
      <circle cx="8" cy="15.5" r="3.5" />
      <path d="M10.5 13 19 4.5M16 7.5l2.5 2.5M13.5 10l2 2" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.9 1.4-1.9-.5-1.2.3-2.3 1.6-2.3h1.8a3.7 3.7 0 0 0 3.7-3.7C20.5 7.4 16.7 3.5 12 3.5z" />
      <path d="M8 11h.01M10.5 7.5h.01M15 7.5h.01" strokeWidth={2.6} />
    </>
  ),
  signout: <path d="M14 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H14M10 12h10M17 9l3 3-3 3" />,
  lock: (
    <>
      <rect x="5.5" y="10.5" width="13" height="9.5" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  eye: <path d="M3 12c.5-1.5 4-6 9-6s8.5 4.5 9 6c-.5 1.5-4 6-9 6s-8.5-4.5-9-6zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
  "eye-slash": <path d="M4 4l16 16M10.6 6.1A9 9 0 0 1 12 6c5 0 8.5 4.5 9 6-.3.9-1.2 2.4-2.6 3.7M6.6 7.6C4.6 9 3.3 11 3 12c.5 1.5 4 6 9 6 1.6 0 3-.4 4.2-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2" />,
  pencil: <path d="M15.5 4.5l4 4L9 19l-4.5 1 1-4.5z" />,
  trash: <path d="M5 7h14M10 7V5h4v2M7 7l1 12.5h8L17 7M10.5 11v5M13.5 11v5" />,
  offline: <path d="M4 4l16 16M8.5 16a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 4.3-2.4M19 12.5a10 10 0 0 0-2.4-1.6M2.5 9a14 14 0 0 1 3.5-2.2M21.5 9a14 14 0 0 0-8.6-3.4M12 19.5h.01" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15.5 8.5V6.5A1.5 1.5 0 0 0 14 5H6.5A1.5 1.5 0 0 0 5 6.5V14a1.5 1.5 0 0 0 1.5 1.5h2" />
    </>
  ),
  "check-bubble": <path d="M6.5 4.5h11A2.5 2.5 0 0 1 20 7v7a2.5 2.5 0 0 1-2.5 2.5H11l-4 3.5v-3.5h-.5A2.5 2.5 0 0 1 4 14V7a2.5 2.5 0 0 1 2.5-2.5zM8.5 10.5l2.3 2.3 4.7-4.6" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5s1.1-6.1 3.4-8.5z" />
    </>
  ),
  pause: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10 9v6M14 9v6" />
    </>
  ),
  archive: <path d="M4 5h16v4H4zM5.5 9v9.5A1.5 1.5 0 0 0 7 20h10a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4" />,
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14" rx="2" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  reply: <path d="M10 6.5 5 11l5 4.5M5 11h8.5a5.5 5.5 0 0 1 5.5 5.5V18" />,
};

// Names used before the redesign keep working.
const aliases: Record<string, string> = {
  overview: "house",
  home: "house",
  assistant: "sparkles",
  data: "table",
  conversations: "bubbles",
  connections: "link",
  channels: "link",
  settings: "gear",
  chevron: "chevron-right",
  back: "chevron-left",
  close: "xmark",
  send: "arrow-up",
};

export function Icon({ name, size = 20, label, className }: { name: string; size?: number; label?: string; className?: string }) {
  return (
    <svg
      className={`icon${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {glyphs[aliases[name] ?? name]}
    </svg>
  );
}

type ButtonVariant = "filled" | "tinted" | "gray" | "plain" | "destructive";
const sizeClass = { small: " btn-sm", regular: "", large: " btn-lg" } as const;

// One filled button per screen. Busy keeps the label (and width) and shows a spinner in place of the icon.
export function Button({
  variant = "filled",
  size = "regular",
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
  size?: "small" | "regular" | "large";
  icon?: string;
  busy?: boolean;
  destructive?: boolean;
  block?: boolean;
}) {
  const iconOnly = !children && Boolean(icon);
  const classes = [
    `btn btn-${variant}${sizeClass[size]}`,
    iconOnly && "btn-icon",
    destructive && "is-destructive",
    block && "btn-block",
    className,
  ]
    .filter(Boolean)
    .join(" ");
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
      {busy ? <Spinner /> : icon && <Icon name={icon} size={size === "small" ? 15 : 17} />}
      {children && <span>{children}</span>}
    </button>
  );
}

export function Spinner({ large = false, label = "Loading" }: { large?: boolean; small?: boolean; label?: string }) {
  return <span className={`spinner${large ? " spinner-lg" : ""}`} role="status" aria-label={label} />;
}

export function StatusLine({ tone = "gray", children }: { tone?: "green" | "orange" | "gray" | "red"; children: ReactNode }) {
  return (
    <p className="status-line">
      <span className={`dot dot-${tone}`} aria-hidden="true" />
      {children}
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
      <div className="page-heading">
        {onBack && (
          <button type="button" className="btn btn-plain back-link" onClick={onBack}>
            <Icon name="chevron-left" size={17} />
            <span>{backLabel ?? "Back"}</span>
          </button>
        )}
        <h1 className="large-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
        {status}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Section({
  title,
  footer,
  action,
  badge,
  children,
  plain = false,
}: {
  title?: ReactNode;
  footer?: ReactNode;
  action?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  plain?: boolean;
}) {
  return (
    <section className="section">
      {(title || action) && (
        <h2 className="section-header">
          {title}
          {badge}
          <span className="spacer" />
          {action}
        </h2>
      )}
      {plain ? <div className="section-plain">{children}</div> : <div className="section-card">{children}</div>}
      {footer && <p className="section-footer">{footer}</p>}
    </section>
  );
}

export type TileTone =
  | "blue"
  | "green"
  | "orange"
  | "indigo"
  | "gray"
  | "soft-blue"
  | "soft-green"
  | "soft-orange"
  | "soft-indigo"
  | "soft-red"
  | "soft-gray";

export function Row({
  icon,
  tone = "gray",
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
  label?: string;
}) {
  const className = ["row", selected && "is-selected", (top || clamp2 || multiline) && "top"].filter(Boolean).join(" ");
  const content = (
    <>
      {avatar}
      {icon && !avatar && (
        <span className={`tile tile-${tone}`} aria-hidden="true">
          <Icon name={icon} size={18} />
        </span>
      )}
      <span className="row-body">
        <span className="row-text">
          <span className={`row-title${strong ? " strong" : ""}`}>{title}</span>
          {subtitle && <span className={`row-subtitle${clamp2 ? " clamp-2" : multiline ? "" : " truncate"}`}>{subtitle}</span>}
        </span>
        {detail !== undefined && detail !== null && <span className="row-detail">{detail}</span>}
        {accessory}
        {chevron && <Icon name="chevron-right" className="row-chevron" size={14} />}
      </span>
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

export function Avatar({ name, tone, icon }: { name?: string; tone?: "indigo" | "orange"; icon?: string }) {
  const initials = (name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <span className={`avatar${tone ? ` avatar-${tone}` : ""}`} aria-hidden="true">
      {icon || !initials ? <Icon name={icon ?? "person"} /> : initials}
    </span>
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
    <label className={`field${stacked ? " stacked" : ""}`}>
      <span className="field-label">
        {label}
        {hint && !stacked && <small className="field-hint">{hint}</small>}
      </span>
      <span className="field-control">{children}</span>
      {hint && stacked && <small className="field-hint">{hint}</small>}
    </label>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`text-input${className ? ` ${className}` : ""}`} {...props} />;
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
  return <textarea ref={ref} className={`field-textarea${mono ? " mono" : ""}${className ? ` ${className}` : ""}`} value={value} {...props} />;
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
      className="toggle"
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
    />
  );
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
  return (
    <div className={`segmented${full ? " full" : ""}`} role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          role="tab"
          aria-selected={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => {
            if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
            const index = options.findIndex((item) => item.value === value);
            const next = options[(index + (event.key === "ArrowRight" ? 1 : options.length - 1)) % options.length];
            onChange(next.value);
            const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button");
            buttons?.[options.indexOf(next)]?.focus();
          }}
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

type BadgeTone = "green" | "orange" | "red" | "blue" | "neutral" | "outline";

export function Badge({ tone = "neutral", count, children }: { tone?: BadgeTone | "gray"; count?: boolean; children: ReactNode }) {
  if (count) return <span className="badge badge-count">{children}</span>;
  return <span className={`badge badge-${tone === "gray" ? "neutral" : tone}`}>{children}</span>;
}

// Only exceptions get a badge; normal states (active, ready, delivered, passed…) render nothing.
const statusMap: Record<string, { tone: BadgeTone; label: string } | null> = {
  active: null,
  ready: null,
  completed: null,
  delivered: null,
  passed: null,
  engaged: null,
  new: null,
  draft: { tone: "neutral", label: "Not live" },
  archived: { tone: "neutral", label: "Off" },
  disabled: { tone: "neutral", label: "Off" },
  paused: { tone: "neutral", label: "Off" },
  error: { tone: "red", label: "Not working" },
  pending: { tone: "orange", label: "Processing" },
  processing: { tone: "orange", label: "Processing" },
  accepted: { tone: "orange", label: "Processing" },
  lead_captured: { tone: "blue", label: "New lead" },
  human_handoff: { tone: "orange", label: "Your team is replying" },
  failed: { tone: "red", label: "Failed" },
};

export function StatusBadge({ value }: { value: string }) {
  const status = value in statusMap ? statusMap[value] : { tone: "neutral" as const, label: value.replaceAll("_", " ") };
  return status ? <Badge tone={status.tone}>{status.label}</Badge> : null;
}

type BannerTone = "info" | "warning" | "error" | "success";
const bannerAlias: Record<string, BannerTone> = { red: "error", orange: "warning", blue: "info", green: "success" };
const bannerIcon: Record<BannerTone, string> = { info: "info", warning: "warning", error: "error", success: "check-circle" };

// Warnings and errors say what happened and offer the next step (actions).
export function Banner({
  tone = "error",
  title,
  text,
  actions,
  children,
  onClose,
}: {
  tone?: BannerTone | "red" | "orange" | "blue" | "green";
  title?: ReactNode;
  text?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  onClose?: () => void;
}) {
  const resolved = bannerAlias[tone] ?? (tone as BannerTone);
  return (
    <div className={`banner banner-${resolved}`} role={resolved === "error" ? "alert" : "status"}>
      <Icon name={bannerIcon[resolved]} size={22} />
      <div className="banner-body">
        {title && <span className="banner-title">{title}</span>}
        {text && <span className="banner-text">{text}</span>}
        {children && <div className="banner-text banner-children">{children}</div>}
        {actions && <div className="banner-actions">{actions}</div>}
      </div>
      {onClose && <Button type="button" variant="plain" size="small" icon="xmark" aria-label="Dismiss" onClick={onClose} />}
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

export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
  lang,
  drawer,
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  lang?: string;
  // Slides in from the right edge (record details) instead of opening in the middle.
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialog(ref, onClose, "[data-autofocus]");
  return (
    <div className={`sheet-backdrop${drawer ? " is-drawer" : ""}`} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`sheet${drawer ? " is-drawer" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1}>
        <span className="sheet-grabber" aria-hidden="true" />
        <div className="sheet-header">
          <div className="spacer" style={{ minWidth: 0 }}>
            <h2 id={titleId} className="sheet-title clamp-2" lang={lang}>
              {title}
            </h2>
            {subtitle && <p className="sheet-sub">{subtitle}</p>}
          </div>
          <Button type="button" variant="gray" size="small" icon="xmark" aria-label="Close" onClick={onClose} />
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </div>
  );
}

// Small confirm dialog (Restore version, Keep a failing fix).
export function Alert({
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
  useDialog(ref, onCancel, ".alert-actions button:last-child");
  return (
    <div className="sheet-backdrop is-alert" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="alert" role="alertdialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1}>
        <h2 id={titleId} className="alert-title">
          {title}
        </h2>
        {text && <p className="alert-text">{text}</p>}
        <div className="alert-actions">
          <Button type="button" variant="gray" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={destructive ? "destructive" : "filled"} busy={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export type MenuItem =
  | { label: string; icon?: string; onSelect: () => void; destructive?: boolean }
  | { separator: true }
  | { group: string };

// "•••" popover. Arrow keys move, Esc or an outside click closes, focus returns to the trigger.
export function Menu({ label, items, size = "small" }: { label: string; items: MenuItem[]; size?: "small" | "regular" }) {
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
        className={`btn btn-gray btn-icon${size === "small" ? " btn-sm" : ""}`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="ellipsis" size={size === "small" ? 15 : 17} />
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
                className={`menu-item${item.destructive ? " is-destructive" : ""}`}
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

// Collapsible row for advanced areas; lives inside a section card.
export function Disclosure({
  title,
  detail,
  defaultOpen = false,
  children,
}: {
  title: ReactNode;
  detail?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const regionId = useId();
  return (
    <>
      <button type="button" className="disclosure" aria-expanded={open} aria-controls={regionId} onClick={() => setOpen((value) => !value)}>
        <span className="spacer">{title}</span>
        {detail !== undefined && <span className="row-detail">{detail}</span>}
        <Icon name="chevron-right" className="chev" size={13} />
      </button>
      {open && (
        <div id={regionId} className="disclosure-body">
          {children}
        </div>
      )}
    </>
  );
}

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

// "Read 3 sources · looked up 1 row" under an assistant reply; toggles its DetailsCard.
export function MetaChip({ expanded, onClick, children }: { expanded: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="meta-chip" aria-expanded={expanded} onClick={onClick}>
      <Icon name="chevron-right" size={13} />
      {children}
    </button>
  );
}

export function DetailsCard({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <div className="details-card" role="region" aria-label="Reply details">
      <div>
        <p className="details-title">{title}</p>
        {sub && <p className="details-sub">{sub}</p>}
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
  items: Array<{ key: string; label: ReactNode; icon: string; tone?: "indigo" | "green"; onClick?: () => void; wrap?: boolean }>;
}) {
  return (
    <div className="mini-list">
      <span className="mini-label">{label}</span>
      {items.map((item) => (
        <button type="button" key={item.key} className={`mini-item${item.wrap ? " wrap" : ""}`} onClick={item.onClick}>
          <Icon name={item.icon} size={16} className={item.tone ? `text-${item.tone}` : undefined} />
          <span className={`spacer${item.wrap ? "" : " truncate"}`}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

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
    <div className={card ? "section-card" : undefined} aria-busy="true" aria-label="Loading">
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
        <Icon name={icon} size={28} />
      </span>
      <h3 className="empty-title">{title}</h3>
      <p className="empty-text">{text}</p>
      {action}
    </div>
  );
}

// ---------- Toast: pill, bottom center, 3.6 s, optional action (Undo, Publish) ----------

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
      <div className="toast-live" aria-live="polite">
        {toast && (
          <div className={`toast${toast.tone === "error" ? " is-error" : ""}${toast.actionLabel ? "" : " no-action"}`} key={toast.key} role="status">
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
    <div className="copy-field">
      <span className="copy-label">{label}</span>
      <div>
        <code>{value}</code>
        <Button
          type="button"
          variant="gray"
          size="small"
          icon="copy"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              toast("Copied");
            } catch {
              toast("Couldn't copy. Select the text and copy it.", "error");
            }
          }}
        >
          Copy
        </Button>
      </div>
    </div>
  );
}
