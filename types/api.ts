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
