import {
  cookies,
} from 'next/headers';

import {
  NextResponse,
} from 'next/server';

export const CUSTOMER_SESSION_COOKIE =
  'sg_customer_session';

const API_URL =
  (
    process.env.INTERNAL_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    'http://localhost:4000/api/v1'
  ).replace(
    /\/+$/,
    '',
  );

export function customerApiUrl(
  path: string,
) {
  if (
    !path.startsWith('/')
  ) {
    throw new Error(
      'Customer API path must start with "/"',
    );
  }

  return `${API_URL}${path}`;
}

function secureCookie() {
  const configured =
    process.env
      .CUSTOMER_COOKIE_SECURE;

  if (
    configured !==
    undefined
  ) {
    return (
      configured ===
      'true'
    );
  }

  return (
    process.env.NODE_ENV ===
    'production'
  );
}

export function setCustomerSessionCookie(
  response: NextResponse,
  token: string,
) {
  response.cookies.set(
    CUSTOMER_SESSION_COOKIE,
    token,
    {
      httpOnly: true,
      secure:
        secureCookie(),
      sameSite: 'lax',
      path: '/',
      maxAge:
        60 * 60 * 8,
      priority: 'high',
    },
  );
}

export function clearCustomerSessionCookie(
  response: NextResponse,
) {
  response.cookies.delete(
    CUSTOMER_SESSION_COOKIE,
  );
}

export async function getCustomerSessionToken() {
  const store =
    await cookies();

  return (
    store.get(
      CUSTOMER_SESSION_COOKIE,
    )?.value ??
    null
  );
}

function errorMessage(
  body: unknown,
  fallback: string,
) {
  if (
    body &&
    typeof body ===
      'object' &&
    'message' in body
  ) {
    const message =
      (
        body as {
          message?: unknown;
        }
      ).message;

    if (
      typeof message ===
      'string'
    ) {
      return message;
    }

    if (
      Array.isArray(
        message,
      )
    ) {
      return message;
    }
  }

  return fallback;
}

export async function establishCustomerSession(
  endpoint:
    '/auth/login' |
    '/auth/register',
  payload: unknown,
) {
  let upstream:
    Response;

  try {
    upstream =
      await fetch(
        customerApiUrl(
          endpoint,
        ),
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify(
              payload,
            ),

          cache:
            'no-store',
        },
      );
  } catch {
    return NextResponse.json(
      {
        message:
          'Authentication service is unavailable',
      },
      {
        status: 502,
      },
    );
  }

  let body:
    any = {};

  try {
    body =
      await upstream.json();
  } catch {
    body = {};
  }

  if (
    !upstream.ok
  ) {
    return NextResponse.json(
      {
        message:
          errorMessage(
            body,
            'Authentication failed',
          ),
      },
      {
        status:
          upstream.status,
      },
    );
  }

  if (
    body?.user?.role !==
      'customer' ||
    typeof body?.token !==
      'string' ||
    !body.token
  ) {
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

  /*
   * Important:
   * The API token never appears in the JSON response sent
   * to browser JavaScript. It is stored only in an HttpOnly
   * host-only cookie.
   */
  const response =
    NextResponse.json({
      ok: true,

      user: {
        id:
          body.user.id,

        email:
          body.user.email,

        role:
          body.user.role,

        customerId:
          body.user.customerId ??
          null,
      },
    });

  setCustomerSessionCookie(
    response,
    body.token,
  );

  return response;
}
