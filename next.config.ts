import type { NextConfig } from "next";
import { realpathSync } from "node:fs";

const isProd = process.env.NODE_ENV === "production";

// Production CSP. `'unsafe-inline'` for scripts/styles is the pragmatic choice
// without nonces (Next inlines hydration scripts; React escaping + no
// dangerouslySetInnerHTML keep XSS risk low). YouTube entries support the
// in-browser clip trimmer (IFrame Player API + embed). Omitted in dev because
// Turbopack/HMR needs 'unsafe-eval' + ws.
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  "connect-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

// Safe in every environment.
const baseSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

// Enforced only in production (CSP would break Turbopack/HMR; HSTS needs HTTPS).
const prodOnlyHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=15552000; includeSubDomains" },
];

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "standalone",
  // The floating dev-tools badge sat on top of the bottom-left Studio panel in
  // the (dev-mode) Electron window; the console still reports build status.
  devIndicators: false,
  // Keep non-runtime dirs out of the standalone trace — notably `dist` (the
  // electron-builder output), which would otherwise copy the previous AppImage
  // into the next build and compound the bundle size every rebuild.
  outputFileTracingExcludes: {
    "*": ["dist/**", "docs/**", "qa/**", ".data/**", "src/generated/**", "vendor/**", "**/*.tsbuildinfo"],
  },
  ...(basePath ? { basePath } : {}),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: isProd
          ? [...baseSecurityHeaders, ...prodOnlyHeaders]
          : baseSecurityHeaders,
      },
    ];
  },
  // Native / server-only modules must not be bundled by the compiler.
  serverExternalPackages: ["@node-rs/argon2", "@prisma/client", "prisma"],
  // Pin the workspace root to THIS directory. A stray
  // /home/minipc/package-lock.json otherwise makes Turbopack infer the home
  // directory as the root and watch/scan the entire tree — a large memory and
  // file-watcher sink (and a likely aggravating factor in the 2026-05-27 crash).
  //
  // Normalize through realpathSync.native so the root matches the *true*
  // on-disk path casing. On case-insensitive filesystems (Windows) the dir can
  // be referenced with different casing than it's stored (e.g. cwd reports
  // "SlopStudio-pro-main" while the real path is "slopstudio-pro-main"); pnpm's
  // symlinks resolve to the true case, so an un-normalized __dirname would
  // mismatch and Turbopack would treat node_modules/next as "outside" the root.
  turbopack: {
    root: realpathSync.native(__dirname),
  },
};

export default nextConfig;
