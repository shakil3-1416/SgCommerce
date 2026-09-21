# SgCommerce

SgCommerce is a reference commerce platform designed to exercise SupGent against
real ecommerce workflows.

## Applications

### Storefront

Port 3000.

Customer-facing application.

### Admin

Port 3001.

Merchant operations application.

### API

Port 4000.

NestJS modular monolith.

## Backend domains

- Auth
- Users
- Customers
- Catalog
- Inventory
- Cart
- Checkout
- Orders
- Payments
- Shipping
- Coupons
- Returns
- Refunds
- Notifications
- Webhooks
- SupGent Integration

## Persistence

MongoDB is the primary operational datastore.

Redis supports:

- caching
- rate limiting
- temporary data
- cart/session state
- inventory reservation
- distributed locking
- background jobs

## SupGent boundary

SupGent must never directly access the SgCommerce database.

Communication occurs through:

- authenticated REST APIs
- signed webhooks

This allows the same SupGent commerce abstraction to later support:

- SgCommerce
- Shopify
- WooCommerce
- Magento
- custom merchant backends
