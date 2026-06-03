"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectSnapshot } from "@/lib/projects/serialize";
import { IMAGE_MODELS, getImageModel, isRefEditorModel } from "@/config/models";
import { api } from "@/lib/api";
import { withBase } from "@/lib/basePath";
import { Button, Card, Label, Select, Textarea } from "@/components/ui";
import { useLeaveGuard } from "@/components/studio/useLeaveGuard";

/** Format a cent amount as a short USD string (3dp under a cent). */
function usd(cents: number): string {
  const d = cents / 100;
  return `$${d.toFixed(d < 0.1 ? 3 : 2)}`;
}

/**
 * Build a variant / camera-angle prompt. For reference-EDITING models (Kontext /
 * Gemini) the reference image already supplies the subject, so the prompt is the
 * *change* phrased as an instruction; for img2img (Flux) we keep the element's
 * own description so the result stays on-scene.
 */
function editPrompt(elementPrompt: string, change: string, refEditor: boolean): string {
  if (refEditor) {
    return `${change}. Keep the same subject, location, identity and style — change only what is described.`;
  }
  return `${elementPrompt ? `${elementPrompt}, ` : ""}${change}`;
}

// Click any generated image to open it large; provided by StoryboardWorkspace.
const ZoomCtx = createContext<(assetId: string) => void>(() => {});

type TabKey = "scenes" | "characters" | "objects" | "shots";
type Kind = "SCENE" | "CHARACTER" | "OBJECT";

const TABS: { key: TabKey; label: string }[] = [
  { key: "scenes", label: "Scenes" },
  { key: "characters", label: "Characters" },
  { key: "objects", label: "Objects" },
  { key: "shots", label: "Shots" },
];
const KIND_BY_TAB: Record<Exclude<TabKey, "shots">, Kind> = {
  scenes: "SCENE",
  characters: "CHARACTER",
  objects: "OBJECT",
};
// Per-kind copy + prompt scaffolding so generations come out on-type.
const KIND_META: Record<Kind, { noun: string; variantsLabel: string; variantNoun: string; scaffold: (p: string) => string }> = {
  SCENE: {
    noun: "scene",
    variantsLabel: "Camera angles",
    variantNoun: "angle",
    scaffold: (p) => `${p}, wide establishing shot, environment, no people`,
  },
  CHARACTER: {
    noun: "character",
    variantsLabel: "Outfits & looks",
    variantNoun: "outfit",
    scaffold: (p) => `full-body character portrait, ${p}, neutral background`,
  },
  OBJECT: {
    noun: "object",
    variantsLabel: "Variations",
    variantNoun: "variation",
    scaffold: (p) => `${p}, single isolated object, clean studio background`,
  },
};

// Preset camera angles for re-shooting a scene. The prompt is combined with the
// scene's description and conditioned on its base image so it's the same place
// from a new viewpoint.
const CAMERA_ANGLES: { label: string; prompt: string }[] = [
  { label: "Wide shot", prompt: "wide establishing shot of the same location" },
  { label: "Close-up", prompt: "close-up detail shot within the same location" },
  { label: "Low angle", prompt: "dramatic low-angle shot looking up" },
  { label: "High angle", prompt: "high-angle shot looking down" },
  { label: "Bird's-eye", prompt: "overhead bird's-eye top-down view" },
  { label: "Over-the-shoulder", prompt: "over-the-shoulder framing in the same location" },
  { label: "Dutch angle", prompt: "tilted dutch-angle shot" },
  { label: "Reverse angle", prompt: "reverse angle from the opposite side of the room" },
];

type AddAngle = (elementId: string, label: string, prompt: string) => void;

type Snap = ProjectSnapshot;
type ElementView = Snap["storyElements"][number];
type VariantView = ElementView["variants"][number];

export function StoryboardWorkspace({ initial }: { initial: Snap }) {
  const router = useRouter();
  const [snap, setSnap] = useState<Snap>(initial);
  const [tab, setTab] = useState<TabKey>("scenes");
  const [title, setTitle] = useState(initial.title);
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [imageModel, setImageModel] = useState(initial.imageModel ?? "fal-ai/flux/dev");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  // image/error each target had when its generation was fired, to detect change.
  const baseline = useRef<Map<string, { img: string | null; error: string | null }>>(new Map());

  const draft = (key: string, fallback: string) => drafts[key] ?? fallback;
  const setDraft = (key: string, v: string) => setDrafts((d) => ({ ...d, [key]: v }));

  function entityState(s: Snap, key: string): { img: string | null; error: string | null } {
    const [type, id] = key.split(":");
    if (type === "seg") {
      const seg = s.segments.find((x) => x.id === id);
      return { img: seg?.refImageId ?? null, error: seg?.error ?? null };
    }
    if (type === "el") {
      const el = s.storyElements.find((x) => x.id === id);
      return { img: el?.assetId ?? null, error: el?.error ?? null };
    }
    for (const el of s.storyElements) {
      const v = el.variants.find((x) => x.id === id);
      if (v) return { img: v.assetId ?? null, error: v.error ?? null };
    }
    return { img: null, error: null };
  }

  async function refetch() {
    setSnap(await api<Snap>(`/api/projects/${initial.id}`));
  }

  // Poll while anything is generating.
  useEffect(() => {
    if (generating.size === 0) return;
    const timer = setInterval(async () => {
      try {
        const fresh = await api<Snap>(`/api/projects/${initial.id}`);
        setSnap(fresh);
        setGenerating((prev) => {
          const next = new Set(prev);
          for (const key of prev) {
            const cur = entityState(fresh, key);
            const base = baseline.current.get(key);
            if (cur.img !== (base?.img ?? null) || cur.error !== (base?.error ?? null)) next.delete(key);
          }
          return next;
        });
      } catch {
        /* keep polling */
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [generating.size, initial.id]);

  async function patchProject(data: Record<string, unknown>) {
    await api(`/api/projects/${initial.id}`, { method: "PATCH", body: JSON.stringify(data) });
  }

  function fire(key: string, body: Record<string, unknown>) {
    baseline.current.set(key, entityState(snap, key));
    setGenerating((prev) => new Set(prev).add(key));
    void api(`/api/projects/${initial.id}/images`, { method: "POST", body: JSON.stringify(body) }).catch(
      (e) => {
        setError((e as Error).message);
        setGenerating((prev) => {
          const n = new Set(prev);
          n.delete(key);
          return n;
        });
      },
    );
  }

  async function saveTitle() {
    const t = title.trim();
    if (!t || t === snap.title) return;
    await patchProject({ title: t }).catch((e) => setError((e as Error).message));
  }

  // Create a variant (e.g. a camera angle of a scene) and immediately generate it
  // from the element's base image so it stays the same place/subject.
  const addAngle: AddAngle = (elementId, label, prompt) => {
    void (async () => {
      try {
        const after = await api<Snap>(
          `/api/projects/${initial.id}/elements/${elementId}/variants`,
          { method: "POST", body: JSON.stringify({ label, prompt }) },
        );
        setSnap(after);
        const el = after.storyElements.find((e) => e.id === elementId);
        const v = el?.variants[el.variants.length - 1];
        if (el && v) {
          fire(`var:${v.id}`, {
            prompt: editPrompt(el.prompt, prompt, isRefEditorModel(imageModel)),
            styleRefAssetId: el.assetId ?? undefined,
            styleStrength: 0.8, // (img2img only; Kontext ignores strength)
            targetVariantId: v.id,
          });
        }
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  };

  const isGen = (key: string) => generating.has(key);

  // Guard leaving an empty storyboard project (no scenes + no story elements).
  const isEmpty = snap.segments.length === 0 && snap.storyElements.length === 0;
  const { guardedLeave, dialog: leaveDialog } = useLeaveGuard({
    shouldGuard: isEmpty,
    projectId: initial.id,
    initialName: title,
    onSave: async (name) => {
      try {
        await patchProject({ title: name });
        return true;
      } catch {
        return false;
      }
    },
  });

  return (
    <ZoomCtx.Provider value={setZoom}>
      {zoom ? <Lightbox assetId={zoom} onClose={() => setZoom(null)} /> : null}
      {leaveDialog}
      <main className="mx-auto w-full max-w-5xl flex-1 p-6">
        <button
          type="button"
          onClick={() => guardedLeave(() => router.push("/start"))}
          className="mb-4 block text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          ← Modes
        </button>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            className="w-full bg-transparent text-xl font-semibold outline-none focus:underline"
          />
          <p className="text-sm text-[var(--color-muted)]">
            Build reusable scenes, characters, and objects, then compose them into shots.
          </p>
        </div>
        <Button variant="ghost" onClick={() => router.push(`/projects/${initial.id}`)}>
          Open in editor →
        </Button>
      </div>

      {/* Image-model picker + running spend */}
      {(() => {
        const m = getImageModel(imageModel);
        const totalCents = snap.storyElements.reduce((s, el) => s + (el.costCents ?? 0), 0);
        return (
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm">
            <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
              Image model
            </span>
            <Select
              className="w-auto"
              value={imageModel}
              onChange={(e) => {
                const id = e.target.value;
                setImageModel(id);
                void patchProject({ imageModel: id }).catch((er) => setError((er as Error).message));
              }}
            >
              {IMAGE_MODELS.map((im) => (
                <option key={im.id} value={im.id}>
                  {im.label} — ≈${im.pricePerImageUsd.toFixed(3)}/image
                </option>
              ))}
            </Select>
            {m?.note ? (
              <span className="hidden text-xs text-[var(--color-muted)] sm:inline">{m.note}</span>
            ) : null}
            <span className="ml-auto font-mono tnum text-xs text-[var(--color-muted)]">
              Spent ≈ {usd(totalCents)}
            </span>
          </div>
        );
      })()}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-[var(--color-border)]">
        {TABS.map((t) => {
          const count =
            t.key === "shots"
              ? snap.segments.filter((s) => s.source === "AI_GENERATED").length
              : snap.storyElements.filter((el) => el.kind === KIND_BY_TAB[t.key as Exclude<TabKey, "shots">]).length;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
                active
                  ? "border-[var(--color-accent)] text-[var(--color-fg)]"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              }`}
            >
              {t.label}
              {count > 0 ? <span className="ml-1.5 text-xs opacity-70">{count}</span> : null}
            </button>
          );
        })}
      </div>

      {error ? <p className="mb-3 text-sm text-[var(--color-danger)]">{error}</p> : null}

      {tab === "shots" ? (
        <ShotBoard
          snap={snap}
          drafts={drafts}
          setDraft={setDraft}
          draft={draft}
          isGen={isGen}
          fire={fire}
          patchProject={patchProject}
          refetch={refetch}
          projectId={initial.id}
          setError={setError}
        />
      ) : (
        <ElementBoard
          kind={KIND_BY_TAB[tab as Exclude<TabKey, "shots">]}
          snap={snap}
          draft={draft}
          setDraft={setDraft}
          isGen={isGen}
          fire={fire}
          refetch={refetch}
          projectId={initial.id}
          styleAnchorAssetId={snap.styleAnchorAssetId}
          addAngle={addAngle}
          refEditor={isRefEditorModel(imageModel)}
          setError={setError}
        />
      )}
      </main>
    </ZoomCtx.Provider>
  );
}

function Lightbox({ assetId, onClose }: { assetId: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6"
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={withBase(`/api/assets/${assetId}`)}
        alt="enlarged"
        className="max-h-full max-w-full rounded-lg object-contain shadow-lift"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-5 top-4 text-sm text-white/80 hover:text-white"
      >
        ✕ Close
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Element library (Scenes / Characters / Objects)
// ---------------------------------------------------------------------------

interface BoardCommon {
  snap: Snap;
  draft: (key: string, fallback: string) => string;
  setDraft: (key: string, v: string) => void;
  isGen: (key: string) => boolean;
  fire: (key: string, body: Record<string, unknown>) => void;
  refetch: () => Promise<void>;
  projectId: string;
  setError: (m: string | null) => void;
}

function ElementBoard({
  kind,
  styleAnchorAssetId,
  addAngle,
  refEditor,
  ...c
}: BoardCommon & {
  kind: Kind;
  styleAnchorAssetId: string | null;
  addAngle: AddAngle;
  refEditor: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const meta = KIND_META[kind];
  const elements = c.snap.storyElements.filter((el) => el.kind === kind);

  async function add() {
    setBusy(true);
    c.setError(null);
    try {
      await api(`/api/projects/${c.projectId}/elements`, {
        method: "POST",
        body: JSON.stringify({ kind, name: `Untitled ${meta.noun}` }),
      });
      await c.refetch();
    } catch (e) {
      c.setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-muted)]">
          {kind === "CHARACTER"
            ? "Persistent characters. Generate a base look, then add outfits & states that keep their identity."
            : kind === "SCENE"
              ? "Persistent settings. Reuse the same place across shots."
              : "Persistent props & objects to reuse across shots."}
        </p>
        <Button className="px-3 py-1.5 text-xs" disabled={busy} onClick={add}>
          + {meta.noun}
        </Button>
      </div>

      {elements.length === 0 ? (
        <Card className="text-sm text-[var(--color-muted)]">
          No {meta.noun}s yet. Add one and generate its look.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {elements.map((el) => (
            <ElementCard
              key={el.id}
              kind={kind}
              element={el}
              styleAnchorAssetId={styleAnchorAssetId}
              addAngle={addAngle}
              refEditor={refEditor}
              {...c}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ElementCard({
  kind,
  element,
  styleAnchorAssetId,
  addAngle,
  refEditor,
  draft,
  setDraft,
  isGen,
  fire,
  refetch,
  projectId,
  setError,
}: BoardCommon & {
  kind: Kind;
  element: ElementView;
  styleAnchorAssetId: string | null;
  addAngle: AddAngle;
  refEditor: boolean;
}) {
  const zoom = useContext(ZoomCtx);
  const meta = KIND_META[kind];
  const el = element;
  const nameKey = `el-name:${el.id}`;
  const promptKey = `el-prompt:${el.id}`;
  const genKey = `el:${el.id}`;
  const generating = isGen(genKey);
  const [refineText, setRefineText] = useState("");

  // Edit-in-place: apply an instruction to the element's current base image.
  function refine() {
    if (!refineText.trim() || generating || !el.assetId) return;
    fire(genKey, {
      prompt: refineText.trim(),
      editFromAssetId: el.assetId,
      targetElementId: el.id,
    });
    setRefineText("");
  }

  async function patch(data: Record<string, unknown>) {
    await api(`/api/projects/${projectId}/elements/${el.id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }).catch((e) => setError((e as Error).message));
  }

  async function remove() {
    await api(`/api/projects/${projectId}/elements/${el.id}`, { method: "DELETE" })
      .then(refetch)
      .catch((e) => setError((e as Error).message));
  }

  function generate() {
    const p = draft(promptKey, el.prompt).trim();
    if (!p || generating) return;
    void patch({ prompt: p });
    fire(genKey, {
      prompt: meta.scaffold(p),
      styleRefAssetId: styleAnchorAssetId ?? undefined,
      targetElementId: el.id,
    });
  }

  async function addVariant() {
    await api(`/api/projects/${projectId}/elements/${el.id}/variants`, {
      method: "POST",
      body: JSON.stringify({ label: `New ${meta.variantNoun}` }),
    })
      .then(refetch)
      .catch((e) => setError((e as Error).message));
  }

  async function uploadRef(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    await api(`/api/projects/${projectId}/elements/${el.id}/refs`, { method: "POST", body: fd })
      .then(refetch)
      .catch((e) => setError((e as Error).message));
  }
  async function removeRef(assetId: string) {
    await api(`/api/projects/${projectId}/elements/${el.id}/refs/${assetId}`, { method: "DELETE" })
      .then(refetch)
      .catch((e) => setError((e as Error).message));
  }

  return (
    <div className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
      <div className="flex items-center gap-2">
        <input
          value={draft(nameKey, el.name)}
          onChange={(e) => setDraft(nameKey, e.target.value)}
          onBlur={(e) => patch({ name: e.target.value })}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none focus:underline"
        />
        {el.costCents > 0 ? (
          <span
            className="shrink-0 font-mono tnum text-xs text-[var(--color-muted)]"
            title="Image generation spent on this element (base + variants)"
          >
            ≈ {usd(el.costCents)}
          </span>
        ) : null}
        <button
          type="button"
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-danger)]"
          onClick={remove}
        >
          remove
        </button>
      </div>

      <Thumb assetId={el.assetId} generating={generating} alt={el.name} />
      {el.error && !generating ? <p className="text-xs text-[var(--color-danger)]">{el.error}</p> : null}

      {/* Uploaded reference images that inform this element's generation */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--color-muted)]">
            Reference images <span className="opacity-70">(inform generation)</span>
          </span>
          <label className="cursor-pointer text-xs text-[var(--color-accent)] hover:underline">
            + Upload
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadRef(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {el.refImageIds.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {el.refImageIds.map((rid) => (
              <div key={rid} className="relative h-14 w-14">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={withBase(`/api/assets/${rid}`)}
                  alt="reference"
                  className="h-full w-full cursor-zoom-in rounded border border-[var(--color-border)] object-cover"
                  onClick={() => zoom(rid)}
                />
                <button
                  type="button"
                  onClick={() => removeRef(rid)}
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[10px] text-white hover:bg-[var(--color-danger)]"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--color-muted)]">
            None — upload photos to base this {meta.noun} on.
          </p>
        )}
      </div>

      <Textarea
        rows={2}
        value={draft(promptKey, el.prompt)}
        placeholder={
          kind === "CHARACTER"
            ? "Describe this character (age, build, hair, vibe)…"
            : kind === "SCENE"
              ? "Describe this setting (place, time, mood)…"
              : "Describe this object…"
        }
        onChange={(e) => setDraft(promptKey, e.target.value)}
        onBlur={(e) => patch({ prompt: e.target.value })}
      />
      <Button
        className="w-full px-3 py-1.5 text-xs"
        disabled={generating || !draft(promptKey, el.prompt).trim()}
        onClick={generate}
      >
        {generating ? "Generating…" : el.assetId ? "Regenerate" : "Generate look"}
      </Button>

      {/* Refine: edit the current image in place (best with Kontext / Nano Banana) */}
      {el.assetId ? (
        <div className="space-y-1 rounded-lg border border-[var(--color-border)] p-2">
          <div className="flex gap-1.5">
            <input
              value={refineText}
              onChange={(e) => setRefineText(e.target.value)}
              placeholder={`Refine: e.g. ${kind === "CHARACTER" ? "older, add glasses" : kind === "SCENE" ? "at night, add rain" : "weathered, add a logo"}`}
              className="min-w-0 flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") refine();
              }}
            />
            <Button
              className="px-2 py-1 text-xs"
              variant="ghost"
              disabled={generating || !refineText.trim()}
              onClick={refine}
            >
              Refine
            </Button>
          </div>
          <p className="text-[10px] text-[var(--color-muted)]">
            Edits the current image (keeps it). Best with a Kontext or Nano Banana model.
          </p>
        </div>
      ) : null}

      {/* Variants — outfits/states for characters & objects, camera angles for
          scenes — all generated FROM the base image to preserve continuity. */}
      <div className="mt-2 border-t border-[var(--color-border)] pt-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--color-muted)]">{meta.variantsLabel}</span>
          {kind !== "SCENE" ? (
            <button
              type="button"
              className="text-xs text-[var(--color-accent)] hover:underline disabled:opacity-50"
              onClick={addVariant}
            >
              + {meta.variantNoun}
            </button>
          ) : null}
        </div>

        {kind === "SCENE" ? (
          <CameraAnglePicker
            disabled={!el.assetId}
            onPick={(label, prompt) => addAngle(el.id, label, prompt)}
          />
        ) : el.variants.length === 0 ? (
          <p className="text-xs text-[var(--color-muted)]">
            {el.assetId
              ? `Add an ${meta.variantNoun} to vary it while keeping its look.`
              : `Generate the base look first, then add ${meta.variantNoun}s.`}
          </p>
        ) : null}

        {el.variants.length > 0 ? (
          <div className="mt-2 space-y-2">
            {el.variants.map((v) => (
              <VariantRow
                key={v.id}
                element={el}
                variant={v}
                draft={draft}
                setDraft={setDraft}
                isGen={isGen}
                fire={fire}
                refetch={refetch}
                projectId={projectId}
                styleAnchorAssetId={styleAnchorAssetId}
                refEditor={refEditor}
                setError={setError}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Picker for re-shooting a scene from a new camera angle: preset angles + a
// custom prompt. Each choice creates a variant and generates it from the base.
function CameraAnglePicker({
  disabled,
  onPick,
}: {
  disabled: boolean;
  onPick: (label: string, prompt: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");

  if (disabled) {
    return (
      <p className="text-xs text-[var(--color-muted)]">
        Generate the scene first, then create new camera angles of it.
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        className="text-xs font-medium text-[var(--color-accent)] hover:underline"
        onClick={() => setOpen((o) => !o)}
      >
        + Create new camera angle of this scene
      </button>
      {open ? (
        <div className="mt-2 space-y-2 rounded-lg border border-[var(--color-border)] p-2">
          <div className="flex flex-wrap gap-1.5">
            {CAMERA_ANGLES.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => {
                  onPick(a.label, a.prompt);
                  setOpen(false);
                }}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs hover:border-[var(--color-accent)]"
              >
                {a.label}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Custom angle, e.g. from inside the doorway"
              className="min-w-0 flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && custom.trim()) {
                  onPick(custom.trim(), custom.trim());
                  setCustom("");
                  setOpen(false);
                }
              }}
            />
            <button
              type="button"
              disabled={!custom.trim()}
              onClick={() => {
                onPick(custom.trim(), custom.trim());
                setCustom("");
                setOpen(false);
              }}
              className="rounded border border-[var(--color-border)] px-2 py-1 text-xs disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function VariantRow({
  element,
  variant,
  draft,
  setDraft,
  isGen,
  fire,
  refetch,
  projectId,
  styleAnchorAssetId,
  refEditor,
  setError,
}: {
  element: ElementView;
  variant: VariantView;
  draft: (key: string, fallback: string) => string;
  setDraft: (key: string, v: string) => void;
  isGen: (key: string) => boolean;
  fire: (key: string, body: Record<string, unknown>) => void;
  refetch: () => Promise<void>;
  projectId: string;
  styleAnchorAssetId: string | null;
  refEditor: boolean;
  setError: (m: string | null) => void;
}) {
  const v = variant;
  const el = element;
  const labelKey = `var-label:${v.id}`;
  const promptKey = `var-prompt:${v.id}`;
  const genKey = `var:${v.id}`;
  const generating = isGen(genKey);

  async function patch(data: Record<string, unknown>) {
    await api(`/api/projects/${projectId}/elements/${el.id}/variants/${v.id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }).catch((e) => setError((e as Error).message));
  }
  async function remove() {
    await api(`/api/projects/${projectId}/elements/${el.id}/variants/${v.id}`, { method: "DELETE" })
      .then(refetch)
      .catch((e) => setError((e as Error).message));
  }
  function generate() {
    const p = draft(promptKey, v.prompt).trim();
    if (!p || generating) return;
    void patch({ prompt: p });
    // Keep the element's identity (its base image as the anchor) + apply the change.
    fire(genKey, {
      prompt: editPrompt(el.prompt, p, refEditor),
      styleRefAssetId: el.assetId ?? styleAnchorAssetId ?? undefined,
      styleStrength: 0.7,
      targetVariantId: v.id,
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-[var(--color-border)] p-2">
      <Thumb assetId={v.assetId} generating={generating} alt={v.label} />
      <div className="flex items-center gap-2">
        <input
          value={draft(labelKey, v.label)}
          onChange={(e) => setDraft(labelKey, e.target.value)}
          onBlur={(e) => patch({ label: e.target.value })}
          className="min-w-0 flex-1 bg-transparent text-xs font-medium outline-none focus:underline"
        />
        <button
          type="button"
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-danger)]"
          onClick={remove}
        >
          ✕
        </button>
      </div>
      <input
        value={draft(promptKey, v.prompt)}
        onChange={(e) => setDraft(promptKey, e.target.value)}
        onBlur={(e) => patch({ prompt: e.target.value })}
        placeholder="e.g. wearing a red dress"
        className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs outline-none"
      />
      {v.error && !generating ? <p className="text-xs text-[var(--color-danger)]">{v.error}</p> : null}
      <button
        type="button"
        disabled={generating || !draft(promptKey, v.prompt).trim()}
        onClick={generate}
        className="text-xs text-[var(--color-accent)] hover:underline disabled:opacity-50"
      >
        {generating ? "Generating…" : v.assetId ? "Regenerate" : "Generate"}
      </button>
    </div>
  );
}

function Thumb({
  assetId,
  generating,
  alt,
}: {
  assetId: string | null;
  generating: boolean;
  alt: string;
}) {
  const zoom = useContext(ZoomCtx);
  return (
    <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      {assetId ? (
        <button
          type="button"
          onClick={() => zoom(assetId)}
          title="Click to enlarge"
          className="group block h-full w-full cursor-zoom-in"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={withBase(`/api/assets/${assetId}`)}
            alt={alt}
            className="h-full w-full object-cover transition group-hover:opacity-90"
          />
          <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
            ⤢ enlarge
          </span>
        </button>
      ) : (
        <span className="px-1 text-center text-xs text-[var(--color-muted)]">no image</span>
      )}
      {generating ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-xs text-white">
          Generating…
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shot board (style anchor + shots → keyframes)
// ---------------------------------------------------------------------------

function ShotBoard({
  snap,
  draft,
  setDraft,
  isGen,
  fire,
  patchProject,
  refetch,
  projectId,
  setError,
}: BoardCommon & { patchProject: (d: Record<string, unknown>) => Promise<void>; drafts: Record<string, string> }) {
  const [stylePrompt, setStylePrompt] = useState(snap.stylePrompt ?? "");
  const styleStrength = snap.styleStrength ?? 0.85;
  const [busy, setBusy] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const styleAnchorAssetId = snap.styleAnchorAssetId;
  const shots = snap.segments.filter((s) => s.source === "AI_GENERATED");

  async function saveStyle() {
    await patchProject({ stylePrompt: stylePrompt.trim() || null, styleStrength }).catch((e) =>
      setError((e as Error).message),
    );
  }
  async function uploadAnchor(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("projectId", projectId);
      fd.append("file", file);
      const res = await api<{ id: string }>("/api/uploads", { method: "POST", body: fd });
      await patchProject({ styleAnchorAssetId: res.id });
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function addShot() {
    setBusy(true);
    try {
      await api(`/api/projects/${projectId}/segments`, {
        method: "POST",
        body: JSON.stringify({ source: "AI_GENERATED", prompt: "" }),
      });
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function removeShot(id: string) {
    await api(`/api/projects/${projectId}/segments/${id}`, { method: "DELETE" })
      .then(refetch)
      .catch((e) => setError((e as Error).message));
  }
  function generate(id: string, prompt: string) {
    if (!prompt.trim()) return;
    void patchProject({
      stylePrompt: stylePrompt.trim() || null,
      styleStrength,
      segments: [{ id, prompt }],
    });
    const full = stylePrompt.trim() ? `${prompt.trim()}. Style: ${stylePrompt.trim()}` : prompt.trim();
    fire(`seg:${id}`, {
      prompt: full,
      styleRefAssetId: styleAnchorAssetId ?? undefined,
      styleStrength,
      targetSegmentId: id,
      targetRole: "FIRST_FRAME",
    });
  }

  // Edit-in-place: keep the current keyframe, apply an instruction to it.
  function refine(id: string, instruction: string, fromAssetId: string) {
    if (!instruction.trim()) return;
    fire(`seg:${id}`, {
      prompt: instruction.trim(),
      editFromAssetId: fromAssetId,
      targetSegmentId: id,
      targetRole: "FIRST_FRAME",
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
      <Card className="h-fit space-y-3">
        <h2 className="text-sm font-semibold">Style anchor</h2>
        <p className="text-xs text-[var(--color-muted)]">
          A reference image + style prompt applied to every keyframe for a consistent look.
        </p>
        <input
          ref={uploadRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadAnchor(f);
          }}
        />
        {styleAnchorAssetId ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={withBase(`/api/assets/${styleAnchorAssetId}`)}
              alt="style anchor"
              className="aspect-square w-full rounded-lg border border-[var(--color-border)] object-cover"
            />
            <Button
              variant="ghost"
              className="px-2 py-1 text-xs"
              disabled={busy}
              onClick={() => uploadRef.current?.click()}
            >
              Replace
            </Button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => uploadRef.current?.click()}
            className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] text-xs text-[var(--color-muted)] hover:border-[var(--color-accent)]"
          >
            + Reference image
          </button>
        )}
        <div>
          <Label>Style prompt</Label>
          <Textarea
            rows={3}
            value={stylePrompt}
            placeholder="e.g. gritty documentary, muted teal grade, 35mm grain"
            onChange={(e) => setStylePrompt(e.target.value)}
            onBlur={saveStyle}
          />
        </div>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Shots{" "}
            <span className="font-normal text-[var(--color-muted)]">
              {shots.filter((s) => s.refImageId).length}/{shots.length} keyframes
            </span>
          </h2>
          <Button className="px-3 py-1.5 text-xs" disabled={busy} onClick={addShot}>
            + Shot
          </Button>
        </div>
        {shots.length === 0 ? (
          <Card className="text-sm text-[var(--color-muted)]">
            No shots yet. Add a shot, describe it, and generate a keyframe.
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {shots.map((s, i) => (
              <ShotCard
                key={s.id}
                shot={s}
                index={i + 1}
                snap={snap}
                projectId={projectId}
                draft={draft}
                setDraft={setDraft}
                generating={isGen(`seg:${s.id}`)}
                onGenerate={generate}
                onRefine={refine}
                onRemove={removeShot}
                patchProject={patchProject}
                refetch={refetch}
                setError={setError}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const KIND_LABEL: Record<string, string> = { SCENE: "Scene", CHARACTER: "Character", OBJECT: "Object" };
type ShotView = Snap["segments"][number];

// A shot keyframe composed from library elements (scene + characters + objects),
// each optionally at a specific variant. Generation conditions on all their
// images (multi-reference — pick Nano Banana for best results).
function ShotCard({
  shot,
  index,
  snap,
  projectId,
  draft,
  setDraft,
  generating,
  onGenerate,
  onRefine,
  onRemove,
  patchProject,
  refetch,
  setError,
}: {
  shot: ShotView;
  index: number;
  snap: Snap;
  projectId: string;
  draft: (key: string, fallback: string) => string;
  setDraft: (key: string, v: string) => void;
  generating: boolean;
  onGenerate: (id: string, prompt: string) => void;
  onRefine: (id: string, instruction: string, fromAssetId: string) => void;
  onRemove: (id: string) => void;
  patchProject: (d: Record<string, unknown>) => Promise<void>;
  refetch: () => Promise<void>;
  setError: (m: string | null) => void;
}) {
  const zoom = useContext(ZoomCtx);
  const s = shot;
  const key = `shot-prompt:${s.id}`;
  const promptVal = draft(key, s.prompt);
  const [adding, setAdding] = useState(false);
  const [refineText, setRefineText] = useState("");
  const refs = s.elementRefs ?? [];

  async function addElement(elementId: string) {
    if (!elementId) return;
    setAdding(true);
    try {
      await api(`/api/projects/${projectId}/segments/${s.id}/elements`, {
        method: "POST",
        body: JSON.stringify({ elementId }),
      });
      await refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }
  async function removeElement(refId: string) {
    await api(`/api/projects/${projectId}/segments/${s.id}/elements/${refId}`, { method: "DELETE" })
      .then(refetch)
      .catch((e) => setError((e as Error).message));
  }
  async function setVariant(refId: string, variantId: string | null) {
    await api(`/api/projects/${projectId}/segments/${s.id}/elements/${refId}`, {
      method: "PATCH",
      body: JSON.stringify({ variantId }),
    })
      .then(refetch)
      .catch((e) => setError((e as Error).message));
  }

  return (
    <div className="space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Shot {index}</span>
        <button
          type="button"
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-danger)]"
          onClick={() => onRemove(s.id)}
        >
          remove
        </button>
      </div>

      <Thumb assetId={s.refImageId} generating={generating} alt={`keyframe ${index}`} />
      {s.error && !generating ? <p className="text-xs text-[var(--color-danger)]">{s.error}</p> : null}

      {/* Compose this shot from library elements */}
      <div className="space-y-1.5 rounded-lg border border-dashed border-[var(--color-border)] p-2">
        <span className="text-xs font-medium text-[var(--color-muted)]">Elements in this shot</span>
        {refs.length > 0 ? (
          <div className="space-y-1">
            {refs.map((r) => {
              const el = snap.storyElements.find((e) => e.id === r.elementId);
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-2 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1"
                >
                  {r.imageAssetId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={withBase(`/api/assets/${r.imageAssetId}`)}
                      alt=""
                      className="h-7 w-7 shrink-0 cursor-zoom-in rounded object-cover"
                      onClick={() => r.imageAssetId && zoom(r.imageAssetId)}
                    />
                  ) : (
                    <div className="h-7 w-7 shrink-0 rounded bg-[var(--color-card)]" />
                  )}
                  <span className="min-w-0 truncate text-xs">
                    <span className="opacity-60">{KIND_LABEL[r.kind]}</span> · {r.name}
                  </span>
                  {el && el.variants.length > 0 ? (
                    <select
                      value={r.variantId ?? ""}
                      onChange={(e) => setVariant(r.id, e.target.value || null)}
                      className="ml-auto rounded border border-[var(--color-border)] bg-[var(--color-card)] px-1 py-0.5 text-xs outline-none"
                    >
                      <option value="">base</option>
                      {el.variants.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="ml-auto" />
                  )}
                  <button
                    type="button"
                    onClick={() => removeElement(r.id)}
                    className="shrink-0 text-xs text-[var(--color-muted)] hover:text-[var(--color-danger)]"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-[var(--color-muted)]">
            Add scenes, characters &amp; objects to build this shot from your library.
          </p>
        )}
        {snap.storyElements.length > 0 ? (
          <Select
            className="text-xs"
            value=""
            disabled={adding}
            onChange={(e) => {
              void addElement(e.target.value);
              e.target.value = "";
            }}
          >
            <option value="">+ Add element…</option>
            {(["SCENE", "CHARACTER", "OBJECT"] as const).map((k) => {
              const els = snap.storyElements.filter((e) => e.kind === k);
              if (!els.length) return null;
              return (
                <optgroup key={k} label={`${KIND_LABEL[k]}s`}>
                  {els.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </Select>
        ) : (
          <p className="text-xs text-[var(--color-muted)]">
            Create scenes / characters / objects first, then compose them here.
          </p>
        )}
      </div>

      <Textarea
        rows={2}
        value={promptVal}
        placeholder="Direct the shot — the action, framing, mood. Mention your elements by name."
        onChange={(e) => setDraft(key, e.target.value)}
        onBlur={(e) => patchProject({ segments: [{ id: s.id, prompt: e.target.value }] }).catch(() => {})}
      />
      <Button
        className="w-full px-3 py-1.5 text-xs"
        disabled={generating || !promptVal.trim()}
        onClick={() => onGenerate(s.id, promptVal)}
      >
        {generating ? "Generating…" : s.refImageId ? "Regenerate keyframe" : "Generate keyframe"}
      </Button>

      {/* Refine: edit the CURRENT keyframe in place (best with Kontext / Nano Banana) */}
      {s.refImageId ? (
        <div className="space-y-1 rounded-lg border border-[var(--color-border)] p-2">
          <div className="flex gap-1.5">
            <input
              value={refineText}
              onChange={(e) => setRefineText(e.target.value)}
              placeholder="Refine: e.g. make it night, she's smiling"
              className="min-w-0 flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && refineText.trim() && s.refImageId) {
                  onRefine(s.id, refineText, s.refImageId);
                  setRefineText("");
                }
              }}
            />
            <Button
              className="px-2 py-1 text-xs"
              variant="ghost"
              disabled={generating || !refineText.trim()}
              onClick={() => {
                if (s.refImageId) {
                  onRefine(s.id, refineText, s.refImageId);
                  setRefineText("");
                }
              }}
            >
              Refine
            </Button>
          </div>
          <p className="text-[10px] text-[var(--color-muted)]">
            Edits the current image (keeps the composition). Best with a Kontext or
            Nano Banana model.
          </p>
        </div>
      ) : null}
    </div>
  );
}
