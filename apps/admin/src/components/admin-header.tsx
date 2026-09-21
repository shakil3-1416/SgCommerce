import Link from 'next/link';

import {
  AdminLogout,
} from './admin-logout';

export function AdminHeader() {
  return (
    <header className="border-b border-[#e8e2ef] bg-white">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-3">
        <Link
          href="/"
          className="font-bold text-[#1f1235]"
        >
          SgCommerce Admin
        </Link>

        <div className="flex flex-wrap items-center gap-5">
          <nav className="flex flex-wrap gap-5 text-sm font-semibold text-[#6f6679]">
            <Link href="/categories">
              Categories
            </Link>

            <Link href="/products">
              Products
            </Link>

            <Link href="/inventory">
              Inventory
            </Link>

            <Link href="/orders">
              Orders
            </Link>

            <Link href="/customers">
              Customers
            </Link>

            <Link href="/returns">
              Returns
            </Link>

            <Link href="/refunds">
              Refunds
            </Link>
          </nav>

          <AdminLogout />
        </div>
      </div>
    </header>
  );
}
