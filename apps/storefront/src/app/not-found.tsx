import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-32 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-[#38205f]">
        404
      </p>

      <h1 className="mt-3 text-4xl font-bold">
        Product not found
      </h1>

      <p className="mt-4 text-zinc-600">
        This product does not exist or is no longer available.
      </p>

      <Link
        href="/products"
        className="mt-8 inline-flex rounded-xl bg-[#1f1235] px-6 py-3 font-semibold text-white"
      >
        Browse products
      </Link>
    </main>
  );
}
