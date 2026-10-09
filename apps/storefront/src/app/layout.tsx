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
          <Script
            src={widget.scriptUrl}
            data-channel={widget.channel}
            data-api-base={widget.apiBase}
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}
