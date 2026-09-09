/**
 * Typography and safe areas (guide Part II §12): the presets and faces the
 * harness can set, the safe rectangles for a project's frame, and the
 * mechanical check that every burned-in text sits inside them and reads.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FONTS, SAFE_PROFILES, TYPE_PRESETS, TYPE_ROLES, checkText, presetForStyle, safeAreas, typeSystemFor } from "../../src/lib/typography";
import { api, snapshot, frameOf } from "../client";
import { guarded, text } from "../format";

export function registerTypographyTools(server: McpServer) {
  server.registerTool(
    "list_typography",
    {
      title: "Typography presets, faces and safe areas",
      description:
        "What add_text_overlay can do: for a project, its directing style's type system (`styleType`: the surveyed signature, which bundled faces stand in for the real typefaces, the case, the colour, the entrance, and the roles it puts on the frame — pass `role` to add_text_overlay to use it), the frame's action-safe and title-safe rectangles, the generic presets, the bundled faces and the safe-area profiles.",
      inputSchema: { projectId: z.string().optional(), profile: z.enum(SAFE_PROFILES).optional().describe("preview another safe-area profile for this frame") },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ projectId, profile }) => {
      let frame = { w: 1920, h: 1080 };
      let safeProfile: string | null = profile ?? null;
      let styleId: string | null = null;
      if (projectId) {
        const s = await snapshot(projectId);
        const f = frameOf(s);
        frame = { w: f.w, h: f.h };
        safeProfile = profile ?? s.safeArea ?? null;
        try {
          const b = await api.get<{ brief: { production?: { style?: { id: string } } } | null }>(`/api/projects/${projectId}/brief`);
          styleId = b.brief?.production?.style?.id ?? null;
        } catch {
          /* no brief */
        }
      }
      const safe = safeAreas(frame.w, frame.h, safeProfile);
      return text({
        frame,
        safe,
        profiles: SAFE_PROFILES,
        styleType: typeSystemFor(styleId) ?? null,
        stylePreset: styleId ? { style: styleId, preset: presetForStyle(styleId).id } : null,
        roles: TYPE_ROLES,
        presets: TYPE_PRESETS,
        fonts: FONTS.map((f) => ({ id: f.id, family: f.family, weight: f.weight, kind: f.kind, voice: f.voice })),
      });
    }),
  );

  server.registerTool(
    "check_text",
    {
      title: "Check burned-in text",
      description:
        "Mechanical typography check (guide §12) on the project's text overlays: every text box inside the title-safe area (error outside action-safe), readable size, line length, three lines at most, reading time against the hold, two texts on top of each other — and, when the brief names a directing style, its type: no text on a no-text style, one family, the style's case, the roles it uses. Runs inside verify_export too.",
      inputSchema: { projectId: z.string(), profile: z.enum(SAFE_PROFILES).optional().describe("check against another safe-area profile (default: the project's)") },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ projectId, profile }) => {
      const s = await snapshot(projectId);
      const f = frameOf(s);
      const durationS = s.segments.filter((x) => x.track === 0 && !x.audioOnly && !x.library).reduce((a, x) => a + x.durationS, 0) || null;
      let styleId: string | null = null;
      try {
        const b = await api.get<{ brief: { production?: { style?: { id: string } } } | null }>(`/api/projects/${projectId}/brief`);
        styleId = b.brief?.production?.style?.id ?? null;
      } catch {
        /* no brief */
      }
      const r = checkText(s.textOverlays, { w: f.w, h: f.h }, profile ?? s.safeArea, durationS, typeSystemFor(styleId) ?? null);
      return text({ ...r, style: styleId, overlays: s.textOverlays.length });
    }),
  );
}
