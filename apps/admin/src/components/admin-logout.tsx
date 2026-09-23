'use client';

import {
  useRouter,
} from 'next/navigation';

export function AdminLogout() {
  const router =
    useRouter();

  async function logout() {
    await fetch(
      '/api/session',
      {
        method: 'DELETE',
      },
    );

    router.push(
      '/login',
    );

    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="min-h-11 rounded-lg border border-[#e8e2ef] px-3 py-2 text-xs font-semibold"
    >
      Sign out
    </button>
  );
}
