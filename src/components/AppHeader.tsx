import Link from "next/link";
import { withBase } from "@/lib/basePath";
import { HeaderCost } from "./HeaderCost";
import { LogoutButton } from "./LogoutButton";

export function AppHeader({ email, role }: { email: string; role: string }) {
  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-3">
        <Link href="/start" className="flex items-center gap-2 font-semibold tracking-tight">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={withBase("/logo.png")} alt="" className="h-7 w-auto object-contain" />
          <span>
            Slop<span className="text-[var(--color-accent)]">Studio</span>
          </span>
        </Link>
        <div className="flex items-center gap-3 text-xs text-[var(--color-muted)]">
          <HeaderCost />
          <span>
            {email}
            {role === "ADMIN" ? " · admin" : ""}
          </span>
          {role === "ADMIN" ? (
            <Link href="/admin/users" className="hover:text-[var(--color-fg)]">
              Users
            </Link>
          ) : null}
          <Link href="/settings" className="hover:text-[var(--color-fg)]">
            Settings
          </Link>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
