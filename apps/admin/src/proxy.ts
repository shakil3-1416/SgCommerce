import {
  NextRequest,
  NextResponse,
} from 'next/server';

export function proxy(
  request: NextRequest,
) {
  const path =
    request.nextUrl.pathname;

  if (
    path === '/login' ||
    path.startsWith(
      '/api/',
    ) ||
    path.startsWith(
      '/_next/',
    ) ||
    path.startsWith(
      '/catalog/',
    ) ||
    path === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const token =
    request.cookies.get(
      'sg_admin_token',
    )?.value;

  if (!token) {
    const login =
      new URL(
        '/login',
        request.url,
      );

    return NextResponse.redirect(
      login,
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image).*)',
  ],
};
