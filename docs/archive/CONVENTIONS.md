# PIXEL MART 협업 규칙

> 노션 "협업 규칙" 페이지에 붙여넣고, 첫 회의에서 전원 합의 후 확정하세요.

## 1. 브랜치 전략
- `main` — 항상 `npm run dev`가 되는 상태 유지. **직접 push 금지**, PR로만 합치기
- 작업 브랜치: `타입/작업내용` (영문 소문자, 하이픈)

| 타입 | 용도 | 예시 |
| --- | --- | --- |
| `feat` | 새 기능·화면 | `feat/header`, `feat/product-card`, `feat/product-detail` |
| `fix` | 버그 수정 | `fix/detail-not-found` |
| `style` | 스타일만 변경 | `style/main-banner` |
| `docs` | README·문서 | `docs/readme` |
| `chore` | 설정·데이터 | `chore/mock-data` |

- PR 규칙: **작게 자주**, 팀원 1명 확인 후 머지, 머지 후 브랜치 삭제
- 머지 전 `npm run build`가 통과하는지 확인

## 2. 커밋 메시지
```
타입: 무엇을 했는지 (한글 OK)
```
예) `feat: ProductCard 컴포넌트 추가` · `fix: 없는 상품 ID 접근 시 안내 문구 표시` · `docs: README 실행 방법 작성`

## 3. 네이밍 규칙
| 대상 | 규칙 | 예시 |
| --- | --- | --- |
| 컴포넌트 파일·이름 | PascalCase | `components/ProductCard.tsx` |
| 변수·함수 | camelCase | `formatPrice`, `newProducts` |
| 타입·인터페이스 | PascalCase | `Product` |
| 폴더·라우트 | 소문자 | `app/products/[id]` |
| 이미지 | kebab-case | `public/images/heart-keycap.svg` |
| props 이름 | 상품 하나는 `product` | `<ProductCard product={p} />` |

## 4. 폴더 구조 (목표)
```
pixel-mart/
├─ app/
│  ├─ layout.tsx              # Header + {children} + Footer
│  ├─ page.tsx                # 메인
│  ├─ globals.css
│  └─ products/
│     ├─ page.tsx             # 상품 목록
│     └─ [id]/page.tsx        # 상품 상세
├─ components/
│  ├─ Header.tsx
│  ├─ Footer.tsx
│  └─ ProductCard.tsx
├─ data/products.ts
├─ types/product.ts
├─ utils/formatPrice.ts       # 9900 → "9,900원"
└─ public/images/
```

## 5. 역할 분담 (4인, 회의에서 이름 채우기)
평가표의 5개 역할을 4명이 나눕니다. 1~2일차는 2명만 있어서 앞 두 사람이 먼저 진행하고, 나중에 합류한 2명이 3~4일차를 이어받습니다.

| 담당자 | 맡는 평가 역할 | 주요 작업 | 일정 |
| --- | --- | --- | --- |
| ______ | 개발환경·데이터 + 컴포넌트·스타일 | 프로젝트 세팅, 목데이터, Header·Footer·ProductCard, 메인 | 1~2일차 ✅ |
| ______ | 기획·요구사항 + 디자인 | 기획 메모, 디자인 방향, 와이어프레임, 노션 정리 | 1~4일차 |
| ______ | 라우팅·기능 | 상품 목록·상세 페이지, 없는 ID 처리, (선택) 장바구니 카운트 | 3일차 |
| ______ | QA·문서화 | 빌드·버그 점검, README(실행법·구조도·캡처), (선택) 반응형·Vercel 배포 | 3~4일차 |

- **발표자: 미정** (전원 합류 후 결정). PPT는 각자 맡은 부분의 슬라이드를 작성해 합칩니다.

> 발표에서 "팀원별 역할"과 "트러블슈팅"을 각자 설명할 수 있도록, 맡은 부분의 PR과 고민한 점을 노션에 남겨 주세요.

## 6. 파일 담당자 (Git 충돌 예방)
같은 파일을 두 명이 동시에 고치면 충돌이 납니다. **담당자가 아닌 파일을 고쳐야 하면 먼저 채널에 말하기.**

| 파일 | 담당 역할 |
| --- | --- |
| `types/`, `data/`, `public/images/`, `utils/`, 설정 파일 | 개발환경·데이터 |
| `components/*`, `app/layout.tsx`, `app/globals.css` | 컴포넌트·스타일 |
| `app/page.tsx`, `app/products/**` | 라우팅·기능 |
| `README.md`, `docs/` | QA·문서화 |
| 노션 기획 · 와이어프레임 | 기획 |

## 7. 개발 메모
- 페이지 이동은 **항상 `next/link`의 `<Link>`** (`<a href>` 금지 — 평가 항목)
- 이미지는 일반 `<img>` 사용 (`next/image`는 설정이 필요해 이번엔 생략)
- 가격 표시: `formatPrice(product.price)` (`@/utils/formatPrice`)
- 상세 페이지(Next.js 15 이상)에서 `params`는 Promise입니다:
  ```tsx
  export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const product = products.find((p) => p.id === Number(id));
    // product가 없으면 "상품을 찾을 수 없습니다" 처리
  }
  ```

## 8. 소통 약속 (팀에서 채우기)
- 연락 채널: ______
- 체크인: 매일 ___시(오늘 할 일·막힌 점) / ___시(완료·내일 할 일)
- 자리 비울 때: 채널에 "__시~__시 자리 비움" 남기기
- 30분 이상 막히면: 채널에 공유 → 그래도 안 되면 튜터님께
- 트러블슈팅은 생길 때마다 노션 "트러블슈팅" 페이지에 **증상 / 원인 / 해결** 3줄로 기록 (발표 자료가 됩니다)
