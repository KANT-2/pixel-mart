"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLocalProfile } from "@/components/local/LocalProvider";
import PixelIcon from "@/components/PixelIcon";

const links: { href: string; label: string; icon?: "heart" }[] = [{ href: "/local", label: "덕력지도" }, { href: "/local/trades", label: "거래·교환" }, { href: "/local/wish-map", label: "위시맵", icon: "heart" as const }];
interface LocalNavLinksProps { pathname?: string; region?: string | null; }
function LocalNavLinks({ pathname, region }: LocalNavLinksProps) {
  return <nav aria-label="PIXEL LOCAL 메뉴" className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pt-3 md:px-8 md:pt-6">
    {links.map((item) => <Link key={item.href} href={`${item.href}${region !== undefined ? `?region=${encodeURIComponent(region ?? "")}` : ""}`}
      aria-current={pathname === item.href || (item.href === "/local/trades" && pathname?.startsWith("/local/trades/")) ? "page" : undefined}
      onFocus={(event) => event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" })}
      className="inline-flex shrink-0 items-center rounded-lg border border-line px-4 py-3 text-sm font-semibold text-sub hover:text-ink aria-[current=page]:border-mint/50 aria-[current=page]:bg-panel aria-[current=page]:text-mint focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mint">{item.icon && <PixelIcon name={item.icon} className="mr-1.5 size-4" />}{item.label}</Link>)}
  </nav>;
}
export function LocalNavFallback() { return <LocalNavLinks />; }
export default function LocalNav() {
  const pathname = usePathname(), params = useSearchParams(), profile = useLocalProfile();
  return <LocalNavLinks pathname={pathname} region={params.has("region") ? params.get("region") : profile.data?.region?.code} />;
}
