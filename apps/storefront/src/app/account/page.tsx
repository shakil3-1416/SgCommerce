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
  clearLegacyCustomerToken,
  customerFetch,
  logoutCustomer,
} from '@/lib/customer-auth';

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

  const [
    savingAddress,
    setSavingAddress,
  ] =
    useState(false);

  const [
    removingAddress,
    setRemovingAddress,
  ] =
    useState<string | null>(
      null,
    );

  const [
    addressMessage,
    setAddressMessage,
  ] =
    useState('');

  async function authFetch(
    path: string,
    init?: RequestInit,
  ) {
    const response =
      await customerFetch(
        path,
        init,
      );

    if (
      response.status ===
      401
    ) {
      throw new Error(
        'NO_TOKEN',
      );
    }

    return response;
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
      clearLegacyCustomerToken();
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

    /*
     * Capture the DOM form before the first await.
     * React event.currentTarget should not be relied
     * on after an asynchronous boundary.
     */
    const formElement =
      event.currentTarget;

    if (savingAddress) {
      return;
    }

    setError('');
    setAddressMessage('');
    setSavingAddress(true);

    try {
      const form =
        new FormData(
          formElement,
        );

      const response =
        await authFetch(
          '/auth/me/addresses',
          {
            method:
              'POST',

            body:
              JSON.stringify({
                label:
                  String(
                    form.get(
                      'label',
                    ) ?? '',
                  ).trim(),

                addressLine1:
                  String(
                    form.get(
                      'addressLine1',
                    ) ?? '',
                  ).trim(),

                addressLine2:
                  String(
                    form.get(
                      'addressLine2',
                    ) ?? '',
                  ).trim(),

                city:
                  String(
                    form.get(
                      'city',
                    ) ?? '',
                  ).trim(),

                area:
                  String(
                    form.get(
                      'area',
                    ) ?? '',
                  ).trim(),

                postalCode:
                  String(
                    form.get(
                      'postalCode',
                    ) ?? '',
                  ).trim(),

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
                  ) ===
                    'on',
              }),
          },
        );

      if (!response.ok) {
        let message =
          'Unable to save address';

        try {
          const body =
            await response.json();

          if (
            Array.isArray(
              body.message,
            )
          ) {
            message =
              body.message.join(
                ', ',
              );
          } else if (
            typeof body.message ===
              'string'
          ) {
            message =
              body.message;
          }
        } catch {
          // Keep friendly fallback.
        }

        throw new Error(
          message,
        );
      }

      /*
       * The API returns the updated customer.
       * Update the screen immediately instead of
       * making the customer wait for another fetch.
       */
      const customer =
        await response.json();

      setAccount(
        (current) =>
          current
            ? {
                ...current,
                customer,
              }
            : {
                customer,
              },
      );

      formElement.reset();

      setAddressMessage(
        'Address saved successfully.',
      );
    } catch (cause) {
      if (
        cause instanceof Error &&
        cause.message ===
          'NO_TOKEN'
      ) {
        clearLegacyCustomerToken();

        router.replace(
          '/login',
        );

        return;
      }

      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to save address',
      );
    } finally {
      setSavingAddress(false);
    }
  }

  async function removeAddress(
    id: string,
  ) {
    if (
      removingAddress
    ) {
      return;
    }

    setError('');
    setAddressMessage('');
    setRemovingAddress(
      id,
    );

    try {
      const response =
        await authFetch(
          `/auth/me/addresses/${encodeURIComponent(
            id,
          )}`,
          {
            method:
              'DELETE',
          },
        );

      if (!response.ok) {
        let message =
          'Unable to remove address';

        try {
          const body =
            await response.json();

          if (
            typeof body.message ===
              'string'
          ) {
            message =
              body.message;
          }
        } catch {
          // Keep fallback.
        }

        throw new Error(
          message,
        );
      }

      const customer =
        await response.json();

      setAccount(
        (current) =>
          current
            ? {
                ...current,
                customer,
              }
            : {
                customer,
              },
      );

      setAddressMessage(
        'Address removed.',
      );
    } catch (cause) {
      if (
        cause instanceof Error &&
        cause.message ===
          'NO_TOKEN'
      ) {
        clearLegacyCustomerToken();

        router.replace(
          '/login',
        );

        return;
      }

      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to remove address',
      );
    } finally {
      setRemovingAddress(
        null,
      );
    }
  }

  async function logout() {
    await logoutCustomer();

    router.push(
      '/',
    );
    router.refresh();
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
                          disabled={
                            removingAddress ===
                            address.id
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
              className="w-full rounded-xl border border-[#e8e2ef] px-4 py-3" aria-label="Address label" />

            <input
              required
              name="addressLine1"
              placeholder="House, road, street"
              autoComplete="address-line1"
              className="w-full rounded-xl border border-[#e8e2ef] px-4 py-3" aria-label="Street address" />

            <input
              name="addressLine2"
              placeholder="Apartment, floor, unit (optional)"
              autoComplete="address-line2"
              className="w-full rounded-xl border border-[#e8e2ef] px-4 py-3" aria-label="Apartment, suite or additional address" />

            <div className="grid gap-3 sm:grid-cols-2">
              <input
                required
                name="city"
                placeholder="City"
                autoComplete="address-level2"
                defaultValue="Dhaka"
                className="rounded-xl border border-[#e8e2ef] px-4 py-3" aria-label="City" />

              <input
                name="area"
                placeholder="Area / neighbourhood"
                autoComplete="address-level3"
                className="rounded-xl border border-[#e8e2ef] px-4 py-3" aria-label="Area" />

              <input
                name="postalCode"
                placeholder="Postal code"
                inputMode="numeric"
                autoComplete="postal-code"
                className="rounded-xl border border-[#e8e2ef] px-4 py-3" aria-label="Postal code" />
            </div>

            <select
              name="zone"
              className="w-full rounded-xl border border-[#e8e2ef] bg-white px-4 py-3"
             aria-label="Delivery zone">
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
                name="isDefault" aria-label="Use as default address" />

              Make default
            </label>

            {addressMessage && (
              <p
                role="status"
                className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800"
              >
                {addressMessage}
              </p>
            )}

            {error && (
              <p className="text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              aria-busy={savingAddress}
              disabled={savingAddress} className="rounded-xl bg-[#1f1235] px-5 py-3 font-bold text-white">
              {savingAddress ? 'Saving...' : 'Save address'}
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
