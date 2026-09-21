'use client';

import {
  FormEvent,
  useState,
} from 'react';

import Link from 'next/link';

import {
  useRouter,
} from 'next/navigation';

import {
  setCustomerToken,
} from '@/lib/customer-auth';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000/api/v1';

export default function LoginPage() {
  const router =
    useRouter();

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setLoading(true);
    setError('');

    const form =
      new FormData(
        event.currentTarget,
      );

    const response =
      await fetch(
        `${API_URL}/auth/login`,
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

    const body =
      await response.json();

    setLoading(false);

    if (
      !response.ok ||
      body.user?.role !==
        'customer'
    ) {
      setError(
        body.message ??
          'Customer login failed',
      );

      return;
    }

    setCustomerToken(
      body.token,
    );

    router.push(
      '/account',
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <div className="rounded-3xl border border-[#e8e2ef] bg-white p-8">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#4c2a7d]">
          Account
        </p>

        <h1 className="mt-2 text-3xl font-bold text-[#1f1235]">
          Sign in
        </h1>

        <form
          onSubmit={submit}
          className="mt-8 space-y-5"
        >
          <label className="block">
            <span className="text-sm font-semibold">
              Email or phone
            </span>

            <input
              required
              name="identifier"
              className="mt-2 w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold">
              Password
            </span>

            <input
              required
              minLength={8}
              type="password"
              name="password"
              className="mt-2 w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
            />
          </label>

          {error && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            disabled={loading}
            className="w-full rounded-xl bg-[#1f1235] px-5 py-3 font-bold text-white"
          >
            {loading
              ? 'Signing in...'
              : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-sm text-[#6f6679]">
          No account?{' '}
          <Link
            href="/register"
            className="font-bold text-[#38205f]"
          >
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
