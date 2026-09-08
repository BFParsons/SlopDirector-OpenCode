"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * A small fixed Home button in the top-left corner, on every screen that lacks
 * its own top bar. Hidden on the home screen itself, the pre-auth login screen,
 * and the Studio editor (whose toolbar logo already links home).
 */
export function HomeButton() {
  const pathname = usePathname() || "";
  const hide =
    pathname === "/" ||
    pathname === "/start" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/projects/");
  if (hide) return null;

  return (
    <Link
      href="/start"
      title="Home"
      aria-label="Home"
      className="fixed left-3 top-3 z-[120] flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/80 text-[var(--color-fg)] backdrop-blur transition hover:-translate-y-0.5 hover:border-[var(--color-fg)] hover:bg-[var(--color-surface)]"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10h14V10" />
      </svg>
    </Link>
  );
}
