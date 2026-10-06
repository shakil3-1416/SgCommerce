/**
 * Run with (tsx is installed in the api workspace):
 *   pnpm --filter api exec tsx --test ../admin/src/lib/order-payment.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { describePayment } from './order-payment';

const when = (value: unknown) => (value ? '6 Oct 2026, 14:05' : '');
const payment = { channel: 'BKASH-BKash', bankTranId: 'BANK-1', amount: 1030, paidAt: '2026-10-06T08:05:00Z', riskLevel: '0', riskTitle: 'Safe', sandbox: false };

describe('describePayment', () => {
  it('describes cash on delivery as before, with nothing to do', () => {
    const d = describePayment({ status: 'pending', paymentMethod: 'cod', paymentStatus: 'pending', total: 1030 }, when);
    assert.deepEqual(d, { method: 'Cash on delivery', status: 'To collect on delivery', short: 'Cash on delivery · To collect on delivery', details: [], notice: null, canCheck: false, canMarkRefunded: false });
    assert.equal(describePayment({ status: 'delivered', paymentMethod: 'cod', paymentStatus: 'paid' }, when).status, 'Paid');
    // orders placed before payment methods existed
    assert.equal(describePayment({ status: 'pending', paymentStatus: 'pending' }, when).method, 'Cash on delivery');
  });

  it('shows how an online order was paid', () => {
    const d = describePayment({ status: 'pending', paymentMethod: 'sslcommerz', paymentStatus: 'paid', total: 1030, payment }, when);
    assert.equal(d.method, 'Online payment (SSLCOMMERZ)');
    assert.equal(d.short, 'Online · Paid');
    assert.deepEqual(d.details, ['Paid with BKASH-BKash', 'Bank transaction BANK-1', 'Confirmed 6 Oct 2026, 14:05']);
    assert.equal(d.notice, null);
    assert.equal(d.canCheck, false);
    assert.equal(d.canMarkRefunded, false);
  });

  it('says clearly when a payment was only a test', () => {
    const d = describePayment({ status: 'pending', paymentMethod: 'sslcommerz', paymentStatus: 'paid', payment: { ...payment, sandbox: true } }, when);
    assert.ok(d.details.includes('Test payment: no real money was taken'));
  });

  it('explains an unpaid online order and offers to ask SSLCOMMERZ', () => {
    const d = describePayment({ status: 'pending', paymentMethod: 'sslcommerz', paymentStatus: 'pending', total: 1030 }, when);
    assert.equal(d.status, 'Not paid yet');
    assert.equal(d.notice?.tone, 'info');
    assert.match(d.notice!.text, /cannot be confirmed until it is paid/);
    assert.equal(d.canCheck, true);
    assert.equal(d.canMarkRefunded, false);
  });

  it('asks for a refund when a paid online order is cancelled, and stops asking once it is refunded', () => {
    const due = describePayment({ status: 'cancelled', paymentMethod: 'sslcommerz', paymentStatus: 'paid', total: 1030, payment }, when);
    assert.equal(due.notice?.tone, 'action');
    assert.match(due.notice!.text, /Refund due: ৳1030\./);
    assert.equal(due.canMarkRefunded, true);

    const done = describePayment({ status: 'cancelled', paymentMethod: 'sslcommerz', paymentStatus: 'refunded', total: 1030, payment }, when);
    assert.equal(done.status, 'Refunded');
    assert.equal(done.notice, null);
    assert.equal(done.canMarkRefunded, false);
    assert.equal(done.canCheck, false);
  });

  it('warns about a payment the gateway marked as risky', () => {
    const d = describePayment({ status: 'pending', paymentMethod: 'sslcommerz', paymentStatus: 'paid', payment: { ...payment, riskLevel: '1', riskTitle: 'Not Safe' } }, when);
    assert.equal(d.notice?.tone, 'warning');
    assert.match(d.notice!.text, /risky \(Not Safe\)\. Verify the customer before you ship\./);
  });

  it('explains an order cancelled by a failed payment, and still lets the merchant check', () => {
    const d = describePayment({ status: 'cancelled', paymentMethod: 'sslcommerz', paymentStatus: 'failed' }, when);
    assert.equal(d.status, 'Payment failed');
    assert.match(d.notice!.text, /cancelled automatically/);
    assert.equal(d.canCheck, true);
  });
});
