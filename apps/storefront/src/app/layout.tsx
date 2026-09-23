import type {
  Metadata,
} from 'next';

import './globals.css';

import {
  CartProvider,
} from '@/components/cart-provider';

import {
  SiteHeader,
} from '@/components/site-header';

import {
  SiteFooter,
} from '@/components/site-footer';

export const metadata: Metadata = {
  title: {
    default: 'SgCommerce',
    template: '%s | SgCommerce',
  },

  description:
    'Modern ecommerce shopping with SgCommerce.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children:
    React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <SiteHeader />

          {children}
        </CartProvider>
              <SiteFooter />
</body>
    </html>
  );
}
