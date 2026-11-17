#!/usr/bin/env bash
# Builds a ready-to-upload ZIP for a cPanel "Setup Node.js App" host.
# Usage: bash deploy/cpanel/build-package.sh   ->  dist/bps-crm-cpanel.zip
set -euo pipefail
cd "$(dirname "$0")/../.."
npx prisma generate
npm run build
OUT=dist/bps-crm-cpanel
rm -rf "$OUT" "$OUT.zip"; mkdir -p "$OUT/.next"
cp -r .next/standalone/. "$OUT/"
cp -r .next/static "$OUT/.next/static"
cp -r public "$OUT/public"
cp -r prisma/migrations "$OUT/migrations"
cp deploy/cpanel/setup-db.js "$OUT/setup-db.js"
# setup-db.js needs these at runtime (Next bundles them into its own chunks)
for m in bcryptjs @prisma/client .prisma; do mkdir -p "$OUT/node_modules/$(dirname $m)"; [ -e "$OUT/node_modules/$m" ] || cp -r "node_modules/$m" "$OUT/node_modules/$m"; done
cp deploy/cpanel/env.example "$OUT/.env.example"
cp deploy/cpanel/README-cPanel.txt "$OUT/README-cPanel.txt"
rm -f "$OUT/.env"   # never ship local secrets
node -e '
const f=process.argv[1],p=require(f);
p.scripts={start:"node server.js","setup-db":"node setup-db.js"};
p.engines={node:">=18.18"};
require("fs").writeFileSync(f,JSON.stringify(p,null,2)+"\n")' "$PWD/$OUT/package.json"
(cd dist && zip -qr bps-crm-cpanel.zip bps-crm-cpanel)
ls -lh dist/bps-crm-cpanel.zip
