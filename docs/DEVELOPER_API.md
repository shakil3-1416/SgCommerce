# SgCommerce Developer API

The Developer API lets another system work with a shop's commerce data:
an ERP, a courier service, an accounting tool, a CRM. It exposes stable
business resources (products, inventory, customers, orders, payments,
returns, refunds) and nothing that belongs to one particular screen.

**Version 1, stage 1: read access.** Everything below works today. What
is planned next is listed under [Roadmap](#roadmap).

- Base address: `https://<api-host>/api/v1/developer`
- Format: JSON, UTF-8. Field names are `snake_case`. Times are ISO 8601 in UTC.
- Money is in BDT, as whole taka.

## Getting started

1. In the admin, open **Developers** and create an application. Choose
   only the permissions the system needs.
2. Copy the key. It is shown once.
3. Make a first request:

```bash
curl -H "Authorization: Bearer sg_live_..." https://<api-host>/api/v1/developer
```

```json
{
  "data": {
    "application": {
      "id": "app_3f9a1c2b4d5e6f70",
      "object": "application",
      "name": "Warehouse ERP",
      "environment": "live",
      "scopes": ["orders:read", "inventory:read"]
    },
    "api_version": "v1",
    "environment": "live",
    "rate_limit": { "requests": 240, "per_seconds": 60 }
  }
}
```

## Authentication

An outside system never signs in with a person's email and password. It
is registered as an **application** with its own credential:

```
Authorization: Bearer sg_live_0123456789abcdef0123456789abcdef01234567
```

- The key is shown once, when the application is created. Only a hash of
  it is stored, so it cannot be shown again. If it is lost, revoke the
  application and create a new one.
- Each application has its own key and its own scopes. Revoking one does
  not affect the others.
- Send the key only over HTTPS and only from a server. Do not put it in
  a web page or a mobile app.

### Environments

| Prefix | Environment | Where it works |
| --- | --- | --- |
| `sg_live_` | Live | The real shop |
| `sg_test_` | Test | A sandbox deployment with its own database (`API_ENVIRONMENT=test`) |

A key only works in the environment that issued it. A test key presented
to the live API is refused with `credential_environment_mismatch`, so a
test credential can never read or change live commerce.

### Scopes

A key can call an endpoint only if it holds the endpoint's scope.

| Scope | Allows | Status |
| --- | --- | --- |
| `products:read` | Products, variants, categories | Available |
| `inventory:read` | Stock levels and stock movements | Available |
| `customers:read` | Customers and their addresses | Available |
| `orders:read` | Orders, their lines and history | Available |
| `payments:read` | The state of payments | Available |
| `returns:read` | Returns | Available |
| `refunds:read` | The state of refunds | Available |
| `products:write` | Create and update products | Planned |
| `inventory:write` | Change stock | Planned |
| `customers:write` | Update customer profiles | Planned |
| `orders:write` | Cancel orders, change status | Planned |
| `returns:write` | Create and manage returns | Planned |
| `refunds:write` | Refund operations | Planned |
| `webhooks:manage` | Configure webhook subscriptions | Planned |

A planned scope cannot be granted yet. When it becomes available it has
to be granted on purpose: no existing key gains a new power by itself.

## Responses

One record:

```json
{ "data": { "id": "SGO-0001001", "object": "order", "status": "shipped" } }
```

A collection:

```json
{
  "data": [ { "id": "SGO-0001002" }, { "id": "SGO-0001001" } ],
  "pagination": { "limit": 25, "has_more": true, "next_cursor": "NjZmMGEx..." }
}
```

Every response carries `X-Request-ID`. Quote it when reporting a problem.

### Identifiers

Records are identified by their business numbers, not by database ids:

| Resource | `id` looks like |
| --- | --- |
| Product | `SGP-000217` |
| Variant | its SKU, `SGP-000217-01` |
| Order | `SGO-0001001` |
| Return | `SGR-000001` |
| Refund | `SGF-000001` |
| Category | its slug, `mens-shirts` |
| Customer | `cus_66f0a1b2c3d4e5f6a7b8c9d0` |
| Payment | `pay_66f0a1b2c3d4e5f6a7b8c9d0` |
| Application | `app_3f9a1c2b4d5e6f70` |

Identifiers never change and are never reused. Orders placed before the
`SGO-` scheme keep their original number as their `id`.

### Pagination

Every collection is paged the same way.

| Parameter | Meaning |
| --- | --- |
| `limit` | Records per page: 1 to 100. Default 25 |
| `cursor` | The `next_cursor` of the previous page, unchanged |

Records come newest first. Keep requesting with `next_cursor` until
`has_more` is `false`. A cursor is opaque; do not build or change one.

## Errors

```json
{
  "error": {
    "code": "insufficient_scope",
    "message": "This API key does not have the \"payments:read\" scope.",
    "details": { "required_scope": "payments:read" },
    "request_id": "req_5f1c2d3e4a5b6c7d8e9f0a1b"
  }
}
```

Read `code` in a program. `message` is for a person and may be reworded.

| Status | `code` | Meaning |
| --- | --- | --- |
| 400 | `invalid_cursor` | The cursor was not issued by this API |
| 400 | `invalid_request` | The request could not be understood |
| 401 | `authentication_required` | No key was sent |
| 401 | `invalid_credential` | The key is not valid |
| 401 | `credential_revoked` | The application was revoked |
| 401 | `credential_environment_mismatch` | A test key on the live API, or the reverse |
| 403 | `insufficient_scope` | The key lacks the scope in `details.required_scope` |
| 404 | `product_not_found`, `category_not_found`, `inventory_not_found`, `customer_not_found`, `order_not_found`, `payment_not_found`, `return_not_found`, `refund_not_found` | No such record |
| 422 | `validation_failed` | A parameter is not valid; `details` lists what |
| 429 | `rate_limit_exceeded` | Too many requests; see `Retry-After` |
| 500 | `internal_error` | A fault on our side; report the `request_id` |

A real error is never returned with status 200.

## Rate limits

Each application may make **240 requests per minute**. Every response
says where it stands:

```
RateLimit-Limit: 240
RateLimit-Remaining: 187
RateLimit-Reset: 42
```

`RateLimit-Reset` is the number of seconds until the count starts again.
Over the limit, the answer is `429` with `Retry-After`. Wait that long
before retrying.

There is also a general limit of 300 requests per minute per network
address, shared with everything else that address does. Its `429` has a
plain body: `{ "statusCode": 429, "message": "..." }`.

## Reference

### Application

| | |
| --- | --- |
| `GET /developer` | The application the key belongs to, its scopes and the rate limit. No scope needed |

### Products &middot; `products:read`

| | |
| --- | --- |
| `GET /developer/products` | List. Filters: `q` (name, brand, product code or SKU), `category` (a category id), `brand`, `active` (`true`/`false`) |
| `GET /developer/products/{productId}` | One product, by product code |
| `GET /developer/categories` | All categories |

```json
{
  "id": "SGP-000217",
  "object": "product",
  "name": "Classic Cotton T-Shirt",
  "slug": "classic-cotton-t-shirt",
  "description": "Soft cotton tee.",
  "brand": "SgBasics",
  "category": { "id": "mens-shirts", "name": "Mens Shirts" },
  "images": ["https://.../products/front.png"],
  "variants": [
    { "sku": "SGP-000217-01", "title": "Black / M", "price": 950, "compare_at_price": null, "attributes": {}, "active": true }
  ],
  "currency": "BDT",
  "active": true,
  "created_at": "2026-10-06T14:20:00.000Z",
  "updated_at": "2026-10-06T14:20:00.000Z"
}
```

### Inventory &middot; `inventory:read`

| | |
| --- | --- |
| `GET /developer/inventory` | List. Filters: `sku` (one, or several separated by commas), `low_stock=true` (at or below the reorder level) |
| `GET /developer/inventory/{sku}` | One SKU |
| `GET /developer/inventory/{sku}/movements` | Every change to that SKU's stock, newest first |

```json
{ "sku": "SGP-000217-01", "object": "inventory_level", "product_name": "Classic Cotton T-Shirt", "variant_title": "Black / M",
  "on_hand": 25, "reserved": 4, "available": 21, "reorder_level": 5, "updated_at": "2026-10-06T14:20:00.000Z" }
```

`on_hand` is what is physically there, `reserved` is held back, and
`available` is what can still be sold. A movement's `reference` is the
order number for stock taken or returned by an order.

### Customers &middot; `customers:read`

| | |
| --- | --- |
| `GET /developer/customers` | List. Filters: `phone` (any spelling: `+880 1711-000001` and `01711000001` find the same customer), `email` |
| `GET /developer/customers/{customerId}` | One customer with saved addresses |
| `GET /developer/customers/{customerId}/orders` | That customer's orders. Needs `orders:read` |

### Orders &middot; `orders:read`

| | |
| --- | --- |
| `GET /developer/orders` | List. Filters: `status`, `payment_status`, `customer_id`, `phone`, `created_after`, `created_before` (ISO 8601) |
| `GET /developer/orders/{orderNumber}` | One order |

```json
{
  "id": "SGO-0001001",
  "object": "order",
  "status": "shipped",
  "payment_method": "sslcommerz",
  "payment_status": "paid",
  "currency": "BDT",
  "subtotal": 950,
  "shipping_fee": 80,
  "total": 1030,
  "tracking_number": "PATHAO-778",
  "customer": { "id": "cus_66f0a1b2c3d4e5f6a7b8c9d0", "name": "Rahim Uddin", "phone": "01711000001", "email": "rahim@example.com" },
  "shipping_address": { "address_line1": "House 12, Road 5", "address_line2": "", "district": "Dhaka", "area": "Dhanmondi", "postal_code": "1209", "delivery_zone": "inside_dhaka" },
  "lines": [
    { "product_id": "SGP-000217", "sku": "SGP-000217-01", "product_name": "Classic Cotton T-Shirt", "variant_title": "Black / M", "unit_price": 950, "quantity": 1, "line_total": 950 }
  ],
  "history": [
    { "status": "pending", "payment_status": "pending", "tracking_number": "", "actor": "guest", "at": "2026-10-06T14:18:00.000Z" },
    { "status": "pending", "payment_status": "paid", "tracking_number": "", "actor": "sslcommerz", "at": "2026-10-06T14:20:00.000Z" }
  ],
  "created_at": "2026-10-06T14:18:00.000Z",
  "updated_at": "2026-10-06T14:20:00.000Z"
}
```

- `status`: `pending`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`.
- `payment_method`: `cod` (cash on delivery) or `sslcommerz` (paid online).
- `payment_status`: `pending`, `paid`, `failed`, `refunded`, `cancelled`.
- A line's name and price are what they were when the order was placed.

### Payments &middot; `payments:read`

| | |
| --- | --- |
| `GET /developer/payments` | Online payments. Filters: `order_id`, `status` |
| `GET /developer/payments/{paymentId}` | One payment |

```json
{ "id": "pay_66f0a1b2c3d4e5f6a7b8c9d0", "object": "payment", "order_id": "SGO-0001001", "provider": "sslcommerz", "status": "paid",
  "amount": 1030, "currency": "BDT", "channel": "BKASH-BKash", "paid_at": "2026-10-06T14:20:00.000Z", "sandbox": false,
  "created_at": "2026-10-06T14:18:30.000Z", "updated_at": "2026-10-06T14:20:00.000Z" }
```

`status`: `started`, `paid`, `failed`, `cancelled`, `review`. `sandbox`
is `true` for a test payment: no money moved. Cash-on-delivery orders
have no payment record; read their `payment_status` on the order.
Gateway session keys, validation ids and card numbers are not exposed.

### Returns &middot; `returns:read`

| | |
| --- | --- |
| `GET /developer/returns` | List. Filters: `order_id`, `status` |
| `GET /developer/returns/{returnNumber}` | One return with its items |

`status`: `requested`, `approved`, `rejected`, `received`, `completed`.
Refund amounts are computed by the server from the order.

### Refunds &middot; `refunds:read`

| | |
| --- | --- |
| `GET /developer/refunds` | List. Filters: `order_id`, `return_id`, `status` |
| `GET /developer/refunds/{refundNumber}` | One refund |

`status`: `pending`, `completed`, `failed`. A refund record says what is
owed back and how far that has got. `completed` means the merchant
recorded it as paid out; it is not a confirmation from a bank.

## Versioning

- The version is in the address: `/api/v1`.
- Within v1, changes are additive: new endpoints, new optional
  parameters, new fields in responses. Ignore fields you do not know.
- Existing fields are not renamed or removed, and their meaning does not
  change, within v1. An incompatible change gets a new version.
- When something is to be retired, it is announced in the changelog with
  a deprecation date and a removal date at least six months later, and a
  replacement is named.

## Roadmap

Planned, in this order. None of it is available yet.

1. **Writing.** Cancelling and updating orders, creating returns,
   adjusting stock, with an `Idempotency-Key` on every write so a retry
   never does something twice, and each change recorded in the order's
   history under the application's name.
2. **Webhooks.** Subscriptions to events such as `order.created`,
   `order.updated`, `payment.paid`, `return.created`, each signed, with
   retries, a delivery log and replay.
3. **Fulfilment** as its own resource (carrier, tracking, several
   shipments per order), and product and customer writes.

## Changelog

| Date | Change |
| --- | --- |
| 2026-10-07 | Stage 1: applications, credentials and scopes; read access to products, categories, inventory, customers, orders, payments, returns and refunds |
