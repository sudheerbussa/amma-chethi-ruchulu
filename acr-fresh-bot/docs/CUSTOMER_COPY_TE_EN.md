# Customer WhatsApp copy — Telugu + English (ACR-Fresh)

**Status:** Implementing in batches. **Batch 1 (welcome / name / home)** → `copy.js` + `cutoffs.js` slot status.

**ACR-Fresh notes (not food bot):**

- Home buttons: **Order · View menu · Help** (not Lunch / Dinner).
- Slot status replaces lunch/dinner meal status on Hi.
- Buttons, list titles, Flow footers stay **English**.

**Goal**

1. Customers expect **Telugu** on welcome and most instruction / explanation messages.
2. Keep messages **short** (one idea per bubble; drop repeated instructions).
3. **Buttons and list titles stay English** (IDs + visible titles: Lunch, Dinner, Help, Checkout, Pay now, list rows, Flow CTAs, footers that mirror button names).
4. Dish names, prices, order refs, UPI IDs stay as-is (no translation of SKUs).

**How to use this doc**

- For each row: **Existing** → **Suggested TE** (message body) → **Suggested EN** (optional short EN if we keep a bilingual line).
- Telugu bodies may *mention* English button names (`Lunch`, `Dinner`, `HELP`, `Pay now`) so taps match what they see.
- Reply with: `Approve all` or list IDs to change (e.g. `W3 shorter`, `P2 keep EN pay block`).
- After approval we edit `src/copy.js`, `cutoffs.js`, `orders/status.js`, `handlers/message.js`, then deploy. Flow **screen headings** (instruction text) can be Telugu; Flow **button/footer labels** stay English.

**Style rules (locked)**

| Rule | Why |
|------|-----|
| **English only** for button titles, list row titles, CTA display text, interactive footers that name actions | Clear taps; no Meta truncation; matches current UX |
| **Telugu** for explanation / instruction / status bodies | Customer expectation |
| Max ~3–5 short lines for status / welcome extras | Less scroll |
| One community invite line, not a speech | Already on cool-off for Hi |
| In TE body, keep action words as shown on buttons (`Lunch`, `HELP`, `Pay now`) | User sees same label on the button |
| Don’t dual-write every sentence TE+EN | Prefer Telugu body; one EN keyword only when needed |

**Files that own copy**

| Stage | File(s) |
|-------|---------|
| Welcome, name, address prompt, community | `src/copy.js` |
| Meal open/closed, advance booking | `src/cutoffs.js` |
| Status / payment thanks / feedback | `src/orders/status.js` |
| Cart format | `src/orders/cart.js` |
| Almost all interactive chat | `src/handlers/message.js` |
| Flow screen headings | `src/flows/screens.js` + `docs/flow-order-v2.json` |
| Hours ice-breaker | `src/menu-text.js` |

---

## 0. Buttons / list titles — English only (locked)

Do **not** translate these. Keep existing English (trim length only if needed for WhatsApp limits: button title ≤20, list title ≤24).

| ID / control | Title (English — keep) |
|--------------|------------------------|
| `lunch` / `dinner` | Lunch · Dinner |
| `view_menu` | View menu |
| `start_over` | Start over |
| Checkout / Add more / Edit / Clear | Checkout · Add more · Edit · Clear |
| Help / Status / MORE | Help · Status · MORE |
| Name confirm | Yes · Change name |
| Pin | Use saved pin · New pin |
| Pay CTA | Pay now |
| Flow CTA | Order form |
| Category / dish **list rows** | English category titles + dish names (from menu) |
| HELP topic **list rows** | English topic titles (Payment failed, Cancel unpaid, …) |
| Footers | e.g. `MORE · STATUS · HELP` (English) |

Telugu belongs only in the **message body** above the buttons (e.g. `లంచ్ / డిన్నర్ నొక్కండి` → better: `*Lunch* లేదా *Dinner* నొక్కండి`).

---

a## 1. Welcome / name / home ✅ Batch 1 (ACR-Fresh)

| ID | When | Body (Telugu — live) | Buttons (English) |
|----|------|----------------------|-------------------|
| W1 | Greet | ✅ `నమస్తే {name}! 🙏` / `నమస్తే! 🙏` | — |
| W2 | Welcome | ✅ locked — greet + `🥬 కూరగాయలు & పండ్లు` + `Minimum ఆర్డర్ ₹…` · unlisted call only in Order form | Order · View menu · Help |
| W3 | No name yet | ✅ dropped — name only when they start Order (W4/W5) | — |
| W4 | Ask name | ✅ `స్వాగతం!\nమీ పేరు రాయండి (ఉదా: రవి).` | — |
| W5 | Confirm WA name | ✅ `WhatsApp పేరు: *{n}*\nఈ పేరు సరైందా?\n*Yes* లేదా *Change name* నొక్కండి.` | Yes · Change name |
| W6 | Name saved | ✅ dropped — go straight to Order after name | — |
| W7 | Invalid name | ✅ `సరైన పేరు రాయండి (కనీసం 2 అక్షరాలు).` | — |
| W8 | Rate nudge | ✅ dropped from Hi — rate via *MORE* → Rate last order only | — |
| W9 | Reorder nudge | ✅ dropped from Hi — reorder via *MORE* → Order again only | — |
| W10 | Community Hi | ✅ `📢 ఆఫర్లు / ప్రశ్నలు:\n{url}` | — |

**Footer:** `MORE · STATUS · HELP` (English).

---

## 1b. Welcome / name / home (legacy food-bot table)

---

## 2. Meal status & cutoffs (biggest welcome length)

### C1 — `mealStatusText()` → slot status on Hi ✅

Slot lines in `slotStatusText()` (Telugu): ఈరోజు, గంటవారీ డెలివరీ, బుక్ ahead, open slots list.

### C1 — `mealStatusText()` (food-bot pattern — reference)

| ID | Existing (pattern) | Suggested TE (short) | Suggested EN (short) |
|----|--------------------|----------------------|----------------------|
| C1a | `📅 Today: {day} (IST)` + `⏱ Order-by…` + long OPEN/CLOSED bullets | `📅 {day}` + `లంచ్: తెరిచి / మూసి · {by} వరకు · సర్వ్ ~{serve}` + same for డిన్నర్ (1 line each) | `📅 {day}` + `Lunch: OPEN/CLOSED · by {by} · ~{serve}` (1 line each) |
| C1b | Long CLOSED + “Book for tomorrow…” | `లంచ్ మూసి · రేపు బుక్: {when} · ~{serve}` | `Lunch closed · book {when} · ~{serve}` |
| C1c | Sunday party note (long) | `⚠️ ఆదివారం: పార్టీ ప్యాక్ డిన్నర్ మాత్రమే` | `⚠️ Sunday: party packs dinner only` |

**Proposal:** Drop “usual order by”, “IST” repeats, and nested “next order by” from welcome. Full detail only when user taps a closed meal (advance prompt).

### C2 — `advanceSlotPrompt` / Sunday

| ID | Existing (summary) | Suggested TE | Suggested EN |
|----|--------------------|--------------|--------------|
| C2a | Today closed + long pre-order block + other meal + “What would you like?” | `{Meal} ఈరోజు మూసి ({by}).\nబుక్: {when} · సర్వ్ ~{serve}\n{other? లేదా ఈరోజు {Other} తెరిచి.}\nఏది కావాలి?` | `{Meal} closed today ({by}).\nBook: {when} · ~{serve}\n{other?}\nWhat next?` |
| C2b | Sunday lunch closed + party dinner essay | `ఆది లంచ్ మూసి.\nడిన్నర్: పార్టీ ప్యాక్ మాత్రమే.\nలేదా {meal} ప్రీ-ఆర్డర్: {when}.` | `Sunday lunch closed.\nDinner: party packs only.\nOr pre-order {meal}: {when}.` |
| C2c | `sundayPartyOrderNotice` (3 long lines) | `⚠️ ఆది డిన్నర్: పార్టీ ప్యాక్ (2–5 కేజీ) మాత్రమే. లంచ్ మూసి.` | `⚠️ Sunday dinner: party packs only. Lunch closed.` |
| C2d | Mid-browse cutoff | `ఈరోజు {Meal} విండో మూసింది — కార్ట్ క్లియర్. మళ్లీ ఎంచుకోండి.` | `Today’s {Meal} window closed — cart cleared.` |

### C3 — Booking confirm (after Lunch/Dinner)

| ID | Existing | Suggested TE | Suggested EN |
|----|----------|--------------|--------------|
| C3a | `Booking Lunch for today (…)\nOrder by … · serve ~…` | `{Meal} · {day}\nఆర్డర్ {by} వరకు · సర్వ్ ~{serve}` | `{Meal} · {day}\nOrder by {by} · ~{serve}` |
| C3b | Flow CTA body | `{Meal} today · {day}\nTap Order form.` | `{Meal} · {day}\n*Order form* నొక్కండి.` | `{Meal} · {day}\nTap Order form.` |

---

## 3. Menu / cart / qty — Batch 2

- Button fallback (M1–M10): **deferred** — leave EN for now.
- **Order form (Flow) screens:** review next (F-SLOT → F-CONFIRM).

| ID | Screen | Status |
|----|--------|--------|
| F-SLOT | Delivery hour | ✅ **last** (after address) · heading `డెలివరీ గంట ఎంచుకోండి` · skip chat picker if set | Continue |
| F-CAT | Category | ✅ first · heading = unlisted call tip | Continue |
| F-DISH | Item pick | ✅ heading = category TE · label `Choose an item` | Continue |
| F-SIZE | Pack size | pending | Add to cart |
| F-DISH | Item pick | pending |
| F-SIZE | Pack size | pending |
| F-QTY | Quantity | pending |
| F-CART | Cart | pending |
| F-ADDR | Address | pending |
| F-CONF | Confirm | pending |

---

## 3b. Menu / cart / qty (legacy / button — deferred)

| ID | When | Existing | Suggested TE | Suggested EN |
|----|------|----------|--------------|--------------|
| M1 | Category list body | Long portions / party note | `{Meal} · {day}\nకేటగిరీ ఎంచుకోండి.` (+ party one-liner if Sunday) | `{Meal} · {day}\nPick a category.` |
| M2 | Dish list | Tap one-by-one essay + code tip | `{cat} · {day}\nఐటమ్ ఎంచుకోండి (ఒక్కొక్కటి).` | `{cat} · {day}\nPick items one by one.` |
| M3 | Empty category | `No {cat} items available right now.` | `ఇప్పుడు {cat} ఐటమ్స్ లేవు.` | `No {cat} items now.` |
| M4 | Qty | `How many of {dish}?\n₹ each` + long tips | `{dish}\nఎన్ని? · {₹}/ఒక్కటి` | `{dish}\nHow many? · {₹} each` |
| M5 | Added | `Added {n}x {dish} (₹…).` | `జోడించాం: {n}× {dish} (₹…)` | `Added {n}× {dish} (₹…)` |
| M6 | Cart empty | `Cart is empty. Tap Lunch or Dinner…` | `కార్ట్ ఖాళీ. *Lunch* / *Dinner* నొక్కండి.` | `Cart empty. Tap Lunch / Dinner.` |
| M7 | Min order | `Minimum order is ₹X (food). Your cart is ₹Y…` | `మినిమం ఆర్డర్ ₹X. మీ కార్ట్ ₹Y.` | `Min order ₹X. Cart ₹Y.` |
| M8 | Cart header (`formatCartMessage`) | `Your cart (N items):` + food total + offers | `మీ కార్ట్ ({N}):` + `ఫుడ్: ₹…` | `Your cart ({N}):` + `Food: ₹…` |
| M9 | Reorder confirm | `Re-added:… Checkout or edit cart.` | `మళ్లీ జోడించాం:\n…\n*Checkout* లేదా cart ఎడిట్.` | `Re-added:\n…\nCheckout or edit.` |
| M10 | Clear / remove | `Cart cleared…` / `Removed {name}…` | `కార్ట్ క్లియర్.` / `{name} తీసేశాం.` | `Cart cleared.` / `Removed {name}.` |

---

## 4. Address / pin / delivery

| ID | When | Existing | Suggested TE | Suggested EN |
|----|------|----------|--------------|--------------|
| A1 | Saved addresses | `{cart}\n\nPick a saved address, or New address.` | `{cart}\n\nసేవ్డ్ అడ్రస్ ఎంచుకోండి లేదా *New address*.` | `{cart}\n\nPick saved address or New.` |
| A2 | New / pin ask | `📍 Share your delivery pin below, or type tower / flat / landmark.` | `📍 డెలివరీ పిన్ పంపండి (లేదా టవర్ / ఫ్లాట్ / ల్యాండ్‌మార్క్ రాయండి).` | `📍 Share delivery pin (or type landmark).` |
| A3 | Pin OK | `📍 Pin OK · ~{km} · {zone}` | `📍 పిన్ OK · ~{km} · {zone}` | Keep short EN |
| A4 | Out of range | Long Tenali km apology | `క్షమించండి — ~{km}. మేము తెనాలి ~{max} కి.మీ వరకే. దగ్గరి పిన్ పంపండి.` | `Sorry — ~{km}. We deliver within ~{max} km of Tenali.` |
| A5 | Short address | `Please send a fuller address…` | `పూర్తి అడ్రస్ రాయండి (టవర్ / ఫ్లాట్ / ల్యాండ్‌మార్క్).` | `Send fuller address (tower / flat / landmark).` |
| A6 | Confirm saved pin (Flow) | `📍 Confirm delivery pin\n… Use it or send a new pin.` | `📍 డెలివరీ పిన్ నిర్ధారించండి\n{landmark}\n*Use saved pin* లేదా *New pin*.` | `📍 Confirm pin\nUse saved or send new.` |
| A7 | Pin-only trap | `Please share your *map pin*…` | `దయచేసి *map pin* పంపండి. రద్దు: *Start over*.` | `Please share your *map pin*. Cancel: Start over.` |
| A8 | Stray location | `Thanks for the location pin. Tap Lunch or Dinner…` | `పిన్ వచ్చింది. ఆర్డర్‌కి *Lunch* / *Dinner* నొక్కండి.` | `Got pin. Tap Lunch / Dinner to order.` |
| A9 | Zone / flat fee | Long ₹30/45/60 picker text | Keep numbers; body: `డెలివరీ దూరం ఎంచుకోండి` / `ఈరోజు ఫ్లాట్ ₹X` | `How far?` / `Flat delivery ₹X` |

---

## 5. Payment

| ID | When | Existing | Suggested TE | Suggested EN |
|----|------|----------|--------------|--------------|
| P1 | Order noted header | `{Name}, Order {ref} noted ✅` + service + items + totals | `{Name}, ఆర్డర్ {ref} ✅\n{service}\n{items}\nఫుడ్ / డెలివరీ / మొత్తం…` | `{Name}, Order {ref} ✅` (same structure, shorter labels) |
| P2 | Pay block (Razorpay) | Long “Tap Pay now… Do not reply PAID…” | `కింది *Pay now* నొక్కి చెల్లించండి.\nచెల్లింపు తర్వాత status ఆటో అప్‌డేట్.` | `Tap *Pay now*. Status updates after pay.` |
| P3 | Pay + UPI mix | Long dual instructions | `*Pay now* (సిఫార్సు) లేదా UPI:\n{upi}\n₹{amt} · Note: {ref}\nUPI తర్వాత: PAID {ref}` | Same structure, fewer lines |
| P4 | Unpaid block | `You already have unpaid order…` | `ఇప్పటికే unpaid ఆర్డర్ {ref} ({₹}). ముందు చెల్లించండి లేదా *Cancel unpaid*.` | `Unpaid {ref} ({₹}). Pay first or Cancel unpaid.` |
| P5 | Cancel unpaid OK | `Done — order {ref} cancelled. No payment needed…` | `ఆర్డర్ {ref} రద్దు. చెల్లింపు అవసరం లేదు.` | `Cancelled {ref}. No payment due.` |
| P6 | QR caption | `Scan & pay ₹… · {ref}` | `స్కాన్ చేసి చెల్లించండి ₹… · {ref}` | Keep EN if shorter |

---

## 6. Status updates (high impact — already partly TE)

| ID | Status | Existing | Suggested TE (primary) | Suggested EN |
|----|--------|----------|------------------------|--------------|
| S1 | Label pending | Waiting for payment | చెల్లింపు కోసం వేచి | Waiting for payment |
| S2 | Label paid | Paid — kitchen will prepare | చెల్లింపు అయింది — కిచెన్ సిద్ధం | Paid — preparing soon |
| S3 | Label preparing | Being prepared | తయారవుతోంది | Being prepared |
| S4 | Label OFD | Out for delivery | డెలివరీలో ఉంది | Out for delivery |
| S5 | Label delivered | Delivered | డెలివర్ అయింది | Delivered |
| S6 | Label cancelled | Cancelled | రద్దు | Cancelled |
| S7 | Paid thanks | Long EN + one TE line + homemade speech + biz | `చెల్లింపు వచ్చింది ✅ {ref}\n{items}\nమొత్తం: {₹}\nధన్యవాదాలు! త్వరలో వస్తుంది.` | `Payment received ✅ {ref}\n…\nThank you! On the way soon.` |
| S8 | Preparing | EN + mixed TE | `ఆర్డర్ {ref} తయారవుతోంది 🍳\n{items}\nడెలివరీకి వెళ్లగానే తెలుస్తుంది.` | `Order {ref} preparing 🍳\n…` |
| S9 | Out for delivery | EN + TE ready line + track | `ఆర్డర్ {ref} డెలివరీలో 🛵\n{items}\n{track}\nదయచేసి సిద్ధంగా ఉండండి.` | `Order {ref} out for delivery 🛵\n…\nPlease be ready.` |
| S10 | Delivered | EN + TE + rate | `ఆర్డర్ {ref} డెలివర్ ✅\n{items}\nధన్యవాదాలు! రేట్ చేయండి.` | `Order {ref} delivered ✅\n…\nThanks! Please rate.` |
| S11 | Cancelled | Long refund EN | `ఆర్డర్ {ref} రద్దు.\nచెల్లిస్తే రీఫండ్ కిచెన్ చెక్ తర్వాత.\nసహాయం: *HELP* · కొత్త ఆర్డర్: *Lunch* / *Dinner*` | `Order {ref} cancelled.\nPaid? Refund after kitchen check.\nHELP · or Lunch/Dinner` |

---

## 7. Help / feedback / MORE

| ID | When | Existing | Suggested TE | Suggested EN |
|----|------|----------|--------------|--------------|
| H1 | HELP menu intro | Context + long topic list | Body TE: `సహాయం — కింది టాపిక్ ఎంచుకోండి` · **list row titles stay English** | `Help — pick a topic` |
| H2 | Topic detail ask | `Got it — {topic}. Please type a short message…` | `సరే — {topic}. కొద్ది మెసేజ్ రాయండి (ఆర్డర్ ID ఉంటే).` | `Got it — {topic}. Short message + order ID if any.` |
| H3 | Ticket ack | `Thanks — we received… Support contact: +…` | `అభ్యర్థన వచ్చింది (#{id}). సపోర్ట్: +{n}` | `Got it (#{id}). Support: +{n}` |
| H4 | Feedback thanks | `Thank you for your feedback! 🙏…` | `ఫీడ్‌బ్యాక్‌కి ధన్యవాదాలు! 🙏` | `Thanks for your feedback! 🙏` |
| H5 | No rating pending | `No delivered order waiting for a rating. Thank you!` | `రేట్ చేసే ఆర్డర్ లేదు. ధన్యవాదాలు!` | `Nothing to rate. Thank you!` |
| H6 | MORE menu | Rate / reorder / help / status list | Body can be TE; **list rows stay English** | Keep EN list rows |

---

## 8. Catalog / Flow / View menu

| ID | When | Existing | Suggested TE | Suggested EN |
|----|------|----------|--------------|--------------|
| F1 | View menu + catalog | `📱 Tap the catalog icon at the top…` | `📱 పైన catalog ఐకాన్ నొక్కండి. లేదా *Lunch* / *Dinner*.` | `📱 Tap catalog icon (top). Or Lunch / Dinner.` |
| F2 | After posters | `Full menu above 👆… Ready to order?` | `మెనూ పైన 👆 · ఆర్డర్‌కి *Lunch* / *Dinner*` | `Menu above 👆 · Lunch / Dinner to order` |
| F3 | Catalog meal pick | Long cart + lunch/dinner | `🛒 {cart}\n*Lunch* లేదా *Dinner* ఎంచుకోండి.` | `🛒 {cart}\nPick Lunch or Dinner.` |
| F4 | Catalog enquiry Flow | `{dish} — ₹…\nComplete qty + address in the form.` | `{dish} — ₹…\nఫారంలో qty + అడ్రస్ పూర్తి చేయండి. CTA: *Order this*` | `{dish} — ₹…\nFinish qty + address in form.` |
| F5 | Flow incomplete / empty | `Order form was incomplete…` | `ఫారం అసంపూర్ణం. *Lunch* / *Dinner* మళ్లీ.` | `Form incomplete. Tap Lunch / Dinner.` |
| F6 | Flow screen headings | Choose lunch or dinner / Category / Confirm order… | Instruction headings may be TE; **Continue / Place order footers stay English** | Or keep full Flow UI EN in v1 |
| F7 | Hours ice-breaker | Long hours + price range | Short TE wrap of C1 + `మెనూ: *View menu* · ఆర్డర్: *Lunch* / *Dinner*` | Short EN same |

---

## 9. Common errors (short TE)

| ID | Existing | Suggested TE | Suggested EN |
|----|----------|--------------|--------------|
| E1 | `I did not get that. You can continue ordering or start again.` | `అర్థం కాలేదు. కొనసాగించండి లేదా *Start over*.` | `Didn’t get that. Continue or Start over.` |
| E2 | `Order expired. Start again…` | `ఆర్డర్ ఎక్స్‌పైర్. *Lunch* / *Dinner*తో మళ్లీ.` | `Order expired. Start with Lunch / Dinner.` |
| E3 | `{name} is unavailable…` | `{name} ఇప్పుడు లేదు. కార్ట్ అప్‌డేట్ చేయండి.` | `{name} unavailable. Update cart.` |
| E4 | Unknown item | `ఐటమ్ దొరకలేదు. జాబితా నుంచి ఎంచుకోండి.` | `Unknown item. Pick from the list.` |

---

## 10. Message volume cuts (beyond translation)

| Change | Effect |
|--------|--------|
| Shorten `mealStatusText` to 3 lines on welcome | Biggest Hi shrink |
| Don’t repeat serve/cutoff in booking + Flow CTA + category header | Fewer duplicate lines |
| Community: Hi cool-off already 6h; keep append on paid/delivered **one short line** | Less spam |
| Payment: one pay instruction block (not Razorpay essay + UPI essay) | Cleaner checkout |
| After add-to-cart: prefer buttons over extra “how to” text | Less reading |
| Flow path: skip English “Choose from the menu” text when Flow CTA is next | One less bubble |

---

## 11. Approval checklist

**Locked:** §0 buttons / list titles / CTAs / action footers = **English only**.

Mark message-body sections:

- [ ] **1 Welcome / name / community**
- [ ] **2 Cutoffs / meal status (C1 short welcome is critical)**
- [ ] **3 Menu / cart** (bodies TE; list/button titles EN)
- [ ] **4 Address / pin**
- [ ] **5 Payment**
- [ ] **6 Status**
- [ ] **7 Help / feedback** (body TE; HELP list rows EN)
- [ ] **8 Catalog / Flow** (chat bodies TE; Flow Continue/Place order EN; optional TE headings later)
- [ ] **9 Errors**
- [ ] **10 Volume cuts**

**Default recommendation:**

> Telugu for instruction/explanation/status bodies; English for all buttons, lists, CTAs; shorten C1 meal status on Hi.

---

## 12. Next step

1. You review this doc and reply with approvals / edits (row IDs).
2. We implement in shared helpers first (`copy.js`, `cutoffs.js`, `status.js`), then `message.js`.
3. Smoke on admin + one customer number.
4. Deploy to VPS.

*Admin WhatsApp commands (`POSTER`, `ORDERS`, …) stay English — ops only.*
