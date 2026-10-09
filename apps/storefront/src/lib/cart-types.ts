export interface CartItem {
  sku: string;
  productId: string;
  /** Public business id (SGP-...). Older saved carts may not have it. */
  productCode?: string;
  productSlug: string;
  productName: string;
  variantTitle: string;
  price: number;
  quantity: number;
  available: number;
  image?: string;
}
