import type {
  ReactNode,
} from 'react';

import {
  DeveloperTabs,
} from '@/components/developer-tabs';

export default function DevelopersLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#4c2a7d]">
        Platform
      </p>

      <h1 className="mt-2 text-4xl font-bold text-[#1f1235]">
        Developers
      </h1>

      <p className="mt-3 max-w-3xl text-[#6f6679]">
        Connect other systems to your shop: an ERP, a courier
        service, an accounting tool. Each system is an application
        with its own key and only the permissions you choose.
        Never give a system your admin password.
      </p>

      <DeveloperTabs />

      {children}
    </main>
  );
}
