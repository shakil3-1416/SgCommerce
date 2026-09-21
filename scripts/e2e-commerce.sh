#!/usr/bin/env bash

set -Eeuo pipefail

API="${API_URL:-http://127.0.0.1:4000/api/v1}"

CATEGORY_SLUG="e2e-smoke"
PRODUCT_SLUG="e2e-smoke-product"
SKU="E2E-SMOKE-001"
PHONE="01700000001"

json_field() {
  python3 -c \
    "import sys,json; print(json.load(sys.stdin)$1)"
}

echo
echo "============================================================"
echo " SGCOMMERCE FULL E2E SMOKE TEST"
echo "============================================================"

###############################################################################
# HEALTH
###############################################################################

echo "[1] Health"

HEALTH="$(
  curl -fsS \
    "$API/health"
)"

echo "$HEALTH" |
  python3 -m json.tool

###############################################################################
# CATEGORY FIXTURE
###############################################################################

echo
echo "[2] Category fixture"

CATEGORY_CODE="$(
  curl -s \
    -o /tmp/sg-e2e-category.json \
    -w '%{http_code}' \
    "$API/categories/$CATEGORY_SLUG"
)"

if [ "$CATEGORY_CODE" = "404" ]; then

  curl -fsS \
    -X POST \
    "$API/categories" \
    -H 'Content-Type: application/json' \
    -d '{
      "name":"E2E Smoke",
      "slug":"e2e-smoke",
      "description":"Automated commerce regression fixture",
      "active":true
    }' \
    >/tmp/sg-e2e-category.json

fi

cat /tmp/sg-e2e-category.json |
  python3 -m json.tool

###############################################################################
# PRODUCT FIXTURE
###############################################################################

echo
echo "[3] Product fixture"

PRODUCT_CODE="$(
  curl -s \
    -o /tmp/sg-e2e-product.json \
    -w '%{http_code}' \
    "$API/products/$PRODUCT_SLUG"
)"

if [ "$PRODUCT_CODE" = "404" ]; then

  curl -fsS \
    -X POST \
    "$API/products" \
    -H 'Content-Type: application/json' \
    -d '{
      "name":"E2E Smoke Product",
      "slug":"e2e-smoke-product",
      "description":"Automated regression test product",
      "category":"e2e-smoke",
      "brand":"SgTest",
      "images":[],
      "active":true,
      "variants":[
        {
          "sku":"E2E-SMOKE-001",
          "title":"Default",
          "attributes":{
            "color":"Purple"
          },
          "price":500,
          "active":true
        }
      ]
    }' \
    >/tmp/sg-e2e-product.json

fi

cat /tmp/sg-e2e-product.json |
  python3 -m json.tool

###############################################################################
# RESET INVENTORY
###############################################################################

echo
echo "[4] Inventory = 10"

curl -fsS \
  -X PUT \
  "$API/inventory/$SKU" \
  -H 'Content-Type: application/json' \
  -d '{
    "onHand":10,
    "reserved":0,
    "reorderLevel":2
  }' \
  >/tmp/sg-e2e-stock.json

cat /tmp/sg-e2e-stock.json |
  python3 -m json.tool

###############################################################################
# PLACE ORDER
###############################################################################

echo
echo "[5] Place COD order"

ORDER="$(
  curl -fsS \
    -X POST \
    "$API/orders" \
    -H 'Content-Type: application/json' \
    -d "{
      \"customer\":{
        \"name\":\"E2E Customer\",
        \"phone\":\"$PHONE\",
        \"email\":\"e2e@example.com\"
      },
      \"shippingAddress\":{
        \"addressLine1\":\"123 Test Road\",
        \"city\":\"Dhaka\",
        \"area\":\"Test Area\",
        \"zone\":\"inside_dhaka\"
      },
      \"items\":[
        {
          \"sku\":\"$SKU\",
          \"quantity\":1
        }
      ]
    }"
)"

echo "$ORDER" |
  python3 -m json.tool

ORDER_NUMBER="$(
  printf '%s' "$ORDER" |
  python3 -c \
    'import sys,json; print(json.load(sys.stdin)["orderNumber"])'
)"

echo "Order: $ORDER_NUMBER"

###############################################################################
# STOCK MUST DROP 10 -> 9
###############################################################################

echo
echo "[6] Verify inventory decreased"

STOCK="$(
  curl -fsS \
    "$API/inventory/$SKU"
)"

AVAILABLE="$(
  printf '%s' "$STOCK" |
  python3 -c \
    'import sys,json; print(json.load(sys.stdin)["available"])'
)"

if [ "$AVAILABLE" != "9" ]; then
  echo "FAIL: expected available=9, got $AVAILABLE"
  exit 1
fi

echo "PASS available=$AVAILABLE"

###############################################################################
# ORDER LIFECYCLE
###############################################################################

for STATUS in \
  confirmed \
  processing
do

  echo
  echo "[ORDER] -> $STATUS"

  curl -fsS \
    -X PATCH \
    "$API/orders/$ORDER_NUMBER/status" \
    -H 'Content-Type: application/json' \
    -d "{
      \"status\":\"$STATUS\"
    }" \
    >/dev/null

done

echo
echo "[ORDER] -> shipped"

curl -fsS \
  -X PATCH \
  "$API/orders/$ORDER_NUMBER/status" \
  -H 'Content-Type: application/json' \
  -d '{
    "status":"shipped",
    "trackingNumber":"SG-E2E-TRACK-001"
  }' \
  >/dev/null

echo
echo "[ORDER] -> delivered"

curl -fsS \
  -X PATCH \
  "$API/orders/$ORDER_NUMBER/status" \
  -H 'Content-Type: application/json' \
  -d '{
    "status":"delivered",
    "trackingNumber":"SG-E2E-TRACK-001"
  }' \
  >/dev/null

###############################################################################
# CUSTOMER TRACKING
###############################################################################

echo
echo "[7] Customer tracking"

TRACK="$(
  curl -fsS \
    "$API/orders/track/$ORDER_NUMBER?phone=$PHONE"
)"

echo "$TRACK" |
  python3 -m json.tool

TRACK_STATUS="$(
  printf '%s' "$TRACK" |
  python3 -c \
    'import sys,json; print(json.load(sys.stdin)["status"])'
)"

if [ "$TRACK_STATUS" != "delivered" ]; then
  echo "FAIL: tracking status is $TRACK_STATUS"
  exit 1
fi

###############################################################################
# CREATE RETURN
###############################################################################

echo
echo "[8] Create return"

RETURN="$(
  curl -fsS \
    -X POST \
    "$API/returns" \
    -H 'Content-Type: application/json' \
    -d "{
      \"orderNumber\":\"$ORDER_NUMBER\",
      \"phone\":\"$PHONE\",
      \"items\":[
        {
          \"sku\":\"$SKU\",
          \"quantity\":1
        }
      ],
      \"reason\":\"not_as_expected\",
      \"details\":\"Automated E2E return\"
    }"
)"

echo "$RETURN" |
  python3 -m json.tool

RETURN_NUMBER="$(
  printf '%s' "$RETURN" |
  python3 -c \
    'import sys,json; print(json.load(sys.stdin)["returnNumber"])'
)"

###############################################################################
# RETURN LIFECYCLE
###############################################################################

for STATUS in \
  approved \
  received \
  completed
do

  echo
  echo "[RETURN] -> $STATUS"

  curl -fsS \
    -X PATCH \
    "$API/returns/$RETURN_NUMBER/status" \
    -H 'Content-Type: application/json' \
    -d "{
      \"status\":\"$STATUS\"
    }" \
    >/tmp/sg-e2e-return.json

done

###############################################################################
# INVENTORY MUST RESTORE 9 -> 10
###############################################################################

echo
echo "[9] Verify return restocked inventory"

STOCK="$(
  curl -fsS \
    "$API/inventory/$SKU"
)"

AVAILABLE="$(
  printf '%s' "$STOCK" |
  python3 -c \
    'import sys,json; print(json.load(sys.stdin)["available"])'
)"

if [ "$AVAILABLE" != "10" ]; then
  echo "FAIL: expected available=10 after return, got $AVAILABLE"
  exit 1
fi

echo "PASS available=$AVAILABLE"

###############################################################################
# REFUND MUST EXIST
###############################################################################

echo
echo "[10] Verify refund created"

REFUNDS="$(
  curl -fsS \
    "$API/refunds"
)"

REFUND_NUMBER="$(
  printf '%s' "$REFUNDS" |
  RETURN_NUMBER="$RETURN_NUMBER" \
  python3 -c '
import os, sys, json
items=json.load(sys.stdin)
target=os.environ["RETURN_NUMBER"]
matches=[x for x in items if x["returnNumber"]==target]
if not matches:
    raise SystemExit(1)
print(matches[0]["refundNumber"])
'
)"

echo "Refund: $REFUND_NUMBER"

###############################################################################
# COMPLETE REFUND
###############################################################################

echo
echo "[11] Complete refund"

curl -fsS \
  -X PATCH \
  "$API/refunds/$REFUND_NUMBER" \
  -H 'Content-Type: application/json' \
  -d '{
    "status":"completed",
    "note":"E2E smoke test completed"
  }' \
  >/tmp/sg-e2e-refund.json

cat /tmp/sg-e2e-refund.json |
  python3 -m json.tool

REFUND_STATUS="$(
  python3 -c \
    'import json; print(json.load(open("/tmp/sg-e2e-refund.json"))["status"])'
)"

if [ "$REFUND_STATUS" != "completed" ]; then
  echo "FAIL: refund did not complete"
  exit 1
fi

###############################################################################
# FINAL RESULT
###############################################################################

echo
echo "============================================================"
echo " E2E PASS"
echo "============================================================"
echo "Product           PASS"
echo "Inventory         PASS"
echo "Customer          PASS"
echo "Checkout          PASS"
echo "COD order         PASS"
echo "Stock deduction   PASS"
echo "Shipping status   PASS"
echo "Tracking          PASS"
echo "Delivery          PASS"
echo "Return request    PASS"
echo "Return restock    PASS"
echo "Refund creation   PASS"
echo "Refund completion PASS"
echo "============================================================"
