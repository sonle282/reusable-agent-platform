import { useEffect, useState } from "react";
import { api, del, patch } from "../api";
import { formatPhone } from "../../shared/contact";
import { displayName, formatDate } from "../format";
import { Alert, Avatar, Banner, Button, EmptyState, PageHeader, Section, Segmented, Sheet, Skeleton, TextArea, errorMessage, useToast } from "../ui";

export type LeadStatus = "new" | "called" | "won" | "not_fit";
type Lead = {
  id: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  lead_status: LeadStatus;
  lead_notes: string;
  lead_summary: string;
  lead_created_at: string;
  agent_name: string | null;
  platform: string | null;
  conversation_id: string | null;
  channel_name: string | null;
  followup: string | null;
};
type LeadList = { leads: Lead[]; counts: Record<LeadStatus | "all", number>; thisMonth: number; wonThisMonth: number };
type LeadDetail = Lead & { activity: Array<{ kind: string; at: string; detail: Record<string, unknown> }> };

export const statusLabel: Record<LeadStatus, string> = { new: "New", called: "Called", won: "Won", not_fit: "Not a fit" };
const filters: Array<{ value: LeadStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "called", label: "Called" },
  { value: "won", label: "Won" },
  { value: "not_fit", label: "Not a fit" },
];
const platformLabel = (value?: string | null) =>
  value ? ({ facebook: "Messenger", instagram: "Instagram", whatsapp: "WhatsApp", generic_api: "Website chat", generic_webhook: "Webhook", zernio: "Messenger" } as Record<string, string>)[value] ?? value : "Chat";

function StatusPill({ status }: { status: LeadStatus }) {
  return <span className={`lead-status ls-${status}`}>{statusLabel[status]}</span>;
}

const contactLine = (lead: Lead) => formatPhone(lead.phone) || lead.email || "";

export function LeadsPage({ openId, onOpen, onOpenConversation, onChanged }: { openId?: string; onOpen: (id?: string) => void; onOpenConversation: (id: string) => void; onChanged: () => void }) {
  const toast = useToast();
  const [data, setData] = useState<LeadList | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  async function load() {
    try {
      setData(await api<LeadList>("/api/admin/leads"));
      setError("");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }
  useEffect(() => void load(), []);
  async function exportCsv() {
    try {
      const response = await fetch("/api/admin/leads/export.csv", { credentials: "same-origin" });
      if (!response.ok) throw new Error(`Export failed (${response.status})`);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(await response.blob());
      link.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast("Leads exported as CSV");
    } catch (caught) {
      toast(errorMessage(caught, "Couldn't export the leads"), "error");
    }
  }
  const rows = (data?.leads ?? []).filter((lead) => filter === "all" || lead.lead_status === filter);
  return (
    <div className="page leads-page">
      <PageHeader
        title="Leads"
        subtitle="People who left a phone number or email. Call the new ones first."
        actions={
          data && data.counts.all > 0 ? (
            <Button variant="gray" icon="download" onClick={() => void exportCsv()}>
              Export
            </Button>
          ) : undefined
        }
      />
      {error && (
        <Banner
          tone="error"
          title="Leads didn't load"
          text="Your leads are safe. Check your connection and try again."
          actions={
            <Button variant="gray" size="small" onClick={() => void load()}>
              Try again
            </Button>
          }
        />
      )}
      {!data && !error && <Skeleton rows={5} avatar />}
      {data && data.counts.all === 0 && (
        <Section>
          <EmptyState icon="person-plus" title="No leads yet" text="When a customer leaves a phone number or email, they show up here and in Needs attention on Home." />
        </Section>
      )}
      {data && data.counts.all > 0 && (
        <>
          <Section>
            <div className="metrics">
              <div className="metric">
                <span className="metric-label">New · call these</span>
                <span className={`metric-value${data.counts.new ? "" : " is-zero"}`}>{data.counts.new}</span>
              </div>
              <div className="metric">
                <span className="metric-label">This month</span>
                <span className={`metric-value${data.thisMonth ? "" : " is-zero"}`}>{data.thisMonth}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Won this month</span>
                <span className={`metric-value${data.wonThisMonth ? "" : " is-zero"}`}>{data.wonThisMonth}</span>
              </div>
            </div>
          </Section>
          <div className="chips" role="group" aria-label="Status">
            {filters.map((item) => (
              <button type="button" key={item.value} className="chip" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>
                {item.label} <span className="chip-count">{data.counts[item.value]}</span>
              </button>
            ))}
          </div>
          <Section>
            {rows.length === 0 ? (
              <p className="leads-none">No leads with this status.</p>
            ) : (
              <div className="leads-table-wrap">
                <table className="leads-table">
                  <thead>
                    <tr>
                      <th scope="col">Lead</th>
                      <th scope="col">What they want</th>
                      <th scope="col" className="lt-optional">
                        Status
                      </th>
                      <th scope="col" className="lt-optional">
                        Received
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((lead) => (
                      <tr key={lead.id} onClick={() => onOpen(lead.id)}>
                        <td>
                          <button type="button" className="lt-who" onClick={(event) => (event.stopPropagation(), onOpen(lead.id))}>
                            <Avatar name={lead.display_name ?? undefined} tone={lead.lead_status === "new" ? "indigo" : undefined} />
                            <span className="lt-who-text">
                              <span className="lt-name truncate">{displayName(lead)}</span>
                              <span className="lt-sub tabular">{contactLine(lead)}</span>
                              <span className="lt-sub lt-phone-only">
                                {statusLabel[lead.lead_status]} · {formatDate(lead.lead_created_at)}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td>
                          <span className="clamp-2">{lead.lead_summary || <span className="muted">No summary yet</span>}</span>
                          <span className="lt-sub">{[platformLabel(lead.platform), lead.agent_name, lead.followup ? "Follow-up sent" : ""].filter(Boolean).join(" · ")}</span>
                        </td>
                        <td className="lt-optional">
                          <StatusPill status={lead.lead_status} />
                        </td>
                        <td className="lt-optional lt-sub tabular">{formatDate(lead.lead_created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}
      {openId && (
        <LeadSheet
          id={openId}
          onClose={() => onOpen(undefined)}
          onOpenConversation={onOpenConversation}
          onChanged={async () => {
            await load();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function LeadSheet({ id, onClose, onOpenConversation, onChanged }: { id: string; onClose: () => void; onOpenConversation: (id: string) => void; onChanged: () => Promise<void> }) {
  const toast = useToast();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  async function load() {
    try {
      const detail = await api<LeadDetail>(`/api/admin/leads/${encodeURIComponent(id)}`);
      setLead(detail);
      setNotes(detail.lead_notes);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }
  useEffect(() => void load(), [id]);
  async function save(change: { status?: LeadStatus; notes?: string }) {
    try {
      await patch(`/api/admin/leads/${encodeURIComponent(id)}`, change);
      if (change.status) toast(`Marked ${statusLabel[change.status]}`);
      await Promise.all([load(), onChanged()]);
    } catch (caught) {
      toast(errorMessage(caught, "Couldn't save the lead"), "error");
    }
  }
  const name = lead ? displayName(lead) : "Lead";
  const phone = lead ? formatPhone(lead.phone) : "";
  return (
    <>
      <Sheet
        drawer
        title={name}
        subtitle={lead ? `${platformLabel(lead.platform)} · ${formatDate(lead.lead_created_at)}` : undefined}
        onClose={onClose}
        footer={
          lead && (
            <>
              <Button variant="plain" destructive onClick={() => setConfirmDelete(true)}>
                Delete lead
              </Button>
              <span className="spacer" />
              <Button onClick={onClose}>Done</Button>
            </>
          )
        }
      >
        {error && <Banner tone="error" title="Couldn't open the lead" text={error} />}
        {!lead && !error && <Skeleton rows={4} card={false} />}
        {lead && (
          <>
            <div className="lead-actions">
              {lead.phone && (
                <a className="btn btn-filled" href={`tel:${lead.phone}`}>
                  Call {phone}
                </a>
              )}
              {!lead.phone && lead.email && (
                <a className="btn btn-filled" href={`mailto:${lead.email}`}>
                  Email {lead.email}
                </a>
              )}
              {lead.conversation_id && (
                <Button variant="gray" onClick={() => onOpenConversation(lead.conversation_id!)}>
                  Open conversation
                </Button>
              )}
            </div>
            <div className="lead-block">
              <span className="lead-label">Status</span>
              <Segmented
                full
                label="Status"
                value={lead.lead_status}
                onChange={(status) => void save({ status })}
                options={(Object.keys(statusLabel) as LeadStatus[]).map((value) => ({ value, label: statusLabel[value] }))}
              />
              <span className="lead-help">Won and Not a fit stop follow-ups for this person.</span>
            </div>
            <div className="lead-block">
              <span className="lead-label">Summary</span>
              <div className="lead-sum">{lead.lead_summary || "No summary yet. It's written when the customer leaves contact details."}</div>
              <span className="lead-help">Written by the assistant from the conversation.</span>
            </div>
            <div className="lead-block">
              <span className="lead-label">Details collected</span>
              <dl className="lead-fields">
                {[
                  ["Name", lead.display_name],
                  ["Phone", phone],
                  ["Email", lead.email],
                  ["Channel", lead.channel_name],
                  ["Assistant", lead.agent_name],
                ]
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
              </dl>
            </div>
            <div className="lead-block">
              <span className="lead-label">Activity</span>
              <ol className="timeline">
                {lead.activity.map((item, index) => (
                  <li key={`${item.kind}-${index}`} className="tl-item is-on">
                    <span className="tl-dot" aria-hidden="true" />
                    <span className="tl-text">
                      <span>{activityText(item)}</span>
                      <span className="lead-help">{formatDate(item.at)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <label className="lead-block">
              <span className="lead-label">Notes</span>
              <TextArea rows={3} value={notes} placeholder="Only your team sees this" onChange={(event) => setNotes(event.target.value)} onBlur={() => notes !== lead.lead_notes && void save({ notes })} />
            </label>
          </>
        )}
      </Sheet>
      {confirmDelete && (
        <Alert
          title="Delete this lead?"
          text="They leave the Leads list. The conversation stays in Conversations."
          confirmLabel="Delete"
          destructive
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            try {
              await del(`/api/admin/leads/${encodeURIComponent(id)}`);
              toast("Lead deleted");
              await onChanged();
              onClose();
            } catch (caught) {
              setConfirmDelete(false);
              toast(errorMessage(caught, "Couldn't delete the lead"), "error");
            }
          }}
        />
      )}
    </>
  );
}

function activityText(item: { kind: string; detail: Record<string, unknown> }) {
  if (item.kind === "created") return "Left contact details — lead created";
  if (item.kind === "status") return `Marked ${statusLabel[item.detail.to as LeadStatus] ?? String(item.detail.to)}`;
  if (item.kind === "followup_sent") return `Follow-up ${String(item.detail.step ?? "")} sent`.replace("  ", " ");
  if (item.kind === "followup_skipped") return `Follow-up ${String(item.detail.step ?? "")} skipped · ${String(item.detail.reason ?? "")}`;
  return item.kind;
}
