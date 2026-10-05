import { issueSignedToken } from '@vercel/blob';
import {
  handleUploadPresigned,
  type HandleUploadPresignedBody,
} from '@vercel/blob/client';
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
 * sees the file: it checks that the caller is a signed-in admin and then
 * hands back a short-lived upload address for one image, of a limited
 * size, in the products/ folder. That keeps uploads clear of the
 * request-body limit on serverless functions, and no storage credential
 * ever reaches the browser.
 *
 * This is Vercel Blob's presigned upload flow (handleUploadPresigned). It
 * signs with whichever credential the project has:
 *
 *   - On Vercel: connect the Blob store to this project. That sets
 *     BLOB_STORE_ID, and Vercel supplies a short-lived identity token to
 *     the function by itself. No BLOB_READ_WRITE_TOKEN is needed.
 *   - Outside Vercel (local development, Docker): set
 *     BLOB_READ_WRITE_TOKEN.
 *
 * The store must have Public access, because shoppers load the photos
 * straight from their addresses.
 */

const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

/*
 * The HttpOnly cookie set by src/app/api/session/route.ts after an admin
 * signs in. It holds the API bearer token.
 */
const ADMIN_COOKIE = 'sg_admin_token';

/* How long an upload address stays usable. */
const UPLOAD_WINDOW_MS = 10 * 60 * 1000;

const STORAGE_NOT_CONNECTED =
  'Photo storage is not connected to the admin. In Vercel, open Storage, open the Blob store, choose Connect Project and pick sg-commerce-admin, then redeploy the admin.';

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

function refusal(error: unknown) {
  return error instanceof UploadRefused
    ? jsonError(error.message, error.status)
    : jsonError('Your session could not be checked. Try again.', 500);
}

/** True when the project has something to sign uploads with. */
function storageIsConfigured(): boolean {
  return Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

/** Permission to put one image, of a limited size, at one path. */
function issueUploadPermission(pathname: string) {
  return issueSignedToken({
    pathname,
    operations: ['put'],
    allowedContentTypes: [...ALLOWED_IMAGE_TYPES],
    maximumSizeInBytes: MAX_IMAGE_BYTES,
    validUntil: Date.now() + UPLOAD_WINDOW_MS,
  });
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

/**
 * GET: tells a signed-in admin whether uploads can work and, if not, why.
 * The uploader asks this after a failed upload, so the message on screen
 * names the real cause. It makes the same request to the storage service
 * that an upload makes, so "ready" means the whole chain works.
 */
export async function GET(): Promise<NextResponse> {
  try {
    await requireAdmin();
  } catch (error) {
    return refusal(error);
  }

  if (!storageIsConfigured()) {
    return jsonError(STORAGE_NOT_CONNECTED, 503);
  }

  try {
    await issueUploadPermission('products/status-check');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Shows up in the Vercel logs of the admin project.
    console.error('[product-image upload] storage check failed:', message);

    return jsonError(`Photo storage refused the request: ${message}`, 503);
  }

  return NextResponse.json({ ready: true });
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

  if (!storageIsConfigured()) {
    // Only a signed-in admin is told anything about the setup.
    try {
      await requireAdmin();
    } catch (error) {
      return refusal(error);
    }

    console.error('[product-image upload] neither BLOB_STORE_ID nor BLOB_READ_WRITE_TOKEN is set');

    return jsonError(STORAGE_NOT_CONNECTED, 503);
  }

  let body: HandleUploadPresignedBody;

  try {
    body = (await request.json()) as HandleUploadPresignedBody;
  } catch {
    return jsonError('The upload request could not be read.', 400);
  }

  try {
    const result = await handleUploadPresigned({
      body,
      request,

      getSignedToken: async (pathname) => {
        await requireAdmin();

        if (!isAllowedUploadPath(pathname)) {
          throw new UploadRefused('Product images must be uploaded to the products folder.', 400);
        }

        return {
          token: await issueUploadPermission(pathname),

          urlOptions: {
            allowedContentTypes: [...ALLOWED_IMAGE_TYPES],
            maximumSizeInBytes: MAX_IMAGE_BYTES,
            validUntil: Date.now() + UPLOAD_WINDOW_MS,
            // Two files with the same name never overwrite each other.
            addRandomSuffix: true,
            allowOverwrite: false,
          },
        };
      },

      /*
       * No `onUploadCompleted` callback: the browser receives the image
       * address and it is saved with the product when the form is
       * submitted, so no webhook has to reach this server.
       */
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UploadRefused) {
      return jsonError(error.message, error.status);
    }

    const message =
      error instanceof Error ? error.message : 'The upload could not be authorised.';

    // Shows up in the Vercel logs of the admin project.
    console.error('[product-image upload]', message);

    return jsonError(message, 400);
  }
}
