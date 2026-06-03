"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
    router.push("/login");
    router.refresh();
  }
  return (
    <Button variant="ghost" onClick={logout} className="px-3 py-1.5 text-xs">
      Sign out
    </Button>
  );
}
