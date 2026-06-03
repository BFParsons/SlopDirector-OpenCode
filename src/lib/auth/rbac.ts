import { redirect } from "next/navigation";
import type { Role } from "@/lib/db/enums";
import { getSessionUser, type SessionContext } from "./session";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

const ROLE_RANK: Record<Role, number> = { USER: 1, ADMIN: 2 };

/** Route-handler guard. Throws AuthError, which handleApiError maps to a response. */
export async function requireApiUser(): Promise<SessionContext> {
  const ctx = await getSessionUser();
  if (!ctx) throw new AuthError("Unauthorized", 401);
  return ctx;
}

export async function requireApiRole(role: Role): Promise<SessionContext> {
  const ctx = await requireApiUser();
  if (ROLE_RANK[ctx.user.role] < ROLE_RANK[role]) {
    throw new AuthError("Forbidden", 403);
  }
  return ctx;
}

/** Server-component / page guard. Redirects to /login when unauthenticated. */
export async function requirePageUser(): Promise<SessionContext> {
  const ctx = await getSessionUser();
  if (!ctx) redirect("/login");
  return ctx;
}
