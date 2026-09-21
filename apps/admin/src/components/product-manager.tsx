'use client';

import {
  FormEvent,
  useEffect,
  useState,
} from 'react';


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
}

const emptyVariant =
  (): VariantForm => ({
    sku: '',
    title: '',
    price: '',
    color: '',
    size: '',
  });

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

  const [image, setImage] =
    useState('');

  const [active, setActive] =
    useState(true);

  const [variants, setVariants] =
    useState<VariantForm[]>([
      emptyVariant(),
    ]);

  const [message, setMessage] =
    useState('');

  async function load() {
    const [
      productsResponse,
      categoriesResponse,
    ] =
      await Promise.all([
        fetch(
          `/api/backend/products?limit=100`,
          {
            cache: 'no-store',
          },
        ),

        fetch(
          `/api/backend/categories`,
          {
            cache: 'no-store',
          },
        ),
      ]);

    if (
      !productsResponse.ok ||
      !categoriesResponse.ok
    ) {
      setMessage(
        'Unable to load catalog',
      );
      return;
    }

    const productBody =
      await productsResponse.json();

    setProducts(
      productBody.items,
    );

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
  }

  useEffect(() => {
    void load();
  }, []);

  function reset() {
    setEditingId(null);
    setName('');
    setBrand('');
    setDescription('');
    setImage('');
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

    setImage(
      product.images?.[0] ??
        '',
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
        }),
      ),
    );

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  function updateVariant(
    index: number,
    field:
      keyof VariantForm,
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

    const payload = {
      name,
      description,
      category,
      brand,
      images:
        image.trim()
          ? [
              image.trim(),
            ]
          : [],

      active,

      variants:
        variants.map(
          (variant) => ({
            sku:
              variant.sku,

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

    setMessage(
      editingId
        ? 'Product updated'
        : 'Product created',
    );

    reset();
    await load();
  }

  async function remove(
    product: Product,
  ) {
    if (
      !window.confirm(
        `Delete "${product.name}"?`,
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

  return (
    <div className="grid gap-8 xl:grid-cols-[480px_1fr]">
      <form
        onSubmit={submit}
        className="h-fit rounded-3xl border border-[#e8e2ef] bg-white p-6"
      >
        <h2 className="text-xl font-bold text-[#1f1235]">
          {editingId
            ? 'Edit product'
            : 'New product'}
        </h2>

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

          <label>
            <span className="text-sm font-semibold">
              Image URL
            </span>

            <input
              value={image}
              onChange={(event) =>
                setImage(
                  event.target.value,
                )
              }
              placeholder="https://..."
              className="mt-2 w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
            />
          </label>

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
                      required
                      placeholder="SKU"
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
                      className="rounded-lg border border-[#e8e2ef] px-3 py-2"
                    />

                    <input
                      required
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

        <button className="mt-7 w-full rounded-xl bg-[#1f1235] px-5 py-3 font-bold text-white hover:bg-[#38205f]">
          {editingId
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
