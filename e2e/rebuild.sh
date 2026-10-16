#!/usr/bin/env bash
# Build app trỏ tới backend giả lập e2e (cổng 54321).
set -e
cd "$(dirname "$0")/../apps/web"
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_PUBLISHABLE_KEY=local-anon-key npx vite build --outDir dist-e2e --emptyOutDir >/dev/null
echo "rebuilt"
