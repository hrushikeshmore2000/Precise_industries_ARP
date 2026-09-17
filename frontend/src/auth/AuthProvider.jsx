import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext({
  session: null,
  user: null,
  loading: true,
  orgs: [],
  activeOrgId: null,
  activeMembership: null,
  setActiveOrgId: () => {},
  refreshOrgs: async () => {},
});

const LS_ACTIVE_ORG = "precise.activeOrgId";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [activeOrgId, setActiveOrgIdState] = useState(() => localStorage.getItem(LS_ACTIVE_ORG) || null);

  const setActiveOrgId = useCallback((id) => {
    setActiveOrgIdState(id);
    if (id) localStorage.setItem(LS_ACTIVE_ORG, id);
    else localStorage.removeItem(LS_ACTIVE_ORG);
  }, []);

  const loadOrgs = useCallback(async (uid) => {
    if (!uid) { setOrgs([]); return; }
    setOrgLoading(true);
    const { data, error } = await supabase
      .from("organization_members")
      .select("role, organization:organizations(id, name, plant_name, city)")
      .eq("user_id", uid);
    setOrgLoading(false);
    if (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to load orgs", error);
      setOrgs([]);
      return;
    }
    const rows = (data || []).filter(r => r.organization).map(r => ({ ...r.organization, role: r.role }));
    setOrgs(rows);
    // Pick default org
    if (rows.length && (!activeOrgId || !rows.some(o => o.id === activeOrgId))) {
      setActiveOrgId(rows[0].id);
    }
    if (!rows.length) setActiveOrgId(null);
  }, [activeOrgId, setActiveOrgId]);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setLoading(false);
      if (data.session?.user?.id) loadOrgs(data.session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, next) => {
      setSession(next);
      setLoading(false);
      if (next?.user?.id) loadOrgs(next.user.id);
      else { setOrgs([]); setActiveOrgId(null); }
    });
    return () => { alive = false; subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshOrgs = useCallback(async () => {
    if (session?.user?.id) await loadOrgs(session.user.id);
  }, [session, loadOrgs]);

  const activeMembership = orgs.find(o => o.id === activeOrgId) || null;

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user || null,
      loading: loading || orgLoading,
      orgs,
      activeOrgId,
      activeMembership,
      setActiveOrgId,
      refreshOrgs,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
