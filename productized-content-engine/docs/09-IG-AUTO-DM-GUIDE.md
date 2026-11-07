# Guide — Instagram comment → DM (Graph API)

Primary path for ACR and the productized offer: **our VPS bot** (`mvp/ig-dm-bot`) using Meta **private replies** + **comment webhooks**. No ManyChat. No Meta Business Suite Inbox automations.

Official refs:
- [Private replies](https://developers.facebook.com/docs/instagram-platform/private-replies)
- [Webhooks](https://developers.facebook.com/docs/instagram-platform/webhooks/)
- Package setup: [mvp/ig-dm-bot/META-SETUP.md](../mvp/ig-dm-bot/META-SETUP.md) · [README](../mvp/ig-dm-bot/README.md)

---

## 1) What we automate (v1)

| Trigger | Action |
|---------|--------|
| Comment contains keyword (ACR: `MENU`) | One **private DM** with WhatsApp / magnet link |

**Not in v1:** multi-step DM quizzes, Story replies, cold DMs, ManyChat-style sequences.

Meta rules that still apply:

- User must comment (or otherwise interact) first — no cold outreach.
- **One** private reply per comment; within **7 days**.
- Further DMs only if they reply (≈24h messaging window).

---

## 2) Architecture

```text
Comment "MENU" on ACR post
        │
        ▼
Meta webhook → https://order.ammachethiruchulu.co.in/webhooks/instagram
        │
        ▼
/opt/ig-dm-bot (keyword match + dedupe)
        │
        ▼
POST /{PAGE_ID}/messages  recipient.comment_id + text
        │
        ▼
User gets IG DM → taps wa.me → order bot
```

Same Meta app / **Facebook Login** / long-lived **Page token** model as `ig-poster`.

---

## 3) Prerequisites (every account)

1. Instagram **Professional** + linked **Facebook Page**.  
2. Page token with: `instagram_manage_comments`, `pages_manage_metadata`, `pages_messaging`, `pages_read_engagement`, `pages_show_list`.  
3. Phone: **Allow access to messages** for connected tools (IG settings).  
4. App webhook subscribed to `comments`; Page subscribed to the app.  
5. Bot `.env` on VPS filled (`PAGE_ID`, `ACCESS_TOKEN`, `APP_SECRET`, `VERIFY_TOKEN`, `IG_USER_ID`).

Details: [META-SETUP.md](../mvp/ig-dm-bot/META-SETUP.md).

**Own ACR:** Development mode + you as admin/tester is enough.  
**Client Pages:** App Review + Advanced Access (Phase 2).

---

## 4) Recommended funnel (Sleeping Creators style)

```text
Caption CTA: "Comment MENU for today's menu on WhatsApp"
        │
        ▼
Comment MENU
        │
        └─► Private DM: short line + wa.me link
```

Optional later: public comment reply “Sent — check your DM” (not in v1 bot).

Put the same keyword in **bio** as a backup: `DM / comment MENU`.

---

## 5) Ops checklist (before promising lead-gen)

- [ ] `/opt/ig-dm-bot` online (`pm2`, health on `:3010`)  
- [ ] Caddy routes `/webhooks/instagram` to the bot  
- [ ] Meta webhook verifies (challenge returns hub.challenge)  
- [ ] Page subscribed to `comments`  
- [ ] Second-account test: comment `MENU` → DM received  
- [ ] `clients/acr.json` (or client rules) keyword + reply URL correct  

---

## 6) Metrics

Log lines on VPS (`pm2 logs ig-dm-bot`): keyword hits, Graph success/errors.  
Optionally append `comment_id` + timestamp to a jsonl under `/data/ig-dm-bot/` later.

Report **keyword triggers / week**, not only likes.

---

## 7) Alternatives (not our default)

| Tool | Role |
|------|------|
| ManyChat / similar | Paid contact caps; OK if a client already uses them |
| Meta Business Suite Inbox automations | Free but limited (delays, few keywords); fine as a stopgap, not our product core |
| Unofficial password / browser bots | **Do not use** — ban risk |

---

## 8) Troubleshooting

| Symptom | Fix |
|---------|-----|
| Webhook challenge 403 | `VERIFY_TOKEN` mismatch |
| 401 on POST | `APP_SECRET` / signature; check raw body not parsed before HMAC |
| No events | Page not subscribed; wrong callback URL; Development + tester only |
| Graph permission error | Regenerate Page token with messaging + comment scopes; enable message access on phone |
| DM never arrives | User must check Message requests; one reply per comment already used |
| Double sends | Dedupe file; Meta retries — we store `comment_id` before send |

---

## 9) First drill (ACR)

1. Complete [META-SETUP.md](../mvp/ig-dm-bot/META-SETUP.md).  
2. Confirm `curl` health + public verify challenge.  
3. From a **second** IG account, comment `MENU` on a live ACR post.  
4. Confirm DM + WhatsApp link.  
5. Comment junk text → no DM.  
6. Same `MENU` again on a **new** comment → one new DM (new `comment_id`).

---

## Related

- Offer scope: [06-RESEARCH-LEADS-RESULTS.md](06-RESEARCH-LEADS-RESULTS.md)  
- Onboarding: [07-ONBOARDING-CHECKLIST.md](07-ONBOARDING-CHECKLIST.md)  
- Transcript model: [08-TRANSCRIPT-INSIGHTS.md](08-TRANSCRIPT-INSIGHTS.md)  
- Poster tokens: [mvp/ig-poster/GET-TOKENS.md](../mvp/ig-poster/GET-TOKENS.md)
