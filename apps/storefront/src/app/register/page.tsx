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

export default function RegisterPage() {
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
        `${API_URL}/auth/register`,
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
          Create account
        </h1>

        <form
          onSubmit={submit}
          className="mt-8 space-y-5"
        >
          <input
            required
            name="name"
            placeholder="Full name"
            className="w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
          />

          <input
            required
            type="email"
            name="email"
            placeholder="Email"
            className="w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
          />

          <input
            required
            name="phone"
            placeholder="Phone"
            className="w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
          />

          <input
            required
            minLength={8}
            type="password"
            name="password"
            placeholder="Password"
            className="w-full rounded-xl border border-[#e8e2ef] px-4 py-3"
          />

          {error && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button className="w-full rounded-xl bg-[#1f1235] px-5 py-3 font-bold text-white">
            Create account
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
