import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import { Factory, ArrowRight, Mail, Lock, User, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

/**
 * Single-file auth flow: login, signup, forgot password, reset password.
 * Uses a `screen` prop to switch views. `onReady` is called after successful login/signup.
 */
export default function AuthScreens({ initial = "login" }) {
  const [screen, setScreen] = useState(initial);

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="brand-mark auth-brand"><Factory size={22}/></div>
        <h1>Precise Industries</h1>
        <p>Your manufacturing operations, unified. Sales, jobs, quality and dispatch — under one roof.</p>
        <ul className="auth-perks">
          <li><ShieldCheck size={15}/> Multi-plant ready with organization-level security</li>
          <li><ShieldCheck size={15}/> Live dashboards for owners and shop-floor supervisors</li>
          <li><ShieldCheck size={15}/> Built for CNC, VMC, grinding, plating & assembly workflows</li>
        </ul>
      </div>
      <div className="auth-card">
        {screen === "login" && <Login onSwitch={setScreen}/>}
        {screen === "signup" && <Signup onSwitch={setScreen}/>}
        {screen === "forgot" && <Forgot onSwitch={setScreen}/>}
        {screen === "reset" && <Reset onSwitch={setScreen}/>}
      </div>
    </div>
  );
}

function AuthField({ label, ...props }) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <input {...props}/>
    </label>
  );
}

function Login({ onSwitch }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Welcome back");
  }
  return (
    <form onSubmit={submit} className="auth-form" data-testid="login-form">
      <div className="auth-icon"><Lock size={18}/></div>
      <h2>Sign in to your account</h2>
      <p className="auth-sub">Access your factory dashboard and modules.</p>
      <AuthField label="Work email" data-testid="login-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com"/>
      <AuthField label="Password" data-testid="login-password" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"/>
      <button className="primary-btn auth-btn" data-testid="login-submit" disabled={busy}>{busy ? "Signing in..." : <>Sign in <ArrowRight size={16}/></>}</button>
      <div className="auth-links">
        <button type="button" data-testid="go-to-forgot" onClick={() => onSwitch("forgot")}>Forgot password?</button>
        <span>New here? <button type="button" data-testid="go-to-signup" onClick={() => onSwitch("signup")}>Create an account</button></span>
      </div>
    </form>
  );
}

function Signup({ onSwitch }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { first_name: firstName, last_name: lastName } },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (!data.session) toast.info("Confirm your email to continue.");
    else toast.success("Account created — let's set up your company");
  }

  return (
    <form onSubmit={submit} className="auth-form" data-testid="signup-form">
      <div className="auth-icon"><User size={18}/></div>
      <h2>Create your account</h2>
      <p className="auth-sub">Then set up your factory in under a minute.</p>
      <div className="auth-row">
        <AuthField label="First name" data-testid="signup-first-name" required value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Arjun"/>
        <AuthField label="Last name" data-testid="signup-last-name" required value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Kulkarni"/>
      </div>
      <AuthField label="Work email" data-testid="signup-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com"/>
      <AuthField label="Password" data-testid="signup-password" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters"/>
      <button className="primary-btn auth-btn" data-testid="signup-submit" disabled={busy}>{busy ? "Creating..." : <>Create account <ArrowRight size={16}/></>}</button>
      <div className="auth-links">
        <span>Already registered? <button type="button" data-testid="go-to-login" onClick={() => onSwitch("login")}>Sign in</button></span>
      </div>
    </form>
  );
}

function Forgot({ onSwitch }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/#reset-password`,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else { setSent(true); toast.success("Password reset email sent"); }
  }
  return (
    <form onSubmit={submit} className="auth-form" data-testid="forgot-form">
      <div className="auth-icon"><Mail size={18}/></div>
      <h2>Reset your password</h2>
      <p className="auth-sub">We'll send a secure reset link to your email.</p>
      <AuthField label="Work email" data-testid="forgot-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com"/>
      <button className="primary-btn auth-btn" data-testid="forgot-submit" disabled={busy || sent}>{busy ? "Sending..." : sent ? "Link sent" : <>Send reset link <ArrowRight size={16}/></>}</button>
      <div className="auth-links">
        <button type="button" data-testid="back-to-login" onClick={() => onSwitch("login")}>Back to sign in</button>
      </div>
    </form>
  );
}

function Reset({ onSwitch }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (password !== confirm) { toast.error("Passwords do not match"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Password updated"); onSwitch("login"); }
  }
  return (
    <form onSubmit={submit} className="auth-form" data-testid="reset-form">
      <div className="auth-icon"><Lock size={18}/></div>
      <h2>Set a new password</h2>
      <p className="auth-sub">Choose a password you haven't used before.</p>
      <AuthField label="New password" data-testid="reset-password" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}/>
      <AuthField label="Confirm password" data-testid="reset-confirm" type="password" required minLength={6} value={confirm} onChange={e => setConfirm(e.target.value)}/>
      <button className="primary-btn auth-btn" data-testid="reset-submit" disabled={busy}>{busy ? "Updating..." : <>Update password <ArrowRight size={16}/></>}</button>
    </form>
  );
}
