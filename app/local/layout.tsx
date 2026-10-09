import LocalProvider from "@/components/local/LocalProvider";
import { Suspense } from "react";
import LocalNav, { LocalNavFallback } from "@/components/local/LocalNav";

export default function LocalLayout({ children }: LayoutProps<"/local">) {
  return <LocalProvider><Suspense fallback={<LocalNavFallback />}><LocalNav /></Suspense>{children}</LocalProvider>;
}
