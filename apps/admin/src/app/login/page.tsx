'use client';

import {
  FormEvent,
  useState,
} from 'react';

import {
  useRouter,
} from 'next/navigation';

export default function AdminLoginPage() {
  const router =
    useRouter();

  const [
    error,
    setError,
  ] =
    useState('');

  async function submit(
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
      await fetch(
        '/api/session',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify({
              identifier:
                String(
                  form.get(
                    'identifier',
                  ) ?? '',
                ),

              password:
                String(
                  form.get(
                    'password',
                  ) ?? '',
                ),
            }),
        },
      );

    if (!response.ok) {
      setError(
        'Invalid admin credentials',
      );
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf8fc] px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-3xl border border-[#e8e2ef] bg-white p-8"
      >
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#4c2a7d]">
          SgCommerce
        </p>

        <h1 className="mt-2 text-3xl font-bold text-[#1f1235]">
          Admin sign in
        </h1>

        <input
          required
          name="identifier"
          placeholder="Admin email"
          className="mt-8 w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
        />

        <input
          required
          minLength={8}
          type="password"
          name="password"
          placeholder="Password"
          className="mt-4 w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
        />

        {error && (
          <p className="mt-4 text-sm text-red-600">
            {error}
          </p>
        )}

        <button className="mt-6 w-full rounded-xl bg-[#1f1235] px-5 py-3 font-bold text-white">
          Sign in
        </button>
      </form>
    </main>
  );
}
