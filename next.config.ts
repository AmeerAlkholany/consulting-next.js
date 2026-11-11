import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Statically typed <Link href> and route params. The app has many routes
  // (/consultants, /appointments/[id], /admin/*, ...), so compile-time link
  // checking is worth the opt-in.
  typedRoutes: true,

  // A native N-API addon cannot be bundled: `@node-rs/argon2` loads a
  // platform-specific `.node` binary at runtime. Keeping it external is what
  // lets `next build` trace it into the server output instead of trying to
  // parse it (ARCHITECTURE.md §3).
  serverExternalPackages: ["@node-rs/argon2"],

  // Security headers configured per ARCHITECTURE.md §16.
  // Dynamic CSP nonce injection is performed in proxy.ts.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
