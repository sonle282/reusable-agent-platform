import Papa from "papaparse";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, del, patch, post } from "../api";
import { nextKey, titleField } from "../format";
import type { AgentDetail, AgentSummary, Collection } from "../types";
import { AgentAvatar, Alert, Badge, Button, Card, Chips, Dialog, Drawer, EmptyState, errorMessage, Field, formatDate, Icon, LoadError, Menu, PageHeader, SearchField, Select, SettingRow, Sheet, Skeleton, Switch, Table, TextArea, TextInput, Tile, useToast, When } from "../ui";

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
const shortDay = (value: string) => {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(date.getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }) });
};
const today = () => new Date().toLocaleDateString("en-CA");

// Schedule and on/off are controlled by the row itself; imported columns that duplicate them are hidden in forms.
const scheduleColumns = new Set(["bat_dau", "ket_thuc", "dang_chay", "valid_from", "valid_until", "start_date", "end_date", "active", "is_active", "status"]);
const hiddenTypes = new Set(["url", "image_url"]);

// Only rows that customers won't get are marked: switched off, not started, ended.
function rowBadge(record: RecordRow): { tone: "info" | "neutral"; label: string } | null {
  if (record.status !== "active") return { tone: "neutral", label: "Off" };
  if (record.valid_from && day(record.valid_from) > today()) return { tone: "info", label: `Starts ${shortDay(record.valid_from)}` };
  if (record.valid_until && day(record.valid_until) < today()) return { tone: "neutral", label: `Ended ${shortDay(record.valid_until)}` };
  return null;
}
type RowFilter = "all" | "active" | "scheduled" | "off";
const rowFilters: Array<{ value: RowFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "scheduled", label: "Scheduled" },
  { value: "off", label: "Ended or off" },
];
const rowState = (record: RecordRow): Exclude<RowFilter, "all"> => {
  if (record.status !== "active") return "off";
  if (record.valid_from && day(record.valid_from) > today()) return "scheduled";
  if (record.valid_until && day(record.valid_until) < today()) return "off";
  return "active";
};
const columnSummary = (collection: Collection) =>
  fieldsOf(collection)
    .filter((field) => field.key !== "id")
    .slice(0, 4)
    .map((field) => field.label)
    .join(", ");

// #/data lists the tables; #/data/<table> is one table's rows; #/data/<table>/<row> opens a row in the drawer.
export function DataPage({
  agent,
  collections,
  reload,
  openCollectionId,
  openRecordId,
  onSelect,
}: {
  agent: AgentSummary;
  collections: Collection[];
  reload: () => Promise<void>;
  openCollectionId?: string;
  openRecordId?: string;
  onSelect: (id?: string, recordId?: string) => void;
}) {
  const [usedBy, setUsedBy] = useState<Set<string>>(new Set());
  // The assistant's draft says which tables it looks up ("Used by").
  useEffect(() => {
    void api<AgentDetail>(`/api/admin/agents/${agent.id}`).then(
      (detail) => setUsedBy(new Set(detail.draft.collectionBindings.map((binding) => binding.collectionId))),
      () => setUsedBy(new Set()),
    );
  }, [agent.id]);
  const selected = collections.find((collection) => collection.id === openCollectionId);
  if (selected) return <TablePage key={selected.id} agent={agent} collection={selected} used={usedBy.has(selected.id)} reload={reload} openRecordId={openRecordId} onSelect={onSelect} />;
  return <TablesList agent={agent} collections={collections} usedBy={usedBy} reload={reload} onSelect={onSelect} />;
}

function TablesList({ agent, collections, usedBy, reload, onSelect }: { agent: AgentSummary; collections: Collection[]; usedBy: Set<string>; reload: () => Promise<void>; onSelect: (id?: string) => void }) {
  const [creating, setCreating] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const hiddenCount = collections.filter((collection) => collection.archived_at).length;
  const listed = collections.filter((collection) => showHidden || !collection.archived_at);
  return (
    <div className="page">
      <PageHeader
        title="Data"
        subtitle="Prices, offers and stock your assistant looks up. Edits reach customers right away."
        actions={
          <Button icon="plus" onClick={() => setCreating(true)}>
            New table
          </Button>
        }
      />
      {collections.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="table"
            title="No tables yet"
            text="Keep prices, offers and stock here so every answer about money is current. The assistant checks them before it quotes anything."
            action={<Button onClick={() => setCreating(true)}>New table</Button>}
          />
        </div>
      ) : (
        <div className="card">
          <Table label="Tables">
            <thead>
              <tr>
                <th style={{ width: "44%" }}>Table</th>
                <th style={{ width: "14%" }}>Rows</th>
                <th className="table-cols-optional" style={{ width: "24%" }}>
                  Used by
                </th>
                <th className="table-cols-optional" style={{ width: "14%" }}>
                  Updated
                </th>
                <th className="cell-actions">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {listed.map((collection) => (
                <tr key={collection.id} onClick={() => onSelect(collection.id)}>
                  <td>
                    <span className="row-flex" style={{ gap: 12 }}>
                      <Tile icon="table" />
                      <span className="stack" style={{ gap: 0 }}>
                        <button type="button" className="row-open strong truncate" onClick={(event) => (event.stopPropagation(), onSelect(collection.id))}>
                          {collection.name}
                        </button>
                        <span className="xs t3 truncate">{columnSummary(collection)}</span>
                      </span>
                      {collection.archived_at && <Badge>Hidden</Badge>}
                    </span>
                  </td>
                  <td className="tabular">{collection.record_count ?? "—"}</td>
                  <td className="table-cols-optional">
                    {usedBy.has(collection.id) ? (
                      <span className="row-flex" style={{ gap: 6 }}>
                        <AgentAvatar id={agent.id} name={agent.name} size="xs" />
                        <span className="xs t3 truncate">{agent.name}</span>
                      </span>
                    ) : (
                      <span className="xs t3">Not used</span>
                    )}
                  </td>
                  <td className="table-cols-optional t2">
                    <When value={collection.updated_at} />
                  </td>
                  <td className="cell-actions">
                    <Icon name="chevron-right" className="chev" size={16} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          {hiddenCount > 0 && (
            <div className="card-foot row-flex">
              <Button variant="ghost" size="sm" icon="eye-off" style={{ marginLeft: -8 }} aria-expanded={showHidden} onClick={() => setShowHidden(!showHidden)}>
                {showHidden ? "Hide hidden tables" : `Show hidden tables (${hiddenCount})`}
              </Button>
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
            onSelect(id);
          }}
        />
      )}
    </div>
  );
}

function TablePage({
  agent,
  collection,
  used,
  reload,
  openRecordId,
  onSelect,
}: {
  agent: AgentSummary;
  collection: Collection;
  used: boolean;
  reload: () => Promise<void>;
  openRecordId?: string;
  onSelect: (id?: string, recordId?: string) => void;
}) {
  const toast = useToast();
  const [records, setRecords] = useState<RecordRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<RowFilter>("all");
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<{ title: string; text: string; retry?: () => void } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function loadRecords() {
    try {
      setRecords(await api<RecordRow[]>(`/api/admin/collections/${collection.id}/records`));
      setError(null);
    } catch (caught) {
      setError({ title: `Couldn't load ${collection.name}`, text: `${errorMessage(caught)}. The assistant still uses the saved rows.`, retry: () => void loadRecords() });
    }
  }
  useEffect(() => void loadRecords(), [collection.id]);

  async function importCsv(file: File) {
    setError(null);
    const parsed = Papa.parse<Record<string, unknown>>(await file.text(), { header: true, skipEmptyLines: true });
    if (fileInput.current) fileInput.current.value = "";
    if (parsed.errors.length) {
      setError({ title: "This CSV can't be read", text: `${parsed.errors[0].message}. Nothing was imported.` });
      return;
    }
    setImporting(true);
    try {
      await post(`/api/admin/collections/${collection.id}/import`, { rows: parsed.data, mapping: {}, uniqueKey: upsertKey(fieldsOf(collection)) });
      toast(`Imported ${parsed.data.length} rows`);
      await loadRecords();
      await reload();
    } catch (caught) {
      setError({ title: "Nothing was imported", text: `${errorMessage(caught)}. No rows changed.` });
    } finally {
      setImporting(false);
    }
  }
  async function setHidden(hidden: boolean) {
    try {
      await patch(`/api/admin/collections/${collection.id}`, { archived: hidden });
      await reload();
      toast(hidden ? "Table hidden" : "Table shown");
    } catch (caught) {
      setError({ title: hidden ? "Couldn't hide the table" : "Couldn't show the table", text: errorMessage(caught) });
    }
  }

  const allFields = fieldsOf(collection);
  const title = titleField(allFields);
  const shown = allFields.filter((field) => field !== title && field.key !== "id" && !hiddenTypes.has(field.type) && !scheduleColumns.has(field.key) && field.key !== upsertKey(allFields));
  const detailField = shown.find((field) => field.type === "long_text") ?? shown.find((field) => field.type === "text");
  const extraField = shown.find((field) => field !== detailField);
  const counts = { all: records?.length ?? 0, active: 0, scheduled: 0, off: 0 } as Record<RowFilter, number>;
  for (const record of records ?? []) counts[rowState(record)] += 1;
  const visible = (records ?? []).filter((record) => (filter === "all" || rowState(record) === filter) && (!query || record.data_json.toLowerCase().includes(query.toLowerCase())));
  const opened = openRecordId && records ? records.find((row) => row.id === openRecordId) : undefined;

  return (
    <div className="page" style={{ gap: 20 }}>
      <nav className="crumbs" aria-label="Breadcrumb">
        <button type="button" onClick={() => onSelect(undefined)}>
          Data
        </button>
        <Icon name="chevron-right" size={16} />
        <span style={{ color: "var(--color-text)" }} aria-current="page">
          {collection.name}
        </span>
      </nav>
      <header className="page-header">
        <div style={{ minWidth: 0 }}>
          <h1 className="page-title truncate">{collection.name}</h1>
          <p className="page-sub row-flex" style={{ flexWrap: "wrap", gap: "6px 10px" }}>
            <span>
              {records ? `${plural(counts.all, "row")} · ${counts.active === counts.all ? "all in use" : `${counts.active} in use`}` : "Loading…"}
              {" · "}
              {collection.archived_at ? "hidden, the assistant can't look it up" : used ? `used by ${agent.name}` : "not used by the assistant yet (turn it on in Assistant › Sources)"}
            </span>
          </p>
        </div>
        <div className="row-flex">
          <Button variant="outline" icon="upload" className="hide-phone" busy={importing} onClick={() => fileInput.current?.click()}>
            Import CSV
          </Button>
          <Button icon="plus" onClick={() => setAdding(true)}>
            Add row
          </Button>
          <Menu
            label="More table actions"
            size="md"
            items={[
              { label: importing ? "Importing…" : "Import CSV", icon: "upload", onSelect: () => fileInput.current?.click() },
              { label: "Rename", icon: "edit", onSelect: () => setRenaming(true) },
              { separator: true },
              collection.archived_at ? { label: "Show table", icon: "eye", onSelect: () => void setHidden(false) } : { label: "Hide table", icon: "eye-off", onSelect: () => void setHidden(true) },
            ]}
          />
          <input ref={fileInput} hidden type="file" accept=".csv,text/csv" onChange={(event) => event.target.files?.[0] && void importCsv(event.target.files[0])} />
        </div>
      </header>

      {error && !(error.retry && !records) && (
        <Alert
          tone="danger"
          title={error.title}
          text={error.text}
          onClose={error.retry ? undefined : () => setError(null)}
          actions={
            error.retry ? (
              <Button variant="outline" size="sm" onClick={error.retry}>
                Try again
              </Button>
            ) : undefined
          }
        />
      )}

      <div className="row-flex" style={{ flexWrap: "wrap", gap: 12 }}>
        <SearchField className="data-search" value={query} onChange={setQuery} placeholder="Search rows" />
        <Chips label="Filter rows" value={filter} onChange={setFilter} options={rowFilters.map((item) => ({ ...item, count: records ? counts[item.value] : undefined }))} />
      </div>

      <div className="card">
        {!records ? (
          error?.retry ? <LoadError title={error.title} text="The assistant still uses the saved rows." onRetry={error.retry} /> : <Skeleton rows={3} card={false} />
        ) : records.length === 0 ? (
          <EmptyState
            icon="table"
            title="No rows yet"
            text="Add your first row, or import a spreadsheet with the same column names."
            action={
              <div className="row-flex" style={{ justifyContent: "center" }}>
                <Button onClick={() => setAdding(true)}>Add row</Button>
                <Button variant="outline" onClick={() => fileInput.current?.click()}>
                  Import CSV
                </Button>
              </div>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState icon="search" title={query ? `No rows match “${query}”` : "No rows here"} text="Try another word or filter, or add a new row." />
        ) : (
          <Table label={collection.name}>
            <thead>
              <tr>
                <th style={{ width: "32%" }}>{title?.label ?? "Row"}</th>
                {detailField && (
                  <th className="table-cols-optional" style={{ width: "36%" }}>
                    {detailField.label}
                  </th>
                )}
                {extraField && (
                  <th className="table-cols-optional" style={{ width: "15%" }}>
                    {extraField.label}
                  </th>
                )}
                <th style={{ width: "17%" }}>Availability</th>
                <th className="cell-actions">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((record) => {
                const data = JSON.parse(record.data_json || "{}") as Record<string, unknown>;
                const badge = rowBadge(record);
                const name = String((title && data[title.key]) || record.external_key || "Untitled row");
                return (
                  <tr key={record.id} onClick={() => onSelect(collection.id, record.id)}>
                    <td>
                      <button type="button" className="row-open medium truncate" style={{ display: "block", maxWidth: "100%" }} onClick={(event) => (event.stopPropagation(), onSelect(collection.id, record.id))}>
                        <CellText value={name} />
                      </button>
                    </td>
                    {detailField && (
                      <td className="table-cols-optional t2">
                        <span className="clamp-2">
                          <CellText value={String(data[detailField.key] ?? "")} />
                        </span>
                      </td>
                    )}
                    {extraField && (
                      <td className="table-cols-optional t2">
                        <span className="truncate" style={{ display: "block" }}>
                          <CellText value={String(data[extraField.key] ?? "")} />
                        </span>
                      </td>
                    )}
                    <td>{badge ? <Badge tone={badge.tone}>{badge.label}</Badge> : <span className="t3">Always</span>}</td>
                    <td className="cell-actions">
                      <Icon name="chevron-right" className="chev" size={16} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        {records && records.length > 0 && <div className="card-foot">Rows that are off, have ended or haven't started are never used by the assistant.</div>}
      </div>

      {(adding || opened) && (
        <RecordDrawer
          collection={collection}
          existingKeys={(records ?? []).map((row) => row.external_key ?? "").filter(Boolean)}
          record={adding ? null : (opened ?? null)}
          onClose={() => {
            setAdding(false);
            if (openRecordId) onSelect(collection.id);
          }}
          onDone={async (message) => {
            setAdding(false);
            if (openRecordId) onSelect(collection.id);
            toast(message);
            await loadRecords();
            await reload();
          }}
        />
      )}
      {renaming && (
        <RenameSheet
          collection={collection}
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

function RecordDrawer({

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
  const title = titleField(allFields);
  const [data, setData] = useState<Record<string, unknown>>(() =>
    record ? (JSON.parse(record.data_json || "{}") as Record<string, unknown>) : key ? { [key]: nextKey(existingKeys) } : {},
  );
  const [active, setActive] = useState(record ? record.status === "active" : true);
  const [from, setFrom] = useState(day(record?.valid_from));
  const [until, setUntil] = useState(day(record?.valid_until));
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const set = (field: string, value: unknown) => setData((current) => ({ ...current, [field]: value }));
  const initialName = record ? String((title && (JSON.parse(record.data_json || "{}") as Record<string, unknown>)[title.key]) || record.external_key || "Row") : `New row`;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body = { data, status: active ? "active" : "archived", validFrom: from || null, validUntil: until || null };
    try {
      if (record) await patch(`/api/admin/collections/${collection.id}/records/${record.id}`, body);
      else await post(`/api/admin/collections/${collection.id}/records`, { ...body, externalKey: key && data[key] ? String(data[key]) : undefined });
      onDone(record ? "Saved · the assistant uses it now" : "Added · the assistant uses it now");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Drawer
        title={/^[a-z][a-z0-9_]{0,23}$/.test(initialName) ? (initialName.charAt(0).toUpperCase() + initialName.slice(1)).replaceAll("_", " ") : initialName}
        subtitle={collection.name}
        onClose={onClose}
        footer={
          <>
            {record && (
              <Button variant="danger-ghost" onClick={() => setConfirmDelete(true)}>
                Delete row
              </Button>
            )}
            <span className="spacer" />
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="record-form" busy={busy}>
              {record ? "Save" : "Add"}
            </Button>
          </>
        }
      >
        <form id="record-form" className="sheet-form" onSubmit={submit}>
          {error && <Alert tone="danger" title="Couldn't save this row" text={`${error}. Your edit is kept here; customers still see the old row.`} />}
          <SettingRow title="Active" sub="Off rows are never used by the assistant">
            <Switch label="Active" checked={active} onChange={setActive} />
          </SettingRow>
          <div className="field-grid narrow">
            <Field label="Starts">
              <TextInput type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </Field>
            <Field label="Ends">
              <TextInput type="date" value={until} onChange={(event) => setUntil(event.target.value)} />
            </Field>
          </div>
          <p className="help" style={{ marginTop: -8 }}>Leave Starts and Ends empty for a row that always applies.</p>
            {fields.map((field) => {
              const value = data[field.key];
              return (
                <Field key={field.key} label={field.label}>
                  {field.type === "long_text" || field.type === "text" ? (
                    <TextArea rows={field.type === "long_text" ? 2 : 1} value={String(value ?? "")} onChange={(event) => set(field.key, event.target.value)} required={field.required} aria-label={field.label} />
                  ) : field.type === "boolean" ? (
                    <Switch label={field.label} checked={value === true || value === "true" || value === 1 || value === "1"} onChange={(on) => set(field.key, on)} />
                  ) : field.type === "enum" && field.options?.length ? (
                    <Select value={String(value ?? "")} onChange={(event) => set(field.key, event.target.value)} required={field.required} aria-label={field.label}>
                      <option value="">None</option>
                      {field.options.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </Select>
                  ) : (
                    <TextInput
                      className={field.type === "number" ? "tabular" : undefined}
                      type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "datetime" ? "datetime-local" : field.type === "url" || field.type === "image_url" ? "url" : "text"}
                      step={field.type === "number" ? "any" : undefined}
                      value={String(value ?? "")}
                      onChange={(event) => set(field.key, event.target.value)}
                      required={field.required}
                      aria-label={field.label}
                    />
                  )}
                </Field>
              );
            })}
        </form>
      </Drawer>
      {confirmDelete && record && (
        <Dialog
          title="Delete this row?"
          text="The assistant stops using it right away. This can't be undone."
          confirmLabel="Delete"
          destructive
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            try {
              await del(`/api/admin/collections/${collection.id}/records/${record.id}`);
              onDone("Row deleted");
            } catch (caught) {
              setConfirmDelete(false);
              setError(errorMessage(caught));
            }
          }}
        />
      )}
    </>
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
      subtitle={collection.name}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="rename-form" busy={busy}>
            Save
          </Button>
        </>
      }
    >
      <form id="rename-form" className="sheet-form" onSubmit={submit}>
        <Field label="Table name">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Card title="Column names" footer="Only the names you see change; data and CSV headers stay the same.">
          {fields.map((field) => (
            <Field key={field.key} label={field.label} hint={field.key}>
              <TextInput value={labels[field.key] ?? ""} onChange={(event) => setLabels({ ...labels, [field.key]: event.target.value })} required aria-label={`New name for ${field.label}`} />
            </Field>
          ))}
        </Card>
        {error && <Alert tone="danger" title="Couldn't rename" text={error} />}
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
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="create-collection" busy={busy} disabled={!name || !fields.length}>
            Create
          </Button>
        </>
      }
    >
      <form id="create-collection" className="sheet-form" onSubmit={submit}>
        <Field label="Name">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="Offers" required data-autofocus />
        </Field>
        <Card
          title="Columns"
          action={
            <Button type="button" variant="ghost" size="sm" icon="plus" onClick={() => setFields((current) => [...current, { key: `field_${current.length + 1}`, label: `Column ${current.length + 1}`, type: "text", required: false }])}>
              Add column
            </Button>
          }
          footer="For CSV imports, headers should match the column names in lowercase with underscores, e.g. unit_price."
        >
          {fields.map((field, index) => (
            <div className="row compact column-editor" key={index}>
              <TextInput aria-label={`Column ${index + 1} name`} value={field.label} placeholder="Column name" onChange={(event) => update(index, { label: event.target.value, key: identifier(event.target.value) })} />
              <Select block={false} aria-label={`Column ${index + 1} type`} value={field.type} onChange={(event) => update(index, { type: event.target.value })}>
                {fieldTypes.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Switch label={`Column ${index + 1} required`} checked={Boolean(field.required)} onChange={(required) => update(index, { required })} />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon="x"
                aria-label={`Remove column ${index + 1}`}
                disabled={fields.length === 1}
                onClick={() => setFields((current) => current.filter((_, i) => i !== index))}
              />
            </div>
          ))}
        </Card>
        {error && <Alert tone="danger" title="Couldn't create the table" text={error} />}
      </form>
    </Sheet>
  );
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

// Table cells stay scannable: a lowercase key ("shipping") reads as a tag, and several questions show the first one and "+N".
function CellText({ value }: { value: string }) {
  const text = value.trim();
  if (/^[a-z][a-z0-9_]{0,23}$/.test(text)) return <Badge>{(text.charAt(0).toUpperCase() + text.slice(1)).replaceAll("_", " ")}</Badge>;
  const questions = text.split("?").map((part) => part.trim()).filter(Boolean);
  if (text.split("?").length > 2 && questions.length > 1)
    return (
      <span title={text}>
        {questions[0]}? <span className="t3">+{questions.length - 1}</span>
      </span>
    );
  return <>{text}</>;
}
