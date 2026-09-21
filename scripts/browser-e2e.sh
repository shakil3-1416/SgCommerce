#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .runtime/local-admin.env ]; then
  echo "Missing .runtime/local-admin.env"
  exit 1
fi

set -a
source .runtime/local-admin.env
set +a

export SG_E2E_ADMIN_EMAIL="$SG_ADMIN_EMAIL"
export SG_E2E_ADMIN_PASSWORD="$SG_ADMIN_PASSWORD"

CHROME_BIN="$(
  command -v google-chrome 2>/dev/null ||
  command -v google-chrome-stable 2>/dev/null ||
  command -v chromium 2>/dev/null ||
  command -v chromium-browser 2>/dev/null ||
  true
)"

if [ -z "$CHROME_BIN" ]; then
  echo "Chrome/Chromium not found"
  exit 1
fi

export CHROME_BIN

pnpm exec playwright test \
  e2e/sgcommerce.spec.ts \
  --workers=1
