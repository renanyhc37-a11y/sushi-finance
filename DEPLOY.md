# 🚀 Guia de Deploy com Domínio Próprio

## Quando tiver o domínio (ex: sushicontrol.com.br)

### 1. Atualizar o .env do backend

```env
APP_URL=https://sushicontrol.com.br
FRONTEND_URL=https://sushicontrol.com.br
PORT=3001
```

### 2. Instalar Nginx (proxy reverso + HTTPS)

No servidor Linux (VPS/Ubuntu):

```bash
sudo apt update && sudo apt install nginx certbot python3-certbot-nginx -y
```

Criar o arquivo de configuração do Nginx:

```bash
sudo nano /etc/nginx/sites-available/sushicontrol
```

Conteúdo:

```nginx
server {
    listen 80;
    server_name sushicontrol.com.br www.sushicontrol.com.br;

    # Redireciona tudo para HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name sushicontrol.com.br www.sushicontrol.com.br;

    # Certificado SSL (gerado pelo Certbot)
    ssl_certificate /etc/letsencrypt/live/sushicontrol.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sushicontrol.com.br/privkey.pem;

    # Configurações SSL modernas
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Tamanho máximo de upload (para imagens do cardápio)
    client_max_body_size 20M;

    # Proxy para o backend Node.js
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;

        # Headers para WebSocket (Socket.io)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeout maior para respostas longas da IA
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }
}
```

Ativar e testar:

```bash
sudo ln -s /etc/nginx/sites-available/sushicontrol /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Gerar certificado SSL grátis (Let's Encrypt)

```bash
sudo certbot --nginx -d sushicontrol.com.br -d www.sushicontrol.com.br
```

O Certbot renova automaticamente a cada 90 dias.

### 4. Rodar o backend como serviço (PM2)

Para o servidor não parar quando você fechar o terminal:

```bash
npm install -g pm2
cd /caminho/do/projeto/backend
pm2 start src/index.js --name sushi-control
pm2 save
pm2 startup   # inicia automaticamente ao reiniciar o servidor
```

Comandos úteis:
```bash
pm2 logs sushi-control      # ver logs em tempo real
pm2 restart sushi-control   # reiniciar
pm2 stop sushi-control      # parar
pm2 status                  # ver status
```

### 5. Apontar DNS do domínio

No painel do seu registrador de domínio, crie os registros:

| Tipo | Nome | Valor            |
|------|------|-----------------|
| A    | @    | IP_DO_SERVIDOR  |
| A    | www  | IP_DO_SERVIDOR  |

Aguarde propagação (pode levar até 24h, geralmente menos de 1h).

---

## Uso com ngrok (provisório — enquanto não tem domínio)

1. Baixe o ngrok: https://ngrok.com/download
2. Crie conta gratuita e copie o authtoken
3. Configure: `ngrok config add-authtoken SEU_TOKEN`
4. Rode: `ngrok http 3001`
5. Copie a URL `https://xxxx.ngrok-free.app`
6. Atualize o `.env`: `APP_URL=https://xxxx.ngrok-free.app`
7. Reinicie o servidor

> ⚠️ Com ngrok gratuito a URL muda a cada vez que você liga.
> O servidor já detecta a URL do ngrok automaticamente se você iniciar
> o ngrok **antes** de iniciar o servidor.

---

## Checklist de deploy

- [ ] Servidor VPS contratado (ex: DigitalOcean, Hostinger VPS, Contabo)
- [ ] Domínio registrado (ex: Registro.br, GoDaddy)
- [ ] DNS apontando para o servidor
- [ ] Node.js 18+ instalado no servidor
- [ ] Nginx instalado e configurado
- [ ] Certificado SSL gerado (Certbot)
- [ ] PM2 configurado para auto-start
- [ ] `.env` atualizado com APP_URL do domínio
- [ ] Porta 3001 liberada no firewall do servidor (`ufw allow 3001`)
- [ ] Sessão do WhatsApp reescaneada no servidor (novo QR code)
