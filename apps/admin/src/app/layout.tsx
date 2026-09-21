import type {
  Metadata,
} from 'next';

import './globals.css';

import {
  AdminHeader,
} from '@/components/admin-header';

export const metadata: Metadata = {
  title: 'SgCommerce Admin',
};

export default function RootLayout({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AdminHeader />
        {children}
      </body>
    </html>
  );
}
