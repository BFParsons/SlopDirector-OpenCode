import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import type { Session, User } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { isProd } from "@/env";

export const SESSION_COOKIE = "sf_session";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TTL_MS = 1 * DAY_MS;
const REMEMBER_TTL_MS = 30 * DAY_MS;

export interface SessionContext {
  user: User;
  session: Session;
}

export async function createSession(
  userId: string,
  opts: { ip?: string; userAgent?: string; remember?: boolean } = {},
): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const ttl = opts.remember ? REMEMBER_TTL_MS : DEFAULT_TTL_MS;
  const expiresAt = new Date(Date.now() + ttl);

  await prisma.session.create({
    data: {
      id: token,
      userId,
      expiresAt,
      ip: opts.ip,
      userAgent: opts.userAgent?.slice(0, 512),
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

/**
 * Read + validate the current session. Performs sliding renewal: if a session
 * is past half its life, extend it. Returns null if missing/expired.
 */
export async function getSessionUser(): Promise<SessionContext | null> {
  // Desktop build: a single local user, no login screen. Resolve the seeded
  // admin (the first user) directly so every request is authenticated without a
  // session cookie. electron/main.js sets SLOPSTUDIO_DESKTOP=1.
  if (process.env.SLOPSTUDIO_DESKTOP === "1") {
    const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
    if (!user) return null;
    return {
      user,
      session: {
        id: "desktop-local",
        userId: user.id,
        expiresAt: new Date(Date.now() + REMEMBER_TTL_MS),
        ip: null,
        userAgent: null,
        createdAt: new Date(),
      } as Session,
    };
  }

  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { id: token },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: token } }).catch(() => {});
    return null;
  }

  const { user, ...sessionOnly } = session;
  return { user, session: sessionOnly as Session };
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.delete({ where: { id: token } }).catch(() => {});
    store.delete(SESSION_COOKIE);
  }
}
