/**
 * Print the host capabilities SlopStudio detected, plus the encoder + concurrency
 * it would use. Handy for confirming GPU encode is picked up on a given machine.
 *
 *   pnpm tsx scripts/probe-capabilities.ts
 */
import {
  getCapabilities,
  resolveConcurrency,
  resolveEncoder,
} from "@/lib/system/capabilities";

async function main() {
  const caps = await getCapabilities();
  const [enc, conc] = await Promise.all([resolveEncoder(), resolveConcurrency()]);

  console.log("=== SlopStudio host capabilities ===");
  console.log(JSON.stringify(caps, null, 2));
  console.log("\nChosen encoder:   ", enc.label, `(${enc.kind})`);
  console.log("Concurrency:      ", conc);
  console.log(
    "\nTier:",
    caps.tier,
    caps.tier === 0
      ? "(CPU only — cloud gen + x264 encode)"
      : caps.tier === 1
        ? "(hardware encode available)"
        : "(strong discrete GPU — local AI gen feasible)",
  );
}

main().catch((e) => {
  console.error("probe failed:", e);
  process.exit(1);
});
