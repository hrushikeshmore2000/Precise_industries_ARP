import React, { useCallback, useEffect, useState } from "react";
import { Plus, Search, RefreshCw, Filter } from "lucide-react";
import { toast } from "sonner";
import DrawerForm from "./DrawerForm";
import { Pagination } from "./CustomersModule";
import { useAuth } from "../auth/AuthProvider";
import { LeadsApi } from "../data/db";

const STATUSES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "rfq_received", label: "RFQ received" },
  { value: "quotation_sent", label: "Quotation sent" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const FIELDS = [
  { key: "company_name", label: "Company name", required: true, span: 2 },
  { key: "code", label: "Lead code", placeholder: "e.g. Lead-0084" },
  { key: "source", label: "Source", placeholder: "Referral, IndiaMart..." },
  { key: "contact_name", label: "Contact name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email", type: "email" },
  { key: "status", label: "Status", options: STATUSES, required: true },
  { key: "estimated_value", label: "Estimated value (₹)", type: "decimal", step: "0.01" },
  { key: "expected_close_date", label: "Expected close date", type: "date" },
  { key: "notes", label: "Notes", textarea: true, span: 2 },
];

const PAGE_SIZE = 10;

export default function LeadsModule() {
  const { activeOrgId } = useAuth();
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    try {
      const res = await LeadsApi.list(activeOrgId, { search, status: status || undefined, page, pageSize: PAGE_SIZE });
      setRows(res.rows); setCount(res.count);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [activeOrgId, search, status, page]);

  useEffect(() => { load(); }, [load]);

  async function save(payload) {
    if (payload.id) { await LeadsApi.update(payload.id, stripMeta(payload)); toast.success("Lead updated"); }
    else { await LeadsApi.create(activeOrgId, stripMeta(payload)); toast.success("Lead created"); }
    setEditing(null); load();
  }
  async function remove(rec) { await LeadsApi.remove(rec.id); toast.success("Lead deleted"); setEditing(null); load(); }

  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="module-view">
      <div className="page-title">
        <div>
          <div className="eyebrow">Precise Industries / CRM / Leads</div>
          <h1 data-testid="module-title">Leads</h1>
          <p>Track every enquiry from first touch to won-or-lost.</p>
        </div>
        <button className="primary-btn" data-testid="create-lead-button" onClick={() => setEditing({ status: "new" })}><Plus size={16}/> New lead</button>
      </div>
      <div className="module-toolbar">
        <div className="search-field small">
          <Search size={16}/>
          <input data-testid="leads-search" placeholder="Search by company, contact, email..." value={search} onChange={e => { setPage(1); setSearch(e.target.value); }}/>
        </div>
        <div className="search-field small filter-select">
          <Filter size={14}/>
          <select data-testid="leads-status-filter" value={status} onChange={e => { setPage(1); setStatus(e.target.value); }}>
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <button className="filter-btn" data-testid="leads-refresh" onClick={load}><RefreshCw size={13}/> Refresh</button>
        <span className="toolbar-count" data-testid="leads-count">{count} lead{count === 1 ? "" : "s"}</span>
      </div>
      <section className="panel table-panel">
        <div className="table-scroll">
          <table data-testid="leads-table">
            <thead><tr><th>Company / contact</th><th>Code</th><th>Source</th><th>Value</th><th>Close date</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading && rows.length === 0 && <tr><td colSpan={7} className="loading-cell">Loading leads…</td></tr>}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={7} className="empty-cell">
                  <b>No leads captured</b>
                  <small>Add your first lead to build the sales pipeline.</small>
                </td></tr>
              )}
              {rows.map((r, i) => (
                <tr key={r.id} data-testid={`lead-row-${i}`}>
                  <td><b>{r.company_name}</b><small>{r.contact_name || r.email || "—"}</small></td>
                  <td>{r.code || "—"}</td>
                  <td>{r.source || "—"}</td>
                  <td>{r.estimated_value ? `₹${Number(r.estimated_value).toLocaleString("en-IN")}` : "—"}</td>
                  <td>{r.expected_close_date || "—"}</td>
                  <td><span className={`badge ${r.status}`}>{STATUSES.find(s => s.value === r.status)?.label || r.status}</span></td>
                  <td><button className="outline-btn" data-testid={`lead-edit-${i}`} onClick={() => setEditing(r)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} onPrev={() => setPage(p => Math.max(1, p - 1))} onNext={() => setPage(p => Math.min(pages, p + 1))} count={count} pageSize={PAGE_SIZE}/>
      </section>

      {editing && (
        <DrawerForm
          title={editing?.id ? `Edit ${editing.company_name}` : "New lead"}
          record={editing}
          fields={FIELDS}
          onSave={save}
          onDelete={remove}
          onClose={() => setEditing(null)}
          testidPrefix="lead"
        />
      )}
    </div>
  );
}

function stripMeta(obj) {
  const { id, organization_id, created_at, updated_at, created_by, updated_by, ...rest } = obj;
  return rest;
}
