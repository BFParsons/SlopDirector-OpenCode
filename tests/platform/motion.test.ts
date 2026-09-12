import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { ffmpegPath } from "../../src/lib/ffmpeg/binary";
import { zoompanTransformFilter, type ClipTransform } from "../../src/lib/render/transform";
import { imageMotionFilter } from "../../src/lib/ffmpeg/args";
import type { ImageMotion } from "../../src/lib/db/enums";

// Measure actual rendered motion, not the filter string. A narrow white marker
// reveals held frames and pixel jumps that can hide in a textured painting.
const w = 320, h = 180, fps = 30, seconds = 3, frames = fps * seconds;
function positions(tr: ClipTransform): number[] {
  const filter = zoompanTransformFilter(tr, w, h, seconds, fps);
  const pixels = execFileSync(ffmpegPath(), ["-v", "error", "-f", "lavfi", "-i",
    `color=black:s=${w}x${h}:r=${fps}:d=${seconds},drawbox=x=169:y=0:w=3:h=ih:color=white:t=fill`,
    "-vf", filter, "-frames:v", String(frames), "-pix_fmt", "gray", "-f", "rawvideo", "pipe:1"], { maxBuffer: w * h * frames * 2 });
  assert.equal(pixels.length, w * h * frames, "duration and output dimensions must be preserved");
  return Array.from({ length: frames }, (_, n) => {
    let weight = 0, sum = 0;
    for (let x = 0; x < w; x++) { const value = pixels[n * w * h + Math.floor(h / 2) * w + x]; weight += value; sum += value * x; }
    assert.ok(weight > 0, "the crop must retain the marker");
    return sum / weight;
  });
}

test("slow pans move between pixels instead of holding and jumping", () => {
  const xs = positions({ scale: [{ t: 0, v: 2 }], posX: [{ t: 0, v: 0 }, { t: 1, v: .05 }], posY: [] });
  const steps = xs.slice(1).map((x, i) => x - xs[i]);
  assert.ok(xs[0] - xs.at(-1)! > 7.5 && xs[0] - xs.at(-1)! < 8.5, "pan should travel eight output pixels");
  assert.ok(Math.max(...steps.map(Math.abs)) < .2, "no whole-pixel jumps");
  assert.ok(steps.filter(x => Math.abs(x) < .005).length < frames * .1, "no long runs of frozen frames");
});

test("slow zoom preserves the path without crop wobble", () => {
  const xs = positions({ scale: [{ t: 0, v: 3.1 }, { t: 1, v: 3.3 }], posX: [], posY: [] });
  const steps = xs.slice(1).map((x, i) => x - xs[i]);
  assert.ok(xs.at(-1)! - xs[0] > 1.5 && xs.at(-1)! - xs[0] < 2.5, "zoom must reach its intended endpoint");
  assert.ok(Math.max(...steps.map(Math.abs)) < .15, "no wobble from integer crop boundaries");
});

test("static framing stays still and identity stays a no-op", () => {
  assert.equal(zoompanTransformFilter(null, w, h, seconds, fps), "");
  const xs = positions({ scale: [{ t: 0, v: 2 }], posX: [], posY: [] });
  assert.ok(xs.every(x => x === xs[0]));
});

test("every still-motion preset emits exactly the requested frames and dimensions", () => {
  const modes: ImageMotion[] = ["ZOOM_IN", "ZOOM_OUT", "SUBTLE_ZOOM_IN", "SUBTLE_ZOOM_OUT", "PAN_LEFT", "PAN_RIGHT", "PAN_UP", "PAN_DOWN"];
  for (const motion of modes) {
    const pixels = execFileSync(ffmpegPath(), ["-v", "error", "-f", "lavfi", "-i", "testsrc2=s=96x128:r=30:d=0.034",
      "-vf", `trim=end_frame=1,${imageMotionFilter(motion, 160, 90, 1)}`, "-pix_fmt", "gray", "-f", "rawvideo", "pipe:1"], { maxBuffer: 160 * 90 * 60 });
    assert.equal(pixels.length, 160 * 90 * 30, `${motion} must produce one second at 30 fps`);
    assert.notDeepEqual(pixels.subarray(0, 160 * 90), pixels.subarray(-160 * 90), `${motion} must move`);
  }
});
