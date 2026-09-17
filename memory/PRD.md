# ForgeFlow Manufacturing ERP — Product Requirements Document

## Original problem statement
Build Phase 1 and Phase 2 of a manufacturing ERP as a complete frontend-only experience. Do not connect Supabase, authentication backend, Cloudinary, database, or API endpoints. Use realistic manufacturing mock data. Make every major ERP module visually navigable for factory owners, production managers, and shop-floor supervisors.

## Architecture decisions
- React frontend with a single responsive ERP application shell and client-side module state.
- Static mock data powers dashboard KPIs, charts, tables, statuses, search, and feedback states.
- No backend, API, authentication, persistence, or external integration is included in this phase.
- Reusable navigation, KPI, table, badge, toolbar, toast, and responsive drawer patterns keep modules consistent.
- ForgeFlow Manufacturing is the working brand because no company name was provided.

## User personas
- Factory owner / management: needs high-level production, utilization, delivery, and receivables visibility.
- Production manager: needs jobs, planning, material shortages, machine status, and quality signals.
- Shop-floor supervisor: needs quick access to work orders, shop-floor controls, machines, maintenance, and material flow.

## Core requirements (static)
- Responsive shell with collapsible sidebar, mobile drawer, top bar, breadcrumbs, search, notifications, quick create, company selector, profile, and theme toggle.
- Dashboard with KPI cards, production trend, machine utilization, production jobs, shortages, and upcoming deliveries.
- Navigable, non-blank screens for CRM, RFQs, quotations, customer POs, jobs, planning, shop floor, part master, BOM/routing, inventory, purchasing, job work, quality, machines, maintenance, tools, dispatch, finance, reports, and settings.
- Dense readable tables with filters, search, column action, pagination, status badges, responsive overflow handling, and mock feedback.

## What's implemented

### 2026-09-17
- Replaced the starter splash screen with the ForgeFlow Manufacturing ERP shell.
- Added all Phase 1 and Phase 2 module navigation entries and functional module views.
- Added management dashboard with eight KPIs, production chart, utilization donut, production table, shortages, and deliveries.
- Added static realistic mock manufacturing data, statuses, progress indicators, responsive tables, search navigation, toast feedback, theme toggle, sidebar collapse, and mobile drawer.
- Verified with production build and browser testing: dashboard, all 20 module views, key interactions, mobile layout, and no horizontal overflow passed.

## Prioritized backlog
- P0: Connect persistent data models and API CRUD for records, jobs, inventory, quality, and finance.
- P0: Add authentication, role-based access, and company/plant data boundaries.
- P1: Replace module summary tables with full create/edit/detail workflows and printable documents.
- P1: Add real-time shop-floor job status, machine telemetry, and material requests.
- P2: Add file storage for drawings, attachments, and document revisions.
- P2: Add accounting integration and production analytics exports.

## Remaining next tasks
- Phase 3: establish backend schema and API contracts without changing the existing visual language.
- Introduce real data behind dashboard and module tables while preserving the mock-data fallback for demos.
- Add audit history, permissions, and document workflows after authentication is defined.