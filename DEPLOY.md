# Deploying SpotForge (password-protected demo)

The app container binds `127.0.0.1:3000` only; **nginx** (host) is the sole public
entrypoint — it terminates TLS and enforces an HTTP basic-auth password wall.
There is **no public sign-up**: you seed the first admin from the CLI, then add
users from `/admin/users`.

## 1. Secrets (generate fresh — never reuse dev values)

Put these in the deploy shell env / a root-only `.env` next to `docker-compose.yml`:

```bash
DB_PASSWORD=$(openssl rand -hex 24)
AUTH_SECRET=$(openssl rand -hex 32)        # also encrypts per-user keys — keep stable
OPENROUTER_API_KEY=sk-or-...               # set a spend limit on openrouter.ai
PUBLIC_BASE_URL=https://demo.example.com   # or leave blank to keep webhooks off
# OPENROUTER_WEBHOOK_SECRET=...            # REQUIRED only if PUBLIC_BASE_URL is set
```

`TRUST_PROXY=true` is already hard-set in compose (needed behind nginx so per-IP
rate limits and client IPs work).

## 2. Build & start

```bash
docker compose up -d --build      # runs `prisma migrate deploy` then boots
```

The image bundles ffmpeg + yt-dlp + Deno; the in-process worker runs in the app
container.

## 3. Create the first admin (no public exposure)

```bash
docker compose exec app pnpm create-admin you@example.com 'a-strong-password'
```

Add everyone else from the **Users** page (`/admin/users`) once signed in.
(`create-admin` also resets an existing account's password.)

## 4. nginx (host)

```bash
sudo apt install apache2-utils
sudo htpasswd -c /etc/nginx/spotforge.htpasswd <you>     # the password wall
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/spotforge
sudo ln -s /etc/nginx/sites-available/spotforge /etc/nginx/sites-enabled/
# edit server_name + cert paths, then:
sudo certbot --nginx -d demo.example.com
sudo nginx -t && sudo systemctl reload nginx
```

`deploy/nginx.conf.example` already sets: TLS, the basic-auth wall,
`client_max_body_size 110m` (uploads cap at 100 MB), a no-buffering SSE location
for live render progress, and `X-Forwarded-*` headers.

## 5. YouTube import (optional)

Server-side yt-dlp can't read a browser session. To enable imports, drop a
Netscape `cookies.txt` next to compose, set `YTDLP_COOKIES=/secrets/yt-cookies.txt`,
and uncomment the mount in `docker-compose.yml`. Without it, the rest of the app
is unaffected — only YouTube import fails gracefully. yt-dlp is fetched fresh at
build; rebuild periodically as YouTube changes.

## 6. Smoke test (in the browser, behind the password)

- [ ] Log in as the admin; create a test user from **Users**
- [ ] Create a project; run a cheap render end-to-end (watch live progress = SSE works)
- [ ] **Open devtools console** and confirm the prod CSP doesn't block the app or
      the YouTube trimmer iframe (loosen `script-src`/`frame-src` in
      `next.config.ts` only if needed)
- [ ] Confirm `https://demo.example.com:3000` is **not** reachable (app is loopback-only)

## Ongoing

- Watch OpenRouter spend for the first days (users without their own key use the
  shared key, capped by per-user monthly quota).
- `pnpm audit` periodically; rebuild to refresh yt-dlp.
