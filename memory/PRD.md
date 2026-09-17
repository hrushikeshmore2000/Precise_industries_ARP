# Precise Industries — Manufacturing ERP · PRD

## Original problem statement
Build a manufacturing ERP in 6 phases. Phases 1–2 delivered a full mock frontend; Phase 3 introduces Supabase (Postgres + Auth + Row Level Security) and connects the first slice of real CRUD modules; Phases 4–6 will add manufacturing logic, image/document storage (Cloudinary) and production deployment.

## Brand
- **Company / product name in the ERP shell: Precise Industries**

## User personas
- Factory owner / MD
- Production manager
- Shop-floor supervisor / operator
- Purchase & inventory staff
- Quality inspector
- Sales / CRM user

## Core requirements
- Multi-tenant SaaS: every business row belongs to exactly one organization; RLS blocks cross-org access.
- 11 organizational roles: owner, admin, sales, purchase, production_manager, supervisor, operator, quality, store, accounts, viewer.
- Auth: signup, login, logout, forgot-password, reset-password, session persistence, protected routes.
- All schema created via versioned migrations in `/app/backend/migrations/`.
- Audit columns (created_at, updated_at, created_by, updated_by) on every business table.

## Architecture
- **Frontend**: React (Create React App) + shadcn/ui + Sonner toasts. State-based navigation gated behind `AuthProvider`.
- **Data plane**: Frontend talks directly to Supabase via `@supabase/supabase-js`. RLS enforces multi-tenant isolation. Migrations run from Supabase SQL Editor (or via psql if DB password is shared).
- **FastAPI backend**: retained but unused for Phase-3 CRUD; reserved for future business logic / integrations.

## What's implemented
### Phase 1 & 2 (Feb 2026)
- Full shell rebranded "Precise Industries" with sidebar covering 23+ modules.
- Responsive across desktop, laptop, tablet portrait/landscape, and mobile phones.
- Sticky sidebar & topbar with only-main scroll behaviour.
- Mock data for every module page.

### Phase 3 · Smart slice (Feb 2026)
- Migration `/app/backend/migrations/001_initial.sql` applied to real Supabase (idempotent, verified on Postgres 15).
- Tables: organizations, organization_members, profiles, customers, customer_contacts, leads, activities, parts, part_revisions.
- RLS on all 9 tables. Business-table policies keyed on `private.is_org_member(organization_id)`; org-member insert restricted to owner/admin (initial owner row created via `create_organization_with_owner()` SECURITY DEFINER RPC).
- Audit trigger `set_audit_columns()` on every table.
- Auth trigger `handle_new_user()` auto-creates a profile row on signup.
- Frontend:
  - `AuthProvider` — session + org list + active-org state.
  - `AuthScreens` — login / signup / forgot-password / reset-password with data-testids.
  - `Onboarding` — company creation form via RPC.
  - `CustomersModule`, `LeadsModule`, `PartsModule` — real CRUD with search, filter, pagination, and a shared right-side `DrawerForm` editor.
  - `App.js` gates: loading splash → auth → onboarding → shell. Company selector and profile menu are real.
- Verified E2E by testing agent (iteration_6): signup → onboarding → CRUD → logout, cross-org RLS isolation (user2 sees 0 rows across all modules).

## Prioritized backlog
### P0 (Phase 3 remaining)
- Wire remaining Phase-3 CRUD: RFQs, Quotations, Customer POs (tables + policies + UI).
- Activity log / recent-events feed backed by `activities` table.
- Role-aware UI (hide write buttons for viewer/operator).

### P1 (Phase 4 — manufacturing)
- Jobs / job_operations / job_cards tables + shop-floor operator screen wiring.
- Production planning, machines, work_centers real tables.
- BOM + routing.
- Quality inspections + NCR + CAPA.
- Dispatch + invoicing tables.

### P2
- Cloudinary integration for drawings, part images, GRN photos (Phase 5).
- Full-text search across modules.
- Realtime subscriptions on jobs/inventory.
- Notifications table + in-app notification center.
- Tally integration.

### P3 (Phase 6)
- Enable real email verification (currently OFF for dev).
- Vercel deployment + custom domain + SSL.
- Rate limiting / brute-force protection on auth.

## Next tasks
1. Continue Phase 3: add RFQ / Quotation / Customer PO CRUD.
2. Ship role-based UI gating.
3. Start Phase 4 manufacturing tables once P0 slice is signed off.
