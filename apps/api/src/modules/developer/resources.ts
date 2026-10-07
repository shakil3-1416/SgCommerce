import { prefixedId } from './developer-api';

/*
 * The shapes the Developer API returns.
 *
 * These are a contract with outside programs, so they are written out
 * field by field instead of handing over database records. A field that
 * is not listed here is not part of the API: adding a column to the
 * database changes nothing for a developer until it is added here on
 * purpose. Names are snake_case, and a record is identified by its
 * business number (SGP-, SGO-, SGR-, SGF-) wherever it has one.
 */

type Doc = Record<string, any>;

function time(value: unknown): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function list(value: unknown): Doc[] {
  return Array.isArray(value) ? value : [];
}

export function categoryResource(category: Doc) {
  return {
    id: text(category.slug),
    object: 'category' as const,
    name: text(category.name),
    description: text(category.description),
    active: category.active !== false,
  };
}

export function variantResource(variant: Doc) {
  return {
    sku: text(variant.sku),
    title: text(variant.title),
    price: Number(variant.price ?? 0),
    compare_at_price: variant.compareAtPrice === undefined || variant.compareAtPrice === null ? null : Number(variant.compareAtPrice),
    attributes: variant.attributes && typeof variant.attributes === 'object' ? { ...variant.attributes } : {},
    active: variant.active !== false,
  };
}

export function productResource(product: Doc) {
  const category = product.category && typeof product.category === 'object' && 'slug' in product.category ? product.category : null;

  return {
    id: text(product.productCode) || null,
    object: 'product' as const,
    name: text(product.name),
    slug: text(product.slug),
    description: text(product.description),
    brand: text(product.brand),
    category: category ? { id: text(category.slug), name: text(category.name) } : null,
    images: list(product.images).map((image) => String(image)),
    variants: list(product.variants).map(variantResource),
    currency: 'BDT',
    active: product.active !== false,
    created_at: time(product.createdAt),
    updated_at: time(product.updatedAt),
  };
}

export function inventoryResource(record: Doc) {
  const onHand = Number(record.onHand ?? 0);
  const reserved = Number(record.reserved ?? 0);

  return {
    sku: text(record.sku),
    object: 'inventory_level' as const,
    product_name: text(record.productName),
    variant_title: text(record.variantTitle),
    on_hand: onHand,
    reserved,
    // What can still be sold.
    available: Math.max(0, onHand - reserved),
    reorder_level: Number(record.reorderLevel ?? 0),
    updated_at: time(record.updatedAt),
  };
}

export function stockMovementResource(movement: Doc) {
  return {
    object: 'stock_movement' as const,
    sku: text(movement.sku),
    delta: Number(movement.delta ?? 0),
    reason: text(movement.reason),
    // For order movements this is the order number.
    reference: text(movement.reference),
    resulting_on_hand: Number(movement.resultingOnHand ?? 0),
    created_at: time(movement.createdAt),
  };
}

export function addressResource(address: Doc) {
  return {
    id: text(address.id) || null,
    label: text(address.label),
    address_line1: text(address.addressLine1),
    address_line2: text(address.addressLine2),
    district: text(address.city),
    area: text(address.area),
    postal_code: text(address.postalCode),
    delivery_zone: text(address.zone),
    is_default: address.isDefault === true,
  };
}

export function customerResource(customer: Doc) {
  return {
    id: prefixedId('cus', customer._id),
    object: 'customer' as const,
    name: text(customer.name),
    phone: text(customer.phone),
    email: text(customer.email),
    addresses: list(customer.addresses).map(addressResource),
    active: customer.active !== false,
    created_at: time(customer.createdAt),
    updated_at: time(customer.updatedAt),
  };
}

export function orderLineResource(line: Doc) {
  return {
    product_id: text(line.productCode) || null,
    sku: text(line.sku),
    product_name: text(line.productName),
    variant_title: text(line.variantTitle),
    unit_price: Number(line.unitPrice ?? 0),
    quantity: Number(line.quantity ?? 0),
    line_total: Number(line.lineTotal ?? 0),
  };
}

export function orderHistoryResource(entry: Doc) {
  return {
    status: text(entry.status),
    payment_status: text(entry.paymentStatus),
    tracking_number: text(entry.trackingNumber),
    // 'guest' or 'customer' at checkout, the payment gateway, the admin who made the change, or an application's name.
    actor: text(entry.changedBy),
    // 'api_application' when the change came through this API; then actor_id is the application and request_id the request.
    actor_type: text(entry.actorType) || null,
    actor_id: text(entry.actorId) || null,
    request_id: text(entry.requestId) || null,
    at: time(entry.at),
  };
}

export function orderResource(order: Doc) {
  const customer: Doc = order.customer ?? {};
  const address: Doc = order.shippingAddress ?? {};

  return {
    id: text(order.orderNumber),
    object: 'order' as const,
    status: text(order.status),
    payment_method: text(order.paymentMethod) || 'cod',
    payment_status: text(order.paymentStatus),
    currency: text(order.currency) || 'BDT',
    subtotal: Number(order.subtotal ?? 0),
    shipping_fee: Number(order.shippingFee ?? 0),
    total: Number(order.total ?? 0),
    tracking_number: text(order.trackingNumber),
    customer: {
      id: order.customerId ? prefixedId('cus', order.customerId) : null,
      name: text(customer.name),
      phone: text(customer.phone),
      email: text(customer.email),
    },
    shipping_address: {
      address_line1: text(address.addressLine1),
      address_line2: text(address.addressLine2),
      district: text(address.city),
      area: text(address.area),
      postal_code: text(address.postalCode),
      delivery_zone: text(address.zone),
    },
    lines: list(order.items).map(orderLineResource),
    history: list(order.statusHistory).map(orderHistoryResource),
    created_at: time(order.createdAt),
    updated_at: time(order.updatedAt),
  };
}

/**
 * A payment as an integration needs it: who took it, whether it is paid,
 * how much, through which channel. The gateway's raw messages, session
 * keys, validation ids and card numbers stay inside.
 */
export function paymentResource(payment: Doc) {
  return {
    id: prefixedId('pay', payment._id),
    object: 'payment' as const,
    order_id: text(payment.orderNumber),
    provider: text(payment.provider),
    status: text(payment.status),
    amount: Number(payment.amount ?? 0),
    currency: text(payment.currency) || 'BDT',
    channel: text(payment.cardType),
    paid_at: time(payment.paidAt),
    // True for a payment made in the gateway's test mode: no money moved.
    sandbox: payment.sandbox === true,
    created_at: time(payment.createdAt),
    updated_at: time(payment.updatedAt),
  };
}

export function returnResource(request: Doc) {
  return {
    id: text(request.returnNumber),
    object: 'return' as const,
    order_id: text(request.orderNumber),
    status: text(request.status),
    reason: text(request.reason),
    details: text(request.details),
    items: list(request.items).map((item) => ({
      sku: text(item.sku),
      product_name: text(item.productName),
      variant_title: text(item.variantTitle),
      quantity: Number(item.quantity ?? 0),
      unit_price: Number(item.unitPrice ?? 0),
      refund_amount: Number(item.refundAmount ?? 0),
    })),
    refund_amount: Number(request.refundAmount ?? 0),
    restocked: request.restocked === true,
    created_at: time(request.createdAt),
    updated_at: time(request.updatedAt),
  };
}

/**
 * A refund record says what is owed back and how far that has got.
 * "completed" means the merchant recorded it as paid out; it is not a
 * confirmation from a bank.
 */
export function refundResource(refund: Doc) {
  return {
    id: text(refund.refundNumber),
    object: 'refund' as const,
    return_id: text(refund.returnNumber) || null,
    order_id: text(refund.orderNumber),
    amount: Number(refund.amount ?? 0),
    currency: text(refund.currency) || 'BDT',
    method: text(refund.method),
    status: text(refund.status),
    note: text(refund.note),
    created_at: time(refund.createdAt),
    updated_at: time(refund.updatedAt),
  };
}

export function applicationResource(application: Doc) {
  return {
    id: text(application.appId),
    object: 'application' as const,
    name: text(application.name),
    environment: text(application.environment),
    scopes: list(application.scopes).map((scope) => String(scope)),
  };
}
