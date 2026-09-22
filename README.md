# SgCommerce

SgCommerce is a standalone full-stack e-commerce platform for customer shopping, catalog management, inventory, checkout, fulfillment, returns, refunds and merchant administration.

The current release focuses on the standalone commerce system. SupGent integration will be added in a later phase.

## Applications

| Application | Local URL |
|---|---|
| Storefront | http://localhost:3100 |
| Admin | http://localhost:3101 |
| API | http://localhost:4000/api/v1 |

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
- Category management
- Multiple product image URLs
- Variant management
- Inventory management
- Order management
- Tracking updates
- Customer management
- Return management
- Refund management

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

## Local Type Checks

Run:

    pnpm --filter api typecheck
    pnpm --filter storefront typecheck
    pnpm --filter admin typecheck

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

    .env.production.local
    .runtime/local-admin.env

Use a strong production AUTH_SECRET.

## Current Payment Model

The standalone V1 currently supports Cash on Delivery.

Online payment gateways and expanded shipping integrations are planned for later phases.

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

Remaining launch work includes:

- Final 400-product catalog verification
- Storefront merchandising verification
- Commerce consistency hardening
- Production server deployment
- DNS and HTTPS
- Backups
- Monitoring
- Final remote E2E

## License

Private proprietary project. All rights reserved.
