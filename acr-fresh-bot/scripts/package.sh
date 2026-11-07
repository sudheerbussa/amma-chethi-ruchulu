#!/usr/bin/env bash
# Build with esbuild and pack only what the VPS needs.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

npm run build

STAMP=$(date +%Y%m%d-%H%M%S)
OUT_DIR="$ROOT/release"
NAME="acr-fresh-bot-${STAMP}"
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
cp -a "$ROOT/scripts/db-migrate.mjs" "$ROOT/scripts/import-json-to-pg.mjs" "$ROOT/scripts/db-migrate-marketing.mjs" "$ROOT/scripts/configure-marketing-env.mjs" "$ROOT/scripts/verify-delivery-status.mjs" "$STAGE/scripts/"
mkdir -p "$STAGE/docs"
cp -a "$ROOT/docs/MARKETING-TEMPLATES.md" "$ROOT/docs/MARKETING-DEPLOY.md" "$ROOT/docs/DELIVERY-TRACKING.md" "$STAGE/docs/"
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
      name: 'acr-fresh-bot',
      cwd: __dirname,
      script: 'dist/server.js',
      interpreter: 'node',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
        TZ: 'Asia/Kolkata',
      },
    },
  ],
};
EOF

cat > "$STAGE/README-DEPLOY.txt" <<'EOF'
1. Extract to /opt/acr-fresh-bot (sister of /opt/order-bot — do not merge)
2. Keep existing .env or copy .env.example → .env and fill secrets
3. Production requires Postgres:
   - DATABASE_URL=postgres://.../acr_fresh in .env (separate DB from food bot)
   - npm run db:migrate
4. Razorpay + PUBLIC_BASE_URL=https://fresh.ammachethiruchulu.co.in
5. pm2 start ecosystem.config.cjs  OR  pm2 restart acr-fresh-bot
6. curl -s http://127.0.0.1:3001/health
   # expect "business":"ACR-Fresh", "driver":"pg"
EOF

TAR="$OUT_DIR/${NAME}.tar.gz"
mkdir -p "$OUT_DIR"
tar -czf "$TAR" -C "$OUT_DIR" "$NAME"
echo "Release: $TAR"
ls -lh "$TAR"
