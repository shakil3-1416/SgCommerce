#!/usr/bin/env bash

set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RUNTIME="$ROOT/.runtime"

mkdir -p "$RUNTIME"

STORE_LOG="$RUNTIME/storefront.log"
ADMIN_LOG="$RUNTIME/admin.log"
API_LOG="$RUNTIME/api.log"

: > "$STORE_LOG"
: > "$ADMIN_LOG"
: > "$API_LOG"

STORE_PID=""
ADMIN_PID=""
API_PID=""

###############################################################################
# CLEANUP
###############################################################################

cleanup() {
    echo
    echo "Stopping SgCommerce..."

    for PID in "$STORE_PID" "$ADMIN_PID" "$API_PID"; do
        if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
            kill "$PID" 2>/dev/null || true
        fi
    done

    sleep 1

    for PID in "$STORE_PID" "$ADMIN_PID" "$API_PID"; do
        if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
            kill -9 "$PID" 2>/dev/null || true
        fi
    done
}

trap cleanup INT TERM EXIT

###############################################################################
# CLEAR OUR PORTS
###############################################################################

echo
echo "=================================================================="
echo "                    SGCOMMERCE DEV SUPERVISOR"
echo "=================================================================="
echo

for PORT in 3100 3101 4000; do

    if command -v lsof >/dev/null 2>&1; then

        PIDS="$(lsof -tiTCP:$PORT -sTCP:LISTEN 2>/dev/null || true)"

        if [ -n "$PIDS" ]; then
            echo "Clearing :$PORT -> $PIDS"
            kill $PIDS 2>/dev/null || true
            sleep 1

            LEFT="$(lsof -tiTCP:$PORT -sTCP:LISTEN 2>/dev/null || true)"

            if [ -n "$LEFT" ]; then
                kill -9 $LEFT 2>/dev/null || true
            fi
        else
            echo "[FREE] :$PORT"
        fi

    fi

done

###############################################################################
# INFRASTRUCTURE
###############################################################################

echo
echo "Starting MongoDB and Redis..."

docker compose up -d

docker compose ps

###############################################################################
# START APPLICATIONS INDEPENDENTLY
###############################################################################

echo
echo "Starting storefront..."

pnpm --filter storefront dev \
    > "$STORE_LOG" 2>&1 &

STORE_PID=$!

echo "  PID: $STORE_PID"
echo "  Log: $STORE_LOG"


echo
echo "Starting admin..."

pnpm --filter admin dev \
    > "$ADMIN_LOG" 2>&1 &

ADMIN_PID=$!

echo "  PID: $ADMIN_PID"
echo "  Log: $ADMIN_LOG"


echo
echo "Starting API..."

pnpm --filter api dev \
    > "$API_LOG" 2>&1 &

API_PID=$!

echo "  PID: $API_PID"
echo "  Log: $API_LOG"

###############################################################################
# READINESS
###############################################################################

echo
echo "Waiting for services..."

STORE_READY=0
ADMIN_READY=0
API_READY=0

for ATTEMPT in $(seq 1 60); do

    ###########################################################################
    # Detect early crashes
    ###########################################################################

    if ! kill -0 "$STORE_PID" 2>/dev/null; then
        echo
        echo "ERROR: Storefront process exited."
        echo "------------------------------------------------------------"
        tail -n 100 "$STORE_LOG" || true
        exit 1
    fi

    if ! kill -0 "$ADMIN_PID" 2>/dev/null; then
        echo
        echo "ERROR: Admin process exited."
        echo "------------------------------------------------------------"
        tail -n 100 "$ADMIN_LOG" || true
        exit 1
    fi

    if ! kill -0 "$API_PID" 2>/dev/null; then
        echo
        echo "ERROR: API process exited."
        echo "------------------------------------------------------------"
        tail -n 120 "$API_LOG" || true
        exit 1
    fi

    ###########################################################################
    # Storefront
    ###########################################################################

    STORE_CODE="$(
        curl \
            -s \
            -o /dev/null \
            -w "%{http_code}" \
            --connect-timeout 1 \
            --max-time 3 \
            http://127.0.0.1:3100 \
            2>/dev/null || true
    )"

    if [ "$STORE_CODE" = "200" ]; then
        STORE_READY=1
    fi

    ###########################################################################
    # Admin
    ###########################################################################

    ADMIN_CODE="$(
        curl \
            -s \
            -o /dev/null \
            -w "%{http_code}" \
            --connect-timeout 1 \
            --max-time 3 \
            http://127.0.0.1:3101 \
            2>/dev/null || true
    )"

    if [ "$ADMIN_CODE" = "200" ]; then
        ADMIN_READY=1
    fi

    ###########################################################################
    # API
    ###########################################################################

    API_BODY="$(
        curl \
            -s \
            --connect-timeout 1 \
            --max-time 3 \
            http://127.0.0.1:4000/api/v1/health \
            2>/dev/null || true
    )"

    if echo "$API_BODY" | grep -q '"status":"ok"'; then
        API_READY=1
    fi

    ###########################################################################
    # All ready
    ###########################################################################

    if [ "$STORE_READY" -eq 1 ] &&
       [ "$ADMIN_READY" -eq 1 ] &&
       [ "$API_READY" -eq 1 ]; then
        break
    fi

    sleep 1

done

###############################################################################
# FINAL CHECK
###############################################################################

echo
echo "=================================================================="

if [ "$STORE_READY" -eq 1 ]; then
    echo "[READY] Storefront  http://localhost:3100"
else
    echo "[FAIL]  Storefront"
fi

if [ "$ADMIN_READY" -eq 1 ]; then
    echo "[READY] Admin       http://localhost:3101"
else
    echo "[FAIL]  Admin"
fi

if [ "$API_READY" -eq 1 ]; then
    echo "[READY] API         http://localhost:4000/api/v1"
else
    echo "[FAIL]  API"
fi

echo "=================================================================="

if [ "$STORE_READY" -ne 1 ] ||
   [ "$ADMIN_READY" -ne 1 ] ||
   [ "$API_READY" -ne 1 ]; then

    echo
    echo "One or more services did not become ready."

    echo
    echo "===== STOREFRONT LOG ====="
    tail -n 80 "$STORE_LOG" || true

    echo
    echo "===== ADMIN LOG ====="
    tail -n 80 "$ADMIN_LOG" || true

    echo
    echo "===== API LOG ====="
    tail -n 100 "$API_LOG" || true

    exit 1
fi

###############################################################################
# DISPLAY API STATUS
###############################################################################

echo
echo "Health:"
curl -s http://127.0.0.1:4000/api/v1/health
echo

echo
echo "SupGent capabilities:"
curl -s http://127.0.0.1:4000/api/v1/integrations/supgent/capabilities
echo

echo
echo "Logs:"
echo "  Storefront : $STORE_LOG"
echo "  Admin      : $ADMIN_LOG"
echo "  API        : $API_LOG"

echo
echo "Press Ctrl+C to stop all SgCommerce services."
echo

###############################################################################
# MONITOR CHILDREN
###############################################################################

while true; do

    if ! kill -0 "$STORE_PID" 2>/dev/null; then
        echo
        echo "Storefront stopped unexpectedly:"
        tail -n 100 "$STORE_LOG" || true
        exit 1
    fi

    if ! kill -0 "$ADMIN_PID" 2>/dev/null; then
        echo
        echo "Admin stopped unexpectedly:"
        tail -n 100 "$ADMIN_LOG" || true
        exit 1
    fi

    if ! kill -0 "$API_PID" 2>/dev/null; then
        echo
        echo "API stopped unexpectedly:"
        tail -n 120 "$API_LOG" || true
        exit 1
    fi

    sleep 3

done
