import "server-only";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";
import type { ActivityEvent, DemoUser, NewTestCase, Organization, Project, TestCase, TestRun, TestStatus, TestSuite } from "@/lib/test-cases";

const databasePath = process.env.TESTPILOT_DB_PATH || join(process.cwd(), "data", "testpilot.sqlite");
type DatabaseCache = typeof globalThis & { testPilotDatabase?: Database.Database };
const globalWithDatabase = globalThis as DatabaseCache;
export const DEMO_ORGANIZATION_ID = "org-acme";
export const DEMO_USERS: DemoUser[] = [
  { id: "user-jordan", email: "jordan.davis@acme.com", name: "Jordan Davis", role: "QA Engineer", organization_id: DEMO_ORGANIZATION_ID },
  { id: "user-alex", email: "alex.morgan@acme.com", name: "Alex Morgan", role: "QA Lead", organization_id: DEMO_ORGANIZATION_ID },
];
const TEAM_MEMBERS: DemoUser[] = [
  ...DEMO_USERS,
  { id: "user-sam", email: "sam.kim@acme.com", name: "Sam Kim", role: "QA Analyst", organization_id: DEMO_ORGANIZATION_ID },
  { id: "user-riley", email: "riley.lee@acme.com", name: "Riley Lee", role: "QA Engineer", organization_id: DEMO_ORGANIZATION_ID },
];
const demoProjects: Project[] = [
  { id: "project-storefront", name: "Storefront", color: "violet" },
  { id: "project-checkout", name: "Checkout", color: "orange" },
  { id: "project-search", name: "Search", color: "blue" },
];
const demoSuites: TestSuite[] = [
  { id: "suite-auth", name: "Authentication", project_id: "project-storefront" },
  { id: "suite-cart", name: "Shopping cart", project_id: "project-storefront" },
  { id: "suite-checkout", name: "Checkout", project_id: "project-checkout" },
  { id: "suite-search", name: "Search", project_id: "project-search" },
];

function initializeDatabase() {
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS organizations (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id),
      email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, role TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL, color TEXT NOT NULL DEFAULT 'violet', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS test_suites (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS test_cases (
      id TEXT PRIMARY KEY, organization_id TEXT REFERENCES organizations(id),
      project_id TEXT REFERENCES projects(id), suite_id TEXT REFERENCES test_suites(id),
      title TEXT NOT NULL, module TEXT NOT NULL,
      test_type TEXT NOT NULL CHECK (test_type IN ('Manual', 'Automation')),
      priority TEXT NOT NULL CHECK (priority IN ('Critical', 'High', 'Medium', 'Low')),
      status TEXT NOT NULL CHECK (status IN ('Passed', 'Failed', 'Blocked', 'Not run')),
      assignee TEXT NOT NULL DEFAULT 'JD', assignee_user_id TEXT REFERENCES users(id),
      created_by_user_id TEXT REFERENCES users(id), defect_id TEXT, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS test_runs (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id),
      project_id TEXT REFERENCES projects(id), suite_id TEXT REFERENCES test_suites(id),
      name TEXT NOT NULL, run_number INTEGER NOT NULL, environment TEXT NOT NULL,
      browser TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('Completed', 'In progress')),
      started_at TEXT NOT NULL, created_by_user_id TEXT REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS test_run_results (
      id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
      test_case_id TEXT NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('Passed', 'Failed', 'Blocked', 'Not run')),
      duration_ms INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
      UNIQUE (run_id, test_case_id)
    );
    CREATE TABLE IF NOT EXISTS activity_events (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id),
      actor_user_id TEXT REFERENCES users(id), action TEXT NOT NULL, target TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const columns = db.prepare("PRAGMA table_info(test_cases)").all() as { name: string }[];
  const columnNames = new Set(columns.map((column) => column.name));
  if (!columnNames.has("organization_id")) db.exec("ALTER TABLE test_cases ADD COLUMN organization_id TEXT REFERENCES organizations(id)");
  if (!columnNames.has("project_id")) db.exec("ALTER TABLE test_cases ADD COLUMN project_id TEXT REFERENCES projects(id)");
  if (!columnNames.has("suite_id")) db.exec("ALTER TABLE test_cases ADD COLUMN suite_id TEXT REFERENCES test_suites(id)");
  if (!columnNames.has("assignee_user_id")) db.exec("ALTER TABLE test_cases ADD COLUMN assignee_user_id TEXT REFERENCES users(id)");
  if (!columnNames.has("created_by_user_id")) db.exec("ALTER TABLE test_cases ADD COLUMN created_by_user_id TEXT REFERENCES users(id)");
  db.exec(`
    CREATE INDEX IF NOT EXISTS test_cases_org_updated_idx ON test_cases(organization_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS test_runs_org_started_idx ON test_runs(organization_id, started_at DESC);
    CREATE INDEX IF NOT EXISTS activity_org_created_idx ON activity_events(organization_id, created_at DESC);
  `);

  const now = new Date().toISOString();
  db.prepare("INSERT OR IGNORE INTO organizations (id, name, created_at) VALUES (?, ?, ?)").run(DEMO_ORGANIZATION_ID, "Acme Software", now);
  const insertUser = db.prepare("INSERT OR IGNORE INTO users (id, organization_id, email, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)");
  for (const user of TEAM_MEMBERS) insertUser.run(user.id, user.organization_id, user.email, user.name, user.role, now);
  const insertProject = db.prepare("INSERT OR IGNORE INTO projects (id, organization_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)");
  for (const project of demoProjects) insertProject.run(project.id, DEMO_ORGANIZATION_ID, project.name, project.color, now);
  const insertSuite = db.prepare("INSERT OR IGNORE INTO test_suites (id, project_id, name, created_at) VALUES (?, ?, ?, ?)");
  for (const suite of demoSuites) insertSuite.run(suite.id, suite.project_id, suite.name, now);

  const caseCount = (db.prepare("SELECT COUNT(*) AS count FROM test_cases").get() as { count: number }).count;
  if (caseCount === 0) {
    const samples = [
      { id: "demo-1", title: "User can sign in with valid credentials", module: "Authentication", test_type: "Manual", priority: "High", status: "Passed", assignee: "AM", assignee_user_id: "user-alex", suite_id: "suite-auth", project_id: "project-storefront", defect_id: null },
      { id: "demo-2", title: "Password reset email is delivered", module: "Authentication", test_type: "Automation", priority: "Medium", status: "Passed", assignee: "JD", assignee_user_id: "user-jordan", suite_id: "suite-auth", project_id: "project-storefront", defect_id: null },
      { id: "demo-3", title: "Cart total updates after removing an item", module: "Shopping cart", test_type: "Manual", priority: "Critical", status: "Failed", assignee: "SK", assignee_user_id: "user-sam", suite_id: "suite-cart", project_id: "project-storefront", defect_id: "BUG-284" },
      { id: "demo-4", title: "Checkout accepts a valid shipping address", module: "Checkout", test_type: "Automation", priority: "High", status: "Passed", assignee: "AM", assignee_user_id: "user-alex", suite_id: "suite-checkout", project_id: "project-checkout", defect_id: null },
      { id: "demo-5", title: "Guest checkout retains cart contents", module: "Checkout", test_type: "Manual", priority: "Medium", status: "Blocked", assignee: "RL", assignee_user_id: "user-riley", suite_id: "suite-checkout", project_id: "project-checkout", defect_id: "BUG-291" },
      { id: "demo-6", title: "Product search handles no-result query", module: "Search", test_type: "Automation", priority: "Low", status: "Not run", assignee: "JD", assignee_user_id: "user-jordan", suite_id: "suite-search", project_id: "project-search", defect_id: null },
    ];
    const insertCase = db.prepare(`INSERT INTO test_cases
      (id, organization_id, project_id, suite_id, title, module, test_type, priority, status, assignee, assignee_user_id, created_by_user_id, defect_id, updated_at)
      VALUES (@id, @organization_id, @project_id, @suite_id, @title, @module, @test_type, @priority, @status, @assignee, @assignee_user_id, @created_by_user_id, @defect_id, @updated_at)`);
    const seedCases = db.transaction(() => {
      for (const testCase of samples) insertCase.run({ ...testCase, organization_id: DEMO_ORGANIZATION_ID, created_by_user_id: "user-jordan", updated_at: now });
    });
    seedCases();
  } else {
    db.prepare(`UPDATE test_cases SET organization_id = COALESCE(organization_id, ?),
      project_id = COALESCE(project_id, CASE WHEN module IN ('Checkout') THEN 'project-checkout' WHEN module = 'Search' THEN 'project-search' ELSE 'project-storefront' END),
      suite_id = COALESCE(suite_id, CASE module WHEN 'Authentication' THEN 'suite-auth' WHEN 'Shopping cart' THEN 'suite-cart' WHEN 'Checkout' THEN 'suite-checkout' ELSE 'suite-search' END),
      assignee_user_id = CASE assignee WHEN 'AM' THEN 'user-alex' WHEN 'SK' THEN 'user-sam' WHEN 'RL' THEN 'user-riley' ELSE COALESCE(assignee_user_id, 'user-jordan') END,
      created_by_user_id = COALESCE(created_by_user_id, 'user-jordan') WHERE organization_id IS NULL OR project_id IS NULL OR suite_id IS NULL OR assignee_user_id IS NULL OR created_by_user_id IS NULL`).run(DEMO_ORGANIZATION_ID);
  }

  const runCount = (db.prepare("SELECT COUNT(*) AS count FROM test_runs WHERE organization_id = ?").get(DEMO_ORGANIZATION_ID) as { count: number }).count;
  if (runCount === 0) {
    const caseRows = db.prepare("SELECT id, project_id, suite_id, status FROM test_cases WHERE organization_id = ? ORDER BY id").all(DEMO_ORGANIZATION_ID) as Pick<TestCase, "id" | "project_id" | "suite_id" | "status">[];
    const insertRun = db.prepare(`INSERT INTO test_runs (id, organization_id, project_id, suite_id, name, run_number, environment, browser, status, started_at, created_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const insertResult = db.prepare("INSERT INTO test_run_results (id, run_id, test_case_id, status, duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?)");
    const daysAgo = (days: number, hour: number) => { const date = new Date(); date.setDate(date.getDate() - days); date.setHours(hour, 40, 0, 0); return date.toISOString(); };
    const seedRuns = db.transaction(() => {
      for (let day = 6; day >= 0; day--) {
        const runId = `run-demo-${day}`;
        const start = daysAgo(day, 9 + (6 - day));
        insertRun.run(runId, DEMO_ORGANIZATION_ID, null, null, day === 0 ? "Sprint 24.8 regression" : "Daily smoke checks", 1482 - day, "Staging", "Chrome", "Completed", start, day % 2 ? "user-alex" : "user-jordan");
        for (const [index, testCase] of caseRows.entries()) {
          const status = day === 0 ? testCase.status : index === 2 && day % 3 === 0 ? "Failed" : index === 4 && day % 2 === 0 ? "Blocked" : index === 5 && day > 2 ? "Not run" : "Passed";
          insertResult.run(`${runId}-${testCase.id}`, runId, testCase.id, status, 420 + index * 137 + day * 18, start);
        }
      }
      const activityRows = [
        ["activity-1", "user-sam", "updated a test result", "Cart total updates after removing an item", daysAgo(0, 10)],
        ["activity-2", "user-jordan", "completed the checkout regression run", "Sprint 24.8 regression", daysAgo(0, 9)],
        ["activity-3", "user-alex", "linked a defect", "BUG-291 · Guest checkout retains cart contents", daysAgo(1, 15)],
        ["activity-4", "user-jordan", "added an automated test", "Product search handles no-result query", daysAgo(2, 11)],
      ];
      const insertActivity = db.prepare("INSERT INTO activity_events (id, organization_id, actor_user_id, action, target, created_at) VALUES (?, ?, ?, ?, ?, ?)");
      for (const activity of activityRows) insertActivity.run(activity[0], DEMO_ORGANIZATION_ID, activity[1], activity[2], activity[3], activity[4]);
    });
    seedRuns();
  }

  return db;
}

export const database = globalWithDatabase.testPilotDatabase ?? initializeDatabase();
globalWithDatabase.testPilotDatabase = database;

export function findDemoUser(email: string) {
  return database.prepare("SELECT id, email, name, role, organization_id FROM users WHERE lower(email) = lower(?)").get(email) as DemoUser | undefined;
}

export function listDemoUsers() {
  return database.prepare("SELECT id, email, name, role, organization_id FROM users WHERE id IN ('user-jordan', 'user-alex') ORDER BY name").all() as DemoUser[];
}

export function listOrganizationMembers(organizationId: string) {
  return database.prepare("SELECT id, email, name, role, organization_id FROM users WHERE organization_id = ? ORDER BY name").all(organizationId) as DemoUser[];
}

export function getOrganization(organizationId: string) {
  return database.prepare("SELECT id, name FROM organizations WHERE id = ?").get(organizationId) as Organization | undefined;
}

export function listProjects(organizationId: string) {
  return database.prepare("SELECT id, name, color FROM projects WHERE organization_id = ? ORDER BY name").all(organizationId) as Project[];
}

export function listSuites(organizationId: string) {
  return database.prepare(`SELECT test_suites.id, test_suites.name, test_suites.project_id FROM test_suites
    JOIN projects ON projects.id = test_suites.project_id WHERE projects.organization_id = ? ORDER BY test_suites.name`).all(organizationId) as TestSuite[];
}

export function listTestCases(organizationId = DEMO_ORGANIZATION_ID) {
  return database.prepare("SELECT * FROM test_cases WHERE organization_id = ? ORDER BY updated_at DESC, id ASC").all(organizationId) as TestCase[];
}

export function createTestCase(user: DemoUser, input: NewTestCase) {
  const suite = database.prepare(`SELECT test_suites.id AS suite_id, test_suites.project_id AS project_id
    FROM test_suites JOIN projects ON projects.id = test_suites.project_id
    WHERE projects.organization_id = ? AND test_suites.name = ?`).get(user.organization_id, input.module) as { suite_id: string; project_id: string } | undefined;
  if (!suite) return null;

  const updatedAt = new Date().toISOString();
  const testCase: TestCase = {
    id: randomUUID(), organization_id: user.organization_id, project_id: suite.project_id, suite_id: suite.suite_id,
    title: input.title, module: input.module, test_type: input.test_type, priority: input.priority,
    status: "Not run", assignee: user.name.split(" ").map((part) => part[0]).join("").toUpperCase(),
    assignee_user_id: user.id, created_by_user_id: user.id, defect_id: null, updated_at: updatedAt,
  };

  const insert = database.prepare(`INSERT INTO test_cases
    (id, organization_id, project_id, suite_id, title, module, test_type, priority, status, assignee, assignee_user_id, created_by_user_id, defect_id, updated_at)
    VALUES (@id, @organization_id, @project_id, @suite_id, @title, @module, @test_type, @priority, @status, @assignee, @assignee_user_id, @created_by_user_id, @defect_id, @updated_at)`);
  const latestRun = database.prepare("SELECT id FROM test_runs WHERE organization_id = ? ORDER BY started_at DESC LIMIT 1").get(user.organization_id) as { id: string } | undefined;
  const save = database.transaction(() => {
    insert.run(testCase);
    if (latestRun) database.prepare("INSERT INTO test_run_results (id, run_id, test_case_id, status, duration_ms, created_at) VALUES (?, ?, ?, 'Not run', 0, ?)")
      .run(randomUUID(), latestRun.id, testCase.id, updatedAt);
    database.prepare("INSERT INTO activity_events (id, organization_id, actor_user_id, action, target, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(randomUUID(), user.organization_id, user.id, "added a test case", testCase.title, updatedAt);
  });
  save();
  return testCase;
}

export function updateTestCaseResult(organizationId: string, userId: string, id: string, status: TestStatus) {
  const updatedAt = new Date().toISOString();
  const update = database.transaction(() => {
    const result = database.prepare("UPDATE test_cases SET status = ?, updated_at = ? WHERE id = ? AND organization_id = ?")
      .run(status, updatedAt, id, organizationId);
    if (!result.changes) return null;
    const testCase = database.prepare("SELECT * FROM test_cases WHERE id = ? AND organization_id = ?").get(id, organizationId) as TestCase;
    const run = database.prepare("SELECT id FROM test_runs WHERE organization_id = ? ORDER BY started_at DESC LIMIT 1").get(organizationId) as { id: string } | undefined;
    if (run) database.prepare(`INSERT INTO test_run_results (id, run_id, test_case_id, status, duration_ms, created_at)
      VALUES (?, ?, ?, ?, 0, ?) ON CONFLICT(run_id, test_case_id) DO UPDATE SET status = excluded.status, created_at = excluded.created_at`)
      .run(randomUUID(), run.id, id, status, updatedAt);
    database.prepare("INSERT INTO activity_events (id, organization_id, actor_user_id, action, target, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(randomUUID(), organizationId, userId, `marked a test ${status.toLowerCase()}`, testCase.title, updatedAt);
    return testCase;
  });
  return update();
}

export function deleteTestCase(organizationId: string, userId: string, id: string) {
  const remove = database.transaction(() => {
    const testCase = database.prepare("SELECT title FROM test_cases WHERE id = ? AND organization_id = ?").get(id, organizationId) as { title: string } | undefined;
    if (!testCase) return false;
    database.prepare("DELETE FROM test_cases WHERE id = ? AND organization_id = ?").run(id, organizationId);
    database.prepare("INSERT INTO activity_events (id, organization_id, actor_user_id, action, target, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(randomUUID(), organizationId, userId, "deleted a test case", testCase.title, new Date().toISOString());
    return true;
  });
  return remove();
}

export function getLatestTestRun(organizationId: string): TestRun | null {
  const run = database.prepare("SELECT * FROM test_runs WHERE organization_id = ? ORDER BY started_at DESC LIMIT 1").get(organizationId) as Omit<TestRun, "results"> | undefined;
  if (!run) return null;
  const resultRows = database.prepare("SELECT status, COUNT(*) AS count FROM test_run_results WHERE run_id = ? GROUP BY status").all(run.id) as { status: TestStatus; count: number }[];
  const results: Record<TestStatus, number> = { Passed: 0, Failed: 0, Blocked: 0, "Not run": 0 };
  for (const result of resultRows) results[result.status] = result.count;
  return { ...run, results };
}

export function countTestRuns(organizationId: string) {
  return (database.prepare("SELECT COUNT(*) AS count FROM test_runs WHERE organization_id = ?").get(organizationId) as { count: number }).count;
}

export function listRunHistory(organizationId: string) {
  return database.prepare(`SELECT recent_runs.id AS day,
    SUM(CASE WHEN test_run_results.status = 'Passed' THEN 1 ELSE 0 END) AS passed,
    SUM(CASE WHEN test_run_results.status = 'Failed' THEN 1 ELSE 0 END) AS failed
    FROM (SELECT id, started_at FROM test_runs WHERE organization_id = ? ORDER BY started_at DESC LIMIT 7) AS recent_runs
    JOIN test_run_results ON test_run_results.run_id = recent_runs.id
    GROUP BY recent_runs.id, recent_runs.started_at ORDER BY recent_runs.started_at`).all(organizationId) as { day: string; passed: number; failed: number }[];
}

export function listActivity(organizationId: string): ActivityEvent[] {
  return database.prepare(`SELECT activity_events.id, users.name AS actor, activity_events.action, activity_events.target, activity_events.created_at
    FROM activity_events LEFT JOIN users ON users.id = activity_events.actor_user_id
    WHERE activity_events.organization_id = ? ORDER BY activity_events.created_at DESC LIMIT 5`).all(organizationId) as ActivityEvent[];
}

