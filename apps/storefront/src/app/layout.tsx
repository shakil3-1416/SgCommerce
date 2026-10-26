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
          <script src="https://design-after-lions-longitude.trycloudflare.com/supgent-widget.js" data-channel="wc_6qX5tXuLYX8P4Ta5YvNMrUpzHAOBZ3jl" data-api-base="https://converter-approved-gain-written.trycloudflare.com" async></script>
        ) : null}
      </body>
    </html>
  );
}
