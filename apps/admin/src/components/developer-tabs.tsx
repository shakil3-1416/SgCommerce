'use client';

import Link from 'next/link';

import {
  usePathname,
} from 'next/navigation';

const TABS = [
  { href: '/developers', label: 'Applications' },
  { href: '/developers/requests', label: 'Requests' },
  { href: '/developers/reference', label: 'API reference' },
];

/** The three parts of the Developers section. An application's own page counts as "Applications". */
export function DeveloperTabs() {
  const path = usePathname() ?? '';

  const current =
    path.startsWith('/developers/requests')
      ? '/developers/requests'
      : path.startsWith('/developers/reference')
        ? '/developers/reference'
        : '/developers';

  return (
    <nav
      aria-label="Developers"
      className="mt-6 flex flex-wrap gap-1 border-b border-[#e8e2ef]"
    >
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={
            tab.href === current
              ? 'page'
              : undefined
          }
          className={`-mb-px border-b-2 px-4 py-3 text-sm font-semibold ${
            tab.href === current
              ? 'border-[#38205f] text-[#1f1235]'
              : 'border-transparent text-[#6f6679] hover:text-[#1f1235]'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
