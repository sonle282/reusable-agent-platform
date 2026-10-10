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
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "small" | "regular" | "large";
  icon?: string;
  busy?: boolean;
}) {
  return (
    <button
      className={`btn btn-${variant} btn-${size}`}
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
  return <span className={`spinner ${small ? "small" : ""}`} role="status" aria-label="Đang tải" />;
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
          {backLabel ?? "Quay lại"}
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
  active: { tone: "green", label: "Đang chạy" },
  ready: { tone: "green", label: "Sẵn sàng" },
  completed: { tone: "green", label: "Hoàn tất" },
  delivered: { tone: "green", label: "Đã gửi" },
  passed: { tone: "green", label: "Đạt" },
  draft: { tone: "gray", label: "Bản nháp" },
  archived: { tone: "gray", label: "Lưu trữ" },
  pending: { tone: "orange", label: "Đang chờ" },
  processing: { tone: "orange", label: "Đang xử lý" },
  accepted: { tone: "orange", label: "Đã nhận" },
  engaged: { tone: "blue", label: "Đang tư vấn" },
  lead_captured: { tone: "green", label: "Có liên hệ" },
  human_handoff: { tone: "orange", label: "Nhân viên xử lý" },
  failed: { tone: "red", label: "Lỗi" },
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
          <button className="icon-button" onClick={onClose} aria-label="Đóng">
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
        <button className="icon-button" onClick={onClose} aria-label="Đóng">
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

export function errorMessage(error: unknown, fallback = "Đã có lỗi xảy ra") {
  return error instanceof Error ? error.message : fallback;
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  const normalized = /Z|[+-]\d\d:?\d\d$/.test(value) ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
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
            toast("Đã sao chép");
          }}
        >
          Sao chép
        </Button>
      </div>
    </div>
  );
}
