/**
 * Typography and safe areas (guide Part II §12): the presets and faces the
 * harness can set, the safe rectangles for a project's frame, and the
 * mechanical check that every burned-in text sits inside them and reads.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FONTS, SAFE_PROFILES, TYPE_PRESETS, checkText, presetForStyle, safeAreas } from "../../src/lib/typography";
import { api, snapshot, frameOf } from "../client";
import { guarded, text } from "../format";

export function registerTypographyTools(server: McpServer) {
  server.registerTool(
    "list_typography",
    {
      title: "Typography presets, faces and safe areas",
      description:
        "What add_text_overlay can do: the presets (a use resolved to a face, size, placement inside title-safe, treatment and entrance), the bundled faces, the safe-area profiles, and — for a project — its frame's action-safe and title-safe rectangles and the preset its directing style reaches for first.",
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
        stylePreset: styleId ? { style: styleId, preset: presetForStyle(styleId).id } : null,
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
        "Mechanical typography check (guide §12) on the project's text overlays: every text box inside the title-safe area (error outside action-safe), readable size, line length, three lines at most, reading time against the hold, two texts on top of each other. Runs inside verify_export too.",
      inputSchema: { projectId: z.string(), profile: z.enum(SAFE_PROFILES).optional().describe("check against another safe-area profile (default: the project's)") },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ projectId, profile }) => {
      const s = await snapshot(projectId);
      const f = frameOf(s);
      const durationS = s.segments.filter((x) => x.track === 0 && !x.audioOnly && !x.library).reduce((a, x) => a + x.durationS, 0) || null;
      const r = checkText(s.textOverlays, { w: f.w, h: f.h }, profile ?? s.safeArea, durationS);
      return text({ ...r, overlays: s.textOverlays.length });
    }),
  );
}
