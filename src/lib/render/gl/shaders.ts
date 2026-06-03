/**
 * Custom PixiJS v8 filters for effects with no built-in equivalent: chroma key
 * and unsharp-mask sharpen. Each pairs with its ffmpeg builder in
 * `@/config/effects` (chromakey / unsharp).
 *
 * Uniforms are declared flat (not in a std140 block); v8's WebGL backend syncs a
 * filter resource group's uniforms individually, which sidesteps UBO layout.
 */
import type { Filter } from "pixi.js";

type Pixi = typeof import("pixi.js");

// Standard PixiJS v8 filter vertex — maps the quad and yields vTextureCoord.
const VERT = `in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
vec4 filterVertexPosition( void ) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
vec2 filterTextureCoord( void ) {
  return aPosition * (uOutputFrame.zw * uInputSize.zw);
}
void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
}`;

// Chroma key: alpha falls off as a pixel's colour nears the key colour. Pixi
// textures are premultiplied, so scaling the whole sample by `a` is correct.
const CHROMA_FRAG = `in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec3 uKey;
uniform float uSimilarity;
uniform float uBlend;
void main(void) {
  vec4 c = texture(uTexture, vTextureCoord);
  vec3 rgb = c.a > 0.0001 ? c.rgb / c.a : c.rgb; // un-premultiply for the colour compare
  float d = distance(rgb, uKey);
  float a = smoothstep(uSimilarity, uSimilarity + uBlend + 0.001, d);
  finalColor = c * a;
}`;

// Unsharp mask: 4-neighbour high-pass added back, scaled by amount.
const SHARPEN_FRAG = `in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform float uAmount;
void main(void) {
  vec2 px = uInputSize.zw;
  vec4 c = texture(uTexture, vTextureCoord);
  vec4 n = texture(uTexture, vTextureCoord + vec2(px.x, 0.0))
         + texture(uTexture, vTextureCoord - vec2(px.x, 0.0))
         + texture(uTexture, vTextureCoord + vec2(0.0, px.y))
         + texture(uTexture, vTextureCoord - vec2(0.0, px.y));
  vec4 sharp = c + uAmount * (c * 4.0 - n);
  finalColor = vec4(clamp(sharp.rgb, 0.0, c.a > 0.0 ? c.a : 1.0), c.a);
}`;

export function makeChromaKey(
  pixi: Pixi,
  rgb: [number, number, number],
  similarity: number,
  blend: number,
): Filter {
  return new pixi.Filter({
    glProgram: pixi.GlProgram.from({ vertex: VERT, fragment: CHROMA_FRAG, name: "slop-chroma" }),
    resources: {
      chromaUniforms: {
        uKey: { value: new Float32Array(rgb), type: "vec3<f32>" },
        uSimilarity: { value: similarity, type: "f32" },
        uBlend: { value: blend, type: "f32" },
      },
    },
  });
}

export function makeSharpen(pixi: Pixi, amount: number): Filter {
  return new pixi.Filter({
    glProgram: pixi.GlProgram.from({ vertex: VERT, fragment: SHARPEN_FRAG, name: "slop-sharpen" }),
    resources: {
      sharpenUniforms: {
        uAmount: { value: amount, type: "f32" },
      },
    },
  });
}

/** "#rrggbb" → normalized [r,g,b] in 0..1 (defaults to green on bad input). */
export function hexToRgb01(hex: string): [number, number, number] {
  const h = (hex || "").replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return [0, 1, 0];
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}
