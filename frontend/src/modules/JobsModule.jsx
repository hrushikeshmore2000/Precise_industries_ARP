import React, { useCallback, useEffect, useState } from "react";
import { Search, RefreshCw, Filter, ArrowLeft, Plus, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import DrawerForm from "./DrawerForm";
import { Pagination } from "./CustomersModule";
import { useAuth } from "../auth/AuthProvider";
import { JobsApi, fetchWorkCenterOptions, fetchMachineOptions } from "../data/db";
import { useRealtime } from "../hooks/useRealtime";

const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "released", label: "Released" },
  { value: "in_progress", label: "In progress" },
  { value: "on_hold", label: "On hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];
const OP_STATUSES = ["pending", "ready", "running", "paused", "completed", "blocked"];
const PAGE_SIZE = 10;

export default function JobsModule() {
  const { activeOrgId } = useAuth();
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const load = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    try {
      const res = await JobsApi.list(activeOrgId, { search, status: status || undefined, page, pageSize: PAGE_SIZE });
      setRows(res.rows); setCount(res.count);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [activeOrgId, search, status, page]);
  useEffect(() => { load(); }, [load]);

  useRealtime("jobs", activeOrgId, () => load(), [load]);

  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  if (detailId) return <JobDetail id={detailId} onBack={() => { setDetailId(null); load(); }}/>;

  return (
    <div className="module-view">
      <div className="page-title">
        <div>
          <div className="eyebrow">Precise Industries / Jobs</div>
          <h1 data-testid="module-title">Jobs & Work Orders</h1>
          <p>Every manufacturing job — auto-generated from confirmed POs.</p>
        </div>
      </div>
      <div className="module-toolbar">
        <div className="search-field small"><Search size={16}/><input data-testid="jobs-search" placeholder="Search by job number..." value={search} onChange={e => { setPage(1); setSearch(e.target.value); }}/></div>
        <div className="search-field small filter-select">
          <Filter size={14}/>
          <select data-testid="jobs-status-filter" value={status} onChange={e => { setPage(1); setStatus(e.target.value); }}>
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <button className="filter-btn" data-testid="jobs-refresh" onClick={load}><RefreshCw size={13}/> Refresh</button>
        <span className="toolbar-count" data-testid="jobs-count">{count} job{count === 1 ? "" : "s"}</span>
      </div>
      <section className="panel table-panel">
        <div className="table-scroll">
          <table data-testid="jobs-table">
            <thead><tr><th>Job</th><th>Customer</th><th>Part</th><th>Progress</th><th>Due</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading && rows.length === 0 && <tr><td colSpan={7} className="loading-cell">Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={7} className="empty-cell"><b>No jobs yet</b><small>Generate a job from a confirmed Customer PO to see it here.</small></td></tr>}
              {rows.map((r, i) => {
                const pct = r.quantity > 0 ? Math.min(100, Math.round((Number(r.completed_quantity) / Number(r.quantity)) * 100)) : 0;
                return (
                  <tr key={r.id} data-testid={`job-row-${i}`} className="clickable" onClick={() => setDetailId(r.id)}>
                    <td><b>{r.job_number}</b><small>{r.po?.po_number || "—"}</small></td>
                    <td>{r.customer?.name || "—"}</td>
                    <td>{r.part?.part_number}<small>{r.part?.part_name}</small></td>
                    <td><div className="progress-cell"><span>{r.completed_quantity} / {r.quantity}</span><div className="progress"><i style={{ width: `${pct}%` }}/></div></div></td>
                    <td>{r.due_date || "—"}</td>
                    <td><span className={`badge ${r.status}`}>{STATUSES.find(s => s.value === r.status)?.label || r.status}</span></td>
                    <td><button className="outline-btn" data-testid={`job-open-${i}`} onClick={e => { e.stopPropagation(); setDetailId(r.id); }}>Open</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} onPrev={() => setPage(p => Math.max(1, p - 1))} onNext={() => setPage(p => Math.min(pages, p + 1))} count={count} pageSize={PAGE_SIZE}/>
      </section>
    </div>
  );
}

function JobDetail({ id, onBack }) {
  const { activeOrgId } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addingOp, setAddingOp] = useState(false);
  const [assignOp, setAssignOp] = useState(null);
  const [events, setEvents] = useState([]);
  const [wcOptions, setWcOptions] = useState([]);
  const [machineOptions, setMachineOptions] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await JobsApi.get(id); setJob(j);
      const evts = await JobsApi.events(id); setEvents(evts);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => { (async () => {
    if (!activeOrgId) return;
    try {
      setWcOptions(await fetchWorkCenterOptions(activeOrgId));
      setMachineOptions(await fetchMachineOptions(activeOrgId));
    } catch (e) {}
  })(); }, [activeOrgId]);

  useRealtime("job_operations", activeOrgId, (p) => { if (p.new?.job_id === id || p.old?.job_id === id) load(); }, [id, load]);
  useRealtime("jobs", activeOrgId, (p) => { if (p.new?.id === id || p.old?.id === id) load(); }, [id, load]);

  const OP_FIELDS = [
    { key: "operation_name", label: "Operation name", required: true, placeholder: "Turning" },
    { key: "sequence", label: "Sequence #", type: "number", required: true },
    { key: "work_center_id", label: "Work center", options: wcOptions.map(w => ({ value: w.id, label: `${w.code} · ${w.name}` })) },
    { key: "machine_id", label: "Machine", options: machineOptions.map(m => ({ value: m.id, label: `${m.code} · ${m.name}` })) },
    { key: "planned_quantity", label: "Planned qty", type: "decimal", step: "0.0001" },
    { key: "cycle_time_sec", label: "Cycle time (sec)", type: "number" },
    { key: "planned_start", label: "Planned start", type: "datetime-local" },
    { key: "planned_end", label: "Planned end", type: "datetime-local" },
    { key: "notes", label: "Notes", textarea: true, span: 2 },
  ];

  const ASSIGN_FIELDS = [
    { key: "machine_id", label: "Machine", options: machineOptions.map(m => ({ value: m.id, label: `${m.code} · ${m.name}` })), span: 2 },
    { key: "work_center_id", label: "Work center", options: wcOptions.map(w => ({ value: w.id, label: `${w.code} · ${w.name}` })), span: 2 },
    { key: "cycle_time_sec", label: "Cycle time (sec)", type: "number" },
    { key: "planned_quantity", label: "Planned qty", type: "decimal", step: "0.0001" },
    { key: "planned_start", label: "Planned start", type: "datetime-local" },
    { key: "planned_end", label: "Planned end", type: "datetime-local" },
  ];

  async function saveOp(payload) {
    const clean = stripMeta(payload);
    // strip empty datetime fields
    ["planned_start", "planned_end", "actual_start", "actual_end"].forEach(k => { if (clean[k] === "") clean[k] = null; });
    if (payload.id) await JobsApi.updateOperation(payload.id, clean);
    else await JobsApi.addOperation(activeOrgId, id, { ...clean, status: "pending" });
    toast.success("Operation saved");
    setAddingOp(false); setAssignOp(null); load();
  }

  if (loading || !job) return <div className="module-view"><p>Loading job…</p></div>;
  const pct = job.quantity > 0 ? Math.min(100, Math.round((Number(job.completed_quantity) / Number(job.quantity)) * 100)) : 0;

  return (
    <div className="module-view">
      <div className="page-title">
        <div>
          <button className="outline-btn" data-testid="job-back" onClick={onBack}><ArrowLeft size={14}/> Back</button>
          <div className="eyebrow" style={{ marginTop: 12 }}>Precise Industries / Jobs / {job.job_number}</div>
          <h1 data-testid="job-detail-title">{job.job_number}</h1>
          <p>{job.customer?.name || "No customer"} · Part {job.part?.part_number} · {job.completed_quantity} of {job.quantity} completed</p>
        </div>
        <button className="primary-btn" data-testid="add-operation-button" onClick={() => setAddingOp(true)}><Plus size={16}/> Add operation</button>
      </div>

      <div className="job-summary-grid">
        <div className="mini-kpi"><small>Status</small><b><span className={`badge ${job.status}`}>{STATUSES.find(s => s.value === job.status)?.label || job.status}</span></b></div>
        <div className="mini-kpi"><small>Ordered</small><b>{job.quantity}</b></div>
        <div className="mini-kpi"><small>Completed</small><b className="positive">{job.completed_quantity}</b></div>
        <div className="mini-kpi"><small>Rejected</small><b className="negative">{job.rejected_quantity}</b></div>
        <div className="mini-kpi"><small>Rework</small><b>{job.rework_quantity}</b></div>
        <div className="mini-kpi"><small>Progress</small><b>{pct}%</b><div className="progress"><i style={{ width: `${pct}%` }}/></div></div>
      </div>

      <section className="panel table-panel">
        <div className="panel-head"><h2>Routing operations</h2><span className="muted">In sequence order</span></div>
        <div className="table-scroll">
          <table data-testid="job-operations-table">
            <thead><tr><th>#</th><th>Operation</th><th>Machine</th><th>Planned</th><th>Completed</th><th>Rejected</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {(job.operations || []).length === 0 && <tr><td colSpan={8} className="empty-cell"><b>No operations</b><small>Add operations to route this job through work centers.</small></td></tr>}
              {(job.operations || []).sort((a, b) => a.sequence - b.sequence).map((op, i) => (
                <tr key={op.id} data-testid={`job-op-row-${i}`}>
                  <td>{op.sequence}</td>
                  <td><b>{op.operation_name}</b><small>{op.operation_number}</small></td>
                  <td>{op.machine?.code || "—"}<small>{op.machine?.name || ""}</small></td>
                  <td>{op.planned_quantity}</td>
                  <td>{op.completed_quantity}</td>
                  <td>{op.rejected_quantity}</td>
                  <td><span className={`badge ${op.status}`}>{op.status}</span></td>
                  <td><button className="outline-btn" data-testid={`assign-op-${i}`} onClick={() => setAssignOp(op)}>Configure</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Event history</h2><span className="muted">Chronological audit trail</span></div>
        <div className="event-log" data-testid="job-events">
          {events.length === 0 && <p className="empty-cell">No events yet.</p>}
          {events.map(e => (
            <div className="event-row" key={e.id}>
              <span className={`event-dot ${e.event_type}`}/>
              <div>
                <b>{e.event_type.replaceAll("_", " ")}</b>
                <small>{new Date(e.created_at).toLocaleString()}{e.reason ? ` · ${e.reason}` : ""}{e.quantity_delta ? ` · +${e.quantity_delta}` : ""}{e.rejected_delta ? ` · rejected ${e.rejected_delta}` : ""}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      {addingOp && <DrawerForm title="Add operation" record={{ sequence: (job.operations?.length || 0) + 1, planned_quantity: job.quantity }} fields={OP_FIELDS} onSave={saveOp} onClose={() => setAddingOp(false)} testidPrefix="op"/>}
      {assignOp && <DrawerForm title={`Configure ${assignOp.operation_name}`} record={assignOp} fields={ASSIGN_FIELDS} onSave={saveOp} onClose={() => setAssignOp(null)} testidPrefix="assign-op"/>}
    </div>
  );
}

function stripMeta(o) {
  const { id, organization_id, created_at, updated_at, created_by, updated_by,
          machine, work_center, operator, ...rest } = o; return rest;
}
