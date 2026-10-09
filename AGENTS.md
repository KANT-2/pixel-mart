<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# PIXEL MART — 프론트엔드 AI 에이전트 작업 규칙

> Codex 등 AI 코딩 에이전트가 이 저장소의 **프론트엔드**(루트의 Next.js)에서 작업할 때 따르는 규칙입니다.
> `backend/`에는 별도 규칙(`backend/AGENTS.md`)이 있고, 백엔드는 다른 팀원 3명의 담당이므로 **프론트 작업 중에는 `backend/`를 수정하지 않습니다**(읽기는 가능).

## 프로젝트 맥락
- PIXEL MART: 픽셀아트 게이밍 데스크 소품 쇼핑몰 + 취향 커뮤니티. 로컬 개발 전용, 결제 없음, 로그인은 구글만.
- 프론트 담당 1명(@kixxuya). 작업 단위는 GitHub 이슈(라벨 `FE`): `gh issue view <번호> --repo KANT-2/pixel-mart`
- 기능 기획 원본: `docs/PRODUCT_STRATEGY.md`, `docs/DESKTERIOR_TOURNAMENT_POLICY.md`, `docs/UX_CX_STRATEGY.md`
- API 계약: `docs/backend/API.md`(목록·담당) + 실행 중인 Swagger `http://localhost:3000/api/docs`(실제 모양의 기준)

## 기술 스택
Next.js 16 (App Router, Turbopack, **Cache Components 켜짐**) · React 19 · TypeScript · Tailwind CSS v4
- **새 라이브러리는 추가하지 않는다.** 꼭 필요하면 이유와 대안을 먼저 사람에게 제안한다.

## 명령어 (저장소 루트)
```bash
npm run dev          # 프론트 :3000 (백엔드는 backend/에서 uvicorn :8000 — backend/README 참고)
npm run lint
npx tsc --noEmit     # 경로 타입 오류가 나면 npm run build 한 번 후 다시
npm run build
```
작업을 "완료"라고 말하기 전에 **lint · tsc · build를 실제로 실행해 통과를 확인**한다.

## Next.js 16 필수 규칙 (어기면 경고·빌드 에러)
- 동적 경로 `params`, 쿼리 `searchParams`는 **Promise**. `await`는 **`<Suspense>` 안쪽 자식 컴포넌트에서** 한다
  (페이지 자체는 async로 기다리지 말고 promise를 자식에 넘김 — `app/products/page.tsx`, `app/products/[id]/page.tsx` 참고)
- 동적 상세 경로는 `generateStaticParams`로 미리 생성 가능한 것은 생성 (최소 1개 반환)
- 없는 리소스는 `notFound()` + 같은 폴더 `not-found.tsx`
- 타입은 전역 헬퍼 `PageProps<"/경로">`, `LayoutProps<"/">` 사용
- 확실하지 않은 API는 `node_modules/next/dist/docs/`에서 확인 후 사용

## 폴더 · 이름 규칙
```
app/<경로>/page.tsx        화면 (서버 컴포넌트 기본)
components/<이름>.tsx       재사용 UI — PascalCase, props interface 정의
components/<기능>/...       기능 묶음이 커지면 폴더로 (예: components/desk/)
lib/api.ts                 API 호출 공통 함수 (아래 규칙)
types/api.ts               백엔드 응답 타입 (camelCase, Swagger와 같은 모양)
mocks/<기능>.ts             백엔드 미완성 API의 임시 데이터 (같은 타입)
utils/                     순수 함수 (formatPrice 등)
data/                      1차 과제 정적 데이터 (상품 폴백용으로 유지)
```

## 데이터 가져오기 규칙
- **브라우저(클라이언트 컴포넌트)**: 항상 상대 경로 `/api/...` 로 호출 → Next rewrites가 FastAPI로 전달, 로그인 쿠키 자동 포함
- **서버 컴포넌트**: 공개 데이터(상품·카테고리·FAQ·리뷰 목록)만 서버에서 가져온다. `process.env.BACKEND_URL ?? "http://localhost:8000"` + `/api/...`
- **로그인 사용자 데이터**(내 정보·장바구니·주문·찜·데스크)는 **클라이언트 컴포넌트**에서 가져온다
- 모든 호출은 `lib/api.ts`의 공통 함수 사용: JSON 파싱, `res.ok` 아니면 백엔드의 `detail` 한글 메시지로 에러 throw, 401은 "로그인이 필요합니다" 처리
- **상품 목록·상세는 API 실패 시 `data/products.ts`로 폴백**한다 (백엔드가 꺼져도 쇼핑몰 기본 화면은 동작)
- 백엔드 API가 아직 머지되지 않았으면 `mocks/`의 같은 타입 데이터로 화면을 먼저 만들고, 코드에 `// TODO(#백엔드이슈번호): API 연결` 표시
- 응답 필드는 **camelCase** (`imageUrl`, `isNew`, `totalPages`). 목록은 `Page<T>` = `{ items, total, page, size, totalPages }`

## 로그인 · 상태
- 로그인 상태는 `AuthProvider`(클라이언트 Context)에서 `/api/auth/me`로 확인. 401이면 비로그인
- 로컬 개발: `POST /api/auth/dev-login`(이메일 입력) / 구글: `<a href="/api/auth/google/login">` — **API 리다이렉트는 `<Link>`가 아니라 `<a>`**
- 비로그인 사용자가 로그인 필요 기능을 누르면 로그인 안내를 보여 준다 (에러 화면 X)

## 화면 · 디자인 규칙
- 페이지 이동은 **`next/link`의 `<Link>`** (API 리다이렉트만 예외)
- 상품 이미지는 일반 `<img>` + `aspect-square object-cover` (ESLint 경고 줄에는 사유 주석)
- 색·폰트는 `app/globals.css`의 토큰만 사용: `bg-night` `bg-panel` `bg-panel-2` `border-line` `text-ink` `text-sub` `text-dim` `text-lime` `bg-violet` `text-mint` `text-pink` `font-pixel`
  - 강조색(연두 글로우)은 주요 버튼에만. 영문 장식 라벨은 `font-pixel`, 버튼·정보 문구는 한글
- 반응형: 모바일 1열 → `sm` 2열 → `md` 3열 → `lg` 4열, 375px에서 가로 스크롤 없게
- 접근성: 아이콘 버튼 `aria-label`, 이미지 `alt`, 키보드로 조작 가능
- 로딩은 스켈레톤(`animate-pulse bg-panel`), 빈 상태와 에러 상태 문구를 반드시 만든다

## 기능별 원칙 (임의로 바꾸지 말 것)
- **픽셀 아바타**: 사진 → Canvas로 축소(32×32) → 색 줄이기(16색) → 확대. **원본 사진은 서버로 보내지 않는다.** PNG data URL(50KB 이하)만 `PUT /api/users/me/avatar`
- **데스크 꾸미기**: Snap Zone 방식(LEFT/CENTER/RIGHT/KEYBOARD/FRONT). 규칙(3~7개, DP 100 이하 등)은 화면에서 미리 보여 주되 **최종 판단은 `POST /api/desks/validate`** 결과를 따른다
- **토너먼트 투표 화면**: 투표 종료 전 작성자 이름·상품 가격 숨김
- **PIXEL LOCAL** (`docs/PIXEL_LOCAL_POLICY.md`, `docs/DUKRYEOK_MAP_POLICY.md`): GPS는 "내 위치로 보기/찾기" 버튼을 눌렀을 때만 요청하고 좌표는 브라우저 안에서 가까운 지역 찾기에만 사용(전송·저장·URL·로그 금지, 정책 4.1). 덕력지도는 실제 지역 모양 픽셀 지도 + 아바타 핀(동의자 5명 이상만, 무작위 최대 6명, 닉네임·위치 없음, 부족하면 집계 기반 슬라임) — 사용자 목록·프로필 링크 X(정책 4.2), 5명 미만은 숫자 비공개, `isSample` 데이터는 "샘플" 표시, 빈 화면엔 다음 행동(상위 지역 보기·관련 상품·취향 등록) 제공
- 실존 캐릭터·작품은 텍스트 태그만, 공식 이미지·로고 사용 금지

## 작업 방식
1. 이슈와 관련 문서를 읽고 **계획(만들/고칠 파일, 컴포넌트 구조, 사용할 API, 확인 방법)을 먼저 제시**한 뒤 진행
2. 한 PR은 한 이슈. 브랜치 `feat/fe-<기능>` (예: `feat/fe-cart`)
3. 백엔드 응답이 API.md와 다르면 프론트에서 억지로 맞추지 말고 **PR/보고에 "BE 확인 필요"로 기록**
4. 커밋 메시지 `feat(fe): 장바구니 페이지` 형식, 한글 OK
5. PR 본문: `Closes #이슈번호`, 화면 캡처(데스크톱·모바일), 실행한 검증 결과, 연결한 API 목록

## 코드 스타일
- 기존 코드처럼 짧은 한글 주석으로 "왜"만. 컴포넌트는 작게, props 타입 명시, `any` 금지
- 서버/클라이언트 경계를 의식: 상태·이벤트가 있는 최소 부분만 `"use client"`
