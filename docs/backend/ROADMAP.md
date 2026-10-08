# 백엔드 로드맵 · 역할 분담

## 담당 트랙 (3명)
| 트랙 | 담당 | 범위 | 핵심 산출물 |
| --- | --- | --- | --- |
| **BE-A 플랫폼·커머스** | @skshdwkdvkfl55-art | 구글 로그인, 사용자·아바타, 상품 API 확장, 장바구니, 찜 → (3단계) PIXEL LOCAL | `routers/auth.py`, `users.py`, `cart.py`, `wishlist.py`, `local.py` |
| **BE-B 주문·CS** | @totoriri605-oss | 가상 주문·배송 조회, 취소 신청, 리뷰, 상품 Q&A, FAQ, 키캡 호환성 | `routers/orders.py`, `reviews.py`, `questions.py`, `faqs.py`, `compatibility.py` |
| **BE-C 커뮤니티·게임** | @kyrdufmal-summer | 데스크 사양 시드, 데스크 저장·규칙 검사, 토너먼트(예선·대진·투표), 뱃지 | `routers/desks.py`, `tournaments.py`, `badges.py`, `services/desk_rules.py`, `services/bracket.py` |
| **FE 프론트** | 채희주 | 모든 화면 · API 연동 · 로그인 UI · 픽셀 아바타 변환(Canvas) · 데스크 꾸미기·키캡 미리착샷 화면 | `lib/api.ts`, 각 페이지·컴포넌트 |

> 프론트는 1명이 모든 화면을 맡으므로, **각 BE 트랙은 API가 완성될 때마다 Swagger 예시(요청·응답)를 PR에 남겨** 프론트가 바로 연결할 수 있게 해 주세요.
> API 모양(필드 이름 등)을 바꿀 때는 **먼저 FE 담당자에게 알리기**.
>
> 각 트랙은 **자기 라우터·모델·마이그레이션 파일만** 만듭니다. 공용 파일(`main.py`의 라우터 등록, `models/__init__.py`)은 한 줄 추가만 하고, 충돌 나면 둘 다 살리면 됩니다.

## 작업 목록 (GitHub 이슈)
- 전체: [이슈 목록](https://github.com/KANT-2/pixel-mart/issues) · 마일스톤 M0~M4 · 라벨 `BE-A` `BE-B` `BE-C`
- **모두 먼저**: #11 환경 세팅 + 기반 PR 리뷰
- BE-A: #12 ~ #19 · BE-B: #20 ~ #26 · BE-C: #27 ~ #34
- PR 본문에 `Closes #번호`를 쓰면 머지될 때 이슈가 자동으로 닫힙니다.

## 지금 바로 시작할 수 있는 이유
- ✅ 상품 180개가 DB에 있고 `/api/products`가 동작 → 장바구니·주문·데스크가 상품을 참조 가능
- ✅ `dev-login`이 있어 **구글 로그인을 기다리지 않고** 모든 🔒 API 개발 가능
- 그래서 3명이 **첫날부터 병렬로** 진행합니다.

---

## 마일스톤

### M0. 기반 (완료)
- [x] FastAPI 구조, 설정, DB 연결, Alembic, 시드, 테스트, Next.js 프록시
- [x] `/api/products`, `/api/categories`, `dev-login`, `/me`

### M1. 핵심 커머스 (병렬 시작)
| BE-A | BE-B | BE-C |
| --- | --- | --- |
| 장바구니 API + 테스트 | `faqs` 시드 + API (가장 쉬움, 몸풀기) | `product_desk_specs` 시드 (180개 상품 → DP·크기·Zone 매핑) |
| 찜 API + 테스트 | 가상 주문 생성 (장바구니 → 주문) | `POST /desks/validate` 규칙 검사 + **규칙별 테스트** |
| 구글 로그인 (콘솔 설정 → login/callback) | 주문 목록·상세·타임라인 | 데스크 저장 CRUD |
| `PUT /users/me/avatar` | 배송 단계 진행 (dev advance) | 뱃지 테이블 + `NEW_PLAYER` 지급 |

### M2. CS · 게임 완성
| BE-A | BE-B | BE-C |
| --- | --- | --- |
| 상품 API 확장 (정렬·필터 추가, 찜 여부 표시) | 취소 신청 | 토너먼트 생성·출품 |
| 닉네임 변경 | 리뷰 (배송 완료 검증) | 예선 Gallery 투표 (3표 제한) |
| | 상품 Q&A (비밀글) | 대진 생성 + 1:1 투표 + 동점 처리 |
| | 키보드 Mock 데이터 + 호환성 API | 결과 → 뱃지 지급 (BOSS CLEAR 등) |

### M3. PIXEL LOCAL
| BE-A | BE-B | BE-C |
| --- | --- | --- |
| 지역·관심사 시드, 내 동네 설정 | (여유 시) 지역 거래 HAVE/WANT 지원 | (여유 시) 지역 토너먼트 필터 |
| 덕력지도 집계 (3명 미만 숨김) | | |
| 거래글 + 매칭, Wish Map | | |

### M4. 연동 · 마무리
- 프론트 화면 연동 확인, 시나리오 테스트 (로그인 → 담기 → 주문 → 배송 완료 → 리뷰 → 데스크 출품 → 투표)
- README에 백엔드 실행 방법·API 캡처 추가

---

## 작업 완료 기준 (Definition of Done)
- [ ] 모델 + 마이그레이션 (`alembic upgrade head`가 깨끗한 DB에서 성공)
- [ ] 라우터 + 스키마 (camelCase 응답), 에러 메시지 한글
- [ ] 테스트: 정상 1개 + 실패/권한 1개 이상, `pytest` 전체 통과
- [ ] `ruff check .` 통과
- [ ] Swagger에서 직접 호출해 본 예시를 PR에 첨부
- [ ] [API.md](API.md)의 상태 칸 ✅로 갱신

## 막히면
- 설계가 애매하면 [ARCHITECTURE.md](ARCHITECTURE.md) → 그래도 애매하면 팀 채널에 질문
- 다른 트랙 테이블이 필요하면 직접 만들지 말고 **담당자에게 요청** (중복 테이블 방지)
