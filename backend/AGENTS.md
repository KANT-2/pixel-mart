# PIXEL MART 백엔드 — AI 에이전트 작업 규칙

> 이 파일은 AI 코딩 에이전트(Claude Code, Cursor, Codex 등)가 `backend/`에서 작업할 때 따르는 규칙입니다.
> 사람용 상세 문서는 `docs/backend/` 에 있습니다. 규칙이 충돌하면 이 파일 → `docs/backend/ARCHITECTURE.md` 순으로 따릅니다.

## 프로젝트 맥락
- PIXEL MART: 픽셀아트 게이밍 데스크 소품 쇼핑몰 + 취향 커뮤니티(PIXEL LOCAL). **로컬 개발 전용**(배포 없음), 실제 결제 없음(가상 주문), 로그인은 구글 + 로컬 개발용 이메일 로그인(`dev-login`).
- 프론트: Next.js 16 (저장소 루트). 브라우저는 `localhost:3000`만 보고, `/api/*`는 Next.js rewrites로 FastAPI(`127.0.0.1:8000`)에 전달된다.
- 지금 있는 백엔드 기능: 상품·카테고리·검색, 장바구니·찜, 가상 주문·배송 타임라인·취소, 리뷰, 상품 Q&A, FAQ, 키보드·키캡 호환성, 픽셀 아바타(AI 포함), PIXEL LOCAL(지역·취향·덕력지도·지도 아바타·구매 순위, 거래글·교환 신청·교환 진행, 위시맵·선물), 활동 점수·하트·레벨·뱃지(기록으로 계산, 뱃지 테이블 없음), 알림.
- **범위 밖(만들지 않음)**: 데스크 꾸미기·데스크 출품·토너먼트 — 관련 이슈는 not planned로 닫힘. 옛 정책 문서는 삭제됨(git 기록에만 있음).
- 작업 단위는 GitHub 이슈. 이슈 본문(만들 테이블·API·완료 기준)을 기준으로 삼는다: `gh issue view <번호>`
- 현재 구현 기준 문서: `docs/PIXEL_LOCAL_AS_BUILT.md`, `docs/UI_STRUCTURE.md`, `docs/backend/API.md` · 비전: `docs/PRODUCT_STRATEGY.md`, `docs/UX_CX_STRATEGY.md`

## 기술 스택
Python 3.12+ · FastAPI · SQLAlchemy 2 (async, `Mapped[...]` 스타일) · asyncpg · Alembic · Pydantic v2 · pydantic-settings · PyJWT · Authlib · pytest(+pytest-asyncio, `asyncio_mode=auto`) · ruff

## 명령어 (`backend/` 에서, 가상환경 활성화 상태)
```bash
uvicorn app.main:app --reload --port 8000   # 서버
alembic revision --autogenerate -m "add orders"   # 모델 변경 후 마이그레이션 생성
alembic upgrade head                          # 마이그레이션 적용
python -m scripts.seed                        # 상품·카테고리 시드 (재실행 안전)
python -m scripts.seed_demo                   # (선택) 선물하기·교환 신청 시연용 데모 이웃·WANT·HAVE 글 (재실행 안전)
python -m scripts.seed_showcase 이메일          # (선택, 발표용) 리뷰·문의·주문 + 그 계정에 받은 선물·교환 신청·교환 진행 중 (재실행 안전. 넣은 채로 pytest를 돌리면 리뷰·문의 테스트가 실패하니 테스트 뒤에 넣기)
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
- 내 이슈 범위 밖의 테이블은 만들거나 수정하지 않는다. 필요하면 사용자(사람)에게 "담당자 확인 필요"라고 알린다
- 마이그레이션을 만들기 전에 `git pull` → `alembic heads`가 **한 줄**인지 확인 (여러 사람이 동시에 만들면 head가 갈라진다)
- 기존 마이그레이션 파일은 수정하지 않는다(새 파일 추가). "Multiple head revisions"가 나면 내 파일의 `down_revision`을 최신 head로 바꾼다
- `alembic.ini`에는 **ASCII만** (Windows cp949로 읽혀 한글이 있으면 Alembic이 깨짐)

### 테스트
- 새 API마다 정상 1개 + 실패/권한 1개 이상. 규칙 로직(주문 상태·교환 신청 상태·활동 점수·호환성)은 경우별로
- 전체 테스트는 데모 이웃 데이터를 지운다 → 테스트 뒤 `python -m scripts.seed_demo` 다시 실행
- `tests/conftest.py`의 `client` 픽스처(httpx AsyncClient) 사용, 로그인은 `POST /api/auth/dev-login`으로 쿠키 획득
- DB가 필요한 테스트는 `tests/test_products.py`처럼 DB 없으면 skip
- 작업을 "완료"라고 말하기 전에 **`ruff check .`와 `pytest`를 실제로 실행해 통과를 확인**한다

### 설계 원칙 (임의로 바꾸지 말 것 — `docs/backend/ARCHITECTURE.md`)
- 로그인: FastAPI가 구글 OAuth 직접 처리 → `pm_session` httpOnly 쿠키(JWT). NextAuth 사용 안 함
- 픽셀 아바타: 서버는 최종 PNG data URL만 저장(200KB 이하). 사진은 **AI 픽셀 아바타(`POST /api/avatars/ai`)에서 사용자 동의가 있을 때만** 받아 Cloudflare Workers AI로 넘기고 **저장·로그 금지**, `CLOUDFLARE_ACCOUNT_ID`·`CLOUDFLARE_API_TOKEN`은 `.env`에만 (`docs/AVATAR_POLICY.md`)
- PIXEL LOCAL (`docs/PIXEL_LOCAL_POLICY.md`, `docs/DUKRYEOK_MAP_POLICY.md`): **GPS 좌표·주소 저장 금지**(GPS는 프론트에서 지역 찾기에만, 정책 4.1), 지역(시 › 구 › 동·생활권) 직접 선택, 집계는 **사용자 수 기준**(최소 인원 제한 없음), 집계 결과에서 **사용자 목록 반환 금지**(예외: `map-avatars`는 동의자 아바타 이미지만, 구매 금액 상위 10개·id/닉네임 없음, `buyer-ranking`은 TOP 10·금액 비공개·닉네임은 공개 동의자만 — 정책 4.2), Mock 데이터는 응답에 `isSample`(화면에는 "샘플" 라벨을 표시하지 않음), 거래글에 연락처 금지, 거래글 작성자는 **`nicknamePublic` 동의자의 WANT 글에만** 닉네임·아바타 노출(정책 15-1)
- 작품·캐릭터는 텍스트 태그만. 공식 이미지·로고, 실존 브랜드·캐릭터 이름의 **판매 상품** 생성 금지
- 주문은 결제 없는 가상 주문. 리뷰는 배송 완료 상품만
- 교환·선물·활동 점수 규칙(신청 상태, 하루 상한, 같은 글 1회 적립)은 **서버에서 검사**하고, 알림은 `services/notifications.py`의 `notify()`로 (같은 일은 `ref_key`로 한 번만)

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
