/**
 * Run with:
 *   pnpm --filter api exec tsx --test src/modules/developer/resources.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ApiError, describeError } from './api-error';
import {
  customerResource,
  inventoryResource,
  orderResource,
  paymentResource,
  productResource,
  refundResource,
  returnResource,
  stockMovementResource,
} from './resources';

const id = '66f0a1b2c3d4e5f6a7b8c9d0';
const at = new Date('2026-10-07T02:00:00.000Z');

describe('resources', () => {
  it('a product is identified by its product code and shows its variants', () => {
    const product = productResource({
      _id: id, productCode: 'SGP-000217', name: 'Classic Cotton T-Shirt', slug: 'classic-cotton-t-shirt', description: 'Soft.', brand: 'SgBasics',
      category: { _id: 'c1', name: 'Mens Shirts', slug: 'mens-shirts' }, images: ['https://x.public.blob.vercel-storage.com/products/a.png'],
      variants: [{ sku: 'SGP-000217-01', title: 'Black / M', price: 950, compareAtPrice: 1100, active: true, attributes: { color: 'Black' } }],
      active: true, lastVariantNumber: 1, catalogSource: 'dummyjson', externalId: '12', createdAt: at, updatedAt: at, __v: 3,
    });

    assert.deepEqual(product, {
      id: 'SGP-000217', object: 'product', name: 'Classic Cotton T-Shirt', slug: 'classic-cotton-t-shirt', description: 'Soft.', brand: 'SgBasics',
      category: { id: 'mens-shirts', name: 'Mens Shirts' }, images: ['https://x.public.blob.vercel-storage.com/products/a.png'],
      variants: [{ sku: 'SGP-000217-01', title: 'Black / M', price: 950, compare_at_price: 1100, attributes: { color: 'Black' }, active: true }],
      currency: 'BDT', active: true, created_at: '2026-10-07T02:00:00.000Z', updated_at: '2026-10-07T02:00:00.000Z',
    });
  });

  it('stock shows on hand, reserved and what can still be sold', () => {
    const level = inventoryResource({ _id: id, sku: 'SGP-000217-01', productId: 'p', productName: 'Tee', variantTitle: 'Black / M', onHand: 25, reserved: 4, reorderLevel: 5, appliedAdjustments: ['k1'], updatedAt: at });

    assert.deepEqual(level, { sku: 'SGP-000217-01', object: 'inventory_level', product_name: 'Tee', variant_title: 'Black / M', on_hand: 25, reserved: 4, available: 21, reorder_level: 5, updated_at: '2026-10-07T02:00:00.000Z' });
    assert.equal(inventoryResource({ sku: 'X', onHand: 1, reserved: 3 }).available, 0);
    assert.deepEqual(stockMovementResource({ sku: 'X', delta: -2, reason: 'order_placed', reference: 'SGO-0001001', resultingOnHand: 8, idempotencyKey: 'secret-key', createdAt: at }),
      { object: 'stock_movement', sku: 'X', delta: -2, reason: 'order_placed', reference: 'SGO-0001001', resulting_on_hand: 8, created_at: '2026-10-07T02:00:00.000Z' });
  });

  it('an order is identified by its order number and carries lines and history, but not the payment evidence', () => {
    const order = orderResource({
      _id: id, orderNumber: 'SGO-0001001', idempotencyKey: 'do-not-expose', customerId: id, status: 'shipped', paymentMethod: 'sslcommerz', paymentStatus: 'paid',
      currency: 'BDT', subtotal: 950, shippingFee: 80, total: 1030, trackingNumber: 'PATHAO-778',
      customer: { name: 'Rahim Uddin', phone: '01711000001', email: 'rahim@example.com' },
      shippingAddress: { addressLine1: 'House 12', addressLine2: '', city: 'Dhaka', area: 'Dhanmondi', postalCode: '1209', zone: 'inside_dhaka' },
      items: [{ productId: 'internal', productCode: 'SGP-000217', productSlug: 'tee', productName: 'Tee', sku: 'SGP-000217-01', variantTitle: 'Black / M', unitPrice: 950, quantity: 1, lineTotal: 950 }],
      payment: { provider: 'sslcommerz', bankTranId: 'BANK-1', channel: 'BKASH-BKash', amount: 1030, paidAt: at },
      statusHistory: [{ status: 'pending', paymentStatus: 'pending', trackingNumber: '', changedBy: 'guest', at }],
      createdAt: at, updatedAt: at,
    });

    assert.equal(order.id, 'SGO-0001001');
    assert.equal(order.object, 'order');
    assert.deepEqual([order.status, order.payment_method, order.payment_status, order.total, order.tracking_number], ['shipped', 'sslcommerz', 'paid', 1030, 'PATHAO-778']);
    assert.deepEqual(order.customer, { id: `cus_${id}`, name: 'Rahim Uddin', phone: '01711000001', email: 'rahim@example.com' });
    assert.deepEqual(order.shipping_address, { address_line1: 'House 12', address_line2: '', district: 'Dhaka', area: 'Dhanmondi', postal_code: '1209', delivery_zone: 'inside_dhaka' });
    assert.deepEqual(order.lines, [{ product_id: 'SGP-000217', sku: 'SGP-000217-01', product_name: 'Tee', variant_title: 'Black / M', unit_price: 950, quantity: 1, line_total: 950 }]);
    // a change made by a person carries no application or request
    assert.deepEqual(order.history, [{ status: 'pending', payment_status: 'pending', tracking_number: '', actor: 'guest', actor_type: null, actor_id: null, request_id: null, at: '2026-10-07T02:00:00.000Z' }]);

    // a change made through this API names the application and the request
    const viaApi = orderResource({ orderNumber: 'SGO-0001001', statusHistory: [{ status: 'cancelled', paymentStatus: 'pending', trackingNumber: '', changedBy: 'Warehouse ERP', actorType: 'api_application', actorId: 'app_3f9a1c2b4d5e6f70', requestId: 'req_5f1c2d3e4a5b6c7d8e9f0a1b', at }] });
    assert.deepEqual(viaApi.history[0], { status: 'cancelled', payment_status: 'pending', tracking_number: '', actor: 'Warehouse ERP', actor_type: 'api_application', actor_id: 'app_3f9a1c2b4d5e6f70', request_id: 'req_5f1c2d3e4a5b6c7d8e9f0a1b', at: '2026-10-07T02:00:00.000Z' });

    const text = JSON.stringify(order);
    for (const hidden of ['do-not-expose', 'BANK-1', '"_id"', 'internal', 'idempotency']) {
      assert.ok(!text.includes(hidden), `${hidden} must not be exposed`);
    }
  });

  it('an older order without history, customer link or payment method still has a complete shape', () => {
    const order = orderResource({ orderNumber: 'SG-20261004-K3J9QZ', status: 'pending', paymentStatus: 'pending', total: 1710, customer: { name: 'Karim', phone: '01811000002' }, items: [{ sku: 'FS-0020-STD', quantity: 1 }] });

    assert.equal(order.payment_method, 'cod');
    assert.equal(order.customer.id, null);
    assert.equal(order.lines[0].product_id, null);
    assert.deepEqual(order.history, []);
    assert.equal(order.created_at, null);
  });

  it('a payment shows its state and channel, never the gateway\'s keys, validation ids or card numbers', () => {
    const payment = paymentResource({
      _id: id, orderNumber: 'SGO-0001001', provider: 'sslcommerz', tranId: 'SGO-0001001', amount: 1030, currency: 'BDT', status: 'paid', sandbox: true,
      sessionKey: 'SESSION-SECRET', gatewayUrl: 'https://sandbox.sslcommerz.com/x', valId: 'VAL-SECRET', bankTranId: 'BANK-SECRET', cardType: 'BKASH-BKash', cardNo: '425272XXXXXX3456',
      storeAmount: 1004.25, riskLevel: '0', problem: '', paidAt: at, events: [{ at, source: 'ipn', note: 'x' }], createdAt: at, updatedAt: at,
    });

    assert.deepEqual(payment, { id: `pay_${id}`, object: 'payment', order_id: 'SGO-0001001', provider: 'sslcommerz', status: 'paid', amount: 1030, currency: 'BDT', channel: 'BKASH-BKash', paid_at: '2026-10-07T02:00:00.000Z', sandbox: true, created_at: '2026-10-07T02:00:00.000Z', updated_at: '2026-10-07T02:00:00.000Z' });

    const text = JSON.stringify(payment);
    for (const hidden of ['SESSION-SECRET', 'VAL-SECRET', 'BANK-SECRET', '425272', 'sandbox.sslcommerz.com', '1004.25']) {
      assert.ok(!text.includes(hidden), `${hidden} must not be exposed`);
    }
  });

  it('a customer, a return and a refund use their public identifiers', () => {
    const customer = customerResource({ _id: id, name: 'Rahim', phone: '01711000001', email: '', active: true, addresses: [{ id: 'a1', label: 'Home', addressLine1: 'House 12', addressLine2: '', city: 'Pabna', area: '', postalCode: '6620', zone: 'outside_dhaka', isDefault: true }], createdAt: at });
    assert.equal(customer.id, `cus_${id}`);
    assert.deepEqual(customer.addresses[0], { id: 'a1', label: 'Home', address_line1: 'House 12', address_line2: '', district: 'Pabna', area: '', postal_code: '6620', delivery_zone: 'outside_dhaka', is_default: true });

    const request = returnResource({ returnNumber: 'SGR-000001', orderNumber: 'SGO-0001001', customerPhone: '01711000001', status: 'requested', reason: 'wrong_size', details: '', refundAmount: 950, restocked: false, items: [{ sku: 'SGP-000217-01', productName: 'Tee', variantTitle: 'Black / M', quantity: 1, unitPrice: 950, refundAmount: 950 }] });
    assert.deepEqual([request.id, request.order_id, request.status, request.refund_amount, request.items.length], ['SGR-000001', 'SGO-0001001', 'requested', 950, 1]);

    const refund = refundResource({ refundNumber: 'SGF-000001', returnNumber: 'SGR-000001', orderNumber: 'SGO-0001001', customerPhone: '01711000001', amount: 950, currency: 'BDT', method: 'cash', status: 'pending', note: '' });
    assert.deepEqual([refund.id, refund.return_id, refund.order_id, refund.amount, refund.status], ['SGF-000001', 'SGR-000001', 'SGO-0001001', 950, 'pending']);
  });
});

describe('errors', () => {
  it('an API error keeps its status, code, message and details', () => {
    assert.deepEqual(describeError(new ApiError(404, 'order_not_found', 'No order with that id exists.')), { status: 404, code: 'order_not_found', message: 'No order with that id exists.' });
    assert.deepEqual(describeError(new ApiError(403, 'insufficient_scope', 'Missing scope.', { required_scope: 'orders:read' })), { status: 403, code: 'insufficient_scope', message: 'Missing scope.', details: { required_scope: 'orders:read' } });
  });

  it('an unexpected failure never reveals what went wrong inside', () => {
    const error = describeError(new Error('E11000 duplicate key error collection: test.orders index: orderNumber_1'));

    assert.equal(error.status, 500);
    assert.equal(error.code, 'internal_error');
    assert.ok(!error.message.includes('E11000'));
    assert.deepEqual(describeError('a string was thrown').code, 'internal_error');
    assert.deepEqual(describeError(undefined).status, 500);
  });
});
