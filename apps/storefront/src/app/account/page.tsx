'use client';

import {
  FormEvent,
  useEffect,
  useState,
} from 'react';

import {
  useRouter,
} from 'next/navigation';

import {
  clearCustomerToken,
  getCustomerToken,
} from '@/lib/customer-auth';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000/api/v1';

interface Address {
  id: string;
  label: string;
  addressLine1: string;
  city: string;
  area: string;
  zone: string;
  isDefault: boolean;
}

interface AccountData {
  customer: {
    name: string;
    phone: string;
    email: string;
    addresses: Address[];
  };
}

export default function AccountPage() {
  const router =
    useRouter();

  const [
    account,
    setAccount,
  ] =
    useState<AccountData | null>(
      null,
    );

  const [
    orders,
    setOrders,
  ] =
    useState<any[]>([]);

  const [
    error,
    setError,
  ] =
    useState('');

  async function authFetch(
    path: string,
    init?: RequestInit,
  ) {
    const token =
      getCustomerToken();

    if (!token) {
      throw new Error(
        'NO_TOKEN',
      );
    }

    return fetch(
      `${API_URL}${path}`,
      {
        ...init,

        headers: {
          ...(init?.headers ??
            {}),

          Authorization:
            `Bearer ${token}`,

          ...(init?.body
            ? {
                'Content-Type':
                  'application/json',
              }
            : {}),
        },
      },
    );
  }

  async function load() {
    try {
      const [
        accountResponse,
        ordersResponse,
      ] =
        await Promise.all([
          authFetch(
            '/auth/me',
          ),

          authFetch(
            '/auth/me/orders',
          ),
        ]);

      if (
        !accountResponse.ok
      ) {
        throw new Error(
          'AUTH',
        );
      }

      setAccount(
        await accountResponse.json(),
      );

      if (
        ordersResponse.ok
      ) {
        setOrders(
          await ordersResponse.json(),
        );
      }
    } catch {
      clearCustomerToken();
      router.replace(
        '/login',
      );
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function addAddress(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError('');

    const form =
      new FormData(
        event.currentTarget,
      );

    const response =
      await authFetch(
        '/auth/me/addresses',
        {
          method: 'POST',

          body:
            JSON.stringify({
              label:
                String(
                  form.get(
                    'label',
                  ) ?? '',
                ),

              addressLine1:
                String(
                  form.get(
                    'addressLine1',
                  ) ?? '',
                ),

              city:
                String(
                  form.get(
                    'city',
                  ) ?? '',
                ),

              area:
                String(
                  form.get(
                    'area',
                  ) ?? '',
                ),

              zone:
                String(
                  form.get(
                    'zone',
                  ) ??
                    'inside_dhaka',
                ),

              isDefault:
                form.get(
                  'isDefault',
                ) === 'on',
            }),
        },
      );

    if (!response.ok) {
      const body =
        await response.json();

      setError(
        body.message ??
          'Unable to save address',
      );

      return;
    }

    event.currentTarget.reset();
    await load();
  }

  async function removeAddress(
    id: string,
  ) {
    await authFetch(
      `/auth/me/addresses/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    );

    await load();
  }

  function logout() {
    clearCustomerToken();

    router.push(
      '/',
    );
  }

  if (!account) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-20">
        Loading account...
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#4c2a7d]">
            Customer account
          </p>

          <h1 className="mt-2 text-4xl font-bold text-[#1f1235]">
            {
              account.customer
                .name
            }
          </h1>

          <p className="mt-2 text-[#6f6679]">
            {
              account.customer
                .email
            }{' '}
            ·{' '}
            {
              account.customer
                .phone
            }
          </p>
        </div>

        <button
          onClick={logout}
          className="rounded-xl border border-[#e8e2ef] px-5 py-3 font-semibold"
        >
          Sign out
        </button>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section className="rounded-3xl border border-[#e8e2ef] bg-white p-7">
          <h2 className="text-xl font-bold text-[#1f1235]">
            Saved addresses
          </h2>

          <div className="mt-5 space-y-3">
            {account.customer
              .addresses.length ===
            0 ? (
              <p className="text-sm text-[#6f6679]">
                No saved addresses yet.
              </p>
            ) : (
              account.customer
                .addresses.map(
                  (address) => (
                    <div
                      key={
                        address.id
                      }
                      className="rounded-2xl bg-[#faf8fc] p-4"
                    >
                      <div className="flex justify-between gap-4">
                        <div>
                          <p className="font-bold">
                            {
                              address.label
                            }
                            {address.isDefault
                              ? ' · Default'
                              : ''}
                          </p>

                          <p className="mt-1 text-sm text-[#6f6679]">
                            {
                              address.addressLine1
                            }
                            ,{' '}
                            {
                              address.area
                            }
                            ,{' '}
                            {
                              address.city
                            }
                          </p>
                        </div>

                        <button
                          onClick={() =>
                            void removeAddress(
                              address.id,
                            )
                          }
                          className="text-sm font-semibold text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ),
                )
            )}
          </div>

          <form
            onSubmit={addAddress}
            className="mt-7 space-y-4 border-t border-[#e8e2ef] pt-6"
          >
            <h3 className="font-bold">
              Add address
            </h3>

            <input
              required
              name="label"
              placeholder="Home / Office"
              className="w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
            />

            <input
              required
              name="addressLine1"
              placeholder="Address"
              className="w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <input
                required
                name="city"
                placeholder="City"
                defaultValue="Dhaka"
                className="rounded-xl border border-[#e8e2ef] px-4 py-3"
              />

              <input
                name="area"
                placeholder="Area"
                className="rounded-xl border border-[#e8e2ef] px-4 py-3"
              />
            </div>

            <select
              name="zone"
              className="w-full rounded-xl border border-[#e8e2ef] bg-white px-4 py-3"
            >
              <option value="inside_dhaka">
                Inside Dhaka
              </option>

              <option value="outside_dhaka">
                Outside Dhaka
              </option>
            </select>

            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                name="isDefault"
              />

              Make default
            </label>

            {error && (
              <p className="text-sm text-red-600">
                {error}
              </p>
            )}

            <button className="rounded-xl bg-[#1f1235] px-5 py-3 font-bold text-white">
              Save address
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-[#e8e2ef] bg-white p-7">
          <h2 className="text-xl font-bold text-[#1f1235]">
            Order history
          </h2>

          {orders.length ===
          0 ? (
            <p className="mt-5 text-sm text-[#6f6679]">
              No orders linked to this account yet.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {orders.map(
                (order) => (
                  <div
                    key={
                      order._id
                    }
                    className="rounded-2xl bg-[#faf8fc] p-4"
                  >
                    <div className="flex justify-between gap-4">
                      <div>
                        <p className="font-bold text-[#1f1235]">
                          {
                            order.orderNumber
                          }
                        </p>

                        <p className="mt-1 text-sm capitalize text-[#6f6679]">
                          {
                            order.status
                          }
                        </p>
                      </div>

                      <p className="font-bold">
                        ৳
                        {
                          order.total
                        }
                      </p>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
