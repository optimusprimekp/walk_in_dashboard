# Deploying to AWS EC2

This guide deploys the app on a single Ubuntu EC2 instance:

- **PostgreSQL** running on the instance (or use Amazon RDS — see note at the end)
- **Node/Express server** (port 3001) — also serves the built React client
- **PM2** to keep the server running and restart it on reboot
- **Nginx** as a reverse proxy on port 80/443

Admin login created by this guide: **username `admin` / password `Admin@kp2026`**.

---

## 1. Launch the EC2 instance

1. EC2 → **Launch instance**.
2. AMI: **Ubuntu Server 24.04 LTS** (or 22.04).
3. Type: **t3.small** (t2.micro works for light use).
4. Key pair: create/select one (you'll need the `.pem` to SSH).
5. **Security group** — allow inbound:
   - SSH (22) from *your IP*
   - HTTP (80) from anywhere (0.0.0.0/0)
   - HTTPS (443) from anywhere (only if you'll set up TLS)
   - **Do not** open 5432 (Postgres) or 3001 (Node) to the internet.
6. Storage: 20 GB gp3 is plenty. Launch.

SSH in:

```bash
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
```

---

## 2. Install system dependencies

```bash
sudo apt update && sudo apt upgrade -y

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Git, Nginx, PostgreSQL
sudo apt install -y git nginx postgresql postgresql-contrib

# PM2 (process manager)
sudo npm install -g pm2

node -v && npm -v   # sanity check
```

---

## 3. Create the PostgreSQL database

```bash
sudo -u postgres psql <<'SQL'
CREATE USER walkin WITH PASSWORD 'choose-a-strong-db-password';
CREATE DATABASE walkin OWNER walkin;
GRANT ALL PRIVILEGES ON DATABASE walkin TO walkin;
SQL
```

Your connection string will be:

```
postgres://walkin:choose-a-strong-db-password@localhost:5432/walkin
```

---

## 4. Get the code onto the server

Either clone from your Git remote:

```bash
cd ~
git clone <YOUR_REPO_URL> walk_in_dashboard
cd walk_in_dashboard
```

…or copy it up from your machine with `scp`/`rsync` (exclude `node_modules`):

```bash
# run on your local machine
rsync -av --exclude node_modules --exclude dist ./ ubuntu@<EC2_PUBLIC_IP>:~/walk_in_dashboard/
```

---

## 5. Configure environment + install

```bash
cd ~/walk_in_dashboard

# Server env file
cp server/.env.example server/.env
nano server/.env
```

Set in `server/.env`:

```
DATABASE_URL=postgres://walkin:choose-a-strong-db-password@localhost:5432/walkin
PORT=3001
NODE_ENV=production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@kp2026
ADMIN_NAME=Administrator
```

Install dependencies for both apps:

```bash
npm run install:all
```

---

## 6. Create tables, seed admin, build client

```bash
# Create the database tables from the Drizzle schema
npm run db:push

# Create the admin user (admin / Admin@kp2026)
npm run db:seed

# Build the React client (output: client/dist, served by the server)
npm run build
```

---

## 7. Start the server with PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save                 # remember the process list
pm2 startup              # prints a command — copy/paste & run it to enable boot start
```

Check it's up:

```bash
pm2 status
pm2 logs walkin          # should show "Server listening" on port 3001
curl http://localhost:3001/api/healthz
```

---

## 8. Put Nginx in front (port 80)

```bash
sudo tee /etc/nginx/sites-available/walkin >/dev/null <<'NGINX'
server {
    listen 80;
    server_name _;

    client_max_body_size 12m;   # allows the candidate Excel import uploads

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/walkin /etc/nginx/sites-enabled/walkin
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Now open **http://<EC2_PUBLIC_IP>/** in a browser → go to **/login** → sign in with
**admin / Admin@kp2026**.

---

## 9. (Optional) HTTPS with a domain

Point a domain's A record at the EC2 public IP, then:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Certbot updates the Nginx config and auto-renews.

---

## Updating the app later

```bash
cd ~/walk_in_dashboard
git pull                 # or rsync new files
npm run install:all      # if dependencies changed
npm run db:push          # if the schema changed
npm run build            # rebuild client
pm2 restart walkin
```

---

## Notes

- **Change the admin password** later by editing `ADMIN_PASSWORD` in `server/.env` and
  re-running `npm run db:seed` (it updates the existing `admin` user).
- **Amazon RDS instead of local Postgres:** skip step 3, create an RDS PostgreSQL
  instance, allow the EC2 security group to reach it on 5432, and point `DATABASE_URL`
  at the RDS endpoint. Everything else is the same.
- The auth tokens are a simple signed payload with a fixed salt in
  `server/src/routes/auth.ts`. For a public production deployment, consider moving that
  salt to an env var and using HTTPS (step 9).
