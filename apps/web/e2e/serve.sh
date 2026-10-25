#!/bin/sh
# The API on an in-memory MongoDB and the production build, for Lighthouse CI
set -e
cd "$(dirname "$0")/.."
E2E_API_PORT=3101 npx tsx e2e/start-api.ts &
API_PROXY=http://127.0.0.1:3101 exec npx vite preview --host 127.0.0.1 --port 4173 --strictPort
