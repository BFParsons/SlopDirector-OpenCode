import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { Card } from "@/components/ui";
import { getSessionUser } from "@/lib/auth/session";
import { withBase } from "@/lib/basePath";

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/start");
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={withBase("/logo.png")}
          alt="SlopStudio Pro"
          className="mb-3 h-9 w-auto object-contain"
        />
        <p className="mb-6 text-sm text-[var(--color-muted)]">
          Sign in to generate political campaign videos.
        </p>
        <Card>
          <AuthForm />
        </Card>
        <p className="mt-4 text-center text-sm text-[var(--color-muted)]">
          Accounts are created by the administrator.
        </p>
      </div>
    </div>
  );
}
