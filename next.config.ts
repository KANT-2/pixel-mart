import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

// 같은 와이파이의 다른 기기(휴대폰·팀원 PC)에서 http://<이 PC IP>:3000 으로 열 때,
// 개발 서버가 다른 주소의 요청을 막아 화면 요소가 그려지지 않던 문제 — 이 PC의 사내망 IPv4를 허용
// (그 밖의 주소는 DEV_ORIGINS=호스트1,호스트2 로 추가)
const lanAddresses = Object.values(networkInterfaces()).flat()
  .filter((net) => net && net.family === "IPv4" && !net.internal)
  .map((net) => net!.address);
const extraOrigins = (process.env.DEV_ORIGINS ?? "").split(",").map((host) => host.trim()).filter(Boolean);

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  allowedDevOrigins: [...lanAddresses, ...extraOrigins],
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
    const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
