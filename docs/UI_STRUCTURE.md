# PIXEL MART — 화면 구조 · 컴포넌트 · 사용자 흐름

> **기준: `main` 1792535 (2026-10-13, PR #211)** · 실제 코드에서 추출했습니다. 화면 문구는 따옴표 안에 화면 그대로 적었습니다.
> 1. 화면 구조 기획과 분할 · 2. 컴포넌트 조립과 배치 · 3. 사용자 흐름(User Flow)

---

## 0. 한눈에 보기

### 0-1. 사이트맵 (27개 경로)

```mermaid
flowchart LR
  root["/ 메인"]
  subgraph SHOP["쇼핑"]
    products["/products 전체 상품"] --> detail["/products/[id] 상품 상세"] --> fitting["/products/[id]/fitting 키캡 피팅룸"]
    cart["/cart 장바구니"] --> checkout["/checkout 주문하기"]
    lookbook["/lookbook 데스크 테마 룩북"]
  end
  subgraph LOCAL["PIXEL LOCAL"]
    map["/local 덕력지도"]
    wish["/local/wish-map 위시맵"]
    trades["/local/trades 거래·교환"] --> tnew["/local/trades/new 글쓰기"]
    trades --> tmine["/local/trades/mine 내 거래"]
    gift["/local/gift 선물하기"]
    settings["/local/settings 내 동네·취향 설정"]
  end
  subgraph MY["마이페이지"]
    mypage["/mypage"] --> orders["/mypage/orders 주문 내역"] --> order["/mypage/orders/[id] 주문 상세"]
    mypage --> wl["/mypage/wishlist 찜"]
    mypage --> gifts["/mypage/gifts 선물함"]
    mypage --> avatar["/mypage/avatar 픽셀 아바타"]
    mypage --> quests["/mypage/quests 내 퀘스트"]
  end
  subgraph ETC["계정·지원"]
    login["/login"] --> signup["/signup"]
    help["/help 고객센터"]
  end
  root --> SHOP
  root --> LOCAL
  root --> MY
```

예외 화면: `app/not-found.tsx`(GAME OVER · STAGE 404), `app/products/[id]/not-found.tsx`(상품을 찾을 수 없습니다), `app/mypage/orders/[id]/not-found.tsx`, `app/error.tsx`(ERROR!) — 모두 공통 `GameOverScreen`

### 0-2. 설계 원칙 (코드에서 일관되게 쓰인 규칙)

| 원칙 | 적용 |
| --- | --- |
| 페이지는 서버, 상호작용만 클라이언트 | 모든 `app/**/page.tsx`는 서버 컴포넌트. 상태·이벤트가 있는 본문만 `"use client"` |
| URL 파라미터를 읽는 클라이언트는 `<Suspense>` 안에 | `searchParams`·`useSearchParams`를 쓰는 본문은 페이지마다 스켈레톤 fallback으로 감쌈 |
| 공개 데이터는 서버, 내 데이터는 클라이언트 | 상품·카테고리·FAQ는 서버에서, 장바구니·주문·찜·동네·선물은 클라이언트에서 |
| 실패해도 쇼핑은 동작 | 상품 API 실패 시 `data/products.ts`로 폴백 + 안내 문구 |
| 로그인 필요 동작은 돌아오기 | 비로그인 → `/login?next={현재 경로}` → 로그인 후 원래 화면 (`safeNextPath`) |
| 모든 화면에 4가지 상태 | 로딩(스켈레톤) · 빈 상태(다음 행동 버튼) · 오류(다시 시도) · 로그인 필요 |
| 반응형 열 수 | 상품 그리드 2 → 3(md) → 4(lg), 상세·장바구니·주문은 1열 → 2열(lg) |

---

## 1. 화면 구조 기획과 분할

### 1-1. 공통 레이아웃 (`app/layout.tsx`)

```
┌──────────────────────────── Header (sticky, 반투명) ────────────────────────────┐
│ [로고 PIXEL MART]  [홈 · 전체 상품 · PIXEL LOCAL]   [♡ 찜][🎁 선물함][🛒 카트][🔔 알림][👤 사용자] │
└──────────────────────────────────────────────────────────────────────────────────┘
│                                   <main> 페이지                                    │
└────────────── Footer: 소개 · 이용약관 · 개인정보처리방침 · 고객센터 · 사업자 정보 ──────────────┘
```

| 영역 | 데스크톱(lg 이상) | 모바일 |
| --- | --- | --- |
| 주 메뉴 | 로고와 같은 줄 | 헤더 둘째 줄 전체 폭, 가로 스크롤 |
| 사용자 메뉴 | 아바타 + 닉네임 + ▾ | 아바타만 |
| 헤더 고정 | sticky | 휴대폰 가로(높이 500px 이하)에서는 고정 해제 |

PIXEL LOCAL 하위는 추가로 `app/local/layout.tsx`가 탭 바 **"덕력지도 · 거래·교환 · 위시맵"** 을 붙입니다. 탭은 보고 있던 지역(`?region=`)을 유지합니다.

### 1-2. 쇼핑 화면

**메인 `/`**
```
┌ 메인 배너 캐러셀 (3장: 01 내 캐릭터 → 02 월드맵 → 03 데스크 룩북, 번호 탭 + 진행 막대 + ‹ ›) ┐
│  [왼쪽: kicker · 제목 · 설명 · 버튼 2개]        [오른쪽: 게임 무대 / 픽셀 지도 / 룩북 카드]   │
└─────────────────────────────────────────────────────────────────────────────────────┘
┌ ▶ QUEST · RECOMMENDED  추천 아이템                                   전체 보기 → ┐
│  상품 카드 4개  (2열 → 3열 md → 4열 lg)                                          │
└───────────────────────────────────────────────────────────────────────────────┘
```
배너는 md 이상 2열(텍스트 | 시각 요소), 모바일은 1열로 쌓임.

**상품 목록 `/products`**
```
[kicker · h1 "전체 상품" · "총 N개"]
[도구 막대: 검색 | 정렬 ▾ | ☰ 필터 ▾ | 등급 칩 COMMON·RARE·EPIC·UNIQUE]   ← lg 미만에서 필터 줄이 아래로 내려감
[상품 그리드 2 → 3 → 4열, 무한 스크롤 + "더 보기"]
```

**상품 상세 `/products/[id]`**
```
[breadcrumb 홈 › 전체 상품 › 카테고리]
┌ 이미지(등급 테두리·NEW·RARITY) ┬ 정보: 이름+찜 · 가격 · 설명 · ITEM STATS · [수량][장바구니 담기] [끼워 보기] [목록으로] ┐   ← md 2열 / 모바일 1열
[탭: 상품정보 | 리뷰(★ · N개) | 문의]   (#info · #reviews · #qna)
[같은 카테고리 상품 2 → 4열]
[최근 본 아이템 (모바일 가로 스냅 스크롤)]
```

**키캡 피팅룸 `/products/[id]/fitting`**
```
┌ STEP 1 내 키보드 (모델·스위치·나머지 키 색) ┬ 내 조합 ┐   ← lg 2열 (본문 | 320px)
│ STEP 2 키보드 미리보기 (끼우기 전/후)        │ 장바구니에 담긴 키캡 │
│ 키캡 서랍 (검색·종류·색 필터, 3 → 6열)        │ 상세로 돌아가기 │
└────────────────────────────────────────┴──────────┘
```
휴대폰 세로: 회전 안내 / 휴대폰 가로: 키보드 | 키캡 서랍 분할 스크롤

**장바구니 `/cart` · 주문 `/checkout`**
```
┌ 담은 상품 목록 (썸네일·이름·단가·수량·소계·삭제) ┬ 합계 aside (sticky) [주문하기] ┐   ← lg 2열
┌ 주문 요약                                    ┬ 배송지 입력 [주문하기]          ┐
```

### 1-3. PIXEL LOCAL 화면

**덕력지도 `/local`**
```
[헤더: 덕력지도 · ⚙ 설정]
[위치: 전체 › 시 › 구]
[도구 막대: 취향 칩(전체·내 취향·⌕ 취향 찾기) | 동네 검색 | ◎ 내 위치로 보기]
┌ 픽셀 지도 (이름표·캐릭터·확대 +/−) + 범례 + 안내 ┬ 지역 패널 300px ┐   ← lg
│                                            │ 인원 · 인기 취향 TOP3 · 구매 순위 TOP10 │
│                                            │ 이웃 카드(캐릭터 클릭 시)        │
│                                            │ [이 동네 교환글][관련 상품][여기를 내 동네로] │
```
| 폭 | 지역 패널 위치 |
| --- | --- |
| lg 이상 | 지도 오른쪽 300px 고정 열 |
| sm ~ lg | 지도 아래 |
| 모바일 | 숨김 → 지역·캐릭터를 누르면 **아래에서 올라오는 시트**(최대 65% 높이, "닫기 ✕") |

모바일에서는 검색 줄("⌕ 검색")과 지도 안내("ⓘ 지도 안내 보기")를 접어 지도가 첫 화면에 보이게 함.

**위시맵 `/local/wish-map`**: 지도(선물 상자 핀) | WISH 패널 340px — 패널 모드 3가지(지역 / '닉네임' 플레이어 / '아이템' 위시), 하단 "이 동네 인기 찜"

**거래·교환 `/local/trades`**: [검색(닉네임·아이템) · 종류 ALL/HAVE/SELL] → [조건 칩·범위] → 카드 그리드 1 → 2 → 3 → 4열 + 페이지 이동

**내 거래 `/local/trades/mine`**: ① 교환 신청함(받은/보낸 탭) → ② 내 글(카드 + 거래 완료·숨기기) → ③ 교환 제안(나 ⇄ 이웃 교환 창)

**선물하기 `/local/gift`**: [선물 창: 나 → 이웃 위시 / 수량·메시지] | CHECKOUT aside 320px

**설정 `/local/settings`**: 1열 3단계 — 01 내 동네 · 02 내 취향 · 03 활용과 공개(스위치 5개) → 저장

### 1-4. 마이페이지

| 화면 | 구조 |
| --- | --- |
| `/mypage` | 1열 카드 스택: 닉네임 → 아바타 바로가기 → **뱃지 도감** → 동네 설정 · 주문 · 선물함 · 찜 링크 |
| `/mypage/orders/[id]` | 배송 현황(4단계) + 타임라인 + 주문 아이템(배송 완료 시 "리뷰 쓰기") + 취소 신청 | 배송지 aside |
| `/mypage/avatar` | 탭(AI로 만들기 / 픽셀 캔버스) | 지금 내 아바타 aside |
| `/mypage/gifts` | 받은/보낸 탭 → 선물 행(받기: 이름·주소 입력 / 거절) |
| `/mypage/quests` | 메인 캐러셀의 '내 퀘스트' 장만 고정 표시 (수락 대기 선물 · 매칭 · 진행 중 거래) |

---

## 2. 컴포넌트 조립과 배치

### 2-1. 전역 조립 (Provider 구조)

```mermaid
flowchart TB
  layout["app/layout.tsx (서버)"] --> auth["AuthProvider · useAuth()<br/>user · login · logout"]
  auth --> cartP["CartProvider · useCart()<br/>cart · add · update · remove"]
  cartP --> wishP["WishlistProvider · useWishlist()<br/>wishedIds · toggle"]
  wishP --> header["Header"] & main["main: 페이지"] & footer["Footer"]
  header --> nav["HeaderNav"] & sc["HeaderShortcuts(찜·선물함)"] & cb["CartButton"] & bell["NotificationBell"] & um["UserMenu"]
  main --> localLayout["app/local/layout.tsx"]
  localLayout --> localP["LocalProvider · 지역 목록 · 내 동네 프로필"] --> localNav["LocalNav 탭"]
```

- 장바구니·찜은 로그인 사용자가 바뀌면 저장소를 새로 만들어, 다른 계정 데이터가 섞이지 않게 함
- PIXEL LOCAL 전용 상태(`LocalProvider`)는 `/local` 하위에만 둬서 쇼핑 화면에 불필요한 요청이 없음

### 2-2. 페이지별 컴포넌트 트리 (대표)

**상품 상세**
```
page (서버) ─ Suspense ─ ProductDetail (서버, async)
  ├ ProductFallbackNotice
  ├ WishButton (클라)
  ├ AddToCartButton (클라) ─ QuantityInput
  ├ ProductDetailTabs (클라) ─ 상품정보(서버 children) · ReviewsPanel · QuestionsPanel ─ FeedbackLogin
  ├ ProductCard ×4 (같은 카테고리)
  └ RecentlyViewed (클라, localStorage)
```

**덕력지도**
```
page (서버) ─ LocalPageHeader ─ Suspense ─ FandomMapScreen (클라)
  ├ InterestFilter ─ 취향 찾기 팝오버
  ├ SearchToggle · MapNotes (MobileToggles)
  ├ RegionSearch
  ├ PixelMap (지도·확대 툴바)
  └ PlacePanel ─ NeighborCard ─ MyProgress │ 인기 취향 TOP3 │ BuyerRanking
     또는 PlaceGuide (지역 선택 전)
```

**내 거래**
```
page (서버) ─ Suspense ─ MyTrades (클라)
  ├ TradeRequestInbox (받은/보낸 신청 → 교환 창 TradeExchange에서 수락·거절·취소·받았어요)
  ├ TradeCard + TradeStatusButtons ×N
  └ SentRequestsProvider ─ TradeWindow ─ TraderPanel ×2 · TradeCard · TradeRequestButton
```

**메인**
```
page (서버)
  ├ HomeCarousel (클라)
  │   ├ 01 내 캐릭터: HeroStage ─ HeroHud · HeroCharacter · HeroQuest · SpriteLayer
  │   ├ 02 월드맵: WorldMapTeaser ─ PixelMap   ← 덕력지도와 같은 컴포넌트
  │   └ 03 데스크 룩북: ThemePicker · 추천 상품 3 · 동네 인기 찜
  └ Suspense ─ RecommendedProducts ─ ProductCard ×4
```

### 2-3. 재사용 컴포넌트

| 컴포넌트 | 쓰는 화면 | 역할 |
| --- | --- | --- |
| `ProductCard` (+ `WishButton`) | 메인 · 상품 목록 · 상세(관련 상품) · 찜 · 룩북 | 상품 카드 하나로 5개 화면 통일 |
| `ProductSkeleton` · `ProductFallbackNotice` · `EmptyProducts` | 메인 · 목록 · 상세 · 룩북 | 상품 화면 공통 상태 |
| `QuantityInput` | 상세 · 장바구니 | 수량 1~99 |
| `Pagination` | 주문 내역 · 찜 · 거래 게시판 | 페이지 이동 |
| `GameOverScreen` | 404 · 상품 없음 · 오류 | 게임 콘셉트 예외 화면 |
| `NicknameField` | 로그인 · 가입 · 마이페이지 | 실시간 중복 확인 + 추천 |
| `PixelAvatar` | 사용자 메뉴 · 메인 무대 · 아바타 · 뱃지 · 지도 | 픽셀 이미지 표시 |
| `PixelMap` | 덕력지도 · 위시맵 · 메인 월드맵 | 지도 하나로 3곳 |
| `HomeCarousel` | 메인 · 내 퀘스트 | `questOnly`로 퀘스트 장만 |
| `TradeCard` · `TradeRequestButton` | 거래 게시판 · 내 거래 | 거래 카드·교환 신청 |
| `TraderPanel` | 내 거래(교환 창) · 선물하기 | "나 ⇄ 이웃" 게임 거래 창 |
| `InterestPicker` | 설정(최대 20) · 글쓰기(1개) | 취향 고르기 |
| `LocalSkeleton` · `LocalError` | PIXEL LOCAL 전 화면 · 선물함 · 뱃지 | 공통 상태 |
| `useLocalResource` | 지도·거래·선물함·뱃지·캐러셀 | 데이터 불러오기 훅 |

### 2-4. 서버/클라이언트 경계

| 서버에서 | 클라이언트에서 |
| --- | --- |
| 페이지 셸, 제목, 상품 목록 첫 페이지, 상품 상세, 카테고리, FAQ, 룩북 상품 | 로그인 상태, 장바구니, 찜, 주문, 리뷰 작성, 지도, 거래, 선물, 알림, 아바타 편집, 무한 스크롤 |

---

## 3. 사용자 흐름 (User Flow)

### 3-1. 쇼핑: 탐색 → 구매 → 배송 → 리뷰

```mermaid
flowchart LR
  A["메인<br/>'아이템 둘러보기'·추천 카드"] --> B["상품 목록<br/>검색·정렬·필터·등급"]
  B --> C["상품 상세"]
  C -->|키캡| F["피팅룸<br/>'내 키보드에 끼워 보기'"]
  F -->|"조합 그대로 장바구니 담기"| D
  C -->|"장바구니 담기"| L{로그인?}
  L -->|아니요| LG["/login?next=상세"] --> C
  L -->|예| D["장바구니"]
  D -->|"주문하기"| E["주문하기<br/>받는 사람·주소"]
  E -->|"POST /orders"| G["주문 상세<br/>'주문이 완료됐어요!'"]
  G --> H["배송 현황 4단계"]
  H -->|배송 완료| R["'리뷰 쓰기' → 상세 #reviews"]
  G -->|"취소 신청"| X["취소 사유 → 확인"]
```

### 3-2. 가입 → 동네·취향 설정

```mermaid
flowchart LR
  A["'로그인'"] --> B["'Google로 계속하기'"]
  B --> C{기존 회원?}
  C -->|예| H["원래 화면(next)"]
  C -->|아니요| D["/signup '플레이어 이름 정하기'<br/>닉네임 중복 확인"]
  D -->|"▶ 이 이름으로 시작하기"| E["메인 · 01 내 캐릭터"]
  E -->|"▶ 내 픽셀 아바타 만들기"| AV["/mypage/avatar"]
  E -->|'월드맵' 배너| M["덕력지도"]
  M -->|"⚙ 설정"| S["내 동네·취향 설정<br/>01 동네 · 02 취향 · 03 공개 5종"]
  S -->|"저장"| P["활동 점수 +5 · 알림<br/>탭·지도가 내 동네로"]
```

### 3-3. 발견 → 연결: 덕력지도 → 이웃 카드 → 교환 신청

```mermaid
flowchart TB
  A["덕력지도<br/>취향 칩·⌕ 취향 찾기"] --> B["시 → 구 → 생활권 클릭"]
  B --> C["지역 패널<br/>인원·인기 취향·구매 순위"]
  B --> D["캐릭터 클릭 → 이웃 카드<br/>하트·LV·교환 횟수·뱃지"]
  D -->|"WANT n개 보기 · 선물하기"| W["위시맵 '닉네임' 플레이어"]
  C -->|"이 동네 교환글 보기"| T["거래·교환 게시판"]
  T -->|"⇄ 교환하기 (내 교환글 물건 고르기)"| R["신청 → 작성자에게 알림"]
  R --> I["작성자: 내 거래 '교환 신청'<br/>받은 신청 · 교환 창"]
  I -->|"수락"| P["교환 진행 중<br/>두 글 마감"]
  P -->|"두 사람 모두 '받았어요'"| OK["교환 완료<br/>양쪽 +20점 · 하트·뱃지 알림"]
  I -->|"거절"| NO["신청자에게 거절 알림"]
```

### 3-4. 선물: 위시맵 → 선물 → 받기 → 주문

```mermaid
flowchart LR
  A["위시맵<br/>동네·닉네임·아이템 검색"] --> B["WISH 글 '🎁 선물하기'<br/>(남의 글·상품 연결 글만)"]
  B --> C["선물하기<br/>수량 1~9 · 메시지 100자"]
  C -->|"선물 결제하기 (데모)"| D["'GIFT SENT!'"]
  D -. "알림: 선물이 도착했어요" .-> E["받는 사람 선물함"]
  E -->|'받기' 이름·주소 입력| F["받는 사람 주문 생성<br/>'배송 현황 보기 →'"]
  F -. "보낸 사람 +10점·알림" .-> G["보낸 사람 선물함 '받았어요'"]
  E -->|"거절"| H["보낸 사람 '거절 · 환불(데모)'"]
```

### 3-5. 신뢰: 활동 → 점수 → 하트·뱃지 → 알림

```mermaid
flowchart LR
  A["동네·취향 저장 +5<br/>첫 WANT +10<br/>교환 완료 +20(양쪽)<br/>선물 성사 +10"] --> B["활동 점수"]
  B --> C["하트 30·65·90점 → 이후 30점마다<br/>LV.1~10"]
  B --> D["뱃지 19종 (기록으로 계산)"]
  C & D --> E["🔔 알림 '하트가 늘었어요' · '뱃지 획득!'"]
  E --> F["/mypage/quests · /mypage 뱃지 도감"]
  C --> G["이웃 카드(공개 동의 시)"]
```

### 3-6. 화면 간 이동 표 (주요 버튼)

| 출발 | 버튼 (화면 문구) | 도착 |
| --- | --- | --- |
| 헤더 | "홈" · "전체 상품" · "PIXEL LOCAL" | `/` · `/products` · `/local` |
| 헤더 | ♡ · 🎁 · 🛒 | `/mypage/wishlist` · `/mypage/gifts` · `/cart` |
| 사용자 메뉴 | "마이페이지" · "교환 신청함" · "내 퀘스트" | `/mypage` · `/local/trades/mine#trade-requests` · `/mypage/quests` |
| 메인 01 | "▶ 내 픽셀 아바타 만들기" / "▶ 오늘의 장비 고르기" | `/mypage/avatar` / `/products` |
| 메인 02 | "월드맵 열기" · "동네 교환글" · 지도 지역 | `/local` · `/local/trades` · `/local?region=` |
| 메인 03 | "{테마} 테마 상품 보기 →" | `/lookbook?theme=` |
| 상품 상세 | "장바구니 담기" → "담았어요 · 장바구니 보기" | `/cart` |
| 상품 상세 | "내 키보드에 끼워 보기" (키캡만) | `/products/[id]/fitting` |
| 장바구니 | "주문하기" | `/checkout` |
| 주문하기 | "주문하기" | `/mypage/orders/[id]?placed=1` |
| 주문 상세 | "리뷰 쓰기" (배송 완료) | `/products/[id]#reviews` |
| 덕력지도 패널 | "이 동네 교환글 보기" · "여기를 내 동네로" | `/local/trades?region=` · `/local/settings?region=#region` |
| 이웃 카드 | "WANT n개 보기 · 선물하기" | `/local/wish-map?nickname=` |
| 위시맵 | "🎁 선물하기" · "내 WISH 올리기" | `/local/gift?post=` · `/local/trades/new?kind=want` |
| 거래 게시판 | "⇄ 교환 신청" · "글쓰기" · "내 글·교환 신청" | 신청 API · `/local/trades/new` · `/local/trades/mine` |
| 선물 완료 | "보낸 선물 보기" | `/mypage/gifts?box=sent` |
| 알림 | 교환 · 선물 · 주문 · 점수·하트 · 뱃지 | 내 거래 · 선물함 · 주문 상세 · 내 퀘스트 · 마이페이지 |
| 404 | "▶ 홈으로 CONTINUE" · "상품 둘러보기" | `/` · `/products` |

---

## 4. 확인된 개선 포인트 (코드 기준 사실)

| 항목 | 내용 |
| --- | --- |
| 메인 HUD | "HP"·"× 003", 퀘스트 카드 "첫 구매 시 1,000P"가 고정 문구 (#192·#187, backlog) |
| 미노출 코드 | 메인 캐러셀 '토너먼트 예고' 장, `page.tsx`의 월드맵 섹션 주석 |
| 마크업 | `/lookbook`이 `<main>` 안에 `<main>`을 다시 씀, `/lookbook`·`/mypage/quests`에 탭 제목(metadata) 없음 |
| 푸터 | "이용약관"·"개인정보처리방침"이 링크 아님 (#171, backlog) |
| 마이페이지 | 비로그인 시 로그인 안내 없이 링크 카드만 보임 |
| 상품 목록 | 카테고리별 개수를 API가 아닌 정적 데이터로 셈 (TODO #16) |
| 덕력지도 안내 카드 | "관심 있는 상품"이 지역과 무관한 상품 검색으로 이동 |
