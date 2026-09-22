import Link from 'next/link';

import {
  CartCount,
} from './cart-count';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#e8e2ef] bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-3">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-[#1f1235]"
        >
          SgCommerce
        </Link>

        <nav className="flex flex-wrap items-center gap-5 text-sm font-semibold">
          <Link href="/products">
            Shop
          </Link>

          <Link href="/orders">
            Orders
          </Link>

          <Link href="/returns">
            Returns
          </Link>

          <Link href="/account">
            Account
          </Link>

          <Link
            href="/cart"
            className="flex items-center"
          >
            Cart
            <CartCount />
          </Link>
        </nav>
      </div>
    </header>
  );
}
