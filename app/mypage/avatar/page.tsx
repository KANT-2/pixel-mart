import type { Metadata } from "next";
import AvatarEditor from "@/components/avatar/AvatarEditor";

export const metadata: Metadata = { title: "픽셀 아바타 | PIXEL MART" };

export default function AvatarPage() {
  return <section className="mx-auto w-full max-w-4xl px-4 py-10 md:px-8">
    <p className="mb-3 font-pixel text-xs tracking-widest text-mint">CREATE YOUR PLAYER</p>
    <h1 className="text-3xl font-extrabold">나만의 픽셀 아바타</h1>
    <p className="mb-8 mt-3 text-sm text-sub">사진은 기기 안에서만 변환해요. 저장할 때 완성된 작은 PNG만 전송합니다.</p>
    <AvatarEditor />
  </section>;
}
