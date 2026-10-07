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
          id="supgent-webchat"
          src="https://futures-expressed-peas-boring.trycloudflare.com/supgent-widget.js"
          data-channel="wc__iGus1YrbiKJZCNmr6_PFFjlTZ2ogHCR"
          data-api-base="https://attempting-observer-keeps-screenshot.trycloudflare.com"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
