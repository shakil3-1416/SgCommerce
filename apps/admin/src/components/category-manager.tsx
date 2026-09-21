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
  description: string;
  active: boolean;
}

export function CategoryManager() {
  const [categories, setCategories] =
    useState<Category[]>([]);

  const [name, setName] =
    useState('');

  const [description, setDescription] =
    useState('');

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState('');

  async function load() {
    const response =
      await fetch(
        `/api/backend/categories`,
        {
          cache: 'no-store',
        },
      );

    if (!response.ok) {
      setMessage(
        'Unable to load categories',
      );
      return;
    }

    setCategories(
      await response.json(),
    );
  }

  useEffect(() => {
    void load();
  }, []);

  function reset() {
    setName('');
    setDescription('');
    setEditingId(null);
  }

  function edit(
    category: Category,
  ) {
    setEditingId(
      category._id,
    );

    setName(
      category.name,
    );

    setDescription(
      category.description ?? '',
    );
  }

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setMessage('');

    const response =
      await fetch(
        editingId
          ? `/api/backend/categories/${editingId}`
          : `/api/backend/categories`,
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
            JSON.stringify({
              name,
              description,
              active: true,
            }),
        },
      );

    const body =
      await response.json();

    if (!response.ok) {
      setMessage(
        Array.isArray(body.message)
          ? body.message.join(', ')
          : body.message ??
              'Save failed',
      );

      return;
    }

    setMessage(
      editingId
        ? 'Category updated'
        : 'Category created',
    );

    reset();
    await load();
  }

  async function remove(
    category: Category,
  ) {
    if (
      !window.confirm(
        `Delete "${category.name}"?`,
      )
    ) {
      return;
    }

    const response =
      await fetch(
        `/api/backend/categories/${category._id}`,
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
      'Category deleted',
    );

    await load();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
      <form
        onSubmit={submit}
        className="h-fit rounded-3xl border border-[#e8e2ef] bg-white p-6"
      >
        <h2 className="text-xl font-bold text-[#1f1235]">
          {editingId
            ? 'Edit category'
            : 'New category'}
        </h2>

        <label className="mt-6 block">
          <span className="text-sm font-semibold">
            Name
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

        <label className="mt-5 block">
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

        <button className="mt-6 w-full rounded-xl bg-[#1f1235] px-5 py-3 font-bold text-white hover:bg-[#38205f]">
          {editingId
            ? 'Save changes'
            : 'Create category'}
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

      <section className="overflow-hidden rounded-3xl border border-[#e8e2ef] bg-white">
        <div className="border-b border-[#e8e2ef] px-6 py-5">
          <h2 className="font-bold text-[#1f1235]">
            Categories
          </h2>
        </div>

        {categories.length === 0 ? (
          <div className="p-10 text-center text-[#6f6679]">
            No categories.
          </div>
        ) : (
          <div className="divide-y divide-[#e8e2ef]">
            {categories.map(
              (category) => (
                <div
                  key={category._id}
                  className="flex items-center justify-between gap-4 p-5"
                >
                  <div>
                    <p className="font-semibold text-[#1f1235]">
                      {category.name}
                    </p>

                    <p className="mt-1 text-xs text-[#6f6679]">
                      /{category.slug}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        edit(category)
                      }
                      className="rounded-lg border border-[#e8e2ef] px-3 py-2 text-sm font-semibold"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void remove(
                          category,
                        )
                      }
                      className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </section>
    </div>
  );
}
