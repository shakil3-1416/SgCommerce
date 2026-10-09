import type {
  Metadata,
} from 'next';

import Script from 'next/script';

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
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <SiteHeader />

          {children}
        </CartProvider>

        <SiteFooter />

        <Script
          src="https://moms-dating-eyes-rounds.trycloudflare.com/supgent-widget.js"
          data-channel="wc_6qX5tXuLYX8P4Ta5YvNMrUpzHAOBZ3jl"
          data-api-base="https://scout-dining-poison-open.trycloudflare.com"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
