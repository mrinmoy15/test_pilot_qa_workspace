import { deleteTestCase, updateTestCaseResult } from "@/lib/database";
import { getDemoUserFromRequest } from "@/lib/demo-session";
import { testStatuses, type TestStatus } from "@/lib/test-cases";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const user = getDemoUserFromRequest(request);
  if (!user) return Response.json({ error: "Choose a valid demo user." }, { status: 401 });
  const { id } = await context.params;
  if (!id) return Response.json({ error: "Test case ID is required." }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !testStatuses.includes((body as { status?: TestStatus }).status as TestStatus)) {
    return Response.json({ error: "Provide a supported test result." }, { status: 400 });
  }

  const status = (body as { status: TestStatus }).status;
  try {
    const testCase = updateTestCaseResult(user.organization_id, user.id, id, status);
    if (!testCase) return Response.json({ error: "Test case not found." }, { status: 404 });
    return Response.json(testCase);
  } catch {
    return Response.json({ error: "Could not update the test case in SQLite." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = getDemoUserFromRequest(_request);
  if (!user) return Response.json({ error: "Choose a valid demo user." }, { status: 401 });
  const { id } = await context.params;
  if (!id) return Response.json({ error: "Test case ID is required." }, { status: 400 });

  try {
    const deleted = deleteTestCase(user.organization_id, user.id, id);
    if (!deleted) return Response.json({ error: "Test case not found." }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: "Could not delete the test case from SQLite." }, { status: 500 });
  }
}
