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

export async function POST(
  request: NextRequest,
) {
  const credentials =
    await request.json();

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
          JSON.stringify(
            credentials,
          ),
      },
    );

  const body =
    await response.json();

  if (
    !response.ok ||
    body.user?.role !==
      'admin'
  ) {
    return NextResponse.json(
      {
        message:
          'Invalid admin credentials',
      },
      {
        status: 401,
      },
    );
  }

  const store =
    await cookies();

  store.set(
    'sg_admin_token',
    body.token,
    {
      httpOnly: true,
      sameSite: 'lax',
      secure:
        process.env
          .ADMIN_COOKIE_SECURE
          ? process.env
              .ADMIN_COOKIE_SECURE ===
            'true'
          : process.env
              .NODE_ENV ===
            'production',
      path: '/',
      maxAge:
        60 * 60 * 8,
    },
  );

  return NextResponse.json({
    ok: true,
  });
}

export async function DELETE() {
  const store =
    await cookies();

  store.delete(
    'sg_admin_token',
  );

  return NextResponse.json({
    ok: true,
  });
}
