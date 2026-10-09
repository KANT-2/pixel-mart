import LocalProvider from "@/components/local/LocalProvider";

export default function LocalLayout({ children }: LayoutProps<"/local">) {
  return <LocalProvider>{children}</LocalProvider>;
}
