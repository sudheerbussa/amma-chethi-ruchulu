# Disable WhatsApp Ice Breakers (hours / price-range chips)

Those two chips — **"What are the hours?"** and **"Whats the prices range of your menu?"** — are **Meta Ice Breakers**, not messages from our order bot. Meta often enables restaurant defaults on the Cloud API number.

They show when someone (including an admin testing the business number) opens a **new** chat with **+91 98235 83498**.

## Clear them (API — preferred)

On the VPS (or any machine with the bot `.env`):

```bash
cd /opt/order-bot   # or local order-bot folder
node scripts/clear-ice-breakers.mjs --show   # see current prompts
node scripts/clear-ice-breakers.mjs          # set prompts to []
```

Needs `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`.

## Clear them (Meta UI)

1. [business.facebook.com](https://business.facebook.com) → **WhatsApp Accounts** → your ACR account  
2. Open **WhatsApp Manager** → phone number **gear / Automations**  
3. **Ice breakers** → Edit → **remove all** → Save  

Optional: also turn off any unused **Commands** / welcome automation there.

## After clearing

Delete the old chat with the business number on your phone (Clear chat → Delete chat), then open a new chat — the chips should be gone.

If a customer still taps an old chip, the bot now answers with hours / price list and **Lunch / Dinner / View menu**.
