import "server-only";
import { DEMO_USERS, findDemoUser } from "@/lib/database";

export const DEMO_SESSION_COOKIE = "testpilot_demo_user";
export const DEFAULT_DEMO_EMAIL = DEMO_USERS[0].email;

export function getDemoUserFromRequest(request: Request) {
  const cookies = request.headers.get("cookie") ?? "";
  const entry = cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${DEMO_SESSION_COOKIE}=`));
  let email = DEFAULT_DEMO_EMAIL;
  if (entry) {
    try { email = decodeURIComponent(entry.slice(DEMO_SESSION_COOKIE.length + 1)); }
    catch { return undefined; }
  }
  return findDemoUser(email);
}

export function demoSessionCookie(email: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${DEMO_SESSION_COOKIE}=${encodeURIComponent(email)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secure}`;
}
