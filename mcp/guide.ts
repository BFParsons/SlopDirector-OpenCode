/**
 * The editing guide as harness knowledge (guide/):
 *   - RULES.md       → always-on: folded into the server instructions and prompts
 *   - editing-guide.md → chapters as resources + a search tool (on demand)
 *   - playbooks/*.md → task procedures as prompts + a lookup tool
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { guarded, text } from "./format";

export function guideDir(): string {
  if (process.env.SLOPSTUDIO_GUIDE_DIR) return process.env.SLOPSTUDIO_GUIDE_DIR;
  const fromScript = process.argv[1] ? path.resolve(path.dirname(process.argv[1]), "..", "guide") : null;
  if (fromScript && existsSync(fromScript)) return fromScript;
  return path.resolve(process.cwd(), "guide");
}

export interface Section {
  id: string;
  part: string;
  chapter: string;
  title: string;
  level: number;
  text: string;
  rules: string[];
}

const slug = (s: string) =>
  s.toLowerCase().replace(/\\\./g, ".").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

let cache: { sections: Section[]; rules: string; playbooks: Map<string, { name: string; title: string; text: string }>; styles: Map<string, { id: string; title: string; text: string }> } | null = null;

export function loadGuide() {
  if (cache) return cache;
  const dir = guideDir();
  const rules = existsSync(path.join(dir, "RULES.md")) ? readFileSync(path.join(dir, "RULES.md"), "utf8") : "";
  const sections: Section[] = [];
  const master = path.join(dir, "editing-guide.md");
  if (existsSync(master)) {
    const lines = readFileSync(master, "utf8").split("\n");
    let part = "";
    let chapter = "";
    let cur: Section | null = null;
    const flush = () => {
      if (cur) {
        cur.text = cur.text.trim();
        cur.rules = cur.text.split("\n").filter((l) => /^\*\*Rule[^*]*\*\*/.test(l.trim()) || /^\*Mechanical check:\*/.test(l.trim()));
        if (cur.text) sections.push(cur);
      }
      cur = null;
    };
    for (const raw of lines) {
      const h1 = /^# (.+)/.exec(raw);
      const h2 = /^## (.+)/.exec(raw);
      const h3 = /^### (.+)/.exec(raw);
      if (h1) {
        flush();
        part = h1[1].replace(/\\/g, "").trim();
        continue;
      }
      // The outline at the top lists every heading once more; index the body only.
      const inToc = /table of contents/i.test(part);
      if (h2) {
        flush();
        chapter = h2[1].replace(/\\/g, "").trim();
        if (inToc) continue;
        cur = { id: slug(chapter), part, chapter, title: chapter, level: 2, text: "", rules: [] };
        continue;
      }
      if (h3) {
        flush();
        const title = h3[1].replace(/\\/g, "").trim();
        if (inToc) continue;
        cur = { id: `${slug(chapter)}--${slug(title)}`, part, chapter, title, level: 3, text: "", rules: [] };
        continue;
      }
      if (cur) cur.text += raw + "\n";
    }
    flush();
  }
  const playbooks = new Map<string, { name: string; title: string; text: string }>();
  const pbDir = path.join(dir, "playbooks");
  if (existsSync(pbDir)) {
    for (const f of readdirSync(pbDir).filter((x) => x.endsWith(".md")).sort()) {
      const t = readFileSync(path.join(pbDir, f), "utf8");
      const name = f.replace(/\.md$/, "");
      const title = /^# (.+)/m.exec(t)?.[1] ?? name;
      playbooks.set(name, { name, title, text: t });
    }
  }
  // Directing styles (guide/styles/<id>.md; parameters in src/lib/styles).
  const styles = new Map<string, { id: string; title: string; text: string }>();
  const stDir = path.join(dir, "styles");
  if (existsSync(stDir)) {
    for (const f of readdirSync(stDir).filter((x) => x.endsWith(".md") && x !== "README.md").sort()) {
      const t = readFileSync(path.join(stDir, f), "utf8");
      const id = f.replace(/\.md$/, "");
      styles.set(id, { id, title: /^# (.+)/m.exec(t)?.[1] ?? id, text: t });
    }
  }
  cache = { sections, rules, playbooks, styles };
  return cache;
}

const tokens = (s: string) => s.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];

// Loose stemming: "cuts"/"cutting" match "cut"; prefixes only from 4 letters.
const matches = (word: string, term: string) => word === term || (term.length >= 4 && word.startsWith(term)) || (word.length >= 4 && term.startsWith(word));

export function searchGuide(query: string, limit = 5, rulesOnly = false) {
  const { sections } = loadGuide();
  const q = [...new Set(tokens(query))];
  if (!q.length) return [];
  const docs = sections.map((s) => ({ s, title: tokens(s.title + " " + s.chapter), body: tokens(rulesOnly ? s.rules.join(" ") : s.text) }));
  // Rare terms decide the ranking ("jump" over "cut"): inverse document frequency.
  const idf = new Map<string, number>();
  for (const t of q) {
    const df = docs.filter((d) => d.body.some((w) => matches(w, t)) || d.title.some((w) => matches(w, t))).length;
    idf.set(t, Math.log((docs.length + 1) / (df + 1)) + 1);
  }
  const scored = docs.map(({ s, title, body }) => {
    let score = 0;
    let hits = 0;
    for (const t of q) {
      const inTitle = title.filter((w) => matches(w, t)).length;
      const inBody = body.filter((w) => matches(w, t)).length;
      if (inTitle + inBody === 0) continue;
      hits++;
      score += (Math.min(inTitle, 2) * 2 + Math.min(inBody, 6)) * (idf.get(t) ?? 1);
    }
    // Sections that contain every query term win over partial matches.
    score *= 1 + hits / q.length;
    return { s, score: +score.toFixed(2) };
  });
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ s, score }) => ({ id: s.id, chapter: s.chapter, title: s.title, score, rules: s.rules.slice(0, 12), excerpt: rulesOnly ? undefined : s.text.slice(0, 700) }));
}

export function findSection(ref: string): Section | null {
  const { sections } = loadGuide();
  const r = ref.trim().toLowerCase();
  return (
    sections.find((s) => s.id === r) ??
    sections.find((s) => s.level === 2 && (s.chapter.toLowerCase().startsWith(r + ".") || s.chapter.toLowerCase().startsWith(r + " "))) ??
    sections.find((s) => s.chapter.toLowerCase().includes(r) && s.level === 2) ??
    sections.find((s) => s.title.toLowerCase().includes(r)) ??
    null
  );
}

/** A chapter with all its subsections (for read_guide on a chapter number). */
export function chapterText(sec: Section): string {
  const { sections } = loadGuide();
  if (sec.level === 3) return `## ${sec.chapter}\n\n### ${sec.title}\n\n${sec.text}`;
  const subs = sections.filter((x) => x.chapter === sec.chapter && x.level === 3);
  return `## ${sec.chapter}\n\n${sec.text}\n\n${subs.map((x) => `### ${x.title}\n\n${x.text}`).join("\n\n")}`;
}

export function registerGuide(server: McpServer) {
  server.registerTool(
    "search_guide",
    {
      title: "Search the editing guide",
      description: "Find the guide sections (rules + rationale + which tool to use) that bear on a question: pacing, dialogue cuts, montage, transitions, music, loudness, captions, documentary ethics, short-form, agent workflows. Returns section ids for read_guide.",
      inputSchema: { query: z.string().min(2), limit: z.number().int().min(1).max(15).default(5), rulesOnly: z.boolean().default(false) },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ query, limit, rulesOnly }) => text(searchGuide(query, limit, rulesOnly))),
  );
  server.registerTool(
    "read_guide",
    {
      title: "Read a guide chapter or section",
      description: "Full text of a chapter (by number, e.g. \"17\", or name) or a section id from search_guide. Use before doing a kind of edit you have not done in this session.",
      inputSchema: { section: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ section }) => {
      const sec = findSection(section);
      if (!sec) throw new Error(`no section matches "${section}" — try search_guide or list_guide`);
      return text(chapterText(sec));
    }),
  );
  server.registerTool(
    "list_guide",
    { title: "Guide table of contents", description: "Chapters and section ids of the editing guide, plus the playbook names.", inputSchema: {}, annotations: { readOnlyHint: true } },
    guarded(async () => {
      const { sections, playbooks } = loadGuide();
      const chapters = sections.filter((s) => s.level === 2).map((s) => ({ id: s.id, chapter: s.chapter, part: s.part, sections: sections.filter((x) => x.chapter === s.chapter && x.level === 3).map((x) => x.id) }));
      return text({ chapters, playbooks: [...playbooks.values()].map((p) => ({ name: p.name, title: p.title })) });
    }),
  );
  server.registerTool(
    "get_playbook",
    {
      title: "Get a task playbook",
      description: "Step-by-step procedure (tools + the guide's rules) for a common job. Names: see list_guide. Read it before starting the job; follow its verification steps before reporting done.",
      inputSchema: { name: z.string() },
      annotations: { readOnlyHint: true },
    },
    guarded(async ({ name }) => {
      const { playbooks } = loadGuide();
      const pb = playbooks.get(name) ?? [...playbooks.values()].find((p) => p.name.includes(name) || p.title.toLowerCase().includes(name.toLowerCase()));
      if (!pb) throw new Error(`no playbook "${name}"; available: ${[...playbooks.keys()].join(", ")}`);
      return text(pb.text);
    }),
  );

  server.registerResource(
    "guide-toc",
    "slopstudio://guide",
    { title: "Editing guide (table of contents)", mimeType: "text/markdown" },
    async (uri) => {
      const { sections } = loadGuide();
      const toc = sections.filter((s) => s.level === 2).map((s) => `- ${s.chapter} — slopstudio://guide/${s.id}`).join("\n");
      return { contents: [{ uri: uri.href, mimeType: "text/markdown", text: `# A Guide to Great Digital Film Editing\n\n${toc}` }] };
    },
  );
  server.registerResource(
    "guide-section",
    new ResourceTemplate("slopstudio://guide/{sectionId}", { list: undefined }),
    { title: "Editing guide section", mimeType: "text/markdown" },
    async (uri, { sectionId }) => {
      const sec = findSection(String(sectionId));
      return { contents: [{ uri: uri.href, mimeType: "text/markdown", text: sec ? chapterText(sec) : `no section ${String(sectionId)}` }] };
    },
  );
  server.registerResource(
    "playbook",
    new ResourceTemplate("slopstudio://playbooks/{name}", { list: undefined }),
    { title: "Editing playbook", mimeType: "text/markdown" },
    async (uri, { name }) => {
      const pb = loadGuide().playbooks.get(String(name));
      return { contents: [{ uri: uri.href, mimeType: "text/markdown", text: pb?.text ?? `no playbook ${String(name)}` }] };
    },
  );

  server.registerPrompt(
    "playbook",
    {
      title: "Run a playbook",
      description: "Start a job with its playbook, the always-on rules and the project context.",
      argsSchema: { name: z.string().describe("playbook name (list_guide shows them)"), projectId: z.string().optional(), notes: z.string().optional().describe("what the person wants, constraints, must-keeps") },
    },
    ({ name, projectId, notes }) => {
      const { playbooks, rules } = loadGuide();
      const pb = playbooks.get(name);
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                `${pb ? pb.text : `(no playbook named ${name}; call list_guide)`}\n\n---\n\n${rules}\n\n---\n\n` +
                (projectId ? `Project: ${projectId}. Start with get_project and create_checkpoint.\n` : "Start with list_projects or create_project.\n") +
                (notes ? `Brief from the person: ${notes}\n` : "") +
                "Work the playbook step by step, verify with its checks, and report: the cut you chose and why, every check's result, and anything you could not do.",
            },
          },
        ],
      };
    },
  );
}

/** The prose of a directing style (guide/styles/<id>.md), or null. */
export function styleText(id: string): { id: string; title: string; text: string } | null {
  return loadGuide().styles.get(id) ?? null;
}
