# API 목록

> 🔒 = 로그인 필요 (`CurrentUser`) · ✅ = 구현됨 · 전체 경로는 `/api` 접두사 포함
> 실제 요청/응답 모양은 http://localhost:3000/api/docs (Swagger)가 기준입니다.

## 공통 · 상품 — BE-A
| 메서드 | 경로 | 설명 | 상태 |
| --- | --- | --- | --- |
| GET | /api/health, /api/health/db | 서버·DB 상태 | ✅ |
| POST | /api/auth/dev-login | [로컬 전용] 이메일로 로그인 | ✅ |
| POST | /api/auth/logout | 로그아웃 (쿠키 삭제) | ✅ |
| GET | /api/auth/me 🔒 | 내 정보 | ✅ |
| GET | /api/auth/google/login | 구글 로그인 시작 | |
| GET | /api/auth/google/callback | 구글 로그인 완료 → 쿠키 설정 → 메인 이동 | |
| PATCH | /api/users/me 🔒 | 닉네임 변경 | |
| PUT | /api/users/me/avatar 🔒 | 픽셀 아바타 저장 (PNG data URL, 최대 50KB) | |
| GET | /api/categories | 카테고리 6개 | ✅ |
| GET | /api/products?category=&q=&minPrice=&maxPrice=&isNew=&sort=&page=&size= | 목록 (category는 쉼표로 여러 개, sort: `id/new/price_asc/price_desc/popular`(찜 많은 순), 응답에 `isWished`) | ✅ |
| GET | /api/products/{id} | 상세 (없으면 404, 응답에 `isWished`) | ✅ |
| GET · POST · PATCH · DELETE | /api/cart, /api/cart/items/{productId} 🔒 | 장바구니 조회·담기(같은 상품은 수량 합산, 최대 99)·수량변경·삭제 — 응답은 모두 장바구니 전체 | ✅ |
| GET · PUT · DELETE | /api/wishlist, /api/wishlist/{productId} 🔒 | 찜 목록(Page, 최근 찜한 순)·찜(이미 있으면 그대로)·해제 | ✅ |

## 주문 · CS · 호환성 — BE-B
| 메서드 | 경로 | 설명 | 상태 |
| --- | --- | --- | --- |
| POST | /api/orders 🔒 | 장바구니로 가상 주문 생성 (결제 없음) → 장바구니 비움 | ✅ |
| GET | /api/orders 🔒 | 내 주문 목록 | ✅ |
| GET | /api/orders/{id} 🔒 | 주문 상세 + 배송 타임라인 | ✅ |
| POST | /api/orders/{id}/cancel-requests 🔒 | 취소 신청 (배송 전만) |  |
| POST | /api/dev/orders/{id}/advance | [로컬 전용] 배송 단계 진행 | ✅ |
| GET | /api/products/{id}/reviews | 리뷰 목록 + 평균 별점 |  |
| POST | /api/products/{id}/reviews 🔒 | 리뷰 작성 (배송 완료 상품만) |  |
| GET | /api/products/{id}/questions | 상품 Q&A (비밀글은 내용 가림) |  |
| POST | /api/products/{id}/questions 🔒 | 문의 작성 |  |
| GET | /api/faqs?category= | FAQ | ✅ |
| GET | /api/keyboards?maker=&q= | 키보드 모델 검색 (Mock) |  |
| GET | /api/compatibility?keyboardId=&productId= | 키캡 호환 결과 (키별 호환/일부/불가) |  |

## 데스크테리어 · 토너먼트 · 뱃지 — BE-C
| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | /api/desk-specs | 상품별 DP·크기·허용 Zone (데스크 꾸미기 화면용) |
| POST | /api/desks/validate | 출품 규칙 검사만 (저장 X) → 위반 항목 목록 |
| GET · POST | /api/desks 🔒 | 내 데스크 목록 · 저장 |
| GET · PUT · DELETE | /api/desks/{id} 🔒 | 데스크 조회·수정·삭제 |
| GET | /api/tournaments | 토너먼트 목록 (진행 상태 포함) |
| POST | /api/tournaments/{id}/entries 🔒 | 출품 (규칙 검사 + 스냅샷) |
| GET | /api/tournaments/{id}/gallery | 예선 갤러리 (작성자 숨김) |
| POST | /api/tournaments/{id}/gallery-votes 🔒 | 예선 투표 (최대 3개) |
| GET | /api/tournaments/{id}/bracket | 대진표 |
| POST | /api/matches/{id}/votes 🔒 | 1:1 투표 |
| POST | /api/dev/tournaments/{id}/advance | [로컬 전용] 다음 단계로 (예선 마감 → 대진 생성 → 라운드 진행) |
| GET | /api/users/me/badges 🔒 | 내 뱃지 |

## PIXEL LOCAL — BE-A (3단계)
| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | /api/regions?parent= | 지역 목록 (시 › 구 › 동·생활권) |
| PUT | /api/users/me/local 🔒 | 내 지역·취향·집계 참여·공개 여부 설정 |
| GET | /api/interests?type=&q= | 취향 태그 검색 (작품·캐릭터·스타일·상품 종류) |
| GET | /api/local/fandom?region=&interest=&period= | 덕력지도 집계 — 5명 미만은 `count: null, belowThreshold: true`, 사용자 목록 없음, `isSample` |
| GET | /api/local/fandom/ranking?region= | 지역 인기 취향 순위 (최소 기준 충족 항목만) |
| GET · POST | /api/local/trades?region=&kind= 🔒(POST) | 거래·HAVE/WANT 글 (Prototype) |
| GET | /api/local/trades/matches 🔒 | 내 WANT ↔ 같은 지역 HAVE 매칭 (Mock 수준) |
| GET | /api/local/wish-map?region= | 지역별 인기 찜 상품 익명 집계 (Prototype) |
