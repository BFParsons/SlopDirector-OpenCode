import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";

export default async function Home() {
  const ctx = await getSessionUser();
  redirect(ctx ? "/start" : "/login");
}
