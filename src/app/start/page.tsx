import Link from "next/link";
import { NewAssemblyCard } from "@/components/NewAssemblyCard";
import { NewAudioStudioCard } from "@/components/NewAudioStudioCard";
import { NewStoryboardCard } from "@/components/NewStoryboardCard";
import { requirePageUser } from "@/lib/auth/rbac";
import { withBase } from "@/lib/basePath";

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
    detail: "Reopen any of your existing projects to keep editing or re-render.",
    accent: "#e0a93f",
  },
];

export default async function StartPage() {
  await requirePageUser();

  return (
    <>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-start p-6">
        <div className="mb-2 flex flex-col items-center text-center">
          {/* Animated CinemaBot — autoplays once (no loop) on load. Muted so the
              browser permits autoplay; the final frame stays on screen. The
              SLOP STUDIO PRO marquee wordmark is overlaid across its top. */}
          <div className="relative mt-6 inline-block">
            <video
              src={withBase("/cinemabot.webm")}
              autoPlay
              muted
              playsInline
              preload="auto"
              className="h-80 w-auto object-contain md:h-[28rem]"
              aria-label="CinemaBot"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={withBase("/logo.png")}
              alt="SlopStudio Pro"
              className="pointer-events-none absolute left-1/2 top-2 w-[88%] -translate-x-1/2 object-contain [filter:drop-shadow(0_2px_6px_rgba(0,0,0,0.65))] md:top-6"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <NewStoryboardCard accent="var(--color-accent)" />
          <NewAssemblyCard accent="#2ec5c5" />
          <NewAudioStudioCard accent="#b07cff" />
          {MODES.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group relative flex flex-col items-center overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center transition duration-200 ease-spring hover:-translate-y-1 hover:shadow-lift"
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
                  className="mb-3 h-20 w-auto object-contain drop-shadow"
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
              <h2 className="text-lg font-semibold">{m.title}</h2>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
