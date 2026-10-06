'use client';

import {
  useEffect,
} from 'react';

import {
  useCart,
} from '@/components/cart-provider';

/**
 * Empties the cart. Shown on the confirmation page after an online
 * payment is confirmed: until then the cart is kept, so nothing is lost
 * if the payment does not go through.
 *
 * The customer arrives here on a freshly loaded page, where the cart is
 * read from the browser's storage a moment after the page appears. So
 * this does not clear once at the start (the saved cart would simply
 * come back); it clears whenever there is something in the cart.
 */
export function ClearCart() {
  const { items, clearCart } =
    useCart();

  const hasItems =
    items.length > 0;

  useEffect(() => {
    if (hasItems) {
      clearCart();
    }
  }, [hasItems, clearCart]);

  return null;
}
