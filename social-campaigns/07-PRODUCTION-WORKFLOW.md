# Production workflow — one poster / one video at a time

## Why one at a time

Batching 20 AI assets in an hour creates style drift, bad hands, and mixed CTAs. Lock quality on **Post N** before **Post N+1**.

---

## Session checklist — POSTER

1. Open `03-` or `04-` → pick post ID (e.g. **C01**).  
2. Open `05-IMAGE-PROMPTS.md` → copy that block.  
3. Generate in **Google image** or **OpenAI image** at high quality.  
4. Pick **one** winner; download raw.  
5. Canva (or similar):
   - Add brand, headline, CTA (see prompt file)  
   - Export **1:1**, **4:5**, **9:16** cover variant if needed  
6. Save:
   ```text
   social-campaigns/assets/customers/C01_poster_1x1.png
   social-campaigns/assets/customers/C01_poster_4x5.png
   ```
7. Draft/publish caption from `08-CAPTIONS-HASHTAGS.md`.  
8. Mark sheet: `C01 poster ✅ date`.  
9. **Stop** or only then start this post’s **video**.

---

## Session checklist — VIDEO

1. Confirm post ID + type from campaign board (`IMG+VO` / `V-silent+VO` / `V-audio+VO`).  
2. `06-VIDEO-PROMPTS.md` → generate base (or stills).  
3. If video tool baked unwanted music/speech → mute/remove track.  
4. CapCut / NLE:
   - Import base  
   - Record VO from script  
   - Music optional (library; avoid copyright traps)  
   - Lower third brand once in first 2s  
   - Captions burned in for IG/FB silent autoplay  
   - End card 2–3s: logo + CTA + WA  
5. Export 9:16 H.264, ≤30s preferred for Shorts/Reels.  
6. Save:
   ```text
   .../C01_reel_9x16_base.mp4
   .../C01_reel_9x16_FINAL.mp4
   ```
7. Upload:
   - IG Reels  
   - FB Reels  
   - YT Shorts (same file)  
8. Mark sheet: `C01 video ✅`.  
9. **Next post only after you’re happy.**

---

## Recommended order (first production week)

| Day | Asset |
|-----|--------|
| 1 | C01 poster → C01 video |
| 2 | C02 poster → C02 video |
| 3 | H01 poster → H01 video |
| 4 | C03 poster → C03 video |
| 5 | H02 poster → H02 video |
| … | Continue alternating or customer-first |

Ship **C01–C03** and **H01–H02** before polishing later posts — test what gets WA clicks.

---

## Tool mapping

| Task | Tool |
|------|------|
| Poster image | Google Imagen / Gemini image, OpenAI image |
| Video base | Google Veo / Flow / Gemini video |
| Stills for IMG+VO | Same image tools |
| Type/overlays | Canva |
| VO + edit + captions | CapCut / DaVinci / Premiere |
| QR for WA | Own generator → place in Canva |

---

## Brand guardrails (every export)

- [ ] One CTA only  
- [ ] No 30-min delivery claim  
- [ ] Cutoffs match live ops  
- [ ] Placeholder tokens replaced  
- [ ] Chef ads say “example” if using earnings numbers  
- [ ] Real Amma photos only with consent  

---

## Tracking sheet columns (copy to Google Sheet)

```text
post_id | campaign | asset | status | gen_tool | edit_date | platforms | wa_clicks | notes
C01 | customers | poster | done | openai | 2026-08-06 | ig,fb |  | 
C01 | customers | video | base | google |  |  |  | mute music
```

---

## Using Cursor in each session

Paste `02-CURSOR-MASTER-PROMPT.md` and set:

```text
Current task: Produce C03 POSTER only. Use assets folder conventions.
```

After approval:

```text
Current task: C03 VIDEO IMG+VO — give CapCut timing marks for VO lines.
```

Do not ask Cursor to invent new business model facts outside `01-BUSINESS-MODEL.md`.
