# CI/CD VPS (GitHub Actions)

Tai lieu nay huong dan setup CI/CD cho `smart-chat-assistant-nestjs` voi GitHub Actions + VPS + Docker Compose.

## 1. Yeu cau

- Repo dang su dung GitHub Actions.
- VPS da cai:
  - Docker
  - Docker Compose v2 (`docker compose`)
  - Curl
- Tai khoan VPS co quyen chay Docker.

## 2. Files lien quan

- `Dockerfile`
- `.dockerignore`
- `.github/workflows/ci.yml`
- `.github/workflows/cd-vps.yml`
- `deploy/docker-compose.prod.yml`
- `deploy/scripts/deploy.sh`

## 3. Secrets can them tren GitHub repo

- `VPS_HOST`: IP/host VPS
- `VPS_USER`: user SSH
- `VPS_SSH_KEY`: private key (PEM/OpenSSH)
- `VPS_PORT`: cong SSH (vd `22`)
- `VPS_DEPLOY_PATH`: thu muc deploy tren VPS (vd `/opt/smart-chat-assistant`)
- `APP_ENV_FILE`: noi dung file `.env` production (dang plain text)

## 4. Bootstrap VPS

```bash
sudo mkdir -p /opt/smart-chat-assistant
sudo chown -R $USER:$USER /opt/smart-chat-assistant
cd /opt/smart-chat-assistant
```

Khong can tao compose file thu cong. Workflow CD se copy:

- `docker-compose.prod.yml`
- `deploy.sh`

## 5. Pipeline hanh vi

## CI (`ci.yml`)

- Trigger: `pull_request`, `push` vao `main`/`develop`
- Steps:
  - `npm ci`
  - `npm run lint -- --max-warnings=0`
  - `npm run test -- --ci --runInBand`
  - `npm run build`

## CD (`cd-vps.yml`)

- Trigger: `push` vao `main` hoac `workflow_dispatch`
- Build image va push len GHCR:
  - `ghcr.io/<owner>/<repo>:<sha>`
  - `ghcr.io/<owner>/<repo>:latest`
- SSH vao VPS:
  - tao `.env` tu secret `APP_ENV_FILE`
  - chay `deploy.sh` de pull/up + health check

## 6. Verify sau deploy

Tren VPS:

```bash
cd /opt/smart-chat-assistant
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=200 app
curl -i http://localhost:4000/
```

Neu app su dung health endpoint khac, set bien `HEALTHCHECK_URL` trong script environment.

## 7. Rollback nhanh

1. Xac dinh tag can rollback (sha cu).
2. Tren VPS:

```bash
cd /opt/smart-chat-assistant
export IMAGE_NAME=ghcr.io/<owner>/<repo>
export IMAGE_TAG=<old_sha>
./deploy.sh
```

## 8. Luu y van hanh

- `APP_ENV_FILE` dang luu full env trong GitHub Secret. Nen gioi han quyen truy cap repo secrets.
- Neu dung DB/Redis ngoai compose, dam bao firewall cho phep ket noi tu VPS.
- Neu co reverse proxy (Nginx/Caddy), map port ngoai vao `APP_PORT` trong compose.
