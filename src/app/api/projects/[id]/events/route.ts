import { requireApiUser } from "@/lib/auth/rbac";
import { handleApiError } from "@/lib/http/handleError";
import { onProgress, type ProgressEvent } from "@/lib/jobs/progressBus";
import { getOwnedProject } from "@/lib/projects/access";
import { projectSnapshot } from "@/lib/projects/serialize";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const { user } = await requireApiUser();
    const { id } = await params;
    await getOwnedProject(id, user);

    const encoder = new TextEncoder();
    let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
    let closed = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let lifetimeCap: ReturnType<typeof setTimeout> | null = null;
    let unsubscribe = () => {};

    // Stop our timers + subscription. Safe to call repeatedly.
    const cleanup = () => {
      if (heartbeat) clearInterval(heartbeat);
      if (lifetimeCap) clearTimeout(lifetimeCap);
      heartbeat = lifetimeCap = null;
      unsubscribe();
      unsubscribe = () => {};
      req.signal.removeEventListener("abort", close);
    };

    // Our side wants to end the stream (abort / write failure / lifetime cap).
    function close() {
      if (closed) return;
      closed = true;
      cleanup();
      try {
        controller?.close();
      } catch {
        /* already closed by the framework */
      }
    }

    // Any write failure means the client is gone → reclaim. In Next dev the abort
    // signal often does NOT fire when an EventSource closes, so this is the cleanup.
    const write = (chunk: string): boolean => {
      if (closed || !controller) return false;
      try {
        controller.enqueue(encoder.encode(chunk));
        return true;
      } catch {
        close();
        return false;
      }
    };

    const send = (event: ProgressEvent | { type: string; [k: string]: unknown }) =>
      void write(`data: ${JSON.stringify(event)}\n\n`);

    const stream = new ReadableStream<Uint8Array>({
      async start(c) {
        controller = c;
        if (req.signal.aborted) {
          close();
          return;
        }
        req.signal.addEventListener("abort", close);

        const snapshot = await projectSnapshot(id);
        if (closed) return;
        send({ type: "snapshot", project: snapshot });

        unsubscribe = onProgress(id, (e) => send(e));
        // Heartbeat doubles as a liveness probe: a failed write closes the stream.
        heartbeat = setInterval(() => void write(": ping\n\n"), 20_000);
        // Backstop: cap an orphaned connection's lifetime; the client reconnects.
        lifetimeCap = setTimeout(close, 5 * 60_000);
      },
      // The consumer (client) went away — the framework closed the controller for
      // us. Just stop our timers/subscription; never touch the controller here.
      cancel() {
        closed = true;
        cleanup();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // disable nginx buffering for SSE
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
