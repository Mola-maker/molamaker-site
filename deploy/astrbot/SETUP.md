# molabot — ECS Setup (Ubuntu 22.04, Aliyun ECS)

## Prerequisites

- Ubuntu 22.04 on Aliyun ECS
- Aliyun security group: only 80/443/22 open to world
- Domain with ICP; `bot.<domain>` subdomain pointed to ECS

---

## 1. Install Docker (Aliyun mirror)

```bash
sudo apt update && sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
  https://mirrors.aliyun.com/docker-ce/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

## 2. Create molabot user

```bash
sudo useradd -m -s /bin/bash molabot
sudo usermod -aG docker molabot
sudo su - molabot
```

## 3. Deploy services

```bash
sudo mkdir -p /opt/molabot && sudo chown molabot:molabot /opt/molabot
cd /opt/molabot

# Copy files from repo (run from your laptop or git pull on ECS)
# cp deploy/astrbot/docker-compose.yml /opt/molabot/
# cp deploy/astrbot/.env.template /opt/molabot/.env

# Generate secrets
ASTRBOT_API_KEY=$(openssl rand -hex 32)
echo "ASTRBOT_API_KEY=$ASTRBOT_API_KEY" > /opt/molabot/.env
echo "NAPCO_QQ=<your-qq-number>" >> /opt/molabot/.env
chmod 600 /opt/molabot/.env

docker compose up -d
```

## 4. Verify

```bash
docker compose ps              # both services Up
docker compose logs napcat     # find QR code URL, scan with QQ to login
docker compose logs astrbot    # "AstrBot started"
curl -s http://127.0.0.1:6185/health
```

## 5. nginx reverse proxy (bot subdomain + basic auth)

```bash
sudo apt install -y apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd-bot admin
```

```nginx
# /etc/nginx/sites-available/bot.<domain>
server {
    listen 80;
    server_name bot.<domain>;

    location / {
        auth_basic "AstrBot Admin";
        auth_basic_user_file /etc/nginx/.htpasswd-bot;
        proxy_pass http://127.0.0.1:6185;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/bot.<domain> /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d bot.<domain>
```

## 6. Next.js → AstrBot env vars

```bash
# Add to /var/www/molamaker-site/.env.local
ASTRBOT_API_URL=http://127.0.0.1:6185
ASTRBOT_API_KEY=<same key from step 3>
```

---

## Verification checklist

- [ ] `docker compose ps` — both containers Up
- [ ] `curl http://127.0.0.1:6185/health` returns 200
- [ ] `bot.<domain>` loads behind basic auth
- [ ] NapCat QQ account online (QR scanned, AstrBot panel shows connected)
- [ ] `ss -tlnp | grep -E '3001|6185'` shows only 127.0.0.1 bindings
- [ ] `ss -tlnp | grep 2375` — empty (no Docker TCP exposed)
