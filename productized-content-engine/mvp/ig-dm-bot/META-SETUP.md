# Meta app setup — Instagram comment → private DM

Use the **same** Meta app as `ig-poster` (Facebook Login). Do this once before the VPS bot can receive comments.

Official refs:
- [Private replies](https://developers.facebook.com/docs/instagram-platform/private-replies)
- [Webhooks](https://developers.facebook.com/docs/instagram-platform/webhooks/)

---

## 1) Permissions (Graph API Explorer → Generate Token)

Add / re-approve (on top of publish scopes you already have):

| Permission | Why |
|------------|-----|
| `instagram_manage_comments` | Comment webhooks + comment context |
| `pages_manage_metadata` | Subscribe Page to webhooks |
| `pages_messaging` | Send private reply via `/{PAGE_ID}/messages` |
| `pages_read_engagement` | Page/IG engagement |
| `pages_show_list` | `me/accounts` |

Then exchange for a **long-lived Page token** (same D1/D2 flow as [GET-TOKENS.md](../ig-poster/GET-TOKENS.md) Part D). Put that token in `/opt/ig-dm-bot/.env` as `ACCESS_TOKEN`.

Also set:

```env
PAGE_ID=<from me/accounts>
IG_USER_ID=<instagram_business_account.id>
APP_SECRET=<App Dashboard → Settings → Basic>
VERIFY_TOKEN=<invent a long random string>
```

---

## 2) Instagram “Allow access to messages”

On the phone, logged into `@order.ammachethiruchulu`:

**Settings → Messages and story replies → Message controls → Connected tools → Allow access to messages = ON**

Without this, private replies often fail silently or with permission errors.

---

## 3) Webhooks product

1. Meta App Dashboard → **Webhooks** (or Instagram / Messenger product → Webhooks).
2. Callback URL:

```text
https://order.ammachethiruchulu.co.in/webhooks/instagram
```

3. Verify token = same as `VERIFY_TOKEN` in `.env`.
4. Subscribe to field **`comments`** (Instagram).
5. Subscribe the **Facebook Page** (ACR) to the app if prompted (`/{PAGE_ID}/subscribed_apps` with `subscribed_fields=comments` or dashboard UI).

Example subscribe (Page token):

```bash
curl -sS -X POST "https://graph.facebook.com/v21.0/PAGE_ID/subscribed_apps" \
  -d "subscribed_fields=comments" \
  -d "access_token=PAGE_ACCESS_TOKEN"
```

---

## 4) Development vs Live

| Audience | Mode |
|----------|------|
| Your own ACR Page / IG (app admin or tester) | **Development** is enough |
| Other clients’ Pages | App Review + **Advanced Access** for comments / messaging |

---

## 5) Quick verify

```bash
# Health (from VPS)
curl -sS http://127.0.0.1:3010/health

# Public callback must answer Meta challenge (after Caddy deploy)
curl -sS "https://order.ammachethiruchulu.co.in/webhooks/instagram?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=12345"
# expect: 12345
```

Then from a **second** Instagram account (not the business): comment `MENU` on an ACR post → expect one DM with the WhatsApp link.
