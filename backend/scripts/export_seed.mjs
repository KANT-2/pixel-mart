// 프론트의 data/*.ts를 DB 시드용 JSON으로 내보내기 (Node 22.18+ 타입 제거 기능 사용)
// 실행: node backend/scripts/export_seed.mjs   (저장소 루트에서)
import { writeFileSync } from "node:fs";
import { categories } from "../../data/categories.ts";
import { products } from "../../data/products.ts";

const out = new URL("../seed/", import.meta.url);
writeFileSync(new URL("categories.json", out), JSON.stringify(categories, null, 2) + "\n");
writeFileSync(new URL("products.json", out), JSON.stringify(products, null, 2) + "\n");
console.log(`categories ${categories.length}개, products ${products.length}개 → backend/seed/`);
