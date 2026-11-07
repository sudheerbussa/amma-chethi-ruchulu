# WhatsApp delivery tracking

Callbacks from every entry/change are acknowledged with HTTP 200 before processing. Existing inbound-message handling is unchanged. All sent/delivered/read/failed events are saved in `whatsapp_message_statuses`, including errors, recipient, Meta timestamp, and raw pricing/conversation/errors. Raw audit data includes phone numbers: protect database backups and never commit exports.

Campaign recipients are matched by wamid; API acceptance is not proof of delivery. A callback arriving before the send response is stored and replayed once the wamid is linked. Advisory locks and row locks serialize updates. Duplicate callbacks with the same wamid/status/timestamp do not duplicate audit rows. Read > delivered > sent; failed rejects sent, but a subsequent delivered/read wins. Unknown remains ambiguous and is never automatically resent.

`sql/whatsapp-status.pg.sql` is additive/idempotent. Run `node scripts/db-migrate-marketing.mjs` before starting the new bundle; it applies marketing and status migrations in one transaction. Existing rows remain; older messages have no recoverable status history unless Meta sends/retries a callback.

Admin > Customers & broadcast > Send WhatsApp template shows current-status counts, recipient timestamps in IST, Meta error codes, and plain-language failure reasons. Accepted means accepted only. Counts are mutually exclusive current states, not cumulative funnels. Refresh templates & campaigns to reload after a hidden tab stops polling. Unknown Meta codes keep the original error text.

Admin test input supports comma/space/semicolon-separated configured ADMIN_PHONES only (up to 10, deduplicated). POST `/admin/api/marketing/test-send` requires admin auth, UUID id, confirmed:true, name/language, params, and phones; it records a test campaign, honors opt-outs, and uses durable campaign IDs. Repeating the same content/ID does not resend completed recipients. New campaign creates a fresh ID; only click it deliberately. No startup, GET, migration, or verification action sends messages.

Known per-recipient errors (131049/131026/130472/131047/131050) fail that recipient without stopping unrelated recipients or automatic retries; billing/auth/template/account errors halt queued work.

## Deployment verification (no WhatsApp send)
- Back up the app (including private .env/keys root-only) and `pg_dump -Fc acr_fresh` before copying files.
- Confirm ADMIN_TOKEN is present without displaying it; this bundle includes removal of the old unsafe fallback.
- Selectively copy dist, public/admin.html, SQL, migration and smoke script. Do not replace .env, data, uploads, dependencies or Food bot files.
- Apply migration, restart only pm2 acr-fresh-bot, and check localhost/public health and fresh logs.
- In `/opt/acr-fresh-bot`, run `node scripts/verify-delivery-status.mjs`. This injects fake statuses on localhost, verifies DB/admin projections and removes only its own synthetic rows. It never calls WhatsApp or creates a running campaign.
- For end-to-end delivery, the owner must separately approve/send a real test from admin. This deployment does not send one.

## Existing security limitation
The webhook still lacks Meta signature verification (unchanged). Synthetic-localhost verification does not prove that Meta is delivering callbacks, or identify the reason for an earlier undelivered message. Add signature verification as a separately scoped hardening change. Acknowledgement precedes async persistence, so a crash immediately after acknowledgement can lose a callback.
