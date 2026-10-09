"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [{ href: "/", label: "홈" }, { href: "/products", label: "전체 상품" }, { href: "/local", label: "PIXEL LOCAL" }];
interface NavLinksProps { pathname?: string; }

function NavLinks({ pathname }: NavLinksProps) {
  return <>{items.map((item) => {
    const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname?.startsWith(`${item.href}/`);
    return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}
      onFocus={(event) => event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" })}
      className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mint ${active ? "bg-panel text-mint" : "text-sub hover:bg-panel hover:text-ink"}`}>{item.label}</Link>;
  })}</>;
}

export function HeaderNavFallback() { return <NavLinks />; }
export default function HeaderNav() { return <NavLinks pathname={usePathname()} />; }
