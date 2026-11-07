# IG Poster (Meta Graph API)

Posts a local carousel folder (`01.png`… + `caption.txt`) to Instagram.

## One-time Meta setup

**Full walkthrough:** [GET-TOKENS.md](GET-TOKENS.md) (IG_USER_ID + ACCESS_TOKEN step by step).

Short version:

1. Instagram **Professional** + linked **Facebook Page**
2. Meta Developer App → Graph API Explorer
3. Permissions: `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`
4. `GET me/accounts` → Page id (+ Page token)
5. `GET {page-id}?fields=instagram_business_account` → **IG_USER_ID**
6. Exchange for **long-lived Page token** → **ACCESS_TOKEN** on VPS `.env`

App Review: for your **own** Page/IG you can often test in Development with yourself as app admin. Client accounts later need Advanced Access.

## VPS layout

```text
/opt/ig-poster/          # this package
/data/ig-staging/        # temp JPEGs served publicly for Meta to fetch
/data/clients/acr/...    # rendered packs from laptop
```

Public URL pattern (Caddy):  
`https://order.ammachethiruchulu.co.in/ig-staging/<job>/<nn>.jpg`

## Commands

```bash
# on VPS
cd /opt/ig-poster
cp .env.example .env   # fill IG_USER_ID + ACCESS_TOKEN
npm install

node post-carousel.mjs --dir /data/clients/acr/2026-09-15/carousel
```

From laptop after render:

```bash
rsync -avz queue/acr/ root@162.35.105.110:/data/clients/acr/
ssh root@162.35.105.110 'node /opt/ig-poster/post-carousel.mjs --dir /data/clients/acr/2026-09-15/carousel'
```

Alias name for docs: **`ig-post-now`** =

```bash
node /opt/ig-poster/post-carousel.mjs --dir <carousel-dir>
```
