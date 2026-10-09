import type { Metadata } from "next";
import AvatarEditor from "@/components/avatar/AvatarEditor";

export const metadata: Metadata = { title: "픽셀 아바타 | PIXEL MART" };

export default function AvatarPage() {
  return <section className="mx-auto w-full max-w-4xl px-4 py-10 md:px-8">
    <p className="stage-kicker mb-3 font-pixel text-xs tracking-widest text-mint">CREATE YOUR PLAYER</p>
    <h1 className="text-3xl font-extrabold">나만의 픽셀 아바타</h1>
    <p className="mb-8 mt-3 text-sm text-sub">AI로 사진을 픽셀 캐릭터로 바꾸거나, 픽셀 캔버스에 직접 그려 보세요. 저장되는 건 완성된 작은 픽셀 이미지뿐이에요.</p>
    <AvatarEditor />
  </section>;
}
