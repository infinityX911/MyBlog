# Deploying to a VPS (Docker)

This is a **full-stack** Next.js 16 app — API routes, a custom Socket.io server,
Prisma, an admin panel, image uploads. It is **not** a static "frontend only"
export. You deploy the **whole project**; Docker builds it and runs it as a Node
service with its own MariaDB database. You never upload a pre-built `.next` by
hand — the image builds everything.

What runs in production:

- **app** container — `node server.js` (Next.js + Socket.io on port 3000)
- **db** container — MariaDB (data stored in a Docker volume)
- **nginx** on the host — terminates HTTPS and reverse-proxies to the app

---

## Quick start (one command)

Point your domain's DNS **A record** at the VPS IP first. Then, on the VPS,
from the project folder:

```bash
sudo bash deploy.sh
```

It asks for your domain + email, then installs Docker/nginx/certbot, generates
secrets into `.env.production`, builds and starts everything, and turns on HTTPS.
When it finishes you get `https://your-domain.com`. To redeploy later:
`git pull && docker compose up -d --build`.

The manual steps below are the same thing done by hand — read them if you want
to understand or customize what the script does.

---

## 1. Prepare the VPS (once)

SSH in as root (InterServer gives you this) and install Docker + nginx:

```bash
# Docker + compose plugin
curl -fsSL https://get.docker.com | sh

# nginx + certbot for HTTPS
apt update && apt install -y nginx certbot python3-certbot-nginx git
```

**Add swap** — a $3 VPS has little RAM and `next build` (and MariaDB) can run out.
2 GB of swap prevents the build from being killed:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

> Tight on RAM/disk? You can instead build the image on your PC and `docker save`
> / `docker load` it onto the VPS, but building on the VPS with swap is simplest.

---

## 2. Get the code + configure

```bash
cd /opt
git clone <your-repo-url> blog        # or scp/rsync the project folder here
cd blog

cp .env.production.example .env.production
nano .env.production                  # fill in the real values (see below)
```

Must-fill in `.env.production`:

- `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXTAUTH_URL` → `https://your-domain.com`
- `NEXTAUTH_SECRET` → generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`
- `DB_ROOT_PASSWORD`, `DB_PASSWORD` → strong passwords
- `DATABASE_URL` → keep it consistent with the `DB_*` values (host stays `db`)

Everything else (GA, SMTP, uploads, ads) can be filled now or later.

---

## 3. Build + start

```bash
docker compose up -d --build
docker compose logs -f app        # watch it boot; Ctrl-C to stop watching
```

On first boot the app's entrypoint waits for the database, then runs
`prisma db push` to create all tables automatically. When you see
`> Ready on http://0.0.0.0:3000`, it's live on `127.0.0.1:3000` (local only).

Seed the initial roles/permissions/admin (if your project has a seed):

```bash
docker compose exec app npx prisma db seed
```

---

## 4. Domain + HTTPS (nginx + certbot)

Point your domain's DNS **A record** at the VPS IP first. Then:

```bash
cp nginx/blog.conf /etc/nginx/sites-available/blog.conf
# edit it: replace your-domain.com in both places
nano /etc/nginx/sites-available/blog.conf
ln -s /etc/nginx/sites-available/blog.conf /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Get the certificate + auto-configure HTTPS (also renews automatically):
certbot --nginx -d your-domain.com -d www.your-domain.com
```

The nginx config already forwards WebSocket upgrade headers, so Socket.io
(real-time comments/chat) works over `wss://` once HTTPS is on.

Your site is now live at `https://your-domain.com`.

---

## 5. Google Analytics + Search Console + Cloudinary

These are now configured from the **dashboard** — no `.env` edit and **no
rebuild** needed. Go to **Admin → Blog → Integrations**:

1. **Create a GA4 property** + a **Web data stream** for your domain, copy the
   **Measurement ID** (`G-XXXXXXXXXX`) → paste into *Measurement ID*. The public
   site starts sending data to GA immediately.
2. To make the **admin dashboard read** real GA numbers: enable the
   **Google Analytics Data API** in Google Cloud, create a **service account** +
   JSON key, add its email as a **Viewer** on the GA4 property, then fill
   *GA4 Property ID*, *Service-account email*, *Private key*. Leave blank to keep
   using the built-in DB view counts.
3. **Search Console:** add your domain, choose **HTML tag** verification, paste
   the token into *Search Console verification token*, save, then click Verify.
4. **Image uploads:** pick *Local* or *Cloudinary* and (for Cloudinary) paste the
   cloud name / API key / secret — all on the same page.

> The `.env` / `.env.production` versions of these keys still work as a fallback,
> but the dashboard values win. Only the DB, SMTP and auth secrets must live in
> `.env.production`.

> Note: other `NEXT_PUBLIC_*` values (site URL, etc.) are baked at **build** time,
> so changing those still needs `docker compose up -d --build`. The integrations
> above are read at runtime, so they take effect on save.

---

## 6. Updating the site later

```bash
cd /opt/blog
git pull
docker compose up -d --build     # rebuilds only if code changed
```

Schema changes are applied automatically on boot (`prisma db push`).

## 7. Backups

The database lives in the `dbdata` volume and uploads in the `uploads` volume.

```bash
# DB dump
docker compose exec db mariadb-dump -u root -p"$DB_ROOT_PASSWORD" api > backup-$(date +%F).sql
# Uploaded images
docker run --rm -v blog_uploads:/data -v "$PWD":/backup alpine \
  tar czf /backup/uploads-$(date +%F).tar.gz -C /data .
```

## Handy commands

```bash
docker compose ps                 # status
docker compose logs -f app        # app logs
docker compose restart app        # restart app only
docker compose down               # stop all (data kept in volumes)
docker compose exec app sh        # shell inside the app container
```
