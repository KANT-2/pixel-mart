# PIXEL MART 백엔드 — AI 에이전트 작업 규칙

> 이 파일은 AI 코딩 에이전트(Claude Code, Cursor, Codex 등)가 `backend/`에서 작업할 때 따르는 규칙입니다.
> 사람용 상세 문서는 `docs/backend/` 에 있습니다. 규칙이 충돌하면 이 파일 → `docs/backend/ARCHITECTURE.md` 순으로 따릅니다.

## 프로젝트 맥락
- PIXEL MART: 픽셀아트 게이밍 데스크 소품 쇼핑몰 + 취향 커뮤니티. **로컬 개발 전용**(배포 없음), 결제 없음, 로그인은 구글만.
- 프론트: Next.js 16 (저장소 루트, 담당 1명). 브라우저는 `localhost:3000`만 보고, `/api/*`는 Next.js rewrites로 FastAPI(`:8000`)에 전달된다.
- 백엔드 담당 트랙 (자기 트랙 범위만 작업):
  - **BE-A** 플랫폼·커머스: 구글 로그인, users, 장바구니, 찜, 상품 API 확장, PIXEL LOCAL — 이슈 #12~#19
  - **BE-B** 주문·CS: FAQ, 가상 주문·배송 타임라인, 취소, 리뷰, 상품 Q&A, 키캡 호환성 — 이슈 #20~#26
  - **BE-C** 커뮤니티·게임: 데스크 사양·규칙, 데스크 CRUD, 뱃지, 토너먼트 — 이슈 #27~#34
- 작업 전에 해당 GitHub 이슈 본문(만들 테이블·API·완료 기준)을 기준으로 삼는다: `gh issue view <번호> --repo KANT-2/pixel-mart`
- 기능 기획 원본: `docs/PRODUCT_STRATEGY.md`, `docs/DESKTERIOR_TOURNAMENT_POLICY.md`, `docs/UX_CX_STRATEGY.md`

## 기술 스택
Python 3.12+ · FastAPI · SQLAlchemy 2 (async, `Mapped[...]` 스타일) · asyncpg · Alembic · Pydantic v2 · pydantic-settings · PyJWT · Authlib · pytest(+pytest-asyncio, `asyncio_mode=auto`) · ruff

## 명령어 (`backend/` 에서, 가상환경 활성화 상태)
```bash
uvicorn app.main:app --reload --port 8000   # 서버
alembic revision --autogenerate -m "add orders"   # 모델 변경 후 마이그레이션 생성
alembic upgrade head                          # 마이그레이션 적용
python -m scripts.seed                        # 상품·카테고리 시드 (재실행 안전)
ruff check . && ruff format .                 # 린트·포맷
pytest                                        # 테스트
```
- Windows 콘솔에서 한글이 깨지면 `PYTHONIOENCODING=utf-8` 을 붙여 실행.

## 폴더 구조와 위치 규칙
```
app/main.py          라우터 등록 (새 라우터는 for 루프 튜플에 한 줄 추가)
app/deps.py          DbSession, CurrentUser, OptionalUser
app/core/            config(.env) · db(Base, engine, get_db) · security(JWT 쿠키)
app/models/<기능>.py  테이블 — 반드시 app/models/__init__.py 에 import 추가
app/schemas/<기능>.py 요청·응답 (CamelModel 상속)
app/services/<기능>.py 여러 곳에서 쓰는 규칙·계산 (DB 없이 테스트 가능한 순수 함수 우선)
app/routers/<기능>.py API
alembic/versions/    마이그레이션
tests/test_<기능>.py 테스트
```

## 반드시 지킬 규칙

### API
- 경로는 `/api` 접두사(main.py에서 자동) + 복수형 명사: `/orders`, `/orders/{id}/cancel-requests`
- 요청·응답 스키마는 `app.schemas.common.CamelModel` 상속 → JSON은 **camelCase**, 파이썬은 snake_case
- 목록은 `Page[T]` (`items, total, page, size, totalPages`), 쿼리 `page`(≥1)·`size`(≤60)
- 에러: `HTTPException(status.HTTP_..., "한글 메시지")` — 404(없음/남의 것), 403(권한·조건 불충족), 400(상태 오류), 422(입력 형식)
- 로그인 필요: 인자 `user: CurrentUser` / 선택: `user: OptionalUser`. **남의 데이터는 403이 아니라 404**로 숨긴다.
- 개발용 API(`/api/dev/...`, `dev-login`)는 `settings.is_local` 이 아니면 404

### DB
- 모델은 SQLAlchemy 2 `Mapped[...]` + `mapped_column`, 시간은 `DateTime(timezone=True)`, 금액은 원 단위 `int`
- 제약조건 이름은 `Base`의 naming convention이 자동 처리 — 직접 이름 짓지 않는다
- **마이그레이션은 autogenerate 후 반드시 파일을 열어 검토**하고, `alembic upgrade head`로 깨끗한 DB에서 적용되는지 확인
- 다른 트랙의 테이블을 만들거나 수정하지 않는다. 필요하면 사용자(사람)에게 "담당 트랙에 요청 필요"라고 알린다
- 기존 마이그레이션 파일은 수정하지 않는다(새 파일 추가). "Multiple head revisions"가 나면 내 파일의 `down_revision`을 최신 head로 바꾼다
- `alembic.ini`에는 **ASCII만** (Windows cp949로 읽혀 한글이 있으면 Alembic이 깨짐)

### 테스트
- 새 API마다 정상 1개 + 실패/권한 1개 이상. 규칙 로직(토너먼트·호환성·주문 상태)은 경우별로
- `tests/conftest.py`의 `client` 픽스처(httpx AsyncClient) 사용, 로그인은 `POST /api/auth/dev-login`으로 쿠키 획득
- DB가 필요한 테스트는 `tests/test_products.py`처럼 DB 없으면 skip
- 작업을 "완료"라고 말하기 전에 **`ruff check .`와 `pytest`를 실제로 실행해 통과를 확인**한다

### 설계 원칙 (임의로 바꾸지 말 것 — `docs/backend/ARCHITECTURE.md`)
- 로그인: FastAPI가 구글 OAuth 직접 처리 → `pm_session` httpOnly 쿠키(JWT). NextAuth 사용 안 함
- 픽셀 아바타: 서버는 최종 PNG data URL만 저장(200KB 이하). 사진은 **AI 픽셀 아바타(`POST /api/avatars/ai`)에서 사용자 동의가 있을 때만** 받아 Cloudflare Workers AI로 넘기고 **저장·로그 금지**, `CLOUDFLARE_ACCOUNT_ID`·`CLOUDFLARE_API_TOKEN`은 `.env`에만 (`docs/AVATAR_POLICY.md`)
- PIXEL LOCAL (`docs/PIXEL_LOCAL_POLICY.md`, `docs/DUKRYEOK_MAP_POLICY.md`): **GPS 좌표·주소 저장 금지**(GPS는 프론트에서 지역 찾기에만, 정책 4.1), 지역(시 › 구 › 동·생활권) 직접 선택, 집계는 **사용자 수 기준·5명 미만 숫자 비공개**, 집계 결과에서 **사용자 목록 반환 금지**(예외: `map-avatars`는 동의자 아바타 이미지만, 5명 이상·무작위 6개·id/닉네임 없음 — 정책 4.2), Mock 데이터는 `isSample`, 거래글에 연락처 금지, 거래글 작성자는 **`nicknamePublic` 동의자의 WANT 글에만** 닉네임·아바타 노출(정책 15-1)
- 작품·캐릭터는 텍스트 태그만. 공식 이미지·로고, 실존 브랜드·캐릭터 이름의 **판매 상품** 생성 금지
- 주문은 결제 없는 가상 주문. 리뷰는 배송 완료 상품만
- 토너먼트 규칙(상품 3~7개, DP ≤ 100, 중복 금지, 카테고리 제한, Zone, 투표 제한)은 **서버에서 검사**

### 보안·협업
- `.env`, 구글 키, 비밀번호를 코드·커밋·로그에 넣지 않는다. 새 설정값은 `app/core/config.py` + `.env.example`(빈 값)에 추가
- 공용 파일(`main.py`, `models/__init__.py`, `deps.py`, `core/`)은 최소 수정. 구조 변경이 필요하면 먼저 사람에게 제안
- API 응답 모양(필드 이름·타입)을 바꾸면 PR 본문에 **"FE 영향 있음"**을 명시
- 커밋 메시지: `feat(be-orders): 주문 생성 API` 형식, 한글 OK

## PR 체크리스트 (에이전트가 PR 본문 초안을 쓸 때 포함)
- `Closes #이슈번호`
- 만든 테이블·API 요약
- Swagger 요청·응답 예시 1개 이상 (FE 연동용)
- 실행한 검증: `alembic upgrade head`, `ruff check .`, `pytest` 결과
- `docs/backend/API.md` 상태 칸 ✅ 갱신 여부

## 코드 스타일
- 기존 코드처럼 **짧은 한글 주석**으로 "왜"만 설명. 주석 과다 금지
- 타입 힌트 필수, `Annotated[...]` 의존성 사용, 라우터 함수는 얇게 하고 규칙은 services로
