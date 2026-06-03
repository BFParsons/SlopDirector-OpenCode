// When the app is served under a subpath (e.g. your-domain.example/vid), Next's
// `basePath` rewrites <Link>, the router, and built asset URLs — but NOT raw
// fetch()/EventSource/<video src> string literals. Prefix those with withBase().
// NEXT_PUBLIC_BASE_PATH is inlined at build time (empty = root).
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBase(path: string): string {
  return path.startsWith("/") ? `${BASE_PATH}${path}` : path;
}
