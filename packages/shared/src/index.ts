export type Currency = 'BDT';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'refunded';

export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'paid'
  | 'failed'
  | 'partially_refunded'
  | 'refunded';

export type PaymentMethod =
  | 'cod'
  | 'card'
  | 'bkash'
  | 'nagad'
  | 'rocket';

export interface Money {
  amount: number;
  currency: Currency;
}

export interface ProductVariant {
  id: string;
  sku: string;
  title: string;
  stock: number;
  price: Money;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  images: string[];
  variants: ProductVariant[];
  active: boolean;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface OrderItem {
  productId: string;
  variantId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: Money;
}

export interface Order {
  id: string;
  orderNumber: string;
  customer: Customer;
  items: OrderItem[];
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  total: Money;
  createdAt: string;
}
