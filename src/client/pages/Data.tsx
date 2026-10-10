import Papa from "papaparse";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, post } from "../api";
import type { Collection } from "../types";
import { Badge, Banner, Button, EmptyState, FieldRow, Icon, PageHeader, Row, Section, Sheet, Spinner, StatusBadge, TextInput, Toggle, errorMessage, formatDate, useToast } from "../ui";

type RecordRow = { id: string; data_json: string; status: string; valid_from?: string | null; valid_until?: string | null; external_key?: string | null };
type FieldDef = { key: string; label: string; type: string; required?: boolean };

const fieldsOf = (collection: Collection): FieldDef[] => {
  try {
    return (JSON.parse(collection.schema_json) as { fields?: FieldDef[] }).fields ?? [];
  } catch {
    return [];
  }
};

export function DataPage({ collections, reload }: { collections: Collection[]; reload: () => Promise<void> }) {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState(collections[0]?.id ?? "");
  const [records, setRecords] = useState<RecordRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const selected = collections.find((collection) => collection.id === selectedId) ?? collections[0];
  async function loadRecords(collection = selected) {
    if (!collection) return;
    setRecords(null);
    setRecords(await api<RecordRow[]>(`/api/admin/collections/${collection.id}/records`));
  }
  useEffect(() => {
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
      await post(`/api/admin/collections/${selected.id}/import`, { rows: parsed.data, mapping: {}, uniqueKey: undefined });
      toast(`Đã nhập ${parsed.data.length} dòng`);
      await loadRecords();
    } catch (caught) {
      setError(`Không nhập được — không có dòng nào bị thay đổi. ${errorMessage(caught)}`);
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const fields = selected ? fieldsOf(selected).slice(0, 4) : [];
  const visible = (records ?? []).filter((record) => !query || record.data_json.toLowerCase().includes(query.toLowerCase()));
  const activeCount = (records ?? []).filter((record) => record.status === "active").length;
  return (
    <div className="page">
      <PageHeader
        title="Dữ liệu"
        subtitle="Giá, ưu đãi, tồn kho và các thông tin thay đổi thường xuyên. Trợ lý chỉ thấy bản ghi đang hiệu lực."
        actions={
          <Button variant="gray" icon="plus" onClick={() => setCreating(true)}>
            Bộ dữ liệu
          </Button>
        }
      />
      {error && <Banner onClose={() => setError("")}>{error}</Banner>}
      {collections.length === 0 ? (
        <EmptyState icon="data" title="Chưa có bộ dữ liệu" text="Tạo bộ dữ liệu như Sản phẩm hoặc Ưu đãi rồi nhập từ CSV." action={<Button onClick={() => setCreating(true)}>Tạo bộ dữ liệu</Button>} />
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
                  <p className="text-secondary">{records ? `${activeCount} đang hiệu lực · ${records.length} tổng` : "Đang tải…"}</p>
                </div>
                <div className="inline-actions">
                  <label className="search-field compact">
                    <Icon name="search" size={15} />
                    <input type="search" placeholder="Tìm" aria-label="Tìm bản ghi" value={query} onChange={(event) => setQuery(event.target.value)} />
                  </label>
                  <Button variant="tinted" icon="download" busy={importing} onClick={() => fileInput.current?.click()}>
                    Nhập CSV
                  </Button>
                  <input ref={fileInput} hidden type="file" accept=".csv,text/csv" onChange={(event) => event.target.files?.[0] && void importCsv(event.target.files[0])} />
                </div>
              </div>
              {!records ? (
                <div className="page-loading"><Spinner /></div>
              ) : visible.length === 0 ? (
                <EmptyState icon="data" title={query ? "Không tìm thấy" : "Chưa có bản ghi"} text={query ? "Thử từ khoá khác." : "Nhập CSV — dòng trùng khoá sẽ được cập nhật, lỗi thì không dòng nào bị đổi."} />
              ) : (
                <div className="table-card">
                  <table>
                    <thead>
                      <tr>
                        {fields.map((field) => (
                          <th key={field.key}>{field.label}</th>
                        ))}
                        <th>Hiệu lực</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((record) => {
                        const data = JSON.parse(record.data_json || "{}") as Record<string, unknown>;
                        return (
                          <tr key={record.id}>
                            {fields.map((field) => (
                              <td key={field.key}>{String(data[field.key] ?? "—")}</td>
                            ))}
                            <td className="nowrap">{record.valid_from || record.valid_until ? `${formatDate(record.valid_from).split(" ")[0]} – ${formatDate(record.valid_until).split(" ")[0]}` : "Luôn"}</td>
                            <td>
                              {record.status === "active" ? <Badge tone="green">Hiệu lực</Badge> : <StatusBadge value={record.status} />}
                            </td>
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
    </div>
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
