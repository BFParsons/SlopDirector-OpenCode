import { AuthError } from "@/lib/auth/rbac";
import { OpenRouterError } from "@/lib/openrouter/client";
import { BodyError } from "./parseJsonBody";
import { err } from "./response";

/** Map known error types to a standard error response; log the rest. */
export function handleApiError(e: unknown) {
  if (e instanceof AuthError) return err(e.message, e.status);
  if (e instanceof BodyError) return err(e.message, e.status);
  if (e instanceof OpenRouterError) {
    return err(`Upstream AI provider error: ${e.message}`, 502);
  }
  console.error("[api] unhandled error:", e);
  return err("Internal server error", 500);
}
