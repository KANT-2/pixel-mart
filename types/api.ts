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
}

export interface ApiReviewPage extends Page<ApiReview> {
  averageRating: number | null;
}
