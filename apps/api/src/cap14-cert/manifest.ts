/**
 * Machine-readable CAP-14 manifest: what the seed creates and what the
 * certification oracle (SupGent harness) may assert. No secrets, no absolute
 * dates (they are relative to the seed run: `days_ago`).
 */
import {
  CAP14_FIXTURE_VERSION,
  CAP14_RETURN_WINDOW_DAYS,
  type Cap14Fixtures,
  orderTotals,
} from './fixtures';

export function buildCap14Manifest(fixtures: Cap14Fixtures) {
  const customersByRef = new Map(fixtures.customers.map((item) => [item.ref, item]));
  return {
    schema: 'sgcommerce-cap14-cert-manifest/1',
    fixture_version: CAP14_FIXTURE_VERSION,
    currency: 'BDT',
    database_marker: 'cap14_cert',
    supgent_return_policy: {
      return_window_days: CAP14_RETURN_WINDOW_DAYS,
      published_text: `Returns are accepted within ${CAP14_RETURN_WINDOW_DAYS} days of delivery.`,
      note: 'SGCommerce itself only requires status=delivered; the window is SupGent policy.',
    },
    categories: fixtures.categories.map((item) => ({ id: item.slug, name: item.name })),
    products: fixtures.products.map((item) => ({
      product_ref: item.ref,
      developer_api_id: item.ref,
      name: item.name,
      slug: item.slug,
      category: fixtures.categories.find((category) => category.ref === item.categoryRef)?.slug,
      brand: item.brand,
      active: item.active,
      cases: item.cases,
      variants: item.variants.map((variant) => ({
        sku: variant.sku,
        title: variant.title,
        attributes: variant.attributes,
        price: variant.price,
        compare_at_price: variant.compareAtPrice ?? null,
        active: variant.active,
        on_hand: variant.onHand,
        reserved: 0,
        available: variant.onHand,
        reorder_level: variant.reorderLevel,
        low_stock: variant.onHand > 0 && variant.onHand <= variant.reorderLevel,
        out_of_stock: variant.onHand === 0,
      })),
    })),
    customers: fixtures.customers.map((item) => ({
      customer_ref: item.ref,
      developer_api_id: `cus_${item.idHex}`,
      name: item.name,
      email: item.email,
      phone: item.phone,
      order_refs: fixtures.orders.filter((order) => order.customerRef === item.ref).map((order) => order.ref),
    })),
    orders: fixtures.orders.map((item) => {
      const totals = orderTotals(fixtures, item);
      const delivered = item.history.find((entry) => entry.status === 'delivered');
      return {
        order_ref: item.ref,
        order_number: item.orderNumber,
        customer_ref: item.customerRef,
        customer_email: customersByRef.get(item.customerRef)?.email,
        initial_status: item.status,
        payment_method: item.paymentMethod,
        payment_status: item.paymentStatus,
        tracking_number: item.trackingNumber || null,
        delivered_days_ago: delivered ? delivered.daysAgo : null,
        return_eligible_by_supgent_policy: item.returnEligibleBySupgentPolicy,
        subtotal: totals.subtotal,
        shipping_fee: item.shippingFee,
        total: totals.total,
        lines: totals.lines.map((line) => ({
          product_ref: line.productRef, sku: line.sku, quantity: line.quantity,
          unit_price: line.variant.price, line_total: line.lineTotal,
        })),
        cases: item.cases,
      };
    }),
    payments: fixtures.payments.map((item) => ({
      payment_ref: item.ref, tran_id: item.tranId, order_ref: item.orderRef, provider: item.provider,
      status: item.status, sandbox: item.sandbox, cases: item.cases,
    })),
    returns: fixtures.returns.map((item) => ({
      return_ref: item.ref, return_number: item.returnNumber, order_ref: item.orderRef, sku: item.sku,
      quantity: item.quantity, status: item.status,
    })),
    refunds: fixtures.refunds.map((item) => ({
      refund_ref: item.ref, refund_number: item.refundNumber, return_ref: item.returnRef, method: item.method,
      status: item.status, moves_money: false,
    })),
  };
}

export type Cap14Manifest = ReturnType<typeof buildCap14Manifest>;
