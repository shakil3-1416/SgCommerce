import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  establishCustomerSession,
} from '@/lib/customer-session.server';

export async function POST(
  request: NextRequest,
) {
  let registration:
    unknown;

  try {
    registration =
      await request.json();
  } catch {
    return NextResponse.json(
      {
        message:
          'Invalid registration request',
      },
      {
        status: 400,
      },
    );
  }

  return establishCustomerSession(
    '/auth/register',
    registration,
  );
}
