#!/usr/bin/env bash

set -u

PORTS=(3100 3101 4000)

echo
echo "Checking SgCommerce ports..."

for PORT in "${PORTS[@]}"; do

    PIDS=""

    if command -v lsof >/dev/null 2>&1; then
        PIDS="$(lsof -tiTCP:${PORT} -sTCP:LISTEN 2>/dev/null || true)"

    elif command -v fuser >/dev/null 2>&1; then
        PIDS="$(fuser ${PORT}/tcp 2>/dev/null || true)"
    fi

    if [ -z "${PIDS// /}" ]; then
        echo "[FREE] :${PORT}"
        continue
    fi

    echo "[BUSY] :${PORT}"
    echo "PID(s): ${PIDS}"

    for PID in $PIDS; do

        if [ -r "/proc/$PID/cmdline" ]; then
            CMD="$(tr '\0' ' ' < "/proc/$PID/cmdline" 2>/dev/null || true)"
            echo "  PID $PID -> $CMD"
        fi

        kill "$PID" 2>/dev/null || true

    done

    sleep 1

    if command -v lsof >/dev/null 2>&1; then
        REMAINING="$(lsof -tiTCP:${PORT} -sTCP:LISTEN 2>/dev/null || true)"

        if [ -n "$REMAINING" ]; then
            echo "Force stopping :${PORT} -> ${REMAINING}"
            kill -9 $REMAINING 2>/dev/null || true
        fi
    fi

done

echo
