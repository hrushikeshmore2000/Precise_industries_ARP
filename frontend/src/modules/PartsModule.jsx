import React, { useCallback, useEffect, useState } from "react";
import { Plus, Search, RefreshCw, Filter } from "lucide-react";
import { toast } from "sonner";
import DrawerForm from "./DrawerForm";
import { Pagination } from "./CustomersModule";
import { useAuth } from "../auth/AuthProvider";
import { PartsApi, fetchCustomerOptions } from "../data/db";

const UNITS = [
  { value: "nos", label: "Numbers (nos)" },
  { value: "kg", label: "Kilogram (kg)" },
  { value: "m", label: "Meter (m)" },
  { value: "sqm", label: "Square meter (sqm)" },
  { value: "ltr", label: "Liter (ltr)" },
];

const PAGE_SIZE = 10;

export default function PartsModule() {
  const { activeOrgId } = useAuth();
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [customerOptions, setCustomerOptions] = useState([]);

  const loadCustomerOptions = useCallback(async () => {
    if (!activeOrgId) return;
    try { setCustomerOptions(await fetchCustomerOptions(activeOrgId)); }
    catch (e) { /* ignore */ }
  }, [activeOrgId]);

  const load = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    try {
      const res = await PartsApi.list(activeOrgId, { search, page, pageSize: PAGE_SIZE });
      let items = res.rows;
      if (active) items = items.filter(r => (active === "yes") === !!r.active);
      setRows(items); setCount(res.count);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [activeOrgId, search, active, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCustomerOptions(); }, [loadCustomerOptions]);

  const FIELDS = [
    { key: "part_number", label: "Part number", required: true },
    { key: "part_name", label: "Part name", required: true },
    { key: "customer_part_number", label: "Customer part number" },
    { key: "customer_id", label: "Customer", options: customerOptions.map(c => ({ value: c.id, label: c.name })) },
    { key: "material", label: "Material", placeholder: "Steel, aluminium..." },
    { key: "material_grade", label: "Material grade", placeholder: "EN8, SS304..." },
    { key: "raw_material_size", label: "Raw material size" },
    { key: "unit", label: "Unit", options: UNITS },
    { key: "weight_kg", label: "Weight (kg)", type: "decimal", step: "0.0001" },
    { key: "standard_cost", label: "Standard cost (₹)", type: "decimal", step: "0.01" },
    { key: "selling_price", label: "Selling price (₹)", type: "decimal", step: "0.01" },
    { key: "notes", label: "Notes", textarea: true, span: 2 },
  ];

  async function save(payload) {
    if (payload.id) { await PartsApi.update(payload.id, stripMeta(payload)); toast.success("Part updated"); }
    else { await PartsApi.create(activeOrgId, stripMeta(payload)); toast.success("Part created"); }
    setEditing(null); load();
  }
  async function remove(rec) { await PartsApi.remove(rec.id); toast.success("Part deleted"); setEditing(null); load(); }

  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="module-view">
      <div className="page-title">
        <div>
          <div className="eyebrow">Precise Industries / Part Master</div>
          <h1 data-testid="module-title">Part Master</h1>
          <p>Every part, drawing revision and costing at your fingertips.</p>
        </div>
        <button className="primary-btn" data-testid="create-part-button" onClick={() => setEditing({ unit: "nos", active: true })}><Plus size={16}/> New part</button>
      </div>
      <div className="module-toolbar">
        <div className="search-field small">
          <Search size={16}/>
          <input data-testid="parts-search" placeholder="Search by part number, name, material..." value={search} onChange={e => { setPage(1); setSearch(e.target.value); }}/>
        </div>
        <div className="search-field small filter-select">
          <Filter size={14}/>
          <select data-testid="parts-active-filter" value={active} onChange={e => { setPage(1); setActive(e.target.value); }}>
            <option value="">All parts</option>
            <option value="yes">Active only</option>
            <option value="no">Inactive only</option>
          </select>
        </div>
        <button className="filter-btn" data-testid="parts-refresh" onClick={load}><RefreshCw size={13}/> Refresh</button>
        <span className="toolbar-count" data-testid="parts-count">{count} part{count === 1 ? "" : "s"}</span>
      </div>
      <section className="panel table-panel">
        <div className="table-scroll">
          <table data-testid="parts-table">
            <thead><tr><th>Part number</th><th>Name</th><th>Customer</th><th>Material</th><th>Weight</th><th>Selling price</th><th></th></tr></thead>
            <tbody>
              {loading && rows.length === 0 && <tr><td colSpan={7} className="loading-cell">Loading parts…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={7} className="empty-cell">
                  <b>No parts yet</b>
                  <small>Add your first part number and start receiving customer POs against it.</small>
                </td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={r.id} data-testid={`part-row-${i}`}>
                  <td><b>{r.part_number}</b><small>{r.customer_part_number || "—"}</small></td>
                  <td>{r.part_name}</td>
                  <td>{r.customer?.name || "—"}</td>
                  <td>{r.material || "—"}<small>{r.material_grade || ""}</small></td>
                  <td>{r.weight_kg ? `${r.weight_kg} kg` : "—"}</td>
                  <td>{r.selling_price ? `₹${Number(r.selling_price).toLocaleString("en-IN")}` : "—"}</td>
                  <td><button className="outline-btn" data-testid={`part-edit-${i}`} onClick={() => setEditing(r)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} onPrev={() => setPage(p => Math.max(1, p - 1))} onNext={() => setPage(p => Math.min(pages, p + 1))} count={count} pageSize={PAGE_SIZE}/>
      </section>

      {editing && (
        <DrawerForm
          title={editing?.id ? `Edit ${editing.part_number}` : "New part"}
          record={editing}
          fields={FIELDS}
          onSave={save}
          onDelete={remove}
          onClose={() => setEditing(null)}
          testidPrefix="part"
        />
      )}
    </div>
  );
}

function stripMeta(obj) {
  const { id, organization_id, created_at, updated_at, created_by, updated_by, customer, ...rest } = obj;
  return rest;
}
