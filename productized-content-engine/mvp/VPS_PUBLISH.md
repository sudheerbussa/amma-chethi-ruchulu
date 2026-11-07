# VPS publish contract

**VPS:** `root@162.35.105.110`

## ig-post-now (Graph API) — LIVE on VPS

```bash
ig-post-now --dir /data/clients/acr/2026-09-15/carousel
# same as:
node /opt/ig-poster/post-carousel.mjs --dir /data/clients/acr/2026-09-15/carousel
```

Code: `/opt/ig-poster` (synced from `mvp/ig-poster/`)  
Staging (Meta fetches JPEGs): `https://order.ammachethiruchulu.co.in/ig-staging/...`  
Packs: `/data/clients/acr/...`

### One-time: put tokens on VPS

```bash
ssh root@162.35.105.110
nano /opt/ig-poster/.env
```

```env
IG_USER_ID=your_instagram_business_account_id
ACCESS_TOKEN=your_page_access_token
GRAPH_API_VERSION=v21.0
PUBLIC_BASE_URL=https://order.ammachethiruchulu.co.in/ig-staging
STAGING_DIR=/data/ig-staging
```

How to get IDs/token: `mvp/ig-poster/README.md`

### From laptop after render

```bash
cd mvp
rsync -avz queue/acr/ root@162.35.105.110:/data/clients/acr/
ssh root@162.35.105.110 'ig-post-now --dir /data/clients/acr/2026-09-15/carousel'
```

### Status

| Item | Done? |
|------|--------|
| Poster code deployed | yes |
| Caddy `/ig-staging` | yes (HTTP 200) |
| Carousel uploaded | yes (`2026-09-15`) |
| `.env` tokens filled | **you must add** |
| First live post | waiting on tokens |
