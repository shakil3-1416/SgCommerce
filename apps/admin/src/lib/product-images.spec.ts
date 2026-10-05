/**
 * Run with (tsx is installed in the api workspace):
 *   pnpm --filter api exec tsx --test ../admin/src/lib/product-images.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  describeBytes,
  explainUploadFailure,
  isAllowedImageType,
  isAllowedUploadPath,
  MAX_IMAGE_BYTES,
  moveImage,
  uniqueImages,
  uploadPathFor,
} from './product-images';

describe('uploadPathFor', () => {
  it('builds a tidy path in the products folder', () => {
    assert.equal(uploadPathFor('My Photo (1).JPG'), 'products/my-photo-1.jpg');
    assert.equal(uploadPathFor('classic-cotton-t-shirt.webp'), 'products/classic-cotton-t-shirt.webp');
    assert.equal(uploadPathFor('Cr\u00e8me br\u00fbl\u00e9e.png'), 'products/creme-brulee.png');
  });

  it('falls back to a generic name when nothing usable is left', () => {
    assert.equal(uploadPathFor('\u099b\u09ac\u09bf.png'), 'products/image.png');
    assert.equal(uploadPathFor('.png'), 'products/png');
    assert.equal(uploadPathFor(''), 'products/image');
  });

  it('drops odd extensions and caps the length', () => {
    assert.equal(uploadPathFor('archive.tar.gz!'), 'products/archive-tar');
    assert.equal(uploadPathFor(`${'a'.repeat(200)}.jpeg`), `products/${'a'.repeat(60)}.jpeg`);
  });

  it('always produces a path the endpoint accepts', () => {
    const names = [
      'My Photo (1).JPG',
      '\u099b\u09ac\u09bf.png',
      '.png',
      '',
      'archive.tar.gz!',
      `${'a'.repeat(200)}.jpeg`,
      '../../etc/passwd',
      'a b/c d.png',
      '---.jpg',
    ];

    for (const name of names) {
      const path = uploadPathFor(name);

      assert.ok(isAllowedUploadPath(path), `${JSON.stringify(name)} -> ${path}`);
    }
  });
});

describe('isAllowedUploadPath', () => {
  it('rejects anything outside the products folder', () => {
    assert.equal(isAllowedUploadPath('products/tee.jpg'), true);
    assert.equal(isAllowedUploadPath('avatars/tee.jpg'), false);
    assert.equal(isAllowedUploadPath('products/../secrets.txt'), false);
    assert.equal(isAllowedUploadPath('products/nested/tee.jpg'), false);
    assert.equal(isAllowedUploadPath('products/'), false);
    assert.equal(isAllowedUploadPath('/products/tee.jpg'), false);
    assert.equal(isAllowedUploadPath('products/Tee.JPG'), false);
  });
});

describe('isAllowedImageType', () => {
  it('accepts web image formats only', () => {
    assert.equal(isAllowedImageType('image/jpeg'), true);
    assert.equal(isAllowedImageType('image/webp'), true);
    assert.equal(isAllowedImageType('image/heic'), false);
    assert.equal(isAllowedImageType('image/svg+xml'), false);
    assert.equal(isAllowedImageType('application/pdf'), false);
    assert.equal(isAllowedImageType(''), false);
  });
});

describe('describeBytes', () => {
  it('uses KB below one megabyte and MB above', () => {
    assert.equal(describeBytes(200), '1 KB');
    assert.equal(describeBytes(512 * 1024), '512 KB');
    assert.equal(describeBytes(MAX_IMAGE_BYTES), '8.0 MB');
    assert.equal(describeBytes(9858423), '9.4 MB');
  });
});

describe('uniqueImages', () => {
  it('keeps the first occurrence and the order', () => {
    assert.deepEqual(uniqueImages(['a', ' b ', 'a', '', 'c', 'b']), ['a', 'b', 'c']);
  });
});

describe('moveImage', () => {
  it('moves an image earlier or later', () => {
    assert.deepEqual(moveImage(['a', 'b', 'c'], 2, -1), ['a', 'c', 'b']);
    assert.deepEqual(moveImage(['a', 'b', 'c'], 0, 1), ['b', 'a', 'c']);
    assert.deepEqual(moveImage(['a', 'b', 'c'], 2, -2), ['c', 'a', 'b']);
  });

  it('leaves the order alone when the move is not possible', () => {
    assert.deepEqual(moveImage(['a', 'b', 'c'], 0, -1), ['a', 'b', 'c']);
    assert.deepEqual(moveImage(['a', 'b', 'c'], 2, 1), ['a', 'b', 'c']);
    assert.deepEqual(moveImage(['a', 'b', 'c'], 5, -1), ['a', 'b', 'c']);
  });

  it('does not change the array it was given', () => {
    const original = ['a', 'b', 'c'];

    moveImage(original, 0, 1);

    assert.deepEqual(original, ['a', 'b', 'c']);
  });
});

describe('explainUploadFailure', () => {
  const answer = (status: number, body: unknown) => async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
  const sdkError = new Error('Vercel Blob: Failed to retrieve the client token');

  it('passes on the reason the admin app gives when it cannot prepare an upload', async () => {
    assert.equal(
      await explainUploadFailure(sdkError, answer(503, { error: 'Photo storage is not connected to the admin.' })),
      'Photo storage is not connected to the admin.',
    );
    assert.equal(
      await explainUploadFailure(sdkError, answer(401, { error: 'Sign in again to upload images.' })),
      'Sign in again to upload images.',
    );
  });

  it('gives a general instruction when the admin app answers without a reason', async () => {
    assert.equal(
      await explainUploadFailure(sdkError, answer(500, '<html>error</html>')),
      'The admin could not prepare the upload. Sign in again, then upload it again.',
    );
  });

  it('points at the connection when the admin app cannot be reached', async () => {
    assert.equal(
      await explainUploadFailure(sdkError, async () => {
        throw new TypeError('Failed to fetch');
      }),
      'Check your internet connection, then upload it again.',
    );
  });

  it('recognises a store that was created as Private', async () => {
    assert.equal(
      await explainUploadFailure(
        new Error('Vercel Blob: Cannot use public access on a private store. The store is configured with private access.'),
        answer(200, { ready: true }),
      ),
      'The photo store in Vercel is set to Private. Product photos need a store with Public access.',
    );
  });

  it('passes on what the storage service said when the admin side is ready', async () => {
    assert.equal(
      await explainUploadFailure(new Error('Vercel Blob: This store has been suspended.'), answer(200, { ready: true })),
      'The storage service refused it: This store has been suspended.',
    );
  });

  it('points at the connection when the upload itself was cut off', async () => {
    for (const error of [new TypeError('Failed to fetch'), new Error(''), 'not an error', undefined]) {
      assert.equal(
        await explainUploadFailure(error, answer(200, { ready: true })),
        'Check your internet connection, then upload it again.',
      );
    }
  });
});
