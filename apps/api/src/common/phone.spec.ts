/**
 * Run with:
 *   pnpm --filter api exec tsx --test src/common/phone.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isStoredPhoneFormat,
  maskPhone,
  normalizePhone,
  planCustomerPhones,
  planPhoneUpdates,
} from './phone';

describe('normalizePhone', () => {
  it('stores every way of typing a Bangladesh mobile number as 01XXXXXXXXX', () => {
    for (const typed of [
      '01711000001',
      ' 01711 000 001 ',
      '01711-000001',
      '+8801711000001',
      '+880 1711-000001',
      '+880 (1711) 000001',
      '8801711000001',
      '008801711000001',
      '+88001711000001',
      '1711000001',
      '017.11.000001',
      '\u09e6\u09e7\u09ed\u09e7\u09e7\u09e6\u09e6\u09e6\u09e6\u09e6\u09e7',
      '+\u09ee\u09ee\u09e6\u09e7\u09ed\u09e7\u09e7\u09e6\u09e6\u09e6\u09e6\u09e6\u09e7',
    ]) {
      assert.equal(normalizePhone(typed), '01711000001', JSON.stringify(typed));
    }
  });

  it('accepts every current operator prefix (013 to 019)', () => {
    for (const prefix of ['013', '014', '015', '016', '017', '018', '019']) {
      assert.equal(normalizePhone(`+88${prefix}12345678`), `${prefix}12345678`);
    }
  });

  it('leaves anything that is not a Bangladesh mobile number as it was before', () => {
    assert.equal(normalizePhone(' +1 415 555 2671 '), '+14155552671');
    assert.equal(normalizePhone('02-9123456'), '02-9123456');
    assert.equal(normalizePhone('0171100000'), '0171100000'); // one digit short
    assert.equal(normalizePhone('017110000012'), '017110000012'); // one digit too many
    assert.equal(normalizePhone('01211000001'), '01211000001'); // 012 is not a mobile prefix
    assert.equal(normalizePhone('call me'), 'callme');
    assert.equal(normalizePhone('01711000001 ext 5'), '01711000001ext5');
    assert.equal(normalizePhone(''), '');
    assert.equal(normalizePhone('+880'), '+880');
  });

  it('gives the same result when applied twice', () => {
    for (const typed of ['+880 1711-000001', '+1 415 555 2671', '02-9123456', 'call me', '']) {
      const once = normalizePhone(typed);

      assert.equal(normalizePhone(once), once);
    }
  });
});

describe('isStoredPhoneFormat', () => {
  it('is true only when nothing would change', () => {
    assert.equal(isStoredPhoneFormat('01711000001'), true);
    assert.equal(isStoredPhoneFormat('+14155552671'), true);
    assert.equal(isStoredPhoneFormat('+8801711000001'), false);
    assert.equal(isStoredPhoneFormat('01711 000001'), false);
  });
});

describe('planPhoneUpdates', () => {
  it('rewrites only the numbers that are not in the stored format yet', () => {
    const plan = planPhoneUpdates(
      [
        { id: 'a', phone: '+8801711000001' },
        { id: 'b', phone: '01811000002' },
        { id: 'c', phone: '8801911 000003' },
        { id: 'd', phone: '+14155552671' },
        { id: 'e', phone: undefined },
        { id: 'f', phone: 123 },
      ],
      false,
    );

    assert.deepEqual(plan.updates, [
      { id: 'a', from: '+8801711000001', to: '01711000001' },
      { id: 'c', from: '8801911 000003', to: '01911000003' },
    ]);
    assert.deepEqual(plan.conflicts, []);
  });

  it('where phones must be unique, leaves a record alone if another one already has the number', () => {
    const plan = planPhoneUpdates(
      [
        { id: 'old', phone: '+8801711000001' },
        { id: 'new', phone: '01711000001' },
        { id: 'x', phone: '+8801811000002' },
        { id: 'y', phone: '8801811000002' },
      ],
      true,
    );

    assert.deepEqual(plan.updates, [{ id: 'x', from: '+8801811000002', to: '01811000002' }]);
    assert.deepEqual(plan.conflicts, [
      { id: 'old', from: '+8801711000001', to: '01711000001' },
      { id: 'y', from: '8801811000002', to: '01811000002' },
    ]);
  });

  it('where phones need not be unique (orders), rewrites every one of them', () => {
    const plan = planPhoneUpdates(
      [
        { id: 'o1', phone: '+8801711000001' },
        { id: 'o2', phone: '+8801711000001' },
        { id: 'o3', phone: '01711000001' },
      ],
      false,
    );

    assert.equal(plan.updates.length, 2);
    assert.deepEqual(plan.conflicts, []);
  });

  it('plans nothing when run on its own output', () => {
    const docs = [{ id: 'a', phone: '+8801711000001' }, { id: 'b', phone: '01811000002' }];
    const first = planPhoneUpdates(docs, true);
    const after = docs.map((doc) => ({ id: doc.id, phone: first.updates.find((u) => u.id === doc.id)?.to ?? doc.phone }));

    assert.deepEqual(planPhoneUpdates(after, true), { updates: [], conflicts: [] });
  });
});

describe('planCustomerPhones', () => {
  it('only rewrites the format when each customer is stored once', () => {
    const plan = planCustomerPhones([
      { id: 'a', phone: '+8801711000001', hasAccount: true },
      { id: 'b', phone: '01811000002', hasAccount: false },
      { id: 'c', phone: '+14155552671', hasAccount: false },
      { id: 'd', phone: undefined, hasAccount: false },
    ]);

    assert.deepEqual(plan, {
      rewrites: [{ id: 'a', from: '+8801711000001', to: '01711000001' }],
      merges: [],
      blocked: [],
    });
  });

  it('merges a customer saved twice, keeping the record that has an account', () => {
    const plan = planCustomerPhones([
      { id: 'guest', phone: '01711000001', hasAccount: false },
      { id: 'account', phone: '+8801711000001', hasAccount: true },
    ]);

    assert.deepEqual(plan.merges, [
      { phone: '01711000001', keepId: 'account', keepPhone: '+8801711000001', removeIds: ['guest'] },
    ]);
    assert.deepEqual(plan.rewrites, []);
    assert.deepEqual(plan.blocked, []);
  });

  it('with no account on either, keeps the record already in the stored format', () => {
    const plan = planCustomerPhones([
      { id: 'plus', phone: '+8801711000001', hasAccount: false },
      { id: 'plain', phone: '01711000001', hasAccount: false },
      { id: 'bare', phone: '8801711000001', hasAccount: false },
    ]);

    assert.deepEqual(plan.merges, [
      { phone: '01711000001', keepId: 'plain', keepPhone: '01711000001', removeIds: ['plus', 'bare'] },
    ]);
  });

  it('with no account and none in the stored format, keeps the first (oldest) record', () => {
    const plan = planCustomerPhones([
      { id: 'older', phone: '+8801711000001', hasAccount: false },
      { id: 'newer', phone: '8801711000001', hasAccount: false },
    ]);

    assert.deepEqual(plan.merges, [
      { phone: '01711000001', keepId: 'older', keepPhone: '+8801711000001', removeIds: ['newer'] },
    ]);
  });

  it('leaves the records alone when two of them have their own account', () => {
    const plan = planCustomerPhones([
      { id: 'one', phone: '+8801711000001', hasAccount: true },
      { id: 'two', phone: '01711000001', hasAccount: true },
      { id: 'three', phone: '8801711000001', hasAccount: false },
    ]);

    assert.deepEqual(plan.blocked, [{ phone: '01711000001', ids: ['one', 'two', 'three'] }]);
    assert.deepEqual(plan.merges, []);
    assert.deepEqual(plan.rewrites, []);
  });

  it('plans nothing once the plan has been carried out', () => {
    const after = [
      { id: 'account', phone: '01711000001', hasAccount: true },
      { id: 'b', phone: '01811000002', hasAccount: false },
    ];

    assert.deepEqual(planCustomerPhones(after), { rewrites: [], merges: [], blocked: [] });
  });
});

describe('maskPhone', () => {
  it('keeps the first four and last four characters', () => {
    assert.equal(maskPhone('01711000001'), '0171\u2022\u2022\u20220001');
    assert.equal(maskPhone('+8801711000001'), '+880\u2022\u2022\u2022\u2022\u2022\u20220001');
    assert.equal(maskPhone('12345'), '12345');
  });
});
