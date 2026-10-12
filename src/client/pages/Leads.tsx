import { useEffect, useState } from "react";
import { api, del, patch } from "../api";
import { formatPhone } from "../../shared/contact";
import { displayName, formatDate, parseDate } from "../format";
import { platformKey, platformName } from "../platform";
import { AgentAvatar, Alert, AvatarWithChannel, Button, Chips, Dialog, Drawer, EmptyState, errorMessage, Field, Icon, LeadStatus as StatusPill, LoadError, PageHeader, Segmented, Skeleton, Table, TextArea, usePaged, useToast } from "../ui";

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
  agent_id?: string | null;
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
// Website chat and API leads have no brand platform; name them plainly.
const platformLabel = (value?: string | null) => (value === "generic_api" ? "Website chat" : value === "generic_webhook" ? "Webhook" : value ? (platformName[platformKey(value)] ?? value) : "Chat");

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
  const { rows: pageRows, pager } = usePaged(rows, filter);
  return (
    <div className="page page-fill">
      <PageHeader
        title="Leads"
        subtitle="People who left a phone number or email. Call the new ones first."
        actions={
          data && data.counts.all > 0 ? (
            <Button variant="outline" icon="download" onClick={() => void exportCsv()}>
              Export
            </Button>
          ) : undefined
        }
      />
      {error && !data && (
        <div className="card">
          <LoadError title="Couldn't load your leads" text="Your leads are safe. Check your connection and try again." error={error} onRetry={() => void load()} />
        </div>
      )}
      {error && data && (
        <Alert
          tone="danger"
          title="Leads didn't refresh"
          text="Your leads are safe. Check your connection and try again."
          actions={
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Try again
            </Button>
          }
        />
      )}
      {!data && !error && <Skeleton rows={5} avatar />}
      {data && data.counts.all === 0 && (
        <div className="card">
          <EmptyState icon="phone" title="No leads yet" text="When a customer leaves a phone number or email, they show up here and in Needs attention on Home." />
        </div>
      )}
      {data && data.counts.all > 0 && (
        <>
          <section className="card metrics" aria-label="Lead counts">
            <div className="metric">
              <span className="xs t3">New · call these</span>
              <span className={`metric-value${data.counts.new ? "" : " is-zero"}`}>{data.counts.new}</span>
            </div>
            <div className="metric">
              <span className="xs t3">This month</span>
              <span className={`metric-value${data.thisMonth ? "" : " is-zero"}`}>{data.thisMonth}</span>
            </div>
            <div className="metric">
              <span className="xs t3">Won this month</span>
              <span className={`metric-value${data.wonThisMonth ? "" : " is-zero"}`}>{data.wonThisMonth}</span>
            </div>
          </section>
          <div className="stack" style={{ gap: 12, flex: "0 1 auto", minHeight: 0 }}>
            <Chips label="Status" value={filter} onChange={setFilter} options={filters.map((item) => ({ ...item, count: data.counts[item.value] }))} />
            <div className="card table-card">
              <Table label="Leads">
                <thead>
                  <tr>
                    <th className="lead-col">Lead</th>
                    <th>What they want</th>
                    <th className="table-cols-optional" style={{ width: 130 }}>
                      Status
                    </th>
                    <th className="table-cols-optional" style={{ width: 110 }}>
                      Received
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((lead) => (
                    <tr key={lead.id} onClick={() => onOpen(lead.id)}>
                      <td>
                        <button type="button" className="row-flex lead-who" onClick={(event) => (event.stopPropagation(), onOpen(lead.id))}>
                          <AvatarWithChannel name={lead.display_name ?? undefined} platform={platformKey(lead.platform)} />
                          <span className="stack" style={{ gap: 0 }}>
                            <span className="medium truncate">{displayName(lead)}</span>
                            <span className="xs t3 tabular">{contactLine(lead)}</span>
                            <span className="xs t3 only-phone">
                              {statusLabel[lead.lead_status]} · {formatDate(lead.lead_created_at)}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td>
                        <span className="clamp-2">{lead.lead_summary || <span className="t3">—</span>}</span>
                        <span className="row-flex xs t3" style={{ marginTop: 4 }}>
                          {lead.agent_name && <AgentAvatar id={lead.agent_id ?? lead.agent_name} name={lead.agent_name} size="xs" />}
                          <span className="truncate">{[lead.agent_name, lead.followup ? "Follow-up sent" : ""].filter(Boolean).join(" · ")}</span>
                        </span>
                      </td>
                      <td className="table-cols-optional">
                        <StatusPill status={lead.lead_status} />
                      </td>
                      <td className="table-cols-optional xs t3 tabular">{formatDate(lead.lead_created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {rows.length === 0 && (
                <div className="empty" style={{ padding: 32 }}>
                  <p className="empty-text">No leads with this status.</p>
                </div>
              )}
              {pager}
            </div>
          </div>
        </>
      )}
      {openId && (
        <LeadDrawer
          // A fresh panel per lead, so notes typed for one lead never show on another.
          key={openId}
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

function LeadDrawer({ id, onClose, onOpenConversation, onChanged }: { id: string; onClose: () => void; onOpenConversation: (id: string) => void; onChanged: () => Promise<void> }) {
  const toast = useToast();
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
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
      if (change.notes !== undefined) setNotesSaved(true);
      await Promise.all([load(), onChanged()]);
    } catch (caught) {
      toast(errorMessage(caught, "Couldn't save the lead"), "error");
    }
  }
  const name = lead ? displayName(lead) : "Lead";
  const phone = lead ? formatPhone(lead.phone) : "";
  return (
    <>
      <Drawer
        title={name}
        subtitle={lead ? `${platformLabel(lead.platform)} · ${formatDate(lead.lead_created_at)}` : undefined}
        leading={lead ? <AvatarWithChannel name={lead.display_name ?? undefined} platform={platformKey(lead.platform)} /> : undefined}
        onClose={onClose}
        footer={
          lead && (
            <>
              <Button variant="danger-ghost" onClick={() => setConfirmDelete(true)}>
                Delete lead
              </Button>
              <span className="spacer" />
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </>
          )
        }
      >
        {error && <Alert tone="danger" title="Couldn't open the lead" text={error} />}
        {!lead && !error && <Skeleton rows={4} card={false} />}
        {lead && (
          <>
            <div className="row-flex" style={{ flexWrap: "wrap" }}>
              {lead.phone && (
                <a className="btn btn-primary tabular" href={`tel:${lead.phone}`}>
                  <Icon name="phone" size={18} />
                  Call {phone}
                </a>
              )}
              {!lead.phone && lead.email && (
                <a className="btn btn-primary" href={`mailto:${lead.email}`}>
                  <Icon name="mail" size={18} />
                  Email {lead.email}
                </a>
              )}
              {lead.conversation_id && (
                <Button variant="outline" icon="chats" onClick={() => onOpenConversation(lead.conversation_id!)}>
                  Open conversation
                </Button>
              )}
            </div>
            <div className="field">
              <span className="field-label">Status</span>
              <Segmented
                full
                label="Status"
                value={lead.lead_status}
                onChange={(status) => void save({ status })}
                options={(Object.keys(statusLabel) as LeadStatus[]).map((value) => ({ value, label: statusLabel[value] }))}
              />
              <span className="help">Won and Not a fit stop follow-ups for this person.</span>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <span className="field-label">Summary</span>
              <div className="lead-sum">{lead.lead_summary || "No summary yet. It's written when the customer leaves contact details."}</div>
              <span className="help">Written by the assistant from the conversation.</span>
            </div>
            <div className="stack" style={{ gap: 4 }}>
              <span className="field-label">Details collected</span>
              <div className="card">
                {[
                  ["Name", lead.display_name],
                  ["Phone", phone],
                  ["Email", lead.email],
                  ["Channel", lead.channel_name],
                  ["Assistant", lead.agent_name],
                ]
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div className="row compact" key={label}>
                      <span className="row-text">
                        <span className="row-sub xs">{label}</span>
                        <span className="row-title" style={{ overflowWrap: "anywhere" }}>
                          {value}
                        </span>
                      </span>
                    </div>
                  ))}
              </div>
            </div>
            <div className="stack" style={{ gap: 4 }}>
              <span className="field-label">Activity</span>
              <ol className="timeline" style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {activityList(lead.activity).map((item, index) => (
                  <li key={`${item.kind}-${index}`} className="tl-item is-on">
                    <span className="tl-dot" aria-hidden="true" />
                    <span className="stack" style={{ gap: 0 }}>
                      <span>{activityText(item)}</span>
                      <span className="xs t3">{formatDate(item.at)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <Field label="Notes" counter={notesSaved ? "Saved" : undefined} hint="Only your team sees this. Saved when you click away.">
              <TextArea
                rows={3}
                value={notes}
                onChange={(event) => {
                  setNotes(event.target.value);
                  setNotesSaved(false);
                }}
                onBlur={() => notes !== lead.lead_notes && void save({ notes })}
              />
            </Field>
          </>
        )}
      </Drawer>
      {confirmDelete && (
        <Dialog
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

type Activity = { kind: string; at: string; detail: Record<string, unknown> };

// Newest first; status clicks less than 2 minutes apart read as one change (the last one).
function activityList(items: Activity[]) {
  const time = (item: Activity) => parseDate(item.at)?.getTime() ?? 0;
  const sorted = [...items].sort((a, b) => time(b) - time(a));
  return sorted.filter((item, index) => {
    if (item.kind !== "status" || index === 0) return true;
    const newer = sorted[index - 1];
    return !(newer.kind === "status" && time(newer) - time(item) < 120_000);
  });
}

function activityText(item: Activity) {
  if (item.kind === "created") return "Left contact details — lead created";
  if (item.kind === "status") return `Status set to ${statusLabel[item.detail.to as LeadStatus] ?? String(item.detail.to)}`;
  if (item.kind === "followup_sent") return `Follow-up ${String(item.detail.step ?? "")} sent`.replace("  ", " ");
  if (item.kind === "followup_skipped") return `Follow-up ${String(item.detail.step ?? "")} skipped · ${String(item.detail.reason ?? "")}`;
  return item.kind;
}
