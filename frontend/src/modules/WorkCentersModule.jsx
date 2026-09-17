import React, { useCallback, useEffect, useState } from "react";
import { Plus, Search, RefreshCw, Filter } from "lucide-react";
import { toast } from "sonner";
import DrawerForm from "./DrawerForm";
import { Pagination } from "./CustomersModule";
import { useAuth } from "../auth/AuthProvider";
import { WorkCentersApi } from "../data/db";

const FIELDS = [
  { key: "code", label: "Code", required: true, placeholder: "WC-CNC" },
  { key: "name", label: "Name", required: true, placeholder: "CNC Cell" },
  { key: "description", label: "Description", textarea: true, span: 2 },
];
const PAGE_SIZE = 10;

export default function WorkCentersModule() {
  const { activeOrgId } = useAuth();
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    try {
      const res = await WorkCentersApi.list(activeOrgId, { search, page, pageSize: PAGE_SIZE });
      setRows(res.rows); setCount(res.count);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [activeOrgId, search, page]);
  useEffect(() => { load(); }, [load]);

  async function save(p) {
    if (p.id) { await WorkCentersApi.update(p.id, stripMeta(p)); toast.success("Work center updated"); }
    else { await WorkCentersApi.create(activeOrgId, stripMeta(p)); toast.success("Work center created"); }
    setEditing(null); load();
  }
  async function remove(rec) { await WorkCentersApi.remove(rec.id); toast.success("Work center deleted"); setEditing(null); load(); }
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="module-view">
      <div className="page-title">
        <div>
          <div className="eyebrow">Precise Industries / Work Centers</div>
          <h1 data-testid="module-title">Work Centers</h1>
          <p>Group machines into logical cells for scheduling and routing.</p>
        </div>
        <button className="primary-btn" data-testid="create-workcenter-button" onClick={() => setEditing({ active: true })}><Plus size={16}/> New work center</button>
      </div>
      <div className="module-toolbar">
        <div className="search-field small"><Search size={16}/><input data-testid="workcenters-search" placeholder="Search work centers..." value={search} onChange={e => { setPage(1); setSearch(e.target.value); }}/></div>
        <button className="filter-btn" data-testid="workcenters-refresh" onClick={load}><RefreshCw size={13}/> Refresh</button>
        <span className="toolbar-count" data-testid="workcenters-count">{count} work center{count === 1 ? "" : "s"}</span>
      </div>
      <section className="panel table-panel">
        <div className="table-scroll">
          <table data-testid="workcenters-table">
            <thead><tr><th>Code</th><th>Name</th><th>Description</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading && rows.length === 0 && <tr><td colSpan={5} className="loading-cell">Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={5} className="empty-cell"><b>No work centers</b><small>Add your first work center to group machines together.</small></td></tr>}
              {rows.map((r, i) => (
                <tr key={r.id} data-testid={`workcenter-row-${i}`}>
                  <td><b>{r.code}</b></td>
                  <td>{r.name}</td>
                  <td>{r.description || "—"}</td>
                  <td><span className={`badge ${r.active ? "active" : "inactive"}`}>{r.active ? "Active" : "Inactive"}</span></td>
                  <td><button className="outline-btn" data-testid={`workcenter-edit-${i}`} onClick={() => setEditing(r)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} onPrev={() => setPage(p => Math.max(1, p - 1))} onNext={() => setPage(p => Math.min(pages, p + 1))} count={count} pageSize={PAGE_SIZE}/>
      </section>
      {editing && <DrawerForm title={editing.id ? `Edit ${editing.name}` : "New work center"} record={editing} fields={FIELDS} onSave={save} onDelete={remove} onClose={() => setEditing(null)} testidPrefix="workcenter"/>}
    </div>
  );
}
function stripMeta(o) { const { id, organization_id, created_at, updated_at, created_by, updated_by, ...rest } = o; return rest; }
