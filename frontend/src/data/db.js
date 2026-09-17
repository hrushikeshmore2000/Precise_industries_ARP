import { supabase } from "../lib/supabase";

/* ---------- Organization onboarding ---------- */
export async function createOrganization(payload) {
  const { data, error } = await supabase.rpc("create_organization_with_owner", {
    p_name: payload.name,
    p_legal_name: payload.legal_name || null,
    p_gstin: payload.gstin || null,
    p_phone: payload.phone || null,
    p_email: payload.email || null,
    p_city: payload.city || null,
    p_state: payload.state || null,
    p_country: payload.country || "India",
    p_plant_name: payload.plant_name || null,
  });
  if (error) throw error;
  return data;
}

/* ---------- Generic paginated list helper ---------- */
async function list(table, orgId, opts = {}) {
  const { search, searchColumns = [], statusColumn, status, orderBy = "created_at", ascending = false, page = 1, pageSize = 25, extraSelect = "" } = opts;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase.from(table).select(`*${extraSelect ? "," + extraSelect : ""}`, { count: "exact" }).eq("organization_id", orgId);
  if (search && searchColumns.length) {
    const s = `%${search.replace(/[%,]/g, "")}%`;
    query = query.or(searchColumns.map(c => `${c}.ilike.${s}`).join(","));
  }
  if (status && statusColumn) query = query.eq(statusColumn, status);
  query = query.order(orderBy, { ascending }).range(from, to);
  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data || [], count: count || 0 };
}

/* ---------- Customers ---------- */
export const CustomersApi = {
  list: (orgId, opts) => list("customers", orgId, {
    ...opts,
    searchColumns: ["name", "code", "gstin", "city", "email"],
    statusColumn: "status",
  }),
  get: async (id) => {
    const { data, error } = await supabase.from("customers").select("*").eq("id", id).single();
    if (error) throw error; return data;
  },
  create: async (orgId, payload) => {
    const { data, error } = await supabase.from("customers").insert({ ...payload, organization_id: orgId }).select().single();
    if (error) throw error; return data;
  },
  update: async (id, payload) => {
    const { data, error } = await supabase.from("customers").update(payload).eq("id", id).select().single();
    if (error) throw error; return data;
  },
  archive: async (id) => {
    const { data, error } = await supabase.from("customers").update({ status: "archived" }).eq("id", id).select().single();
    if (error) throw error; return data;
  },
  remove: async (id) => {
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) throw error;
  },
};

/* ---------- Leads ---------- */
export const LeadsApi = {
  list: (orgId, opts) => list("leads", orgId, {
    ...opts,
    searchColumns: ["company_name", "contact_name", "email", "phone", "code"],
    statusColumn: "status",
  }),
  get: async (id) => {
    const { data, error } = await supabase.from("leads").select("*").eq("id", id).single();
    if (error) throw error; return data;
  },
  create: async (orgId, payload) => {
    const { data, error } = await supabase.from("leads").insert({ ...payload, organization_id: orgId }).select().single();
    if (error) throw error; return data;
  },
  update: async (id, payload) => {
    const { data, error } = await supabase.from("leads").update(payload).eq("id", id).select().single();
    if (error) throw error; return data;
  },
  remove: async (id) => {
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) throw error;
  },
};

/* ---------- Parts ---------- */
export const PartsApi = {
  list: (orgId, opts) => list("parts", orgId, {
    ...opts,
    searchColumns: ["part_number", "part_name", "customer_part_number", "material"],
    extraSelect: "customer:customers(id, name)",
  }),
  get: async (id) => {
    const { data, error } = await supabase.from("parts").select("*, customer:customers(id, name)").eq("id", id).single();
    if (error) throw error; return data;
  },
  create: async (orgId, payload) => {
    const { data, error } = await supabase.from("parts").insert({ ...payload, organization_id: orgId }).select().single();
    if (error) throw error; return data;
  },
  update: async (id, payload) => {
    const { data, error } = await supabase.from("parts").update(payload).eq("id", id).select().single();
    if (error) throw error; return data;
  },
  remove: async (id) => {
    const { error } = await supabase.from("parts").delete().eq("id", id);
    if (error) throw error;
  },
  listRevisions: async (partId) => {
    const { data, error } = await supabase.from("part_revisions").select("*").eq("part_id", partId).order("created_at", { ascending: false });
    if (error) throw error; return data || [];
  },
  addRevision: async (orgId, partId, payload) => {
    const { data, error } = await supabase.from("part_revisions").insert({ ...payload, part_id: partId, organization_id: orgId }).select().single();
    if (error) throw error; return data;
  },
};

/* ---------- Customer options (for Parts dropdown) ---------- */
export async function fetchCustomerOptions(orgId) {
  const { data, error } = await supabase.from("customers")
    .select("id, name").eq("organization_id", orgId).neq("status", "archived").order("name").limit(500);
  if (error) throw error;
  return data || [];
}
