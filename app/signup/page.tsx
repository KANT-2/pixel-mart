import type { Metadata } from "next";
import SignupForm from "@/components/SignupForm";

export const metadata: Metadata = { title: "플레이어 이름 정하기 | PIXEL MART" };

export default function SignupPage() {
  return <section className="mx-auto w-full max-w-md px-4 py-12 sm:py-20">
    <p className="stage-kicker mb-3 font-pixel text-xs tracking-widest text-mint">NEW PLAYER</p>
    <h1 className="text-3xl font-extrabold">플레이어 이름 정하기</h1>
    <p className="mb-8 mt-3 text-sm text-sub">PIXEL MART에서 쓸 닉네임을 골라 주세요. 다른 플레이어와 겹치지 않아야 해요.</p>
    <SignupForm />
  </section>;
}
