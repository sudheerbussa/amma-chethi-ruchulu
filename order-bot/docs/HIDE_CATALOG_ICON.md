# Hide WhatsApp Catalog icon (Meta)

Customers can still see a **Catalog** shop icon on the chat header even when the bot no longer uses Catalog for ordering. Turn it off per phone number.

## Option A — Meta Business Suite / WhatsApp Manager (UI)

1. Open [Meta Business Suite](https://business.facebook.com/) → **WhatsApp Manager** (or **WhatsApp Accounts**).
2. Select the WABA that owns the number:
   - Food: **+91 98235 83498**
   - Fresh: **+91 93920 44833**
3. Go to **Catalog** / **Commerce** / **Shopping** settings for that phone number  
   (wording varies: *WhatsApp Manager → Phone numbers → [number] → Catalog*, or *Commerce settings*).
4. Find **Show catalog icon in chat header** / **Catalog visibility** / **Cart & catalog** and **turn it off**.
5. Save. On the customer phone: close WhatsApp fully (or clear chat cache) and reopen — the shop/catalog icon should disappear within a few minutes (sometimes up to ~1 hour).

If you do not see the toggle, use Option B (API) — it is the same setting.

## Option B — Graph API (recommended; both numbers)

Needs a token with `whatsapp_business_management` (same System User token as the bot is fine if it already manages the WABA).

```bash
# Food
curl -s -X POST \
  "https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/whatsapp_commerce_settings?is_catalog_visible=false" \
  -H "Authorization: Bearer ${WHATSAPP_TOKEN}"

# Fresh (use Fresh phone number id + Fresh token)
curl -s -X POST \
  "https://graph.facebook.com/v21.0/${WHATSAPP_FRESH_PHONE_NUMBER_ID}/whatsapp_commerce_settings?is_catalog_visible=false" \
  -H "Authorization: Bearer ${WHATSAPP_TOKEN}"
```

Expected JSON includes `"is_catalog_visible":false` (or success with that field).

To verify:

```bash
curl -s \
  "https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/whatsapp_commerce_settings" \
  -H "Authorization: Bearer ${WHATSAPP_TOKEN}"
```

## Notes

- Hiding the icon does **not** delete the Meta catalog product set; it only hides the chat header entry point.
- Keep `WHATSAPP_CATALOG_ID` unset / commented on the VPS so the bot does not sync or offer Catalog checkout.
- If the icon remains after API + UI off: customer may be looking at an old chat thread cache — ask them to open the number from a new chat / force-stop WhatsApp.
