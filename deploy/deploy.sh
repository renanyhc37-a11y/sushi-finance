#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
#  37 Sushi — Deploy / Atualização de uma unidade
#
#  Uso: bash deploy/deploy.sh <unidade>
#  Ex:  bash deploy/deploy.sh paranavaí
#       bash deploy/deploy.sh cianorte
# ══════════════════════════════════════════════════════════════
set -euo pipefail

UNIDADE="${1:-}"
if [ -z "$UNIDADE" ]; then
  echo "Uso: bash deploy/deploy.sh <paranavaí|cianorte>"
  exit 1
fi

APP_DIR="/opt/37sushi/$UNIDADE"
PM2_NAME="37sushi-$UNIDADE"
ENV_FILE="$APP_DIR/.env"

if [ ! -d "$APP_DIR" ]; then
  echo "ERRO: $APP_DIR não existe. Rode setup-servidor.sh primeiro."
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: $ENV_FILE não encontrado."
  echo "  Copie: cp deploy/env.$UNIDADE.example $ENV_FILE"
  echo "  Depois edite JWT_SECRET e ANTHROPIC_API_KEY."
  exit 1
fi

echo "════════════════════════════════════════"
echo " Deploy: $UNIDADE"
echo " Dir: $APP_DIR"
echo "════════════════════════════════════════"

cd "$APP_DIR"

# ── 1. Atualizar código ───────────────────────────────────────
echo "[1/4] git pull..."
git pull --ff-only origin main

# ── 2. Dependências do backend ────────────────────────────────
echo "[2/4] npm install (backend)..."
cd backend
npm install --omit=dev --silent
cd ..

# ── 3. Build do frontend ──────────────────────────────────────
echo "[3/4] Build do frontend..."
cd frontend

# Gera o .env do Vite apontando para a URL correta da unidade
source "$ENV_FILE"
cat > .env.production <<EOF
VITE_API_URL=${APP_URL:-}/api
EOF

npm install --silent
npm run build
cd ..

# ── 4. Reiniciar processo PM2 ─────────────────────────────────
echo "[4/4] Reiniciando PM2..."
if pm2 describe "$PM2_NAME" &>/dev/null; then
  pm2 reload "$PM2_NAME" --update-env
  echo "  → $PM2_NAME recarregado"
else
  echo "  → Processo não encontrado. Use: pm2 start deploy/ecosystem.config.js"
fi

echo ""
echo "✓ Deploy de $UNIDADE concluído."
echo "  Logs: pm2 logs $PM2_NAME"
