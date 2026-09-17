# Precise Industries — Manufacturing ERP · PRD

## Original problem statement
Build a manufacturing ERP in 6 phases. Phase 1 & 2 are FRONTEND-ONLY (no backend, no Supabase, no Cloudinary, no auth). All data must be realistic manufacturing mock data. Deliver the complete visual language, sidebar navigation, dashboard, CRM, RFQ, Quotation, Customer PO, Jobs, Part Master, BOM, Routing, Production Planning, Shop Floor, Inventory, Purchase, Job Work, Quality, Machines, Maintenance, Tool Management, Dispatch, Finance UI, Reports, Documents, and Settings screens.

## Brand
- **Company / product name in the ERP shell: Precise Industries**

## User personas
- Factory owner / MD
- Production manager
- Shop-floor supervisor / operator
- Purchase & inventory staff
- Quality inspector
- Sales / CRM user

## Core requirements (static)
- Collapsible left sidebar with 23+ modules grouped into Workspace / Customer flow / Factory floor / Materials / Control center.
- Topbar with breadcrumbs, global search, notifications, theme toggle, profile.
- Light + dark theme.
- Responsive shell with a mobile drawer.
- Reusable module view: title, toolbar (search + filter + columns), summary strip, dense table with status badges, pagination.
- Dashboard with 8 KPIs, production trend chart, machine utilization donut, today's jobs table, material shortages, upcoming deliveries.

## What's implemented (as of 2026-02)
- Full application shell with brand "Precise Industries" (renamed from ForgeFlow Manufacturing on 2026-02).
- Sidebar navigation covering all Phase 1 & 2 modules.
- Interactive dashboard with mock KPIs, mock production trend + donut chart, mock jobs table, mock shortage & delivery rows.
- Generic ModuleView renders realistic mock records for every Phase 1 & 2 module (CRM, RFQ, Quotation, Customer POs, Jobs, Planning, Shop Floor, Work Centers, Part Master, BOM, Inventory, Purchase, Job Work, Quality, Machines, Maintenance, Tools, Dispatch, Finance, Reports, Documents, Settings).
- Global search with jump-to-module results.
- Toast feedback wired on every interactive button (company selector, profile, notifications, filters, columns, row open, pagination, etc.).
- Sidebar collapse + mobile drawer + light/dark theme toggle.
- Frontend testing agent passed 100% (iteration 3).

## Prioritized backlog
### P0 (Phase 3 — pending)
- Database schema (MongoDB) for all 23 modules.
- Authentication (JWT or Emergent Google Auth — user to choose in Phase 3).
- FastAPI CRUD endpoints per module.
- Replace mock data with real API calls.

### P1
- Deep per-module screens: quotation builder with cost breakdown, RFQ wizard, drag-and-drop routing builder, shop-floor operator kiosk, planning gantt, quality inspection forms with tolerances, delivery challan builder, part-revision history UI.
- Refactor `App.js` into per-module page components + a shared layout.
- Error boundary + global loading skeletons.

### P2
- Tally accounting integration section.
- Document / drawing upload (object storage).
- Reports engine + export.
- Role & permission matrix UI.
- Notification center with real events.

## Next tasks
1. Confirm scope and integrations for Phase 3 with the user (auth method, database, storage).
2. Refactor `/app/frontend/src/App.js` into `pages/`, `components/`, `data/` folders before wiring the backend.
3. Design Mongo document models per module.
4. Build FastAPI routers module-by-module.
