# PIXEL MART 백엔드 가이드

> 2차 프로젝트: Next.js 프론트 + **FastAPI 백엔드 + PostgreSQL**. 로컬 개발만 합니다(배포 없음).

| 문서 | 내용 |
| --- | --- |
| **README.md** (지금 문서) | 실행 방법, 폴더 구조, 개발 규칙 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 전체 구조, 로그인 방식, 기능별 설계 결정 |
| [SCHEMA.md](SCHEMA.md) | DB 테이블 설계 (전체 기능) |
| [API.md](API.md) | API 목록과 담당자 |
| [ROADMAP.md](ROADMAP.md) | 담당 트랙(BE-A/B/C), 마일스톤, 작업 순서 |

---

## 1. 처음 한 번: 환경 준비

### 1-1. 필요한 것
- Python **3.12 이상** (`python --version`)
- PostgreSQL — 둘 중 하나
  - **설치형 PostgreSQL** (pgAdmin 포함) → 포트 5432
  - **Docker Desktop** → 저장소 루트에서 `docker compose up -d` → 포트 5433

### 1-2. DB 계정 만들기 (설치형만)
pgAdmin의 Query Tool(또는 psql)에서 `postgres` 계정으로 [backend/scripts/create_local_db.sql](../../backend/scripts/create_local_db.sql) 실행:
```sql
CREATE ROLE pixelmart LOGIN PASSWORD 'pixelmart';
CREATE DATABASE pixelmart OWNER pixelmart;
CREATE DATABASE pixelmart_test OWNER pixelmart;
```
> 비밀번호 `pixelmart`는 **내 PC에서만 쓰는 로컬 개발용**입니다.

### 1-3. 가상환경 · 패키지 · 설정
```bash
cd backend
python -m venv .venv
```
- Windows: `.venv\Scripts\activate` / macOS: `source .venv/bin/activate`
```bash
pip install -r requirements-dev.txt
```
```bash
copy .env.example .env        # macOS: cp .env.example .env
```
Docker를 쓰면 `.env`의 `DATABASE_URL` 포트를 `5433`으로 바꿉니다.

### 1-4. 테이블 만들기 + 상품 180개 넣기
```bash
alembic upgrade head
python -m scripts.seed
```

---

## 2. 매일 실행
터미널 2개를 띄웁니다.

| 터미널 | 위치 | 명령 | 주소 |
| --- | --- | --- | --- |
| 백엔드 | `backend/` (가상환경 켠 상태) | `uvicorn app.main:app --reload --port 8000` | http://localhost:8000/api/docs |
| 프론트 | 저장소 루트 | `npm run dev` | http://localhost:3000 |

- 프론트에서는 **`/api/...`로만 호출**합니다. Next.js가 8000번으로 넘겨줍니다 (`next.config.ts`의 rewrites).
- API 문서(Swagger)는 **http://localhost:3000/api/docs** 에서도 열립니다. 여기서 바로 요청을 보내 볼 수 있습니다.
- 로그인이 필요한 API 테스트: Swagger에서 `POST /api/auth/dev-login` 실행 → 쿠키가 저장되어 이후 요청이 로그인 상태가 됩니다.

### 구글 로그인 써 보기 (선택)
1. 팀 채널에서 받은 구글 키를 `backend/.env`의 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`에 넣고 백엔드를 재시작합니다. (키가 없으면 `/api/auth/google/login`이 503)
2. 브라우저에서 **http://localhost:3000/api/auth/google/login** 으로 이동 → 구글 로그인 → 메인으로 돌아오면 로그인 상태 (`/api/auth/me`로 확인)
- 구글 콘솔(OAuth 클라이언트 · 웹 애플리케이션)의 승인된 리디렉션 URI: `http://localhost:3000/api/auth/google/callback`
- 실패하면 쿠키 없이 `http://localhost:3000/?loginError=google`로 돌아옵니다.
- 같은 이메일로 dev-login 한 계정이 있으면 그 계정에 구글 계정이 연결됩니다.

---

## 3. 폴더 구조
```
backend/
├─ app/
│  ├─ main.py            # FastAPI 앱, 라우터 등록
│  ├─ deps.py            # DbSession, CurrentUser, OptionalUser
│  ├─ core/              # config(.env) · db(엔진·Base) · security(JWT 쿠키)
│  ├─ models/            # SQLAlchemy 테이블 (새 모델은 models/__init__.py에 등록)
│  ├─ schemas/           # 요청/응답 모양 (Pydantic, camelCase JSON)
│  ├─ services/          # (필요할 때) 여러 라우터가 쓰는 비즈니스 로직 — 토너먼트 규칙 등
│  └─ routers/           # 기능별 API (products.py, auth.py ...)
├─ alembic/versions/     # DB 변경 이력 (마이그레이션)
├─ scripts/              # seed.py, export_seed.mjs, create_local_db.sql
├─ seed/                 # 시드 JSON (상품·카테고리 원본은 프론트 data/*.ts)
└─ tests/                # pytest
```

---

## 4. 개발 규칙 (꼭 지키기)

### API
- 모든 경로는 `/api`로 시작, **복수형 명사** (`/api/products`, `/api/orders/{id}`)
- JSON은 **camelCase** (`imageUrl`, `isNew`) — 스키마는 `CamelModel`을 상속하면 자동 변환
- 목록 응답은 `Page[T]` (`items, total, page, size, totalPages`)
- 에러는 `HTTPException(상태코드, "한글 메시지")` — 프론트가 그대로 보여 줄 수 있게
- 로그인 필요: 함수 인자에 `user: CurrentUser` / 선택: `user: OptionalUser`

### DB · 마이그레이션
1. `app/models/`에 모델 추가 → `app/models/__init__.py`에 import
2. `alembic revision --autogenerate -m "add orders"` → **생성된 파일을 꼭 열어서 확인**
3. `alembic upgrade head`
- ⚠️ 마이그레이션 충돌 예방: **작업 시작 전 `git pull` → `alembic upgrade head`**, PR 머지 직후 다른 사람에게 알리기
- 두 명이 동시에 만들어 "Multiple head revisions" 에러가 나면: 나중에 머지하는 사람이 자기 파일의 `down_revision`을 최신 것으로 고치기

### 코드 품질 (PR 올리기 전)
```bash
ruff check . && ruff format .
pytest
```
- 새 API에는 **테스트 최소 1개** (정상 1 + 실패 1 권장)
- 비밀값(`.env`, 구글 키)은 **절대 커밋 금지** — `.env.example`에 빈 값으로만

### 브랜치 · PR
- `feat/be-orders`, `feat/be-auth-google`처럼 **`feat/be-` 접두사**
- PR 본문에 **"Swagger에서 이렇게 테스트했어요"** 캡처나 요청/응답 예시 1개
- 리뷰는 다른 BE 팀원 1명
