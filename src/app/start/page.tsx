import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { NewAssemblyCard } from "@/components/NewAssemblyCard";
import { NewAudioStudioCard } from "@/components/NewAudioStudioCard";
import { NewStoryboardCard } from "@/components/NewStoryboardCard";
import { requirePageUser } from "@/lib/auth/rbac";
import { withBase } from "@/lib/basePath";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

interface Mode {
  href: string;
  glyph: string;
  img?: string;
  title: string;
  blurb: string;
  detail: string;
  accent: string;
  primary?: boolean;
}

const MODES: Mode[] = [
  {
    href: "/dashboard",
    glyph: "◳",
    img: "/slop/oldslop.png",
    title: "Open project",
    blurb: "Pick up where you left off.",
    detail: "Reopen any of your existing videos to keep editing or re-render.",
    accent: "#e0a93f",
  },
];

export default async function StartPage() {
  const { user } = await requirePageUser();
  const recentCount = await prisma.project.count({
    where: { userId: user.id, deletedAt: null },
  });

  return (
    <>
      <AppHeader email={user.email} role={user.role} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center p-6">
        <div className="mb-8 flex flex-col items-center text-center">
          {/* Animated CinemaBot logo — autoplays once (no loop) on load. Muted so
              the browser permits autoplay; the final frame stays on screen. */}
          <video
            src={withBase("/cinemabot.webm")}
            autoPlay
            muted
            playsInline
            preload="auto"
            className="h-40 w-auto object-contain md:h-56"
            aria-label="CinemaBot"
          />
          <h1 className="mt-4 text-2xl font-semibold">Start a new video</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Choose how you want to begin.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <NewStoryboardCard accent="var(--color-accent)" />
          <NewAssemblyCard accent="#2ec5c5" />
          <NewAudioStudioCard accent="#b07cff" />
          {MODES.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 transition duration-200 ease-spring hover:-translate-y-1 hover:shadow-lift"
              style={{ ["--mode-accent" as string]: m.accent }}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-1"
                style={{ background: m.accent, opacity: m.primary ? 1 : 0.6 }}
              />
              {m.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={withBase(m.img)}
                  alt=""
                  aria-hidden
                  className="mb-3 h-20 w-auto self-start object-contain drop-shadow"
                />
              ) : (
                <span
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
                  style={{
                    color: m.accent,
                    background: `color-mix(in srgb, ${m.accent} 14%, transparent)`,
                  }}
                >
                  {m.glyph}
                </span>
              )}
              <h2 className="text-lg font-semibold">
                {m.title}
                {m.href === "/dashboard" && recentCount > 0 ? (
                  <span className="ml-2 text-xs font-normal text-[var(--color-muted)]">
                    {recentCount}
                  </span>
                ) : null}
              </h2>
              <p className="mt-1 text-sm font-medium text-[var(--color-fg)]">{m.blurb}</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                {m.detail}
              </p>
              <span
                className="mt-4 text-sm font-medium opacity-0 transition group-hover:opacity-100"
                style={{ color: m.accent }}
              >
                {m.href === "/dashboard" ? "Browse →" : "Start →"}
              </span>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
