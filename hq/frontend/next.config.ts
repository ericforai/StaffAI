import type { NextConfig } from "next";
import path from "node:path";

const backendPort = process.env.NEXT_PUBLIC_BACKEND_PORT || "3333";
/** Browser calls same-origin /api/*; Next proxies to HQ (avoids CORS / wrong-host fetch failures). */
const hqBackendOrigin =
  process.env.HQ_BACKEND_ORIGIN || `http://127.0.0.1:${backendPort}`;

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd()),
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${hqBackendOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
