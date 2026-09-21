'use client';

import {
  useCart,
} from './cart-provider';

export function CartCount() {
  const {
    count,
  } = useCart();

  if (count === 0) {
    return null;
  }

  return (
    <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[#1f1235] px-1.5 py-0.5 text-xs font-bold text-white">
      {count}
    </span>
  );
}
