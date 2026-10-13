import Link from "next/link";
import HomeCarousel from "@/components/home/HomeCarousel";

export default function QuestsPage() {
  return <>
    <div className="mx-auto max-w-6xl px-4 pt-8"><Link href="/mypage" className="text-sm text-mint">← 마이페이지</Link></div>
    <HomeCarousel questOnly />
  </>;
}
