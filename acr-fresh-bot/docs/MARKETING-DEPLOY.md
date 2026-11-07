# Prepared deployment — NOT executed

Do not run until the owner explicitly approves production deployment. Approval to deploy does not approve sending a test or campaign.

Local source backup: `backup-before-templates-20261107/` (src, admin.html, SQL, package manifests and changed packaging script). No VPS files/processes were changed while preparing this feature.

## Exact commands for the prepared release

On the owner's PC:

```bash
cd /home/innotronix/SudhirLaptop_Backup/business_proposal/acr-fresh-bot
REL=acr-fresh-bot-20261107-080233
scp "release/$REL.tar.gz" root@162.35.105.110:/tmp/
ssh root@162.35.105.110 "REL='$REL' bash -s" <<'VPS'
set -euo pipefail
umask 077
APP=/opt/acr-fresh-bot
BACKUP="/root/acr-fresh-backups/$(date +%Y%m%d-%H%M%S)-before-marketing"
mkdir -p "$BACKUP"
# Root-only app backup includes .env and private Flow keys; never publish/upload it.
tar --exclude=node_modules --exclude=release -czf "$BACKUP/app.tar.gz" -C /opt acr-fresh-bot
runuser -u postgres -- pg_dump -Fc acr_fresh > "$BACKUP/acr_fresh.dump"
printf '%s\n' "$BACKUP" > /root/acr-fresh-last-marketing-backup
STAGE="$(mktemp -d /tmp/acr-fresh-marketing.XXXXXX)"
tar -xzf "/tmp/$REL.tar.gz" -C "$STAGE"
cd "$APP"
# Selective copy: do not overwrite uploads, Food files, production data or .env.
cp -a "$STAGE/$REL/dist/." dist/
cp -a "$STAGE/$REL/public/admin.html" public/admin.html
mkdir -p sql scripts docs
cp -a "$STAGE/$REL/sql/marketing.pg.sql" sql/
cp -a "$STAGE/$REL/scripts/db-migrate-marketing.mjs" "$STAGE/$REL/scripts/configure-marketing-env.mjs" scripts/
cp -a "$STAGE/$REL/docs/MARKETING-TEMPLATES.md" "$STAGE/$REL/docs/MARKETING-DEPLOY.md" docs/
# Runtime dependencies have not changed; preserve installed production dependencies/package manifests.
# Helper sets WHATSAPP_WABA_ID=2336111803586962 and merges Food staff exclusions.
# Existing REFERRAL_DATABASE_URL matches Food; no new credential is needed.
node scripts/configure-marketing-env.mjs
node scripts/db-migrate-marketing.mjs
pm2 restart acr-fresh-bot --update-env
curl --fail --silent http://127.0.0.1:3001/health
printf '\nBackup retained at %s\n' "$BACKUP"
VPS
```

The migration is additive and transactional; unlike a full existing db:migrate it touches only the three new marketing tables. Full schema.pg.sql also includes those definitions for fresh installations. Keep the existing pm2 process configuration unchanged. Never restart acr-order-bot.

## Smoke checks (no WhatsApp send)
- Fresh health reports driver pg.
- Existing ordering/admin pages still load.
- Log in to Fresh Admin and open Customers & broadcast. Refresh templates and audience counts; do not press either Send button without separate approval.
- Template list reflects Meta APPROVED state and offers each language separately.
- History loads empty initially. Counts should be near the saved 7 November snapshot, but live activity can change them.
- Check pm2 logs locally for migration/SQL errors without sharing tokens or customer phone numbers.

## Rollback (owner approval required)

Use the root-only backup path saved above. Restore the prior application files and .env, then restart Fresh only. Leave additive marketing tables in place so opt-outs/campaign audit survive; do not restore/drop the live DB unless separately approved, since doing so would lose later orders.

```bash
# On the VPS, ONLY after approval to roll back:
BACKUP="$(< /root/acr-fresh-last-marketing-backup)"
ROLLBACK="$(mktemp -d /tmp/acr-fresh-rollback.XXXXXX)"
tar -xzf "$BACKUP/app.tar.gz" -C "$ROLLBACK"
cp -a "$ROLLBACK/acr-fresh-bot/dist/." /opt/acr-fresh-bot/dist/
cp -a "$ROLLBACK/acr-fresh-bot/public/admin.html" /opt/acr-fresh-bot/public/admin.html
cp -a "$ROLLBACK/acr-fresh-bot/.env" /opt/acr-fresh-bot/.env
pm2 restart acr-fresh-bot --update-env
curl --fail --silent http://127.0.0.1:3001/health
```
