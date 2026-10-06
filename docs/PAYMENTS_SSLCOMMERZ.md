# Online payment with SSLCOMMERZ

Customers can pay online (cards, bKash, Nagad and the other channels
SSLCOMMERZ offers) as well as by cash on delivery. This uses SSLCOMMERZ's
hosted payment page (API v4): the customer leaves the shop to pay and is
brought back.

## Switching it on

Set these on the **API**:

| Variable | Value |
| --- | --- |
| `SSLCOMMERZ_STORE_ID` | The store ID from SSLCOMMERZ |
| `SSLCOMMERZ_STORE_PASSWORD` | The store password from SSLCOMMERZ |
| `STOREFRONT_URL` | The shop's public address, e.g. `https://shop.example.com` |
| `SSLCOMMERZ_LIVE` | `true` for real payments. Leave unset for the sandbox |
| `API_PUBLIC_URL` | The API's public base address. Not needed on Vercel |

Without the first three, checkout offers cash on delivery only and
nothing else changes. A sandbox store ID and password come from
<https://developer.sslcommerz.com/registration/>; live ones from a
merchant account. Never mix them: sandbox credentials with
`SSLCOMMERZ_LIVE=true` (or the reverse) will be refused by SSLCOMMERZ.

SSLCOMMERZ takes between BDT 10 and BDT 500,000 per payment. An order
outside that range can only be placed as cash on delivery.

## What happens

1. The customer chooses "Pay online" and places the order. The order is
   saved as usual (stock reserved, order number issued) with
   `paymentMethod: sslcommerz` and `paymentStatus: pending`.
2. The API creates a payment session and the customer is sent to the
   SSLCOMMERZ page. The order number is the transaction ID, so an order
   can be found in the SSLCOMMERZ panel by its number.
3. SSLCOMMERZ sends the customer back to
   `/payments/sslcommerz/success|fail|cancel` on the API and also
   notifies the API directly at `/payments/sslcommerz/ipn`.
4. The API asks SSLCOMMERZ's Order Validation API about the payment and
   marks the order paid only when the transaction ID, the currency (BDT)
   and the amount all match the order.
5. The customer lands on the order confirmation page, which shows what
   the API reports.

## The rules

- **A browser is never believed.** The order is marked paid only after
  SSLCOMMERZ's server confirms it.
- **A failed or cancelled payment cancels the order** and returns its
  stock. The customer's cart is kept so they can try again. This only
  happens when the message carries SSLCOMMERZ's signature, because the
  callback addresses are public.
- **An online order cannot be confirmed or shipped until it is paid.**
- **Everything can arrive twice** (the customer's return and the server
  notification overlap) and is handled once.
- **Money that does not match** (wrong amount, wrong currency) is not
  accepted. The payment is set to `review` for a person to look at in
  the SSLCOMMERZ panel.
- **Cancelling a paid order** leaves it "paid". The admin shows a refund
  as due; refund it in the SSLCOMMERZ merchant panel and then use "Mark
  as refunded".

## In the admin

Orders show the payment method and status, how the customer paid, the
bank transaction ID and whether it was a test payment. Two actions:

- **Check with SSLCOMMERZ** asks the gateway what happened to an unpaid
  online order. Use it when a customer says they paid but the order still
  says "Not paid yet".
- **Mark as refunded** records that a refund was made. It does not send
  money.

## Data

- `orders.paymentMethod`, `orders.paymentStatus` and `orders.payment`
  (provider, channel, bank transaction ID, amount, time, risk, sandbox).
- `payments`: one record per online payment with everything the gateway
  reported and a list of events (`start`, `success`, `fail`, `cancel`,
  `ipn`, `check`). Use it to reconcile with the SSLCOMMERZ panel.

## Testing in the sandbox

Test cards from SSLCOMMERZ's documentation:

- VISA `4111111111111111`, expiry `12/26`, CVV `111`
- Mastercard `5111111111111111`, expiry `12/26`, CVV `111`
- Mobile OTP `111111` or `123456`

Try at least: a successful payment, a failed one, cancelling on the
payment page, and closing the payment page without finishing.

## Not included

- **Refunds through the API.** SSLCOMMERZ accepts refund requests only
  from a registered public IP address, and serverless hosting has none.
  Refund in the merchant panel.
- **Cancelling abandoned orders automatically.** If a customer closes
  the payment page without paying or cancelling, the order stays "Not
  paid yet" and holds its stock until it is cancelled in the admin.
- EMI and saved cards.
