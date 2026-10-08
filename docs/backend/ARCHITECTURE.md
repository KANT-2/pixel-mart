# 백엔드 아키텍처와 설계 결정

## 1. 전체 구조
```
브라우저 ──▶ Next.js (localhost:3000)
              ├─ 화면 (app/, components/)
              └─ /api/* ──rewrites──▶ FastAPI (localhost:8000) ──▶ PostgreSQL
```
- 브라우저는 **항상 3000번만** 봅니다. `/api/*`는 Next.js가 FastAPI로 넘깁니다.
- 그래서 **CORS 설정이나 쿠키 도메인 문제 없이** 로그인 쿠키가 자동으로 오갑니다.
- 기술: FastAPI · SQLAlchemy 2 (async) · asyncpg · Alembic · Pydantic v2 · PyJWT · Authlib

## 2. 로그인 (구글만)
**FastAPI가 구글 로그인을 직접 처리**하고, 로그인 결과는 **httpOnly 쿠키(`pm_session`, JWT)**로 유지합니다.

```
[구글로 로그인] 클릭
→ GET /api/auth/google/login          (FastAPI → 구글 로그인 화면으로 이동)
→ 구글 → GET /api/auth/google/callback (FastAPI가 사용자 확인, users 저장/조회)
→ pm_session 쿠키 설정 → 프론트 메인으로 이동
→ 이후 모든 /api 요청에 쿠키 자동 포함 → CurrentUser로 사용자 확인
```
- NextAuth를 쓰지 않는 이유: NextAuth 세션 토큰은 암호화돼 있어 FastAPI가 읽을 수 없고, 구글 토큰을 넘기면 1시간 뒤 만료 처리가 필요합니다. **로그인을 한 곳(FastAPI)에서만 관리**하면 단순합니다.
- 구글 콘솔 리디렉션 URI: `http://localhost:3000/api/auth/google/callback` (3000번 = 프록시 경유)
- **`POST /api/auth/dev-login`**: 구글 로그인 완성 전에도 모두가 "로그인 필요" 기능을 개발할 수 있게 하는 **로컬 전용** 임시 로그인. `ENV=local`일 때만 동작.

## 3. 데이터 원칙
- **상품은 DB가 원본**이 됩니다. 시드는 프론트 `data/*.ts` → `backend/seed/*.json` → `scripts/seed.py`.
  - 과제 1차 화면은 지금처럼 `data/products.ts`를 쓰고, 2차에서 프론트가 `/api/products`로 하나씩 옮깁니다.
- 금액은 **원 단위 정수**, 시간은 **timezone 있는 UTC** (`DateTime(timezone=True)`)
- 삭제가 필요한 사용자 데이터(리뷰, 거래글)는 상태값(`status`)으로 숨김 처리 우선

## 4. 기능별 설계 결정

### 4-1. 픽셀 아바타
- **변환은 브라우저(Canvas)에서** 합니다: 사진 → 32×32로 축소 → 색 16개로 줄이기 → 확대.
- 얼굴 사진 원본은 **서버로 보내지 않습니다** (개인정보 보호, 저장소 불필요).
- 서버에는 결과 PNG(수 KB)만 `users.avatar_url`에 data URL로 저장 → `PUT /api/users/me/avatar`.
- 로그인 상태면 메인 배너의 슬라임 자리에 아바타 표시.

### 4-2. Deskterior Tournament (`docs/DESKTERIOR_TOURNAMENT_POLICY.md` 기준)
- 데스크는 **상품 ID + Snap Zone** 목록만 저장 (JSONB), 이미지 저장 없음.
- 출품 검증 규칙은 **서버에서** 검사: 상품 3~7개, DP 합계 ≤ 100, 같은 상품 중복 금지, 카테고리별 최대 수, 2종 이상, 허용 Zone.
- 상품별 DP·크기·허용 Zone은 `product_desk_specs` 테이블 (시드로 채움).
- 토너먼트: 참가 수에 따라 Gallery 예선(3표) → 32강 대진 생성 → 1:1 투표. 본인 작품 투표 금지, 대결당 1표, 투표 종료 전 작성자 숨김.

### 4-3. Compatibility Preview (키캡 호환)
- `keyboards`(Mock 모델 데이터)와 `keycap_specs`(상품별 프로파일·사이즈)를 비교해 키별 결과를 돌려줍니다.
- 미리착샷은 프론트에서 키보드 배열 이미지 위에 키캡 이미지를 겹치는 방식 (서버는 결과 데이터만).

### 4-4. PIXEL LOCAL (덕력지도 · 거래 · Wish Map)
- **정확한 위치(GPS)는 저장하지 않습니다.** 사용자가 **동네(시·군·구)를 직접 선택**합니다.
- 덕력지도는 **익명 집계만** 보여 줍니다 ("분당구 레트로게임 팬 46명"). 개인 핀 없음.
- 집계 인원이 **3명 미만이면 숨김** (소수 인원으로 개인이 특정되지 않게).
- 프로필·거래글 공개는 사용자가 켠 경우에만 (`local_public`).
- 관심사(작품·캐릭터)는 **텍스트 태그**로만 다룹니다. 공식 이미지·로고는 사용하지 않습니다(저작권).
- 그래서 PostGIS 없이 일반 PostgreSQL로 충분합니다.

### 4-5. 주문 (결제 없음)
- "구매하기" → 장바구니 상품으로 **가상 주문** 생성 (결제 단계 생략, 상태 `paid`로 시작).
- 배송 상태는 시간이 지나면 자동으로 진행된 것처럼 계산하거나, 로컬 전용 `POST /api/dev/orders/{id}/advance`로 다음 단계로 넘깁니다.
- 리뷰는 **배송 완료된 주문의 상품만** 작성 가능.

### 4-6. 게이미피케이션
- 뱃지는 코드 기반(`NEW_PLAYER`, `BOSS_CLEAR` …). 회원가입, 첫 리뷰, 토너먼트 결과 같은 이벤트에서 지급.
