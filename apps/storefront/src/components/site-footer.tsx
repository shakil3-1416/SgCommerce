import Link from 'next/link';

export function SiteFooter() {
  const year =
    new Date().getFullYear();

  return (
    <footer
      className="mt-20 border-t border-[#e8e2ef] bg-[#1f1235] text-white"
    >
      <div className="border-b border-white/10">
        <div className="mx-auto grid max-w-7xl gap-4 px-6 py-6 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
              ✓
            </div>

            <div>
              <p className="font-semibold">
                Cash on delivery
              </p>

              <p className="text-sm text-white/60">
                Simple payment at delivery
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
              ◎
            </div>

            <div>
              <p className="font-semibold">
                Order visibility
              </p>

              <p className="text-sm text-white/60">
                Follow purchases from your account
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
              ↺
            </div>

            <div>
              <p className="font-semibold">
                Easy returns
              </p>

              <p className="text-sm text-white/60">
                Start returns from delivered orders
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight"
          >
            SgCommerce
          </Link>

          <p className="mt-4 max-w-sm text-sm leading-7 text-white/65">
            A straightforward shopping experience built around clear products,
            simple checkout, visible orders and easy post-purchase support.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-white/80">
            Shop
          </h2>

          <nav
            aria-label="Footer shopping"
            className="mt-4 flex flex-col gap-3 text-sm text-white/65"
          >
            <Link
              href="/products"
              className="transition hover:text-white"
            >
              All products
            </Link>

            <Link
              href="/cart"
              className="transition hover:text-white"
            >
              Cart
            </Link>
          </nav>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-white/80">
            Customer care
          </h2>

          <nav
            aria-label="Footer customer care"
            className="mt-4 flex flex-col gap-3 text-sm text-white/65"
          >
            <Link
              href="/orders"
              className="transition hover:text-white"
            >
              My orders
            </Link>

            <Link
              href="/returns"
              className="transition hover:text-white"
            >
              Returns
            </Link>

            <Link
              href="/account"
              className="transition hover:text-white"
            >
              My account
            </Link>
          </nav>
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-white/80">
            Account
          </h2>

          <nav
            aria-label="Footer account"
            className="mt-4 flex flex-col gap-3 text-sm text-white/65"
          >
            <Link
              href="/login"
              className="transition hover:text-white"
            >
              Sign in
            </Link>

            <Link
              href="/register"
              className="transition hover:text-white"
            >
              Create account
            </Link>

            <Link
              href="/checkout"
              className="transition hover:text-white"
            >
              Checkout
            </Link>
          </nav>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-5 text-xs text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} SgCommerce. All rights reserved.
          </p>

          <p>
            Secure shopping · COD · Customer account support
          </p>
        </div>
      </div>
    </footer>
  );
}
