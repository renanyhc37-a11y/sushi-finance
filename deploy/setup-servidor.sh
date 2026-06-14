#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
#  37 Sushi — Setup inicial do servidor (Ubuntu 22.04 / 24.04)
#  Execute UMA VEZ como root no VPS zerado:
#    bash deploy/setup-servidor.sh
# ══════════════════════════════════════════════════════════════
set -euo pipefail

UNIDADES=("paranavaí" "cianorte")
PORTS=(3001 3002)
LOG_DIR="/var/log/37sushi"
OPT_DIR="/opt/37sushi"
REPO_URL="https://github.com/SEU_USUARIO/sushi-finance.git"  # ← ALTERE

echo "════════════════════════════════════════"
echo " 37 Sushi — Setup do Servidor"
echo "════════════════════════════════════════"

# ── 1. Dependências do sistema ─────────────────────────────────
echo "[1/7] Instalando dependências do sistema..."
apt-get update -qq
apt-get install -y -qq \
  curl git nginx certbot python3-certbot-nginx \
  chromium-browser ca-certificates gnupg

# ── 2. Node.js 22 (via NodeSource) ────────────────────────────
echo "[2/7] Instalando Node.js 22..."
if ! command -v node &>/dev/null || [[ "$(node -e 'console.log(process.version.split(".")[0].slice(1))')" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
echo "  Node $(node -v) | npm $(npm -v)"

# ── 3. PM2 ────────────────────────────────────────────────────
echo "[3/7] Instalando PM2..."
npm install -g pm2 --silent
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

# ── 4. Estrutura de pastas ────────────────────────────────────
echo "[4/7] Criando estrutura de pastas..."
mkdir -p "$LOG_DIR"
for u in "${UNIDADES[@]}"; do
  mkdir -p "$OPT_DIR/$u/data/whatsapp-session"
  echo "  → $OPT_DIR/$u criado"
done

# ── 5. Clonar o repositório ───────────────────────────────────
echo "[5/7] Clonando repositório..."
for u in "${UNIDADES[@]}"; do
  if [ -d "$OPT_DIR/$u/.git" ]; then
    echo "  → $u já existe, pulando clone"
  else
    git clone "$REPO_URL" "$OPT_DIR/$u"
    echo "  → $u clonado"
  fi
done

# ── 6. Nginx ─────────────────────────────────────────────────
echo "[6/7] Configurando Nginx..."
cp "$(dirname "$0")/nginx.conf" /etc/nginx/sites-available/37sushi
ln -sf /etc/nginx/sites-available/37sushi /etc/nginx/sites-enabled/37sushi
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "  → Nginx configurado"

# ── 7. Instruções finais ──────────────────────────────────────
echo ""
echo "════════════════════════════════════════"
echo " Setup concluído! Próximos passos:"
echo "════════════════════════════════════════"
echo ""
echo "1. Configure cada unidade:"
for i in "${!UNIDADES[@]}"; do
  u="${UNIDADES[$i]}"
  echo "   cp deploy/env.$u.example $OPT_DIR/$u/.env"
  echo "   nano $OPT_DIR/$u/.env   # preencha JWT_SECRET e ANTHROPIC_API_KEY"
done
echo ""
echo "2. Build e dependências:"
echo "   bash deploy/deploy.sh paranavaí"
echo "   bash deploy/deploy.sh cianorte"
echo ""
echo "3. SSL com Let's Encrypt:"
echo "   certbot --nginx -d paranavaí.37sushi.com.br -d cianorte.37sushi.com.br"
echo "   # Responda 2 (redirect) quando perguntado"
echo ""
echo "4. Inicie os processos:"
echo "   pm2 start deploy/ecosystem.config.js"
echo "   pm2 save"
echo ""
echo "5. Verifique os logs:"
echo "   pm2 logs"
echo ""
