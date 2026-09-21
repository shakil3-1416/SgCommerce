#!/usr/bin/env bash

set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT"

LOG_DIR="$ROOT/.runtime"
LOG_FILE="$LOG_DIR/dev.log"

mkdir -p "$LOG_DIR"
: > "$LOG_FILE"

cleanup() {

    if [ -n "${DEV_PID:-}" ]; then

        echo
        echo "Stopping SgCommerce development processes..."

        kill -TERM -- "-$DEV_PID" 2>/dev/null || \
        kill -TERM "$DEV_PID" 2>/dev/null || true

        sleep 1

        kill -KILL -- "-$DEV_PID" 2>/dev/null || true

    fi
}

trap cleanup INT TERM EXIT

echo
echo "======================================================================"
echo "                     SGCOMMERCE DEV START"
echo "======================================================================"
echo

###############################################################################
# CLEAR PORTS
###############################################################################

bash scripts/clear-dev-ports.sh

###############################################################################
# INFRASTRUCTURE
###############################################################################

echo "Starting MongoDB and Redis..."

docker compose up -d

echo

docker compose ps

echo

###############################################################################
# VERIFY PORTS BEFORE START
###############################################################################

for PORT in 3100 3101 4000; do

    if command -v lsof >/dev/null 2>&1 &&
       lsof -tiTCP:${PORT} -sTCP:LISTEN >/dev/null 2>&1; then

        echo "ERROR: Port ${PORT} is occupied before SgCommerce launch."

        lsof -nP -iTCP:${PORT} -sTCP:LISTEN || true

        exit 1
    fi

done

###############################################################################
# START APPLICATIONS IN THEIR OWN PROCESS GROUP
###############################################################################

echo "Starting Storefront + Admin + API..."
echo

if command -v setsid >/dev/null 2>&1; then

    setsid pnpm dev \
        > >(tee -a "$LOG_FILE") \
        2>&1 &

    DEV_PID=$!

else

    pnpm dev \
        > >(tee -a "$LOG_FILE") \
        2>&1 &

    DEV_PID=$!

fi

###############################################################################
# WAIT FOR READINESS
###############################################################################

echo
echo "Waiting for application readiness..."

READY=0

for ATTEMPT in $(seq 1 60); do

    # Dev process exited unexpectedly
    if ! kill -0 "$DEV_PID" 2>/dev/null; then

        echo
        echo "ERROR: SgCommerce dev process terminated during startup."
        echo
        echo "Last log output:"
        echo "------------------------------------------------------------"

        tail -n 100 "$LOG_FILE" || true

        exit 1
    fi

    STORE_CODE="$(
        curl -s -o /dev/null -w "%{http_code}" \
        --connect-timeout 1 \
        --max-time 2 \
        http://127.0.0.1:3100 2>/dev/null || true
    )"

    ADMIN_CODE="$(
        curl -s -o /dev/null -w "%{http_code}" \
        --connect-timeout 1 \
        --max-time 2 \
        http://127.0.0.1:3101 2>/dev/null || true
    )"

    API_BODY="$(
        curl -s \
        --connect-timeout 1 \
        --max-time 2 \
        http://127.0.0.1:4000/api/v1/health 2>/dev/null || true
    )"

    if [ "$STORE_CODE" = "200" ] &&
       [ "$ADMIN_CODE" = "200" ] &&
       printf '%s' "$API_BODY" | grep -q '"status":"ok"'; then

        READY=1
        break

    fi

    sleep 1

done

###############################################################################
# FINAL READINESS RESULT
###############################################################################

if [ "$READY" -ne 1 ]; then

    echo
    echo "ERROR: SgCommerce did not become healthy."
    echo

    bash scripts/check-dev.sh || true

    echo
    echo "Last logs:"
    echo "------------------------------------------------------------"

    tail -n 120 "$LOG_FILE" || true

    exit 1
fi

echo
echo "======================================================================"
echo "                       SGCOMMERCE READY"
echo "======================================================================"
echo
echo "Storefront"
echo "  http://localhost:3100"
echo
echo "Admin"
echo "  http://localhost:3101"
echo
echo "API"
echo "  http://localhost:4000/api/v1"
echo
echo "Health"
echo "  http://localhost:4000/api/v1/health"
echo
echo "SupGent Commerce"
echo "  http://localhost:4000/api/v1/integrations/supgent/capabilities"
echo
echo "MongoDB"
echo "  mongodb://localhost:27017/sgcommerce"
echo
echo "Redis"
echo "  redis://localhost:6379"
echo
echo "Logs"
echo "  $LOG_FILE"
echo
echo "Press Ctrl+C to stop the development stack."
echo "======================================================================"
echo

wait "$DEV_PID"
