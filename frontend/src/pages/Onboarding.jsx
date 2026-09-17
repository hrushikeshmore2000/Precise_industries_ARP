import React, { useState } from "react";
import { createOrganization } from "../data/db";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import { Factory, LogOut, ArrowRight, Building2 } from "lucide-react";
import { toast } from "sonner";

export default function Onboarding() {
  const { refreshOrgs, setActiveOrgId, user } = useAuth();
  const [form, setForm] = useState({
    name: "", legal_name: "", gstin: "", phone: "", email: user?.email || "",
    city: "", state: "", country: "India", plant_name: "",
  });
  const [busy, setBusy] = useState(false);

  function bind(field) {
    return { value: form[field], onChange: e => setForm(f => ({ ...f, [field]: e.target.value })) };
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Company name is required"); return; }
    setBusy(true);
    try {
      const org = await createOrganization(form);
      await refreshOrgs();
      if (org?.id) setActiveOrgId(org.id);
      toast.success("Company created — welcome aboard");
    } catch (e2) {
      toast.error(e2.message || "Failed to create company");
    } finally { setBusy(false); }
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="onboarding-page">
      <header className="onboarding-topbar">
        <div className="brand"><div className="brand-mark"><Factory size={17}/></div><div><b>PRECISE</b><span>INDUSTRIES</span></div></div>
        <button className="outline-btn" data-testid="onboarding-signout" onClick={signOut}><LogOut size={14}/> Sign out</button>
      </header>
      <div className="onboarding-card">
        <div className="onboarding-eyebrow"><Building2 size={16}/> Company setup · Step 1 of 1</div>
        <h1>Tell us about your company</h1>
        <p>This creates your workspace. Your data is fully isolated from every other company.</p>
        <form onSubmit={submit} className="onboarding-form" data-testid="onboarding-form">
          <label className="auth-field span-2"><span>Company name *</span><input required data-testid="ob-name" {...bind("name")} placeholder="Precise Industries Pvt Ltd"/></label>
          <label className="auth-field"><span>Legal name</span><input data-testid="ob-legal-name" {...bind("legal_name")}/></label>
          <label className="auth-field"><span>GSTIN</span><input data-testid="ob-gstin" {...bind("gstin")} placeholder="27ABCDE1234F1Z5"/></label>
          <label className="auth-field"><span>Phone</span><input data-testid="ob-phone" {...bind("phone")}/></label>
          <label className="auth-field"><span>Email</span><input data-testid="ob-email" type="email" {...bind("email")}/></label>
          <label className="auth-field"><span>Plant name</span><input data-testid="ob-plant" {...bind("plant_name")} placeholder="Plant 01"/></label>
          <label className="auth-field"><span>City</span><input data-testid="ob-city" {...bind("city")} placeholder="Pune"/></label>
          <label className="auth-field"><span>State</span><input data-testid="ob-state" {...bind("state")} placeholder="Maharashtra"/></label>
          <label className="auth-field"><span>Country</span><input data-testid="ob-country" {...bind("country")}/></label>
          <div className="span-2">
            <button className="primary-btn auth-btn" data-testid="onboarding-submit" disabled={busy}>{busy ? "Creating..." : <>Create company & enter dashboard <ArrowRight size={16}/></>}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
