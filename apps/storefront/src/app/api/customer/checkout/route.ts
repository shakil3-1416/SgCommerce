import {
  cookies,
} from 'next/headers';

import {
  NextRequest,
  NextResponse,
} from 'next/server';

const API_URL =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000/api/v1';

const CUSTOMER_COOKIE =
  'sg_customer_session';

function jsonError(
  message: string,
  status: number,
) {
  return NextResponse.json(
    {
      message,
    },
    {
      status,
    },
  );
}

export async function POST(
  request:
    NextRequest,
) {
  /*
   * Same-origin protection for this authenticated
   * state-changing request.
   */
  const origin =
    request.headers.get(
      'origin',
    );

  if (
    origin &&
    origin !==
      request.nextUrl.origin
  ) {
    return jsonError(
      'Cross-origin checkout is not allowed',
      403,
    );
  }

  const store =
    await cookies();

  const token =
    store.get(
      CUSTOMER_COOKIE,
    )?.value;

  if (!token) {
    return jsonError(
      'Authentication required',
      401,
    );
  }

  const body =
    await request.text();

  const headers =
    new Headers();

  headers.set(
    'Authorization',
    `Bearer ${token}`,
  );

  headers.set(
    'Content-Type',
    request.headers.get(
      'content-type',
    ) ??
      'application/json',
  );

  const idempotencyKey =
    request.headers.get(
      'x-idempotency-key',
    );

  if (idempotencyKey) {
    headers.set(
      'x-idempotency-key',
      idempotencyKey,
    );
  }

  const response =
    await fetch(
      `${API_URL}/auth/me/checkout`,
      {
        method:
          'POST',

        headers,

        body,

        cache:
          'no-store',
      },
    );

  const contentType =
    response.headers.get(
      'content-type',
    ) ??
    'application/json';

  return new NextResponse(
    await response.text(),
    {
      status:
        response.status,

      headers: {
        'Content-Type':
          contentType,
      },
    },
  );
}
