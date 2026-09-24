export interface CartItem {
  sku: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantTitle: string;
  price: number;
  quantity: number;
  available: number;
  image?: string;
}
