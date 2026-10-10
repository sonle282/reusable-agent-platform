import Papa from "papaparse";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, patch, post } from "../api";
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

export function DataPage({ collections, reload }: { collections: Collection[]; reload: () => Promise<void> }) {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState(collections[0]?.id ?? "");
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

  async function importCsv(file: File) {
    if (!selected) return;
    setError("");
    const parsed = Papa.parse<Record<string, unknown>>(await file.text(), { header: true, skipEmptyLines: true });
    if (parsed.errors.length) {
      setError(`CSV không hợp lệ: ${parsed.errors[0].message}`);
      return;
    }
    setImporting(true);
    try {
      await post(`/api/admin/collections/${selected.id}/import`, { rows: parsed.data, mapping: {}, uniqueKey: upsertKey(fieldsOf(selected)) });
      toast(`Đã nhập ${parsed.data.length} dòng`);
      await loadRecords();
    } catch (caught) {
      setError(`Không nhập được — không có dòng nào bị thay đổi. ${errorMessage(caught)}`);
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const allFields = selected ? fieldsOf(selected) : [];
  const columns = allFields.filter((field) => field.key !== "id" && field.type !== "url" && field.type !== "image_url").slice(0, 3);
  const visible = (records ?? []).filter((record) => !query || record.data_json.toLowerCase().includes(query.toLowerCase()));
  const activeCount = (records ?? []).filter((record) => record.status === "active").length;
  return (
    <div className="page">
      <PageHeader
        title="Dữ liệu"
        subtitle="Giá, ưu đãi, tồn kho — thông tin hay thay đổi. Sửa ở đây là trợ lý dùng ngay, không cần xuất bản lại."
        actions={
          <Button variant="gray" icon="plus" onClick={() => setCreating(true)}>
            Bộ dữ liệu
          </Button>
        }
      />
      {error && <Banner onClose={() => setError("")}>{error}</Banner>}
      {collections.length === 0 ? (
        <EmptyState icon="data" title="Chưa có bộ dữ liệu" text="Tạo bộ dữ liệu như Sản phẩm hoặc Ưu đãi." action={<Button onClick={() => setCreating(true)}>Tạo bộ dữ liệu</Button>} />
      ) : (
        <div className="master-detail stack">
          <nav className="master" aria-label="Bộ dữ liệu">
            <Section>
              {collections.map((collection) => (
                <Row key={collection.id} icon="data" iconTint="var(--green)" title={collection.name} onClick={() => setSelectedId(collection.id)} selected={collection.id === selected?.id} />
              ))}
            </Section>
          </nav>
          {selected && (
            <div className="detail">
              <div className="detail-header">
                <div>
                  <h2>{selected.name}</h2>
                  <p className="text-secondary">{records ? `${activeCount} đang áp dụng · ${records.length} tổng` : "Đang tải…"}</p>
                </div>
                <div className="inline-actions">
                  <label className="search-field compact">
                    <Icon name="search" size={15} />
                    <input type="search" placeholder="Tìm" aria-label="Tìm" value={query} onChange={(event) => setQuery(event.target.value)} />
                  </label>
                  <Button icon="plus" onClick={() => setEditing("new")}>
                    Thêm
                  </Button>
                  <Button variant="gray" busy={importing} onClick={() => fileInput.current?.click()}>
                    Nhập CSV
                  </Button>
                  <Button variant="plain" onClick={() => setRenaming(true)}>
                    Đổi tên cột
                  </Button>
                  <input ref={fileInput} hidden type="file" accept=".csv,text/csv" onChange={(event) => event.target.files?.[0] && void importCsv(event.target.files[0])} />
                </div>
              </div>
              {!records ? (
                <div className="page-loading"><Spinner /></div>
              ) : visible.length === 0 ? (
                <EmptyState icon="data" title={query ? "Không tìm thấy" : "Chưa có dòng nào"} text={query ? "Thử từ khoá khác." : "Bấm Thêm để nhập từng dòng, hoặc nhập nhiều dòng từ CSV."} />
              ) : (
                <div className="table-card">
                  <table>
                    <thead>
                      <tr>
                        {columns.map((field) => (
                          <th key={field.key}>{field.label}</th>
                        ))}
                        <th>Thời gian</th>
                        <th>Trạng thái</th>
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
                            <td className="nowrap">{record.valid_from || record.valid_until ? `${formatDate(record.valid_from).split(" ")[0]} – ${formatDate(record.valid_until).split(" ")[0]}` : "Luôn áp dụng"}</td>
                            <td>{record.status === "active" ? <Badge tone="green">Đang áp dụng</Badge> : record.status === "archived" ? <Badge>Tắt</Badge> : <StatusBadge value={record.status} />}</td>
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
          record={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onDone={async (message) => {
            setEditing(null);
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
            toast("Đã đổi tên");
          }}
        />
      )}
    </div>
  );
}

function RecordSheet({ collection, record, onClose, onDone }: { collection: Collection; record: RecordRow | null; onClose: () => void; onDone: (message: string) => void }) {
  const fields = fieldsOf(collection);
  const [data, setData] = useState<Record<string, unknown>>(() => (record ? (JSON.parse(record.data_json || "{}") as Record<string, unknown>) : {}));
  const [active, setActive] = useState(record ? record.status === "active" : true);
  const [from, setFrom] = useState(day(record?.valid_from));
  const [until, setUntil] = useState(day(record?.valid_until));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key: string, value: unknown) => setData((current) => ({ ...current, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const body = { data, status: active ? "active" : "archived", validFrom: from || null, validUntil: until || null };
    try {
      if (record) await patch(`/api/admin/collections/${collection.id}/records/${record.id}`, body);
      else {
        const key = upsertKey(fields);
        await post(`/api/admin/collections/${collection.id}/records`, { ...body, externalKey: key && data[key] ? String(data[key]) : undefined });
      }
      onDone(record ? "Đã lưu — trợ lý dùng ngay" : "Đã thêm — trợ lý dùng ngay");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      title={record ? "Sửa" : `Thêm vào ${collection.name}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>Huỷ</Button>
          <Button form="record-form" busy={busy}>{record ? "Lưu" : "Thêm"}</Button>
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
                    disabled={Boolean(record) && field.key === upsertKey(fields)}
                    {...common}
                  />
                )}
              </FieldRow>
            );
          })}
        </Section>
        <Section title="Áp dụng" footer="Để trống ngày là luôn áp dụng. Hết hạn hoặc tắt thì trợ lý không nhắc tới nữa.">
          <FieldRow label="Đang áp dụng">
            <Toggle label="Đang áp dụng" checked={active} onChange={setActive} />
          </FieldRow>
          <FieldRow label="Từ ngày">
            <TextInput type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </FieldRow>
          <FieldRow label="Đến ngày">
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
      title="Đổi tên"
      onClose={onClose}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>Huỷ</Button>
          <Button form="rename-form" busy={busy}>Lưu</Button>
        </>
      }
    >
      <form id="rename-form" className="sheet-form" onSubmit={submit}>
        <Section>
          <FieldRow label="Tên bộ dữ liệu">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} required />
          </FieldRow>
        </Section>
        <Section title="Tên cột" footer="Chỉ đổi tên hiển thị; dữ liệu và cột CSV giữ nguyên.">
          {fields.map((field) => (
            <FieldRow key={field.key} label={field.key} hint={undefined}>
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
  ["text", "Văn bản"],
  ["long_text", "Văn bản dài"],
  ["number", "Số"],
  ["boolean", "Có/Không"],
  ["date", "Ngày"],
  ["datetime", "Ngày giờ"],
  ["enum", "Lựa chọn"],
  ["multi_enum", "Nhiều lựa chọn"],
  ["url", "URL"],
  ["image_url", "Ảnh (URL)"],
  ["relation", "Liên kết"],
];

// Vietnamese label -> ascii identifier that starts with a letter (schema keys and slugs require it).
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
    { key: "name", label: "Tên", type: "text", required: true },
    { key: "price", label: "Giá", type: "number", required: false },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const slug = identifier(name);
  const keyOf = identifier;
  const update = (index: number, value: Partial<FieldDef>) => setFields((current) => current.map((field, i) => (i === index ? { ...field, ...value } : field)));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await post<{ id: string }>("/api/admin/collections", { name, slug, description: "", schema: { fields } });
      onDone(result.id);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet
      title="Bộ dữ liệu mới"
      onClose={onClose}
      footer={
        <>
          <Button variant="gray" onClick={onClose}>Huỷ</Button>
          <Button form="create-collection" busy={busy} disabled={!name || !fields.length}>Tạo</Button>
        </>
      }
    >
      <form id="create-collection" className="sheet-form" onSubmit={submit}>
        <Section>
          <FieldRow label="Tên">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder="Ưu đãi" required />
          </FieldRow>
        </Section>
        <Section
          title="Trường"
          action={
            <Button type="button" variant="plain" size="small" icon="plus" onClick={() => setFields((current) => [...current, { key: `field_${current.length + 1}`, label: `Trường ${current.length + 1}`, type: "text", required: false }])}>
              Thêm trường
            </Button>
          }
          footer="Tên cột CSV cần khớp với khoá của trường."
        >
          {fields.map((field, index) => (
            <div className="row field-editor" key={index}>
              <TextInput aria-label="Tên trường" value={field.label} placeholder="Tên trường" onChange={(event) => update(index, { label: event.target.value, key: keyOf(event.target.value) })} />
              <select className="select" aria-label="Kiểu" value={field.type} onChange={(event) => update(index, { type: event.target.value })}>
                {fieldTypes.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <Toggle label="Bắt buộc" checked={Boolean(field.required)} onChange={(required) => update(index, { required })} />
              <button type="button" className="icon-button" aria-label="Xoá trường" disabled={fields.length === 1} onClick={() => setFields((current) => current.filter((_, i) => i !== index))}>
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
