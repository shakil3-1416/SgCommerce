export interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  active: boolean;
}

export interface ProductVariant {
  sku: string;
  title: string;
  attributes: Record<string, string>;
  price: number;
  compareAtPrice?: number;
  active: boolean;
}

export interface Product {
  _id: string;
  name: string;
  slug: string;
  description: string;
  category: Category | string;
  brand: string;
  images: string[];
  variants: ProductVariant[];
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductListResponse {
  items: Product[];

  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface Inventory {
  _id: string;
  sku: string;
  productId: string;
  productName: string;
  variantTitle: string;
  onHand: number;
  reserved: number;
  reorderLevel: number;
  available: number;
  lowStock: boolean;
}
