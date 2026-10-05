/**
 * Run with:
 *   pnpm --filter api exec tsx --test src/modules/sequences/business-ids.spec.ts
 *
 * Uses Node's built-in test runner, so no test framework has to be installed.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assignVariantSkus,
  formatCode,
  isSequenceName,
  isValidSku,
  lastVariantPosition,
  normalizeSku,
  parseCode,
  planCodeBackfill,
  slugify,
  typedSkus,
  variantSku,
} from './business-ids';

describe('formatCode', () => {
  it('pads to the configured width', () => {
    assert.equal(formatCode('product', 1), 'SGP-000001');
    assert.equal(formatCode('product', 217), 'SGP-000217');
    assert.equal(formatCode('order', 1234), 'SGO-0001234');
    assert.equal(formatCode('return', 45), 'SGR-000045');
    assert.equal(formatCode('refund', 12), 'SGF-000012');
  });

  it('keeps growing once the width is used up', () => {
    assert.equal(formatCode('product', 999999), 'SGP-999999');
    assert.equal(formatCode('product', 1000000), 'SGP-1000000');
  });

  it('rejects values that are not positive whole numbers', () => {
    for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(() => formatCode('product', bad), RangeError);
    }
  });
});

describe('parseCode', () => {
  it('reverses formatCode', () => {
    for (const value of [1, 217, 999999, 1000000]) {
      assert.equal(parseCode('product', formatCode('product', value)), value);
    }
  });

  it('accepts lower case and surrounding spaces', () => {
    assert.equal(parseCode('product', '  sgp-000217 '), 217);
  });

  it('returns null for other prefixes, other shapes and non-strings', () => {
    assert.equal(parseCode('product', 'SGO-0000217'), null);
    assert.equal(parseCode('product', 'SGP-'), null);
    assert.equal(parseCode('product', 'SGP-000000'), null);
    assert.equal(parseCode('product', 'SGP-12A'), null);
    assert.equal(parseCode('product', 'FS-0020-STD'), null);
    assert.equal(parseCode('product', undefined), null);
    assert.equal(parseCode('product', null), null);
    assert.equal(parseCode('product', 217), null);
  });
});

describe('isSequenceName', () => {
  it('only accepts configured sequences', () => {
    assert.equal(isSequenceName('product'), true);
    assert.equal(isSequenceName('order'), true);
    assert.equal(isSequenceName('toString'), false);
    assert.equal(isSequenceName('invoice'), false);
  });
});

describe('slugify', () => {
  it('drops apostrophes instead of splitting the word', () => {
    assert.equal(
      slugify("Opna Women's Short Sleeve Moisture"),
      'opna-womens-short-sleeve-moisture',
    );
    assert.equal(slugify('Women\u2019s Clothing'), 'womens-clothing');
  });

  it('spells out ampersands and collapses punctuation', () => {
    assert.equal(slugify('Gold & Silver Dragon Station Chain'), 'gold-and-silver-dragon-station-chain');
    assert.equal(
      slugify('SanDisk SSD PLUS 1TB Internal SSD - SATA III 6 Gb/s'),
      'sandisk-ssd-plus-1tb-internal-ssd-sata-iii-6-gb-s',
    );
  });

  it('removes accents and trims separators', () => {
    assert.equal(slugify('  Caf\u00e9  Cr\u00e8me \u2014 250g '), 'cafe-creme-250g');
  });

  it('returns an empty string when no Latin letters or digits remain', () => {
    assert.equal(slugify('\u09aa\u09be\u099e\u09cd\u099c\u09be\u09ac\u09bf'), '');
    assert.equal(slugify('---'), '');
    assert.equal(slugify(''), '');
  });

  it('caps the length at 80 without ending on half a word or a hyphen', () => {
    const long = slugify(
      'Samsung 49-Inch CHG90 144Hz Curved Gaming Monitor (LC49HG90DMNXZA) Super Ultrawide Screen QLED Display',
    );

    assert.ok(long.length <= 80, `length was ${long.length}`);
    assert.ok(!long.endsWith('-'));
    assert.equal(
      long,
      'samsung-49-inch-chg90-144hz-curved-gaming-monitor-lc49hg90dmnxza-super-ultrawide',
    );
  });

  it('leaves an exact-fit slug alone', () => {
    const exact = 'a'.repeat(80);

    assert.equal(slugify(exact), exact);
    assert.equal(slugify(`${'a'.repeat(80)}-tail`), exact);
  });
});

describe('SKU helpers', () => {
  it('normalises typed SKUs', () => {
    assert.equal(normalizeSku('  tee blk  m '), 'TEE-BLK-M');
  });

  it('validates the allowed character set', () => {
    assert.equal(isValidSku('SGP-000217-01'), true);
    assert.equal(isValidSku('A'), true);
    assert.equal(isValidSku('TEE_BLK.M'), true);
    assert.equal(isValidSku('-LEADING'), false);
    assert.equal(isValidSku('TRAILING-'), false);
    assert.equal(isValidSku('HAS/SLASH'), false);
    assert.equal(isValidSku(''), false);
    assert.equal(isValidSku('A'.repeat(64)), true);
    assert.equal(isValidSku('A'.repeat(65)), false);
  });

  it('builds variant SKUs from the product code', () => {
    assert.equal(variantSku('SGP-000217', 1), 'SGP-000217-01');
    assert.equal(variantSku('SGP-000217', 12), 'SGP-000217-12');
    assert.equal(variantSku('SGP-000217', 100), 'SGP-000217-100');
    assert.throws(() => variantSku('SGP-000217', 0), RangeError);
  });

  it('finds the last issued position for one product only', () => {
    assert.equal(lastVariantPosition('SGP-000217', []), 0);
    assert.equal(
      lastVariantPosition('SGP-000217', [
        'SGP-000217-01',
        'SGP-000217-04',
        'SGP-000218-09',
        'SGP-0002170-07',
        'FS-0020-STD',
        'SGP-000217-XL',
      ]),
      4,
    );
  });
});

describe('typedSkus', () => {
  it('returns normalised typed SKUs and null for blanks, in order', () => {
    assert.deepEqual(typedSkus([{ sku: ' tee blk m ' }, {}, { sku: '' }, { sku: null }]), [
      'TEE-BLK-M',
      null,
      null,
      null,
    ]);
  });

  it('throws before any product code is needed', () => {
    assert.throws(() => typedSkus([{ sku: 'A B' }, { sku: 'a-b' }]), /more than one variant/);
    assert.throws(() => typedSkus([{ sku: '#1' }]), /not valid/);
  });
});

describe('assignVariantSkus', () => {
  it('numbers every variant when none has a SKU', () => {
    assert.deepEqual(assignVariantSkus('SGP-000217', [{}, { sku: '' }, { sku: null }]), [
      'SGP-000217-01',
      'SGP-000217-02',
      'SGP-000217-03',
    ]);
  });

  it('keeps typed SKUs and fills the gaps', () => {
    assert.deepEqual(
      assignVariantSkus('SGP-000217', [{ sku: 'tee blk m' }, {}, { sku: 'TEE-BLK-L' }, {}]),
      ['TEE-BLK-M', 'SGP-000217-01', 'TEE-BLK-L', 'SGP-000217-02'],
    );
  });

  it('continues after positions that were already issued, including retired ones', () => {
    assert.deepEqual(
      assignVariantSkus('SGP-000217', [{ sku: 'SGP-000217-01' }, {}], ['SGP-000217-03']),
      ['SGP-000217-01', 'SGP-000217-04'],
    );
  });

  it('continues after the stored high-water mark even when no SKU shows it', () => {
    // Variants 02 and 03 were deleted earlier; the product remembers it got as far as 3.
    assert.deepEqual(assignVariantSkus('SGP-000217', [{ sku: 'SGP-000217-01' }, {}], [], 3), [
      'SGP-000217-01',
      'SGP-000217-04',
    ]);
    assert.deepEqual(assignVariantSkus('SGP-000217', [{}], ['SGP-000217-09'], 3), ['SGP-000217-10']);
    assert.throws(() => assignVariantSkus('SGP-000217', [{}], [], -1), RangeError);
    assert.throws(() => assignVariantSkus('SGP-000217', [{}], [], 1.5), RangeError);
  });

  it('never issues a number the merchant typed for another variant', () => {
    assert.deepEqual(assignVariantSkus('SGP-000217', [{}, { sku: 'SGP-000217-01' }]), [
      'SGP-000217-02',
      'SGP-000217-01',
    ]);
  });

  it('rejects duplicate and malformed SKUs', () => {
    assert.throws(
      () => assignVariantSkus('SGP-000217', [{ sku: 'TEE' }, { sku: ' tee ' }]),
      /more than one variant/,
    );
    assert.throws(() => assignVariantSkus('SGP-000217', [{ sku: 'TEE/BLK' }]), /not valid/);
  });

  it('returns an empty list for a product without variants', () => {
    assert.deepEqual(assignVariantSkus('SGP-000217', []), []);
  });
});

describe('planCodeBackfill', () => {
  it('numbers a fresh collection in the order given', () => {
    const plan = planCodeBackfill('product', [{ id: 'a' }, { id: 'b' }, { id: 'c', code: null }]);

    assert.deepEqual(plan.assignments, [
      { id: 'a', code: 'SGP-000001' },
      { id: 'b', code: 'SGP-000002' },
      { id: 'c', code: 'SGP-000003' },
    ]);
    assert.equal(plan.lastValue, 3);
    assert.equal(plan.alreadyCoded, 0);
    assert.deepEqual(plan.unrecognised, []);
  });

  it('continues after the highest existing code and leaves coded records alone', () => {
    const plan = planCodeBackfill('product', [
      { id: 'a', code: 'SGP-000007' },
      { id: 'b' },
      { id: 'c', code: 'SGP-000003' },
      { id: 'd', code: '' },
    ]);

    assert.deepEqual(plan.assignments, [
      { id: 'b', code: 'SGP-000008' },
      { id: 'd', code: 'SGP-000009' },
    ]);
    assert.equal(plan.lastValue, 9);
    assert.equal(plan.alreadyCoded, 2);
  });

  it('plans nothing when run on its own output', () => {
    const docs = [{ id: 'a' }, { id: 'b' }];
    const first = planCodeBackfill('product', docs);
    const coded = docs.map((doc) => ({
      id: doc.id,
      code: first.assignments.find((item) => item.id === doc.id)?.code,
    }));
    const second = planCodeBackfill('product', coded);

    assert.deepEqual(second.assignments, []);
    assert.equal(second.lastValue, first.lastValue);
    assert.equal(second.alreadyCoded, 2);
  });

  it('does not overwrite values it does not recognise', () => {
    const plan = planCodeBackfill('product', [{ id: 'a', code: 'LEGACY-9' }, { id: 'b' }]);

    assert.deepEqual(plan.unrecognised, ['a']);
    assert.deepEqual(plan.assignments, [{ id: 'b', code: 'SGP-000001' }]);
  });

  it('starts above an existing counter so deleted numbers are not reissued', () => {
    const plan = planCodeBackfill('product', [{ id: 'a', code: 'SGP-000002' }, { id: 'b' }], 40);

    assert.deepEqual(plan.assignments, [{ id: 'b', code: 'SGP-000041' }]);
    assert.equal(plan.lastValue, 41);
    assert.throws(() => planCodeBackfill('product', [], -1), RangeError);
  });

  it('handles an empty collection', () => {
    assert.deepEqual(planCodeBackfill('order', []), {
      assignments: [],
      alreadyCoded: 0,
      unrecognised: [],
      lastValue: 0,
    });
  });
});
