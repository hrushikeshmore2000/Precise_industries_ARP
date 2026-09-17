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

/* ---------- Options dropdowns ---------- */
export async function fetchCustomerOptions(orgId) {
  const { data, error } = await supabase.from("customers")
    .select("id, name").eq("organization_id", orgId).neq("status", "archived").order("name").limit(500);
  if (error) throw error; return data || [];
}
export async function fetchPartOptions(orgId) {
  const { data, error } = await supabase.from("parts")
    .select("id, part_number, part_name, unit").eq("organization_id", orgId).eq("active", true).order("part_number").limit(500);
  if (error) throw error; return data || [];
}
export async function fetchWorkCenterOptions(orgId) {
  const { data, error } = await supabase.from("work_centers")
    .select("id, code, name").eq("organization_id", orgId).eq("active", true).order("code").limit(500);
  if (error) throw error; return data || [];
}
export async function fetchMachineOptions(orgId) {
  const { data, error } = await supabase.from("machines")
    .select("id, code, name, status").eq("organization_id", orgId).eq("active", true).order("code").limit(500);
  if (error) throw error; return data || [];
}
export async function fetchWarehouseOptions(orgId) {
  const { data, error } = await supabase.from("warehouses")
    .select("id, code, name, warehouse_type").eq("organization_id", orgId).eq("active", true).order("code");
  if (error) throw error; return data || [];
}

/* ---------- Work Centers ---------- */
export const WorkCentersApi = {
  list: (orgId, opts) => list("work_centers", orgId, { ...opts, searchColumns: ["code", "name", "description"] }),
  create: async (orgId, p) => { const { data, error } = await supabase.from("work_centers").insert({ ...p, organization_id: orgId }).select().single(); if (error) throw error; return data; },
  update: async (id, p) => { const { data, error } = await supabase.from("work_centers").update(p).eq("id", id).select().single(); if (error) throw error; return data; },
  remove: async (id) => { const { error } = await supabase.from("work_centers").delete().eq("id", id); if (error) throw error; },
};

/* ---------- Machines ---------- */
export const MachinesApi = {
  list: (orgId, opts) => list("machines", orgId, {
    ...opts,
    searchColumns: ["code", "name", "machine_type", "manufacturer", "model"],
    extraSelect: "work_center:work_centers(id, code, name)",
    statusColumn: "status",
  }),
  create: async (orgId, p) => { const { data, error } = await supabase.from("machines").insert({ ...p, organization_id: orgId }).select().single(); if (error) throw error; return data; },
  update: async (id, p) => { const { data, error } = await supabase.from("machines").update(p).eq("id", id).select().single(); if (error) throw error; return data; },
  remove: async (id) => { const { error } = await supabase.from("machines").delete().eq("id", id); if (error) throw error; },
};

/* ---------- Warehouses ---------- */
export const WarehousesApi = {
  list: (orgId) => supabase.from("warehouses").select("*").eq("organization_id", orgId).order("code")
    .then(({ data, error }) => { if (error) throw error; return { rows: data || [], count: (data || []).length }; }),
};

/* ---------- Customer POs ---------- */
export const CustomerPOsApi = {
  list: (orgId, opts) => list("customer_pos", orgId, {
    ...opts,
    searchColumns: ["po_number", "notes"],
    extraSelect: "customer:customers(id, name), items:customer_po_items(id, part_id, quantity, produced_quantity, rate)",
    statusColumn: "status",
  }),
  get: async (id) => {
    const { data, error } = await supabase.from("customer_pos")
      .select("*, customer:customers(id, name, gstin, city), items:customer_po_items(*, part:parts(id, part_number, part_name, unit), schedules:delivery_schedules(*))")
      .eq("id", id).single();
    if (error) throw error; return data;
  },
  create: async (orgId, p) => {
    const { data, error } = await supabase.from("customer_pos").insert({ ...p, organization_id: orgId }).select().single();
    if (error) throw error; return data;
  },
  update: async (id, p) => {
    const { data, error } = await supabase.from("customer_pos").update(p).eq("id", id).select().single();
    if (error) throw error; return data;
  },
  remove: async (id) => { const { error } = await supabase.from("customer_pos").delete().eq("id", id); if (error) throw error; },
  addItem: async (orgId, poId, p) => {
    const { data, error } = await supabase.from("customer_po_items").insert({ ...p, customer_po_id: poId, organization_id: orgId }).select().single();
    if (error) throw error; return data;
  },
  removeItem: async (id) => { const { error } = await supabase.from("customer_po_items").delete().eq("id", id); if (error) throw error; },
  addSchedule: async (orgId, poItemId, p) => {
    const { data, error } = await supabase.from("delivery_schedules").insert({ ...p, customer_po_item_id: poItemId, organization_id: orgId }).select().single();
    if (error) throw error; return data;
  },
  removeSchedule: async (id) => { const { error } = await supabase.from("delivery_schedules").delete().eq("id", id); if (error) throw error; },
  generateJob: async (poItemId, opts = {}) => {
    const { data, error } = await supabase.rpc("generate_job_from_po_item", {
      p_po_item_id: poItemId,
      p_priority: opts.priority || "medium",
      p_due_date: opts.due_date || null,
      p_notes: opts.notes || null,
      p_default_operations: opts.operations || ["Manufacturing"],
    });
    if (error) throw error; return data;
  },
};

/* ---------- Jobs & Operations ---------- */
export const JobsApi = {
  list: (orgId, opts) => list("jobs", orgId, {
    ...opts,
    searchColumns: ["job_number", "notes"],
    extraSelect: "customer:customers(id, name), part:parts(id, part_number, part_name), po:customer_pos(id, po_number)",
    statusColumn: "status",
  }),
  get: async (id) => {
    const { data, error } = await supabase.from("jobs")
      .select("*, customer:customers(id, name), part:parts(id, part_number, part_name, unit), po:customer_pos(id, po_number), operations:job_operations(*, work_center:work_centers(id, code, name), machine:machines(id, code, name), operator:profiles(id, first_name, last_name))")
      .eq("id", id).single();
    if (error) throw error; return data;
  },
  update: async (id, p) => { const { data, error } = await supabase.from("jobs").update(p).eq("id", id).select().single(); if (error) throw error; return data; },
  addOperation: async (orgId, jobId, p) => {
    const { data, error } = await supabase.from("job_operations").insert({ ...p, job_id: jobId, organization_id: orgId }).select().single();
    if (error) throw error; return data;
  },
  updateOperation: async (id, p) => { const { data, error } = await supabase.from("job_operations").update(p).eq("id", id).select().single(); if (error) throw error; return data; },
  events: async (jobId) => {
    const { data, error } = await supabase.from("job_events").select("*, actor:profiles(first_name, last_name)").eq("job_id", jobId).order("created_at", { ascending: false }).limit(200);
    if (error) throw error; return data || [];
  },
};

export const OperationsApi = {
  start: async (opId, machineId = null) => {
    const { data, error } = await supabase.rpc("job_operation_start", { p_op: opId, p_machine: machineId });
    if (error) throw error; return data;
  },
  pause: async (opId, reason = null) => {
    const { data, error } = await supabase.rpc("job_operation_pause", { p_op: opId, p_reason: reason });
    if (error) throw error; return data;
  },
  resume: async (opId) => {
    const { data, error } = await supabase.rpc("job_operation_resume", { p_op: opId });
    if (error) throw error; return data;
  },
  complete: async (opId, { completedQty, rejectedQty = 0, reworkQty = 0, disposition = null, reason = null, fgWarehouse = null }) => {
    const { data, error } = await supabase.rpc("job_operation_complete", {
      p_op: opId,
      p_completed_qty: completedQty,
      p_rejected_qty: rejectedQty,
      p_rework_qty: reworkQty,
      p_disposition: disposition,
      p_reason: reason,
      p_fg_warehouse: fgWarehouse,
    });
    if (error) throw error; return data;
  },
  activeForOrg: async (orgId) => {
    const { data, error } = await supabase.from("job_operations")
      .select("*, job:jobs(id, job_number, part:parts(id, part_number, part_name), customer:customers(id, name)), machine:machines(id, code, name)")
      .eq("organization_id", orgId)
      .in("status", ["ready", "running", "paused"])
      .order("sequence")
      .limit(200);
    if (error) throw error; return data || [];
  },
};

/* ---------- Inventory ---------- */
export const InventoryApi = {
  balances: async (orgId) => {
    const { data, error } = await supabase.from("inventory_item_balances")
      .select("*").eq("organization_id", orgId).order("on_hand", { ascending: false });
    if (error) throw error;
    if (!data || data.length === 0) return [];
    const ids = data.map(r => r.item_id);
    const { data: items } = await supabase.from("items").select("id, code, name, unit, item_type").in("id", ids);
    const byId = Object.fromEntries((items || []).map(i => [i.id, i]));
    return data.map(r => ({ ...r, item: byId[r.item_id] }));
  },
  transactions: async (orgId, { page = 1, pageSize = 20 } = {}) => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await supabase.from("inventory_transactions")
      .select("*, item:items(id, code, name, unit), warehouse:warehouses(id, code, name)", { count: "exact" })
      .eq("organization_id", orgId)
      .order("effective_at", { ascending: false })
      .range(from, to);
    if (error) throw error;
    return { rows: data || [], count: count || 0 };
  },
};
