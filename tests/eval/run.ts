import { mkdir } from "node:fs/promises";
import { BASE, TMP, type Task, type TaskResult, makeApi } from "./harness";
import checkpointRoundtrip from "./tasks/checkpoint-roundtrip";
import draftSpeed from "./tasks/draft-speed";
import removeSilences from "./tasks/remove-silences";
import sceneHighlight from "./tasks/scene-highlight";
import transcript from "./tasks/transcript";

const tasks: Task[] = [removeSilences, sceneHighlight, checkpointRoundtrip, draftSpeed];
if (process.env.EVAL_WHISPER === "1") tasks.push(transcript);
const only = process.argv.slice(2);

async function main() {
  const api = makeApi();
  await mkdir(TMP, { recursive: true });
  try {
    await api.get("/api/projects");
  } catch (e) {
    console.error(`Cannot reach ${BASE} — start the app (or scripts/serve-headless.sh) first.\n${(e as Error).message}`);
    process.exit(2);
  }
  const rows: { task: string; pass: string; ms: number; metrics: string }[] = [];
  let failed = 0;
  for (const t of tasks) {
    if (only.length && !only.includes(t.name)) continue;
    const created: string[] = [];
    const t0 = Date.now();
    let r: TaskResult;
    try {
      r = await t.run(api, { tmp: TMP, cleanup: (id) => created.push(id) });
    } catch (e) {
      r = { pass: false, metrics: {}, notes: (e as Error).message };
    }
    for (const id of created) await api.del(`/api/projects/${id}`).catch(() => {});
    if (!r.pass) failed++;
    rows.push({
      task: t.name,
      pass: r.pass ? "PASS" : "FAIL",
      ms: Date.now() - t0,
      metrics: Object.entries(r.metrics).map(([k, v]) => `${k}=${v}`).join(" ") + (r.notes ? ` · ${r.notes}` : ""),
    });
  }
  console.table(rows);
  console.log(`${rows.length - failed}/${rows.length} tasks passed against ${BASE}`);
  process.exit(failed ? 1 : 0);
}
void main();
