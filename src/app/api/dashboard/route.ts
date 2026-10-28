import {
  countTestRuns, getLatestTestRun, getOrganization, listActivity, listOrganizationMembers, listProjects, listRunHistory, listSuites, listTestCases,
} from "@/lib/database";
import { getDemoUserFromRequest } from "@/lib/demo-session";

export async function GET(request: Request) {
  const user = getDemoUserFromRequest(request);
  if (!user) return Response.json({ error: "Demo user not found." }, { status: 401 });

  const organizationId = user.organization_id;
  return Response.json({
    user,
    organization: getOrganization(organizationId),
    projects: listProjects(organizationId),
    suites: listSuites(organizationId),
    members: listOrganizationMembers(organizationId),
    testCases: listTestCases(organizationId),
    latestRun: getLatestTestRun(organizationId),
    totalRuns: countTestRuns(organizationId),
    runHistory: listRunHistory(organizationId),
    activity: listActivity(organizationId),
  }, { headers: { "Cache-Control": "no-store" } });
}
