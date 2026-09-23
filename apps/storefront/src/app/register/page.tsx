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

export default function RegisterPage() {
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
          '/api/customer/register',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                name:
                  String(
                    form.get(
                      'name',
                    ) ?? '',
                  ),

                email:
                  String(
                    form.get(
                      'email',
                    ) ?? '',
                  ),

                phone:
                  String(
                    form.get(
                      'phone',
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
          Array.isArray(
            body.message,
          )
            ? body.message.join(
                ', ',
              )
            : body.message ??
                'Registration failed',
        );

        return;
      }

      router.push(
        '/account',
      );
      router.refresh();
    } catch {
      setError(
        'Unable to create your account right now',
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
          Create account
        </h1>

        <form
          onSubmit={submit}
          className="mt-8 space-y-5"
        >
          <input
            required
            name="name"
            aria-label="Full name"
            placeholder="Full name"
            autoComplete="name"
            className="w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
          />

          <input
            required
            type="email"
            name="email"
            aria-label="Email address"
            placeholder="Email"
            autoComplete="email"
            className="w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
          />

          <input
            required
            name="phone"
            aria-label="Phone number"
            placeholder="Phone"
            autoComplete="tel"
            className="w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
          />

          <input
            required
            minLength={8}
            type="password"
            name="password"
            aria-label="Password"
            placeholder="Password"
            autoComplete="new-password"
            className="w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
          />

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
              ? 'Creating account...'
              : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-sm text-[#6f6679]">
          Already registered?{' '}
          <Link
            href="/login"
            className="font-bold text-[#38205f]"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
