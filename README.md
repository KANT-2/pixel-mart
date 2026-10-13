# 👾 PIXEL MART

> **일상에 아이템을 장착하세요.**
> 게임을 좋아하는 사람을 위한 픽셀아트 게이밍 데스크 소품 쇼핑몰 + 같은 취향의 동네 이웃과 아이템을 주고받는 **PIXEL LOCAL**

![PIXEL MART 메인 화면](docs/screenshots/v2/main.png)

## 프로젝트 소개
| 항목 | 내용 |
| --- | --- |
| 팀명 | 더쿠하시조 (4인) |
| 기간 | 2026.10.07 ~ 2026.10.13 (10/13 발표) · 1차 화면(UI) → 2차 백엔드·PIXEL LOCAL |
| Use Case | **디지털/IT 기기 샵** → 키캡 · 장패드 · 무드등 같은 게이밍 데스크 소품으로 변형 |
| 대상 | 게임·서브컬처를 좋아하는 20~30대, 책상을 꾸미고 굿즈를 모으는 사람 |
| 콘셉트 | 다크 아케이드 · 8비트 픽셀아트 · 연두 네온 포인트 · 게임 HUD(하트·코인·퀘스트) |
| 서비스 한 줄 | **취향 기반 커뮤니티 커머스** — 쇼핑으로 아이템을 "장착"하고, PIXEL LOCAL에서 우리 동네의 같은 덕후를 **발견**하고, 안전하게 주고받아 **연결**되고, 그 활동이 하트·뱃지로 쌓여 **신뢰**가 됩니다 |

## 핵심 기능
| 영역 | 기능 |
| --- | --- |
| 쇼핑 | 상품 검색·정렬·필터(카테고리·가격·NEW·등급 COMMON~UNIQUE), 무한 스크롤, 상품 상세(리뷰·문의 탭), 최근 본 아이템, 찜, 장바구니, 가상 주문·배송 단계·취소 신청 |
| 키캡 | **키캡 피팅룸** — 내 키보드 모델에 키캡을 끼워 보고 조합 그대로 장바구니 담기 · 키보드 검색·키캡 호환성 판정 API |
| 룩북 | 데스크 테마 룩북(픽셀 고양이·구름·레벨업·산호 버섯) → 테마 상품 |
| 플레이어 | 구글 로그인 + 닉네임, **픽셀 아바타**(AI 생성·픽셀 캔버스), 마이페이지 뱃지 도감, 내 퀘스트 |
| PIXEL LOCAL | **덕력지도**(동네별 취향 이웃 수·지도 캐릭터·이웃 카드) · **위시맵**(이웃이 구하는 아이템) · **거래·교환**(HAVE/WISH/SELL, 매칭, 교환 신청·수락) · **이웃 선물**(선물 → 받는 사람 주소 입력 → 주문) |
| 신뢰 | 활동 점수 → 하트(×N)·레벨(LV.1~10)·코인, 뱃지 19종, 헤더 알림 |
| 개인정보 | 동네는 직접 선택(GPS 좌표 저장 안 함), 공개 설정 5종 모두 기본 OFF, 거래글 연락처 입력 차단 |

## 기술 스택
| 구분 | 사용 기술 |
| --- | --- |
| 프론트 | Next.js 16 (App Router, Turbopack, Cache Components) · React 19 · TypeScript 5 · Tailwind CSS 4 (`@theme` 디자인 토큰) |
| 백엔드 | FastAPI · SQLAlchemy 2 (async) · asyncpg · Alembic · Pydantic v2 · PyJWT · Authlib(구글 OAuth) |
| DB | PostgreSQL (Docker 또는 설치형) |
| 테스트 | pytest (백엔드) · `node --test` (프론트 유틸) · ESLint · ruff |
| 외부 | Cloudflare Workers AI (AI 픽셀 아바타, 사용자 동의 시에만) |
| 폰트 | Pretendard (본문) · Galmuri (픽셀 타이틀) |
| 협업 | Git · GitHub (GitHub Flow + Pull Request · 이슈·에픽·라벨) · Notion |

## 실행 방법
프론트(Next.js, :3000)와 백엔드(FastAPI, :8000)를 함께 띄웁니다. 브라우저는 3000만 보고, `/api/*`는 Next가 8000으로 넘겨 줍니다.

**준비물**: Node.js 22+, Python 3.12+, Docker(PostgreSQL) 또는 설치형 PostgreSQL

```bash
# 0) 내려받기
git clone https://github.com/KANT-2/pixel-mart.git
cd pixel-mart

# 1) DB (저장소 루트) — docker compose는 5433 포트로 열립니다
docker compose up -d db

# 2) 백엔드 (backend/)
cd backend
python -m venv .venv && .venv\Scripts\activate   # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
copy .env.example .env                            # macOS/Linux: cp .env.example .env
#   → docker compose를 썼다면 .env의 DATABASE_URL 포트를 5432 → 5433으로 바꿉니다
alembic upgrade head
python -m scripts.seed                            # 상품·카테고리·지역·취향·키보드 (재실행 안전)
python -m scripts.seed_demo                       # (선택) 시연용 데모 이웃·거래글·알림
uvicorn app.main:app --reload --port 8000

# 3) 프론트 (저장소 루트, 새 터미널)
npm install
npm run dev
```
브라우저에서 http://localhost:3000 접속 · API 문서 http://localhost:8000/api/docs

- 로그인: 개발 환경은 로그인 화면의 **개발용 이메일 로그인**(아무 이메일). 데모 이웃으로 보려면 `demo-coinmoa@demo.pixelmart.test` 처럼 `demo-<이름>@demo.pixelmart.test`
- **프론트만 빠르게 보기**: `git clone` → `npm install` → `npm run dev`. 백엔드가 꺼져 있어도 메인·상품 목록·상세는 `data/products.ts` 기본 상품 데이터로 보입니다(안내 문구 표시). 로그인·장바구니·PIXEL LOCAL은 백엔드가 필요합니다.

| 명령어 | 설명 |
| --- | --- |
| `npm run dev` | 프론트 개발 서버 |
| `npm run build` | 프로덕션 빌드 (타입 검사 포함) |
| `npm run lint` · `npm test` | ESLint · 단위 테스트 |
| `pytest` (backend/) | 백엔드 테스트 — 개발 DB가 아닌 `<DB이름>_test` 사용 ([테스트 DB 준비](docs/backend/README.md#백엔드-테스트-db-개발시연-db와-분리)) |

처음 합류한 팀원은 [docs/SETUP.md](docs/SETUP.md), 백엔드는 [docs/backend/README.md](docs/backend/README.md)를 따라 환경을 맞춰 주세요.

## 페이지 구성
| 경로 | 페이지 | 주요 내용 | 상태 |
| --- | --- | --- | --- |
| `/` | 메인 | 배너 3장(내 캐릭터 · 월드맵 · 데스크 룩북), 추천 아이템 | ✅ |
| `/products` | 전체 상품 | 검색·정렬·필터·등급, 무한 스크롤 | ✅ |
| `/products/[id]` | 상품 상세 | 이미지·정보·장바구니, 상품정보·리뷰·문의 탭, 같은 카테고리, 최근 본 아이템, 없는 id 안내 | ✅ |
| `/products/[id]/fitting` | 키캡 피팅룸 | 내 키보드에 끼워 보기, 조합 장바구니 담기 | ✅ |
| `/lookbook` | 데스크 테마 룩북 | 테마별 데스크와 상품 | ✅ |
| `/cart` · `/checkout` | 장바구니 · 주문하기 | 수량·합계, 배송지 입력, 가상 주문 | ✅ |
| `/login` · `/signup` | 로그인 · 가입 | 구글 로그인(개발 환경은 이메일 로그인), 닉네임 정하기 | ✅ |
| `/mypage` | 마이페이지 | 닉네임, 아바타, 뱃지 도감, 바로가기 | ✅ |
| `/mypage/orders` · `/[id]` | 주문 내역 · 상세 | 배송 단계·타임라인, 취소 신청, 리뷰 쓰기 | ✅ |
| `/mypage/wishlist` · `/gifts` · `/avatar` · `/quests` | 찜 · 선물함 · 픽셀 아바타 · 내 퀘스트 | 찜 목록, 받은/보낸 선물(받기·거절), AI·캔버스 아바타, 퀘스트 요약 | ✅ |
| `/local` | 덕력지도 | 시 › 구 › 생활권 지도, 취향 필터, 지역 패널, 이웃 카드 | ✅ |
| `/local/wish-map` | 위시맵 | 동네별 WISH 글, 닉네임·아이템 검색, 선물하기 | ✅ |
| `/local/trades` · `/new` · `/mine` | 거래·교환 | 게시판, 글쓰기, 내 글·교환 신청함·매칭 | ✅ |
| `/local/gift` | 이웃에게 선물하기 | 수량·메시지, 데모 결제 | ✅ |
| `/local/settings` | 내 동네·취향 설정 | 동네·취향(최대 20), 공개 설정 5종 | ✅ |
| `/help` | 고객센터 | FAQ 검색·분류 | ✅ |
| 404 · 오류 | GAME OVER 화면 | 없는 페이지·없는 상품·오류 | ✅ |

### 사용자 흐름 (요약)
```mermaid
flowchart LR
  main["메인"] --> list["전체 상품"] --> detail["상품 상세"] --> cart["장바구니"] --> order["주문 · 배송"]
  detail -->|키캡| fit["키캡 피팅룸"] --> cart
  main -->|월드맵| map["덕력지도"] --> card["이웃 카드"]
  map --> trades["거래·교환"] -->|교환 신청 · 수락| trust["하트 · 뱃지 · 알림"]
  card --> wish["위시맵"] -->|선물하기| gift["선물 → 받는 사람 주소 → 주문"] --> trust
```
화면 구조·컴포넌트 트리·흐름 5개 상세는 **[docs/UI_STRUCTURE.md](docs/UI_STRUCTURE.md)** 에 있습니다.

## 발제 요구사항 대응
1차 발제(React/Next.js 쇼핑몰 UI)의 **필수 범위는 백엔드 없이도 그대로 동작**하고, 2차에서 그 위에 백엔드와 PIXEL LOCAL을 **확장**했습니다.

| 구분 | 요구사항 | 구현 위치 |
| --- | --- | --- |
| 필수 | 기획·범위 정의 | Use Case(디지털/IT 기기 샵 → 게이밍 데스크 소품), [docs/PLANNING.md](docs/PLANNING.md), 팀 노션 |
| 필수 | 개발 환경 | Next.js 16 App Router · TypeScript · Tailwind CSS 4 (`package.json`) |
| 필수 | 상품 타입·Mock 데이터 6개 이상 | [types/product.ts](types/product.ts)(발제 `Product` 규격 그대로) · [data/products.ts](data/products.ts)(180개, 이미지는 `public/images/`에 직접 생성) |
| 필수 | 공통 컴포넌트 | [Header](components/Header.tsx) · [Footer](components/Footer.tsx) · [ProductCard](components/ProductCard.tsx)(props: `product`) — `app/layout.tsx`에서 모든 페이지에 배치 |
| 필수 | 목록 `.map()` 렌더링 | 메인 추천 [app/page.tsx](app/page.tsx) · 전체 상품 [ProductInfiniteGrid](components/products/ProductInfiniteGrid.tsx) |
| 필수 | 상세 동적 라우트 | [app/products/[id]/page.tsx](app/products/%5Bid%5D/page.tsx) — `params`(Promise)로 id를 읽고 `generateStaticParams`로 미리 생성 |
| 필수 | `<Link>` 네비게이션 | 카드·메뉴·버튼 모두 `next/link` (예외: 구글 로그인 API 리다이렉트 `<a>` 1곳) |
| 필수 | Tailwind 스타일링 | Grid/Flex, `aspect-square object-cover`, hover, `@theme` 색·폰트 토큰 |
| 필수 | 예외 방어·저장소 관리 | 없는 상품 → `notFound()` + "상품을 찾을 수 없습니다"([캡처](#화면-캡처)), 없는 경로·오류 → GAME OVER 화면 · `.gitignore`로 `node_modules`·`.next`·`.env` 제외 |
| 필수 | 문서화·시연 | 이 README(실행 방법·컴포넌트 트리·캡처) · `npm run build` 통과 |
| 도전 A | 반응형 | 375px부터 가로 스크롤 없음. 상품 그리드 모바일 2열 → `md` 3열 → `lg` 4열(쇼핑몰 모바일 관행에 맞춰 1열 대신 2열) |
| 도전 B | 장바구니 상태 | 상세의 "장바구니 담기" → 헤더 카트 뱃지 수량 증가 (`CartProvider` 전역 상태) |
| 확장 | 발제 제외 범위를 넘어선 기능 | 로그인·DB·서버 장바구니·가상 주문(결제 없음)·PIXEL LOCAL — FastAPI + PostgreSQL. 백엔드가 꺼져도 필수 화면은 Mock 데이터로 폴백 |

## 폴더 구조
```
pixel-mart/
├─ app/                      # 화면 (App Router) — 쇼핑 · mypage · local(PIXEL LOCAL) · help · login
├─ components/               # 공용(Header·ProductCard·Pagination…) + 기능별 폴더
│  ├─ home/ hero/            # 메인 캐러셀 · 게임 무대
│  ├─ products/ keycap/      # 상품 상세 탭·리뷰·문의 · 키캡 피팅룸
│  ├─ cart/ orders/ wishlist/ gifts/ avatar/ profile/ help/
│  └─ local/                 # 덕력지도 · 위시맵 · 거래·교환 · 선물 · 설정
├─ lib/                      # API 호출(api.ts) · 기능별 클라이언트·데이터 저장소
├─ utils/ types/ data/       # 순수 함수 · API 타입 · 폴백 정적 데이터
├─ backend/                  # FastAPI — app/(models·schemas·services·routers) · alembic · seed · tests
├─ tests/                    # 프론트 유틸 단위 테스트
└─ docs/                     # 기획·정책·설계 문서 (아래 표)
```

### 컴포넌트 계층 (요약)
```
RootLayout (app/layout.tsx)
└─ AuthProvider › CartProvider › WishlistProvider   # 로그인·장바구니·찜 전역 상태
   ├─ Header ─ HeaderNav · HeaderShortcuts · CartButton(수량 뱃지) · NotificationBell · UserMenu
   ├─ main
   │  ├─ / ─ HomeCarousel(HeroStage · WorldMapTeaser · ThemePicker) · ProductCard × 4
   │  ├─ /products ─ ProductFilters › ProductFilterBar · ProductInfiniteGrid › ProductCard × N
   │  ├─ /products/[id] ─ AddToCartButton · WishButton · ProductDetailTabs(리뷰·문의) · ProductCard × 4 · RecentlyViewed
   │  │                  └─ (없는 id) not-found.tsx › GameOverScreen
   │  ├─ /products/[id]/fitting ─ KeycapFittingRoom
   │  └─ /local ─ FandomMapScreen › PixelMap · NeighborCard · 구매 순위 패널
   └─ Footer
```
페이지별 전체 트리는 [docs/UI_STRUCTURE.md](docs/UI_STRUCTURE.md#2-2-페이지별-컴포넌트-트리-대표)에 있습니다.

## 문서
| 문서 | 내용 |
| --- | --- |
| [docs/UI_STRUCTURE.md](docs/UI_STRUCTURE.md) | 화면 구조 기획과 분할 · 컴포넌트 조립과 배치 · 사용자 흐름 |
| [docs/PIXEL_LOCAL_AS_BUILT.md](docs/PIXEL_LOCAL_AS_BUILT.md) | PIXEL LOCAL 현재 구현 (화면 문구·규칙·알려진 한계·시연 순서) |
| [docs/TASTE_COMMERCE_PLAN.md](docs/TASTE_COMMERCE_PLAN.md) | 다음 단계 기획 (취향 세분화·하트·개인정보·레퍼런스 분석) |
| [docs/PIXEL_LOCAL_POLICY.md](docs/PIXEL_LOCAL_POLICY.md) · [docs/DUKRYEOK_MAP_POLICY.md](docs/DUKRYEOK_MAP_POLICY.md) · [docs/AVATAR_POLICY.md](docs/AVATAR_POLICY.md) | 운영 정책 |
| [docs/PRODUCT_STRATEGY.md](docs/PRODUCT_STRATEGY.md) · [docs/UX_CX_STRATEGY.md](docs/UX_CX_STRATEGY.md) | 상품·UX 전략 |
| [docs/backend/](docs/backend/README.md) | 백엔드 실행·구조·스키마·API |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) · [docs/SETUP.md](docs/SETUP.md) | 협업 규칙 · 환경 세팅 |

## 팀원 및 역할
| 이름 | 역할 | 담당 |
| --- | --- | --- |
| 채희주 ([@kixxuya](https://github.com/kixxuya)) | 프론트엔드 | 화면 전체, 디자인 시스템, 메인·상품·PIXEL LOCAL UI |
| 안중섭 ([@skshdwkdvkfl55-art](https://github.com/skshdwkdvkfl55-art)) | BE-A 플랫폼·커머스 | 구글 로그인, 장바구니, 찜, 아바타, PIXEL LOCAL(덕력지도·거래·뱃지) |
| 황정민 ([@totoriri605-oss](https://github.com/totoriri605-oss)) | BE-B 주문·CS | FAQ, 가상 주문·배송, 취소, 리뷰, 상품 Q&A, 키캡 호환성, 메인 캐러셀 |
| 여름 ([@kyrdufmal-summer](https://github.com/kyrdufmal-summer)) | BE-C → 기획·정책·QA | PIXEL LOCAL 서비스 정의·운영 정책·개인정보 기준 정리(이슈 #151~), 현재 구현·화면 구조 문서화 |

> 작업 단위는 GitHub 이슈(라벨 `FE` · `BE-A` · `BE-B` · `BE-C` · `policy`)로 관리합니다.

## 협업 규칙
- **GitHub Flow**: `main`에 직접 push하지 않고 `feat/*` · `fix/*` · `docs/*` 브랜치에서 작업 후 Pull Request로 머지 (리뷰 1명 승인)
- 커밋 메시지: `feat(be-orders): 주문 생성 API` 형식
- 페이지 이동은 `next/link`의 `<Link>`, API 응답은 camelCase
- 자세한 규칙: [docs/CONVENTIONS.md](docs/CONVENTIONS.md) · 에이전트 규칙: `AGENTS.md`, `backend/AGENTS.md`

## 화면 캡처
| 메인 (데스크톱) | 메인 (모바일) |
| --- | --- |
| ![메인 데스크톱](docs/screenshots/v2/main.png) | ![메인 모바일](docs/screenshots/v2/main-mobile.png) |

| 전체 상품 (무한 스크롤) | 상품 상세 |
| --- | --- |
| ![전체 상품](docs/screenshots/v2/products.png) | ![상품 상세](docs/screenshots/v2/product-detail.png) |

| 키캡 피팅룸 | 데스크 룩북 |
| --- | --- |
| ![키캡 피팅룸](docs/screenshots/v2/fitting.png) | ![데스크 룩북](docs/screenshots/v2/lookbook.png) |

| PIXEL LOCAL 덕력지도 | 덕력지도 (모바일) |
| --- | --- |
| ![덕력지도](docs/screenshots/v2/local-map.png) | ![덕력지도 모바일](docs/screenshots/v2/local-map-mobile.png) |

| 거래·교환 | 위시맵 (선물하기) |
| --- | --- |
| ![거래·교환](docs/screenshots/v2/trades.png) | ![위시맵](docs/screenshots/v2/wish-map.png) |

| 없는 상품 (`/products/999`) |
| --- |
| ![상품을 찾을 수 없습니다](docs/screenshots/v2/not-found.png) |

> 캡처는 로그인하지 않은 상태, 1280px·390px 화면 기준입니다.

## 트러블슈팅
| 문제 | 원인 | 해결 |
| --- | --- | --- |
| 상세 페이지 `params` 사용법이 강의와 다름 | Next.js 15부터 `params`가 Promise로 변경 | `const { id } = await params`로 사용 |
| 모바일에서 로고 · 메뉴가 두 줄로 꺾임 | 헤더 가로 공간 부족 | `whitespace-nowrap`, 모바일 여백 축소 |
| ESLint가 `<img>` 사용을 경고 | Next.js는 `next/image`를 권장 | 과제 권장에 따라 `<img>` 유지, 사유를 단 주석으로 처리 |
| 페이지 이동이 즉시 일어나지 않고 빌드 경고 | Next 16 Cache Components에서 `params`·`searchParams`를 `<Suspense>` 밖에서 기다림 | 페이지는 Promise를 넘기기만 하고, 읽는 자식 컴포넌트를 `<Suspense>` 안에 둠 |
| 백엔드가 꺼지면 쇼핑몰 전체가 빈 화면 | 상품을 API에서만 가져옴 | API 실패 시 `data/products.ts`로 폴백 + 안내 문구 |
| 로그아웃·계정 전환 후 이전 사람의 이웃 카드가 잠깐 보임 | 덕력지도 60초 캐시가 사용자를 구분하지 않음 | 보는 사람이 바뀌면 캐시를 비우고 다시 불러옴 |
| 같은 물건으로 두 교환이 성사·코인 중복 지급, 취소된 주문이 결제 완료로 복구, 두 탭 동시 주문 | 상태를 읽고 바꾸는 사이에 다른 요청이 끼어듦 | 행 잠금(`SELECT … FOR UPDATE`) 후 상태 재검사, 주문당 대기 취소 신청 1개 DB 부분 유니크 인덱스, 회귀 테스트 추가 |
| 테스트가 시연용 DB의 주문·가격을 바꿈 | pytest가 개발 DB를 그대로 사용 | `<DB이름>_test` 전용 DB 사용, DB가 없으면 실패 대신 건너뜀 |
