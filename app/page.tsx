import { products } from "@/data/products";

export default function Home() {
  return (
    <main className="p-10">
      <h1 className="text-2xl font-bold">PIXEL MART</h1>
      <p>등록된 상품 {products.length}개</p>
    </main>
  );
}