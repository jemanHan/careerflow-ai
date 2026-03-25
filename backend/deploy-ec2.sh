#!/usr/bin/env bash
# EC2(Amazon Linux / Ubuntu)에서 backend 폴더 안에서 실행.
# 사전: Node 20+, .env, PostgreSQL(DATABASE_URL) 준비
set -euo pipefail
cd "$(dirname "$0")"

echo "== npm ci =="
npm ci

echo "== prisma generate =="
npx prisma generate

echo "== prisma migrate deploy =="
npx prisma migrate deploy

echo "== nest build =="
npm run build

echo "== pm2 =="
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete careerflow-backend 2>/dev/null || true
  pm2 start ecosystem.config.cjs
  pm2 save
  echo "Done. Check: pm2 logs careerflow-backend"
else
  echo "PM2 not installed. Install: npm i -g pm2"
  echo "Or run once: NODE_ENV=production node dist/main.js"
  exit 1
fi
