import React, { useEffect, useState } from "react";
import { X, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Reusable right-side drawer form. Renders `fields` as inputs and calls onSave with the record.
 * @param {object} props
 * @param {string} props.title
 * @param {object|null} props.record — object to edit or null for new
 * @param {Array<{key:string,label:string,type?:string,options?:Array<{value:string,label:string}>,placeholder?:string,required?:boolean,textarea?:boolean,step?:string,span?:number}>} props.fields
 * @param {(record:object)=>Promise<void>} props.onSave
 * @param {()=>void} props.onClose
 * @param {(record:object)=>Promise<void>} [props.onDelete]
 * @param {string} props.testidPrefix
 */
export default function DrawerForm({ title, record, fields, onSave, onClose, onDelete, testidPrefix }) {
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { setForm(record || {}); }, [record]);

  function bind(key) {
    return {
      value: form[key] ?? "",
      onChange: e => setForm(f => ({ ...f, [key]: e.target.value })),
    };
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      // Normalize numeric fields
      const clean = { ...form };
      fields.forEach(f => {
        if (["number", "decimal"].includes(f.type)) {
          clean[f.key] = clean[f.key] === "" || clean[f.key] == null ? null : Number(clean[f.key]);
        }
        if (clean[f.key] === "") clean[f.key] = null;
      });
      await onSave(clean);
    } catch (err) { toast.error(err.message || "Save failed"); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!record?.id) return;
    if (!window.confirm(`Delete this record?`)) return;
    setBusy(true);
    try { await onDelete(record); }
    catch (err) { toast.error(err.message || "Delete failed"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} data-testid={`${testidPrefix}-drawer-scrim`}/>
      <aside className="drawer" data-testid={`${testidPrefix}-drawer`}>
        <div className="drawer-head">
          <div>
            <div className="eyebrow">{record?.id ? "Edit" : "New"}</div>
            <h2>{title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} data-testid={`${testidPrefix}-drawer-close`}><X size={18}/></button>
        </div>
        <form onSubmit={submit} className="drawer-form">
          {fields.map(f => (
            <label key={f.key} className={`auth-field ${f.span === 2 ? "span-2" : ""}`}>
              <span>{f.label}{f.required ? " *" : ""}</span>
              {f.options ? (
                <select {...bind(f.key)} required={f.required} data-testid={`${testidPrefix}-field-${f.key}`}>
                  <option value="">Select…</option>
                  {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.textarea ? (
                <textarea rows={3} placeholder={f.placeholder} {...bind(f.key)} data-testid={`${testidPrefix}-field-${f.key}`}/>
              ) : (
                <input
                  type={f.type === "decimal" || f.type === "number" ? "number" : (f.type || "text")}
                  step={f.step}
                  placeholder={f.placeholder}
                  required={f.required}
                  data-testid={`${testidPrefix}-field-${f.key}`}
                  {...bind(f.key)}
                />
              )}
            </label>
          ))}
          <div className="drawer-actions span-2">
            {record?.id && onDelete && (
              <button type="button" className="outline-btn danger" onClick={remove} disabled={busy} data-testid={`${testidPrefix}-drawer-delete`}>
                <Trash2 size={14}/> Delete
              </button>
            )}
            <button type="button" className="outline-btn" onClick={onClose} disabled={busy} data-testid={`${testidPrefix}-drawer-cancel`}>Cancel</button>
            <button className="primary-btn" disabled={busy} data-testid={`${testidPrefix}-drawer-save`}>
              <Save size={14}/> {busy ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
