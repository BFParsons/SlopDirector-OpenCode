/**
 * Generate guide/appendix-a-tools.md from the live MCP server's tool list.
 *   pnpm exec tsx scripts/gen-tool-reference.ts
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const GROUPS: [string, RegExp][] = [
  ["Project", /^(list_projects|create_project|get_project|update_project|delete_project)$/],
  ["Media", /^(import_media|import_youtube|list_media|probe_asset|set_music|set_lut)$/],
  ["Inspect", /^(get_frame|get_contact_sheet|detect_scenes|detect_silences|transcribe|analyze_audio)$/],
  ["Timeline", /^(add_segment|update_segments|split_segment|reorder_segments|delete_segment|add_text_overlay|remove_text_overlay|apply_edit_list)$/],
  ["Checkpoints", /^(create_checkpoint|list_checkpoints|restore_checkpoint|compare_versions)$/],
  ["Checks", /^(pacing_report|check_cuts|check_beat_alignment|verify_export)$/],
  ["Render", /^(render_draft|render_final|render_status|cancel_render|export_formats)$/],
  ["Guide", /^(search_guide|read_guide|list_guide|get_playbook)$/],
];

async function main() {
  const transport = new StdioClientTransport({ command: path.resolve("node_modules/.bin/tsx"), args: [path.resolve("mcp/server.ts")], env: process.env as Record<string, string>, stderr: "pipe" });
  const client = new Client({ name: "gen-tool-reference", version: "0.0.1" });
  await client.connect(transport);
  const { tools } = await client.listTools();
  const { resources } = await client.listResources();
  const { prompts } = await client.listPrompts();
  await client.close();
  const seen = new Set<string>();
  let md = `# Appendix A. MCP Tool Reference\n\n*Generated from the server (${tools.length} tools). Regenerate with \`pnpm exec tsx scripts/gen-tool-reference.ts\`.*\n\n`;
  for (const [group, re] of [...GROUPS, ["Other", /.*/] as [string, RegExp]]) {
    const rows = tools.filter((t) => re.test(t.name) && !seen.has(t.name));
    if (!rows.length) continue;
    md += `## ${group}\n\n`;
    for (const t of rows) {
      seen.add(t.name);
      const props = (t.inputSchema as { properties?: Record<string, { type?: string; description?: string; default?: unknown; enum?: unknown[] }>; required?: string[] }).properties ?? {};
      const req = new Set((t.inputSchema as { required?: string[] }).required ?? []);
      md += `### \`${t.name}\`\n\n${t.description ?? ""}\n\n`;
      const params = Object.entries(props);
      if (params.length) {
        md += "| Parameter | Type | Notes |\n|---|---|---|\n";
        for (const [k, v] of params) {
          const type = v.enum ? v.enum.map(String).join(" \\| ") : (v.type ?? "object");
          const notes = [req.has(k) ? "required" : v.default !== undefined ? `default ${JSON.stringify(v.default)}` : "optional", v.description ?? ""].filter(Boolean).join("; ");
          md += `| \`${k}\` | ${type} | ${notes} |\n`;
        }
        md += "\n";
      }
    }
  }
  md += `## Resources\n\n${resources.map((r) => `- \`${r.uri}\` — ${r.title ?? r.name}`).join("\n")}\n- \`slopstudio://projects/{projectId}\`, \`slopstudio://guide/{sectionId}\`, \`slopstudio://playbooks/{name}\` (templates)\n\n`;
  md += `## Prompts\n\n${prompts.map((p) => `- \`${p.name}\` — ${p.description ?? ""}`).join("\n")}\n`;
  writeFileSync("guide/appendix-a-tools.md", md);
  console.log(`wrote guide/appendix-a-tools.md (${tools.length} tools, ${resources.length} resources, ${prompts.length} prompts)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
