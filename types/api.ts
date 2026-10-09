import type { Product } from "@/types/product";

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  totalPages: number;
}

export interface ApiProduct extends Product {
  categorySlug: string;
  isNew: boolean;
}

export interface ApiCategory {
  slug: string;
  name: string;
  description: string;
}

export interface ApiUser {
  id: number;
  email: string;
  nickname: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface ApiCartItem {
  product: ApiProduct;
  quantity: number;
  subtotal: number;
  addedAt: string;
}

export interface ApiCart {
  items: ApiCartItem[];
  totalQuantity: number;
  totalPrice: number;
}

export interface ApiWishlistItem {
  product: ApiProduct;
  createdAt: string;
}

export interface ApiFaq {
  id: number;
  category: string;
  question: string;
  answer: string;
}

export interface ApiOrderItem {
  product: ApiProduct;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface ApiOrder {
  id: number;
  status: string;
  totalPrice: number;
  recipientName: string;
  address: string;
  createdAt: string;
  items: ApiOrderItem[];
}

export interface ApiOrderTimelineEntry {
  status: string;
  label: string;
  changedAt: string;
}

export interface ApiOrderDetail extends ApiOrder {
  statusLabel: string;
  timeline: ApiOrderTimelineEntry[];
}

export interface ApiOrderSummary {
  id: number;
  status: string;
  statusLabel: string;
  totalPrice: number;
  createdAt: string;
  title: string;
  imageUrl: string;
  itemCount: number;
}

export interface ApiCancelRequest {
  id: number;
  orderId: number;
  reason: string;
  status: string;
  statusLabel: string;
  createdAt: string;
}

export interface ApiReview {
  id: number;
  productId: number;
  rating: number;
  content: string;
  nickname: string;
  createdAt: string;
  isMine: boolean;
}

export interface ApiReviewPage extends Page<ApiReview> {
  averageRating: number | null;
}

export type RegionLevel = "sido" | "sigungu" | "zone";
export type InterestType = "work" | "character" | "style" | "product_type";
export type FandomPeriod = "30d" | "90d" | "all";

export interface ApiRegion {
  code: string;
  level: RegionLevel;
  parentCode: string | null;
  name: string;
  fullName: string;
}

export interface ApiInterest {
  id: number;
  type: InterestType;
  name: string;
  parentId: number | null;
}

export interface ApiLocalProfile {
  region: ApiRegion | null;
  interests: ApiInterest[];
  fandomOptIn: boolean;
  profilePublic: boolean;
  mapAvatarOptIn: boolean;
  nicknamePublic?: boolean;
}

export interface LocalProfileInput {
  regionCode: string | null;
  interestIds: number[];
  fandomOptIn: boolean;
  profilePublic: boolean;
  mapAvatarOptIn?: boolean;
  nicknamePublic?: boolean;
}

/** 덕력지도 아바타 핀 — 동의한 이웃의 아바타만, 5명 미만은 비공개 (id·닉네임 없음) */
export interface ApiMapAvatars {
  regionCode: string;
  regionName: string;
  count: number | null;
  belowThreshold: boolean;
  avatars: (string | null)[];
}

export interface ApiFandom {
  regionCode: string;
  regionName: string;
  interestId: number;
  interest: string;
  interestType: InterestType;
  count: number | null;
  belowThreshold: boolean;
  isSample: boolean;
}

export interface ApiFandomRank {
  rank: number;
  interestId: number;
  interest: string;
  interestType: InterestType;
  count: number;
  isSample: boolean;
}

export type TradeKind = "have" | "want" | "sell";
export type TradeCondition = "new" | "like_new" | "used";
export type TradeMethod = "direct" | "delivery" | "both";
export type TradeStatus = "open" | "done" | "hidden";
export type TradeProximity = "same_zone" | "same_district";

export interface TradeInput {
  kind: TradeKind;
  itemName: string;
  productId: number | null;
  interestId: number | null;
  condition: TradeCondition | null;
  price: number | null;
  tradeMethod: TradeMethod;
  content: string;
}

export interface ApiTradePost {
  id: number;
  kind: TradeKind;
  status: TradeStatus;
  itemName: string;
  condition: TradeCondition | null;
  price: number | null;
  tradeMethod: TradeMethod;
  content: string;
  product: ApiProduct | null;
  interest: ApiInterest | null;
  regionCode: string;
  regionName: string;
  isMine: boolean;
  isSample: boolean;
  createdAt: string;
  /** 위시맵 닉네임 공개에 동의한 사람의 WANT 글에만 (그 외 null) */
  author?: { nickname: string; avatarUrl: string | null } | null;
}

export interface ApiTradeMatch {
  want: ApiTradePost;
  offer: ApiTradePost;
  proximity: TradeProximity;
  mutual: boolean;
}

/** 위시맵 지역 블록 하나의 진행 중 WANT 글 수 (하위 지역 포함) */
export interface ApiWishWants { regionCode: string; count: number; images: (string | null)[]; sample: boolean; }

export interface ApiWishMapItem { rank: number; product: ApiProduct; count: number; isSample?: boolean; }

/** 동네 선물 — 상대는 항상 "이웃 플레이어" (닉네임·주소 없음) */
export interface ApiGift {
  id: number;
  box: "sent" | "received";
  status: "pending" | "accepted" | "declined";
  statusLabel: string;
  product: ApiProduct;
  quantity: number;
  totalPrice: number;
  message: string;
  counterpart: string;
  orderId: number | null;
  createdAt: string;
}

/** 닉네임 중복 확인 — 겹치면 지금 쓸 수 있는 추천 닉네임 (최대 3개) */
export interface ApiNicknameCheck { nickname: string; available: boolean; suggestions: string[]; }

/** 구글 확인은 끝났고 닉네임만 고르면 되는 가입 대기 상태 */
export interface ApiSignupPending { email: string; googleName: string; }
