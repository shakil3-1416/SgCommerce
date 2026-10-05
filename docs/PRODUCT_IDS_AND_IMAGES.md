# Product IDs, order numbers and image upload

## Identifiers

MongoDB's `_id` stays the internal key. Staff and customers see these
instead. Each one comes from an atomic counter in the `counters`
collection, so two requests can never receive the same number.

| Record | Example | Issued when |
|---|---|---|
| Product | `SGP-000217` | A product is created |
| Variant SKU | `SGP-000217-01` | A variant is saved with the SKU left empty |
| Order | `SGO-0001001` | An order is placed |
| Return | `SGR-000045` | A return is requested |
| Refund | `SGF-000012` | A refund is opened for a return |

Rules:

- A code never changes and is never reused. A failed save can leave a
  gap in the numbers, which is harmless.
- A SKU typed by staff is kept as typed (upper-cased). Only empty SKUs
  are generated.
- A saved SKU cannot be edited in the admin, because the stock record
  and past orders are stored under it. The product remembers the highest
  variant number it has used (`lastVariantNumber`), so the SKU of a
  deleted variant is not issued again.
- The slug comes from the product name when the product is created and
  stays the same when the product is renamed.
- Records created before this change keep their old numbers.

Prefixes and widths are set in
`apps/api/src/modules/sequences/business-ids.ts`. Change them only before
the first code of that kind is issued.

## Existing products

`apps/api/src/backfill-business-ids.ts` gives existing products a code
(oldest first), creates the unique index and sets the counters so new
orders start at `SGO-0001001`.

```bash
# Dry run: prints the plan and changes nothing
pnpm --filter api exec tsx src/backfill-business-ids.ts

# Apply
pnpm --filter api exec tsx src/backfill-business-ids.ts --apply
```

It uses `MONGODB_URI` and falls back to the local development database,
like the seed scripts. It prints the server and database before doing
anything and can be run more than once. Run it again after
`seed:catalog`, because the import scripts write products directly.

## Image upload

The admin uploads product images to Vercel Blob. The browser sends the
file straight to storage; `apps/admin/src/app/api/uploads/product-image`
only checks that the caller is a signed-in admin and then hands back a
short-lived upload address for one image (Vercel Blob's presigned upload
flow, `handleUploadPresigned`). The product stores the image URLs in
`images`, as before.

Setup:

1. In Vercel, create a Blob store with **public** access and connect it
   to the admin project (Storage, the store, Connect Project). Vercel
   adds `BLOB_STORE_ID` to the project and supplies a short-lived
   identity token to the function by itself; no `BLOB_READ_WRITE_TOKEN`
   is needed there.
2. Redeploy the admin.
3. Outside Vercel (local development, Docker), set
   `BLOB_READ_WRITE_TOKEN` instead, for example in
   `apps/admin/.env.local`.

When an upload fails, the uploader asks `GET` on the same route why, and
shows the answer: not signed in, storage not connected, or the storage
service's own message.

Limits are in `apps/admin/src/lib/product-images.ts`: JPG, PNG, WebP or
AVIF, 8 MB per file, 8 images per product. Removing an image from a
product does not delete the stored file.

## Stock for new products

A variant can only be sold once it has a stock record. The product form
has an "Opening stock" field for every variant without one. On save the
admin creates the record and adds the quantity as a stock adjustment
with the reason `opening_stock`, so the stock ledger shows where the
first units came from. After that, stock is changed on the Inventory
page.

## What an order records

Besides the customer, address, items and totals, each order keeps:

- **Product code on every line** (`items[].productCode`), next to the
  internal product id and the SKU. It is copied when the order is placed,
  like the name and the price.
- **Status history** (`statusHistory`): one entry each time the status,
  payment status or tracking number changes, with who changed it and
  when. The entry written at checkout says `guest` or `customer`; later
  entries carry the admin's email. Entries are only added, never edited.
  With cash on delivery this is also the payment record: the entry for
  "delivered" shows who marked the order paid and when.
- **The order number on its stock movements.** Stock taken at checkout
  is written to the stock ledger with `reference` set to the order
  number, as cancellations already were.

The admin Orders page shows all of this under "Order details" for each
order: items, delivery address, email, totals, payment and history.
Orders placed before this change have no history and no product code on
their lines.

## Delivery charge

The customer chooses a **district** at checkout and for saved addresses;
there is no zone to pick. Dhaka district is charged the inside-Dhaka
rate (৳80) and every other district the outside rate (৳150).

The API works the zone out from the district
(`apps/api/src/common/delivery-zone.ts`) and ignores any zone a browser
sends, so an address outside Dhaka cannot be charged the inside rate.
The rates themselves are in `OrdersService.shippingFee`; the storefront
mirrors them in `apps/storefront/src/lib/districts.ts` to show the charge
before the order is placed. Change both together.

## Phone numbers

A customer is recognised by phone number, and an order is tracked by
order number plus phone. Every phone is therefore stored in one format:
a Bangladesh mobile number becomes `01XXXXXXXXX` however it was typed
(`+880 1711-000001`, `8801711000001`, `01711 000001`). The rule is in
`apps/api/src/common/phone.ts` and is applied wherever a phone is saved
or looked up: checkout, accounts, sign-in by phone, order tracking and
returns. A number that is not a Bangladesh mobile number is stored as
typed, without spaces.

`backfill-business-ids.ts` rewrites numbers saved before this rule. It
leaves a customer or user alone, and lists it, when another record
already has the same number.

## Tests

```bash
pnpm --filter api run test:ids
pnpm --filter api exec tsx --test ../admin/src/lib/product-images.spec.ts
pnpm --filter api exec tsx --test ../storefront/src/lib/districts.spec.ts
```
