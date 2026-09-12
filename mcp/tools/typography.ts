/**
 * Typography and safe areas (guide Part II §12): the presets and faces the
 * harness can set, the safe rectangles for a project's frame, and the
 * mechanical check that every burned-in text sits inside them and reads.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FONTS, SAFE_PROFILES, TYPE_PRESETS, TYPE_ROLES, checkText, presetForStyle, roleSpecFor, safeAreas, typeSystemFor } from "../../src/lib/typography";
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
      const style = typeSystemFor(styleId);
      return text({
        frame,
        safe,
        profiles: SAFE_PROFILES,
        styleType: style ? { ...style, roles: { ...style.roles, title: roleSpecFor(style, "title") } } : null,
        hierarchy: {
          title: "The name of the standalone clip or film. Design its font, palette, composition and reveal separately; role=title. Usually 8–12% landscape height or 6–8% portrait, with a dedicated readable hold. Quiet styles can establish prominence through space instead of size.",
          supportingText: "Cards, chapters, captions, labels and credits serve the story. Keep a consistent supporting family and reserve the title treatment for the film's identity. A slogan or CTA is a card, not automatically a title.",
        },
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
        "Mechanical typography check (guide §12): safe areas, readable size, line length, reading time and overlapping text. Film titles may have independent fonts and casing; otherwise no-text styles permit their title and specified credits. Supporting text is checked against its directing style's faces and role-specific case. Runs inside verify_export too.",
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
