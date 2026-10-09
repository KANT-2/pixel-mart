"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLocalProfile } from "@/components/local/LocalProvider";

const links = [{ href: "/local", label: "덕력지도" }, { href: "/local/trades", label: "거래·교환" }, { href: "/local/wish-map", label: "Wish Map" }];
interface LocalNavLinksProps { pathname?: string; region?: string | null; }
function LocalNavLinks({ pathname, region }: LocalNavLinksProps) {
  return <nav aria-label="PIXEL LOCAL 메뉴" className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pt-6 md:px-8">
    {links.map((item) => <Link key={item.href} href={`${item.href}${region !== undefined ? `?region=${encodeURIComponent(region ?? "")}` : ""}`}
      aria-current={pathname === item.href || (item.href === "/local/trades" && pathname?.startsWith("/local/trades/")) ? "page" : undefined}
      onFocus={(event) => event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" })}
      className="shrink-0 rounded-lg border border-line px-4 py-3 text-sm font-semibold text-sub aria-[current=page]:border-mint/50 aria-[current=page]:bg-panel aria-[current=page]:text-mint focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mint">{item.label}</Link>)}
  </nav>;
}
export function LocalNavFallback() { return <LocalNavLinks />; }
export default function LocalNav() {
  const pathname = usePathname(), params = useSearchParams(), profile = useLocalProfile();
  return <LocalNavLinks pathname={pathname} region={params.has("region") ? params.get("region") : profile.data?.region?.code} />;
}
