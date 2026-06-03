/** Native HTML5 drag-and-drop payload for dragging a Media Bucket asset onto
 *  the Timeline (works across separate floating panels). */
export const MEDIA_DND_TYPE = "application/x-slop-media";

export interface MediaDragPayload {
  id: string;
  isVideo: boolean;
  isAudio?: boolean;
  /** Source Monitor subclip: drop a trimmed [In, Out] range onto the timeline. */
  trimStartS?: number;
  durationS?: number;
}

export function setMediaDrag(dt: DataTransfer, payload: MediaDragPayload): void {
  const json = JSON.stringify(payload);
  dt.setData(MEDIA_DND_TYPE, json);
  dt.setData("text/plain", json); // fallback
  dt.effectAllowed = "copy";
}

export function readMediaDrag(dt: DataTransfer): MediaDragPayload | null {
  const raw = dt.getData(MEDIA_DND_TYPE) || dt.getData("text/plain");
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<MediaDragPayload>;
    if (p && typeof p.id === "string") {
      return {
        id: p.id,
        isVideo: !!p.isVideo,
        ...(p.isAudio ? { isAudio: true } : {}),
        ...(typeof p.trimStartS === "number" ? { trimStartS: p.trimStartS } : {}),
        ...(typeof p.durationS === "number" ? { durationS: p.durationS } : {}),
      };
    }
  } catch {
    // not our payload
  }
  return null;
}

export function hasMediaDrag(dt: DataTransfer): boolean {
  return dt.types.includes(MEDIA_DND_TYPE) || dt.types.includes("text/plain");
}
