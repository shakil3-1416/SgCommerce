/**
 * Run with:
 *   pnpm --filter api exec tsx --test src/modules/payments/sslcommerz.spec.ts
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  buildSessionFields,
  formatAmount,
  isWithinOnlinePaymentLimits,
  outcomeForStatus,
  sameAmount,
  verifySign,
  whyNotPaid,
} from './sslcommerz';

const config = {
  storeId: 'testbox',
  storePassword: 'qwerty',
  live: false,
  apiUrl: 'https://api.example.com/api/v1',
  storefrontUrl: 'https://shop.example.com',
};

const order = {
  orderNumber: 'SGO-0001001',
  total: 1030,
  customer: { name: 'Rahim Uddin', phone: '01711000001', email: 'rahim@example.com' },
  shippingAddress: { addressLine1: 'House 12, Road 5', addressLine2: 'Flat B3', city: 'Dhaka', area: 'Dhanmondi', postalCode: '1209' },
  items: [
    { productName: 'Classic Cotton T-Shirt', quantity: 2 },
    { productName: 'Wireless Headphones', quantity: 1 },
  ],
};

describe('online payment limits', () => {
  it('accepts 10.00 to 500000.00 BDT', () => {
    assert.equal(isWithinOnlinePaymentLimits(10), true);
    assert.equal(isWithinOnlinePaymentLimits(500000), true);
    assert.equal(isWithinOnlinePaymentLimits(9.99), false);
    assert.equal(isWithinOnlinePaymentLimits(500000.01), false);
    assert.equal(isWithinOnlinePaymentLimits(Number.NaN), false);
  });
});

describe('amounts', () => {
  it('are sent with two decimals', () => {
    assert.equal(formatAmount(1030), '1030.00');
    assert.equal(formatAmount(55.4), '55.40');
  });

  it('are compared to the paisa, as numbers or as gateway strings', () => {
    assert.equal(sameAmount('1030.00', 1030), true);
    assert.equal(sameAmount('1030', 1030), true);
    assert.equal(sameAmount(0.1 + 0.2, 0.3), true);
    assert.equal(sameAmount('1029.99', 1030), false);
    assert.equal(sameAmount('1030.01', 1030), false);
    assert.equal(sameAmount('abc', 1030), false);
    assert.equal(sameAmount(undefined, 1030), false);
  });
});

describe('buildSessionFields', () => {
  const fields = buildSessionFields(config, order);

  it('uses the order number as the transaction id and BDT with two decimals', () => {
    assert.equal(fields.tran_id, 'SGO-0001001');
    assert.equal(fields.value_a, 'SGO-0001001');
    assert.equal(fields.total_amount, '1030.00');
    assert.equal(fields.currency, 'BDT');
    assert.equal(fields.store_id, 'testbox');
    assert.equal(fields.store_passwd, 'qwerty');
  });

  it('points every callback at this API', () => {
    assert.equal(fields.success_url, 'https://api.example.com/api/v1/payments/sslcommerz/success');
    assert.equal(fields.fail_url, 'https://api.example.com/api/v1/payments/sslcommerz/fail');
    assert.equal(fields.cancel_url, 'https://api.example.com/api/v1/payments/sslcommerz/cancel');
    assert.equal(fields.ipn_url, 'https://api.example.com/api/v1/payments/sslcommerz/ipn');
  });

  it('fills every field the integration document marks as mandatory', () => {
    for (const key of [
      'store_id', 'store_passwd', 'total_amount', 'currency', 'tran_id', 'success_url', 'fail_url', 'cancel_url',
      'cus_name', 'cus_email', 'cus_add1', 'cus_city', 'cus_postcode', 'cus_country', 'cus_phone',
      'shipping_method', 'num_of_item', 'ship_name', 'ship_add1', 'ship_city', 'ship_postcode', 'ship_country',
      'product_name', 'product_category', 'product_profile',
    ]) {
      assert.ok(fields[key] !== undefined && fields[key] !== '', `${key} is empty`);
    }

    assert.equal(fields.num_of_item, '3');
    assert.equal(fields.product_profile, 'physical-goods');
    assert.equal(fields.product_name, 'Classic Cotton T-Shirt, Wireless Headphones');
  });

  it('copes with a guest who gave no email, postcode or area', () => {
    const guest = buildSessionFields(config, {
      ...order,
      customer: { name: 'Karim', phone: '01811000002' },
      shippingAddress: { addressLine1: 'Station Road', city: 'Pabna' },
    });

    assert.equal(guest.cus_email, 'no-email@example.com');
    assert.equal(guest.cus_postcode, '0000');
    assert.equal(guest.ship_area, 'Pabna');
    assert.equal(guest.cus_add2, '');
  });

  it('keeps every value within the documented length', () => {
    const long = buildSessionFields(config, {
      ...order,
      customer: { name: 'N'.repeat(120), phone: '0'.repeat(40), email: `${'e'.repeat(80)}@example.com` },
      shippingAddress: { addressLine1: 'A'.repeat(300), city: 'C'.repeat(90), area: 'R'.repeat(90), postalCode: '9'.repeat(60) },
      items: [{ productName: 'P'.repeat(400), quantity: 1 }],
    });

    assert.equal(long.cus_name.length, 50);
    assert.equal(long.cus_email.length, 50);
    assert.equal(long.cus_add1.length, 50);
    assert.equal(long.cus_city.length, 50);
    assert.equal(long.cus_phone.length, 20);
    assert.equal(long.cus_postcode.length, 30);
    assert.equal(long.product_name.length, 255);
    assert.ok(long.tran_id.length <= 30);
  });
});

describe('verifySign', () => {
  /* Builds a notification signed the way SSLCOMMERZ's own libraries verify it. */
  function signed(fields: Record<string, string>, password: string) {
    const all: Record<string, string> = { ...fields, store_passwd: createHash('md5').update(password).digest('hex') };
    const text = Object.keys(all).sort().map((key) => `${key}=${all[key]}`).join('&');

    return {
      ...fields,
      verify_key: Object.keys(fields).join(','),
      verify_sign: createHash('md5').update(text).digest('hex'),
    };
  }

  const notification = signed(
    { tran_id: 'SGO-0001001', val_id: '1711231900331kHP17lnrr9T8Gt', amount: '1030.00', status: 'VALID', currency: 'BDT', value_a: 'SGO-0001001', value_b: '' },
    'qwerty',
  );

  it('accepts a notification signed with the store password', () => {
    assert.equal(verifySign(notification, 'qwerty'), true);
    assert.equal(verifySign({ ...notification, verify_sign: notification.verify_sign.toUpperCase() }, 'qwerty'), true);
  });

  it('rejects a changed field, a wrong password, or a missing signature', () => {
    assert.equal(verifySign({ ...notification, amount: '1.00' }, 'qwerty'), false);
    assert.equal(verifySign({ ...notification, status: 'FAILED' }, 'qwerty'), false);
    assert.equal(verifySign(notification, 'another-password'), false);
    assert.equal(verifySign({ ...notification, verify_sign: '' }, 'qwerty'), false);
    assert.equal(verifySign({ tran_id: 'SGO-0001001', status: 'FAILED' }, 'qwerty'), false);
    assert.equal(verifySign({ ...notification, verify_key: '' }, 'qwerty'), false);
  });

  it('cannot be satisfied by leaving fields out of the signed list', () => {
    // An attacker who lists no fields would still need the MD5 of the store password.
    const forged = { tran_id: 'SGO-0001001', status: 'FAILED', verify_key: 'tran_id', verify_sign: createHash('md5').update('tran_id=SGO-0001001').digest('hex') };

    assert.equal(verifySign(forged, 'qwerty'), false);
  });
});

describe('outcomeForStatus', () => {
  it('maps the documented statuses', () => {
    assert.equal(outcomeForStatus('VALID'), 'paid');
    assert.equal(outcomeForStatus('VALIDATED'), 'paid');
    assert.equal(outcomeForStatus('FAILED'), 'failed');
    assert.equal(outcomeForStatus('CANCELLED'), 'cancelled');
    assert.equal(outcomeForStatus('EXPIRED'), 'cancelled');
    assert.equal(outcomeForStatus('UNATTEMPTED'), 'cancelled');
    assert.equal(outcomeForStatus('PENDING'), 'pending');
    assert.equal(outcomeForStatus(undefined), 'pending');
  });
});

describe('whyNotPaid', () => {
  const expected = { tranId: 'SGO-0001001', amount: 1030 };
  const good = { status: 'VALID', tran_id: 'SGO-0001001', amount: '1030.00', currency: 'BDT', currency_type: 'BDT', currency_amount: '1030.00' };

  it('accepts a valid payment of the exact amount in BDT, first or repeated validation', () => {
    assert.equal(whyNotPaid(good, expected), '');
    assert.equal(whyNotPaid({ ...good, status: 'VALIDATED' }, expected), '');
  });

  it('refuses anything else, and says why', () => {
    assert.match(whyNotPaid({ ...good, status: 'INVALID_TRANSACTION' }, expected), /INVALID_TRANSACTION/);
    assert.match(whyNotPaid({ ...good, status: 'FAILED' }, expected), /FAILED/);
    assert.match(whyNotPaid({ ...good, tran_id: 'SGO-0001002' }, expected), /different transaction/);
    assert.match(whyNotPaid({ ...good, currency_amount: '10.00', amount: '10.00' }, expected), /does not match the order total/);
    assert.match(whyNotPaid({ ...good, currency_type: 'USD', currency_amount: '1030.00' }, expected), /USD, not BDT/);
    assert.match(whyNotPaid({ ...good, amount: '900.00' }, expected), /amount settled/);
    assert.match(whyNotPaid({}, expected), /nothing/);
  });
});
