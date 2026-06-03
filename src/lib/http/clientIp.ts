import { env } from "@/env";

/**
 * Best-effort client IP. Only trusts forwarding headers when TRUST_PROXY=true
 * (i.e. we are behind our own reverse proxy), otherwise they are spoofable.
 */
export function getClientIp(request: Request): string {
  if (env.TRUST_PROXY) {
    const real = request.headers.get("x-real-ip");
    if (real) return real.trim();
    const fwd = request.headers.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]!.trim();
  }
  return "0.0.0.0";
}
