-- Precise Industries — Phase 4-A migration: Manufacturing core
-- Adds: work centers, machines, warehouses, items, customer POs (real),
-- BOM/routing skeleton, jobs, job operations, job cards, job events,
-- inventory transactions (append-only), number sequences, PO→Job & shop-floor RPCs.
-- Realtime enabled selectively on jobs, job_operations, machines.
-- Idempotent — safe to re-run.

create extension if not exists pgcrypto;

--------------------------------------------------------------------------------
-- 1. ENUMS
--------------------------------------------------------------------------------
do $$ begin
  create type public.machine_status as enum ('running','idle','down','maintenance');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.item_type as enum ('raw_material','finished_good','wip','consumable','tool','service');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.warehouse_type as enum ('raw_material','wip','finished_goods','scrap','quarantine','general');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.customer_po_status as enum ('draft','confirmed','in_production','partially_shipped','closed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.job_status as enum ('draft','released','in_progress','on_hold','completed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.job_priority as enum ('low','medium','high','urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.operation_status as enum ('pending','ready','running','paused','completed','blocked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.job_event_type as enum (
    'job_created','job_released','job_on_hold','job_completed','job_cancelled',
    'operation_started','operation_paused','operation_resumed','operation_completed',
    'quantity_reported','rejection_reported','adjustment'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.inventory_transaction_type as enum (
    'receipt','issue','return','transfer','production_consumption','production_receipt',
    'job_work_out','job_work_in','scrap','adjustment','reversal'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.disposition as enum ('ok','rework','scrap','hold');
exception when duplicate_object then null; end $$;

--------------------------------------------------------------------------------
-- 2. NUMBER SEQUENCES (safe, per-org, per-year, concurrency-proof)
--------------------------------------------------------------------------------
create table if not exists public.number_sequences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sequence_key text not null,      -- e.g. 'job','operation','job_card','customer_po'
  year int not null,
  prefix text not null,            -- e.g. 'JOB','OP','JC','PO'
  pad_length int not null default 5,
  current_number bigint not null default 0,
  updated_at timestamptz not null default now(),
  unique (organization_id, sequence_key, year)
);
alter table public.number_sequences enable row level security;

create or replace function public.next_number(p_org uuid, p_key text, p_prefix text, p_pad int default 5)
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_year int := extract(year from now())::int;
  v_next bigint;
begin
  insert into public.number_sequences (organization_id, sequence_key, year, prefix, pad_length, current_number)
  values (p_org, p_key, v_year, p_prefix, p_pad, 1)
  on conflict (organization_id, sequence_key, year)
    do update set current_number = public.number_sequences.current_number + 1,
                  updated_at = now()
  returning current_number into v_next;
  return format('%s-%s-%s', p_prefix, v_year, lpad(v_next::text, p_pad, '0'));
end; $$;
revoke all on function public.next_number(uuid, text, text, int) from public, anon;
grant execute on function public.next_number(uuid, text, text, int) to authenticated;

--------------------------------------------------------------------------------
-- 3. MASTER TABLES
--------------------------------------------------------------------------------
create table if not exists public.work_centers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (organization_id, code)
);
create index if not exists idx_wc_org on public.work_centers(organization_id);

create table if not exists public.machines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  machine_type text,
  manufacturer text,
  model text,
  work_center_id uuid references public.work_centers(id) on delete set null,
  hourly_rate numeric(14,2),
  status public.machine_status not null default 'idle',
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (organization_id, code)
);
create index if not exists idx_machines_org on public.machines(organization_id);
create index if not exists idx_machines_wc on public.machines(work_center_id);

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  warehouse_type public.warehouse_type not null default 'general',
  location text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (organization_id, code)
);
create index if not exists idx_wh_org on public.warehouses(organization_id);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  item_type public.item_type not null,
  unit text not null default 'nos',
  hsn_code text,
  part_id uuid references public.parts(id) on delete set null,
  standard_cost numeric(14,2),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (organization_id, code)
);
create index if not exists idx_items_org on public.items(organization_id);
create index if not exists idx_items_part on public.items(part_id);

--------------------------------------------------------------------------------
-- 4. CUSTOMER PO (real)
--------------------------------------------------------------------------------
create table if not exists public.customer_pos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  po_number text not null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  po_date date not null default current_date,
  delivery_date date,
  status public.customer_po_status not null default 'draft',
  currency text default 'INR',
  payment_terms text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (organization_id, po_number)
);
create index if not exists idx_po_org on public.customer_pos(organization_id);
create index if not exists idx_po_customer on public.customer_pos(customer_id);
create index if not exists idx_po_status on public.customer_pos(organization_id, status);

create table if not exists public.customer_po_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_po_id uuid not null references public.customer_pos(id) on delete cascade,
  part_id uuid not null references public.parts(id) on delete restrict,
  part_revision text,
  quantity numeric(14,4) not null check (quantity > 0),
  produced_quantity numeric(14,4) not null default 0,
  rate numeric(14,2) not null default 0,
  amount numeric(16,2) generated always as (round(quantity * rate, 2)) stored,
  sequence int not null default 1,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);
create index if not exists idx_po_items_po on public.customer_po_items(customer_po_id);
create index if not exists idx_po_items_part on public.customer_po_items(part_id);

create table if not exists public.delivery_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_po_item_id uuid not null references public.customer_po_items(id) on delete cascade,
  scheduled_date date not null,
  scheduled_quantity numeric(14,4) not null check (scheduled_quantity > 0),
  shipped_quantity numeric(14,4) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);
create index if not exists idx_ds_po_item on public.delivery_schedules(customer_po_item_id);

--------------------------------------------------------------------------------
-- 5. JOBS, OPERATIONS, JOB CARDS, EVENTS
--------------------------------------------------------------------------------
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_number text not null,
  customer_po_id uuid references public.customer_pos(id) on delete set null,
  customer_po_item_id uuid references public.customer_po_items(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  part_id uuid not null references public.parts(id) on delete restrict,
  part_revision text,
  quantity numeric(14,4) not null check (quantity > 0),
  completed_quantity numeric(14,4) not null default 0,
  rejected_quantity numeric(14,4) not null default 0,
  rework_quantity numeric(14,4) not null default 0,
  priority public.job_priority not null default 'medium',
  status public.job_status not null default 'draft',
  due_date date,
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (organization_id, job_number)
);
create index if not exists idx_jobs_org on public.jobs(organization_id);
create index if not exists idx_jobs_status on public.jobs(organization_id, status);
create index if not exists idx_jobs_po_item on public.jobs(customer_po_item_id);

create table if not exists public.job_operations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  operation_number text not null,
  sequence int not null default 1,
  operation_name text not null,
  work_center_id uuid references public.work_centers(id) on delete set null,
  machine_id uuid references public.machines(id) on delete set null,
  operator_id uuid references auth.users(id) on delete set null,
  planned_start timestamptz,
  planned_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  planned_quantity numeric(14,4) not null default 0,
  completed_quantity numeric(14,4) not null default 0,
  rejected_quantity numeric(14,4) not null default 0,
  rework_quantity numeric(14,4) not null default 0,
  cycle_time_sec int,
  status public.operation_status not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (organization_id, operation_number)
);
create index if not exists idx_ops_job on public.job_operations(job_id, sequence);
create index if not exists idx_ops_machine on public.job_operations(machine_id, status);

create table if not exists public.job_cards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  job_operation_id uuid not null references public.job_operations(id) on delete cascade,
  card_number text not null,
  status public.operation_status not null default 'pending',
  issued_at timestamptz not null default now(),
  completed_at timestamptz,
  operator_id uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (organization_id, card_number)
);
create index if not exists idx_jc_op on public.job_cards(job_operation_id);

create table if not exists public.job_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  job_operation_id uuid references public.job_operations(id) on delete set null,
  event_type public.job_event_type not null,
  actor_id uuid references auth.users(id) on delete set null,
  quantity_delta numeric(14,4),
  rejected_delta numeric(14,4),
  rework_delta numeric(14,4),
  reason text,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_events_job on public.job_events(job_id, created_at);
create index if not exists idx_events_op on public.job_events(job_operation_id, created_at);

--------------------------------------------------------------------------------
-- 6. INVENTORY (append-only ledger)
--------------------------------------------------------------------------------
create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  txn_number text not null,
  txn_type public.inventory_transaction_type not null,
  item_id uuid not null references public.items(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  quantity numeric(16,4) not null check (quantity <> 0),  -- signed: +receipt / -issue
  uom text,
  rate numeric(16,4),
  reference_type text,        -- e.g. 'job','customer_po','job_operation','grn','manual'
  reference_id uuid,
  reference_number text,
  disposition public.disposition,
  reason text,
  reversal_of uuid references public.inventory_transactions(id) on delete restrict,
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (organization_id, txn_number)
);
create index if not exists idx_txn_org on public.inventory_transactions(organization_id, effective_at);
create index if not exists idx_txn_item on public.inventory_transactions(item_id, effective_at);
create index if not exists idx_txn_ref on public.inventory_transactions(reference_type, reference_id);

-- Enforce append-only at the database level (deny UPDATE / DELETE on inventory_transactions).
create or replace function public.inventory_txn_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'inventory_transactions are append-only. Insert a reversal row instead of updating/deleting.';
end; $$;

drop trigger if exists inventory_txn_no_update on public.inventory_transactions;
create trigger inventory_txn_no_update before update on public.inventory_transactions
for each row execute function public.inventory_txn_immutable();

drop trigger if exists inventory_txn_no_delete on public.inventory_transactions;
create trigger inventory_txn_no_delete before delete on public.inventory_transactions
for each row execute function public.inventory_txn_immutable();

-- View: current stock per (item, warehouse) and per item.
create or replace view public.inventory_balances as
  select organization_id, item_id, warehouse_id,
         sum(quantity)::numeric(18,4) as on_hand
    from public.inventory_transactions
   group by organization_id, item_id, warehouse_id;
grant select on public.inventory_balances to authenticated;

create or replace view public.inventory_item_balances as
  select organization_id, item_id,
         sum(quantity)::numeric(18,4) as on_hand
    from public.inventory_transactions
   group by organization_id, item_id;
grant select on public.inventory_item_balances to authenticated;

--------------------------------------------------------------------------------
-- 7. AUTO-NUMBERING TRIGGERS
--------------------------------------------------------------------------------
create or replace function public.assign_job_number()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.job_number is null or new.job_number = '' then
    new.job_number := public.next_number(new.organization_id, 'job', 'JOB', 5);
  end if;
  return new;
end; $$;

drop trigger if exists jobs_assign_number on public.jobs;
create trigger jobs_assign_number before insert on public.jobs
for each row execute function public.assign_job_number();

create or replace function public.assign_operation_number()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.operation_number is null or new.operation_number = '' then
    new.operation_number := public.next_number(new.organization_id, 'operation', 'OP', 5);
  end if;
  return new;
end; $$;

drop trigger if exists ops_assign_number on public.job_operations;
create trigger ops_assign_number before insert on public.job_operations
for each row execute function public.assign_operation_number();

create or replace function public.assign_job_card_number()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.card_number is null or new.card_number = '' then
    new.card_number := public.next_number(new.organization_id, 'job_card', 'JC', 5);
  end if;
  return new;
end; $$;

drop trigger if exists jc_assign_number on public.job_cards;
create trigger jc_assign_number before insert on public.job_cards
for each row execute function public.assign_job_card_number();

create or replace function public.assign_po_number()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.po_number is null or new.po_number = '' then
    new.po_number := public.next_number(new.organization_id, 'customer_po', 'PO', 5);
  end if;
  return new;
end; $$;

drop trigger if exists cpo_assign_number on public.customer_pos;
create trigger cpo_assign_number before insert on public.customer_pos
for each row execute function public.assign_po_number();

create or replace function public.assign_inventory_txn_number()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.txn_number is null or new.txn_number = '' then
    new.txn_number := public.next_number(new.organization_id, 'inventory_txn', 'INV', 6);
  end if;
  return new;
end; $$;

drop trigger if exists inv_assign_number on public.inventory_transactions;
create trigger inv_assign_number before insert on public.inventory_transactions
for each row execute function public.assign_inventory_txn_number();

--------------------------------------------------------------------------------
-- 8. AUDIT TRIGGERS
--------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['work_centers','machines','warehouses','items',
                           'customer_pos','customer_po_items','delivery_schedules',
                           'jobs','job_operations','job_cards']
  loop
    execute format('drop trigger if exists %I_audit on public.%I', t, t);
    execute format('create trigger %I_audit before insert or update on public.%I for each row execute function public.set_audit_columns()', t, t);
  end loop;
end $$;

--------------------------------------------------------------------------------
-- 9. WAREHOUSE SEEDING (defaults per org)
--------------------------------------------------------------------------------
create or replace function public.seed_default_warehouses(p_org uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_defaults text[][] := array[
    array['RM','Raw Material','raw_material'],
    array['WIP','WIP','wip'],
    array['FG','Finished Goods','finished_goods'],
    array['SCRAP','Scrap','scrap'],
    array['QUAR','Rejected / Quarantine','quarantine']
  ];
  r text[];
begin
  foreach r slice 1 in array v_defaults loop
    insert into public.warehouses (organization_id, code, name, warehouse_type)
    values (p_org, r[1], r[2], r[3]::public.warehouse_type)
    on conflict (organization_id, code) do nothing;
  end loop;
end; $$;
revoke all on function public.seed_default_warehouses(uuid) from public, anon;
grant execute on function public.seed_default_warehouses(uuid) to authenticated;

-- Backfill for any org that already exists.
do $$
declare o record;
begin
  for o in select id from public.organizations loop
    perform public.seed_default_warehouses(o.id);
  end loop;
end $$;

-- Wire seeding into onboarding RPC (idempotent overwrite).
create or replace function public.create_organization_with_owner(
  p_name text,
  p_legal_name text default null,
  p_gstin text default null,
  p_phone text default null,
  p_email text default null,
  p_city text default null,
  p_state text default null,
  p_country text default 'India',
  p_plant_name text default null
) returns public.organizations
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org public.organizations;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.organizations (name, legal_name, gstin, phone, email, city, state, country, plant_name, created_by, updated_by)
  values (p_name, p_legal_name, p_gstin, p_phone, p_email, p_city, p_state, p_country, p_plant_name, v_uid, v_uid)
  returning * into v_org;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org.id, v_uid, 'owner');

  update public.profiles
     set default_organization_id = v_org.id, updated_at = now(), updated_by = v_uid
   where id = v_uid;

  perform public.seed_default_warehouses(v_org.id);

  return v_org;
end;
$$;
revoke all on function public.create_organization_with_owner(text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_organization_with_owner(text, text, text, text, text, text, text, text, text) to authenticated;

--------------------------------------------------------------------------------
-- 10. PO → JOB RPC + finished-good item auto-provisioning
--------------------------------------------------------------------------------
create or replace function public.ensure_finished_good_item(p_org uuid, p_part uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_item uuid;
  v_code text;
  v_name text;
  v_unit text;
begin
  select id into v_item from public.items
    where organization_id = p_org and part_id = p_part and item_type = 'finished_good' limit 1;
  if v_item is not null then return v_item; end if;

  select part_number, part_name, coalesce(unit, 'nos') into v_code, v_name, v_unit
    from public.parts where id = p_part and organization_id = p_org;
  if v_code is null then
    raise exception 'Part % not found for organization %', p_part, p_org;
  end if;

  insert into public.items (organization_id, code, name, item_type, unit, part_id)
  values (p_org, 'FG-' || v_code, v_name, 'finished_good', v_unit, p_part)
  on conflict (organization_id, code)
    do update set part_id = excluded.part_id, item_type = 'finished_good'
  returning id into v_item;
  return v_item;
end; $$;
revoke all on function public.ensure_finished_good_item(uuid, uuid) from public, anon;
grant execute on function public.ensure_finished_good_item(uuid, uuid) to authenticated;

create or replace function public.generate_job_from_po_item(
  p_po_item_id uuid,
  p_priority public.job_priority default 'medium',
  p_due_date date default null,
  p_notes text default null,
  p_default_operations text[] default array['Manufacturing']
) returns public.jobs
language plpgsql security definer set search_path = ''
as $$
declare
  v_item record;
  v_po record;
  v_pending numeric(14,4);
  v_job public.jobs;
  v_op text;
  v_seq int := 1;
begin
  select ci.*, cp.customer_id, cp.organization_id as po_org
    into v_item
    from public.customer_po_items ci
    join public.customer_pos cp on cp.id = ci.customer_po_id
   where ci.id = p_po_item_id;
  if v_item.id is null then
    raise exception 'Customer PO item not found';
  end if;
  if not (select private.is_org_member(v_item.organization_id)) then
    raise exception 'Not authorized for this organization';
  end if;

  v_pending := coalesce(v_item.quantity, 0) - coalesce(v_item.produced_quantity, 0);
  if v_pending <= 0 then
    raise exception 'Nothing left to produce on this PO item';
  end if;

  -- ensure finished-good item exists for this part
  perform public.ensure_finished_good_item(v_item.organization_id, v_item.part_id);

  insert into public.jobs (
    organization_id, customer_po_id, customer_po_item_id, customer_id,
    part_id, part_revision, quantity, priority, status, due_date, notes
  ) values (
    v_item.organization_id, v_item.customer_po_id, v_item.id, v_item.customer_id,
    v_item.part_id, v_item.part_revision, v_pending, coalesce(p_priority, 'medium'),
    'released', coalesce(p_due_date, (select delivery_date from public.customer_pos where id = v_item.customer_po_id)),
    p_notes
  ) returning * into v_job;

  -- default operations
  if p_default_operations is not null then
    foreach v_op in array p_default_operations loop
      insert into public.job_operations (
        organization_id, job_id, sequence, operation_name, planned_quantity, status
      ) values (
        v_job.organization_id, v_job.id, v_seq, v_op, v_job.quantity,
        case when v_seq = 1 then 'ready'::public.operation_status else 'pending'::public.operation_status end
      );
      v_seq := v_seq + 1;
    end loop;
  end if;

  -- roll up PO status
  update public.customer_pos
     set status = 'in_production', updated_at = now(), updated_by = (select auth.uid())
   where id = v_item.customer_po_id and status in ('draft','confirmed');

  insert into public.job_events (organization_id, job_id, event_type, actor_id, reason)
  values (v_job.organization_id, v_job.id, 'job_created', (select auth.uid()), 'From PO item');
  insert into public.job_events (organization_id, job_id, event_type, actor_id, reason)
  values (v_job.organization_id, v_job.id, 'job_released', (select auth.uid()), 'Auto-released on generation');

  return v_job;
end;
$$;
revoke all on function public.generate_job_from_po_item(uuid, public.job_priority, date, text, text[]) from public, anon;
grant execute on function public.generate_job_from_po_item(uuid, public.job_priority, date, text, text[]) to authenticated;

--------------------------------------------------------------------------------
-- 11. SHOP FLOOR RPCs (start/pause/resume/complete with event history)
--------------------------------------------------------------------------------
create or replace function private.load_op(p_op uuid)
returns public.job_operations language sql stable security definer set search_path = '' as $$
  select * from public.job_operations where id = p_op;
$$;

create or replace function public.job_operation_start(
  p_op uuid,
  p_machine uuid default null
) returns public.job_operations
language plpgsql security definer set search_path = '' as $$
declare v_op public.job_operations;
begin
  v_op := private.load_op(p_op);
  if v_op.id is null then raise exception 'Operation not found'; end if;
  if not (select private.is_org_member(v_op.organization_id)) then raise exception 'Forbidden'; end if;
  if v_op.status not in ('pending','ready','paused') then
    raise exception 'Cannot start operation in status %', v_op.status;
  end if;

  update public.job_operations
    set status = 'running',
        actual_start = coalesce(actual_start, now()),
        machine_id = coalesce(p_machine, machine_id),
        operator_id = coalesce(operator_id, (select auth.uid())),
        updated_at = now(),
        updated_by = (select auth.uid())
   where id = p_op
   returning * into v_op;

  update public.jobs
     set status = case when status = 'released' then 'in_progress'::public.job_status else status end,
         started_at = coalesce(started_at, now()),
         updated_at = now(),
         updated_by = (select auth.uid())
   where id = v_op.job_id;

  if v_op.machine_id is not null then
    update public.machines set status = 'running', updated_at = now(), updated_by = (select auth.uid())
     where id = v_op.machine_id;
  end if;

  insert into public.job_events (organization_id, job_id, job_operation_id, event_type, actor_id, meta)
  values (v_op.organization_id, v_op.job_id, v_op.id, 'operation_started', (select auth.uid()),
          jsonb_build_object('machine_id', v_op.machine_id));
  return v_op;
end; $$;
revoke all on function public.job_operation_start(uuid, uuid) from public, anon;
grant execute on function public.job_operation_start(uuid, uuid) to authenticated;

create or replace function public.job_operation_pause(p_op uuid, p_reason text default null)
returns public.job_operations language plpgsql security definer set search_path = '' as $$
declare v_op public.job_operations;
begin
  v_op := private.load_op(p_op);
  if v_op.id is null then raise exception 'Operation not found'; end if;
  if not (select private.is_org_member(v_op.organization_id)) then raise exception 'Forbidden'; end if;
  if v_op.status <> 'running' then raise exception 'Can only pause a running operation'; end if;

  update public.job_operations set status = 'paused', updated_at = now(), updated_by = (select auth.uid())
    where id = p_op returning * into v_op;

  if v_op.machine_id is not null then
    update public.machines set status = 'idle', updated_at = now(), updated_by = (select auth.uid())
      where id = v_op.machine_id;
  end if;

  insert into public.job_events (organization_id, job_id, job_operation_id, event_type, actor_id, reason)
  values (v_op.organization_id, v_op.job_id, v_op.id, 'operation_paused', (select auth.uid()), p_reason);
  return v_op;
end; $$;
revoke all on function public.job_operation_pause(uuid, text) from public, anon;
grant execute on function public.job_operation_pause(uuid, text) to authenticated;

create or replace function public.job_operation_resume(p_op uuid)
returns public.job_operations language plpgsql security definer set search_path = '' as $$
declare v_op public.job_operations;
begin
  v_op := private.load_op(p_op);
  if v_op.id is null then raise exception 'Operation not found'; end if;
  if not (select private.is_org_member(v_op.organization_id)) then raise exception 'Forbidden'; end if;
  if v_op.status <> 'paused' then raise exception 'Can only resume a paused operation'; end if;

  update public.job_operations set status = 'running', updated_at = now(), updated_by = (select auth.uid())
    where id = p_op returning * into v_op;

  if v_op.machine_id is not null then
    update public.machines set status = 'running', updated_at = now(), updated_by = (select auth.uid())
      where id = v_op.machine_id;
  end if;

  insert into public.job_events (organization_id, job_id, job_operation_id, event_type, actor_id)
  values (v_op.organization_id, v_op.job_id, v_op.id, 'operation_resumed', (select auth.uid()));
  return v_op;
end; $$;
revoke all on function public.job_operation_resume(uuid) from public, anon;
grant execute on function public.job_operation_resume(uuid) to authenticated;

-- Finish an operation. Records completed_qty, rejected_qty, rolls up to job.
-- Records a production_receipt inventory transaction when the LAST operation completes.
create or replace function public.job_operation_complete(
  p_op uuid,
  p_completed_qty numeric,
  p_rejected_qty numeric default 0,
  p_rework_qty numeric default 0,
  p_disposition public.disposition default null,
  p_reason text default null,
  p_fg_warehouse uuid default null
) returns public.job_operations
language plpgsql security definer set search_path = '' as $$
declare
  v_op public.job_operations;
  v_job public.jobs;
  v_is_last boolean;
  v_item uuid;
  v_fg_wh uuid;
begin
  v_op := private.load_op(p_op);
  if v_op.id is null then raise exception 'Operation not found'; end if;
  if not (select private.is_org_member(v_op.organization_id)) then raise exception 'Forbidden'; end if;
  if v_op.status not in ('running','paused','ready') then
    raise exception 'Cannot complete operation in status %', v_op.status;
  end if;
  if p_completed_qty is null or p_completed_qty < 0 then
    raise exception 'Completed quantity must be >= 0';
  end if;
  p_rejected_qty := coalesce(p_rejected_qty, 0);
  p_rework_qty := coalesce(p_rework_qty, 0);

  update public.job_operations
     set status = 'completed',
         actual_end = now(),
         completed_quantity = coalesce(completed_quantity,0) + p_completed_qty,
         rejected_quantity = coalesce(rejected_quantity,0) + p_rejected_qty,
         rework_quantity = coalesce(rework_quantity,0) + p_rework_qty,
         updated_at = now(),
         updated_by = (select auth.uid())
   where id = p_op returning * into v_op;

  -- roll up to job
  update public.jobs
     set completed_quantity = coalesce(completed_quantity,0) + p_completed_qty,
         rejected_quantity = coalesce(rejected_quantity,0) + p_rejected_qty,
         rework_quantity = coalesce(rework_quantity,0) + p_rework_qty,
         updated_at = now(),
         updated_by = (select auth.uid())
   where id = v_op.job_id returning * into v_job;

  -- free the machine
  if v_op.machine_id is not null then
    update public.machines set status = 'idle', updated_at = now(), updated_by = (select auth.uid())
     where id = v_op.machine_id;
  end if;

  -- move next operation to ready
  update public.job_operations
     set status = 'ready', updated_at = now(), updated_by = (select auth.uid())
   where job_id = v_op.job_id and status = 'pending' and sequence > v_op.sequence
     and sequence = (select min(sequence) from public.job_operations where job_id = v_op.job_id and status = 'pending' and sequence > v_op.sequence);

  select not exists (
    select 1 from public.job_operations
     where job_id = v_op.job_id and status <> 'completed'
  ) into v_is_last;

  if v_is_last then
    update public.jobs
       set status = 'completed', completed_at = now(),
           updated_at = now(), updated_by = (select auth.uid())
     where id = v_op.job_id
     returning * into v_job;

    -- Post finished goods to inventory as production_receipt (only good qty).
    if p_completed_qty > 0 then
      v_item := public.ensure_finished_good_item(v_job.organization_id, v_job.part_id);

      select coalesce(p_fg_warehouse, (select id from public.warehouses
        where organization_id = v_job.organization_id and warehouse_type = 'finished_goods' order by created_at limit 1))
        into v_fg_wh;

      if v_fg_wh is null then
        raise exception 'No Finished Goods warehouse found. Seed default warehouses first.';
      end if;

      insert into public.inventory_transactions (
        organization_id, txn_type, item_id, warehouse_id, quantity, uom,
        reference_type, reference_id, reference_number, reason, disposition, created_by
      ) values (
        v_job.organization_id, 'production_receipt', v_item, v_fg_wh, p_completed_qty,
        (select unit from public.items where id = v_item),
        'job', v_job.id, v_job.job_number, 'Production receipt on job completion', 'ok', (select auth.uid())
      );
    end if;

    -- Update PO item produced qty
    if v_job.customer_po_item_id is not null then
      update public.customer_po_items
         set produced_quantity = coalesce(produced_quantity,0) + p_completed_qty,
             updated_at = now(), updated_by = (select auth.uid())
       where id = v_job.customer_po_item_id;
    end if;
  end if;

  -- Event trail
  insert into public.job_events (
    organization_id, job_id, job_operation_id, event_type, actor_id,
    quantity_delta, rejected_delta, rework_delta, reason,
    meta
  ) values (
    v_op.organization_id, v_op.job_id, v_op.id, 'operation_completed', (select auth.uid()),
    p_completed_qty, p_rejected_qty, p_rework_qty, p_reason,
    jsonb_build_object('disposition', p_disposition)
  );

  if p_rejected_qty > 0 then
    insert into public.job_events (
      organization_id, job_id, job_operation_id, event_type, actor_id,
      rejected_delta, reason, meta
    ) values (
      v_op.organization_id, v_op.job_id, v_op.id, 'rejection_reported', (select auth.uid()),
      p_rejected_qty, p_reason, jsonb_build_object('disposition', p_disposition)
    );

    -- Optional: post scrap/quarantine inventory transaction for rejected qty (using WIP as source)
    if p_disposition in ('scrap','hold') then
      v_item := public.ensure_finished_good_item(v_op.organization_id, v_job.part_id);
      declare
        v_scrap_wh uuid;
      begin
        select id into v_scrap_wh from public.warehouses
         where organization_id = v_op.organization_id
           and warehouse_type = (case when p_disposition = 'scrap' then 'scrap'::public.warehouse_type
                                       else 'quarantine'::public.warehouse_type end)
         order by created_at limit 1;
        if v_scrap_wh is not null then
          insert into public.inventory_transactions (
            organization_id, txn_type, item_id, warehouse_id, quantity, uom,
            reference_type, reference_id, reference_number, reason, disposition, created_by
          ) values (
            v_op.organization_id, (case when p_disposition = 'scrap' then 'scrap' else 'production_receipt' end)::public.inventory_transaction_type,
            v_item, v_scrap_wh, p_rejected_qty,
            (select unit from public.items where id = v_item),
            'job_operation', v_op.id, v_op.operation_number, coalesce(p_reason,'Rejected pieces'),
            p_disposition, (select auth.uid())
          );
        end if;
      end;
    end if;
  end if;

  return v_op;
end; $$;
revoke all on function public.job_operation_complete(uuid, numeric, numeric, numeric, public.disposition, text, uuid) from public, anon;
grant execute on function public.job_operation_complete(uuid, numeric, numeric, numeric, public.disposition, text, uuid) to authenticated;

--------------------------------------------------------------------------------
-- 12. RLS + POLICIES
--------------------------------------------------------------------------------
alter table public.work_centers enable row level security;
alter table public.machines enable row level security;
alter table public.warehouses enable row level security;
alter table public.items enable row level security;
alter table public.customer_pos enable row level security;
alter table public.customer_po_items enable row level security;
alter table public.delivery_schedules enable row level security;
alter table public.jobs enable row level security;
alter table public.job_operations enable row level security;
alter table public.job_cards enable row level security;
alter table public.job_events enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.number_sequences enable row level security;

grant select, insert, update, delete on
  public.work_centers, public.machines, public.warehouses, public.items,
  public.customer_pos, public.customer_po_items, public.delivery_schedules,
  public.jobs, public.job_operations, public.job_cards
to authenticated;
-- job_events / inventory_transactions: SELECT + INSERT only (immutability enforced by trigger)
grant select, insert on public.job_events, public.inventory_transactions to authenticated;
grant select on public.number_sequences to authenticated;

-- Standard CRUD policy factory
do $$
declare t text;
begin
  foreach t in array array['work_centers','machines','warehouses','items',
                           'customer_pos','customer_po_items','delivery_schedules',
                           'jobs','job_operations','job_cards']
  loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('create policy %I_select on public.%I for select to authenticated using ((select private.is_org_member(organization_id)))', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check ((select private.is_org_member(organization_id)))', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('create policy %I_update on public.%I for update to authenticated using ((select private.is_org_member(organization_id))) with check ((select private.is_org_member(organization_id)))', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format('create policy %I_delete on public.%I for delete to authenticated using ((select private.is_org_member(organization_id)))', t, t);
  end loop;
end $$;

-- job_events: select + insert only
drop policy if exists job_events_select on public.job_events;
create policy job_events_select on public.job_events for select to authenticated
  using ((select private.is_org_member(organization_id)));
drop policy if exists job_events_insert on public.job_events;
create policy job_events_insert on public.job_events for insert to authenticated
  with check ((select private.is_org_member(organization_id)));

-- inventory_transactions: select + insert only (updates/deletes blocked by trigger too)
drop policy if exists inv_txn_select on public.inventory_transactions;
create policy inv_txn_select on public.inventory_transactions for select to authenticated
  using ((select private.is_org_member(organization_id)));
drop policy if exists inv_txn_insert on public.inventory_transactions;
create policy inv_txn_insert on public.inventory_transactions for insert to authenticated
  with check ((select private.is_org_member(organization_id)));

-- number_sequences: read-only for members (writes only via next_number RPC via SECURITY DEFINER)
drop policy if exists num_seq_select on public.number_sequences;
create policy num_seq_select on public.number_sequences for select to authenticated
  using ((select private.is_org_member(organization_id)));

--------------------------------------------------------------------------------
-- 13. REALTIME publication (jobs, job_operations, machines)
--------------------------------------------------------------------------------
do $$ begin
  begin
    alter publication supabase_realtime add table public.jobs;
  exception when duplicate_object then null; when others then null; end;
  begin
    alter publication supabase_realtime add table public.job_operations;
  exception when duplicate_object then null; when others then null; end;
  begin
    alter publication supabase_realtime add table public.machines;
  exception when duplicate_object then null; when others then null; end;
end $$;

--------------------------------------------------------------------------------
-- End of Phase 4-A migration
--------------------------------------------------------------------------------
