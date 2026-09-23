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
  clearLegacyCustomerToken,
} from '@/lib/customer-auth';

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

    if (loading) {
      return;
    }

    setLoading(true);
    setError('');
    clearLegacyCustomerToken();

    const form =
      new FormData(
        event.currentTarget,
      );

    try {
      const response =
        await fetch(
          '/api/customer/session',
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

      if (!response.ok) {
        setError(
          body.message ??
            'Customer login failed',
        );

        return;
      }

      router.push(
        '/account',
      );
      router.refresh();
    } catch {
      setError(
        'Unable to sign in right now',
      );
    } finally {
      setLoading(false);
    }
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
              autoComplete="username"
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
              autoComplete="current-password"
              className="mt-2 w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <button
            disabled={loading}
            aria-busy={loading}
            className="w-full rounded-xl bg-[#1f1235] px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
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
