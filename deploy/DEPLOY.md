# Deploy — 37 Sushi (Multi-unidade)

Guia completo para subir o sistema em produção. Arquitetura: um VPS com duas instâncias Node.js isoladas (Paranavaí na porta 3001, Cianorte na porta 3002), Nginx como proxy reverso com SSL.

---

## Pré-requisitos

| O que | Onde conseguir |
|---|---|
| VPS com Ubuntu 22.04+ | DigitalOcean, Hetzner, Contabo... (2 GB RAM suficiente) |
| Domínio `37sushi.com.br` | Registro.br ou similar |
| Acesso SSH root ao VPS | — |

### DNS — Configure ANTES de rodar o SSL

No painel do seu registrador de domínio, crie dois registros **A** apontando para o IP do VPS:

```
paranavaí.37sushi.com.br  →  <IP do VPS>
cianorte.37sushi.com.br   →  <IP do VPS>
```

> DNS pode levar até 24h para propagar, mas geralmente é minutos.

---

## 1. Setup inicial do servidor (uma vez)

```bash
# Conecte no VPS
ssh root@<IP_DO_VPS>

# Clone o repositório
git clone https://github.com/SEU_USUARIO/sushi-finance.git /tmp/sushi-deploy
cd /tmp/sushi-deploy

# Execute o setup (instala Node 22, PM2, Nginx, cria pastas)
bash deploy/setup-servidor.sh
```

---

## 2. Configure cada unidade

### Paranavaí

```bash
cp deploy/env.paranavaí.example /opt/37sushi/paranavaí/.env
nano /opt/37sushi/paranavaí/.env
```

Preencha obrigatoriamente:
- `JWT_SECRET` — gere com: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- `ANTHROPIC_API_KEY` — chave da sua conta Anthropic
- `WHATSAPP_ENABLED` — deixe `false` se o número ainda estiver no CRM externo

### Cianorte

```bash
cp deploy/env.cianorte.example /opt/37sushi/cianorte/.env
nano /opt/37sushi/cianorte/.env
```

> **IMPORTANTE:** `JWT_SECRET` deve ser diferente entre as unidades.

---

## 3. Build e deploy

```bash
# Faz build e instala dependências de cada unidade
bash deploy/deploy.sh paranavaí
bash deploy/deploy.sh cianorte
```

---

## 4. SSL (HTTPS gratuito com Let's Encrypt)

```bash
certbot --nginx \
  -d paranavaí.37sushi.com.br \
  -d cianorte.37sushi.com.br \
  --email SEU_EMAIL@gmail.com \
  --agree-tos \
  --non-interactive
```

O Certbot edita o `nginx.conf` automaticamente e configura renovação automática.

---

## 5. Iniciar os processos

```bash
cd /opt/37sushi/paranavaí   # ou qualquer pasta com acesso ao ecosystem.config.js
pm2 start /tmp/sushi-deploy/deploy/ecosystem.config.js
pm2 save   # salva para reiniciar com o servidor
```

Verifique se está rodando:
```bash
pm2 status
pm2 logs
```

---

## Atualizar depois (deploy de nova versão)

```bash
# No VPS, dentro de qualquer instância:
cd /opt/37sushi/paranavaí
git pull
bash /tmp/sushi-deploy/deploy/deploy.sh paranavaí
bash /tmp/sushi-deploy/deploy/deploy.sh cianorte
```

Ou se o código está na própria pasta da unidade:
```bash
bash deploy/deploy.sh paranavaí
bash deploy/deploy.sh cianorte
```

---

## Comandos úteis no dia a dia

```bash
pm2 status                        # estado dos processos
pm2 logs 37sushi-paranavaí        # logs em tempo real
pm2 restart 37sushi-paranavaí     # reiniciar uma unidade
pm2 reload 37sushi-paranavaí      # reload sem downtime

# Ver banco de dados de uma unidade
sqlite3 /opt/37sushi/paranavaí/data/sushi.db ".tables"

# Backup manual do banco
cp /opt/37sushi/paranavaí/data/sushi.db ~/backup-paranavaí-$(date +%Y%m%d).db
```

---

## Arquitetura de portas

```
Internet (80/443)
     │
   Nginx
  ┌──┴──────────────────────────────────┐
  │  paranavaí.37sushi.com.br → :3001  │
  │  cianorte.37sushi.com.br  → :3002  │
  └─────────────────────────────────────┘
     │                    │
 Node.js                Node.js
 Paranavaí              Cianorte
 DB isolado             DB isolado
```

---

## Troubleshooting

| Problema | Verificar |
|---|---|
| Site não abre | `pm2 status` + `nginx -t` + DNS propagado? |
| 502 Bad Gateway | Backend caiu? `pm2 logs` |
| WhatsApp não conecta | `WHATSAPP_ENABLED=true` no `.env`? `pm2 reload` |
| DB bloqueado | Só uma instância por arquivo `.db` — conferir `DB_PATH` |
| SSL não renova | `certbot renew --dry-run` para testar |
