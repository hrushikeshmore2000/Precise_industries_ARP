import React, { useCallback, useEffect, useState } from "react";
import { Plus, Search, RefreshCw, Filter } from "lucide-react";
import { toast } from "sonner";
import DrawerForm from "./DrawerForm";
import { Pagination } from "./CustomersModule";
import { useAuth } from "../auth/AuthProvider";
import { MachinesApi, fetchWorkCenterOptions } from "../data/db";
import { useRealtime } from "../hooks/useRealtime";

const STATUSES = [
  { value: "idle", label: "Idle" },
  { value: "running", label: "Running" },
  { value: "down", label: "Down" },
  { value: "maintenance", label: "Maintenance" },
];
const TYPES = ["CNC", "VMC", "Lathe", "Grinding", "Laser", "Press", "EDM", "Wire Cut", "Injection Moulding"].map(t => ({ value: t, label: t }));
const PAGE_SIZE = 10;

export default function MachinesModule() {
  const { activeOrgId } = useAuth();
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [wcOptions, setWcOptions] = useState([]);

  const load = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    try {
      const res = await MachinesApi.list(activeOrgId, { search, status: status || undefined, page, pageSize: PAGE_SIZE });
      setRows(res.rows); setCount(res.count);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [activeOrgId, search, status, page]);
  useEffect(() => { load(); }, [load]);

  const loadWc = useCallback(async () => {
    if (!activeOrgId) return;
    try { setWcOptions(await fetchWorkCenterOptions(activeOrgId)); } catch (e) { toast.error(e.message); }
  }, [activeOrgId]);
  useEffect(() => { loadWc(); }, [loadWc]);

  useRealtime("machines", activeOrgId, () => load(), [load]);

  const FIELDS = [
    { key: "code", label: "Code", required: true, placeholder: "VMC-02" },
    { key: "name", label: "Name", required: true, placeholder: "Makino PS95" },
    { key: "machine_type", label: "Type", options: TYPES },
    { key: "work_center_id", label: "Work center", options: wcOptions.map(w => ({ value: w.id, label: `${w.code} · ${w.name}` })) },
    { key: "manufacturer", label: "Manufacturer" },
    { key: "model", label: "Model" },
    { key: "hourly_rate", label: "Hourly rate (₹)", type: "decimal", step: "0.01" },
    { key: "status", label: "Status", options: STATUSES, required: true },
    { key: "notes", label: "Notes", textarea: true, span: 2 },
  ];

  async function save(p) {
    if (p.id) { await MachinesApi.update(p.id, stripMeta(p)); toast.success("Machine updated"); }
    else { await MachinesApi.create(activeOrgId, stripMeta(p)); toast.success("Machine created"); }
    setEditing(null); load();
  }
  async function remove(rec) { await MachinesApi.remove(rec.id); toast.success("Machine deleted"); setEditing(null); load(); }
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="module-view">
      <div className="page-title">
        <div>
          <div className="eyebrow">Precise Industries / Machines</div>
          <h1 data-testid="module-title">Machines</h1>
          <p>Every asset on your shop floor — status updates live from operations.</p>
        </div>
        <button className="primary-btn" data-testid="create-machine-button" onClick={async () => { await loadWc(); setEditing({ status: "idle", active: true }); }}><Plus size={16}/> New machine</button>
      </div>
      <div className="module-toolbar">
        <div className="search-field small"><Search size={16}/><input data-testid="machines-search" placeholder="Search by code, name, model..." value={search} onChange={e => { setPage(1); setSearch(e.target.value); }}/></div>
        <div className="search-field small filter-select">
          <Filter size={14}/>
          <select data-testid="machines-status-filter" value={status} onChange={e => { setPage(1); setStatus(e.target.value); }}>
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <button className="filter-btn" data-testid="machines-refresh" onClick={load}><RefreshCw size={13}/> Refresh</button>
        <span className="toolbar-count" data-testid="machines-count">{count} machine{count === 1 ? "" : "s"}</span>
      </div>
      <section className="panel table-panel">
        <div className="table-scroll">
          <table data-testid="machines-table">
            <thead><tr><th>Code</th><th>Name / model</th><th>Type</th><th>Work center</th><th>Rate</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading && rows.length === 0 && <tr><td colSpan={7} className="loading-cell">Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7} className="empty-cell"><b>No machines</b><small>Add your first machine to run production operations on.</small></td></tr>}
              {rows.map((r, i) => (
                <tr key={r.id} data-testid={`machine-row-${i}`}>
                  <td><b>{r.code}</b></td>
                  <td>{r.name}<small>{r.model || r.manufacturer || "—"}</small></td>
                  <td>{r.machine_type || "—"}</td>
                  <td>{r.work_center?.code || "—"}</td>
                  <td>{r.hourly_rate ? `₹${Number(r.hourly_rate).toLocaleString("en-IN")}/hr` : "—"}</td>
                  <td><span className={`badge ${r.status}`}>{r.status}</span></td>
                  <td><button className="outline-btn" data-testid={`machine-edit-${i}`} onClick={async () => { await loadWc(); setEditing(r); }}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} onPrev={() => setPage(p => Math.max(1, p - 1))} onNext={() => setPage(p => Math.min(pages, p + 1))} count={count} pageSize={PAGE_SIZE}/>
      </section>
      {editing && <DrawerForm title={editing.id ? `Edit ${editing.name}` : "New machine"} record={editing} fields={FIELDS} onSave={save} onDelete={remove} onClose={() => setEditing(null)} testidPrefix="machine"/>}
    </div>
  );
}
function stripMeta(o) { const { id, organization_id, created_at, updated_at, created_by, updated_by, work_center, ...rest } = o; return rest; }
