# ACR AI Video Workflow — Amma Chethi Ruchulu ads

Adapted from the [Ai Film Maker's Workflow (Harry Ranveer / Videopreneur workshop)](https://docs.google.com/document/d/1kxkzcTYS55XdKC5j4LJrvk3Od87FTyMC4axeXuHzYJg/preview) for **short food / recruit ads**, not jewellery client films.

**Your stack (locked for ACR)**  
Images: Gemini / Google Flow · Video: Google Flow / Vids / Veo · VO: Google AI Studio (Telugu) · Edit: CapCut  

**Brand rules (never break)**  
- Brand: **Amma Chethi Ruchulu** · తెనాలి  
- Upload **ACR reference poster** when generating brand frames / end cards  
- Delivery packs = quality disposable boxes (not steel dabba romance)  
- No minors/kids in story  
- No “20-minute delivery” claims  
- **Ad A (recruit)** CTA = show **+91 88861 28995** + keyword **AMMA** (always display this number on Amma ads)  
- **Ad B (customer monthly)** CTA = always show **+91 98235 83498** (regular order number) · never Amma `8886128995`  
- Never mix recruit + order CTAs in one film  

---

## Overview (workshop → ACR)

| Workshop step | ACR version |
|---------------|-------------|
| Client research | Skip — you are the brand |
| Million short-film concept | 5 questions → 20–30s ad concept + Telugu VO |
| Story → scenes → JSON | Scenes table + JSON prompts for Flow/Veo |
| Frames (Gemini storyboard) | One JSON → one still, character/food consistent |
| Frames → video | Animate image / Veo / Flow |
| Music + VO | Prefer **Telugu VO in AI Studio** first; soft bed later in CapCut |
| Edit | CapCut J/L cuts, captions, end card + QR |

**Do one ad at a time.** Finish Ad A before Ad B.

---

# PHASE 1 — Concept

## Step 1 — Creative brief prompt (paste into Cursor / ChatGPT)

```text
Assume you are a world-class creative director and visual storyteller, excellent at AI video prompting.

Help me craft a 20–30 second Brand Video for Amma Chethi Ruchulu (Tenali).

Rules:
- VoiceOver required: goosebumps-level NARRATION in TELUGU (I will generate audio in Google AI Studio).
- Visuals: NO dialogue between people talking. Food / hands / kitchen / packs / neighbourhood only.
- No minors or kids.
- Style: hyper-realistic Indian home kitchen documentary + soft cinematic, not cartoon, not neon SaaS.
- Upload reference: I will attach ACR poster for brand frames.
- Ask me ONLY the top 5 questions (with copy-paste options each). Then give Concept + Telugu VO + English gloss + scene list.

Ad type for this run: [AD_A_RECRUIT or AD_B_MONTHLY]
```

### Your answers for Ad A (Recruit) — copy when asked

1. **Brand:** Amma Chethi Ruchulu  
2. **Goal:** Recruit specialist home cooks (veg + non-veg curries + excellent chapathis)  
3. **VO language:** Telugu, warm woman, clear, proud not salesy  
4. **Style:** Hyper-realistic home kitchen · ACR cream/forest-green brand frames from attached poster  
5. **CTA:** WhatsApp **+91 88861 28995** · message **AMMA** · prefer cooks near **Amaravathi Flats, Tenali** (number must appear on poster/end card)  
6. **Avoid:** salary guarantees, kids, food-order phone 9823583498 on recruit CTA  

### Your answers for Ad B (Monthly pack) — copy when asked

1. **Brand:** Amma Chethi Ruchulu  
2. **Goal:** Sell monthly one-time payment home-delivery package  
3. **VO:** Telugu, warm, clear, convenient + trust  
4. **Style:** Hyper-realistic meal + sealed pack delivery + ACR poster end card (attach reference)  
5. **CTA:** WhatsApp **9823583498** must appear · prefill link “Monthly Package” · prices ₹4499 / ₹7600 · one meal per day  
6. **Avoid:** recruit number 8886128995, old prices ₹5500/₹5499, fake instant delivery  

---

## Step 2 — Story → scenes → JSON (paste after concept is locked)

```text
Assume you are a world-class creative director, visual storyteller & prompt writer for Google Veo / Flow / Gemini.

Study the ACR ad script we locked above.
1) List how many scenes (max 5–6 for a 25s Reel).
2) For each scene give a JSON prompt for video generation.
3) Keep character DNA, food look, colour grade, lens language CONSISTENT inside EVERY JSON (no separate master prompt).
4) 9:16 vertical. No on-screen dialogue. No kids.
5) Brand frames: instruct “use attached ACR reference poster for logo/colors/footer”.
6) Ask only TOP 3 clarifying questions if needed; else output a table: Scene | Seconds | Visual | JSON | On-screen Telugu.
7) End with full Telugu VoiceOver + English gloss.
```

### JSON shape (use inside each scene)

```json
{
  "scene_id": "A1",
  "duration_sec": 4,
  "aspect": "9:16",
  "style": "hyperrealistic Indian home kitchen documentary, soft natural window light, shallow DOF, filmic grain subtle, ACR warm cream-green grade",
  "camera": "35mm equivalent, slow push-in, steady",
  "subject": "...",
  "action": "...",
  "environment": "Tenali-generic middle-class Indian home kitchen / doorway — no tourist landmarks",
  "audio_in_generator": "silent or soft ambient only — NO music, NO speech, NO dialogue",
  "must_avoid": ["kids", "neon", "blurry text", "wrong logo", "cartoon", "20-minute delivery claim"],
  "brand_note": "If end card / poster chrome: match attached ACR reference poster exactly",
  "consistency_dna": "same Amma hands age ~40s bangles, same steel tawa, same warm daylight grade across all scenes"
}
```

---

# PHASE 2 — Frames & motion

## Step 3 — Frame factory prompt (Gemini / ChatGPT image)

```text
Assume you are a world-class visual storyteller who designs prompts for Gemini image models.

I will paste ONE scene JSON at a time. Convert it into the BEST still-image prompt for a storyboard frame.
Every frame must keep:
- Consistent character/product DNA from prior frames
- Consistent cinematic camera metadata (lens, lighting, depth, grain)
- Hyper-realistic, NOT AI-slop plastic food
- No text in food frames (text only when I say BRAND CARD and I attach ACR reference poster)

When ready, ask me for Scene 1 JSON only.
```

**Workflow:** JSON → still → download → next JSON → repeat.

## Step 4 — Still → video

Options (pick one per project):

1. **Google Vids / Flow — Animate image** — upload frame + paste same scene JSON (action lines)  
2. **Veo / Gemini video** — paste JSON as text-to-video if no image input  
3. Prefer **silent / no dialogue** bake-in; you add Telugu VO later  

Repeat for each scene → drop clips on CapCut timeline.

## Step 5 — Telugu VoiceOver (preferred for ACR)

**Do this before or parallel to edit.**

1. Open Google AI Studio (or Gemini speech)  
2. Paste Telugu VO from sample below  
3. Style: `Telugu female, warm, clear, natural, medium pace, no music`  
4. Download WAV/MP3  

Optional soft music bed in CapCut (−18 to −22 dB under VO). Workshop Lyria “VO+music in one” is optional; Telugu quality is better when VO is separate.

## Step 6 — CapCut edit

1. Align clips to VO beats (J-cut / L-cut)  
2. Burn Telugu captions  
3. End card 2–3s: logo + CTA + QR  
4. Export 9:16 H.264  

**Ad A end:** WhatsApp **+91 88861 28995** · AMMA  
**Ad B end:** WhatsApp **+91 98235 83498** · Order now

---

# PHASE 3 — Optional upgrades (from workshop homework)

- **Character consistency:** screenshot best Amma-hands frame → reuse as reference in later Gemini gens  
- **Brand outro KV:** take ACR logo/title from reference poster → animate 4–6s end sting with a short JSON  
- Keep fair-use: this doc is your **internal ACR adaptation**, not a resale of the workshop PDF  

---

# SAMPLE AD A — Specialist Amma recruit (curries + chapathi)

## Brief (updated)

| Item | Value |
|------|--------|
| Who | Specialist home cook (she/he) |
| Skills | **Veg curries + non-veg curries** + **best-quality chapathis** |
| Prefer | People near **Amaravathi Flats, Tenali** |
| CTA | WhatsApp **+91 88861 28995** · **AMMA** |
| Length | ~25s |

### Telugu tag lines (use on poster / captions)

| EN | TE |
|----|----|
| We need specialist cooks for veg & non-veg curries | వెజ్ & నాన్-వెజ్ కూరలు వండే నిపుణులు కావాలి |
| If you make chapathis the best way | చపాతీలు బెస్ట్‌గా చేస్తే… |
| People near Amaravathi Flats, Tenali preferred | అమరావతి ఫ్లాట్స్, తెనాలి సమీపంలో ఉన్నవారికి ప్రాధాన్యత |
| Contact number | WhatsApp: **+91 88861 28995** |
| Message keyword | AMMA అని మెసేజ్ చేయండి |

---

## Ad A — Concept (ready)

**Title:** చేతిలో నైపుణ్యం ఉందా?  
**Arc:** Skill (curry steam + chapathi puff) → dignity → we bring orders → location preference → AMMA CTA.  
**Tone:** Respect, local, specialist — not “side hustle bro.”

---

## Ad A — Telugu VO (AI Studio)

```text
వెజ్ కూరలు, నాన్-వెజ్ కూరలు, ఇంకా సాఫ్ట్ చపాతీలు —
మీ చేతిలో నిజమైన నైపుణ్యం ఉందా?

అమ్మ చేతి రుచులు కి స్పెషలిస్ట్ అమ్మలు / ఇంటి వంట నిపుణులు కావాలి.
మీరు వండండి — ఆర్డర్లు మేము తెస్తాము.
కలెక్ట్, ప్యాక్, డెలివరీ మేమే.

అమరావతి ఫ్లాట్స్, తెనాలి సమీపంలో ఉన్నవారికి ప్రాధాన్యత.
WhatsApp నంబర్ +91 88861 28995 కి AMMA అని మెసేజ్ చేయండి.
అమ్మ చేతి రుచులు.
```

**English gloss:** We need specialists for veg & non-veg curries and excellent chapathis. You cook; we bring orders, collect, pack, deliver. Preference for people near Amaravathi Flats, Tenali. WhatsApp AMMA.

---

## Ad A — Scenes + JSON samples

### Scene A1 (0–4s) — Curry steam hook

```json
{
  "scene_id": "A1",
  "duration_sec": 4,
  "aspect": "9:16",
  "style": "hyperrealistic Indian home kitchen documentary, soft window light, shallow DOF, warm cream-green ACR grade, subtle film grain",
  "camera": "35mm, slow push-in on steam",
  "subject": "kadhai of vibrant Andhra-style curry (veg or chicken), glossy oil bloom, ladle lift",
  "action": "gentle simmer steam rising, ladle lifts sauce slowly",
  "environment": "middle-class Tenali home kitchen counter, clean, dignified",
  "audio_in_generator": "soft simmer ambient only — NO music NO speech",
  "must_avoid": ["kids", "neon", "on-screen text", "cartoon", "plastic CGI food"],
  "consistency_dna": "warm daylight, steel cookware, honest edible food textures throughout film"
}
```

### Scene A2 (4–9s) — Best chapathi

```json
{
  "scene_id": "A2",
  "duration_sec": 5,
  "aspect": "9:16",
  "style": "hyperrealistic Indian home kitchen documentary, soft window light, shallow DOF, warm cream-green ACR grade, subtle film grain",
  "camera": "50mm close-up, locked then micro push",
  "subject": "skilled adult home-cook hands with bangles flipping a perfectly puffed soft chapathi on tawa; stack of even round chapathis beside",
  "action": "chapathi puffs; hand places it on stack",
  "environment": "same kitchen DNA as A1",
  "audio_in_generator": "soft tawa ambient — NO music NO speech",
  "must_avoid": ["kids", "extra fingers", "celebrity face", "on-screen text", "neon"],
  "consistency_dna": "same hands age band, same daylight, same kitchen tiles/counter as A1"
}
```

### Scene A3 (9–14s) — Non-veg + veg specialty beat

```json
{
  "scene_id": "A3",
  "duration_sec": 5,
  "aspect": "9:16",
  "style": "hyperrealistic split-energy single shot or smooth pan, ACR warm grade",
  "camera": "slow lateral pan 35mm",
  "subject": "left: veg curry in steel bowl; right: non-veg Andhra curry in steel bowl; chapathi piece dipping optional",
  "action": "slow pan revealing both specialties as specialist range",
  "environment": "same home kitchen DNA",
  "audio_in_generator": "silent or soft ambient — NO speech NO music",
  "must_avoid": ["kids", "text", "neon", "gore", "cartoon"],
  "consistency_dna": "same bowls/light as prior scenes"
}
```

### Scene A4 (14–20s) — We collect / you stay cook

```json
{
  "scene_id": "A4",
  "duration_sec": 6,
  "aspect": "9:16",
  "style": "hyperrealistic documentary, soft daylight, ACR warm grade",
  "camera": "medium shot, gentle handheld stabilized",
  "subject": "home doorway: cook hands over insulated bag; pickup arms only (no brand uniform logos); sealed quality disposable packs visible",
  "action": "calm handoff, bag leaves frame",
  "environment": "Tenali residential doorway near apartments feel (generic, not labelled building)",
  "audio_in_generator": "quiet outdoor ambient — NO speech NO music",
  "must_avoid": ["Swiggy Zomato logos", "kids", "text", "neon", "chaos traffic"],
  "consistency_dna": "same time-of-day warmth; packs look clean and sturdy"
}
```

### Scene A5 (20–26s) — Brand CTA card

**Still/poster first (upload ACR reference):**

```text
Use the attached ACR reference poster as the exact style guide — cream background, forest green, logo, leaves, footer craft.

Recruit end card, sharp Telugu + large phone:

స్పెషలిస్ట్ అమ్మలు కావాలి
వెజ్ · నాన్-వెజ్ కూరలు · బెస్ట్ చపాతీలు
అమరావతి ఫ్లాట్స్, తెనాలి సమీపం — ప్రాధాన్యత
WhatsApp: +91 88861 28995
AMMA అని మెసేజ్ చేయండి
అమ్మ చేతి రుచులు

QR to wa.me/918886128995 OK. MUST show +91 88861 28995. Never use 9823583498. No salary guarantee.
```

**Then animate JSON:**

```json
{
  "scene_id": "A5",
  "duration_sec": 6,
  "aspect": "9:16",
  "style": "animated brand poster card matching attached ACR reference, subtle parallax, elegant not flashy",
  "camera": "slow push on CTA band",
  "subject": "ACR recruit end card with Telugu hierarchy as designed",
  "action": "gentle scale-in, soft leaf motion optional",
  "audio_in_generator": "NO speech NO music (VO layered in edit)",
  "must_avoid": ["blurry Telugu", "wrong logo", "neon", "menu price clutter"],
  "brand_note": "must match attached reference poster DNA",
  "consistency_dna": "same logo and green/cream as brand reference"
}
```

---

## Ad A — Poster prompt (main)

```text
Use the attached reference poster as the exact style guide — match ACR layout language, cream/parchment, forest green, logo, leaves, footer.

RECRUIT poster — specialist home cooks.

Hero: chapathi stack + curry bowls (veg + non-veg) in one composed frame; skilled hands optional.

ON-POSTER TELUGU (sharp, correct):

స్పెషలిస్ట్ వంట నిపుణులు కావాలి
వెజ్ & నాన్-వెజ్ కూరలు · బెస్ట్ చపాతీలు

అమ్మ చేతి రుచులు తో కలిసి వండండి

అమరావతి ఫ్లాట్స్, తెనాలి సమీపంలో ఉన్నవారికి ప్రాధాన్యత

• మీరు వండండి — ఆర్డర్లు మేము
• కలెక్ట్ · ప్యాక్ · డెలివరీ మేమే

CTA (large):
WhatsApp: +91 88861 28995
AMMA అని మెసేజ్ చేయండి

No salary guarantees. MUST show +91 88861 28995. Never use customer order number 9823583498.
```

**NEGATIVE:** `blurry Telugu, neon, wrong logo, kids, salary guarantee, cartoon, garbage characters`

---

# SAMPLE AD B — Monthly package home delivery

## Brief

| Item | Value |
|------|--------|
| Offer | Monthly package · one-time pay · home delivery |
| Price | **₹4499** (1 person, 1 meal/day) · **₹7600** (2 persons, 1 meal/day) |
| CTA | WhatsApp **9823583498** · link text **Monthly Package** |
| Length | ~25–30s |

---

## Ad B — Telugu VO (AI Studio)

```text
ప్రతిరోజు ఏం వండాలి అని ఆలోచనా?
అమ్మ చేతి రుచులు నెలవారీ ప్యాకేజ్ —
ఒక్కసారి చెల్లింపు. ఇంటికే డెలివరీ. తెనాలి.

అమ్మ చేతి రుచి. నిజమైన ఇంటి వంట.
ధర — ఒకరు నెలకు ₹4499. ఇద్దరు నెలకు ₹7600. రోజుకు ఒక భోజనం.

ఇప్పుడే WhatsApp నంబర్ +91 98235 83498 కి Monthly Package అని మెసేజ్ చేయండి.
అమ్మ చేతి రుచులు.
```

---

## Ad B — Scenes + JSON samples

### Scene B1 — Meal desire

```json
{
  "scene_id": "B1",
  "duration_sec": 5,
  "aspect": "9:16",
  "style": "hyperrealistic Andhra home meal, soft daylight, ACR warm grade, shallow DOF",
  "camera": "slow push-in 35mm",
  "subject": "home-style thali / curry + rice + chapathi, gentle steam",
  "action": "steam rises; appetite hold",
  "environment": "home dining table Tenali-neutral",
  "audio_in_generator": "NO music NO speech",
  "must_avoid": ["kids", "text", "neon", "plastic food"],
  "consistency_dna": "warm daylight edible food look for whole film"
}
```

### Scene B2 — Door delivery pack

```json
{
  "scene_id": "B2",
  "duration_sec": 5,
  "aspect": "9:16",
  "style": "hyperrealistic, trustworthy hygiene, soft daylight",
  "camera": "medium shot",
  "subject": "good-quality sealed disposable meal packs handed / placed at Indian home doorway",
  "action": "packs set down calmly",
  "environment": "residential doorway",
  "audio_in_generator": "quiet ambient — NO speech NO music",
  "must_avoid": ["text", "brand courier logos", "flimsy trash bags", "kids", "20-min delivery graphics"],
  "consistency_dna": "same daylight warmth as B1"
}
```

### Scene B3 — Price poster card

```text
Use attached ACR + monthly package reference posters as style guide.
Video mid-card:

నెలవారీ లంచ్ ప్యాక్
1) ₹4499/- · one meal/day · One Person · Veg weekdays + Non-veg weekly once if non-veg
2) ₹7600/- · one meal/day · Two Persons · Veg
వేర్వేరు వంట పాత్రల్లో
Contact: 9823583498
తెనాలి · అమ్మ చేతి రుచులు

Huge readable prices. Sharp Telugu. Never ₹5500 or ₹5499. Never 8886128995. Match brand reference.
```

```json
{
  "scene_id": "B3",
  "duration_sec": 6,
  "aspect": "9:16",
  "style": "brand poster card animation matching attached ACR reference",
  "camera": "slow push on price",
  "subject": "monthly package price card",
  "action": "subtle parallax",
  "audio_in_generator": "NO speech NO music",
  "must_avoid": ["blurry Telugu", "neon", "recruit AMMA CTA"],
  "brand_note": "match attached reference poster DNA",
  "consistency_dna": "same logo cream green as brand"
}
```

### Scene B4 — CTA end

```text
Use attached ACR reference poster.

ఇప్పుడే ఆర్డర్ చేయండి
WhatsApp: +91 98235 83498
అమ్మ చేతి రుచులు · తెనాలి

QR to https://wa.me/919823583498?text=Monthly%20Package OK. MUST show Contact 9823583498. Customer CTA only — never 8886128995.
```

```json
{
  "scene_id": "B4",
  "duration_sec": 6,
  "aspect": "9:16",
  "style": "end card matching ACR reference, elegant slow push",
  "camera": "slow push",
  "subject": "order CTA end card",
  "action": "scale-in",
  "audio_in_generator": "NO speech NO music",
  "must_avoid": ["blurry Telugu", "recruit AMMA as main CTA", "neon"],
  "brand_note": "attached reference poster",
  "consistency_dna": "same brand chrome as B3"
}
```

---

# One-sitting checklist

### Ad A
- [ ] Concept locked (skills + Amaravathi Flats preference)  
- [ ] Telugu VO recorded  
- [ ] A1–A4 clips generated silent  
- [ ] A5 poster from **attached reference**  
- [ ] CapCut + captions + QR (AMMA)  
- [ ] Caption uses recruit link / bio  

### Ad B
- [ ] Prices locked ₹4499 / ₹7600 · Contact 9823583498 · no 8886128995  
- [ ] Telugu VO recorded  
- [ ] B1–B2 motion + B3–B4 reference posters  
- [ ] CapCut + Monthly Package wa.me link  
- [ ] Caption includes Monthly Package URL  

---

# Related files

- `09-CHAPATHI-AMMA-AND-MONTHLY-PACK.md` — longer poster/VO packs (keep in sync with Ad A brief above)  
- `01-BUSINESS-MODEL.md` — claims + WhatsApp numbers  
- Workshop source (educational inspiration): [Ai Film Maker's Workflow](https://docs.google.com/document/d/1kxkzcTYS55XdKC5j4LJrvk3Od87FTyMC4axeXuHzYJg/preview)  

**Start now:** generate **Ad A Scene A1** JSON in Flow/Gemini (silent), then A2 — one scene at a time.  
