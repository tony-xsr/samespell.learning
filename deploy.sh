#!/usr/bin/env bash
# deploy.sh — deploy samespell.learning lên server Ubuntu 22.04 riêng (thay cho Vercel). Chạy trên Mac.
#
#   ./deploy.sh            build + chạy lại app (lần đầu tự cài Docker/Nginx/Certbot, Redis, SSL, cron)
#   ./deploy.sh migrate    copy toàn bộ dữ liệu Upstash → Redis trên server (1 lần; FORCE=1 để ghi đè)
#   ./deploy.sh logs       xem log app
#   ./deploy.sh rollback   quay về image của lần deploy trước
#
# Đọc từ .env.local (cả file này cũng được gửi lên server làm biến môi trường của app):
#   SERVER_HOST=1.2.3.4   SERVER_USER=root   DOMAIN=learn.example.com
#   APP_PORT=3010 (tuỳ chọn)   APP_DIR=/opt/apps/samespell (tuỳ chọn)
#   SSL=cloudflare (mặc định — HTTPS do Cloudflare proxy lo, giống pm.tungtran.dev) | certbot
#
# Chạy song song với app khác (vd. pm.tungtran.dev) mà không đụng nhau: container, network, volume,
# Redis, cổng, file nginx, cron đều mang tên riêng "samespell"; Redis là container riêng trong
# network riêng, không mở cổng ra host.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")"

ENV_FILE=.env.local
[ -f "$ENV_FILE" ] || { echo "ERROR: thiếu $ENV_FILE" >&2; exit 1; }

env_get() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -E 's/[[:space:]]+#.*$//' | tr -d "\"'" | xargs; }

SERVER_HOST=$(env_get SERVER_HOST)
SERVER_USER=$(env_get SERVER_USER); SERVER_USER=${SERVER_USER:-root}
DOMAIN=$(env_get DOMAIN)
APP_PORT=$(env_get APP_PORT); APP_PORT=${APP_PORT:-3010}
APP_DIR=$(env_get APP_DIR); APP_DIR=${APP_DIR:-/opt/apps/samespell}
SSL=$(env_get SSL); SSL=${SSL:-cloudflare}
[ -n "$SERVER_HOST" ] && [ -n "$DOMAIN" ] || { echo "ERROR: đặt SERVER_HOST và DOMAIN trong $ENV_FILE" >&2; exit 1; }

TARGET="$SERVER_USER@$SERVER_HOST"
SSH_OPTS=(-o ControlMaster=auto -o "ControlPath=$HOME/.ssh/cm-%r@%h:%p" -o ControlPersist=120)
# Đọc hết script từ stdin rồi mới chạy (bash -c "$(cat)") để lệnh con không "ăn" phần còn lại của script.
remote() {
  ssh "${SSH_OPTS[@]}" "$TARGET" \
    "export APP_DIR='$APP_DIR' APP_PORT='$APP_PORT' DOMAIN='$DOMAIN' SSL='$SSL' FORCE='${FORCE:-}'; bash -c \"\$(cat)\""
}

case "${1:-deploy}" in
# ──────────────────────────────────────────────────────────────────────────────
logs) exec ssh "${SSH_OPTS[@]}" -t "$TARGET" "docker logs -f --tail 200 samespell" ;;

# ──────────────────────────────────────────────────────────────────────────────
rollback)
  remote <<'REMOTE'
set -euo pipefail
docker image inspect samespell:prev >/dev/null 2>&1 || { echo "Không có image trước đó."; exit 1; }
docker tag samespell:prev samespell:latest
docker rm -f samespell >/dev/null
bash "$APP_DIR/run-app.sh"
echo "✅  Đã rollback."
REMOTE
  ;;

# ──────────────────────────────────────────────────────────────────────────────
migrate)
  remote <<'REMOTE'
set -euo pipefail
# Container node dùng 1 lần, cùng network với Redis — không phụ thuộc node_modules trong image app.
docker run --rm -i --network samespell-net --env-file "$APP_DIR/.env" \
  -e REDIS_URL=redis://samespell-redis:6379 -e FORCE="$FORCE" -w /tmp node:20-alpine sh -c '
  npm i --silent --no-audit --no-fund @upstash/redis ioredis >/dev/null && node -' <<'NODE'
const { Redis } = require("@upstash/redis");
const IORedis = require("ioredis");
(async () => {
  const up = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
    automaticDeserialization: false,
  });
  const local = new IORedis(process.env.REDIS_URL);
  const existing = await local.dbsize();
  if (existing > 0 && !process.env.FORCE) {
    console.log(`Redis trên server đã có ${existing} key — bỏ qua. Chạy FORCE=1 ./deploy.sh migrate để ghi đè.`);
    process.exit(0);
  }
  let cursor = "0", copied = 0, skipped = 0;
  do {
    const [next, keys] = await up.scan(cursor, { count: 200 });
    cursor = String(next);
    for (const key of keys) {
      const type = await up.type(key);
      if (type !== "string") { console.warn(`  bỏ qua ${key} (kiểu ${type})`); skipped++; continue; }
      const value = await up.get(key);
      if (value !== null) { await local.set(key, value); copied++; }
    }
  } while (cursor !== "0");
  console.log(`✅  Đã copy ${copied} key từ Upstash (bỏ qua ${skipped}).`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
NODE
REMOTE
  ;;

# ──────────────────────────────────────────────────────────────────────────────
deploy)
  echo "==> Chuẩn bị file môi trường"
  TMP_ENV=$(mktemp)
  trap 'rm -f "$TMP_ENV"' EXIT
  # docker --env-file không hiểu dấu nháy / comment cuối dòng → làm sạch trước khi gửi.
  awk '
    /^[[:space:]]*(#|$)/ { next }
    index($0, "=") == 0  { next }
    {
      line = $0; sub(/[[:space:]]+#.*$/, "", line)
      i = index(line, "="); k = substr(line, 1, i - 1); v = substr(line, i + 1)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", k); gsub(/^[[:space:]]+|[[:space:]]+$/, "", v)
      if (v ~ /^".*"$/ || v ~ /^\047.*\047$/) v = substr(v, 2, length(v) - 2)
      print k "=" v
    }' "$ENV_FILE" > "$TMP_ENV"
  grep -q '^CRON_SECRET=.' "$TMP_ENV" || echo "CRON_SECRET=$(openssl rand -hex 24)" >> "$TMP_ENV"

  echo "==> Đồng bộ mã nguồn → $TARGET:$APP_DIR"
  ssh "${SSH_OPTS[@]}" "$TARGET" "mkdir -p '$APP_DIR'"
  rsync -az --delete -e "ssh ${SSH_OPTS[*]}" \
    --exclude node_modules --exclude .next --exclude .git --exclude .vercel \
    --exclude '.env*' --exclude '*.env*' --exclude .DS_Store --exclude '*.tsbuildinfo' \
    --exclude '/run-app.sh' --exclude '/.cron-header' \
    ./ "$TARGET:$APP_DIR/"
  # Gửi qua ssh thay vì rsync --chmod (openrsync trên macOS không hỗ trợ); umask 077 → file chỉ root đọc.
  ssh "${SSH_OPTS[@]}" "$TARGET" "umask 077 && cat > '$APP_DIR/.env'" < "$TMP_ENV"

  remote <<'REMOTE'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
SUDO=""; [ "$(id -u)" -ne 0 ] && SUDO=sudo
cd "$APP_DIR"

# ── 1. Phần mềm hệ thống (chỉ cài khi thiếu — server đang chạy app khác thì bỏ qua) ──
if ! command -v docker >/dev/null; then
  echo "==> Cài Docker"
  curl -fsSL https://get.docker.com | $SUDO sh
  $SUDO systemctl enable --now docker
fi
PKGS=""
command -v nginx   >/dev/null || PKGS="$PKGS nginx"
[ "$SSL" = certbot ] && ! command -v certbot >/dev/null && PKGS="$PKGS certbot python3-certbot-nginx"
command -v curl    >/dev/null || PKGS="$PKGS curl"
if [ -n "$PKGS" ]; then
  echo "==> Cài:$PKGS"
  $SUDO apt-get update -y -qq && $SUDO apt-get install -y -qq $PKGS
  $SUDO systemctl enable --now nginx
fi

# next build cần thêm ~1.5GB RAM lúc build — server chưa có swap thì thêm 2GB để build không làm
# các app khác bị OOM kill.
if [ "$(swapon --show | wc -l)" -eq 0 ]; then
  echo "==> Chưa có swap — tạo /swapfile 2GB"
  $SUDO fallocate -l 2G /swapfile && $SUDO chmod 600 /swapfile
  $SUDO mkswap /swapfile >/dev/null && $SUDO swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
fi

# Cổng APP_PORT phải chưa bị app khác chiếm.
LISTENING=$(ss -ltn); RUNNING=$(docker ps --format '{{.Names}} {{.Ports}}')
if grep -q ":$APP_PORT " <<<"$LISTENING" && ! grep -q "^samespell .*:$APP_PORT->" <<<"$RUNNING"; then
  echo "ERROR: cổng $APP_PORT đang được dùng bởi tiến trình khác — đổi APP_PORT trong .env.local" >&2
  exit 1
fi

# ── 2. Redis riêng (container nhỏ, không mở cổng ra ngoài, dữ liệu trong volume) ──
docker network inspect samespell-net >/dev/null 2>&1 || docker network create samespell-net >/dev/null
if [ "$(docker inspect -f '{{.State.Running}}' samespell-redis 2>/dev/null)" != "true" ]; then
  echo "==> Khởi động Redis (samespell-redis)"
  docker rm -f samespell-redis >/dev/null 2>&1 || true
  docker run -d --name samespell-redis --network samespell-net --restart unless-stopped \
    -v samespell-redis-data:/data --memory 256m \
    --log-opt max-size=5m --log-opt max-file=2 \
    redis:7-alpine redis-server --appendonly yes --save 300 1 --loglevel warning >/dev/null
fi

# ── 3. Build image (Next.js standalone, ~200MB) ──
echo "==> Build image"
docker image inspect samespell:latest >/dev/null 2>&1 && docker tag samespell:latest samespell:prev
DOCKER_BUILDKIT=1 docker build -t samespell:latest -f - . <<'DOCKERFILE'
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=3072
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
# Từ điển kuromoji (furigana tiếng Nhật) được đọc qua fs lúc chạy nên standalone không tự kèm.
COPY --from=builder --chown=node:node /app/node_modules/kuromoji/dict ./node_modules/kuromoji/dict
USER node
EXPOSE 3000
CMD ["node", "server.js"]
DOCKERFILE

# ── 4. Chạy app (script riêng để rollback dùng lại) ──
cat > "$APP_DIR/run-app.sh" <<RUN
#!/usr/bin/env bash
docker run -d --name samespell --network samespell-net --restart unless-stopped \\
  --env-file "$APP_DIR/.env" -e REDIS_URL=redis://samespell-redis:6379 \\
  -e NODE_OPTIONS=--max-old-space-size=512 --memory 768m \\
  -p 127.0.0.1:$APP_PORT:3000 \\
  --log-opt max-size=10m --log-opt max-file=3 \\
  samespell:latest >/dev/null
RUN
docker rm -f samespell >/dev/null 2>&1 || true
bash "$APP_DIR/run-app.sh"

echo "==> Chờ app khởi động"
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$APP_PORT/login" || true)
  if [ "$code" = "200" ]; then echo "    ✅  app chạy ở 127.0.0.1:$APP_PORT"; break; fi
  if [ "$i" = 30 ]; then echo "ERROR: app không lên — docker logs samespell:" >&2; docker logs --tail 50 samespell >&2; exit 1; fi
  sleep 2
done

# ── 5. Nginx (chỉ tạo lần đầu để không đè phần SSL certbot đã thêm) ──
CONF="/etc/nginx/sites-available/$DOMAIN"
if [ ! -f "$CONF" ]; then
  echo "==> Tạo Nginx site $DOMAIN → 127.0.0.1:$APP_PORT"
  $SUDO tee "$CONF" >/dev/null <<NGINX
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 20M;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml image/svg+xml;

    location /_next/static/ {
        proxy_pass http://127.0.0.1:$APP_PORT;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        proxy_pass         http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;   # các route AI sinh từ vựng có thể chạy lâu
    }
}
NGINX
  $SUDO ln -sf "$CONF" "/etc/nginx/sites-enabled/$DOMAIN"
  $SUDO nginx -t && $SUDO systemctl reload nginx
fi

# ── 6. HTTPS ──
# Mặc định: Cloudflare proxy (đám mây cam) cấp HTTPS như các site khác trên server — origin chỉ cần :80.
# Cookie đăng nhập là Secure nên phải truy cập qua https:// của Cloudflare.
if [ "$SSL" = certbot ] && [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  echo "==> Xin chứng chỉ SSL cho $DOMAIN"
  $SUDO certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect \
    || echo "    ⚠  certbot lỗi — kiểm tra DNS $DOMAIN đã trỏ về server chưa, rồi chạy lại ./deploy.sh"
fi

# ── 7. Cron thay cho Vercel Cron (snapshot backup 18:00 UTC mỗi ngày) ──
CRON_SECRET=$(grep -E '^CRON_SECRET=' "$APP_DIR/.env" | cut -d= -f2-)
printf 'Authorization: Bearer %s\n' "$CRON_SECRET" > "$APP_DIR/.cron-header"
chmod 600 "$APP_DIR/.cron-header"
echo "0 18 * * * root curl -fsS -m 120 -H @$APP_DIR/.cron-header http://127.0.0.1:$APP_PORT/api/cron/backup-snapshot >/dev/null 2>&1" \
  | $SUDO tee /etc/cron.d/samespell >/dev/null
$SUDO chmod 644 /etc/cron.d/samespell

docker image prune -f >/dev/null
# Build cache của Docker phình rất nhanh (mỗi lần build vài trăm MB) — giữ tối đa 3GB.
docker builder prune -f --keep-storage 3GB >/dev/null
echo ""
echo "✅  Deploy xong: https://$DOMAIN"
docker stats --no-stream --format '    {{.Name}}: {{.MemUsage}}' samespell samespell-redis
REMOTE
  ;;

*) echo "Dùng: ./deploy.sh [deploy|migrate|logs|rollback]" >&2; exit 1 ;;
esac
