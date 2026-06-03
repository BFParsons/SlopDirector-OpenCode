"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CAPS,
  type ChatModelInfo,
  type TtsModelInfo,
  type VideoModelInfo,
} from "@/config/models";
import { formatCents } from "@/lib/cost/estimate";
import { api } from "@/lib/api";
import { Button, Card, Input, Label, Select, Textarea } from "@/components/ui";

interface Props {
  chatModels: ChatModelInfo[];
  videoModels: VideoModelInfo[];
  ttsModels: TtsModelInfo[];
  isAdmin: boolean;
  defaults: { llmModel: string; videoModel: string; ttsModel: string };
}

export function BriefForm({
  chatModels,
  videoModels,
  ttsModels,
  isAdmin,
  defaults,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    subject: "",
    goal: "",
    tone: "Urgent but hopeful",
    targetLengthS: 30,
    shotCount: 5,
    aspectRatio: "R16_9",
    resolution: "R720P",
    audioMode: "TTS_FROM_SCRIPT",
    llmModel: defaults.llmModel,
    videoModel: defaults.videoModel,
    ttsModel: defaults.ttsModel,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const estCents = useMemo(() => {
    const vm = videoModels.find((m) => m.id === form.videoModel);
    const perSec = vm?.pricePerSecondUsd ?? 0.05;
    return Math.round(form.targetLengthS * perSec * 100);
  }, [form.videoModel, form.targetLengthS, videoModels]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { id } = await api<{ id: string }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          goal: form.goal || undefined,
          subject: form.subject || undefined,
          tone: form.tone || undefined,
          targetLengthS: Number(form.targetLengthS),
          shotCount: Number(form.shotCount),
          aspectRatio: form.aspectRatio,
          resolution: form.resolution,
          audioMode: form.audioMode,
          llmModel: form.llmModel,
          videoModel: form.videoModel,
          ttsModel: form.ttsModel,
        }),
      });
      router.push(`/projects/${id}`);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card className="space-y-4">
        <div>
          <Label>Working title</Label>
          <Input
            required
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Affordability — attack spot v1"
          />
        </div>
        <div>
          <Label hint="optional — guides AI generation; the politician, party, or issue">
            Subject
          </Label>
          <Input
            value={form.subject}
            onChange={(e) => set("subject", e.target.value)}
            placeholder="MP Jane Doe's record on housing costs"
          />
        </div>
        <div>
          <Label hint="optional — the message / what it should accomplish">Goal</Label>
          <Textarea
            rows={3}
            value={form.goal}
            onChange={(e) => set("goal", e.target.value)}
            placeholder="Tie rising rents to Doe's votes; drive undecided renters to our candidate."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label hint="optional">Tone</Label>
            <Input value={form.tone} onChange={(e) => set("tone", e.target.value)} />
          </div>
          <div>
            <Label hint={`${CAPS.minShots}–${CAPS.maxShots}, for AI storyboards`}>Shots</Label>
            <Input
              type="number"
              min={CAPS.minShots}
              max={CAPS.maxShots}
              value={form.shotCount}
              onChange={(e) => set("shotCount", Number(e.target.value))}
            />
          </div>
        </div>
        <p className="text-xs text-[var(--color-muted)]">
          You build the visual and audio tracks separately on the next screen —
          AI is optional, and you can upload your own clips, photos, and audio.
        </p>
      </Card>

      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label hint={`5–${CAPS.maxTotalDurationS}s`}>Target length</Label>
            <Input
              type="number"
              min={5}
              max={CAPS.maxTotalDurationS}
              value={form.targetLengthS}
              onChange={(e) => set("targetLengthS", Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Audio</Label>
            <Select value={form.audioMode} onChange={(e) => set("audioMode", e.target.value)}>
              <option value="TTS_FROM_SCRIPT">AI script → voiceover</option>
              <option value="TTS_VERBATIM">My transcript → voiceover</option>
              <option value="UPLOAD_AUDIO">Upload audio</option>
              <option value="NONE">Silent</option>
            </Select>
          </div>
          <div>
            <Label>Aspect ratio</Label>
            <Select value={form.aspectRatio} onChange={(e) => set("aspectRatio", e.target.value)}>
              <option value="R16_9">16:9 (landscape)</option>
              <option value="R9_16">9:16 (vertical)</option>
              <option value="R1_1">1:1 (square)</option>
            </Select>
          </div>
          <div>
            <Label>Resolution</Label>
            <Select value={form.resolution} onChange={(e) => set("resolution", e.target.value)}>
              <option value="R480P">480p</option>
              <option value="R720P">720p</option>
              <option value="R1080P">1080p</option>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <Label hint="writes the script — pick a model that won't refuse named political criticism">
            Script model
          </Label>
          <Select value={form.llmModel} onChange={(e) => set("llmModel", e.target.value)}>
            {chatModels.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Video model</Label>
            <Select value={form.videoModel} onChange={(e) => set("videoModel", e.target.value)}>
              {videoModels.map((m) => (
                <option key={m.id} value={m.id} disabled={m.adminOnly && !isAdmin}>
                  {m.label} — ${m.pricePerSecondUsd}/s{m.adminOnly && !isAdmin ? " (admin)" : ""}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Voice model</Label>
            <Select value={form.ttsModel} onChange={(e) => set("ttsModel", e.target.value)}>
              {ttsModels.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </Select>
          </div>
        </div>
        <p className="text-xs text-[var(--color-muted)]">
          Rough AI video cost at {form.targetLengthS}s:{" "}
          <span className="text-[var(--color-fg)]">{formatCents(estCents)}</span> — only
          AI segments are billed; uploads are free. You confirm before rendering.
        </p>
      </Card>

      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Creating…" : "Create project →"}
        </Button>
      </div>
    </form>
  );
}
