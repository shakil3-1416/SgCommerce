#!/usr/bin/env bash

set -u

FAILED=0

check_http() {
    NAME="$1"
    URL="$2"

    CODE="$(
        curl \
            -s \
            -o /tmp/sgcommerce-check-body \
            -w "%{http_code}" \
            --connect-timeout 2 \
            --max-time 5 \
            "$URL" 2>/dev/null || true
    )"

    if [ "$CODE" = "200" ]; then
        echo "[READY] $NAME -> $URL"
    else
        echo "[DOWN]  $NAME -> $URL (HTTP ${CODE:-000})"
        FAILED=1
    fi
}

echo
echo "SgCommerce readiness"
echo "------------------------------------------------------------"

check_http "Storefront" "http://127.0.0.1:3100"
check_http "Admin"      "http://127.0.0.1:3101"
check_http "API"        "http://127.0.0.1:4000/api/v1/health"

echo

exit "$FAILED"
