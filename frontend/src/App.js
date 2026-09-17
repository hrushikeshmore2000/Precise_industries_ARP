import { useMemo, useState, useEffect } from "react";
import "@/App.css";
import {
  Bell, Box, BriefcaseBusiness, CalendarDays, ChevronDown, ChevronLeft, ChevronRight,
  CircleAlert, ClipboardCheck, Clock3, Factory, FileText, Gauge, Hammer, LayoutDashboard,
  LogOut, Menu, Moon, Package, PanelLeftClose, Plus, Search, Settings, ShoppingCart,
  Sun, Truck, Users, UserPlus, Wrench, X
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { useAuth } from "./auth/AuthProvider";
import { supabase } from "./lib/supabase";
import AuthScreens from "./pages/AuthScreens";
import Onboarding from "./pages/Onboarding";
import CustomersModule from "./modules/CustomersModule";
import LeadsModule from "./modules/LeadsModule";
import PartsModule from "./modules/PartsModule";
import WorkCentersModule from "./modules/WorkCentersModule";
import MachinesModule from "./modules/MachinesModule";
import CustomerPOsModule from "./modules/CustomerPOsModule";
import JobsModule from "./modules/JobsModule";
import ShopFloorModule from "./modules/ShopFloorModule";
import InventoryModule from "./modules/InventoryModule";

const sections = [
  { label: "Workspace", items: [{ id: "dashboard", name: "Dashboard", icon: LayoutDashboard }] },
  { label: "Customer flow", items: [
    { id: "customers", name: "Customers", icon: Users, live: true },
    { id: "leads", name: "Leads & Follow-ups", icon: UserPlus, live: true },
    { id: "rfqs", name: "RFQs", icon: FileText },
    { id: "quotations", name: "Quotations", icon: BriefcaseBusiness },
    { id: "customer-pos", name: "Customer POs & Sales Orders", icon: ClipboardCheck, live: true },
  ]},
  { label: "Factory floor", items: [
    { id: "jobs", name: "Jobs, Work Orders & Job Cards", icon: Hammer, live: true },
    { id: "planning", name: "Production Planning", icon: CalendarDays },
    { id: "shop-floor", name: "Shop Floor Controls", icon: Gauge, live: true },
    { id: "work-centers", name: "Work Centers", icon: Factory, live: true },
    { id: "machines", name: "Machines", icon: Factory, live: true },
    { id: "maintenance", name: "Maintenance", icon: Wrench },
  ]},
  { label: "Materials", items: [
    { id: "parts", name: "Part Master", icon: Box, live: true },
    { id: "bom", name: "BOM & Routing", icon: Package },
    { id: "inventory", name: "Inventory · Items, RM, FG & WIP", icon: Package, live: true },
    { id: "purchase", name: "Purchase · Suppliers, RFQs & GRN", icon: ShoppingCart },
    { id: "job-work", name: "Job Work / Subcontracting", icon: Truck },
    { id: "tools", name: "Tool Management", icon: Wrench },
  ]},
  { label: "Control center", items: [
    { id: "quality", name: "Quality · NCR & CAPA", icon: ClipboardCheck },
    { id: "dispatch", name: "Dispatch", icon: Truck },
    { id: "finance", name: "Finance · Invoices & Receivables", icon: BriefcaseBusiness },
    { id: "reports", name: "Reports", icon: FileText },
    { id: "documents", name: "Documents", icon: FileText },
    { id: "settings", name: "Settings", icon: Settings },
  ]},
];
const allItems = sections.flatMap(s => s.items);
const kpis = [
  { label: "Jobs running", value: "24", delta: "+8.2%", tone: "blue", icon: Hammer },
  { label: "Jobs delayed", value: "07", delta: "Needs attention", tone: "amber", icon: Clock3 },
  { label: "Machines running", value: "38 / 42", delta: "90.4% online", tone: "green", icon: Factory },
  { label: "Machines down", value: "04", delta: "2 critical", tone: "red", icon: CircleAlert },
  { label: "Dispatches today", value: "18", delta: "6 pending", tone: "blue", icon: Truck },
  { label: "Material shortages", value: "12", delta: "-3 this week", tone: "amber", icon: Package },
  { label: "QC rejections", value: "1.8%", delta: "Within target", tone: "green", icon: ClipboardCheck },
  { label: "Receivables", value: "₹42.8L", delta: "14 invoices due", tone: "red", icon: BriefcaseBusiness },
];
const jobs = [
  { id: "JOB-2026-00124", customer: "ABC Auto Components", part: "Housing-284", operation: "VMC-2", qty: "320 / 500", due: "Today", status: "Delayed", reason: "Tool unavailable" },
  { id: "JOB-2026-00125", customer: "Nexon Industrial", part: "Flange-118", operation: "CNC-4", qty: "180 / 250", due: "12 Mar", status: "In progress", reason: "—" },
  { id: "JOB-2026-00121", customer: "Vertex Mobility", part: "Bracket-1047", operation: "Grinding-1", qty: "800 / 800", due: "12 Mar", status: "QC pending", reason: "Final inspection" },
  { id: "JOB-2026-00119", customer: "Atlas Hydraulics", part: "Valve body", operation: "CNC-2", qty: "120 / 120", due: "13 Mar", status: "Ready to dispatch", reason: "—" },
];
const moduleData = {
  rfqs: ["RFQ-2026-0042", "RFQ-2026-0041", "RFQ-2026-0039", "RFQ-2026-0037"],
  quotations: ["QT-2026-0108 · Housing-284", "QT-2026-0107 · Flange-118", "QT-2026-0102 · Bracket-1047"],
  "customer-pos": ["PO-AC-4821", "PO-NI-3190", "PO-VM-0881"],
  jobs: jobs.map(j => j.id),
  planning: ["VMC-2 / JOB-00124", "CNC-4 / JOB-00125", "Grinding-1 / JOB-00121"],
  "shop-floor": ["VMC-2 · Housing-284", "CNC-4 · Flange-118"],
  "work-centers": ["WC-01 · CNC Cell", "WC-02 · Finishing Cell"],
  bom: ["BOM-HSG-0284 · Rev C", "Routing-BRK-1047 · Rev B"],
  inventory: ["RM-SS304-12 · Stainless steel", "FG-HSG-0284 · Finished housing", "WIP-BRK-1047 · Bracket"],
  purchase: ["PRFQ-2026-0087", "PO-2026-0134", "GRN-2026-0098"],
  "job-work": ["JW-2026-0018 · Heat treatment", "JW-2026-0015 · Plating"],
  quality: ["NCR-2026-004 · Housing-284", "INS-2026-018 · Final inspection", "CAPA-2026-002 · Rework"],
  machines: ["VMC-02 · Makino PS95", "CNC-04 · Haas ST-20", "GRD-01 · Micromatic"],
  maintenance: ["BRK-2026-012 · VMC-02", "PM-2026-031 · CNC-04"],
  tools: ["TL-0421 · Carbide insert", "FX-0098 · Housing fixture"],
  dispatch: ["DSP-2026-0048 · ABC Auto", "DSP-2026-0047 · Vertex Mobility"],
  finance: ["INV-2026-0088 · ₹4,82,000", "INV-2026-0081 · ₹2,16,400"],
  reports: ["Production efficiency", "Machine utilization", "On-time delivery", "Job profitability"],
  documents: ["DWG-HSG-0284 · Drawing Rev C", "QUO-2026-0108 · Printable quotation"],
  settings: ["Company profile", "Plants & departments", "Roles & permissions"],
};

function Badge({ children }) {
  return <span data-testid={`status-${String(children).toLowerCase().replaceAll(" ", "-")}`} className={`badge ${String(children).toLowerCase().replace(" ", "-")}`}>{children}</span>;
}

function Dashboard({ onNavigate, greetingName }) {
  return <>
    <div className="page-title">
      <div>
        <div className="eyebrow">Monday · 09 March 2026</div>
        <h1 data-testid="dashboard-title">Good morning{greetingName ? `, ${greetingName}` : ""}</h1>
        <p>Here's the pulse of your manufacturing operations.</p>
      </div>
      <button className="primary-btn" data-testid="quick-create-dashboard" onClick={() => toast.success("Quick create is ready")}><Plus size={16}/> Quick create</button>
    </div>
    <div className="kpi-grid">{kpis.map(({ label, value, delta, tone, icon: Icon }) => (
      <div className="kpi" data-testid={`kpi-${label.toLowerCase().replaceAll(" ", "-")}`} key={label}>
        <div className={`kpi-icon ${tone}`}><Icon size={17}/></div>
        <div className="kpi-label">{label}<span className="more">···</span></div>
        <strong>{value}</strong>
        <small className={tone === "red" ? "negative" : tone === "green" ? "positive" : ""}>{delta}</small>
      </div>
    ))}</div>
    <div className="content-grid">
      <section className="panel trend-panel">
        <div className="panel-head">
          <div><h2>Production trend</h2><span className="muted">Completed pieces · last 7 days</span></div>
          <button className="select-btn" data-testid="production-period-filter">This week <ChevronDown size={14}/></button>
        </div>
        <div className="chart">
          <div className="chart-y"><span>2.4k</span><span>1.8k</span><span>1.2k</span><span>600</span><span>0</span></div>
          <div className="chart-area">
            <div className="grid-lines"/>
            <svg viewBox="0 0 650 210" preserveAspectRatio="none">
              <path d="M0 166 C55 145, 76 152, 108 125 S175 151, 214 111 S290 98, 322 112 S395 76, 432 92 S495 53, 530 77 S602 48, 650 32" fill="none" stroke="#0284c7" strokeWidth="3"/>
              <path d="M0 166 C55 145, 76 152, 108 125 S175 151, 214 111 S290 98, 322 112 S395 76, 432 92 S495 53, 530 77 S602 48, 650 32 V210 H0Z" fill="url(#area)" opacity=".35"/>
              <defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#38bdf8"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></linearGradient></defs>
            </svg>
            <div className="chart-x"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
          </div>
        </div>
      </section>
      <section className="panel utilization">
        <div className="panel-head"><div><h2>Machine utilization</h2><span className="muted">Live availability</span></div><button className="icon-btn" data-testid="machine-utilization-menu">···</button></div>
        <div className="donut-wrap">
          <div className="donut"><b>90.4%</b><span>utilized</span></div>
          <div className="legend">
            <span><i className="dot green-dot"/>Running <b>38</b></span>
            <span><i className="dot amber-dot"/>Idle <b>02</b></span>
            <span><i className="dot red-dot"/>Down <b>02</b></span>
          </div>
        </div>
      </section>
    </div>
    <section className="panel table-panel">
      <div className="panel-head">
        <div><h2>Today's production</h2><span className="muted">4 jobs need your attention</span></div>
        <button className="text-btn" data-testid="view-all-jobs" onClick={() => onNavigate("jobs")}>View all jobs <ChevronRight size={15}/></button>
      </div>
      <JobTable/>
    </section>
    <div className="lower-grid">
      <section className="panel list-panel">
        <div className="panel-head"><h2>Material shortages</h2><button className="text-btn" data-testid="view-inventory-shortages" onClick={() => onNavigate("inventory")}>Open inventory</button></div>
        {["SS 304 · Ø42 round bar", "Carbide insert · CNMG 12", "Aluminium 6061 · 3mm sheet"].map((x, i) => (
          <div className="alert-row" data-testid={`shortage-row-${i}`} key={x}>
            <span className="alert-mark">!</span>
            <div><b>{x}</b><small>{["Required 180 kg · Available 96 kg", "Required 48 pcs · Available 12 pcs", "Required 42 sheets · Available 16 sheets"][i]}</small></div>
            <Badge>{i === 1 ? "Critical" : "Shortage"}</Badge>
          </div>
        ))}
      </section>
      <section className="panel list-panel">
        <div className="panel-head"><h2>Upcoming deliveries</h2><button className="text-btn" data-testid="view-dispatch" onClick={() => onNavigate("dispatch")}>Dispatch board</button></div>
        {["ABC Auto Components", "Vertex Mobility", "Nexon Industrial"].map((x, i) => (
          <div className="delivery-row" data-testid={`delivery-row-${i}`} key={x}>
            <div className="date-box"><b>{["10", "11", "12"][i]}</b><small>MAR</small></div>
            <div><b>{x}</b><small>{["2 jobs · 820 pcs", "1 job · 300 pcs", "4 jobs · 1,240 pcs"][i]}</small></div>
            <span className="muted">{i === 0 ? "Tomorrow" : `In ${i + 1} days`}</span>
          </div>
        ))}
      </section>
    </div>
  </>;
}

function JobTable() {
  return <div className="table-scroll"><table data-testid="production-jobs-table">
    <thead><tr><th>Job / Customer</th><th>Part</th><th>Operation</th><th>Progress</th><th>Due</th><th>Status</th><th></th></tr></thead>
    <tbody>{jobs.map((j, i) => (
      <tr data-testid={`job-row-${i}`} key={j.id}>
        <td><b>{j.id}</b><small>{j.customer}</small></td>
        <td>{j.part}</td>
        <td>{j.operation}</td>
        <td><div className="progress-cell"><span>{j.qty}</span><div className="progress"><i style={{ width: `${parseInt(j.qty) / parseInt(j.qty.split("/")[1]) * 100}%` }}/></div></div></td>
        <td>{j.due}</td>
        <td><Badge>{j.status}</Badge></td>
        <td><button className="row-menu" data-testid={`job-menu-${i}`}>···</button></td>
      </tr>
    ))}</tbody>
  </table></div>;
}

function MockModuleView({ item }) {
  const rows = moduleData[item.id] || [];
  const isJob = item.id === "jobs";
  return <div className="module-view">
    <div className="page-title">
      <div>
        <div className="eyebrow">Precise Industries / {item.name}</div>
        <h1 data-testid="module-title">{item.name}</h1>
        <p>Manage {item.name.toLowerCase()} across Precise Industries.</p>
      </div>
      <button className="primary-btn" data-testid={`create-${item.id}-button`} onClick={() => toast.info(`${item.name} is coming online in a future phase`)}><Plus size={16}/> New {item.name.split(",")[0].toLowerCase()}</button>
    </div>
    <div className="module-toolbar">
      <div className="search-field small"><Search size={16}/><input data-testid={`${item.id}-search`} placeholder={`Search ${item.name.toLowerCase()}...`}/></div>
      <button className="filter-btn" data-testid={`${item.id}-filter`}><span>Filter</span><ChevronDown size={14}/></button>
      <button className="filter-btn" data-testid={`${item.id}-columns`}>Columns</button>
      <span className="toolbar-count phase-pill">Coming in a later phase · showing sample data</span>
    </div>
    <section className="panel table-panel">
      <div className="summary-strip">
        <div><small>Open items</small><b>{rows.length + 8}</b></div>
        <div><small>Due this week</small><b>{Math.ceil(rows.length / 2) + 2}</b></div>
        <div><small>Needs attention</small><b className="danger-text">{item.id === "quality" ? 4 : 3}</b></div>
        <div className="strip-note"><CircleAlert size={16}/> Sample view · not yet connected</div>
      </div>
      <div className="table-scroll">
        <table data-testid={`${item.id}-table`}>
          <thead><tr><th>Reference</th><th>Customer / description</th><th>Owner</th><th>Updated</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>{rows.map((row, i) => (
            <tr key={row} data-testid={`${item.id}-row-${i}`}>
              <td><b>{row}</b><small>{isJob ? "Manufacturing work order" : "Sample data"}</small></td>
              <td>{["ABC Auto Components", "Nexon Industrial", "Vertex Mobility", "Atlas Hydraulics"][i % 4]}</td>
              <td>{["A. Kumar", "S. Iyer", "R. Shah"][i % 3]}</td>
              <td>{i + 1}h ago</td>
              <td><Badge>{["In progress", "Under review", "Ready", "Pending"][i % 4]}</Badge></td>
              <td><button className="outline-btn" data-testid={`${item.id}-open-${i}`} onClick={() => toast.info(`${row} opened`)}>Open</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  </div>;
}

function LiveModule({ id }) {
  if (id === "customers") return <CustomersModule/>;
  if (id === "leads") return <LeadsModule/>;
  if (id === "parts") return <PartsModule/>;
  if (id === "work-centers") return <WorkCentersModule/>;
  if (id === "machines") return <MachinesModule/>;
  if (id === "customer-pos") return <CustomerPOsModule/>;
  if (id === "jobs") return <JobsModule/>;
  if (id === "shop-floor") return <ShopFloorModule/>;
  if (id === "inventory") return <InventoryModule/>;
  return null;
}

function CompanyPicker({ orgs, activeOrgId, setActiveOrgId, collapsed }) {
  const [open, setOpen] = useState(false);
  const active = orgs.find(o => o.id === activeOrgId);
  return (
    <div className="company-wrap">
      <button className="company-switch" data-testid="company-selector" onClick={() => setOpen(o => !o)}>
        <div className="company-avatar">{active?.name?.slice(0, 2).toUpperCase() || "??"}</div>
        {!collapsed && <div><b>{active?.name || "No company"}</b><span>{active?.plant_name || active?.city || "Plant 01"}</span></div>}
        <ChevronDown size={14}/>
      </button>
      {open && (
        <div className="company-menu" data-testid="company-menu" onMouseLeave={() => setOpen(false)}>
          {orgs.map(o => (
            <button key={o.id} data-testid={`company-option-${o.id}`} className={`company-option ${o.id === activeOrgId ? "active" : ""}`} onClick={() => { setActiveOrgId(o.id); setOpen(false); toast.success(`Switched to ${o.name}`); }}>
              <div className="company-avatar sm">{o.name.slice(0, 2).toUpperCase()}</div>
              <div><b>{o.name}</b><span>{o.role}</span></div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileMenu({ user }) {
  const [open, setOpen] = useState(false);
  const initials = (user?.email || "??").slice(0, 2).toUpperCase();
  const display = user?.user_metadata?.first_name
    ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`.trim()
    : (user?.email || "Signed in");
  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
  }
  return (
    <div className="profile-wrap">
      <button className="profile" data-testid="user-profile" onClick={() => setOpen(o => !o)}>
        <div className="avatar">{initials}</div>
        <div><b>{display}</b><span>{user?.email || ""}</span></div>
        <ChevronDown size={14}/>
      </button>
      {open && (
        <div className="profile-menu" data-testid="profile-menu" onMouseLeave={() => setOpen(false)}>
          <button data-testid="profile-signout" className="profile-menu-item" onClick={signOut}><LogOut size={14}/> Sign out</button>
        </div>
      )}
    </div>
  );
}

function Shell() {
  const { user, orgs, activeOrgId, setActiveOrgId, activeMembership } = useAuth();
  const [active, setActive] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const item = allItems.find(x => x.id === active);
  const navigate = id => { setActive(id); setMobileOpen(false); };
  const [query, setQuery] = useState("");
  const matches = useMemo(() => allItems.filter(x => x.name.toLowerCase().includes(query.toLowerCase())), [query]);
  const isLive = !!item?.live;
  const firstName = user?.user_metadata?.first_name || (user?.email || "").split("@")[0];

  return <div className={`erp ${dark ? "dark-mode" : ""}`}>
    {mobileOpen && <div className="mobile-backdrop" data-testid="mobile-backdrop" onClick={() => setMobileOpen(false)}/>}
    <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="brand">
        <div className="brand-mark"><Factory size={19}/></div>
        {!collapsed && <div><b>PRECISE</b><span>INDUSTRIES</span></div>}
        <button className="close-mobile icon-btn" data-testid="mobile-close-sidebar" onClick={() => setMobileOpen(false)}><X size={18}/></button>
      </div>
      <CompanyPicker orgs={orgs} activeOrgId={activeOrgId} setActiveOrgId={setActiveOrgId} collapsed={collapsed}/>
      <nav>
        {sections.map(s => (
          <div className="nav-group" key={s.label}>
            {!collapsed && <label>{s.label}</label>}
            {s.items.map(({ id, name, icon: Icon, live }) => (
              <button className={`nav-item ${active === id ? "active" : ""}`} data-testid={`nav-${id}`} title={name} onClick={() => navigate(id)} key={id}>
                <Icon size={17}/>
                {!collapsed && <span>{name}</span>}
                {!collapsed && live && <em className="live-dot" title="Connected to database"/>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-foot">
        <button className="nav-item" data-testid="help-button" onClick={() => toast.info("Support center coming soon")}>
          <CircleAlert size={17}/>{!collapsed && <span>Help & support</span>}
        </button>
        <button className="collapse-btn" data-testid="sidebar-collapse" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronRight size={17}/> : <><PanelLeftClose size={17}/> Collapse sidebar</>}
        </button>
      </div>
    </aside>
    <main className="main">
      <header className="topbar">
        <button className="mobile-menu icon-btn" data-testid="mobile-menu-button" onClick={() => setMobileOpen(true)}><Menu size={20}/></button>
        <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14}/><b>{item?.name || "Dashboard"}</b>{activeMembership && <><ChevronRight size={12}/><span className="crumb-role">{activeMembership.role}</span></>}</div>
        <div className="top-actions">
          <div className="global-search">
            <Search size={16}/>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search anything..." data-testid="global-search"/>
            {query && (
              <div className="search-results">
                {matches.slice(0, 5).map(m => (
                  <button key={m.id} data-testid={`search-result-${m.id}`} onClick={() => { navigate(m.id); setQuery(""); }}>{m.name}</button>
                ))}
              </div>
            )}
          </div>
          <button className="icon-btn notification" data-testid="notifications-button" onClick={() => toast("3 production alerts", { icon: <Bell size={15}/> })}><Bell size={18}/><i/></button>
          <button className="icon-btn" data-testid="theme-toggle" title="Toggle theme" onClick={() => setDark(!dark)}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>
          <ProfileMenu user={user}/>
        </div>
      </header>
      <div className="page"><div className="content">
        {active === "dashboard" ? <Dashboard onNavigate={navigate} greetingName={firstName}/> :
         isLive ? <LiveModule id={active}/> :
         <MockModuleView item={item}/>}
      </div></div>
    </main>
    <Toaster position="bottom-right" richColors/>
  </div>;
}

function LoadingSplash() {
  return <div className="app-splash" data-testid="app-splash">
    <div className="brand-mark"><Factory size={22}/></div>
    <b>PRECISE INDUSTRIES</b>
    <span>Loading your workspace…</span>
  </div>;
}

function App() {
  const { session, loading, orgs } = useAuth();
  // Support hash-based reset-password entry, e.g., /#reset-password
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const isReset = hash.includes("reset-password");

  if (loading) return <LoadingSplash/>;
  if (!session) return <><AuthScreens initial={isReset ? "reset" : "login"}/><Toaster position="bottom-right" richColors/></>;
  if (!orgs.length) return <><Onboarding/><Toaster position="bottom-right" richColors/></>;
  return <Shell/>;
}

export default App;
