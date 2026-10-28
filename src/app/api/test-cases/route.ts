import { createTestCase, listTestCases } from "@/lib/database";
import { getDemoUserFromRequest } from "@/lib/demo-session";
import { testPriorities, testTypes, type NewTestCase } from "@/lib/test-cases";

export async function GET(request: Request) {
  const user = getDemoUserFromRequest(request);
  if (!user) return Response.json({ error: "Choose a valid demo user." }, { status: 401 });
  try {
    return Response.json(listTestCases(user.organization_id), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not read test cases from SQLite." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = getDemoUserFromRequest(request);
  if (!user) return Response.json({ error: "Choose a valid demo user." }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Test case details are required." }, { status: 400 });
  }

  const input = body as Partial<NewTestCase>;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const moduleName = typeof input.module === "string" ? input.module.trim() : "";
  if (!title || title.length > 300 || !moduleName || moduleName.length > 80 ||
    !testTypes.includes(input.test_type as (typeof testTypes)[number]) ||
    !testPriorities.includes(input.priority as (typeof testPriorities)[number])) {
    return Response.json({ error: "Provide a title, module, supported test type, and priority." }, { status: 400 });
  }

  try {
    const testCase = createTestCase(user, { title, module: moduleName, test_type: input.test_type!, priority: input.priority! });
    if (!testCase) return Response.json({ error: "Choose a test suite in this workspace." }, { status: 400 });
    return Response.json(testCase, { status: 201 });
  } catch {
    return Response.json({ error: "Could not save the test case to SQLite." }, { status: 500 });
  }
}
