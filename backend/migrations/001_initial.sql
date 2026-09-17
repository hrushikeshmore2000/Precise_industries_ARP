-- Precise Industries — Phase 3 initial migration
-- Multi-tenant + Supabase Auth + RLS
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

--------------------------------------------------------------------------------
-- 1. ENUMS
--------------------------------------------------------------------------------
do $$ begin
  create type public.organization_role as enum (
    'owner','admin','sales','purchase','production_manager','supervisor',
    'operator','quality','store','accounts','viewer'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_status as enum (
    'new','contacted','rfq_received','quotation_sent','negotiation','won','lost'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.customer_status as enum ('active','inactive','archived');
exception when duplicate_object then null; end $$;

--------------------------------------------------------------------------------
-- 2. AUDIT TRIGGER FUNCTION (no table dependencies)
--------------------------------------------------------------------------------
create or replace function public.set_audit_columns()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    new.updated_at := coalesce(new.updated_at, now());
    new.created_by := coalesce(new.created_by, (select auth.uid()));
    new.updated_by := coalesce(new.updated_by, (select auth.uid()));
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.updated_at := now();
    new.updated_by := (select auth.uid());
  end if;
  return new;
end; $$;

--------------------------------------------------------------------------------
-- 3. CORE TABLES: organizations / members / profiles
--------------------------------------------------------------------------------
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  legal_name text,
  gstin text,
  phone text,
  email text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  country text default 'India',
  postal_code text,
  plant_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index if not exists idx_org_members_user on public.organization_members(user_id);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  avatar_url text,
  default_organization_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

drop trigger if exists organizations_audit on public.organizations;
create trigger organizations_audit before insert or update on public.organizations
for each row execute function public.set_audit_columns();

drop trigger if exists profiles_audit on public.profiles;
create trigger profiles_audit before insert or update on public.profiles
for each row execute function public.set_audit_columns();

--------------------------------------------------------------------------------
-- 4. BUSINESS TABLES (Phase-3 smart slice: customers, leads, parts)
--------------------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text,
  name text not null,
  legal_name text,
  gstin text,
  industry text,
  phone text,
  email text,
  website text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  country text default 'India',
  postal_code text,
  payment_terms text,
  status public.customer_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);
create index if not exists idx_customers_org on public.customers(organization_id);
create index if not exists idx_customers_name on public.customers(organization_id, name);

create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  designation text,
  phone text,
  email text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);
create index if not exists idx_contacts_customer on public.customer_contacts(customer_id);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text,
  company_name text not null,
  contact_name text,
  phone text,
  email text,
  source text,
  status public.lead_status not null default 'new',
  estimated_value numeric(14,2),
  expected_close_date date,
  assigned_to uuid references auth.users(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);
create index if not exists idx_leads_org on public.leads(organization_id);
create index if not exists idx_leads_status on public.leads(organization_id, status);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null,   -- 'lead' | 'customer' | ...
  entity_id uuid not null,
  activity_type text not null, -- 'call' | 'email' | 'meeting' | 'note'
  subject text,
  body text,
  scheduled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);
create index if not exists idx_activities_entity on public.activities(organization_id, entity_type, entity_id);

create table if not exists public.parts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  part_number text not null,
  part_name text not null,
  customer_part_number text,
  customer_id uuid references public.customers(id) on delete set null,
  material text,
  material_grade text,
  raw_material_size text,
  unit text default 'nos',
  weight_kg numeric(12,4),
  standard_cost numeric(14,2),
  selling_price numeric(14,2),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (organization_id, part_number)
);
create index if not exists idx_parts_org on public.parts(organization_id);
create index if not exists idx_parts_customer on public.parts(customer_id);

create table if not exists public.part_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  part_id uuid not null references public.parts(id) on delete cascade,
  revision text not null,
  drawing_url text,
  change_notes text,
  effective_date date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  unique (part_id, revision)
);
create index if not exists idx_part_revs_part on public.part_revisions(part_id);

--------------------------------------------------------------------------------
-- 5. AUDIT TRIGGERS on business tables
--------------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['customers','customer_contacts','leads','activities','parts','part_revisions']
  loop
    execute format('drop trigger if exists %I_audit on public.%I', t, t);
    execute format('create trigger %I_audit before insert or update on public.%I for each row execute function public.set_audit_columns()', t, t);
  end loop;
end $$;

--------------------------------------------------------------------------------
-- 6. HELPER: private schema + is_org_member / has_org_role (SECURITY DEFINER)
--    (Created AFTER business tables exist so `language sql` validation passes.)
--------------------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_org_member(org_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org_id and m.user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_org_member(uuid) from public;
grant execute on function private.is_org_member(uuid) to authenticated;

create or replace function private.has_org_role(org_id uuid, roles public.organization_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = (select auth.uid())
      and m.role = any(roles)
  );
$$;
revoke all on function private.has_org_role(uuid, public.organization_role[]) from public;
grant execute on function private.has_org_role(uuid, public.organization_role[]) to authenticated;

--------------------------------------------------------------------------------
-- 7. RLS: enable on all tenant tables + policies
--------------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.leads enable row level security;
alter table public.activities enable row level security;
alter table public.parts enable row level security;
alter table public.part_revisions enable row level security;

grant select, insert, update, delete on
  public.organizations, public.organization_members, public.profiles,
  public.customers, public.customer_contacts, public.leads, public.activities,
  public.parts, public.part_revisions
to authenticated;

-- organizations: members can read their org; any authenticated user may create a new org
-- (initial owner membership is created inside create_organization_with_owner() RPC).
drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations for select to authenticated
  using ((select private.is_org_member(id)));

drop policy if exists organizations_insert on public.organizations;
create policy organizations_insert on public.organizations for insert to authenticated
  with check ((select auth.uid()) is not null);

drop policy if exists organizations_update on public.organizations;
create policy organizations_update on public.organizations for update to authenticated
  using ((select private.has_org_role(id, array['owner','admin']::public.organization_role[])))
  with check ((select private.has_org_role(id, array['owner','admin']::public.organization_role[])));

drop policy if exists organizations_delete on public.organizations;
create policy organizations_delete on public.organizations for delete to authenticated
  using ((select private.has_org_role(id, array['owner']::public.organization_role[])));

-- organization_members: user can see memberships in orgs where they are a member (and their own row).
drop policy if exists org_members_select on public.organization_members;
create policy org_members_select on public.organization_members for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_org_member(organization_id)));

-- Owners/admins can add members. The initial owner row is created via the
-- create_organization_with_owner() SECURITY DEFINER RPC, so no self-insert path is exposed here.
drop policy if exists org_members_insert on public.organization_members;
create policy org_members_insert on public.organization_members for insert to authenticated
  with check (
    (select private.has_org_role(organization_id, array['owner','admin']::public.organization_role[]))
  );

drop policy if exists org_members_update on public.organization_members;
create policy org_members_update on public.organization_members for update to authenticated
  using ((select private.has_org_role(organization_id, array['owner','admin']::public.organization_role[])))
  with check ((select private.has_org_role(organization_id, array['owner','admin']::public.organization_role[])));

drop policy if exists org_members_delete on public.organization_members;
create policy org_members_delete on public.organization_members for delete to authenticated
  using ((select private.has_org_role(organization_id, array['owner']::public.organization_role[])) or user_id = (select auth.uid()));

-- profiles: readable by self AND by org co-members; writable by self.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid())
    or exists (
      select 1 from public.organization_members m1
      join public.organization_members m2 on m1.organization_id = m2.organization_id
      where m1.user_id = (select auth.uid()) and m2.user_id = public.profiles.id
    ));

drop policy if exists profiles_upsert_self on public.profiles;
create policy profiles_upsert_self on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Business-table policy factory (via DO block).
do $$
declare t text;
begin
  foreach t in array array['customers','customer_contacts','leads','activities','parts','part_revisions']
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

--------------------------------------------------------------------------------
-- 8. AUTH: create profile on new user
--------------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, first_name, last_name, created_by, updated_by)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.id, new.id
  ) on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

--------------------------------------------------------------------------------
-- 9. ONBOARDING RPC: create org + owner membership atomically
--------------------------------------------------------------------------------
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

  return v_org;
end;
$$;
revoke all on function public.create_organization_with_owner(text, text, text, text, text, text, text, text, text) from public;
revoke all on function public.create_organization_with_owner(text, text, text, text, text, text, text, text, text) from anon;
grant execute on function public.create_organization_with_owner(text, text, text, text, text, text, text, text, text) to authenticated;

--------------------------------------------------------------------------------
-- End of migration
--------------------------------------------------------------------------------
