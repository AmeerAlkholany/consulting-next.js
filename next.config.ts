import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Statically typed <Link href> and route params. The app has many routes
  // (/consultants, /appointments/[id], /admin/*, ...), so compile-time link
  // checking is worth the opt-in.
  typedRoutes: true,

  // Baseline security headers configured per ARCHITECTURE.md §16.
  // Full CSP and per-request nonce injection are introduced in Step 19.
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
        ],
      },
    ];
  },
};

export default nextConfig;
