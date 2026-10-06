# SgCommerce

SgCommerce is a standalone full-stack e-commerce platform for customer shopping, catalog management, inventory, checkout, fulfillment, returns, refunds and merchant administration.

The current release focuses on the standalone commerce system. SupGent integration will be added in a later phase.

## Production

SgCommerce is deployed as three production applications on Vercel.

| Application | Production URL | Purpose |
| --- | --- | --- |
| **Customer Storefront** | [sg-commerce-storefront.vercel.app](https://sg-commerce-storefront.vercel.app) | Public shopping experience, customer accounts, cart, checkout, orders and returns |
| **Merchant Admin** | [sg-commerce-admin.vercel.app](https://sg-commerce-admin.vercel.app) | Catalog, inventory, orders, customers, returns and refund administration |
| **REST API** | [sg-commerce-api.vercel.app/api/v1](https://sg-commerce-api.vercel.app/api/v1) | NestJS commerce API used by the storefront and merchant admin |

### Customer Storefront

The main customer-facing application is:

**https://sg-commerce-storefront.vercel.app**

Customers can browse products, maintain a cart, create an account, sign in, manage saved delivery addresses, place orders and view their order history.

### Merchant Admin

The merchant administration application is:

**https://sg-commerce-admin.vercel.app**

The admin application is intended for authorized merchant staff and provides operational access to products, categories, inventory, orders, customers, returns and refunds.

### API

The production API base URL is:

**https://sg-commerce-api.vercel.app/api/v1**

---

## Local Development

Requirements: Node.js 22, pnpm and Docker (for MongoDB and Redis).

    pnpm install
    pnpm infra:up
    pnpm dev

| Application | Local URL |
|---|---|
| Storefront | http://localhost:3100 |
| Admin | http://localhost:3101 |
| API | http://localhost:4000/api/v1 |

Create a local admin account with:

    SG_ADMIN_EMAIL=admin@example.com SG_ADMIN_PHONE=01700000000 SG_ADMIN_PASSWORD='at-least-12-characters' pnpm --filter api seed:admin

The same command, run with the production `MONGODB_URI`, sets a new password for the admin with that email.

## Technology Stack

- Next.js storefront
- Next.js merchant admin
- NestJS REST API
- MongoDB
- Redis
- TypeScript
- pnpm workspace
- Docker Compose

## Repository Structure

    apps/
    ├── storefront/
    ├── admin/
    └── api/

    packages/
    └── shared/

    e2e/
    scripts/
    docker-compose.prod.yml

## Customer Storefront

The customer-facing application includes:

- Product catalog
- Product search
- Category filtering
- Brand filtering
- Price filtering
- Product sorting
- Pagination
- Product images
- Product image galleries
- Product variants
- Live inventory
- Persistent cart
- Cash on Delivery checkout
- Online payment through SSLCOMMERZ (optional; see `docs/PAYMENTS_SSLCOMMERZ.md`)
- Delivery charge worked out from the customer's district
- Customer registration
- Customer login
- Saved addresses
- Order history
- Order tracking
- Return requests

## Merchant Admin

The administration application includes:

- Admin authentication
- Product management
- Automatic product codes and SKUs
- Category management
- Product image upload
- Variant management
- Opening stock when a product is created
- Inventory management
- Order management
- Order details: items, delivery address, payment and a history of every change
- Online payment status, with a check against SSLCOMMERZ and refund marking
- Tracking updates
- Customer management
- Return management
- Refund management

## Business Identifiers

Staff never type an ID. The API issues them, in order, and never reuses one.

| Record | Format | Example |
| --- | --- | --- |
| Product | `SGP-` + 6 digits | `SGP-000217` |
| Variant SKU | product code + 2 digits | `SGP-000217-01` |
| Order | `SGO-` + 7 digits | `SGO-0001001` |
| Return | `SGR-` + 6 digits | `SGR-000001` |
| Refund | `SGF-` + 6 digits | `SGF-000001` |

A SKU typed by the merchant is kept as typed; a SKU left empty is generated. Records created before this scheme keep their old numbers. Details: `docs/PRODUCT_IDS_AND_IMAGES.md`.

## Product Images

Merchants upload product photos in the admin. The files are stored in a Vercel Blob store with public access that is connected to the admin project; no storage token has to be configured on Vercel. Details: `docs/PRODUCT_IDS_AND_IMAGES.md`.

## Checkout Rules

- **Delivery charge.** The customer chooses a district. Dhaka district is charged BDT 80 and every other district BDT 150. The API decides this from the district and ignores any zone a browser sends.
- **Phone numbers.** A Bangladesh mobile number is stored as `01XXXXXXXXX` however it was typed, so one customer is always recognised as one customer.
- **Prices.** The browser sends only SKUs and quantities. Names and prices are read from the database when the order is placed and copied into it.

## What An Order Records

Customer, delivery address, each line (product code, SKU, name, variant, unit price, quantity), totals, payment method and status, the confirmed online payment (channel, bank transaction ID, time), and a history entry for every change of status, payment or tracking number with who made it and when. Stock movements carry the order number.

## Developer API

Other systems (an ERP, a courier service, accounting) connect through the Developer API at `/api/v1/developer`. Each system is registered in the admin under **Developers** as an application with its own key (`sg_live_...`) and only the permissions it needs, and can be revoked on its own. The API returns stable business resources identified by their business numbers, with one response shape, machine-readable error codes, cursor pagination and per-application rate limits.

Stage 1 is read-only: products, categories, inventory, customers, orders, payments, returns and refunds. Writing and webhooks are planned. Reference: `docs/DEVELOPER_API.md`.

## Documentation

| Document | Covers |
| --- | --- |
| `docs/PRODUCT_IDS_AND_IMAGES.md` | Identifiers, image upload, opening stock, order records, delivery charge, phone numbers, one-time data preparation |
| `docs/PAYMENTS_SSLCOMMERZ.md` | Online payment: setup, flow, rules, testing, what is not included |
| `docs/DEVELOPER_API.md` | The Developer API for outside systems: credentials, scopes, every endpoint, errors, rate limits |
| `docs/VERCEL_DEPLOYMENT.md` | The three Vercel projects and their environment variables |

## Catalog

SgCommerce separates the customer-facing demo catalog from the synthetic load-test catalog.

Import the customer-facing product-specific demo catalog with:

    pnpm --filter api seed:catalog

The customer catalog imports more than 200 product-specific sample products with matching product imagery from development catalog sources.

The current external demo sources are for development and product demonstration. Their pricing and images must not be represented as live merchant inventory.

Generate the synthetic 400-product load-test catalog with:

    pnpm --filter api seed:catalog-loadtest

The load-test catalog exists only for pagination, API, inventory and performance testing. It must not be used as the public customer catalog.

For a commercial deployment, replace demo catalog records with merchant or supplier-owned product data and media.

Demo product photos are loaded from the external demo sources each time a page opens, and those sources do not always serve them. Photos uploaded in the admin do not have this problem.

## Existing Data

After deploying a version that introduces new identifiers or stored formats, run the one-time preparation script against the database. It shows a plan first and changes nothing until `--apply` is added:

    MONGODB_URI='...' pnpm --filter api exec tsx src/backfill-business-ids.ts
    MONGODB_URI='...' pnpm --filter api exec tsx src/backfill-business-ids.ts --apply

It numbers products that have no code, sets the counters, rewrites stored phone numbers in one format and merges a customer who was saved twice under two spellings of one number. It is safe to run again.

## Local Type Checks

Run:

    pnpm --filter api typecheck
    pnpm --filter storefront typecheck
    pnpm --filter admin typecheck

Or everything at once, including the API build:

    pnpm verify

## Unit Tests

    pnpm --filter api run test:ids
    pnpm --filter api exec tsx --test ../admin/src/lib/product-images.spec.ts ../admin/src/lib/order-payment.spec.ts ../admin/src/lib/developer-applications.spec.ts
    pnpm --filter api exec tsx --test ../storefront/src/lib/districts.spec.ts ../storefront/src/lib/payments.spec.ts

These cover the identifier formats, the phone and delivery rules, the SSLCOMMERZ request and signature rules, the image upload rules and the payment wording.

## Browser E2E

Run:

    scripts/browser-e2e.sh

The browser E2E runner uses the configured local Chrome installation.

## Production Docker

Production environment template:

    .env.production.example

Private production values must never be committed.

Start the production stack:

    docker compose \
      --env-file .env.production.local \
      -p sgcommerce-prod \
      -f docker-compose.prod.yml \
      up -d

Check service status:

    docker compose \
      --env-file .env.production.local \
      -p sgcommerce-prod \
      -f docker-compose.prod.yml \
      ps

## API Routing

Public browser-facing API example:

    NEXT_PUBLIC_API_URL=https://api.example.com/api/v1

Container-internal API:

    INTERNAL_API_URL=http://api:4000/api/v1

Local production-smoke example:

    NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1

## CORS

Example:

    CORS_ALLOWED_ORIGINS=https://shop.example.com,https://admin.example.com

## Admin Cookies

Local HTTP smoke testing:

    ADMIN_COOKIE_SECURE=false

Real HTTPS deployment:

    ADMIN_COOKIE_SECURE=true

## Security

Do not commit:

    .env
    .env.production.local
    .runtime/local-admin.env

Use a strong production AUTH_SECRET.

The SSLCOMMERZ store password belongs in the API's environment variables only. An order is marked paid only after SSLCOMMERZ's server confirms the payment for that order number, in BDT, for the exact total.

## Current Payment Model

Two ways to pay:

- **Cash on Delivery.** Always available. The order becomes "paid" when it is marked delivered.
- **Online payment through SSLCOMMERZ.** Offered at checkout when the API has SSLCOMMERZ credentials configured. The customer pays on SSLCOMMERZ's page (cards, bKash, Nagad and its other channels) and returns to the shop. A failed or cancelled payment cancels the order and returns its stock.

As of 7 October 2026 the production deployment uses SSLCOMMERZ **sandbox** credentials: payments are tests and no money moves. Real payments need a live SSLCOMMERZ merchant account and `SSLCOMMERZ_LIVE=true`.

Refunds are made in the SSLCOMMERZ merchant panel and then recorded in the admin. See `docs/PAYMENTS_SSLCOMMERZ.md`.

Expanded shipping integrations are planned for later phases.

## SupGent Integration

SgCommerce currently keeps SupGent integration separate from the standalone commerce runtime.

SupGent integration will be added after the core commerce system is stable in production.

## Current Development Status

Implemented:

- Standalone commerce workflow
- Customer storefront
- Merchant admin
- MongoDB and Redis
- Docker production packaging
- Browser E2E
- Catalog scaling work
- Product imagery support
- Production deployment on Vercel (storefront, admin, API)
- Automatic product codes, SKUs and order, return and refund numbers
- Product image upload from the admin
- Opening stock at product creation
- Order details and change history in the admin
- District-based delivery charge and one stored phone format
- Online payment through SSLCOMMERZ, verified end to end in the sandbox on the production deployment
- Developer API, stage 1: applications with scoped keys and read access to every commerce resource

Remaining launch work includes:

- Live SSLCOMMERZ merchant account and credentials
- Developer API stage 2 (writes with idempotency) and stage 3 (webhooks)
- Replacing the demo catalog with the merchant's own products and photos
- Automatic cancellation of online orders whose payment page was abandoned
- Making checkout safe against a failure half-way through (stock and order are not yet written in one transaction)
- Custom domains and DNS
- Database backups
- Monitoring and error alerts
- More than one admin account, with roles
- Final remote E2E

## License

Private proprietary project. All rights reserved.
