# Meta Ads — ACR Tenali lunch & dinner (3 ad sets)

**Brand:** Amma Chethi Ruchulu (ACR)  
**Order:** WhatsApp **+91 98235 83498** · send **Hi**  
**Geo:** Tenali + **6 km** radius (kitchen: Chenchupeta)  
**Cutoffs:** Lunch order by **11 AM** · Dinner by **5 PM** IST  
**Hooks:** Veg meal **₹100** · Non-veg meal **₹130** · Tenali delivery  

Use this doc when creating campaigns in [Meta Ads Manager](https://adsmanager.facebook.com).

---

## Part A — Enable these BEFORE you run ads

### 1. Meta Business Manager (business.facebook.com)

| Step | Where | Action |
|------|--------|--------|
| Business Portfolio | Business settings → Accounts | Create or use existing Business Manager |
| Facebook Page | Accounts → Pages | Add **Amma Chethi Ruchulu** Page (you must be Admin) |
| Instagram | Accounts → Instagram accounts | Connect **professional** IG account to the same Page |
| Ad account | Accounts → Ad accounts | Create ad account · add **payment method** (INR) |
| WhatsApp | Accounts → WhatsApp accounts | Link **WhatsApp Business** number **9823583498** to the Business Portfolio |
| People | Users | Add anyone who will run ads as **Employee** (ads) or **Admin** |

**Two-factor authentication (2FA)** on all admin Facebook accounts — required for some ad features.

---

### 2. Facebook Page settings (Page → Settings)

Enable so **Click to WhatsApp** and **Messages** ads work:

| Setting | Path | Set to |
|---------|------|--------|
| Messaging | Page settings → General → **Messages** | **ON** — “Allow people to contact my Page privately” |
| WhatsApp button | Page → **About** → Contact | Add WhatsApp **9823583498** |
| Page visibility | Page settings | Page **published** (not unpublished) |
| Country restrictions | Page settings | None (or India only if you use restrictions) |
| Page roles | Page settings → Page access | Your ad manager = Admin or Advertiser |

**Optional but useful:** Page → **Action button** → **Send WhatsApp Message** (links to your number).

---

### 3. Instagram account settings

| Setting | Where (Instagram app or Meta Business Suite) | Action |
|---------|-----------------------------------------------|--------|
| Professional account | IG → Settings → Account type | **Business** or **Creator** (not personal) |
| Linked to Facebook Page | Meta Business Suite → Settings → Linked accounts | Same Page as ads |
| Message controls | IG → Settings → Messages | **Allow message requests** / don’t block business DMs |
| Contact options | IG → Edit profile → Contact | WhatsApp or “Order food” link → `https://wa.me/919823583498?text=Hi` |
| Branded content (if influencers later) | IG professional dashboard | Enable when needed |

For **Instagram Click to WhatsApp ads:** In Ads Manager, creative must use a Page with WhatsApp linked (Part A.1).

---

### 4. WhatsApp Business (on phone 9823583498)

| Item | Action |
|------|--------|
| WhatsApp Business app | Installed · business profile filled (address Chenchupeta, hours, category **Restaurant**) |
| Cloud API / bot | Already on `order.ammachethiruchulu.co.in` — keep **same display number** as ads |
| Greeting / away | Short auto-reply OK; bot handles **Hi** |
| Meta link | Business Manager → WhatsApp → verify number shows **Connected** |

---

### 5. Ads Manager account-level settings

| Setting | Where | Recommendation |
|---------|--------|----------------|
| **Special Ad Categories** | Campaign level | **None** (food delivery is not Housing/Credit/Employment/Politics) |
| **Ad account time zone** | Ad account settings | **Asia/Kolkata** |
| **Currency** | Ad account | **INR** |
| **Customer list / Custom audiences** | Audiences → Create | Accept **Custom Audience terms** when prompted (for future retargeting) |
| **Meta Pixel** (optional) | Events Manager | Install on `ammachethiruchulu.co.in` later for website retargeting — not required for WhatsApp-only start |
| **Aggregated Event Measurement** | Events Manager | Only if you add Pixel |

---

### 6. Targeting-specific toggles (per ad set)

| Toggle | Recommendation for ACR |
|--------|-------------------------|
| **Advantage+ audience** (formerly detailed targeting expansion) | **OFF** for first 2 weeks — you want Tenali + job titles, not Meta broadening to all AP |
| **Advantage+ placements** | **OFF** initially — use Feed + Reels only |
| **Advantage campaign budget (CBO)** | Optional — OK if budget ≥ ₹300/day total |
| **Location: People living in vs recently in** | Start **People living in** this location · add **People recently in** if lunch traffic from commuters |
| **Languages** | **Telugu** and **English** (Ad set → Languages) |

---

### 7. What you do NOT need for launch

- Shop / Commerce catalog (unless selling physical goods on FB Shop)  
- Special Ad Category “Employment” (unless hiring ads)  
- iOS 14+ custom conversions (unless Pixel-heavy)  

---

## Part B — Campaign shell (one campaign, three ad sets)

Create **one Campaign**, then **three Ad sets** below.

| Field | Value |
|-------|--------|
| **Campaign name** | `ACR_Tenali_LunchDinner_WhatsApp_2026` |
| **Objective** | **Engagement** → **Messaging apps** → **WhatsApp**  
| (Alternative) | **Sales** → **Messaging conversations** → WhatsApp — if shown in your account |
| **Buying type** | Auction |
| **Special Ad Categories** | None |
| **Campaign budget** | Optional CBO **₹300–500/day** OR set budget per ad set below |
| **Bid strategy** | Highest volume (or Cost per result goal after 50+ conversations/week) |

**Conversion location:** WhatsApp · **Phone number:** +91 98235 83498  

---

## Ad set 1 — Office lunch

**Name:** `AS1_Office_Lunch_Tenali_6km`

### Schedule & budget
- **Budget:** ₹120–180 / day (or 40% of campaign budget)  
- **Daypart:** **Mon–Sat 8:00 AM – 10:30 AM** IST only  
- **Days:** Mon–Sat (pause Sunday or run “party packs only” creative separately)

### Location
- **Type:** Pin on **Tenali** (Chenchupeta / kitchen)  
- **Radius:** **6 km**  
- **Include:** Tenali, surrounding wards you deliver to  
- **Exclude:** None initially  

### Audience
| Field | Value |
|-------|--------|
| **Age** | 22 – 55 |
| **Gender** | All |
| **Languages** | Telugu, English |
| **Detailed targeting — Interests** (ANY of): | Food delivery · Online food ordering · Swiggy · Zomato · Home cooked food · Meal delivery · Tiffin service · South Indian cuisine · Andhra Pradesh |
| **Demographics → Work → Job titles** (add 20+): | Teacher · Professor · Lecturer · Software engineer · IT professional · Bank employee · Accountant · Nurse · Doctor · Pharmacist · Receptionist · Clerk · Government employee · Sales manager · Office manager · Business owner · Shop owner · Self-employed · Call center · HR manager · Administrative assistant |

**Advantage+ audience:** OFF  

### Placements
- Facebook Feed  
- Instagram Feed  
- Instagram Reels  
- **Off:** Audience Network, Messenger (until baseline works)

### Ad copy (primary text) — pick one

**English:**
```
Homely office lunch from Amma’s kitchen — Tenali delivery 🍛

Veg meal ₹100 · Non-veg ₹130
Order on WhatsApp by 11 AM (lunch)

1. Save 9823583498
2. Send Hi → Lunch → pick items → pay

No app. Track order on chat.
```

**Telugu + English:**
```
టెనాలి homely lunch — Amma Chethi Ruchulu 🍛

Veg meal ₹100 · order by 11 AM
WhatsApp: 9823583498 · Hi పంపండి → Lunch → items → pay
```

### Headlines (≤40 chars)
- `Office lunch Tenali ₹100`  
- `Homely lunch · WhatsApp order`  
- `Order lunch by 11 AM`

### CTA button
**Send WhatsApp message** (or **Send message** → WhatsApp)

### Creative
- **Poster 6** (order steps) or **Poster 4** (meals ₹100/₹130)  
- Square 1080×1080 or vertical 4:5 / 9:16 for Reels  

---

## Ad set 2 — Teachers, parents & lunch box

**Name:** `AS2_Tiffin_TeachersParents_Tenali_6km`

### Schedule & budget
- **Budget:** ₹100–150 / day  
- **Daypart:** **Mon–Sat 7:30 AM – 10:00 AM** IST  
- **Focus:** School/office staff + parents who need tiffin

### Location
- Same as Ad set 1: **Tenali · 6 km**  
- **Optional second ad set later:** duplicate with **4 km** only around college/school belt after you map pins on Google Maps  

### Audience
| Field | Value |
|-------|--------|
| **Age** | 26 – 50 |
| **Languages** | Telugu, English |
| **Interests** (ANY): | Parenting · Family · School · Education · Home cooked food · Tiffin service · Food delivery · Telugu cuisine |
| **Job titles:** | Teacher · Principal · School administrator · Professor · Lecturer · Teaching assistant · School counselor · Daycare · Tuition · College staff |
| **Behaviors** (if available): | Parents · Engaged shoppers |

**Advantage+ audience:** OFF  

### Placements
Same as Ad set 1.

### Ad copy

```
Daily lunch box / tiffin — homely Amma kitchen 🍱

Perfect for teachers, staff & working parents near Tenali.
Veg meal ₹100 · share location pin for delivery fee

WhatsApp 9823583498 → Hi → Lunch → add items → checkout
Order by 11 AM
```

### Headlines
- `Lunch box Tenali · ₹100 veg`  
- `Teachers & staff — order lunch`  
- `Homely tiffin · WhatsApp`

### Creative
- Meals poster · or short Reel: “how to order in 30 sec” using Poster 6 steps  

---

## Ad set 3 — Family dinner

**Name:** `AS3_Family_Dinner_Tenali_6km`

### Schedule & budget
- **Budget:** ₹100–150 / day  
- **Daypart:** **Mon–Sat 3:00 PM – 5:30 PM** IST (before 5 PM dinner cutoff)  
- **Sunday:** use **party packs** creative only if running Sunday ads  

### Location
- **Tenali · 6 km** (same pin)

### Audience
| Field | Value |
|-------|--------|
| **Age** | 25 – 55 |
| **Languages** | Telugu, English |
| **Interests** (ANY): | Home cooking · Dinner · Family · Meal delivery · Food delivery · Andhra Pradesh · Non-vegetarian food · Biryani · Cooking (home) |
| **Job titles** (optional layer, ANY): | Homemaker · Business owner · Manager · Nurse · Doctor · IT professional |

**Exclude (optional after 2 weeks):** people who already messaged (Custom audience from WhatsApp engagers — when available).

**Advantage+ audience:** OFF  

### Placements
Same as Ad set 1 + **Instagram Reels** strongly recommended for dinner scroll time.

### Ad copy

```
No cooking tonight? Homely dinner from Amma Chethi Ruchulu 🌙

Non-veg meal ₹130 · curries · family portions
Order on WhatsApp by 5 PM · Tenali delivery

9823583498 → Hi → Dinner → pick items → share location → pay
```

### Headlines
- `Dinner Tenali · order by 5 PM`  
- `Homely dinner · ₹130 non-veg`  
- `WhatsApp dinner delivery`

### Creative
- Non-veg everyday poster · or dinner Reels with steam/curry clip + Poster 6 footer  

---

## Part C — Ad-level checklist (repeat for each ad)

| Field | Value |
|-------|--------|
| **Identity** | ACR Facebook Page + linked Instagram |
| **WhatsApp** | +91 98235 83498 |
| **Welcome message** (optional) | “Send **Hi** to see today’s lunch/dinner menu” |
| **Tracking** | Use Meta’s messaging metrics (Conversations started) |
| **UTM** (optional on website link ads) | `utm_source=meta&utm_medium=paid&utm_campaign=acr_lunch` |

---

## Part D — After 7–14 days: optimize

1. **Pause** ad sets with cost per WhatsApp conversation **> 2×** the winner.  
2. **Duplicate** winner · narrow radius to **4 km** test.  
3. **Custom audience:** Page engagers, IG engagers, video viewers 50%+ → retargeting ad set.  
4. **Customer list:** upload hashed phone numbers from orders → **Lookalike 1–3%** in Tenali district (accept Custom Audience terms first).  
5. Turn **Advantage+ audience ON** only on best ad set as a test — compare cost per chat.

---

## Part E — Quick copy-paste: job titles bundle

Paste into Ad set 1 or 2 → Demographics → Work → Job titles:

```
Teacher, Professor, Lecturer, Principal, School administrator, Software engineer, IT professional, Bank employee, Accountant, Nurse, Doctor, Pharmacist, Receptionist, Clerk, Government employee, Sales manager, Office manager, Business owner, Shop owner, Self-employed, Administrative assistant, HR manager, Call center agent, Teaching assistant, College staff
```

---

## Part F — Interests bundle (office + food)

```
Food delivery, Online food ordering, Swiggy, Zomato, Home cooked food, Meal delivery, Tiffin service, South Indian cuisine, Andhra Pradesh, Telugu cuisine
```

---

## Summary

| Ad set | Who | When to run | Main hook |
|--------|-----|-------------|-----------|
| **AS1 Office lunch** | Job titles + delivery apps | 8–10:30 AM | ₹100 veg · order by 11 AM |
| **AS2 Tiffin / teachers** | Teachers + parents + tiffin | 7:30–10 AM | Lunch box · homely |
| **AS3 Family dinner** | Family + home food | 3–5:30 PM | ₹130 dinner · order by 5 PM |

**Page/IG must-haves:** Business Manager · Page messaging ON · IG Business linked · WhatsApp 9823583498 linked · Ad account + payment · Advantage+ audience OFF at start.
