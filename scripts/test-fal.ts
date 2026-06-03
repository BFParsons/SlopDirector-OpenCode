/**
 * Exercise the fal.ai image-provider seam.
 *
 * Without a key it prints the request bodies the seam builds (logic check).
 * With FAL_KEY set it does a real generation and prints the result URL.
 *
 *   pnpm tsx --env-file=.env scripts/test-fal.ts
 */
import { env } from "@/env";
import { buildFalBody, falProvider } from "@/lib/images/fal";

async function main() {
  console.log("=== request construction ===");
  console.log(
    "text→image:",
    JSON.stringify(buildFalBody({ prompt: "a windswept prairie at golden hour", aspect: "R16_9", seed: 42 })),
  );
  console.log(
    "with style anchor:",
    JSON.stringify(
      buildFalBody({
        prompt: "the same prairie, now with a lone figure walking",
        aspect: "R16_9",
        styleRef: "data:image/png;base64,AAAA",
        styleStrength: 0.8,
      }),
    ),
  );

  if (!env.FAL_KEY) {
    console.log("\nFAL_KEY not set — skipping live generation.");
    console.log("Set FAL_KEY in .env to generate a real image.");
    return;
  }

  console.log("\n=== live generation ===");
  const images = await falProvider.generate(
    { prompt: "a cinematic wide shot of a quiet small-town main street, overcast", aspect: "R16_9" },
    env.FAL_KEY,
  );
  console.log("got", images.length, "image(s):");
  for (const im of images) console.log(`  ${im.url}  (${im.width}x${im.height}, seed ${im.seed})`);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
