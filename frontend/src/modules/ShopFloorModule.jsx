import React, { useCallback, useEffect, useState } from "react";
import { Play, Pause, Square, RefreshCw, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthProvider";
import { OperationsApi, fetchMachineOptions } from "../data/db";
import { useRealtime } from "../hooks/useRealtime";

const DISPOSITION = [
  { value: "ok", label: "OK" },
  { value: "rework", label: "Rework" },
  { value: "scrap", label: "Scrap" },
  { value: "hold", label: "Hold / Quarantine" },
];

export default function ShopFloorModule() {
  const { activeOrgId } = useAuth();
  const [ops, setOps] = useState([]);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [completingOp, setCompletingOp] = useState(null);

  const load = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    try {
      setOps(await OperationsApi.activeForOrg(activeOrgId));
      setMachines(await fetchMachineOptions(activeOrgId));
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [activeOrgId]);
  useEffect(() => { load(); }, [load]);

  useRealtime("job_operations", activeOrgId, () => load(), [load]);
  useRealtime("machines", activeOrgId, () => load(), [load]);

  async function start(op, machineId) {
    try { await OperationsApi.start(op.id, machineId); toast.success(`Started ${op.operation_name}`); load(); }
    catch (e) { toast.error(e.message); }
  }
  async function pause(op) {
    const reason = window.prompt("Reason for pause (optional):", "") || null;
    try { await OperationsApi.pause(op.id, reason); toast.success("Paused"); load(); }
    catch (e) { toast.error(e.message); }
  }
  async function resume(op) {
    try { await OperationsApi.resume(op.id); toast.success("Resumed"); load(); }
    catch (e) { toast.error(e.message); }
  }
  async function completeSubmit(payload) {
    try {
      await OperationsApi.complete(completingOp.id, payload);
      toast.success("Operation completed");
      setCompletingOp(null); load();
    } catch (e) { toast.error(e.message); }
  }

  return (
    <div className="module-view">
      <div className="page-title">
        <div>
          <div className="eyebrow">Precise Industries / Shop floor</div>
          <h1 data-testid="module-title">Shop Floor Controls</h1>
          <p>Real-time operator kiosk. Start, pause and complete active operations.</p>
        </div>
        <button className="outline-btn" data-testid="shopfloor-refresh" onClick={load}><RefreshCw size={14}/> Refresh</button>
      </div>

      {loading && ops.length === 0 && <p>Loading operations…</p>}
      {!loading && ops.length === 0 && (
        <section className="panel">
          <div className="empty-cell" style={{ padding: 40 }}>
            <b>No active operations</b>
            <small>Generate a job from a Customer PO and its first operation will show up here.</small>
          </div>
        </section>
      )}

      <div className="shopfloor-grid" data-testid="shopfloor-grid">
        {ops.map(op => (
          <OpCard
            key={op.id}
            op={op}
            machines={machines}
            onStart={start}
            onPause={pause}
            onResume={resume}
            onComplete={() => setCompletingOp(op)}
          />
        ))}
      </div>

      {completingOp && (
        <CompleteDrawer
          op={completingOp}
          onClose={() => setCompletingOp(null)}
          onSubmit={completeSubmit}
        />
      )}
    </div>
  );
}

function OpCard({ op, machines, onStart, onPause, onResume, onComplete }) {
  const [pickedMachine, setPickedMachine] = useState(op.machine_id || "");
  useEffect(() => { setPickedMachine(op.machine_id || ""); }, [op.machine_id]);
  const idx = String(op.sequence || 0);
  return (
    <article className={`op-card status-${op.status}`} data-testid={`op-card-${op.id}`}>
      <header>
        <div>
          <span className="eyebrow">{op.job?.job_number} · Seq {idx}</span>
          <h3>{op.operation_name}</h3>
          <small>{op.job?.part?.part_number} · {op.job?.customer?.name || "—"}</small>
        </div>
        <span className={`badge ${op.status}`} data-testid={`op-status-${op.id}`}>{op.status}</span>
      </header>
      <div className="op-metrics">
        <div><small>Planned</small><b>{op.planned_quantity}</b></div>
        <div><small>Completed</small><b className="positive">{op.completed_quantity}</b></div>
        <div><small>Rejected</small><b className="negative">{op.rejected_quantity}</b></div>
        <div><small>Machine</small><b>{op.machine?.code || "—"}</b></div>
      </div>
      {(op.status === "ready" || op.status === "pending") && !op.machine_id && (
        <label className="auth-field">
          <span>Assign a machine</span>
          <select data-testid={`pick-machine-${op.id}`} value={pickedMachine} onChange={e => setPickedMachine(e.target.value)}>
            <option value="">No machine</option>
            {machines.map(m => <option key={m.id} value={m.id}>{m.code} · {m.name}</option>)}
          </select>
        </label>
      )}
      <div className="op-actions">
        {(op.status === "ready" || op.status === "pending") && (
          <button className="primary-btn big" data-testid={`op-start-${op.id}`} onClick={() => onStart(op, pickedMachine || null)}><Play size={16}/> Start</button>
        )}
        {op.status === "running" && (
          <>
            <button className="outline-btn big" data-testid={`op-pause-${op.id}`} onClick={() => onPause(op)}><Pause size={16}/> Pause</button>
            <button className="primary-btn big" data-testid={`op-complete-${op.id}`} onClick={onComplete}><CheckCircle2 size={16}/> Complete</button>
          </>
        )}
        {op.status === "paused" && (
          <>
            <button className="primary-btn big" data-testid={`op-resume-${op.id}`} onClick={() => onResume(op)}><Play size={16}/> Resume</button>
            <button className="outline-btn big" data-testid={`op-complete-paused-${op.id}`} onClick={onComplete}><CheckCircle2 size={16}/> Complete</button>
          </>
        )}
      </div>
    </article>
  );
}

function CompleteDrawer({ op, onClose, onSubmit }) {
  const remaining = Number(op.planned_quantity) - Number(op.completed_quantity) - Number(op.rejected_quantity);
  const [completedQty, setCompletedQty] = useState(remaining > 0 ? remaining : 0);
  const [rejectedQty, setRejectedQty] = useState(0);
  const [reworkQty, setReworkQty] = useState(0);
  const [disposition, setDisposition] = useState("ok");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit({
        completedQty: Number(completedQty) || 0,
        rejectedQty: Number(rejectedQty) || 0,
        reworkQty: Number(reworkQty) || 0,
        disposition: rejectedQty > 0 || disposition !== "ok" ? disposition : null,
        reason: reason || null,
      });
    } finally { setBusy(false); }
  }

  return (
    <>
      <div className="drawer-scrim" onClick={onClose}/>
      <aside className="drawer" data-testid="complete-drawer">
        <div className="drawer-head">
          <div>
            <div className="eyebrow">Complete operation</div>
            <h2>{op.operation_name}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}><XCircle size={18}/></button>
        </div>
        <form onSubmit={submit} className="drawer-form">
          <label className="auth-field span-2"><span>Good pieces produced *</span>
            <input data-testid="complete-good-qty" type="number" step="0.0001" min="0" value={completedQty} onChange={e => setCompletedQty(e.target.value)} required/>
          </label>
          <label className="auth-field"><span>Rejected pieces</span>
            <input data-testid="complete-rejected-qty" type="number" step="0.0001" min="0" value={rejectedQty} onChange={e => setRejectedQty(e.target.value)}/>
          </label>
          <label className="auth-field"><span>Rework pieces</span>
            <input data-testid="complete-rework-qty" type="number" step="0.0001" min="0" value={reworkQty} onChange={e => setReworkQty(e.target.value)}/>
          </label>
          <label className="auth-field span-2"><span>Disposition</span>
            <select data-testid="complete-disposition" value={disposition} onChange={e => setDisposition(e.target.value)}>
              {DISPOSITION.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </label>
          <label className="auth-field span-2"><span>Reason / notes</span>
            <textarea data-testid="complete-reason" rows={3} value={reason} onChange={e => setReason(e.target.value)}/>
          </label>
          <div className="drawer-actions span-2">
            <button type="button" className="outline-btn" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="primary-btn" data-testid="complete-submit" disabled={busy}>
              <CheckCircle2 size={14}/> {busy ? "Recording…" : "Record & complete"}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
