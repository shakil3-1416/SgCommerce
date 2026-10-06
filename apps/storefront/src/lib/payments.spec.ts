/**
 * Run with (tsx is installed in the api workspace):
 *   pnpm --filter api exec tsx --test ../storefront/src/lib/payments.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canPayOnline,
  CASH_ON_DELIVERY_ONLY,
  confirmationView,
  paymentMethodLabel,
  paymentStatusLabel,
  readPaymentMethods,
} from './payments';

describe('readPaymentMethods', () => {
  it('reads the API answer', () => {
    assert.deepEqual(readPaymentMethods({ cod: true, online: true, sandbox: true, minimum: 10, maximum: 500000 }), {
      cod: true, online: true, sandbox: true, minimum: 10, maximum: 500000,
    });
  });

  it('falls back to cash on delivery only for anything unexpected', () => {
    for (const value of [null, undefined, 'error', 42, {}, { online: 'yes' }, { message: 'Not found' }]) {
      assert.equal(readPaymentMethods(value).online, false, JSON.stringify(value));
      assert.equal(readPaymentMethods(value).cod, true);
    }
    assert.deepEqual(readPaymentMethods({ online: true, minimum: 'x', maximum: null }), { ...CASH_ON_DELIVERY_ONLY, online: true, maximum: 0 });
  });
});

describe('canPayOnline', () => {
  const methods = { cod: true, online: true, sandbox: false, minimum: 10, maximum: 500000 };

  it('needs online payment to be on and the total to be within the limits', () => {
    assert.equal(canPayOnline(methods, 1030), true);
    assert.equal(canPayOnline(methods, 10), true);
    assert.equal(canPayOnline(methods, 500000), true);
    assert.equal(canPayOnline(methods, 9), false);
    assert.equal(canPayOnline(methods, 500001), false);
    assert.equal(canPayOnline(CASH_ON_DELIVERY_ONLY, 1030), false);
  });
});

describe('paymentMethodLabel', () => {
  it('names the two methods, and treats anything else as cash on delivery', () => {
    assert.equal(paymentMethodLabel('sslcommerz'), 'Online payment');
    assert.equal(paymentMethodLabel('cod'), 'Cash on delivery');
    assert.equal(paymentMethodLabel(undefined), 'Cash on delivery');
  });
});

describe('paymentStatusLabel', () => {
  it('describes where the payment stands', () => {
    assert.equal(paymentStatusLabel('cod', 'pending'), 'Not paid yet');
    assert.equal(paymentStatusLabel('sslcommerz', 'pending'), 'Awaiting payment');
    assert.equal(paymentStatusLabel('cod', 'paid'), 'Paid');
    assert.equal(paymentStatusLabel('sslcommerz', 'paid'), 'Paid');
    assert.equal(paymentStatusLabel('sslcommerz', 'failed'), 'Payment failed');
    assert.equal(paymentStatusLabel('sslcommerz', 'refunded'), 'Refunded');
    assert.equal(paymentStatusLabel('cod', 'cancelled'), 'Cancelled');
  });
});

describe('confirmationView', () => {
  it('goes by what the API reports about the order', () => {
    assert.equal(confirmationView({ status: 'pending', paymentMethod: 'cod', paymentStatus: 'pending' }), 'placed');
    assert.equal(confirmationView({ status: 'pending', paymentMethod: 'sslcommerz', paymentStatus: 'paid' }), 'paid');
    assert.equal(confirmationView({ status: 'confirmed', paymentMethod: 'sslcommerz', paymentStatus: 'paid' }), 'paid');
    assert.equal(confirmationView({ status: 'cancelled', paymentMethod: 'sslcommerz', paymentStatus: 'failed' }), 'not-completed');
    assert.equal(confirmationView({ status: 'cancelled', paymentMethod: 'sslcommerz', paymentStatus: 'cancelled' }), 'not-completed');
    assert.equal(confirmationView({ status: 'cancelled', paymentMethod: 'sslcommerz', paymentStatus: 'paid' }), 'cancelled-after-payment');
    assert.equal(confirmationView({ status: 'cancelled', paymentMethod: 'sslcommerz', paymentStatus: 'refunded' }), 'cancelled-after-payment');
    assert.equal(confirmationView({ status: 'pending', paymentMethod: 'sslcommerz', paymentStatus: 'pending' }), 'confirming');
    assert.equal(confirmationView(null), 'unknown');
  });
});
