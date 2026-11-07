# Food + Fresh WhatsApp template campaigns

Prepared locally 7 November 2026 (IST). No real messages were sent during implementation/testing. Production was not modified.

## Use
1. After approved deployment, open Fresh Admin → Customers & broadcast → Send WhatsApp template.
2. Refresh to read APPROVED MARKETING/UTILITY templates directly from the configured WABA. Pending templates do not appear. This sender supports consecutive numeric body parameters, static text headers, static URLs, and Stop offers quick-reply buttons; other template shapes are shown disabled.
3. Choose the Telugu (`te`) or English (`en`) entry. Name parameter 1 is automatic. For an offer enter parameter 2 (offer) and 3 (expiry, including IST). Preview the text.
4. Default audience includes only customers who ordered before. Uncheck “Exclude customers who never ordered” to include people with prior inbound interaction but no order. Confirm applicable WhatsApp marketing permission; past interaction/ordering alone is not necessarily marketing opt-in.
5. Enter your own number and send one test only when you intend a real WhatsApp send. Tests may include staff, never suppressed numbers. Meta fees may apply. Implementation testing did NOT use this button on a live account.
6. After inspecting the test, confirm Send to N customers. Recipient count is revalidated on creation. One campaign is sent at a time, around one message per 1.1 seconds plus network time. If a second campaign stays queued while another runs, resume it after the first finishes.
7. Progress separates accepted from delivered/read/failed. History retains campaign IDs, recipient message IDs, and errors. Refresh the selected campaign to pick up later delivery/read receipts. “Completed” means attempts are complete, not guaranteed delivery.
8. Pause stops between recipients; a send already in progress can finish. Resume sends only queued recipients. Rate limits back off, while auth/template/quality errors halt. Transport errors/restarts are marked unknown and never blindly retried. Check Meta logs manually for unknown recipients. No sends resume automatically on server startup.

## Repeat safety
The browser retains a separate UUID and content fingerprint for test/audience requests. Retrying an unchanged request after a timeout reuses that UUID. Server constraints prevent duplicate recipients for the same campaign. Advisory locking permits only one worker across processes. Use New campaign explicitly to resend identical content; creating a DIFFERENT campaign can intentionally send again. No content-based permanent deduplication is imposed across campaigns.

## Audience and Food data
Fresh uses its own Postgres customers, orders and inbound-message log. Food uses a separate read-only pool (default_transaction_read_only=on) pointed at FOOD_DATABASE_URL, falling back to the existing REFERRAL_DATABASE_URL. This VPS uses acr_fresh and acr_orders respectively; the existing Fresh referral URL is already the Food URL. No Food schema or records are changed.

Customers must have an order or logged inbound interaction. Indian mobile numbers are normalized to 91 plus ten digits and deduplicated. Bad/non-Indian numbers are not eligible. Fresh-only/Food-only mean membership in that brand's customers, including overlap; the union never sends twice. Not-recent compares the latest order from EITHER business; N defaults to seven days. Registered riders from both databases, Fresh env admin/rider phones, configured MARKETING_EXCLUDED_PHONES, and both bot numbers are excluded. Keep Food staff env exclusions synchronized by rerunning the env helper after any Food admin/rider-env change.

Opt-outs persist in Fresh marketing_suppressions. Stop offers / Offers వద్దు template quick replies work even during an order. Trimmed, case-insensitive plain STOP/START applies outside an active cart/order/payment flow; active legacy STOP cancellation is preserved, including idle sessions with pending payments. Use the template button if an order is active. START re-enables only Fresh marketing. Existing Fresh free-form/menu broadcast endpoints remain and now also exclude suppressed recipients. Transactional order updates and customer-requested bot replies remain unaffected. Food's own sending implementation is unchanged.

## Tables and environment
- marketing_suppressions, marketing_campaigns, marketing_recipients in Fresh only.
- WHATSAPP_WABA_ID: WABA identifier; no code default.
- FOOD_DATABASE_URL: optional read-only query source, falls back to REFERRAL_DATABASE_URL.
- MARKETING_EXCLUDED_PHONES: additional staff exclusions (deployment helper merges Food staff env entries).
- Existing WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID and API version are reused. Never put tokens in the browser.

## Validation and limits
`npm test` runs pure logic/worker tests, mocked-fetch WhatsApp tests, in-memory PGlite PostgreSQL schema/storage tests and jsdom admin-card tests. Tests never call Meta or a production DB. Run with Node 22+ for the test dependencies; production bundle still targets Node 18+. Advisory locking is SQL-call mocked in embedded SQL tests and behavior-tested with worker locks; an actual production campaign has intentionally not been run.

Remaining operational checks after approval: Meta template approval, token permission/phone-account match, an explicitly approved real test to the owner's number, live quick-reply/STOP receipt, delivery/read webhook subscription, and mobile rendering. The current webhook's existing lack of signature verification is not changed by this feature; harden it before trusting publicly submitted preference/status payloads. Recipient consent remains the operator's responsibility. A database role restricted to SELECT on Food tables is recommended in addition to the pool read-only setting.
