"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, Input, Label } from "@/components/ui";

export function FalKeySettings({ initialHint }: { initialHint: string | null }) {
  const [hint, setHint] = useState<string | null>(initialHint);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    if (!key.trim()) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await api<{ hint: string }>("/api/account/fal-key", {
        method: "POST",
        body: JSON.stringify({ key }),
      });
      setHint(res.hint);
      setKey("");
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api("/api/account/fal-key", { method: "DELETE" });
      setHint(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">fal.ai API key</h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Used to generate storyboard keyframes (Flux), billed to your account.
          Get one at{" "}
          <a
            href="https://fal.ai/dashboard/keys"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            fal.ai/dashboard/keys
          </a>
          . Stored encrypted; leave it unset to use the shared server key.
        </p>
      </div>

      <p className="text-sm">
        {hint ? (
          <>
            Using your key:{" "}
            <span className="font-mono text-[var(--color-fg)]">{hint}</span>
          </>
        ) : (
          <span className="text-[var(--color-muted)]">
            No personal key — using the shared server key.
          </span>
        )}
      </p>

      <div>
        <Label>{hint ? "Replace key" : "Paste your key"}</Label>
        <Input
          type="password"
          value={key}
          placeholder="fal key (id:secret)…"
          autoComplete="off"
          disabled={busy}
          onChange={(e) => {
            setKey(e.target.value);
            setSaved(false);
          }}
        />
      </div>

      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
      {saved ? <p className="text-sm text-[var(--color-success)]">Saved.</p> : null}

      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={busy || !key.trim()}>
          {busy ? "Saving…" : "Save key"}
        </Button>
        {hint ? (
          <Button variant="ghost" onClick={remove} disabled={busy}>
            Remove
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
