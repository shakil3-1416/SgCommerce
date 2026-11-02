import type {
  Metadata,
} from 'next';

import Script from 'next/script';

import { supgentWidgetConfig } from '@/lib/supgent-widget';

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
  children: React.ReactNode;
}>) {
  const widget = supgentWidgetConfig();

  return (
    <html lang="en">
      <body>
        <CartProvider>
          <SiteHeader />

          {children}
        </CartProvider>

        <SiteFooter />

        {widget ? (
          <script src="http://localhost:3001/supgent-widget.js" data-channel="wc_4Wk1vvgUa24iEckAiSwzAE41cmMYUQGV" data-api-base="http://127.0.0.1:8000" async></script>

        ) : null}
      </body>
    </html>
  );
}
