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
                <Row key={collection.id} icon="data" tone="green" title={collection.name} onClick={() => setSelectedId(collection.id)} selected={collection.id === selected?.id} />
              ))}
            </Section>
            {hiddenCollections.length > 0 && (
              <details className="advanced hidden-tables">
                <summary>Hidden tables · {hiddenCollections.length}</summary>
                <Section>
                  {hiddenCollections.map((collection) => (
                    <Row key={collection.id} icon="data" tone="gray" title={collection.name} onClick={() => setSelectedId(collection.id)} selected={collection.id === selected?.id} />
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
