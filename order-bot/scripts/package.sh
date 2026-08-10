#!/usr/bin/env bash
# Build with esbuild and pack only what the VPS needs.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npm run build

STAMP=$(date +%Y%m%d-%H%M%S)
OUT_DIR="$ROOT/release"
NAME="acr-order-bot-${STAMP}"
STAGE="$OUT_DIR/$NAME"
mkdir -p "$STAGE/dist" "$STAGE/public" "$STAGE/assets" "$STAGE/data"

cp -a "$ROOT/dist/server.js" "$ROOT/dist/package.json" "$STAGE/dist/"
# pg is external to the bundle — ship production deps for Postgres mode
cp "$ROOT/package.json" "$ROOT/package-lock.json" "$STAGE/" 2>/dev/null || cp "$ROOT/package.json" "$STAGE/"
( cd "$STAGE" && npm install --omit=dev --no-audit --no-fund ) || true
cp -a "$ROOT/public/." "$STAGE/public/"
if [[ -d "$ROOT/sql" ]]; then
  mkdir -p "$STAGE/sql"
  cp -a "$ROOT/sql/." "$STAGE/sql/"
fi
mkdir -p "$STAGE/scripts"
cp -a "$ROOT/scripts/db-migrate.mjs" "$ROOT/scripts/import-json-to-pg.mjs" "$STAGE/scripts/" 2>/dev/null || true
if [[ -f "$ROOT/docker-compose.yml" ]]; then
  cp -a "$ROOT/docker-compose.yml" "$STAGE/" 2>/dev/null || true
fi
if [[ -d "$ROOT/assets" ]]; then
  cp -a "$ROOT/assets/." "$STAGE/assets/" 2>/dev/null || true
fi
# empty data dir; production data stays on server
echo '{}' > "$STAGE/data/.gitkeep" 2>/dev/null || true
cp "$ROOT/.env.example" "$STAGE/.env.example"
cat > "$STAGE/ecosystem.config.cjs" <<'EOF'
/** pm2 — keep name unique so other pilot apps are untouched */
module.exports = {
  apps: [
    {
      name: 'acr-order-bot',
      cwd: __dirname,
      script: 'dist/server.js',
      interpreter: 'node',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        TZ: 'Asia/Kolkata',
      },
    },
  ],
};
EOF

cat > "$STAGE/README-DEPLOY.txt" <<'EOF'
1. Extract to /opt/order-bot (or merge over old deploy)
2. Keep existing .env or copy .env.example → .env and fill secrets
3. Production requires Postgres:
   - Install PostgreSQL (see SETUP-VPS.md)
   - DATABASE_URL=postgres://... in .env
   - npm run db:migrate
   - optional once: npm run db:import-json  (from data/orders.json)
4. Razorpay test/live keys + PUBLIC_BASE_URL=https://order.ammachethiruchulu.co.in
   - UPI_FALLBACK=0 recommended (Razorpay only)
5. pm2 start ecosystem.config.cjs  OR  pm2 restart acr-order-bot
6. curl -s http://127.0.0.1:3000/health
   # expect "driver":"pg" and "env":"production"
EOF

TAR="$OUT_DIR/${NAME}.tar.gz"
mkdir -p "$OUT_DIR"
tar -czf "$TAR" -C "$OUT_DIR" "$NAME"
echo "Release: $TAR"
ls -lh "$TAR"
