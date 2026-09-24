'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  CartItem,
} from '@/lib/cart-types';

const STORAGE_KEY = 'sgcommerce-cart-v1';

interface AddCartItem
  extends Omit<CartItem, 'quantity'> {
  quantity?: number;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number;

  addItem: (
    item: AddCartItem,
  ) => void;

  updateQuantity: (
    sku: string,
    quantity: number,
  ) => void;

  removeItem: (
    sku: string,
  ) => void;

  clearCart: () => void;
}

const CartContext =
  createContext<CartContextValue | null>(
    null,
  );

export function CartProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] =
    useState<CartItem[]>([]);

  const [loaded, setLoaded] =
    useState(false);

  useEffect(() => {
    try {
      const stored =
        window.localStorage.getItem(
          STORAGE_KEY,
        );

      if (stored) {
        const parsed =
          JSON.parse(stored);

        if (Array.isArray(parsed)) {
          const valid =
            parsed.every(
              (item) =>
                item &&
                typeof item ===
                  'object' &&
                typeof item.sku ===
                  'string' &&
                typeof item.productSlug ===
                  'string' &&
                typeof item.productName ===
                  'string' &&
                typeof item.variantTitle ===
                  'string' &&
                (
                  item.image ===
                    undefined ||
                  typeof item.image ===
                    'string'
                ) &&
                Number.isFinite(
                  Number(
                    item.price,
                  ),
                ) &&
                Number(
                  item.price,
                ) >= 0 &&
                Number.isFinite(
                  Number(
                    item.available,
                  ),
                ) &&
                Number(
                  item.available,
                ) > 0 &&
                Number.isFinite(
                  Number(
                    item.quantity,
                  ),
                ) &&
                Number(
                  item.quantity,
                ) > 0,
            );

          if (valid) {
            setItems(
              parsed.map(
                (item) => ({
                  ...item,

                  price:
                    Number(
                      item.price,
                    ),

                  available:
                    Math.floor(
                      Number(
                        item.available,
                      ),
                    ),

                  quantity:
                    Math.min(
                      Math.floor(
                        Number(
                          item.quantity,
                        ),
                      ),
                      Math.floor(
                        Number(
                          item.available,
                        ),
                      ),
                    ),
                }),
              ),
            );
          } else {
            window.localStorage.removeItem(
              STORAGE_KEY,
            );
          }
        }
      }
    } catch {
      window.localStorage.removeItem(
        STORAGE_KEY,
      );
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(items),
    );
  }, [
    items,
    loaded,
  ]);

  const addItem =
    useCallback(
      (
        incoming: AddCartItem,
      ) => {
        const available =
          Math.floor(
            Number(
              incoming.available,
            ),
          );

        const price =
          Number(
            incoming.price,
          );

        const requested =
          Math.floor(
            Number(
              incoming.quantity ??
                1,
            ),
          );

        if (
          !Number.isFinite(
            available,
          ) ||
          available <= 0 ||
          !Number.isFinite(
            price,
          ) ||
          price < 0 ||
          !Number.isFinite(
            requested,
          ) ||
          requested <= 0
        ) {
          return;
        }

        setItems((current) => {
          const existing =
            current.find(
              (item) =>
                item.sku ===
                incoming.sku,
            );

          if (!existing) {
            return [
              ...current,
              {
                ...incoming,

                price,

                available,

                quantity:
                  Math.min(
                    requested,
                    available,
                  ),
              },
            ];
          }

          return current.map(
            (item) => {
              if (
                item.sku !==
                incoming.sku
              ) {
                return item;
              }

              return {
                ...item,
                available,

                price,

                quantity:
                  Math.min(
                    item.quantity +
                      requested,
                    available,
                  ),
              };
            },
          );
        });
      },
      [],
    );

  const updateQuantity =
    useCallback(
      (
        sku: string,
        quantity: number,
      ) => {
        setItems((current) =>
          current
            .map((item) => {
              if (
                item.sku !== sku
              ) {
                return item;
              }

              return {
                ...item,

                quantity:
                  Math.min(
                    Math.max(
                      quantity,
                      0,
                    ),
                    item.available,
                  ),
              };
            })
            .filter(
              (item) =>
                item.quantity > 0,
            ),
        );
      },
      [],
    );

  const removeItem =
    useCallback(
      (sku: string) => {
        setItems((current) =>
          current.filter(
            (item) =>
              item.sku !== sku,
          ),
        );
      },
      [],
    );

  const clearCart =
    useCallback(() => {
      setItems([]);
    }, []);

  const count =
    useMemo(
      () =>
        items.reduce(
          (
            total,
            item,
          ) =>
            total +
            item.quantity,
          0,
        ),
      [items],
    );

  const subtotal =
    useMemo(
      () =>
        items.reduce(
          (
            total,
            item,
          ) =>
            total +
            item.price *
              item.quantity,
          0,
        ),
      [items],
    );

  const value =
    useMemo(
      () => ({
        items,
        count,
        subtotal,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
      }),
      [
        items,
        count,
        subtotal,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
      ],
    );

  return (
    <CartContext.Provider
      value={value}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context =
    useContext(CartContext);

  if (!context) {
    throw new Error(
      'useCart must be used inside CartProvider',
    );
  }

  return context;
}
