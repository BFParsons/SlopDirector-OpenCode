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
      {/* The whole start screen is sized to the viewport (h-dvh): the option
          cards keep their natural height at the bottom and the CinemaBot hero
          takes whatever is left (capped at its 28rem design size). This keeps
          everything on screen on short displays — e.g. a 1080p laptop at 2x
          scale is only ~490 CSS px tall — instead of pushing the cards below
          the fold. `short:` tightens padding/icons under 640px tall. */}
      <main className="mx-auto flex h-dvh w-full max-w-5xl flex-col overflow-y-auto p-6 short:p-4">
        <div className="mb-3 flex min-h-0 flex-1 flex-col items-center justify-center text-center short:mb-2">
          {/* Animated CinemaBot — autoplays once (no loop) on load. Muted so the
              browser permits autoplay; the final frame stays on screen. The
              SLOP STUDIO PRO marquee wordmark is overlaid across its top. */}
          <div className="relative h-full max-h-[28rem] min-h-[9rem]">
            <video
              src={withBase("/cinemabot.webm")}
              autoPlay
              muted
              playsInline
              preload="auto"
              className="h-full w-auto object-contain"
              aria-label="CinemaBot"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={withBase("/logo.png")}
              alt="SlopStudio Pro"
              className="animate-marquee-on pointer-events-none absolute left-1/2 top-[4%] w-[88%] -translate-x-1/2 object-contain"
            />
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-4 md:grid-cols-4 short:gap-3">
          <NewStoryboardCard accent="var(--color-accent)" />
          <NewAssemblyCard accent="#2ec5c5" />
          <NewAudioStudioCard accent="#b07cff" />
          {MODES.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="squish-card group relative flex flex-col items-center overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center short:p-4"
              style={{ ["--mode-accent" as string]: m.accent }}
            >
              <span
                aria-hidden
                className="squish-bar pointer-events-none absolute inset-x-0 top-0 h-1"
                style={{ background: m.accent, opacity: m.primary ? 1 : 0.6 }}
              />
              {m.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={withBase(m.img)}
                  alt=""
                  aria-hidden
                  className="squish-icon mb-3 h-20 w-auto object-contain drop-shadow short:mb-2 short:h-14"
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
              <h2 className="squish-title text-lg font-semibold short:text-base">{m.title}</h2>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
