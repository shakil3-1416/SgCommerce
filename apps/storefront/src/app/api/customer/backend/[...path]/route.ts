import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  clearCustomerSessionCookie,
  customerApiUrl,
  getCustomerSessionToken,
} from '@/lib/customer-session.server';

function allowedCustomerPath(
  path: string,
) {
  return (
    path ===
      '/auth/me' ||
    path.startsWith(
      '/auth/me/',
    ) ||
    path ===
      '/returns' ||
    path ===
      '/returns/me'
  );
}

function sameOriginMutation(
  request: NextRequest,
) {
  if (
    request.method ===
      'GET' ||
    request.method ===
      'HEAD'
  ) {
    return true;
  }

  const fetchSite =
    request.headers.get(
      'sec-fetch-site',
    );

  if (
    fetchSite ===
    'cross-site'
  ) {
    return false;
  }

  const origin =
    request.headers.get(
      'origin',
    );

  if (
    origin &&
    origin !==
      request.nextUrl.origin
  ) {
    return false;
  }

  return true;
}

async function proxy(
  request: NextRequest,
  context: {
    params:
      Promise<{
        path: string[];
      }>;
  },
) {
  if (
    !sameOriginMutation(
      request,
    )
  ) {
    return NextResponse.json(
      {
        message:
          'Cross-origin customer mutation rejected',
      },
      {
        status: 403,
      },
    );
  }

  const {
    path,
  } =
    await context.params;

  if (
    path.length === 0 ||
    path.some(
      (segment) =>
        segment ===
          '.' ||
        segment ===
          '..',
    )
  ) {
    return NextResponse.json(
      {
        message:
          'Invalid customer API path',
      },
      {
        status: 400,
      },
    );
  }

  const apiPath =
    `/${path.join('/')}`;

  if (
    !allowedCustomerPath(
      apiPath,
    )
  ) {
    return NextResponse.json(
      {
        message:
          'Customer API path is not allowed',
      },
      {
        status: 403,
      },
    );
  }

  const token =
    await getCustomerSessionToken();

  if (!token) {
    return NextResponse.json(
      {
        message:
          'Customer authentication required',
      },
      {
        status: 401,
      },
    );
  }

  const target =
    new URL(
      customerApiUrl(
        apiPath,
      ),
    );

  request.nextUrl
    .searchParams
    .forEach(
      (
        value,
        key,
      ) => {
        target.searchParams.append(
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

  for (
    const name
    of [
      'content-type',
      'accept',
      'x-idempotency-key',
    ]
  ) {
    const value =
      request.headers.get(
        name,
      );

    if (value) {
      headers.set(
        name,
        value,
      );
    }
  }

  let body:
    string | undefined;

  if (
    request.method !==
      'GET' &&
    request.method !==
      'HEAD'
  ) {
    const text =
      await request.text();

    body =
      text.length > 0
        ? text
        : undefined;
  }

  let upstream:
    Response;

  try {
    upstream =
      await fetch(
        target,
        {
          method:
            request.method,

          headers,
          body,

          cache:
            'no-store',
        },
      );
  } catch {
    return NextResponse.json(
      {
        message:
          'Customer API is unavailable',
      },
      {
        status: 502,
      },
    );
  }

  const responseBody =
    upstream.status ===
      204
      ? null
      : await upstream.text();

  const response =
    new NextResponse(
      responseBody,
      {
        status:
          upstream.status,

        headers: {
          'Content-Type':
            upstream.headers.get(
              'content-type',
            ) ??
            'application/json',

          'Cache-Control':
            'no-store',
        },
      },
    );

  if (
    upstream.status ===
    401
  ) {
    clearCustomerSessionCookie(
      response,
    );
  }

  return response;
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
