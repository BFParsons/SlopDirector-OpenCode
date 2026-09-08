import Link from "next/link";
import { OpenRouterKeySettings } from "@/components/OpenRouterKeySettings";
import { ProjectFolderSettings } from "@/components/ProjectFolderSettings";
import { requirePageUser } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { user } = await requirePageUser();

  return (
    <>
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Settings</h1>
          <Link href="/dashboard" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]">
            ← Back
          </Link>
        </div>
        <div className="space-y-4">
          <ProjectFolderSettings initialFolder={user.defaultProjectFolder} />
          <OpenRouterKeySettings initialHint={user.openrouterKeyHint} />
        </div>
      </main>
    </>
  );
}
