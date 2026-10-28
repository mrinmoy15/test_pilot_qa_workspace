import { DEMO_USERS, findDemoUser, listDemoUsers } from "@/lib/database";
import { DEFAULT_DEMO_EMAIL, demoSessionCookie, getDemoUserFromRequest } from "@/lib/demo-session";

export async function GET(request: Request) {
  const user = getDemoUserFromRequest(request) ?? findDemoUser(DEFAULT_DEMO_EMAIL) ?? DEMO_USERS[0];
  return Response.json({ user, users: listDemoUsers(), mode: "demo" }, {
    headers: { "Cache-Control": "no-store", "Set-Cookie": demoSessionCookie(user.email) },
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const email = body && typeof body === "object" && "email" in body && typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const user = findDemoUser(email);
  if (!user) return Response.json({ error: "Choose one of the seeded demo accounts." }, { status: 400 });
  return Response.json({ user, users: listDemoUsers(), mode: "demo" }, {
    headers: { "Cache-Control": "no-store", "Set-Cookie": demoSessionCookie(user.email) },
  });
}
