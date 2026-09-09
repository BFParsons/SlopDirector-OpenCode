/**
 * Write (or rewrite) the "## Type" section of every guide/styles/<id>.md from
 * src/lib/typography/styleType.ts, so the prose and the parameters the
 * harness enforces never drift apart. Run: pnpm exec tsx scripts/gen-style-type.ts
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { STYLE_TYPE } from "../src/lib/typography/styleType";
import { fontById } from "../src/lib/typography/fonts";

const dir = path.resolve(process.cwd(), "guide", "styles");
let n = 0;
for (const t of STYLE_TYPE) {
  const file = path.join(dir, `${t.style}.md`);
  if (!existsSync(file)) {
    console.warn(`no file for ${t.style}`);
    continue;
  }
  const roles = Object.entries(t.roles)
    .map(([role, r]) => {
      const f = fontById(r!.font);
      const bits = [f.family + (f.weight === 700 ? " Bold" : f.weight === 900 ? " Black" : f.weight === 300 ? " Light" : f.weight === 600 ? " SemiBold" : f.weight === 500 ? " Medium" : ""), r!.transform === "tracked-upper" ? "spaced capitals" : r!.transform === "upper" ? "capitals" : r!.transform === "lower" ? "lower-case" : null, r!.sizePct != null ? `${r!.sizePct} %` : null, r!.position ? r!.position.toLowerCase().replace("_", "-") : null, r!.color ? r!.color : null, r!.boxEnabled === false ? "no box" : r!.boxEnabled ? "box" : null, r!.outlineW ? `outline ${r!.outlineW} %` : null, r!.shadow ? `shadow ${r!.shadow} %` : null, r!.animation ? r!.animation.toLowerCase().replace("_", " ") : null, r!.holdS != null ? `hold ${r!.holdS} s` : null].filter(Boolean).join(" · ");
      return `- **${role}${role === t.defaultRole ? " (default)" : ""}** — ${r!.use}. ${bits}.`;
    })
    .join("\n");
  const section = [
    "## Type",
    "",
    `**The signature.** ${t.signature}`,
    "",
    `**Stand-ins.** ${t.standsFor} Faces: ${t.faces.map((f) => { const x = fontById(f); return `${x.family} ${x.weight}`; }).join(", ")}. Case: ${t.case === "tracked-upper" ? "spaced capitals" : t.case}. Colour ${t.color} on ${t.field}. Entrance: ${t.motion.toLowerCase().replace("_", " ")}.`,
    "",
    `**Roles** (\`add_text_overlay {role}\` with this style in the brief):`,
    "",
    roles,
    "",
    ...(t.noText ? ["**No text.** Beyond a title, this style puts nothing on the frame; `check_text` warns on any overlay.", ""] : []),
    ...(t.never?.length ? [`**Never:** ${t.never.join(", ")}.`, ""] : []),
    `**Survey note.** ${t.note}`,
    "",
  ].join("\n");
  const src = readFileSync(file, "utf8");
  const start = src.indexOf("\n## Type\n");
  let out: string;
  if (start >= 0) {
    const rest = src.slice(start + 1);
    const next = rest.indexOf("\n## ", 1);
    out = src.slice(0, start + 1) + section + (next >= 0 ? rest.slice(next + 1) : "");
  } else {
    // before "## Harness parameters" when present, else at the end
    const hp = src.indexOf("\n## Harness parameters");
    out = hp >= 0 ? src.slice(0, hp + 1) + section + "\n" + src.slice(hp + 1) : src.replace(/\n*$/, "\n\n") + section;
  }
  writeFileSync(file, out.replace(/\n{3,}/g, "\n\n"));
  n++;
}
console.log(`wrote Type sections into ${n} style files`);
