"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArrowDownToLine, ArrowRight, Bell, Bug, Check,
  CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp,
  ClipboardCheck, Clock3, Command, FileCheck2, Filter, FlaskConical,
  LayoutDashboard, ListChecks, Menu, MoreHorizontal, Plus, Search,
  Settings2, ShieldCheck, Sparkles, X, XCircle,
} from "lucide-react";
import type { ActivityEvent, DemoUser, Organization, Priority, Project, TestCase, TestRun, TestStatus, TestType, TestSuite } from "@/lib/test-cases";

type StatusFilter = "All tests" | TestStatus;
const filters: StatusFilter[] = ["All tests", "Passed", "Failed", "Blocked", "Not run"];
const statusClass: Record<TestStatus, string> = {
  Passed: "status-passed", Failed: "status-failed", Blocked: "status-blocked", "Not run": "status-notrun",
};
const priorityClass: Record<Priority, string> = {
  Critical: "priority-critical", High: "priority-high", Medium: "priority-medium", Low: "priority-low",
};
function formatRunDate(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type DashboardData = {
  user: DemoUser;
  organization: Organization | null;
  members: DemoUser[];
  projects: Project[];
  suites: TestSuite[];
  testCases: TestCase[];
  latestRun: TestRun | null;
  totalRuns: number;
  runHistory: { day: string; passed: number; failed: number }[];
  activity: ActivityEvent[];
};

export default function Home() {
  const [cases, setCases] = useState<TestCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<DemoUser | null>(null);
  const [availableUsers, setAvailableUsers] = useState<DemoUser[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [members, setMembers] = useState<DemoUser[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [latestRun, setLatestRun] = useState<TestRun | null>(null);
  const [totalRuns, setTotalRuns] = useState(0);
  const [runHistory, setRunHistory] = useState<DashboardData["runHistory"]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const noticeTimer = useRef<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All tests");
  const [moduleFilter, setModuleFilter] = useState("All modules");
  const [projectFilter, setProjectFilter] = useState("All projects");
  const [defectsOnly, setDefectsOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notice, setNotice] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newModule, setNewModule] = useState("Authentication");
  const [newType, setNewType] = useState<TestType>("Manual");
  const [newPriority, setNewPriority] = useState<Priority>("Medium");

  async function loadDashboard() {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load workspace data from SQLite.");
    const data = await response.json() as DashboardData;
    setUser(data.user);
    setOrganization(data.organization);
    setMembers(data.members);
    setProjects(data.projects);
    setSuites(data.suites);
    setCases(data.testCases);
    setLatestRun(data.latestRun);
    setTotalRuns(data.totalRuns);
    setRunHistory(data.runHistory);
    setActivity(data.activity);
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load demo accounts.");
        return response.json() as Promise<{ user: DemoUser; users: DemoUser[] }>;
      })
      .then(async (session) => {
        if (!active) return;
        setUser(session.user);
        setAvailableUsers(session.users);
        await loadDashboard();
      })
      .catch(() => { if (active) announce("Could not connect to the local SQLite database"); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  const total = cases.length;
  const passed = latestRun?.results.Passed ?? cases.filter((test) => test.status === "Passed").length;
  const failed = latestRun?.results.Failed ?? cases.filter((test) => test.status === "Failed").length;
  const blocked = latestRun?.results.Blocked ?? cases.filter((test) => test.status === "Blocked").length;
  const notRun = latestRun?.results["Not run"] ?? cases.filter((test) => test.status === "Not run").length;
  const runCount = passed + failed;
  const passRate = runCount ? Math.round((passed / runCount) * 100) : 0;
  const modules = ["All modules", ...suites.map((suite) => suite.name)];
  const chartMax = Math.max(1, ...runHistory.map((day) => day.passed + day.failed));
  const chartPoints = runHistory.map((day, index) => ({
    x: runHistory.length > 1 ? (index / (runHistory.length - 1)) * 310 : 155,
    y: 112 - ((day.passed + day.failed) / chartMax) * 94,
  }));
  const productivityPath = chartPoints.map((point, index) => `${index ? "L" : "M"}${point.x} ${point.y}`).join(" ");
  const activityTime = (value: string) => {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    return hours < 24 ? `${hours} hr ago` : `${Math.floor(hours / 24)} day ago`;
  };
  const visibleCases = useMemo(() => cases.filter((test) => {
    const matchesStatus = statusFilter === "All tests" || test.status === statusFilter;
    const matchesModule = moduleFilter === "All modules" || test.module === moduleFilter;
    const matchesProject = projectFilter === "All projects" || test.project_id === projectFilter;
    const matchesDefect = !defectsOnly || test.defect_id !== null;
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || `${test.title} ${test.module} ${test.assignee} ${test.defect_id ?? ""}`.toLowerCase().includes(term);
    return matchesStatus && matchesModule && matchesProject && matchesDefect && matchesSearch;
  }), [cases, defectsOnly, moduleFilter, projectFilter, search, statusFilter]);

  function announce(message: string) {
    setNotice(message);
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 2800);
  }

  useEffect(() => () => {
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
  }, []);

  async function switchDemoUser(email: string) {
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error("Could not switch demo account.");
      const session = await response.json() as { user: DemoUser; users: DemoUser[] };
      setUser(session.user);
      setAvailableUsers(session.users);
      setStatusFilter("All tests");
      setModuleFilter("All modules");
      setProjectFilter("All projects");
      setDefectsOnly(false);
      await loadDashboard();
      announce(`Demo workspace switched to ${session.user.name}`);
    } catch {
      announce("Could not switch demo account");
    }
  }

  async function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const response = await fetch("/api/test-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), module: newModule, test_type: newType, priority: newPriority }),
      });
      if (!response.ok) throw new Error("Could not save test case.");
      await response.json() as TestCase;
      await loadDashboard();
      announce("Test case created");
    } catch {
      announce("Could not save test case to SQLite");
      return;
    }
    setNewTitle(""); setNewModule("Authentication"); setNewType("Manual"); setNewPriority("Medium"); setShowModal(false);
  }

  async function updateStatus(testCase: TestCase, status: TestStatus) {
    try {
      const response = await fetch(`/api/test-cases/${encodeURIComponent(testCase.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Could not update test result.");
      await response.json() as TestCase;
      await loadDashboard();
      announce(`Test case marked ${status.toLowerCase()}`);
    } catch {
      announce("Could not update test result in SQLite");
    }
  }

  async function deleteCase(testCase: TestCase) {
    try {
      const response = await fetch(`/api/test-cases/${encodeURIComponent(testCase.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete test case.");
      await loadDashboard();
      announce("Test case removed");
    } catch {
      announce("Could not remove test case from SQLite");
    }
  }

  function exportCases() {
    const columns = ["id", "title", "module", "test_type", "priority", "status", "assignee", "defect_id"] as const;
    const escapeCell = (value: string) => {
      const safeValue = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
      return `"${safeValue.replaceAll('"', '""')}"`;
    };
    const rows = [columns.join(","), ...visibleCases.map((test) => columns.map((key) => escapeCell(String(test[key] ?? ""))).join(","))];
    const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "testpilot-test-cases.csv"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce("Test cases exported");
  }

  return (
    <main className="qa-app min-h-screen">
      <aside className={`qa-sidebar ${mobileMenu ? "qa-sidebar-open" : ""}`}>
        <a className="qa-brand" href="#overview" onClick={() => { setStatusFilter("All tests"); setModuleFilter("All modules"); setProjectFilter("All projects"); setDefectsOnly(false); }}>
          <span className="qa-brand-icon"><FlaskConical size={18} /></span><span>test<span className="qa-brand-light">pilot</span></span>
        </a>
        <div className="qa-workspace"><div className="workspace-mark">{organization?.name.slice(0, 1) ?? "A"}</div><div><strong>{organization?.name ?? "QA workspace"}</strong><span>Shared demo workspace</span></div><ChevronDown size={15} /></div>
        <p className="qa-nav-label">TESTING</p>
        <nav className="qa-nav" aria-label="Testing navigation">
          <button className={`qa-nav-item ${!defectsOnly && statusFilter === "All tests" && projectFilter === "All projects" && moduleFilter === "All modules" ? "qa-nav-selected" : ""}`} onClick={() => { setStatusFilter("All tests"); setModuleFilter("All modules"); setProjectFilter("All projects"); setDefectsOnly(false); setMobileMenu(false); }}><LayoutDashboard size={17} /><span>Overview</span></button>
          <button className={`qa-nav-item ${!defectsOnly && statusFilter === "All tests" && (projectFilter !== "All projects" || moduleFilter !== "All modules") ? "qa-nav-selected" : ""}`} onClick={() => { setStatusFilter("All tests"); setModuleFilter("All modules"); setProjectFilter("All projects"); setDefectsOnly(false); setMobileMenu(false); }}><ListChecks size={17} /><span>Test cases</span><span className="qa-nav-count">{total}</span></button>
          <button className={`qa-nav-item ${defectsOnly ? "qa-nav-selected" : ""}`} onClick={() => { setStatusFilter("All tests"); setModuleFilter("All modules"); setProjectFilter("All projects"); setDefectsOnly(true); setMobileMenu(false); }}><Bug size={17} /><span>Defects</span><span className="qa-nav-count qa-danger-count">{cases.filter((test) => test.defect_id !== null).length}</span></button>
          <button className="qa-nav-item" onClick={() => announce(latestRun ? `${latestRun.name} · Run #${latestRun.run_number} · ${latestRun.status}` : "No test runs have been recorded yet")}><Activity size={17} /><span>Test runs</span><span className="qa-nav-count">{totalRuns}</span></button>
        </nav>
        <p className="qa-nav-label qa-modules-label">PROJECTS</p>
        {projects.map((project, index) => <button key={project.id} className={`qa-suite ${projectFilter === project.id ? "qa-suite-active" : ""}`} onClick={() => { setProjectFilter(projectFilter === project.id ? "All projects" : project.id); setModuleFilter("All modules"); setDefectsOnly(false); setMobileMenu(false); }}><span className={`suite-dot suite-dot-${index % 4}`} style={{ backgroundColor: project.color === "orange" ? "#ea9a67" : project.color === "blue" ? "#66a5d7" : "#8378e3" }} />{project.name}<span className="suite-count">{cases.filter((test) => test.project_id === project.id).length}</span></button>)}
        <p className="qa-nav-label qa-modules-label">TEST SUITES</p>
        {suites.map((suite, index) => <button key={suite.id} className={`qa-suite ${moduleFilter === suite.name ? "qa-suite-active" : ""}`} onClick={() => { setModuleFilter(moduleFilter === suite.name ? "All modules" : suite.name); setProjectFilter("All projects"); setDefectsOnly(false); setMobileMenu(false); }}><span className={`suite-dot suite-dot-${index % 4}`} />{suite.name}<span className="suite-count">{cases.filter((test) => test.module === suite.name).length}</span></button>)}
        <div className="qa-sidebar-bottom">
          <div className="qa-quality-card"><div className="quality-card-top"><span className="quality-shield"><ShieldCheck size={16} /></span><span className="quality-card-label">LATEST RUN</span><MoreHorizontal size={17} /></div><strong>{failed ? "Review failures" : blocked ? "Triage blocked tests" : "Quality looks good"}</strong><p>{passed} of {runCount} executed test cases passed.</p><div className="quality-bar"><span style={{ width: `${passRate}%` }} /></div><small>{passRate}% pass rate</small></div>
          <button className="qa-nav-item qa-help"><CircleHelp size={17} />Help &amp; support</button>
          <div className="qa-user"><span className="qa-user-avatar">{user?.name.split(" ").map((part) => part[0]).join("") ?? "?"}</span><span><strong>{user?.name ?? "Loading account"}</strong><small>{user?.role ?? "Demo user"}</small></span><MoreHorizontal size={18} /></div>
        </div>
      </aside>

      <section className="qa-main" id="overview">
        <header className="qa-topbar">
          <button className="qa-mobile-menu" aria-label="Open menu" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={19} /></button>
          <div className="qa-breadcrumb"><span>{organization?.name ?? "Workspace"}</span><ChevronRight size={14} /><strong>QA overview</strong></div>
          <div className="qa-top-actions"><label className="qa-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tests, modules..." aria-label="Search test cases" /><kbd><Command size={10} /> K</kbd></label><button className="qa-notification" aria-label={`${failed + blocked} tests need attention`}><Bell size={18} />{failed + blocked > 0 && <i />}</button><label className="demo-user-picker" title="Demo identity only — not email authentication"><span className="qa-user-avatar qa-top-avatar">{user?.name.split(" ").map((part) => part[0]).join("") ?? "?"}</span><select aria-label="Switch demo user" value={user?.email ?? ""} onChange={(event) => void switchDemoUser(event.target.value)}>{availableUsers.map((demoUser) => <option key={demoUser.id} value={demoUser.email}>{demoUser.email}</option>)}</select></label></div>
        </header>

        <div className="qa-content">
          <div className="qa-page-heading"><div><div className="qa-eyebrow"><span className="qa-live-dot" /> QA WORKSPACE <span className="eyebrow-divider">/</span> {latestRun?.name.toUpperCase() ?? "NO TEST RUNS"} <span className="demo-mode-pill">DEMO MODE · NOT AUTHENTICATED</span></div><h1>Good morning, {user?.name.split(" ")[0] ?? "there"} <span>✦</span></h1><p>Quality snapshot for {organization?.name ?? "your workspace"}.</p></div><div className="qa-heading-actions"><button className="qa-secondary-button" onClick={exportCases}><ArrowDownToLine size={15} /> Export</button><button className="qa-primary-button" onClick={() => setShowModal(true)}><Plus size={16} /> New test case</button></div></div>

          <section className="qa-metrics" aria-label="Quality metrics">
            <article className="qa-metric"><div className="metric-title">Total test cases<span className="metric-icon metric-indigo"><ClipboardCheck size={17} /></span></div><div className="metric-value">{total}<span className="metric-trend"><ArrowRight size={12} /> {projects.length} projects</span></div><p>Across {suites.length} persisted test suites</p><div className="metric-spark spark-indigo">{runHistory.map((day) => <i key={day.day} style={{ height: `${Math.max(14, ((day.passed + day.failed) / chartMax) * 100)}%` }} />)}</div></article>
            <article className="qa-metric"><div className="metric-title">Passed<span className="metric-icon metric-green"><CheckCircle2 size={17} /></span></div><div className="metric-value">{passed}<span className="metric-trend metric-good"><ArrowRight size={12} /> {passRate}% pass rate</span></div><p>Of {runCount} executed tests</p><div className="metric-progress"><span style={{ width: `${passRate}%` }} /></div></article>
            <article className="qa-metric"><div className="metric-title">Failed<span className="metric-icon metric-red"><XCircle size={17} /></span></div><div className="metric-value">{failed}<span className="metric-trend metric-bad"><AlertTriangle size={12} /> Needs attention</span></div><p>{cases.filter((test) => test.defect_id !== null && test.status === "Failed").length} linked defect(s) need triage</p><div className="metric-spark spark-red">{runHistory.map((day) => <i key={day.day} style={{ height: `${Math.max(8, (day.failed / chartMax) * 100)}%` }} />)}</div></article>
            <article className="qa-metric"><div className="metric-title">Not run<span className="metric-icon metric-amber"><Clock3 size={17} /></span></div><div className="metric-value">{notRun}<span className="metric-trend metric-neutral"><Activity size={12} /> {blocked} blocked</span></div><p>Blocked cases need triage</p><div className="metric-progress metric-progress-amber"><span style={{ width: `${total ? ((notRun + blocked) / total) * 100 : 0}%` }} /></div></article>
          </section>

          <section className="qa-overview-grid">
            <article className="qa-card run-card"><div className="qa-card-heading"><div><div className="qa-heading-with-icon"><span className="run-icon"><FileCheck2 size={16} /></span><h2>{latestRun?.name ?? "No test run yet"}</h2><span className="run-label">{latestRun?.status ?? "EMPTY"}</span></div><p>{latestRun ? `Run #${latestRun.run_number} · ${formatRunDate(latestRun.started_at)} · ${new Date(latestRun.started_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Create test cases to seed your first run."}</p></div><button className="qa-more-button" aria-label="Latest run details"><MoreHorizontal size={19} /></button></div>
              <div className="run-summary">
                <div className="run-donut" style={{ background: `conic-gradient(#4ab78a ${total ? (passed / total) * 100 : 0}%, #e97c7c ${total ? (passed / total) * 100 : 0}% ${total ? ((passed + failed) / total) * 100 : 0}%, #edb45f 0)` }}><span>{passRate}<small>%</small></span></div>
                <div className="run-summary-copy"><strong>Run health</strong><span>{passRate >= 80 ? "Looking good — review the failures below." : "Review failing cases before release."}</span><div className="run-legend"><span><i className="legend-dot dot-green" />{passed} Passed</span><span><i className="legend-dot dot-red" />{failed} Failed</span><span><i className="legend-dot dot-amber" />{blocked} Blocked</span><span><i className="legend-dot dot-gray" />{notRun} Not run</span></div><div className="run-trend"><span>Recent execution trend · last {runHistory.length} runs</span><svg viewBox="0 0 310 118" role="img" aria-label={`Recent executed test history across ${runHistory.length} runs`}><path d={`${productivityPath} L310 118 L0 118 Z`} fill="#6d64d819" /><path d={productivityPath} fill="none" stroke="#6d64d8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{chartPoints.map((point, index) => <circle key={runHistory[index].day} cx={point.x} cy={point.y} r="3" fill="#6d64d8" />)}</svg></div></div>
              </div>
              <div className="run-footer"><span><Check size={14} /> Environment: <strong>{latestRun ? `${latestRun.environment} · ${latestRun.browser}` : "Not configured"}</strong></span><button onClick={() => { setDefectsOnly(false); setStatusFilter("Failed"); }}>Review failures <ChevronRight size={14} /></button></div>
            </article>
            <article className="qa-card activity-card"><div className="qa-card-heading"><div><h2>Release readiness</h2><p>{latestRun?.name ?? "Workspace test coverage"}</p></div><span className={`readiness-badge ${latestRun?.status === "Completed" ? "readiness-complete" : ""}`}><span /> {latestRun?.status ?? "No run"}</span></div><div className="readiness-score"><strong>{total ? Math.round((runCount / total) * 100) : 0}<small>%</small></strong><span>of test cases executed</span></div><div className="readiness-track"><span style={{ width: `${total ? (runCount / total) * 100 : 0}%` }} /></div><div className="readiness-stats"><span><i className="dot-green" />{passed} passed</span><span><i className="dot-red" />{failed} failed</span><span><i className="dot-amber" />{blocked} blocked</span><span><i className="dot-gray" />{notRun} not run</span></div><div className="activity-note"><span className="activity-avatar">{activity[0]?.actor.split(" ").map((part) => part[0]).join("") ?? "—"}</span><span><strong>{activity[0]?.actor ?? "No activity"}</strong>{activity[0] ? ` ${activity[0].action}: ${activity[0].target}` : " will appear here when the team works"}</span><time>{activity[0] ? activityTime(activity[0].created_at) : ""}</time></div></article>
          </section>

          <section className="qa-card cases-card"><div className="cases-heading"><div><div className="qa-heading-with-icon"><h2>{defectsOnly ? "Linked defects" : "Test cases"}</h2><span className="cases-count">{visibleCases.length}</span></div><p>Review and update your test execution results.</p></div><div className="cases-actions"><label className="module-select"><Settings2 size={14} /><select aria-label="Filter by project" value={projectFilter} onChange={(event) => { setProjectFilter(event.target.value); setModuleFilter("All modules"); setDefectsOnly(false); }}><option value="All projects">All projects</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><ChevronDown size={12} /></label><label className="module-select"><Filter size={14} /><select aria-label="Filter by module" value={moduleFilter} onChange={(event) => { setModuleFilter(event.target.value); setProjectFilter("All projects"); setDefectsOnly(false); }}>{modules.map((module) => <option key={module}>{module}</option>)}</select><ChevronDown size={12} /></label><button className="qa-primary-button qa-add-button" onClick={() => setShowModal(true)}><Plus size={15} /> Add case</button></div></div>
            <div className="status-tabs" role="tablist" aria-label="Filter by test result">{filters.map((filter) => <button key={filter} role="tab" aria-selected={statusFilter === filter} className={statusFilter === filter ? "status-tab-active" : ""} onClick={() => { setStatusFilter(filter); setDefectsOnly(false); }}>{filter}<span>{filter === "All tests" ? total : cases.filter((test) => test.status === filter).length}</span></button>)}</div>
            <div className="case-table-wrap"><table className="case-table"><thead><tr><th>TEST CASE</th><th>MODULE</th><th>TYPE</th><th>PRIORITY</th><th>RESULT</th><th>ASSIGNEE</th><th>UPDATED</th><th aria-label="Actions"></th></tr></thead><tbody>
              {visibleCases.map((testCase) => <tr key={testCase.id}><td><div className="test-title-cell"><span className="case-check"><Check size={12} /></span><span><strong>{testCase.title}</strong><small>{testCase.id.startsWith("demo-") ? `TC-${String(Number(testCase.id.slice(5)) + 100).padStart(3, "0")}` : `TC-${testCase.id.slice(0, 5).toUpperCase()}`}{testCase.defect_id && <button className="defect-link" onClick={() => announce(`${testCase.defect_id}: linked defect open`)}><Bug size={11} /> {testCase.defect_id}</button>}</small></span></div></td><td><span className="module-tag"><i className={`module-dot ${testCase.module === "Checkout" ? "module-dot-orange" : testCase.module === "Shopping cart" ? "module-dot-pink" : testCase.module === "Search" ? "module-dot-blue" : ""}`} />{testCase.module}</span></td><td><span className={`type-tag ${testCase.test_type === "Automation" ? "type-auto" : ""}`}>{testCase.test_type === "Automation" ? <Settings2 size={12} /> : <ClipboardCheck size={12} />}{testCase.test_type}</span></td><td><span className={`priority-label ${priorityClass[testCase.priority]}`}><i />{testCase.priority}</span></td><td><select className={`result-select ${statusClass[testCase.status]}`} aria-label={`Set result for ${testCase.title}`} value={testCase.status} onChange={(event) => void updateStatus(testCase, event.target.value as TestStatus)}><option>Passed</option><option>Failed</option><option>Blocked</option><option>Not run</option></select></td><td><span className="assignee"><i className={`assignee-avatar avatar-${testCase.assignee.toLowerCase()}`}>{testCase.assignee}</i>{members.find((member) => member.id === testCase.assignee_user_id)?.name ?? testCase.assignee}</span></td><td><span className="last-run"><Clock3 size={12} />{formatRunDate(testCase.updated_at)}</span></td><td><button className="case-menu" aria-label={`Delete ${testCase.title}`} onClick={() => void deleteCase(testCase)}><MoreHorizontal size={17} /></button></td></tr>)}
              {isLoading && <tr><td className="table-empty" colSpan={8}><Clock3 size={19} /><strong>Loading test cases</strong><span>Reading from the local SQLite database.</span></td></tr>}
              {!isLoading && !visibleCases.length && <tr><td className="table-empty" colSpan={8}><Search size={19} /><strong>No test cases found</strong><span>Try another search or filter.</span></td></tr>}
            </tbody></table></div>
            <div className="table-footer"><span>Showing <strong>{visibleCases.length ? 1 : 0}–{visibleCases.length}</strong> of <strong>{total}</strong> test cases</span><div><button aria-label="Previous page" disabled><ChevronLeft size={15} /></button><button className="page-current">1</button><button aria-label="Next page" disabled><ChevronRight size={15} /></button></div></div>
          </section>
          <footer className="qa-footer"><span>TestPilot <Sparkles size={12} /> <i /> {organization?.name ?? "Workspace"} · Demo identity only; email is not verified.</span><span>SQLite · {latestRun?.name ?? "No run yet"}</span></footer>
        </div>
      </section>

      {mobileMenu && <button className="qa-scrim" aria-label="Close navigation" onClick={() => setMobileMenu(false)} />}
      {notice && <div className="qa-toast"><CheckCircle2 size={16} />{notice}</div>}
      {showModal && <div className="qa-modal-backdrop" onClick={() => setShowModal(false)}><section className="qa-modal" role="dialog" aria-modal="true" aria-labelledby="create-title" onClick={(event) => event.stopPropagation()}><div className="qa-modal-head"><div><span className="modal-badge"><FlaskConical size={17} /></span><h2 id="create-title">Add test case</h2><p>Describe what you want to verify.</p></div><button className="qa-modal-close" onClick={() => setShowModal(false)} aria-label="Close dialog"><X size={18} /></button></div><form onSubmit={createCase}><label className="qa-form-label">Test scenario<input required autoFocus value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="e.g. User can update their profile photo" /></label><div className="qa-form-row"><label className="qa-form-label">Module<select value={newModule} onChange={(event) => setNewModule(event.target.value)}>{modules.slice(1).map((module) => <option key={module}>{module}</option>)}</select></label><label className="qa-form-label">Test type<select value={newType} onChange={(event) => setNewType(event.target.value as TestType)}><option>Manual</option><option>Automation</option></select></label></div><label className="qa-form-label">Priority<select value={newPriority} onChange={(event) => setNewPriority(event.target.value as Priority)}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label><div className="qa-modal-actions"><button type="button" className="qa-cancel-button" onClick={() => setShowModal(false)}>Cancel</button><button type="submit" className="qa-primary-button"><Plus size={15} /> Create test case</button></div></form></section></div>}
    </main>
  );
}
