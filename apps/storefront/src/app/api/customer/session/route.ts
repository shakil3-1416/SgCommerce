import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  clearCustomerSessionCookie,
  customerApiUrl,
  establishCustomerSession,
  getCustomerSessionToken,
} from '@/lib/customer-session.server';

export async function POST(
  request: NextRequest,
) {
  let credentials:
    unknown;

  try {
    credentials =
      await request.json();
  } catch {
    return NextResponse.json(
      {
        message:
          'Invalid login request',
      },
      {
        status: 400,
      },
    );
  }

  return establishCustomerSession(
    '/auth/login',
    credentials,
  );
}

export async function GET() {
  const token =
    await getCustomerSessionToken();

  if (!token) {
    return NextResponse.json(
      {
        authenticated:
          false,
      },
      {
        status: 401,
      },
    );
  }

  let upstream:
    Response;

  try {
    upstream =
      await fetch(
        customerApiUrl(
          '/auth/me',
        ),
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },

          cache:
            'no-store',
        },
      );
  } catch {
    return NextResponse.json(
      {
        message:
          'Account service is unavailable',
      },
      {
        status: 502,
      },
    );
  }

  const body =
    upstream.status ===
      204
      ? null
      : await upstream.text();

  const response =
    new NextResponse(
      body,
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

export async function DELETE() {
  const response =
    NextResponse.json({
      ok: true,
    });

  clearCustomerSessionCookie(
    response,
  );

  return response;
}
