import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { BriefForm } from "@/components/BriefForm";
import {
  CHAT_MODELS,
  DEFAULT_LLM_MODEL,
  DEFAULT_TTS_MODEL,
  DEFAULT_VIDEO_MODEL,
  TTS_MODELS,
  VIDEO_MODELS,
} from "@/config/models";
import { requirePageUser } from "@/lib/auth/rbac";

export default async function NewProjectPage() {
  const { user } = await requirePageUser();
  return (
    <>
      <AppHeader email={user.email} role={user.role} />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <Link
          href="/dashboard"
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          ← Back
        </Link>
        <h1 className="mb-1 mt-2 text-xl font-semibold">New video</h1>
        <p className="mb-6 text-sm text-[var(--color-muted)]">
          Describe the brief. The script can name and critique real politicians;
          the generated video uses generic/archetypal visuals (or images you
          upload), never a real person&apos;s likeness.
        </p>
        <BriefForm
          chatModels={CHAT_MODELS}
          videoModels={VIDEO_MODELS}
          ttsModels={TTS_MODELS}
          isAdmin={user.role === "ADMIN"}
          defaults={{
            llmModel: DEFAULT_LLM_MODEL,
            videoModel: DEFAULT_VIDEO_MODEL,
            ttsModel: DEFAULT_TTS_MODEL,
          }}
        />
      </main>
    </>
  );
}
