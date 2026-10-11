import Papa from "papaparse";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, del, patch, post } from "../api";
import { nextKey, titleField } from "../format";
import type { Collection } from "../types";
import { Alert, Badge, Button, Card, Dialog, EmptyState, errorMessage, Field, Icon, Menu, PageHeader, SearchField, Sheet, Skeleton, Switch, TextArea, TextInput, useToast } from "../ui";

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
function rowBadge(record: RecordRow): { tone: "blue" | "neutral"; label: string } | null {
  if (record.status !== "active") return { tone: "neutral", label: "Off" };
  if (record.valid_from && day(record.valid_from) > today()) return { tone: "blue", label: `Starts ${shortDay(record.valid_from)}` };
  if (record.valid_until && day(record.valid_until) < today()) return { tone: "neutral", label: `Ended ${shortDay(record.valid_until)}` };
  return null;
}
const isUsed = (record: RecordRow) => rowBadge(record) === null;

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
  const selected = collections.find((collection) => collection.id === openCollectionId) ?? visibleCollections[0] ?? collections[0];
  const [showHidden, setShowHidden] = useState(Boolean(selected?.archived_at));
  const [records, setRecords] = useState<RecordRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [editing, setEditing] = useState<RecordRow | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<{ title: string; text: string; retry?: () => void } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function loadRecords(collection = selected) {
    if (!collection) return;
    try {
      setRecords(await api<RecordRow[]>(`/api/admin/collections/${collection.id}/records`));
      setError(null);
    } catch (caught) {
      setError({ title: `Couldn't load ${collection.name}`, text: `${errorMessage(caught)}. The assistant still uses the saved rows.`, retry: () => void loadRecords(collection) });
    }
  }
  useEffect(() => {
    setRecords(null);
    setQuery("");
    void loadRecords();
  }, [selected?.id]);
  // Deep link from a Preview reply: open the exact row once it is loaded.
  useEffect(() => {
    if (!openRecordId || !records) return;
    const record = records.find((row) => row.id === openRecordId);
    if (record) setEditing(record);
  }, [openRecordId, records]);

  async function importCsv(file: File) {
    if (!selected) return;
    setError(null);
    const parsed = Papa.parse<Record<string, unknown>>(await file.text(), { header: true, skipEmptyLines: true });
    if (fileInput.current) fileInput.current.value = "";
    if (parsed.errors.length) {
      setError({ title: "This CSV can't be read", text: `${parsed.errors[0].message}. Nothing was imported.` });
      return;
    }
    setImporting(true);
    try {
      await post(`/api/admin/collections/${selected.id}/import`, { rows: parsed.data, mapping: {}, uniqueKey: upsertKey(fieldsOf(selected)) });
      toast(`Imported ${parsed.data.length} rows`);
      await loadRecords();
      await reload();
    } catch (caught) {
      setError({ title: "Nothing was imported", text: `${errorMessage(caught)}. No rows changed.` });
    } finally {
      setImporting(false);
    }
  }
  async function setHidden(collection: Collection, hidden: boolean) {
    try {
      await patch(`/api/admin/collections/${collection.id}`, { archived: hidden });
      await reload();
      toast(hidden ? "Table hidden" : "Table shown");
    } catch (caught) {
      setError({ title: hidden ? "Couldn't hide the table" : "Couldn't show the table", text: errorMessage(caught) });
    }
  }

  const allFields = selected ? fieldsOf(selected) : [];
  const title = titleField(allFields);
  const shown = allFields.filter((field) => field !== title && field.key !== "id" && !hiddenTypes.has(field.type) && !scheduleColumns.has(field.key) && field.key !== upsertKey(allFields));
  const detailField = shown.find((field) => field.type === "long_text") ?? shown.find((field) => field.type === "text");
  const footFields = shown.filter((field) => field !== detailField).slice(0, 3);
  const visible = (records ?? []).filter((record) => !query || record.data_json.toLowerCase().includes(query.toLowerCase()));
  const usedCount = (records ?? []).filter(isUsed).length;

  return (
    <div className="page data-page">
      <PageHeader title="Data" subtitle="Prices, offers and stock. Edits reach customers right away." />
      {error && (
        <Alert
          tone="error"
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

      {collections.length === 0 ? (
        <div className="section-card">
          <EmptyState
            icon="table"
            title="No tables yet"
            text="Keep prices, offers and stock here. The assistant checks them before it quotes anything, so answers stay current."
            action={<Button onClick={() => setCreating(true)}>New table</Button>}
          />
        </div>
      ) : (
        <div className="split">
          <div className="master">
            <Card title="Tables">
              {visibleCollections.map((collection) => (
                <TableRow key={collection.id} collection={collection} selected={collection.id === selected?.id} onClick={() => onSelect(collection.id)} />
              ))}
              {hiddenCollections.length > 0 && (
                <button type="button" className="row" aria-expanded={showHidden} onClick={() => setShowHidden(!showHidden)}>
                  <span className="tile tile-soft-gray" aria-hidden="true">
                    <Icon name="eye-slash" size={18} />
                  </span>
                  <span className="row-body">
                    <span className="row-text">
                      <span className="row-title muted">Hidden tables</span>
                    </span>
                    <span className="row-detail tabular">{hiddenCollections.length}</span>
                    <Icon name={showHidden ? "chevron-down" : "chevron-right"} className="row-chevron" size={14} />
                  </span>
                </button>
              )}
              {showHidden && hiddenCollections.map((collection) => <TableRow key={collection.id} collection={collection} hidden selected={collection.id === selected?.id} onClick={() => onSelect(collection.id)} />)}
            </Card>
            <Button variant="ghost" icon="plus" className="new-table" onClick={() => setCreating(true)}>
              New table
            </Button>
          </div>

          {selected && (
            <div className="detail">
              <div className="detail-head">
                <div className="detail-heading">
                  <h2 className="detail-title truncate">{selected.name}</h2>
                  <p className="status-line">
                    {selected.archived_at ? "Hidden · the assistant can't look it up · " : ""}
                    {records ? `${usedCount} in use · ${records.length} total` : "Loading…"}
                  </p>
                </div>
                <SearchField className="detail-search" value={query} onChange={setQuery} placeholder="Search rows" />
                <Button size="sm" icon="plus" onClick={() => setEditing("new")}>
                  Add
                </Button>
                <Menu
                  label="More table actions"
                  items={[
                    { label: importing ? "Importing…" : "Import CSV", icon: "upload", onSelect: () => fileInput.current?.click() },
                    { label: "Rename", icon: "pencil", onSelect: () => setRenaming(true) },
                    { separator: true },
                    selected.archived_at
                      ? { label: "Show table", icon: "eye-slash", onSelect: () => void setHidden(selected, false) }
                      : { label: "Hide table", icon: "eye-slash", onSelect: () => void setHidden(selected, true) },
                  ]}
                />
                <input ref={fileInput} hidden type="file" accept=".csv,text/csv" onChange={(event) => event.target.files?.[0] && void importCsv(event.target.files[0])} />
              </div>

              {!records ? (
                error ? null : <Skeleton rows={3} />
              ) : records.length === 0 ? (
                <div className="section-card">
                  <EmptyState icon="table" title="No rows yet" text="Add one row with Add, or many at once with Import CSV in the ••• menu." />
                </div>
              ) : (
                <Card footer="Rows that are off, have ended or haven't started are never used by the assistant.">
                  {visible.length === 0 ? (
                    <EmptyState icon="search" title={`No rows match “${query}”`} text="Try another word, or add a new row." />
                  ) : (
                    visible.map((record) => {
                      const data = JSON.parse(record.data_json || "{}") as Record<string, unknown>;
                      const badge = rowBadge(record);
                      const name = String((title && data[title.key]) || record.external_key || "Untitled row");
                      const details = detailField ? String(data[detailField.key] ?? "") : "";
                      const foot = footFields
                        .map((field) => (data[field.key] === undefined || data[field.key] === "" ? null : `${field.label} ${String(data[field.key])}`))
                        .filter(Boolean)
                        .join(" · ");
                      return (
                        <button type="button" className="row top" key={record.id} onClick={() => setEditing(record)}>
                          <span className="row-body data-row">
                            <span className="row-text">
                              <span className="row-title strong truncate">{name}</span>
                              {details && <span className="row-subtitle clamp-2 data-details">{details}</span>}
                              {foot && <span className="row-subtitle data-foot truncate">{foot}</span>}
                            </span>
                            {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
                            <Icon name="chevron-right" className="row-chevron" size={14} />
                          </span>
                        </button>
                      );
                    })
                  )}
                </Card>
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
            onSelect(id);
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
            if (openRecordId) onSelect(selected.id);
          }}
          onDone={async (message) => {
            setEditing(null);
            if (openRecordId) onSelect(selected.id);
            toast(message);
            await loadRecords();
            await reload();
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

function TableRow({ collection, selected, hidden, onClick }: { collection: Collection; selected: boolean; hidden?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`row${selected ? " is-selected" : ""}`} aria-current={selected || undefined} onClick={onClick}>
      <span className={`tile tile-${hidden ? "gray" : "green"}`} aria-hidden="true">
        <Icon name="table" size={18} />
      </span>
      <span className="row-body">
        <span className="row-text">
          <span className="row-title truncate">{collection.name}</span>
        </span>
        {collection.record_count !== undefined && <span className="row-detail tabular">{collection.record_count}</span>}
        <Icon name="chevron-right" className="row-chevron" size={14} />
      </span>
    </button>
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
      <Sheet
        title={initialName}
        subtitle={collection.name}
        onClose={onClose}
        footer={
          <>
            {record && (
              <Button variant="ghost" destructive onClick={() => setConfirmDelete(true)}>
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
          {error && <Alert tone="error" title="Couldn't save this row" text={`${error}. Your edit is kept here; customers still see the old row.`} />}
          <Card title="Availability" footer="Leave Starts and Ends empty for a row that always applies.">
            <div className="field">
              <span className="field-label spacer">Active</span>
              <Switch label="Active" checked={active} onChange={setActive} />
            </div>
            <Field label="Starts">
              <TextInput type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Starts" />
            </Field>
            <Field label="Ends">
              <TextInput type="date" value={until} onChange={(event) => setUntil(event.target.value)} aria-label="Ends" />
            </Field>
          </Card>
          <Card title="Details">
            {fields.map((field) => {
              const value = data[field.key];
              return (
                <Field key={field.key} label={field.label}>
                  {field.type === "long_text" || field.type === "text" ? (
                    <TextArea rows={1} value={String(value ?? "")} onChange={(event) => set(field.key, event.target.value)} required={field.required} aria-label={field.label} />
                  ) : field.type === "boolean" ? (
                    <Switch label={field.label} checked={value === true || value === "true" || value === 1 || value === "1"} onChange={(on) => set(field.key, on)} />
                  ) : field.type === "enum" && field.options?.length ? (
                    <select className="select" value={String(value ?? "")} onChange={(event) => set(field.key, event.target.value)} required={field.required} aria-label={field.label}>
                      <option value="">None</option>
                      {field.options.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
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
          </Card>
        </form>
      </Sheet>
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
        <Card>
          <Field label="Table name">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} required />
          </Field>
        </Card>
        <Card title="Column names" footer="Only the names you see change; data and CSV headers stay the same.">
          {fields.map((field) => (
            <Field key={field.key} label={field.label} hint={field.key}>
              <TextInput value={labels[field.key] ?? ""} onChange={(event) => setLabels({ ...labels, [field.key]: event.target.value })} required aria-label={`New name for ${field.label}`} />
            </Field>
          ))}
        </Card>
        {error && <Alert tone="error" title="Couldn't rename" text={error} />}
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
        <Card>
          <Field label="Name">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="Offers" required data-autofocus />
          </Field>
        </Card>
        <Card
          title="Columns"
          action={
            <Button type="button" variant="ghost" icon="plus" onClick={() => setFields((current) => [...current, { key: `field_${current.length + 1}`, label: `Column ${current.length + 1}`, type: "text", required: false }])}>
              Add column
            </Button>
          }
          footer="For CSV imports, headers should match the column names in lowercase with underscores, e.g. unit_price."
        >
          {fields.map((field, index) => (
            <div className="row field-editor" key={index}>
              <TextInput aria-label={`Column ${index + 1} name`} value={field.label} placeholder="Column name" onChange={(event) => update(index, { label: event.target.value, key: identifier(event.target.value) })} />
              <select className="select" aria-label={`Column ${index + 1} type`} value={field.type} onChange={(event) => update(index, { type: event.target.value })}>
                {fieldTypes.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <Switch label={`Column ${index + 1} required`} checked={Boolean(field.required)} onChange={(required) => update(index, { required })} />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon="xmark"
                aria-label={`Remove column ${index + 1}`}
                disabled={fields.length === 1}
                onClick={() => setFields((current) => current.filter((_, i) => i !== index))}
              />
            </div>
          ))}
        </Card>
        {error && <Alert tone="error" title="Couldn't create the table" text={error} />}
      </form>
    </Sheet>
  );
}
