import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  experimental: {
    // AI 아바타는 안전 필터 오탐 재시도로 30초를 넘길 수 있어 /api 프록시 대기 시간을 늘림 (기본 30초)
    proxyTimeout: 90_000,
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        // 모듈 CSS는 이름을 보존해 Next.js의 클래스 격리를 사용합니다.
        condition: { not: { path: "*.module.css" } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // /api/* 요청은 FastAPI 백엔드(backend/, 기본 :8000)로 넘김 → 같은 주소처럼 호출되어 쿠키·CORS 걱정이 없음
  async rewrites() {
    const backend = process.env.BACKEND_URL ?? "http://localhost:8000";
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
