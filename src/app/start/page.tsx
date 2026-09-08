import { NewAssemblyCard } from "@/components/NewAssemblyCard";
import { NewAudioStudioCard } from "@/components/NewAudioStudioCard";
import { requirePageUser } from "@/lib/auth/rbac";
import { withBase } from "@/lib/basePath";

export const dynamic = "force-dynamic";

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

        <div className="grid shrink-0 grid-cols-2 gap-4 short:gap-3">
          <NewAssemblyCard accent="#2ec5c5" />
          <NewAudioStudioCard accent="#b07cff" />
        </div>
      </main>
    </>
  );
}
