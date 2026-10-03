#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"

echo ""
echo "Continuity Studio - Free Local Mode"
echo "==================================="

command -v node >/dev/null 2>&1 || {
  echo "[ERROR] Node.js 24 or newer is required."
  exit 1
}

command -v docker >/dev/null 2>&1 || {
  echo "[ERROR] Docker is required."
  exit 1
}

docker info >/dev/null 2>&1 || {
  echo "[ERROR] Docker is installed but not running."
  exit 1
}

if ! command -v pnpm >/dev/null 2>&1; then
  command -v corepack >/dev/null 2>&1 || {
    echo "[ERROR] pnpm was not found and Corepack is unavailable."
    exit 1
  }
  corepack enable
fi

if [ ! -d node_modules ]; then
  pnpm install --no-frozen-lockfile
fi

exec pnpm local:dev
