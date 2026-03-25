import type { NextConfig } from "next";

/**
 * Vercel(HTTPS) → EC2 API(HTTP) 직접 호출 시 브라우저 Mixed Content 차단을 피하려면
 * BACKEND_URL을 두고 /v1 을 백엔드로 프록시한다. 로컬은 보통 .env.local에
 * NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/v1 만 두고 BACKEND_URL은 비운다.
 */
const backendUrl = process.env.BACKEND_URL?.trim().replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    if (!backendUrl) {
      return [];
    }
    return [
      {
        source: "/v1/:path*",
        destination: `${backendUrl}/v1/:path*`
      }
    ];
  }
};

export default nextConfig;
