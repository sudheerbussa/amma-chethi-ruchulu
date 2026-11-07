# How to get `IG_USER_ID` and `ACCESS_TOKEN`

Use this for **your own** ACR Instagram (`@order.ammachethiruchulu`) first.  
Our poster uses **Instagram API with Facebook Login** → needs a **Facebook Page access token** + **IG User ID**.

Official refs:

- [Get started (Facebook Login)](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/get-started/)
- [Content publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing)
- [Page → instagram_business_account](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/page/)

---



## Part A — Prepare Instagram + Facebook Page (phone / browser)



### A1. Make Instagram Professional

1. Open Instagram app → profile → menu → **Settings and activity**.
2. **Account type and tools** → **Switch to professional account**.
3. Choose **Business** (fine for food brand) or **Creator**.
4. Finish the prompts (category e.g. Restaurant / Food).



### A2. Create or pick a Facebook Page

1. On Facebook, create a Page for Amma Chethi Ruchulu (or use an existing one).
2. You must be able to manage that Page (Admin / with create content permission).



### A3. Link Instagram ↔ Facebook Page

1. Instagram app → Settings → **Accounts Centre** / **Linked accounts** / **Page** (wording varies).
  - Or: Facebook Page → **Settings** → **Linked accounts** / **Instagram** → Connect.
2. Connect the Professional IG to **that** Page.
3. Confirm: Page settings show the Instagram account linked.

If Graph later returns empty `instagram_business_account`, the link is wrong. Fix A3 before continuing.

---



## Part B — Create a Meta Developer App

1. Go to [developers.facebook.com](https://developers.facebook.com/) → log in with the **same Facebook user** that can manage the Page.
2. **My Apps** → **Create App**.
3. Use a type that supports business / Instagram (e.g. **Business** / other current wizard option that allows Instagram Graph).
4. App name e.g. `ACR IG Poster` → create.
5. In the app dashboard:
  - Add product **Instagram** (and/or use Graph API).
  - Under app **Roles** → **Roles**: add yourself as **Administrator**.
6. **App Mode**: stay in **Development** for your own account test.
  Your Facebook user + Page must be tied to the app (admin is enough for your own assets in most cases).

---



## Part C — Easiest path: Graph API Explorer (recommended for first token)



### C1. Open Explorer

1. Open [Graph API Explorer](https://developers.facebook.com/tools/explorer/).
2. Top: select **your app** (`ACR IG Poster`).
3. **User or Page** token dropdown → you’ll generate permissions next.



### C2. Add permissions, then Generate Access Token

Click **Add a Permission** / **Permissions** and add at least:


| Permission                  | Why                                        |
| --------------------------- | ------------------------------------------ |
| `pages_show_list`           | List Pages you manage                      |
| `pages_read_engagement`     | Required for publishing path with FB Login |
| `instagram_basic`           | Read IG business account linkage           |
| `instagram_content_publish` | **Required to post** (Facebook Login path) |


**If you cannot see** `instagram_content_publish`**:** see [Troubleshooting: publish permission missing](#troubleshooting-publish-permission-missing) below. Often you must add the **Instagram** product first, or select `instagram_business_content_publish` instead.

If Meta shows newer names (`instagram_business_basic`, `instagram_business_content_publish`), add those instead / as well.

Then click **Generate Access Token** → approve the Facebook login popup → allow access to the **correct Page**.

You now have a **short-lived User token** in the Explorer box. Keep this tab open.

### Troubleshooting: publish permission missing

This is common. In Explorer you may only see `instagram_basic` and not `instagram_content_publish`.

#### Fix 1 — Add Instagram product to the app (do this first)

1. Open [Meta App Dashboard](https://developers.facebook.com/apps/) → select **Acr Carosoul Poster**.
2. Left sidebar → **Add products** / **Products**.
3. Find **Instagram** → **Set up**.
4. Prefer setup that includes **Instagram API with Facebook Login** (Page-linked IG) if shown.
  “API setup with Instagram login” is a different token type (`graph.instagram.com`) — still usable later, but our current `ig-poster` expects **Facebook Page token** + `graph.facebook.com`.
5. Also add **Facebook Login for Business** / **Facebook Login** if not already present.
6. Return to [Graph API Explorer](https://developers.facebook.com/tools/explorer/), refresh the page, select the app again.
7. In permissions search/filter, type: `content_publish` or `instagram_content`.



#### Fix 2 — Search / scroll the list

The permissions dropdown is long. Type in the permission search box (inside the dropdown, not the top site search):

- `instagram_content_publish`
- or `content_publish`
- or `instagram_business_content_publish`



#### Fix 3 — Add from App Review → Permissions

1. App Dashboard → **App Review** → **Permissions and features**.
2. Search `instagram_content_publish` (or `instagram_business_content_publish`).
3. Click **Request** / **Add** for Standard Access if offered.
4. For **your own** IG in Development mode, Standard Access + you as app admin is usually enough to test.
5. Go back to Explorer and regenerate the token with that permission checked.



#### Fix 4 — Name changed (Instagram Login path)

Meta now has two stacks:


| Path                  | Publish permission name              | Token host                                  |
| --------------------- | ------------------------------------ | ------------------------------------------- |
| Facebook Login (Page) | `instagram_content_publish`          | `graph.facebook.com` — **our poster today** |
| Instagram Login       | `instagram_business_content_publish` | `graph.instagram.com`                       |


If only `instagram_business_content_publish` appears, you are on the Instagram-login product. Either:

- Add Facebook Login + Instagram Graph (Facebook Login) so `instagram_content_publish` appears, **or**
- Tell me and we adapt `ig-poster` to Instagram-login tokens (different env vars).



#### Fix 5 — Still missing

Confirm app type is **Business**. Consumer/other types sometimes cannot request IG publish permissions. Create a new **Business** app if needed, add Instagram, retry Explorer.

### C3. Get your Facebook Page ID

In Explorer, set method **GET**, path:

```http
me/accounts
```

Click **Submit**.

Response lists Pages. Copy:

- `id` → this is **PAGE_ID** (Facebook Page id)
- Optionally note `name` to confirm ACR Page
- If the object includes `access_token`, that value is already a **Page access token** — save it as a candidate for `ACCESS_TOKEN`

Example shape:

```json
{
  "data": [
    {
      "access_token": "EAAB...",
      "id": "123456789012345",
      "name": "Amma Chethi Ruchulu"
    }
  ]
}
{
      "access_token": "<META_ACCESS_TOKEN>",
      "category": "Food delivery service",
      "category_list": [
        {
          "id": "1802051720039034",
          "name": "Food delivery service"
        }
      ],
      "name": "Amma Chethi Ruchulu",
      "id": "1196567856881791",
      "tasks": [
        "MANAGE",
        "CREATE_CONTENT",
        "MODERATE",
        "MESSAGING",
        "ADVERTISE",
        "ANALYZE"
      ]
    }
```



### C4. Get `IG_USER_ID`

Still in Explorer, **GET**:

```http
{PAGE_ID}?fields=instagram_business_account
123456789012345?fields=instagram_business_account

```

Replace `{PAGE_ID}` with the id from C3.

Example response:

```json
{
  "instagram_business_account": {
    "id": "1784140xxxxxxxxxx"
  },
  "id": "123456789012345"
}

{
  "instagram_business_account": {
    "id": "17841442342112674"
  },
  "id": "1196567856881791"
}
```

Copy `instagram_business_account.id` → that is `IG_USER_ID` for `/opt/ig-poster/.env`.

If `instagram_business_account` is missing:

- Page not linked to IG (redo A3)
- Wrong Page id
- Token missing `instagram_basic` / pages permissions



### C5. Prefer Page token as `ACCESS_TOKEN`

Our script posts with a **Page access token**.

**Option 1 (simplest):** use the `access_token` field returned under `me/accounts` for that Page (from C3).

**Option 2:** In Explorer, open the token / Page selector and choose the **Page** (not User), regenerate if needed, copy the token.

Put in `.env`:

```env
IG_USER_ID=1784140xxxxxxxxxx
ACCESS_TOKEN=EAAB...page_token_here...
```

---



## Part D — Make the token long-lived (important for VPS)

Explorer tokens **expire in hours**. For the VPS you want a long-lived Page token.

### D1. Long-lived User token

You need your app **App ID** and **App Secret** (App dashboard → Settings → Basic).

In a terminal **on your laptop** (do not commit the secret):

```bash
curl -sS "https://graph.facebook.com/v21.0/oauth/access_token" \
  -d "grant_type=fb_exchange_token" \
  -d "client_id=YOUR_APP_ID" \
  -d "client_secret=YOUR_APP_SECRET" \
  -d "fb_exchange_token=SHORT_LIVED_USER_TOKEN"

curl -sS -G "https://graph.facebook.com/v21.0/oauth/access_token" \
  --data-urlencode "grant_type=fb_exchange_token" \
  --data-urlencode "client_id=3726300327522156" \
  --data-urlencode "client_secret=<META_APP_SECRET>" \
  --data-urlencode "fb_exchange_token=<META_ACCESS_TOKEN>"
```

Response includes `access_token` ≈ **long-lived User token** (~60 days).

### D2. Long-lived Page token from that User token

```bash
curl -sS "https://graph.facebook.com/v21.0/YOUR_PAGE_ID" \
  -d "fields=access_token" \
  -d "access_token=LONG_LIVED_USER_TOKEN"
```

Or:

```bash
curl -sS "https://graph.facebook.com/v21.0/me/accounts" \
  -d "access_token=LONG_LIVED_USER_TOKEN"

curl -sS -G "https://graph.facebook.com/v21.0/me/accounts" \
  --data-urlencode "access_token=<META_ACCESS_TOKEN>"
```

Copy the Page’s `access_token` → put in VPS `/opt/ig-poster/.env` as `ACCESS_TOKEN`.

Page tokens obtained this way often **do not expire** while the app/password/Page link stay valid — still rotate if Meta invalidates them.

---



## Part E — Put values on the VPS

```bash
ssh root@162.35.105.110
nano /opt/ig-poster/.env
```

```env
IG_USER_ID=1784140xxxxxxxxxx
ACCESS_TOKEN=EAAB...
GRAPH_API_VERSION=v21.0
PUBLIC_BASE_URL=https://order.ammachethiruchulu.co.in/ig-staging
STAGING_DIR=/data/ig-staging
```

Save, then:

```bash
ig-post-now --dir /data/clients/acr/2026-09-15/carousel
```

---



## Part F — Quick verification before posting



### F1. Token works + IG id works

```bash
# on laptop (replace values)
curl -sS "https://graph.facebook.com/v21.0/IG_USER_ID?fields=id,username&access_token=ACCESS_TOKEN"
```

Expect `username` like `order.ammachethiruchulu`.

### F2. Staging URL still public

```bash
curl -I https://order.ammachethiruchulu.co.in/ig-staging/ping.txt
```

Expect HTTP 200.

---



## Common errors


| Error / symptom                              | Fix                                                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `instagram_business_account` empty           | Relink IG Professional ↔ Page                                                                      |
| `(#10) Application does not have permission` | Add `instagram_content_publish`; regenerate token; for other people’s accounts you need App Review |
| `Page Publishing Authorization`              | Complete PPA in Meta Business / Page settings if prompted                                          |
| `Invalid OAuth access token`                 | Token expired; redo Part D                                                                         |
| Container `ERROR` on publish                 | Image URL must be public HTTPS Meta can fetch; our staging path must return 200 JPEG               |
| Wrong account posted                         | Wrong `IG_USER_ID` — recheck C4                                                                    |


---



## Security

- Never commit `.env` or paste long-lived tokens into git/chat if avoidable.
- App Secret stays only on your machine / password manager.
- For **client** IG accounts later: they must grant Page access via Login; your app usually needs **Advanced Access** / App Review for `instagram_content_publish`.

---



## Checklist (print)

- [ ] IG is Professional  
- [ ] Facebook Page exists  
- [ ] IG linked to that Page  
- [ ] Meta app created; you are admin  
- [ ] Explorer permissions include publish + pages + instagram_basic  
- [ ] `me/accounts` → PAGE_ID (+ page token)  
- [ ] `PAGE_ID?fields=instagram_business_account` → **IG_USER_ID**  
- [ ] Long-lived Page token → **ACCESS_TOKEN**  
- [ ] Values in `/opt/ig-poster/.env`  
- [ ] `ig-post-now --dir ...` succeeds  