"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatCents } from "@/lib/cost/estimate";
import { Button, Card } from "@/components/ui";

interface Preview {
  cost: {
    videoCents: number;
    ttsCents: number;
    llmCents: number;
    totalCents: number;
    videoSeconds: number;
  };
  videoModel: string;
  adminOnlyModel: boolean;
  quota: { used: number; limit: number };
}

export function CostPreview({
  projectId,
  onClose,
  onConfirmed,
}: {
  projectId: string;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<Preview>(`/api/projects/${projectId}/render`)
      .then(setPreview)
      .catch((e) => setError((e as Error).message));
  }, [projectId]);

  async function confirm() {
    setLoading(true);
    setError(null);
    try {
      await api(`/api/projects/${projectId}/render`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      onConfirmed();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-md">
        <h2 className="mb-3 text-lg font-semibold">Confirm render</h2>
        {!preview && !error ? (
          <p className="text-sm text-[var(--color-muted)]">Estimating…</p>
        ) : null}
        {preview ? (
          <div className="space-y-2 text-sm">
            <Row label={`Video (${preview.cost.videoSeconds}s AI)`}>
              {formatCents(preview.cost.videoCents)}
            </Row>
            <Row label="Voiceover (TTS)">
              {formatCents(preview.cost.ttsCents)}
            </Row>
            <Row label="Script (LLM)">{formatCents(preview.cost.llmCents)}</Row>
            <div className="my-2 border-t border-[var(--color-border)]" />
            <Row label="Estimated total">
              <span className="text-base font-semibold text-[var(--color-fg)]">
                {formatCents(preview.cost.totalCents)}
              </span>
            </Row>
            {preview.cost.totalCents === 0 ? (
              <p className="rounded border border-[var(--color-border)] p-2 text-xs text-[var(--color-success)]">
                No new AI generation — reusing existing clips and voiceover. Only
                the final video is re-assembled (free).
              </p>
            ) : null}
            <p className="pt-1 text-xs text-[var(--color-muted)]">
              Quota this month: {preview.quota.used}/{preview.quota.limit}. Cost
              is an estimate; actual provider billing may differ.
            </p>
          </div>
        ) : null}
        {error ? (
          <p className="mt-2 text-sm text-[var(--color-danger)]">{error}</p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={loading || !preview}>
            {loading ? "Starting…" : "Render video"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span>{children}</span>
    </div>
  );
}
