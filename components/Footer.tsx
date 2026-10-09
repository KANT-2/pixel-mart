import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-line py-10 text-sm text-sub">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <p className="flex items-center gap-2">
            <span className="font-pixel font-bold text-ink">PIXEL MART</span>
            <span>게임 같은 하루, 픽셀아트의 상점.</span>
          </p>
          <ul className="flex gap-5">
            <li>이용약관</li>
            <li className="font-bold text-ink">개인정보처리방침</li>
            <li><Link href="/help" className="rounded hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet">고객센터</Link></li>
          </ul>
        </div>
        <p className="mb-2 text-xs leading-relaxed text-dim">
          상호 픽셀마트 · 대표 OOO · 사업자등록번호 000-00-00000 · 통신판매업신고 제0000-서울OO-0000호
          <br />
          본 사이트는 교육용 프로젝트이며 실제 판매가 이루어지지 않습니다.
        </p>
        <p className="text-xs text-dim">© 2026 PIXEL MART. All rights reserved.</p>
      </div>
    </footer>
  );
}
