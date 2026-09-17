import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, RefreshCw, Filter, ArrowLeft, Hammer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import DrawerForm from "./DrawerForm";
import { Pagination } from "./CustomersModule";
import { useAuth } from "../auth/AuthProvider";
import { CustomerPOsApi, fetchCustomerOptions, fetchPartOptions } from "../data/db";

const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in_production", label: "In production" },
  { value: "partially_shipped", label: "Partially shipped" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
];
const PRIORITY = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];
const PAGE_SIZE = 10;

export default function CustomerPOsModule() {
  const { activeOrgId } = useAuth();
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [customerOptions, setCustomerOptions] = useState([]);

  const loadCustomers = useCallback(async () => {
    if (!activeOrgId) return;
    try { setCustomerOptions(await fetchCustomerOptions(activeOrgId)); } catch (e) { toast.error(e.message); }
  }, [activeOrgId]);

  const load = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    try {
      const res = await CustomerPOsApi.list(activeOrgId, { search, status: status || undefined, page, pageSize: PAGE_SIZE });
      setRows(res.rows); setCount(res.count);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [activeOrgId, search, status, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const FIELDS = [
    { key: "customer_id", label: "Customer", required: true, options: customerOptions.map(c => ({ value: c.id, label: c.name })), span: 2 },
    { key: "po_number", label: "Customer PO number", placeholder: "Auto-generated if blank (PO-YYYY-#####)" },
    { key: "status", label: "Status", options: STATUSES, required: true },
    { key: "po_date", label: "PO date", type: "date" },
    { key: "delivery_date", label: "Delivery date", type: "date" },
    { key: "payment_terms", label: "Payment terms", placeholder: "Net 30" },
    { key: "currency", label: "Currency", placeholder: "INR" },
    { key: "notes", label: "Notes", textarea: true, span: 2 },
  ];

  async function save(p) {
    if (p.id) { await CustomerPOsApi.update(p.id, stripMeta(p)); toast.success("PO updated"); }
    else { const created = await CustomerPOsApi.create(activeOrgId, stripMeta(p)); toast.success("PO created"); setEditing(null); load(); setDetailId(created.id); return; }
    setEditing(null); load();
  }
  async function remove(rec) { await CustomerPOsApi.remove(rec.id); toast.success("PO deleted"); setEditing(null); load(); }
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  if (detailId) {
    return <PoDetail id={detailId} onBack={() => { setDetailId(null); load(); }}/>;
  }

  return (
    <div className="module-view">
      <div className="page-title">
        <div>
          <div className="eyebrow">Precise Industries / Customer POs</div>
          <h1 data-testid="module-title">Customer POs & Sales Orders</h1>
          <p>Every confirmed order — the trigger for jobs and production.</p>
        </div>
        <button className="primary-btn" data-testid="create-po-button" onClick={async () => { await loadCustomers(); setEditing({ status: "draft", po_date: new Date().toISOString().slice(0, 10), currency: "INR" }); }}><Plus size={16}/> New Customer PO</button>
      </div>
      <div className="module-toolbar">
        <div className="search-field small"><Search size={16}/><input data-testid="pos-search" placeholder="Search by PO number..." value={search} onChange={e => { setPage(1); setSearch(e.target.value); }}/></div>
        <div className="search-field small filter-select">
          <Filter size={14}/>
          <select data-testid="pos-status-filter" value={status} onChange={e => { setPage(1); setStatus(e.target.value); }}>
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <button className="filter-btn" data-testid="pos-refresh" onClick={load}><RefreshCw size={13}/> Refresh</button>
        <span className="toolbar-count" data-testid="pos-count">{count} PO{count === 1 ? "" : "s"}</span>
      </div>
      <section className="panel table-panel">
        <div className="table-scroll">
          <table data-testid="pos-table">
            <thead><tr><th>PO number</th><th>Customer</th><th>PO date</th><th>Delivery</th><th>Items</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading && rows.length === 0 && <tr><td colSpan={7} className="loading-cell">Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7} className="empty-cell"><b>No customer POs yet</b><small>Create your first PO to start generating jobs.</small></td></tr>}
              {rows.map((r, i) => (
                <tr key={r.id} data-testid={`po-row-${i}`} className="clickable" onClick={() => setDetailId(r.id)}>
                  <td><b>{r.po_number}</b></td>
                  <td>{r.customer?.name || "—"}</td>
                  <td>{r.po_date}</td>
                  <td>{r.delivery_date || "—"}</td>
                  <td>{(r.items || []).length}</td>
                  <td><span className={`badge ${r.status}`}>{STATUSES.find(s => s.value === r.status)?.label || r.status}</span></td>
                  <td><button className="outline-btn" data-testid={`po-open-${i}`} onClick={e => { e.stopPropagation(); setDetailId(r.id); }}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} onPrev={() => setPage(p => Math.max(1, p - 1))} onNext={() => setPage(p => Math.min(pages, p + 1))} count={count} pageSize={PAGE_SIZE}/>
      </section>
      {editing && <DrawerForm title={editing.id ? `Edit ${editing.po_number}` : "New Customer PO"} record={editing} fields={FIELDS} onSave={save} onDelete={remove} onClose={() => setEditing(null)} testidPrefix="po"/>}
    </div>
  );
}

function PoDetail({ id, onBack }) {
  const { activeOrgId } = useAuth();
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addingItem, setAddingItem] = useState(false);
  const [partOptions, setPartOptions] = useState([]);
  const [generating, setGenerating] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setPo(await CustomerPOsApi.get(id)); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { (async () => { try { setPartOptions(await fetchPartOptions(activeOrgId)); } catch (e) {} })(); }, [activeOrgId]);

  async function saveItem(payload) {
    await CustomerPOsApi.addItem(activeOrgId, id, stripMeta(payload));
    toast.success("Line item added");
    setAddingItem(false); load();
  }
  async function removeItem(item) {
    if (!window.confirm("Remove this line item?")) return;
    try { await CustomerPOsApi.removeItem(item.id); toast.success("Item removed"); load(); }
    catch (e) { toast.error(e.message); }
  }
  async function generateJob(item, opts = {}) {
    setGenerating(item.id);
    try {
      const job = await CustomerPOsApi.generateJob(item.id, { priority: opts.priority || "medium", due_date: po.delivery_date || null });
      toast.success(`Job ${job.job_number} generated`);
      load();
    } catch (e) { toast.error(e.message); }
    finally { setGenerating(null); }
  }

  if (loading || !po) return <div className="module-view"><p>Loading…</p></div>;

  const ITEM_FIELDS = [
    { key: "part_id", label: "Part", required: true, options: partOptions.map(p => ({ value: p.id, label: `${p.part_number} · ${p.part_name}` })), span: 2 },
    { key: "part_revision", label: "Revision", placeholder: "Rev A" },
    { key: "quantity", label: "Quantity", required: true, type: "decimal", step: "0.0001" },
    { key: "rate", label: "Rate (₹)", type: "decimal", step: "0.01" },
    { key: "sequence", label: "Line #", type: "number" },
    { key: "notes", label: "Notes", textarea: true, span: 2 },
  ];

  return (
    <div className="module-view">
      <div className="page-title">
        <div>
          <button className="outline-btn" data-testid="po-back" onClick={onBack}><ArrowLeft size={14}/> Back</button>
          <div className="eyebrow" style={{ marginTop: 12 }}>Precise Industries / Customer POs / {po.po_number}</div>
          <h1 data-testid="po-detail-title">{po.po_number}</h1>
          <p>{po.customer?.name} · PO date {po.po_date}{po.delivery_date ? ` · deliver by ${po.delivery_date}` : ""}</p>
        </div>
        <button className="primary-btn" data-testid="add-po-item-button" onClick={() => setAddingItem(true)}><Plus size={16}/> Add line item</button>
      </div>
      <div className="module-toolbar">
        <span className={`badge ${po.status}`}>{STATUSES.find(s => s.value === po.status)?.label || po.status}</span>
        <span className="toolbar-count">{(po.items || []).length} line item{(po.items || []).length === 1 ? "" : "s"}</span>
      </div>
      <section className="panel table-panel">
        <div className="panel-head"><h2>Line items</h2><span className="muted">Each line becomes a job.</span></div>
        <div className="table-scroll">
          <table data-testid="po-items-table">
            <thead><tr><th>#</th><th>Part</th><th>Qty</th><th>Produced</th><th>Rate</th><th>Amount</th><th>Actions</th></tr></thead>
            <tbody>
              {(po.items || []).length === 0 && <tr><td colSpan={7} className="empty-cell"><b>No line items yet</b><small>Add parts to this PO so we can generate manufacturing jobs.</small></td></tr>}
              {(po.items || []).map((it, i) => {
                const pending = Number(it.quantity) - Number(it.produced_quantity || 0);
                return (
                  <tr key={it.id} data-testid={`po-item-row-${i}`}>
                    <td>{it.sequence || i + 1}</td>
                    <td><b>{it.part?.part_number}</b><small>{it.part?.part_name}{it.part_revision ? ` · Rev ${it.part_revision}` : ""}</small></td>
                    <td>{it.quantity}</td>
                    <td>{it.produced_quantity || 0}</td>
                    <td>{it.rate ? `₹${Number(it.rate).toLocaleString("en-IN")}` : "—"}</td>
                    <td>{it.amount ? `₹${Number(it.amount).toLocaleString("en-IN")}` : "—"}</td>
                    <td className="row-actions">
                      <button className="primary-btn small" data-testid={`generate-job-${i}`} disabled={pending <= 0 || generating === it.id} onClick={() => generateJob(it)}>
                        <Hammer size={13}/> {pending <= 0 ? "Fully produced" : (generating === it.id ? "Generating…" : "Generate job")}
                      </button>
                      <button className="icon-btn" data-testid={`remove-po-item-${i}`} onClick={() => removeItem(it)}><Trash2 size={14}/></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      {addingItem && (
        <DrawerForm
          title="Add line item"
          record={{ sequence: (po.items?.length || 0) + 1, quantity: 1, rate: 0 }}
          fields={ITEM_FIELDS}
          onSave={saveItem}
          onClose={() => setAddingItem(false)}
          testidPrefix="po-item"
        />
      )}
    </div>
  );
}

function stripMeta(o) { const { id, organization_id, created_at, updated_at, created_by, updated_by, customer, items, part, schedules, amount, ...rest } = o; return rest; }
