'use client';

import {
  FormEvent,
  useEffect,
  useState,
} from 'react';

import {
  ProductImageUploader,
} from '@/components/product-image-uploader';

import {
  confirmAction,
} from '@/lib/confirm-action';


interface Category {
  _id: string;
  name: string;
  slug: string;
}

interface Variant {
  sku: string;
  title: string;
  price: number;
  active: boolean;

  attributes: {
    color?: string;
    size?: string;
  };
}

interface Product {
  _id: string;
  productCode?: string;
  name: string;
  slug: string;
  description: string;
  brand: string;
  active: boolean;
  images: string[];
  category:
    | Category
    | string;
  variants: Variant[];
}

interface VariantForm {
  sku: string;
  title: string;
  price: string;
  color: string;
  size: string;

  /*
   * true for a variant loaded from a saved product. Its SKU is shown
   * but cannot be edited, because the stock record and past orders
   * are stored under that SKU.
   */
  saved: boolean;

  /*
   * Stock on hand for a saved variant. 'loading' while it is being
   * fetched; 'none' when the SKU has no stock record yet, which is
   * the case for new variants and for products created before stock
   * could be set from this form.
   */
  stock:
    | number
    | 'loading'
    | 'none';

  /* Typed opening stock. Only used while `stock` is 'none'. */
  openingStock: string;
}

type VariantTextField =
  | 'sku'
  | 'title'
  | 'price'
  | 'color'
  | 'size'
  | 'openingStock';

const emptyVariant =
  (): VariantForm => ({
    sku: '',
    title: '',
    price: '',
    color: '',
    size: '',
    saved: false,
    stock: 'none',
    openingStock: '',
  });

const jsonHeaders = {
  'Content-Type':
    'application/json',
};

/* '' -> 0, '12' -> 12, anything else -> NaN */
function parseOpeningStock(
  value: string,
): number {
  const text = value.trim();

  if (text === '') {
    return 0;
  }

  return /^\d{1,7}$/.test(text)
    ? Number(text)
    : Number.NaN;
}

/*
 * Creates the stock record for a SKU that has none and adds the
 * opening quantity through a stock adjustment, so the stock ledger
 * shows where the first units came from. Returns a sentence for the
 * admin when something needs their attention, otherwise null.
 */
async function saveOpeningStock(
  sku: string,
  quantity: number,
  reference: string,
): Promise<string | null> {
  const path =
    `/api/backend/inventory/${encodeURIComponent(sku)}`;

  const retry =
    `Stock for ${sku} was not saved. Edit the product and save again to retry.`;

  try {
    const check =
      await fetch(path, {
        cache: 'no-store',
      });

    if (check.ok) {
      /*
       * The SKU already has a stock record (for example a SKU that
       * was typed in and has been used before). It is left alone.
       */
      return quantity > 0
        ? `${sku} already has a stock record, so its opening stock was not applied. Change it on the Inventory page.`
        : null;
    }

    if (check.status !== 404) {
      return retry;
    }

    const created =
      await fetch(path, {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify({
          onHand: 0,
        }),
      });

    if (!created.ok) {
      return retry;
    }

    if (quantity > 0) {
      const added =
        await fetch(`${path}/adjust`, {
          method: 'PATCH',
          headers: jsonHeaders,
          body: JSON.stringify({
            delta: quantity,
            reason: 'opening_stock',
            reference,
          }),
        });

      if (!added.ok) {
        return `Stock for ${sku} is 0 because the opening stock was not saved. Add it on the Inventory page.`;
      }
    }

    return null;
  } catch {
    return retry;
  }
}

export function ProductManager() {
  const [products, setProducts] =
    useState<Product[]>([]);

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [name, setName] =
    useState('');

  const [brand, setBrand] =
    useState('');

  const [description, setDescription] =
    useState('');

  const [category, setCategory] =
    useState('');

  const [images, setImages] =
    useState<string[]>([]);

  /* True while the image uploader is sending files. */
  const [uploading, setUploading] =
    useState(false);

  /*
   * Changes whenever the form is loaded with a different product or
   * cleared, so the uploader starts fresh and an upload that was
   * still running cannot add its image to the wrong product.
   */
  const [formVersion, setFormVersion] =
    useState(0);

  const [active, setActive] =
    useState(true);

  const [variants, setVariants] =
    useState<VariantForm[]>([
      emptyVariant(),
    ]);

  const [message, setMessage] =
    useState('');

  async function load() {
    const categoriesResponse =
      await fetch(
        `/api/backend/categories`,
        {
          cache: 'no-store',
        },
      );

    if (!categoriesResponse.ok) {
      setMessage(
        'Unable to load catalog',
      );

      return;
    }

    const categoryBody =
      await categoriesResponse.json();

    setCategories(
      categoryBody,
    );

    if (
      !category &&
      categoryBody.length > 0
    ) {
      setCategory(
        categoryBody[0].slug,
      );
    }

    const collected:
      Product[] = [];

    let page = 1;
    let pages = 1;

    do {
      const productsResponse =
        await fetch(
          `/api/backend/products?page=${page}&limit=100`,
          {
            cache: 'no-store',
          },
        );

      if (!productsResponse.ok) {
        setMessage(
          'Unable to load catalog',
        );

        return;
      }

      const productBody =
        await productsResponse.json();

      collected.push(
        ...productBody.items,
      );

      pages =
        productBody.pagination?.pages ??
        1;

      page += 1;
    } while (
      page <= pages
    );

    setProducts(
      collected,
    );
  }

  useEffect(() => {
    void load();
  }, []);

  function reset() {
    setEditingId(null);
    setName('');
    setBrand('');
    setDescription('');
    setImages([]);
    setFormVersion(
      (current) => current + 1,
    );
    setActive(true);
    setVariants([
      emptyVariant(),
    ]);

    if (
      categories.length > 0
    ) {
      setCategory(
        categories[0].slug,
      );
    }
  }

  function edit(
    product: Product,
  ) {
    setEditingId(
      product._id,
    );

    setName(
      product.name,
    );

    setBrand(
      product.brand ?? '',
    );

    setDescription(
      product.description ??
        '',
    );

    setImages(
      product.images ?? [],
    );

    setFormVersion(
      (current) => current + 1,
    );

    setActive(
      product.active,
    );

    setCategory(
      typeof product.category ===
        'string'
        ? product.category
        : product.category.slug,
    );

    setVariants(
      product.variants.map(
        (variant) => ({
          sku: variant.sku,
          title:
            variant.title,
          price:
            String(
              variant.price,
            ),

          color:
            variant.attributes
              ?.color ?? '',

          size:
            variant.attributes
              ?.size ?? '',

          saved: true,
          stock: 'loading',
          openingStock: '',
        }),
      ),
    );

    void loadStock(
      product.variants.map(
        (variant) => variant.sku,
      ),
    );

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  /*
   * Fetches the stock on hand for the variants of the product being
   * edited. The answers are applied by SKU, so a slow answer for a
   * product that is no longer in the form changes nothing.
   */
  async function loadStock(
    skus: string[],
  ) {
    const results =
      await Promise.all(
        skus.map(
          async (sku) => {
            try {
              const response =
                await fetch(
                  `/api/backend/inventory/${encodeURIComponent(sku)}`,
                  {
                    cache: 'no-store',
                  },
                );

              if (!response.ok) {
                return {
                  sku,
                  stock: 'none' as const,
                };
              }

              const body =
                await response.json();

              return {
                sku,
                stock:
                  typeof body.onHand ===
                  'number'
                    ? (body.onHand as number)
                    : ('none' as const),
              };
            } catch {
              return {
                sku,
                stock: 'none' as const,
              };
            }
          },
        ),
      );

    setVariants(
      (current) =>
        current.map(
          (variant) => {
            const result =
              variant.saved
                ? results.find(
                    (item) =>
                      item.sku ===
                      variant.sku,
                  )
                : undefined;

            return result
              ? {
                  ...variant,
                  stock:
                    result.stock,
                }
              : variant;
          },
        ),
    );
  }

  function updateVariant(
    index: number,
    field:
      VariantTextField,
    value: string,
  ) {
    setVariants(
      (current) =>
        current.map(
          (
            variant,
            currentIndex,
          ) =>
            currentIndex ===
            index
              ? {
                  ...variant,
                  [field]:
                    value,
                }
              : variant,
        ),
    );
  }

  function addVariant() {
    setVariants(
      (current) => [
        ...current,
        emptyVariant(),
      ],
    );
  }

  function removeVariant(
    index: number,
  ) {
    setVariants(
      (current) =>
        current.length <= 1
          ? current
          : current.filter(
              (_, i) =>
                i !== index,
            ),
    );
  }

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setMessage('');

    if (uploading) {
      setMessage(
        'Wait for the images to finish uploading, then save.',
      );

      return;
    }

    /*
     * Opening stock applies only to variants that have no stock
     * record. null means "this variant already has one; leave it".
     */
    const openingStock =
      variants.map(
        (variant) =>
          variant.stock === 'none'
            ? parseOpeningStock(
                variant.openingStock,
              )
            : null,
      );

    if (
      openingStock.some(
        (quantity) =>
          quantity !== null &&
          Number.isNaN(quantity),
      )
    ) {
      setMessage(
        'Opening stock must be a whole number of 0 or more.',
      );

      return;
    }

    const payload = {
      name,
      description,
      category,
      brand,
      images:
        Array.from(
          new Set(
            images
              .map(
                (value) =>
                  value.trim(),
              )
              .filter(
                Boolean,
              ),
          ),
        ),

      active,

      variants:
        variants.map(
          (variant) => ({
            /*
             * A blank SKU is left out, and the API generates one
             * from the product code.
             */
            ...(variant.sku.trim()
              ? {
                  sku:
                    variant.sku.trim(),
                }
              : {}),

            title:
              variant.title,

            price:
              Number(
                variant.price,
              ),

            attributes: {
              ...(variant.color
                ? {
                    color:
                      variant.color,
                  }
                : {}),

              ...(variant.size
                ? {
                    size:
                      variant.size,
                  }
                : {}),
            },

            active: true,
          }),
        ),
    };

    const response =
      await fetch(
        editingId
          ? `/api/backend/products/${editingId}`
          : `/api/backend/products`,
        {
          method:
            editingId
              ? 'PATCH'
              : 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify(
              payload,
            ),
        },
      );

    const body =
      await response.json();

    if (!response.ok) {
      setMessage(
        Array.isArray(
          body.message,
        )
          ? body.message.join(
              ', ',
            )
          : body.message ??
              'Product save failed',
      );

      return;
    }

    /*
     * The API returns the saved product with its variants in the
     * order they were sent, so a SKU generated by the server can be
     * matched to its opening stock by position.
     */
    const saved =
      body as Product;

    const notes: string[] = [];

    for (
      const [index, quantity] of
      openingStock.entries()
    ) {
      const sku =
        saved.variants?.[index]?.sku;

      if (
        quantity === null ||
        !sku
      ) {
        continue;
      }

      const note =
        await saveOpeningStock(
          sku,
          quantity,
          saved.productCode ??
            'admin_console',
        );

      if (note) {
        notes.push(note);
      }
    }

    const headline =
      editingId
        ? 'Product updated'
        : 'Product created';

    setMessage(
      [
        saved.productCode
          ? `${headline}: ${saved.productCode}.`
          : `${headline}.`,
        ...notes,
      ].join(' '),
    );

    reset();
    await load();
  }

  async function remove(
    product: Product,
  ) {
    if (
      !(
        await confirmAction({
          title:
            'Delete product?',
          description:
            `Delete "${product.name}"? This action cannot be undone.`,
          confirmLabel:
            'Delete product',
          destructive:
            true,
        })
      )
    ) {
      return;
    }

    const response =
      await fetch(
        `/api/backend/products/${product._id}`,
        {
          method: 'DELETE',
        },
      );

    const body =
      await response.json();

    if (!response.ok) {
      setMessage(
        body.message ??
          'Delete failed',
      );
      return;
    }

    setMessage(
      'Product deleted',
    );

    await load();
  }

  const editingProduct =
    editingId
      ? products.find(
          (product) =>
            product._id ===
            editingId,
        )
      : undefined;

  return (
    <div className="grid min-w-0 gap-8 xl:grid-cols-[480px_minmax(0,1fr)]">
      <form
        onSubmit={submit}
        className="h-fit rounded-3xl border border-[#e8e2ef] bg-white p-6"
      >
        <h2 className="text-xl font-bold text-[#1f1235]">
          {editingId
            ? 'Edit product'
            : 'New product'}
        </h2>

        <p className="mt-1 text-sm text-[#6f6679]">
          {editingProduct
            ? editingProduct.productCode ??
              'This product gets its product code when you save it.'
            : 'The product code and any SKU you leave empty are generated when you save.'}
        </p>

        <div className="mt-6 grid gap-5">
          <label>
            <span className="text-sm font-semibold">
              Product name
            </span>

            <input
              required
              value={name}
              onChange={(event) =>
                setName(
                  event.target.value,
                )
              }
              className="mt-2 w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
            />
          </label>

          <label>
            <span className="text-sm font-semibold">
              Brand
            </span>

            <input
              value={brand}
              onChange={(event) =>
                setBrand(
                  event.target.value,
                )
              }
              className="mt-2 w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
            />
          </label>

          <label>
            <span className="text-sm font-semibold">
              Category
            </span>

            <select
              required
              value={category}
              onChange={(event) =>
                setCategory(
                  event.target.value,
                )
              }
              className="mt-2 w-full rounded-xl border border-[#e8e2ef] bg-white px-4 py-3"
            >
              {categories.map(
                (item) => (
                  <option
                    key={item._id}
                    value={
                      item.slug
                    }
                  >
                    {item.name}
                  </option>
                ),
              )}
            </select>
          </label>

          {/*
           * Files go from the browser straight to storage; the form
           * keeps the resulting list of image URLs. The key gives each
           * product its own uploader, so an upload that is still
           * running cannot land on a different product.
           */}
          <ProductImageUploader
            key={formVersion}
            images={images}
            onChange={setImages}
            onBusyChange={setUploading}
          />

          <label>
            <span className="text-sm font-semibold">
              Description
            </span>

            <textarea
              rows={4}
              value={description}
              onChange={(event) =>
                setDescription(
                  event.target.value,
                )
              }
              className="mt-2 w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
            />
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) =>
                setActive(
                  event.target.checked,
                )
              }
            />

            <span className="text-sm font-semibold">
              Active
            </span>
          </label>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-[#1f1235]">
              Variants
            </h3>

            <button
              type="button"
              onClick={addVariant}
              className="rounded-lg bg-[#f2edf8] px-3 py-2 text-sm font-semibold text-[#38205f]"
            >
              + Add variant
            </button>
          </div>

          <p className="mt-2 text-xs leading-5 text-[#6f6679]">
            Leave SKU empty to have one generated. Opening stock is the
            quantity you have now; after that, change stock on the
            Inventory page.
          </p>

          <div className="mt-4 space-y-4">
            {variants.map(
              (
                variant,
                index,
              ) => (
                <div
                  key={index}
                  className="rounded-2xl border border-[#e8e2ef] p-4"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      aria-label={`Variant ${index + 1} SKU`}
                      placeholder="SKU (optional)"
                      title={
                        variant.saved
                          ? 'A saved SKU cannot be changed, because stock and past orders are recorded under it.'
                          : undefined
                      }
                      readOnly={
                        variant.saved
                      }
                      value={
                        variant.sku
                      }
                      onChange={(event) =>
                        updateVariant(
                          index,
                          'sku',
                          event.target
                            .value,
                        )
                      }
                      className={`rounded-lg border border-[#e8e2ef] px-3 py-2 ${
                        variant.saved
                          ? 'bg-[#faf8fc] text-[#6f6679]'
                          : ''
                      }`}
                    />

                    <input
                      required
                      aria-label={`Variant ${index + 1} title`}
                      placeholder="Variant title"
                      value={
                        variant.title
                      }
                      onChange={(event) =>
                        updateVariant(
                          index,
                          'title',
                          event.target
                            .value,
                        )
                      }
                      className="rounded-lg border border-[#e8e2ef] px-3 py-2"
                    />

                    <input
                      required
                      min="0"
                      type="number"
                      aria-label={`Variant ${index + 1} price`}
                      placeholder="Price"
                      value={
                        variant.price
                      }
                      onChange={(event) =>
                        updateVariant(
                          index,
                          'price',
                          event.target
                            .value,
                        )
                      }
                      className="rounded-lg border border-[#e8e2ef] px-3 py-2"
                    />

                    <input
                      aria-label={`Variant ${index + 1} color`}
                      placeholder="Color"
                      value={
                        variant.color
                      }
                      onChange={(event) =>
                        updateVariant(
                          index,
                          'color',
                          event.target
                            .value,
                        )
                      }
                      className="rounded-lg border border-[#e8e2ef] px-3 py-2"
                    />

                    <input
                      aria-label={`Variant ${index + 1} size`}
                      placeholder="Size"
                      value={
                        variant.size
                      }
                      onChange={(event) =>
                        updateVariant(
                          index,
                          'size',
                          event.target
                            .value,
                        )
                      }
                      className="rounded-lg border border-[#e8e2ef] px-3 py-2"
                    />

                    {variant.stock ===
                    'none' ? (
                      /*
                       * The words stay visible next to the number, so
                       * a filled field cannot be mistaken for a price.
                       */
                      <label className="flex min-h-11 items-center gap-2 rounded-lg border border-[#e8e2ef] px-3 focus-within:outline-2 focus-within:outline-[#4c2a7d]">
                        <span className="shrink-0 text-sm text-[#6f6679]">
                          Opening stock
                        </span>

                        <input
                          min="0"
                          step="1"
                          type="number"
                          inputMode="numeric"
                          aria-label={`Variant ${index + 1} opening stock`}
                          placeholder="0"
                          value={
                            variant.openingStock
                          }
                          onChange={(event) =>
                            updateVariant(
                              index,
                              'openingStock',
                              event.target
                                .value,
                            )
                          }
                          className="w-full min-w-0 bg-transparent py-2 text-right outline-none"
                        />
                      </label>
                    ) : (
                      <p className="flex min-h-11 items-center rounded-lg bg-[#faf8fc] px-3 py-2 text-sm text-[#6f6679]">
                        {variant.stock ===
                        'loading'
                          ? 'Checking stock…'
                          : `In stock: ${variant.stock}`}
                      </p>
                    )}
                  </div>

                  {variants.length >
                    1 && (
                    <button
                      type="button"
                      onClick={() =>
                        removeVariant(
                          index,
                        )
                      }
                      className="mt-3 text-sm font-semibold text-red-600"
                    >
                      Remove variant
                    </button>
                  )}
                </div>
              ),
            )}
          </div>
        </div>

        <button
          disabled={uploading}
          className="mt-7 w-full rounded-xl bg-[#1f1235] px-5 py-3 font-bold text-white hover:bg-[#38205f] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading
            ? 'Uploading images…'
            : editingId
              ? 'Save product'
              : 'Create product'}
        </button>

        {editingId && (
          <button
            type="button"
            onClick={reset}
            className="mt-2 w-full rounded-xl border border-[#e8e2ef] px-5 py-3 font-semibold"
          >
            Cancel
          </button>
        )}

        {message && (
          <p className="mt-4 text-sm text-[#6f6679]">
            {message}
          </p>
        )}
      </form>

      <section>
        <div className="grid gap-4">
          {products.map(
            (product) => (
              <article
                key={product._id}
                className="rounded-2xl border border-[#e8e2ef] bg-white p-5"
              >
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="text-lg font-bold text-[#1f1235]">
                      {product.name}
                    </p>

                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#6f6679]">
                      {product.productCode && (
                        <span>
                          {product.productCode}
                        </span>
                      )}

                      {!product.active && (
                        <span className="rounded-full bg-[#fef4f2] px-2 py-0.5 text-[#8a1c10]">
                          Inactive (hidden from the shop)
                        </span>
                      )}
                    </p>

                    <p className="mt-1 text-sm text-[#6f6679]">
                      {product.brand ||
                        'No brand'}{' '}
                      ·{' '}
                      {
                        product.variants
                          .length
                      }{' '}
                      variant(s)
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {product.variants.map(
                        (
                          variant,
                        ) => (
                          <span
                            key={
                              variant.sku
                            }
                            className="rounded-full bg-[#f2edf8] px-3 py-1 text-xs font-semibold text-[#38205f]"
                          >
                            {
                              variant.sku
                            }
                          </span>
                        ),
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        edit(product)
                      }
                      className="rounded-lg border border-[#e8e2ef] px-3 py-2 text-sm font-semibold"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void remove(
                          product,
                        )
                      }
                      className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ),
          )}
        </div>
      </section>
    </div>
  );
}
