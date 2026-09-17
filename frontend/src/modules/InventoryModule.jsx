import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, Package } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "./CustomersModule";
import { useAuth } from "../auth/AuthProvider";
import { InventoryApi } from "../data/db";

const PAGE_SIZE = 15;

export default function InventoryModule() {
  const { activeOrgId } = useAuth();
  const [balances, setBalances] = useState([]);
  const [txns, setTxns] = useState([]);
  const [txnCount, setTxnCount] = useState(0);
  const [txnPage, setTxnPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!activeOrgId) return;
    setLoading(true);
    try {
      setBalances(await InventoryApi.balances(activeOrgId));
      const res = await InventoryApi.transactions(activeOrgId, { page: txnPage, pageSize: PAGE_SIZE });
      setTxns(res.rows); setTxnCount(res.count);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [activeOrgId, txnPage]);
  useEffect(() => { load(); }, [load]);

  const pages = Math.max(1, Math.ceil(txnCount / PAGE_SIZE));

  return (
    <div className="module-view">
      <div className="page-title">
        <div>
          <div className="eyebrow">Precise Industries / Inventory</div>
          <h1 data-testid="module-title">Inventory</h1>
          <p>Live balances calculated from every stock transaction — no direct edits.</p>
        </div>
        <button className="outline-btn" data-testid="inventory-refresh" onClick={load}><RefreshCw size={14}/> Refresh</button>
      </div>

      <section className="panel">
        <div className="panel-head"><div><h2>Item balances</h2><span className="muted">On-hand quantity across all warehouses</span></div></div>
        <div className="table-scroll">
          <table data-testid="balances-table">
            <thead><tr><th>Item code</th><th>Name</th><th>Type</th><th>UoM</th><th style={{ textAlign: "right" }}>On hand</th></tr></thead>
            <tbody>
              {loading && balances.length === 0 && <tr><td colSpan={5} className="loading-cell">Loading…</td></tr>}
              {!loading && balances.length === 0 && <tr><td colSpan={5} className="empty-cell"><b>No inventory yet</b><small>Complete a job to see finished-goods receipts here.</small></td></tr>}
              {balances.map((b, i) => (
                <tr key={b.item_id} data-testid={`balance-row-${i}`}>
                  <td><b>{b.item?.code || "—"}</b></td>
                  <td><Package size={13}/> {b.item?.name || "—"}</td>
                  <td>{b.item?.item_type || "—"}</td>
                  <td>{b.item?.unit || "—"}</td>
                  <td style={{ textAlign: "right" }}><b className="positive">{Number(b.on_hand).toLocaleString("en-IN")}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel table-panel">
        <div className="panel-head"><div><h2>Recent transactions</h2><span className="muted">Append-only ledger — corrections use reversal rows.</span></div></div>
        <div className="table-scroll">
          <table data-testid="transactions-table">
            <thead><tr><th>Txn #</th><th>Type</th><th>Item</th><th>Warehouse</th><th style={{ textAlign: "right" }}>Qty</th><th>Reference</th><th>At</th></tr></thead>
            <tbody>
              {!loading && txns.length === 0 && <tr><td colSpan={7} className="empty-cell"><b>No transactions</b><small>Transactions appear as production completes.</small></td></tr>}
              {txns.map((t, i) => (
                <tr key={t.id} data-testid={`txn-row-${i}`}>
                  <td><b>{t.txn_number}</b></td>
                  <td><span className={`badge ${t.quantity >= 0 ? "active" : "lost"}`}>{t.txn_type.replaceAll("_", " ")}</span></td>
                  <td>{t.item?.code}<small>{t.item?.name}</small></td>
                  <td>{t.warehouse?.code}<small>{t.warehouse?.name}</small></td>
                  <td style={{ textAlign: "right" }}><b className={Number(t.quantity) >= 0 ? "positive" : "negative"}>{Number(t.quantity) >= 0 ? "+" : ""}{t.quantity}</b></td>
                  <td>{t.reference_number || "—"}<small>{t.reference_type || ""}</small></td>
                  <td>{new Date(t.effective_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={txnPage} pages={pages} onPrev={() => setTxnPage(p => Math.max(1, p - 1))} onNext={() => setTxnPage(p => Math.min(pages, p + 1))} count={txnCount} pageSize={PAGE_SIZE}/>
      </section>
    </div>
  );
}
