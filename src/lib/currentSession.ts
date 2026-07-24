import "server-only";
import { cookies } from "next/headers";
import { getSessionRole, SESSION_COOKIE, type SessionRole } from "@/lib/session";

export async function getCurrentRole(): Promise<SessionRole | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return getSessionRole(token);
}
