# SgCommerce Developer API

The Developer API lets another system work with a shop's commerce data:
an ERP, a courier service, an accounting tool, a CRM. It exposes stable
business resources (products, inventory, customers, orders, payments,
returns, refunds) and nothing that belongs to one particular screen.

**Version 1: read and write access to every commerce resource.**
Everything below works today. What is planned next is listed under
[Roadmap](#roadmap).

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

### Managing a key

All of this is done in the admin under **Developers**, on the
application's page.

- **End date.** A key can be given a lifetime of 30, 90 or 365 days. After
  that it is refused with `credential_expired`. The admin flags a key in
  its last two weeks.
- **Replacing a key.** "Replace key" issues a new key and shows it once.
  The old key can be kept working for 1 hour, 1 day or 7 days, so the
  system can be switched over without an outage; after that it is refused
  with `credential_replaced`. Replace a key at once if it may have leaked.
- **Changing permissions** takes effect on the application's next request.
  The key stays the same.
- **Revoking** stops the key immediately and cannot be undone.

Every change is written to the application's history with who made it
and when.

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
| `products:write` | Create and update products, variants and prices | Available |
| `inventory:write` | Change stock | Available |
| `customers:write` | Update customer names, emails and saved addresses | Available |
| `orders:write` | Cancel orders, change status and tracking | Available |
| `returns:write` | Create and manage returns | Available |
| `refunds:write` | Record the outcome of a refund (does not move money) | Available |
| `webhooks:manage` | Configure webhook subscriptions | Planned |

A write scope lets whoever holds the key change the shop's data. Grant
one only to a system that needs it; the admin asks for confirmation.

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
The merchant can look a request up by that id in the admin, under
**Developers, Requests**.

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

## Writing

A write is a `POST` (create something, or carry out an action), a
`PATCH` (change fields of something that exists) or a `DELETE`. All of
them follow two rules.

### 1. Send an Idempotency-Key

```
POST /api/v1/developer/orders/SGO-0001001/cancel
Authorization: Bearer sg_live_...
Idempotency-Key: 4f8f6a0e-0d0c-4b56-9d3e-7b1f0c9a2e11
Content-Type: application/json

{ "expected_status": "confirmed" }
```

The key is a value you generate, such as a UUID: 8 to 255 printable
characters. It makes the request safe to repeat.

- The first request with a key does the work. Its answer is remembered
  for 24 hours.
- The same request again with the same key gets that answer back, with
  the header `Idempotent-Replayed: true`. Nothing is done twice. So when
  a request times out, send it again with the same key.
- A refusal (for example `order_not_cancellable`) is remembered the same
  way. A failure on our side (5xx) or `resource_busy` is not, so the same
  key can be retried.
- The same key with a different request is refused with
  `idempotency_conflict`. Use a new key for each new thing you ask for.
- Without the header the answer is `400 idempotency_key_required`.

### 2. Say what you expect, when it matters

`expected_status` is optional. With it, the change is made only if the
record is still in that status; otherwise the answer is
`409 state_conflict` with the current status in `details`. Use it when
you decided on the basis of something you read earlier.

### What a write is allowed to do

A write goes through the same rules as the admin: which status may
follow which, what can be returned, when stock goes back. The API never
lets a caller choose a price, a refund amount or an eligibility.

Each change to an order is written to its history with the
application's name, `actor_type: "api_application"`, the application's
id and the request id. Every write of any kind is in the request log
with the application, the path and the outcome.

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
| 400 | `idempotency_key_required` | A write was sent without an `Idempotency-Key` |
| 400 | `invalid_idempotency_key` | The key is not 8 to 255 printable characters |
| 401 | `authentication_required` | No key was sent |
| 401 | `invalid_credential` | The key is not valid |
| 401 | `credential_revoked` | The application was revoked |
| 401 | `credential_expired` | The key has passed its end date |
| 401 | `credential_replaced` | The key was replaced and its grace period is over |
| 401 | `credential_environment_mismatch` | A test key on the live API, or the reverse |
| 403 | `insufficient_scope` | The key lacks the scope in `details.required_scope` |
| 404 | `product_not_found`, `variant_not_found`, `category_not_found`, `inventory_not_found`, `customer_not_found`, `address_not_found`, `order_not_found`, `payment_not_found`, `return_not_found`, `refund_not_found` | No such record |
| 409 | `idempotency_conflict` | The key was already used for a different request |
| 409 | `idempotency_in_progress` | The first request with this key is still being handled |
| 409 | `state_conflict` | The record is not in the `expected_status`; `details` has the current one |
| 409 | `invalid_transition` | That status cannot follow the current one |
| 409 | `order_not_cancellable` | The order has shipped or been delivered |
| 409 | `payment_required` | An order to be paid online is unpaid and cannot move forward |
| 409 / 422 | `return_not_eligible` | The order is not delivered yet (409), or an item is not part of it (422) |
| 409 | `return_quantity_exceeded` | More units than remain eligible for return |
| 409 | `insufficient_inventory` | Not enough available stock for the adjustment |
| 409 | `sku_conflict` | A SKU in the request is already used by another product |
| 409 | `resource_busy` | The record is being changed by someone else; retry shortly |
| 422 | `category_not_found` | The category named in the body does not exist |
| 422 | `validation_failed` | A parameter is not valid; `details` lists what |
| 429 | `rate_limit_exceeded` | Too many requests; see `Retry-After` |
| 500 | `internal_error` | A fault on our side; report the `request_id` |

A real error is never returned with status 200.

## Rate limits

Each application may make **240 reads and 60 writes per minute**,
counted separately. Every response says where it stands:

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

## What is recorded

Each request from a recognised application is logged: the request id,
the application, method, path, status, error code, time taken, network
address and user agent. Query strings, bodies and keys are never logged.
The most recent 200,000 requests are kept. Requests per application per
day are counted separately and shown in the admin.

## Reference

The admin shows this reference too, under **Developers, API reference**.
It is drawn from the running API, so it always matches the deployed
version.

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

**Writing &middot; `products:write`**

| | |
| --- | --- |
| `POST /developer/products` | Create a product. Answers `201` with the product |
| `PATCH /developer/products/{productId}` | Change `name`, `description`, `brand`, `category`, `images`, `active` |
| `POST /developer/products/{productId}/variants` | Add a variant. Answers `201` with the product |
| `PATCH /developer/products/{productId}/variants/{sku}` | Change one variant: `title`, `price`, `compare_at_price`, `attributes`, `active` |

```json
{
  "name": "Linen Shirt",
  "category": "mens-shirts",
  "brand": "SgBasics",
  "description": "Breathable linen.",
  "images": ["https://example.com/linen-front.png"],
  "variants": [
    { "title": "White / M", "price": 1450, "compare_at_price": 1700, "opening_stock": 12 },
    { "title": "White / L", "price": 1450, "sku": "LS-WHT-L" }
  ]
}
```

- The server issues the product code (`SGP-…`). A variant without a `sku`
  gets one from the product code (`SGP-000218-01`). A `sku` you send is
  kept as sent and must not belong to another product
  (`409 sku_conflict`).
- `category` is a category id from `GET /categories`
  (`422 category_not_found`).
- `images` are `https` addresses, at most 12. The shop shows them from
  where they are: host them somewhere that stays up.
- Each new variant gets a stock record with `opening_stock` units, or 0.
- Prices are whole taka. `compare_at_price` is the crossed-out price;
  send `null` on a variant update to remove it.
- A product's product code and web address never change, and a SKU never
  changes. To stop selling a product or a variant set `active` to
  `false`; nothing is deleted.
- Changing a price affects new orders only. Orders already placed keep
  the price they were placed at.

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

**Writing &middot; `inventory:write`**

| | |
| --- | --- |
| `POST /developer/inventory/{sku}/adjustments` | Add to or take from stock |

```json
{ "delta": 12, "reason": "supplier delivery", "reference": "GRN-2026-0412" }
```

`delta` is a whole number, positive to add and negative to take away,
never zero. `reason` is kept in the stock history. `reference` is
optional. The answer is the SKU's new stock level. Stock cannot be taken
below what is reserved: `409 insufficient_inventory`. A SKU that exists
but never had a stock record gets one, starting at zero, on its first
adjustment.

### Customers &middot; `customers:read`

| | |
| --- | --- |
| `GET /developer/customers` | List. Filters: `phone` (any spelling: `+880 1711-000001` and `01711000001` find the same customer), `email` |
| `GET /developer/customers/{customerId}` | One customer with saved addresses |
| `GET /developer/customers/{customerId}/orders` | That customer's orders. Needs `orders:read` |

**Writing &middot; `customers:write`**

| | |
| --- | --- |
| `PATCH /developer/customers/{customerId}` | Change `name` or `email` |
| `POST /developer/customers/{customerId}/addresses` | Save an address. Answers `201` with the customer |
| `DELETE /developer/customers/{customerId}/addresses/{addressId}` | Remove a saved address |

```json
{ "label": "Office", "address_line1": "Station Road", "district": "Pabna", "postal_code": "6600", "is_default": true }
```

- A customer is identified by their phone number, so the phone cannot be
  changed through the API.
- The delivery zone of an address follows from its `district`; it cannot
  be set.
- Removing a saved address does not touch orders already placed: each
  order keeps its own copy of where it was sent.

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
    { "status": "pending", "payment_status": "pending", "tracking_number": "", "actor": "guest", "actor_type": null, "actor_id": null, "request_id": null, "at": "2026-10-06T14:18:00.000Z" },
    { "status": "pending", "payment_status": "paid", "tracking_number": "", "actor": "sslcommerz", "actor_type": null, "actor_id": null, "request_id": null, "at": "2026-10-06T14:20:00.000Z" },
    { "status": "shipped", "payment_status": "paid", "tracking_number": "PATHAO-778", "actor": "Warehouse ERP", "actor_type": "api_application", "actor_id": "app_3f9a1c2b4d5e6f70", "request_id": "req_5f1c2d3e4a5b6c7d8e9f0a1b", "at": "2026-10-06T15:02:00.000Z" }
  ],
  "created_at": "2026-10-06T14:18:00.000Z",
  "updated_at": "2026-10-06T14:20:00.000Z"
}
```

- `status`: `pending`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`.
- `payment_method`: `cod` (cash on delivery) or `sslcommerz` (paid online).
- `payment_status`: `pending`, `paid`, `failed`, `refunded`, `cancelled`.
- A line's name and price are what they were when the order was placed.
- A history entry made through this API also has `actor_type`
  (`api_application`), `actor_id` (the application) and `request_id`.
  For other entries those three are `null`.

**Writing &middot; `orders:write`**

| | |
| --- | --- |
| `POST /developer/orders/{orderNumber}/cancel` | Cancel an order and return its stock. Body: `expected_status` (optional) |
| `POST /developer/orders/{orderNumber}/status` | Move an order forward. Body: `status`, `tracking_number` (optional), `expected_status` (optional) |

```json
{ "status": "shipped", "tracking_number": "PATHAO-778", "expected_status": "processing" }
```

- An order moves `pending` &rarr; `confirmed` &rarr; `processing` &rarr;
  `shipped` &rarr; `delivered`. Any other step is `409 invalid_transition`.
- Sending the status an order already has, with a `tracking_number`,
  updates the tracking number.
- Only an order that has not shipped can be cancelled; otherwise
  `409 order_not_cancellable`. Cancelling a cancelled order succeeds and
  changes nothing.
- An order to be paid online cannot be moved forward until it is paid
  (`409 payment_required`). It can be cancelled.
- **Cancelling does not refund.** An order that was paid online stays
  `payment_status: "paid"` after it is cancelled; the merchant refunds it
  at the payment gateway.
- A cash-on-delivery order becomes `paid` when it is marked `delivered`.

Both answer with the order as it is after the change.

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

**Writing &middot; `returns:write`**

| | |
| --- | --- |
| `POST /developer/returns` | Open a return for a delivered order. Answers `201` with the return |
| `POST /developer/returns/{returnNumber}/status` | Move a return on. Body: `status`, `expected_status` (optional) |

```json
{
  "order_id": "SGO-0001021",
  "items": [ { "sku": "SGP-000044-02", "quantity": 1 } ],
  "reason": "wrong_size",
  "details": "Customer asked for size L"
}
```

- The order must be `delivered` (`409 return_not_eligible`), each SKU
  must be on the order (`422 return_not_eligible`), and no more units
  than remain un-returned may be asked for
  (`409 return_quantity_exceeded`).
- The caller says which SKUs and how many. The server sets the unit
  price and the refund amount from the order.
- A return moves `requested` &rarr; `approved` or `rejected`; `approved`
  &rarr; `received` &rarr; `completed`. Any other step is
  `409 invalid_transition`.

### Refunds &middot; `refunds:read`

| | |
| --- | --- |
| `GET /developer/refunds` | List. Filters: `order_id`, `return_id`, `status` |
| `GET /developer/refunds/{refundNumber}` | One refund |

`status`: `pending`, `completed`, `failed`. A refund record says what is
owed back and how far that has got. `completed` means the merchant
recorded it as paid out; it is not a confirmation from a bank.

**Writing &middot; `refunds:write`**

| | |
| --- | --- |
| `POST /developer/refunds/{refundNumber}/status` | Record how a refund turned out. Body: `status`, `note` (optional), `expected_status` (optional) |

```json
{ "status": "completed", "note": "bKash TrxID 9XK2A7", "expected_status": "pending" }
```

- **This does not send money.** The refund itself is made at the payment
  gateway or in cash. This keeps the shop's record in step with what
  really happened, for example from an accounting system.
- A `pending` refund can become `completed` or `failed`. A `failed` one
  can become `pending` again or `completed`. A `completed` refund is
  final (`409 invalid_transition`).
- Refund records are created by the server when a return is processed;
  the amount comes from the order and cannot be set.

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

1. **Webhooks.** Subscriptions to events such as `order.created`,
   `order.updated`, `payment.paid`, `return.created`, each signed, with
   retries, a delivery log and replay. The `webhooks:manage` scope is
   reserved for this and cannot be granted yet.
2. **Fulfilment** as its own resource (carrier, tracking, several
   shipments per order).

## Changelog

| Date | Change |
| --- | --- |
| 2026-10-07 | Stage 1: applications, credentials and scopes; read access to products, categories, inventory, customers, orders, payments, returns and refunds |
| 2026-10-07 | Key end dates, key replacement with a grace period, editable permissions, change history, request log and usage counts. New error codes `credential_expired` and `credential_replaced` |
| 2026-10-07 | Writing: cancel and move orders, open and move returns, adjust stock. `Idempotency-Key` on every write, `expected_status`, a separate write rate limit, and `actor_type`, `actor_id`, `request_id` on order history entries |
| 2026-10-07 | Writing: create and update products and variants, update customers and their saved addresses, record refund outcomes. `PATCH` and `DELETE` join `POST`. New codes `variant_not_found`, `address_not_found`, `sku_conflict`, `category_not_found` (422) |
