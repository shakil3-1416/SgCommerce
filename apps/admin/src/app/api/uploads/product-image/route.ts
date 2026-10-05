import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import {
  ALLOWED_IMAGE_TYPES,
  isAllowedUploadPath,
  MAX_IMAGE_BYTES,
} from '@/lib/product-images';

/*
 * Product image uploads.
 *
 * The browser sends the file straight to Vercel Blob. This endpoint never
 * sees the file: it only checks that the caller is a signed-in admin and
 * then issues a short-lived token that allows one upload of an image, of a
 * limited size, into the products/ folder. That keeps uploads clear of the
 * request-body limit on serverless functions and keeps the storage
 * credentials on the server.
 *
 * Needs BLOB_READ_WRITE_TOKEN in the admin app's environment.
 */

const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/*
 * The HttpOnly cookie set by src/app/api/session/route.ts after an admin
 * signs in. It holds the API bearer token.
 */
const ADMIN_COOKIE = 'sg_admin_token';

class UploadRefused extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Asks the API who the cookie's token belongs to. src/proxy.ts lets every
 * /api/ path through without a check, so this route has to confirm the
 * caller is a signed-in admin itself.
 */
async function requireAdmin(): Promise<void> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;

  if (!token) {
    throw new UploadRefused('Sign in again to upload images.', 401);
  }

  let response: Response;

  try {
    response = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
  } catch {
    throw new UploadRefused('The API could not be reached to check your session. Try again.', 502);
  }

  if (!response.ok) {
    throw new UploadRefused('Your session has expired. Sign in again to upload images.', 401);
  }

  const user = (await response.json().catch(() => null)) as { role?: unknown } | null;

  if (user?.role !== 'admin') {
    throw new UploadRefused('Only admins can upload product images.', 403);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  /*
   * Same-origin protection for this authenticated, state-changing request,
   * as in the storefront's /api/customer/checkout route.
   */
  const origin = request.headers.get('origin');

  if (origin && origin !== request.nextUrl.origin) {
    return jsonError('Cross-origin uploads are not allowed.', 403);
  }

  let body: HandleUploadBody;

  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return jsonError('The upload request could not be read.', 400);
  }

  try {
    const result = await handleUpload({
      body,
      request,

      onBeforeGenerateToken: async (pathname) => {
        await requireAdmin();

        if (!isAllowedUploadPath(pathname)) {
          throw new UploadRefused('Product images must be uploaded to the products folder.', 400);
        }

        return {
          allowedContentTypes: [...ALLOWED_IMAGE_TYPES],
          maximumSizeInBytes: MAX_IMAGE_BYTES,
          addRandomSuffix: true,
        };
      },

      /*
       * No `onUploadCompleted` callback: the browser receives the image URL
       * and it is saved with the product when the form is submitted, so no
       * webhook has to reach this server. If your version of @vercel/blob
       * insists on the callback, add `onUploadCompleted: async () => {}`.
       */
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UploadRefused) {
      return jsonError(error.message, error.status);
    }

    return jsonError(
      error instanceof Error ? error.message : 'The upload could not be authorised.',
      400,
    );
  }
}
