import { requireApiUser } from "@/lib/auth/rbac";
import { getOwnedProject } from "@/lib/projects/access";
import { streamAsset } from "@/lib/assets/serve";
import { audioMimeForPath, resolveAudioFile } from "@/lib/audio/workspace";

export const dynamic = "force-dynamic";

/** Stream an Audio Studio file back to the browser (Range-aware for seeking). */
export async function GET(request: Request) {
  const { user } = await requireApiUser();
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") ?? "";
  const relPath = url.searchParams.get("p") ?? "";

  if (!projectId || !relPath) return new Response("Missing params", { status: 400 });
  try {
    await getOwnedProject(projectId, user);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  // Refuse anything outside this project's own audio folder.
  if (!resolveAudioFile(projectId, relPath)) return new Response("Forbidden", { status: 403 });

  try {
    return await streamAsset(relPath, audioMimeForPath(relPath), request.headers.get("range"));
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
