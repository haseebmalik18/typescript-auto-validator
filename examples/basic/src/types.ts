export interface User {
  id: number;
  username: string;
  email: string;
  profile: UserProfile;
  preferences: UserPreferences;
  roles: UserRole[];
  createdAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  avatar?: string;
  bio?: string;
  location: {
    country: string;
    city: string;
    timezone: string;
  };
  socialLinks: {
    twitter?: string;
    github?: string;
    linkedin?: string;
  };
}

export interface UserPreferences {
  theme: "light" | "dark" | "auto";
  language: "en" | "es" | "fr" | "de" | "ja";
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  privacy: {
    profileVisibility: "public" | "friends" | "private";
    showEmail: boolean;
    showLocation: boolean;
  };
}

export type UserRole = "admin" | "moderator" | "user" | "guest";

/**
 * E-commerce types
 */
export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: {
    amount: number;
    currency: "USD" | "EUR" | "GBP" | "JPY";
  };
  category: ProductCategory;
  tags: string[];
  inventory: {
    quantity: number;
    reserved: number;
    available: number;
  };
  attributes: ProductAttribute[];
  images: ProductImage[];
  status: "draft" | "active" | "discontinued";
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
  level: number;
}

export interface ProductAttribute {
  name: string;
  value: string | number | boolean;
  type: "text" | "number" | "boolean" | "select";
  required: boolean;
}

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  isPrimary: boolean;
  sortOrder: number;
}

/**
 * API Response types
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: ApiError[];
  meta?: {
    pagination?: PaginationMeta;
    filters?: Record<string, unknown>;
    sort?: SortMeta;
  };
}

export interface ApiError {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface SortMeta {
  field: string;
  order: "asc" | "desc";
}

/**
 * Form validation types
 */
export interface ContactForm {
  name: string;
  email: string;
  subject: string;
  message: string;
  priority: "low" | "medium" | "high";
  attachments?: File[];
  newsletter: boolean;
  terms: boolean;
}

export interface File {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}
