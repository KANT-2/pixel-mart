import type { Metadata } from "next";
import { CartProvider } from "@/components/CartProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { WishlistProvider } from "@/components/WishlistProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "PIXEL MART — 일상에 아이템을 장착하세요",
  description: "게임을 좋아하는 사람을 위한 픽셀아트 데스크 소품 상점",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // 커서·다크모드 같은 브라우저 확장이 <html>에 붙이는 속성 차이만 무시 (하위 요소의 진짜 하이드레이션 오류는 그대로 잡힘)
    <html lang="ko" className="h-full" suppressHydrationWarning>
      <head>
        {/* 한글 본문 폰트(Pretendard) + 픽셀 폰트(Galmuri) */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
          precedence="default"
        />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/galmuri@latest/dist/galmuri.css" precedence="default" />
      </head>
      <body className="flex min-h-full flex-col font-sans antialiased">
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
