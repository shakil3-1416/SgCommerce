import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  cookies,
} from 'next/headers';

const API_URL =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000/api/v1';

async function proxy(
  request: NextRequest,
  context: {
    params:
      Promise<{
        path: string[];
      }>;
  },
) {
  const store =
    await cookies();

  const token =
    store.get(
      'sg_admin_token',
    )?.value;

  if (!token) {
    return NextResponse.json(
      {
        message:
          'Admin authentication required',
      },
      {
        status: 401,
      },
    );
  }

  const {
    path,
  } =
    await context.params;

  const target =
    new URL(
      `${API_URL}/${path.join('/')}`,
    );

  request.nextUrl
    .searchParams
    .forEach(
      (
        value,
        key,
      ) => {
        target.searchParams.set(
          key,
          value,
        );
      },
    );

  const headers =
    new Headers();

  headers.set(
    'Authorization',
    `Bearer ${token}`,
  );

  const contentType =
    request.headers.get(
      'content-type',
    );

  if (contentType) {
    headers.set(
      'Content-Type',
      contentType,
    );
  }

  const method =
    request.method;

  const body =
    method === 'GET' ||
    method === 'HEAD'
      ? undefined
      : await request.text();

  const response =
    await fetch(
      target,
      {
        method,
        headers,
        body,
        cache: 'no-store',
      },
    );

  return new NextResponse(
    await response.text(),
    {
      status:
        response.status,

      headers: {
        'Content-Type':
          response.headers.get(
            'content-type',
          ) ??
          'application/json',
      },
    },
  );
}

export const GET =
  proxy;

export const POST =
  proxy;

export const PUT =
  proxy;

export const PATCH =
  proxy;

export const DELETE =
  proxy;
