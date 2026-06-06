#!/usr/bin/env bash
# Ship the server bundle to Aliyun ECS over ssh+tar (no rsync needed).
# Replaces the rsync step in deploy/DEPLOYMENT.md §5 for machines without rsync.
#
# Usage:
#   ECS=root@1.2.3.4 bash deploy/push-ecs.sh
#   ECS=root@1.2.3.4 APP_DIR=/var/www/molamaker bash deploy/push-ecs.sh
#
# Prereqs on this machine: ssh, tar (Git Bash / MSYS both have them).
# Prereqs on ECS: node 22, pm2, the app already pm2-registered as "molamaker",
#                 and /var/www/molamaker/.env populated with ROTATED secrets.
set -euo pipefail

ECS="${ECS:?Set ECS=user@host, e.g. ECS=root@1.2.3.4}"
APP_DIR="${APP_DIR:-/var/www/molamaker}"
PM2_NAME="${PM2_NAME:-molamaker}"

# What `next start` needs at runtime. NOT node_modules — rebuilt on ECS for Linux.
SHIP=()
for f in .next public content package.json package-lock.json next.config.mjs i18n; do
  [ -e "$f" ] && SHIP+=("$f")
done

echo "→ Shipping to ${ECS}:${APP_DIR}"
echo "  payload: ${SHIP[*]}"
echo "  (excluding node_modules — ECS runs 'npm ci --omit=dev' to build native deps for Linux)"
echo ""

# Make sure the target dir exists.
ssh "$ECS" "mkdir -p '$APP_DIR'"

# tar locally → stream over ssh → extract on ECS. -z = gzip in flight.
# --delete semantics: we DON'T blow away the whole dir (keeps data/ and .env);
# we only overwrite the shipped paths. Remove stale .next first so old chunks die.
ssh "$ECS" "rm -rf '$APP_DIR/.next'"
tar -czf - "${SHIP[@]}" | ssh "$ECS" "tar -xzf - -C '$APP_DIR'"

echo "→ Installing prod deps + reloading on ECS"
ssh "$ECS" "cd '$APP_DIR' && npm ci --omit=dev && pm2 reload '$PM2_NAME' && pm2 save"

echo ""
echo "✓ Deployed. Check: ssh $ECS 'pm2 logs $PM2_NAME --lines 40'"
