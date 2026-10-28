export const testStatuses = ["Passed", "Failed", "Blocked", "Not run"] as const;
export const testPriorities = ["Critical", "High", "Medium", "Low"] as const;
export const testTypes = ["Manual", "Automation"] as const;

export type TestStatus = (typeof testStatuses)[number];
export type Priority = (typeof testPriorities)[number];
export type TestType = (typeof testTypes)[number];

export type TestCase = {
  id: string;
  organization_id: string;
  project_id: string | null;
  suite_id: string | null;
  title: string;
  module: string;
  test_type: TestType;
  priority: Priority;
  status: TestStatus;
  assignee: string;
  assignee_user_id: string | null;
  created_by_user_id: string | null;
  defect_id: string | null;
  updated_at: string;
};

export type NewTestCase = Pick<TestCase, "title" | "module" | "test_type" | "priority">;

export type DemoUser = { id: string; email: string; name: string; role: string; organization_id: string };
export type Organization = { id: string; name: string };
export type Project = { id: string; name: string; color: string };
export type TestSuite = { id: string; name: string; project_id: string };
export type TestRun = {
  id: string;
  name: string;
  run_number: number;
  project_id: string | null;
  suite_id: string | null;
  environment: string;
  browser: string;
  status: "Completed" | "In progress";
  started_at: string;
  results: Record<TestStatus, number>;
};
export type ActivityEvent = { id: string; actor: string; action: string; target: string; created_at: string };

export function isTestCase(value: unknown): value is TestCase {
  if (!value || typeof value !== "object") return false;
  const test = value as Record<string, unknown>;

  return typeof test.id === "string" && typeof test.title === "string" && test.title.trim().length > 0 &&
    typeof test.organization_id === "string" && (typeof test.project_id === "string" || test.project_id === null) &&
    (typeof test.suite_id === "string" || test.suite_id === null) && typeof test.module === "string" &&
    testTypes.includes(test.test_type as TestType) &&
    testPriorities.includes(test.priority as Priority) && testStatuses.includes(test.status as TestStatus) &&
    typeof test.assignee === "string" && (typeof test.assignee_user_id === "string" || test.assignee_user_id === null) &&
    (typeof test.created_by_user_id === "string" || test.created_by_user_id === null) &&
    (test.defect_id === null || typeof test.defect_id === "string") &&
    typeof test.updated_at === "string" && Number.isFinite(Date.parse(test.updated_at));
}
