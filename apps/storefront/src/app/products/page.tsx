import type {
  Metadata,
} from 'next';

import Link from 'next/link';

import {
  ProductCard,
} from '@/components/product-card';

import {
  getCategories,
  getProducts,
} from '@/lib/api';

import type {
  ProductSort,
} from '@/lib/api';

import type {
  Category,
  Product,
} from '@/lib/types';

export const metadata:
  Metadata = {
    title:
      'Products',
  };

type SearchParams =
  Promise<{
    q?: string;
    category?: string;
    brand?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
    page?: string;
  }>;

const SORTS:
  ProductSort[] = [
    'newest',
    'price_asc',
    'price_desc',
    'name_asc',
  ];

function validSort(
  value?: string,
): ProductSort {
  return SORTS.includes(
    value as ProductSort,
  )
    ? (
        value as ProductSort
      )
    : 'newest';
}

function clean(
  value?: string,
) {
  return (
    value?.trim() ??
    ''
  );
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams:
    SearchParams;
}) {
  const params =
    await searchParams;

  const q =
    clean(
      params.q,
    );

  const category =
    clean(
      params.category,
    );

  const brand =
    clean(
      params.brand,
    );

  const minPrice =
    clean(
      params.minPrice,
    );

  const maxPrice =
    clean(
      params.maxPrice,
    );

  const sort =
    validSort(
      params.sort,
    );

  const parsedPage =
    Number.parseInt(
      params.page ??
        '1',
      10,
    );

  const page =
    Number.isFinite(
      parsedPage,
    ) &&
    parsedPage > 0
      ? parsedPage
      : 1;

  let products:
    Product[] = [];

  let categories:
    Category[] = [];

  let total = 0;
  let pages = 0;
  let currentPage =
    page;

  let error =
    false;

  try {
    const [
      productResult,
      categoryResult,
    ] =
      await Promise.all([
        getProducts({
          q:
            q ||
            undefined,
          category:
            category ||
            undefined,
          brand:
            brand ||
            undefined,
          minPrice:
            minPrice ||
            undefined,
          maxPrice:
            maxPrice ||
            undefined,
          sort,
          page,
          limit: 24,
        }),

        getCategories(),
      ]);

    products =
      productResult.items;

    total =
      productResult
        .pagination
        .total;

    pages =
      productResult
        .pagination
        .pages;

    currentPage =
      productResult
        .pagination
        .page;

    categories =
      categoryResult
        .filter(
          (item) =>
            item.active,
        )
        .sort(
          (
            left,
            right,
          ) =>
            left.name
              .localeCompare(
                right.name,
              ),
        );
  } catch {
    error =
      true;
  }

  const hasFilters =
    Boolean(
      q ||
      category ||
      brand ||
      minPrice ||
      maxPrice ||
      sort !==
        'newest',
    );

  function pageHref(
    targetPage:
      number,
  ) {
    const next =
      new URLSearchParams();

    if (q) {
      next.set(
        'q',
        q,
      );
    }

    if (
      category
    ) {
      next.set(
        'category',
        category,
      );
    }

    if (brand) {
      next.set(
        'brand',
        brand,
      );
    }

    if (
      minPrice
    ) {
      next.set(
        'minPrice',
        minPrice,
      );
    }

    if (
      maxPrice
    ) {
      next.set(
        'maxPrice',
        maxPrice,
      );
    }

    if (
      sort !==
      'newest'
    ) {
      next.set(
        'sort',
        sort,
      );
    }

    next.set(
      'page',
      String(
        targetPage,
      ),
    );

    return (
      `/products?${next.toString()}`
    );
  }

  const windowSize =
    7;

  const firstPage =
    pages <=
    windowSize
      ? 1
      : Math.max(
          1,
          Math.min(
            currentPage -
              3,
            pages -
              windowSize +
              1,
          ),
        );

  const lastPage =
    Math.min(
      pages,
      firstPage +
        windowSize -
        1,
    );

  const visiblePages =
    pages > 0
      ? Array.from(
          {
            length:
              lastPage -
              firstPage +
              1,
          },
          (
            _,
            index,
          ) =>
            firstPage +
            index,
        )
      : [];

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-[#38205f]">
          SgCommerce Store
        </p>

        <h1 className="mt-2 text-4xl font-bold tracking-tight text-[#1f1235]">
          Products
        </h1>

        <p className="mt-3 text-[#6f6679]">
          Browse products,
          compare variants and
          find what you need.
        </p>
      </div>

      <form
        action="/products"
        method="get"
        className="mt-9 rounded-2xl border border-[#e8e2ef] bg-white p-5"
      >
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <label
              htmlFor="catalog-search"
              className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6f6679]"
            >
              Search
            </label>

            <input
              id="catalog-search"
              type="search"
              name="q"
              defaultValue={
                q
              }
              placeholder="Search products, brands or SKU"
              className="w-full rounded-xl border border-[#e8e2ef] bg-white px-4 py-3 outline-none focus:border-[#38205f]"
            />
          </div>

          <div className="lg:col-span-3">
            <label
              htmlFor="catalog-category"
              className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6f6679]"
            >
              Category
            </label>

            <select
              id="catalog-category"
              name="category"
              defaultValue={
                category
              }
              className="w-full rounded-xl border border-[#e8e2ef] bg-white px-4 py-3"
            >
              <option value="">
                All categories
              </option>

              {categories.map(
                (
                  item,
                ) => (
                  <option
                    key={
                      item._id
                    }
                    value={
                      item.slug
                    }
                  >
                    {
                      item.name
                    }
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="catalog-brand"
              className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6f6679]"
            >
              Brand
            </label>

            <input
              id="catalog-brand"
              name="brand"
              defaultValue={
                brand
              }
              placeholder="Any brand"
              className="w-full rounded-xl border border-[#e8e2ef] bg-white px-4 py-3"
            />
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="catalog-sort"
              className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6f6679]"
            >
              Sort
            </label>

            <select
              id="catalog-sort"
              name="sort"
              defaultValue={
                sort
              }
              className="w-full rounded-xl border border-[#e8e2ef] bg-white px-4 py-3"
            >
              <option value="newest">
                Newest
              </option>

              <option value="price_asc">
                Price: low to high
              </option>

              <option value="price_desc">
                Price: high to low
              </option>

              <option value="name_asc">
                Name
              </option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end">
          <div>
            <label
              htmlFor="catalog-min-price"
              className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6f6679]"
            >
              Minimum BDT
            </label>

            <input
              id="catalog-min-price"
              name="minPrice"
              type="number"
              min="0"
              step="10"
              defaultValue={
                minPrice
              }
              className="w-full rounded-xl border border-[#e8e2ef] px-4 py-3 md:w-40"
            />
          </div>

          <div>
            <label
              htmlFor="catalog-max-price"
              className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6f6679]"
            >
              Maximum BDT
            </label>

            <input
              id="catalog-max-price"
              name="maxPrice"
              type="number"
              min="0"
              step="10"
              defaultValue={
                maxPrice
              }
              className="w-full rounded-xl border border-[#e8e2ef] px-4 py-3 md:w-40"
            />
          </div>

          <button
            type="submit"
            className="rounded-xl bg-[#1f1235] px-7 py-3 font-semibold text-white hover:bg-[#38205f]"
          >
            Apply filters
          </button>

          {hasFilters && (
            <Link
              href="/products"
              className="rounded-xl border border-[#e8e2ef] px-6 py-3 text-center font-semibold text-[#38205f]"
            >
              Clear
            </Link>
          )}
        </div>
      </form>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#6f6679]">
          {error
            ? 'Unable to load products.'
            : `${total.toLocaleString(
                'en-BD',
              )} product${
                total === 1
                  ? ''
                  : 's'
              }`}
        </p>

        {!error &&
          pages >
            0 && (
            <p className="text-sm font-medium text-[#6f6679]">
              Page{' '}
              {
                currentPage
              }{' '}
              of {pages}
            </p>
          )}
      </div>

      {!error &&
        products.length >
          0 && (
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 xl:grid-cols-4">
            {products.map(
              (
                product,
              ) => (
                <ProductCard
                  key={
                    product._id
                  }
                  product={
                    product
                  }
                />
              ),
            )}
          </div>
        )}

      {!error &&
        products.length ===
          0 && (
          <div className="mt-10 rounded-2xl border border-dashed border-[#d7cce2] bg-white p-12 text-center">
            <h2 className="text-lg font-semibold text-[#1f1235]">
              No products found
            </h2>

            <p className="mt-2 text-sm text-[#6f6679]">
              Try changing your
              search or filters.
            </p>
          </div>
        )}

      {error && (
        <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
          The product API could
          not be reached.
        </div>
      )}

      {!error &&
        pages >
          1 && (
          <nav
            aria-label="Product pagination"
            className="mt-12 flex flex-wrap items-center justify-center gap-2"
          >
            {currentPage >
              1 && (
              <Link
                href={pageHref(
                  currentPage -
                    1,
                )}
                className="rounded-xl border border-[#e8e2ef] bg-white px-4 py-2 font-semibold text-[#38205f]"
              >
                Previous
              </Link>
            )}

            {visiblePages.map(
              (
                pageNumber,
              ) => (
                <Link
                  key={
                    pageNumber
                  }
                  href={pageHref(
                    pageNumber,
                  )}
                  aria-current={
                    pageNumber ===
                    currentPage
                      ? 'page'
                      : undefined
                  }
                  className={`rounded-xl px-4 py-2 font-semibold ${
                    pageNumber ===
                    currentPage
                      ? 'bg-[#1f1235] text-white'
                      : 'border border-[#e8e2ef] bg-white text-[#38205f]'
                  }`}
                >
                  {
                    pageNumber
                  }
                </Link>
              ),
            )}

            {currentPage <
              pages && (
              <Link
                href={pageHref(
                  currentPage +
                    1,
                )}
                className="rounded-xl border border-[#e8e2ef] bg-white px-4 py-2 font-semibold text-[#38205f]"
              >
                Next
              </Link>
            )}
          </nav>
        )}
    </main>
  );
}
