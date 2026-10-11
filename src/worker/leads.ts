import type { Hono } from "hono";
import { z } from "zod";
import { formatPhone } from "../shared/contact";
import { writeAudit } from "./db";
import type { AuthVariables } from "./security/auth";

type AppEnv = { Bindings: Env; Variables: AuthVariables };

export const LEAD_STATUSES = ["new", "called", "won", "not_fit"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

type LeadRow = {
  id: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  lead_status: LeadStatus;
  lead_notes: string;
  lead_summary: string;
  lead_created_at: string;
  lead_status_at: string | null;
  agent_id: string | null;
  agent_name: string | null;
  platform: string | null;
  conversation_id: string | null;
  channel_name: string | null;
  followup: string | null;
};

// A lead is a contact with a status; erased contacts never show.
const LEAD_SELECT = `SELECT ct.id, ct.display_name, ct.phone, ct.email, ct.lead_status, ct.lead_notes, ct.lead_summary, ct.lead_created_at, ct.lead_status_at, ct.agent_id, ct.platform,
  a.name AS agent_name,
  (SELECT cv.id FROM conversations cv WHERE cv.contact_id = ct.id AND cv.connection_id NOT IN ('preview','eval') ORDER BY cv.last_activity_at DESC LIMIT 1) AS conversation_id,
  (SELECT cn.name FROM conversations cv JOIN connections cn ON cn.id = cv.connection_id WHERE cv.contact_id = ct.id ORDER BY cv.last_activity_at DESC LIMIT 1) AS channel_name,
  (SELECT e.event_type FROM runtime_events e JOIN conversations cv ON cv.id = e.conversation_id WHERE cv.contact_id = ct.id AND e.event_type = 'followup_sent' ORDER BY e.created_at DESC LIMIT 1) AS followup
FROM contacts ct LEFT JOIN agents a ON a.id = ct.agent_id
WHERE ct.lead_status IS NOT NULL AND ct.erased_at IS NULL`;

// Spreadsheet apps run cells that start with = + - @ as formulas; prefix those with a quote.
const csvCell = (value: unknown) => {
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

export function registerLeadRoutes(app: Hono<AppEnv>) {
  app.get("/api/admin/leads", async (c) => {
    const status = c.req.query("status");
    const agentId = c.req.query("agentId");
    const filters: string[] = [];
    const params: string[] = [];
    if (agentId) {
      filters.push("ct.agent_id = ?");
      params.push(agentId);
    }
    const scope = filters.length ? ` AND ${filters.join(" AND ")}` : "";
    const byStatus = status && (LEAD_STATUSES as readonly string[]).includes(status) ? " AND ct.lead_status = ?" : "";
    const [rows, counts, month] = await Promise.all([
      c.env.DB.prepare(`${LEAD_SELECT}${scope}${byStatus} ORDER BY ct.lead_created_at DESC LIMIT 500`).bind(...params, ...(byStatus ? [status!] : [])).all<LeadRow>(),
      c.env.DB.prepare(`SELECT ct.lead_status AS status, COUNT(*) AS count FROM contacts ct WHERE ct.lead_status IS NOT NULL AND ct.erased_at IS NULL${scope} GROUP BY ct.lead_status`).bind(...params).all<{ status: LeadStatus; count: number }>(),
      c.env.DB.prepare(`SELECT SUM(ct.lead_created_at >= datetime('now','start of month')) AS month, SUM(ct.lead_status = 'won' AND ct.lead_status_at >= datetime('now','start of month')) AS won FROM contacts ct WHERE ct.lead_status IS NOT NULL AND ct.erased_at IS NULL${scope}`).bind(...params).first<{ month: number | null; won: number | null }>(),
    ]);
    const perStatus = Object.fromEntries(LEAD_STATUSES.map((key) => [key, counts.results.find((row) => row.status === key)?.count ?? 0])) as Record<LeadStatus, number>;
    return c.json({
      leads: rows.results,
      counts: { all: LEAD_STATUSES.reduce((sum, key) => sum + perStatus[key], 0), ...perStatus },
      thisMonth: month?.month ?? 0,
      wonThisMonth: month?.won ?? 0,
    });
  });

  app.get("/api/admin/leads/export.csv", async (c) => {
    const rows = (await c.env.DB.prepare(`${LEAD_SELECT} ORDER BY ct.lead_created_at DESC`).all<LeadRow>()).results;
    const labels: Record<LeadStatus, string> = { new: "New", called: "Called", won: "Won", not_fit: "Not a fit" };
    const lines = [
      ["Name", "Phone", "Email", "Status", "What they want", "Notes", "Assistant", "Channel", "Received (UTC)"],
      ...rows.map((row) => [row.display_name, formatPhone(row.phone), row.email, labels[row.lead_status], row.lead_summary, row.lead_notes, row.agent_name, row.channel_name, row.lead_created_at]),
    ];
    await writeAudit(c.env.DB, "leads.exported", "contact", undefined, c.get("adminId"), { rows: rows.length });
    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename=leads-${new Date().toISOString().slice(0, 10)}.csv`);
    return c.body(`﻿${lines.map((line) => line.map(csvCell).join(",")).join("\r\n")}\r\n`);
  });

  app.get("/api/admin/leads/:id", async (c) => {
    const lead = await c.env.DB.prepare(`${LEAD_SELECT} AND ct.id = ?`).bind(c.req.param("id")).first<LeadRow>();
    if (!lead) return c.json({ error: "Lead not found" }, 404);
    const [changes, followups] = await Promise.all([
      c.env.DB.prepare("SELECT metadata_json, created_at FROM audit_logs WHERE resource_type='contact' AND resource_id=? AND action='lead.status' ORDER BY created_at ASC LIMIT 50").bind(lead.id).all<{ metadata_json: string; created_at: string }>(),
      c.env.DB.prepare("SELECT e.event_type, e.metadata_json, e.created_at FROM runtime_events e JOIN conversations cv ON cv.id=e.conversation_id WHERE cv.contact_id=? AND e.event_type IN ('followup_sent','followup_skipped') ORDER BY e.created_at ASC LIMIT 50").bind(lead.id).all<{ event_type: string; metadata_json: string; created_at: string }>(),
    ]);
    const activity = [
      { kind: "created", at: lead.lead_created_at, detail: {} as Record<string, unknown> },
      ...changes.results.map((row) => ({ kind: "status", at: row.created_at, detail: JSON.parse(row.metadata_json) as Record<string, unknown> })),
      ...followups.results.map((row) => ({ kind: row.event_type, at: row.created_at, detail: JSON.parse(row.metadata_json) as Record<string, unknown> })),
    ].sort((a, b) => a.at.localeCompare(b.at));
    return c.json({ ...lead, activity });
  });

  app.patch("/api/admin/leads/:id", async (c) => {
    const body = z.object({ status: z.enum(LEAD_STATUSES).optional(), notes: z.string().max(4000).optional() }).parse(await c.req.json());
    const lead = await c.env.DB.prepare("SELECT lead_status FROM contacts WHERE id=? AND lead_status IS NOT NULL AND erased_at IS NULL").bind(c.req.param("id")).first<{ lead_status: LeadStatus }>();
    if (!lead) return c.json({ error: "Lead not found" }, 404);
    const changed = body.status && body.status !== lead.lead_status;
    await c.env.DB.prepare("UPDATE contacts SET lead_status=COALESCE(?, lead_status), lead_status_at=CASE WHEN ? THEN datetime('now') ELSE lead_status_at END, lead_notes=COALESCE(?, lead_notes), updated_at=datetime('now') WHERE id=?")
      .bind(body.status ?? null, changed ? 1 : 0, body.notes ?? null, c.req.param("id"))
      .run();
    if (changed) await writeAudit(c.env.DB, "lead.status", "contact", c.req.param("id"), c.get("adminId"), { from: lead.lead_status, to: body.status });
    return c.json({ ok: true });
  });

  // Removes the person from Leads; the contact and the conversation stay (Erase is in Conversations).
  app.delete("/api/admin/leads/:id", async (c) => {
    const result = await c.env.DB.prepare("UPDATE contacts SET lead_status=NULL, lead_notes='', updated_at=datetime('now') WHERE id=? AND lead_status IS NOT NULL").bind(c.req.param("id")).run();
    if (!result.meta.changes) return c.json({ error: "Lead not found" }, 404);
    await writeAudit(c.env.DB, "lead.deleted", "contact", c.req.param("id"), c.get("adminId"));
    return c.json({ ok: true });
  });
}
