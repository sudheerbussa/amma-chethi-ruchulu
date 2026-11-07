#!/usr/bin/env python3
"""Sneha Digital Hub — Three Powers client pitch.

Writes two 16:9 decks (original videos preserved in both):
  ../Sneha_Digital_Hub_Three_Powers.pptx
  ../Sneha_Digital_Hub_Three_Powers_Storyset.pptx
"""

from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt
from lxml import etree

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
SS = ROOT / "storyset" / "clear"
MEDIA = ROOT / "media"
POSTERS = ROOT / "posters"

OUT_PLAIN = REPO / "Sneha_Digital_Hub_Three_Powers.pptx"
OUT_STORY = REPO / "Sneha_Digital_Hub_Three_Powers_Storyset.pptx"

# Midnight Atelier — dark studio, gold metal, cream type
INK = RGBColor(0x0B, 0x0F, 0x14)
PANEL = RGBColor(0x12, 0x18, 0x22)
CARD = RGBColor(0x18, 0x20, 0x2C)
LINE = RGBColor(0x2A, 0x34, 0x42)
GOLD = RGBColor(0xD4, 0xAF, 0x37)
CREAM = RGBColor(0xF4, 0xEF, 0xE4)
MUTED = RGBColor(0x9A, 0xA3, 0xAE)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
CORAL = RGBColor(0xE0, 0x7A, 0x5F)
TEAL = RGBColor(0x3D, 0xC4, 0xB3)

PHONE = "+91 95508 37035"
WEB = "www.snehadigitals.com"
MAIL = "info@snehadigitals.com"
WA = "https://wa.me/919550837035?text=Hi%2C%20I%20want%20a%2030-minute%20growth%20audit"

W = Inches(13.333)
H = Inches(7.5)

SERIF = "Georgia"
SANS = "Calibri"


def set_run(run, text, size=18, bold=False, color=CREAM, font=SANS, italic=False):
    run.text = text
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.italic = italic
    run.font.color.rgb = color
    run.font.name = font


def tb(slide, left, top, width, height, text, size=18, bold=False, color=CREAM,
       align=PP_ALIGN.LEFT, font=SANS, italic=False, anchor=MSO_ANCHOR.TOP):
    box = slide.shapes.add_textbox(left, top, width, height)
    tf = box.text_frame
    tf.word_wrap = True
    tf.auto_size = None
    try:
        tf._txBody.bodyPr.set("anchor", {MSO_ANCHOR.TOP: "t", MSO_ANCHOR.MIDDLE: "ctr", MSO_ANCHOR.BOTTOM: "b"}[anchor])
    except Exception:
        pass
    lines = text.split("\n") if text is not None else [""]
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.space_after = Pt(0)
        p.space_before = Pt(0)
        set_run(p.add_run(), line, size, bold, color, font, italic)
    return box


def fill(shape, color):
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()


def rect(slide, left, top, width, height, color):
    sh = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
    fill(sh, color)
    return sh


def rrect(slide, left, top, width, height, color):
    sh = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    fill(sh, color)
    # tighten corner radius so cards feel editorial, not cartoon
    try:
        prst = sh._element.spPr.find(qn("a:prstGeom"))
        av = prst.find(qn("a:avLst"))
        if av is None:
            av = etree.SubElement(prst, qn("a:avLst"))
        gd = av.find(qn("a:gd"))
        if gd is None:
            gd = etree.SubElement(av, qn("a:gd"))
        gd.set("name", "adj")
        gd.set("fmla", "val 8000")
    except Exception:
        pass
    return sh


def blank(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    rect(s, 0, 0, W, H, INK)
    return s


def gold_bar(slide, left=Inches(0.55), top=Inches(0.42), width=Inches(1.15)):
    return rect(slide, left, top, width, Inches(0.045), GOLD)


def footer(slide, page, total=19, story=False):
    rect(slide, 0, Inches(7.28), W, Inches(0.22), PANEL)
    tb(slide, Inches(0.55), Inches(7.28), Inches(7.5), Inches(0.22),
       "SNEHA DIGITAL HUB   ·   THREE POWERS", size=9, color=MUTED, font=SANS, anchor=MSO_ANCHOR.MIDDLE)
    right = f"{page:02d}  /  {total:02d}"
    if story:
        right = "Illustrations: Storyset by Freepik   ·   " + right
    tb(slide, Inches(8.2), Inches(7.28), Inches(4.6), Inches(0.22),
       right, size=9, color=MUTED, align=PP_ALIGN.RIGHT, font=SANS, anchor=MSO_ANCHOR.MIDDLE)


def ss_pic(slide, name, left, top, width=None, height=None):
    path = SS / name
    if not path.exists():
        return None
    kw = {}
    if width is not None:
        kw["width"] = width
    if height is not None:
        kw["height"] = height
    return slide.shapes.add_picture(str(path), left, top, **kw)


def fit_video_box(vw, vh, max_w, max_h):
    """Return (w, h) Inches-compatible EMU keeping aspect."""
    max_w, max_h = int(max_w), int(max_h)
    scale = min(max_w / vw, max_h / vh)
    return int(vw * scale), int(vh * scale)


def add_video(slide, media_name, poster_name, left, top, width, height):
    return slide.shapes.add_movie(
        str(MEDIA / media_name),
        left, top, width, height,
        poster_frame_image=str(POSTERS / poster_name),
        mime_type="video/mp4",
    )


def play_hint(slide, left, top, width=Inches(2.4)):
    chip = rrect(slide, left, top, width, Inches(0.36), GOLD)
    tf = chip.text_frame
    tf.word_wrap = False
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    set_run(p.add_run(), "▶   Click to play", size=11, bold=True, color=INK, font=SANS)


# ─── slides ─────────────────────────────────────────────────────


def s_cover(prs, story):
    s = blank(prs)
    rect(s, 0, 0, Inches(0.18), H, GOLD)

    if story:
        ss_pic(s, "hero-marketing.png", Inches(7.55), Inches(0.55), height=Inches(6.5))
    else:
        try:
            s.shapes.add_picture(str(MEDIA / "cover-crop.jpg"), Inches(7.15), 0, height=H)
            rect(s, Inches(7.15), 0, Inches(0.08), H, GOLD)
        except Exception:
            pass

    tb(s, Inches(0.7), Inches(0.85), Inches(6.4), Inches(0.3),
       "SNEHA DIGITAL HUB", size=13, bold=True, color=GOLD, font=SANS)
    gold_bar(s, Inches(0.7), Inches(1.22), Inches(1.4))

    tb(s, Inches(0.7), Inches(1.7), Inches(6.5), Inches(2.4),
       "Three powers.\nOne growth engine.", size=40, bold=True, color=CREAM, font=SERIF)

    tb(s, Inches(0.7), Inches(4.35), Inches(6.3), Inches(1.15),
       "Brand. Performance. Video.\nA single studio so every customer touchpoint\nfeels like the same confident business.",
       size=16, color=MUTED, font=SANS)

    # three chips
    labels = ["01  BRAND", "02  PERFORMANCE", "03  VIDEO"]
    for i, lab in enumerate(labels):
        chip = rrect(s, Inches(0.7 + i * 2.05), Inches(5.75), Inches(1.92), Inches(0.42), CARD)
        tf = chip.text_frame
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        set_run(p.add_run(), lab, size=11, bold=True, color=GOLD, font=SANS)

    tb(s, Inches(0.7), Inches(6.45), Inches(6.4), Inches(0.4),
       f"{WEB}    ·    {PHONE}", size=13, color=CREAM, font=SANS)
    return s


def s_problem(prs, story):
    s = blank(prs)
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.55), Inches(8), Inches(0.3),
       "THE GAP YOUR CUSTOMER FEELS", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.95), Inches(8.4 if story else 12.2), Inches(1.5),
       "They never meet your vendors.\nThey only meet one brand.",
       size=32, bold=True, color=CREAM, font=SERIF)
    if story:
        ss_pic(s, "connected.png", Inches(9.35), Inches(0.35), height=Inches(2.55))

    pains = [
        ("Split story", "Website, reels, and ads look like three different shops. Trust leaks before the sale."),
        ("Spend without a spine", "Media budget buys clicks. Without one voice, those clicks do not compound."),
        ("Handoffs kill speed", "Design waits on ads. Ads wait on video. The moment — and the customer — move on."),
    ]
    for i, (t, b) in enumerate(pains):
        left = Inches(0.55 + i * 4.2)
        rrect(s, left, Inches(3.55), Inches(3.95), Inches(3.15), CARD)
        rect(s, left, Inches(3.55), Inches(0.09), Inches(3.15), GOLD)
        tb(s, left + Inches(0.35), Inches(3.8), Inches(3.4), Inches(0.35),
           f"0{i+1}", size=14, bold=True, color=GOLD, font=SANS)
        tb(s, left + Inches(0.35), Inches(4.2), Inches(3.4), Inches(0.7),
           t, size=20, bold=True, color=CREAM, font=SERIF)
        tb(s, left + Inches(0.35), Inches(5.0), Inches(3.4), Inches(1.35),
           b, size=14, color=MUTED, font=SANS)
    footer(s, 2, story=story)
    return s


def s_powers(prs, story):
    s = blank(prs)
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.55), Inches(12), Inches(0.3),
       "WHAT WE PUT UNDER ONE ROOF", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.92), Inches(12), Inches(0.85),
       "The three powers.", size=32, bold=True, color=CREAM, font=SERIF)

    powers = [
        ("01", "Brand", "The look, language, and system people remember — so every post, pack, and page feels like you."),
        ("02", "Performance", "Meta, Google, and YouTube as one funnel: attention, intent, and the second chance to convert."),
        ("03", "Video", "Films that stop the scroll and carry the sale — from shop-floor reels to property walkthroughs."),
    ]
    arts = ["designer.png", "online-ads.png", "videographer.png"]
    for i, ((n, t, b), art) in enumerate(zip(powers, arts)):
        left = Inches(0.55 + i * 4.2)
        rrect(s, left, Inches(2.0), Inches(3.95), Inches(4.7), CARD)
        tb(s, left + Inches(0.3), Inches(2.2), Inches(3.35), Inches(0.4),
           n, size=18, bold=True, color=GOLD, font=SANS)
        if story:
            ss_pic(s, art, left + Inches(0.85), Inches(2.45), width=Inches(2.25))
            title_top = Inches(4.7)
            body_top = Inches(5.2)
        else:
            title_top = Inches(3.15)
            body_top = Inches(3.8)
            tb(s, left + Inches(0.3), Inches(2.7), Inches(3.35), Inches(0.35),
               "POWER", size=11, color=MUTED, font=SANS)
        tb(s, left + Inches(0.3), title_top, Inches(3.35), Inches(0.5),
           t, size=24, bold=True, color=CREAM, font=SERIF)
        tb(s, left + Inches(0.3), body_top, Inches(3.35), Inches(1.35),
           b, size=13, color=MUTED, font=SANS)
    footer(s, 3, story=story)
    return s


def s_stack(prs, story):
    s = blank(prs)
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.55), Inches(12), Inches(0.3),
       "THE GROWTH STACK", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.92), Inches(8.5), Inches(1.1),
       "Nine crafts. One brief.\nNothing lost in translation.",
       size=28, bold=True, color=CREAM, font=SERIF)
    if story:
        ss_pic(s, "creative-team.png", Inches(10.35), Inches(0.18), height=Inches(1.55))

    items = [
        ("Social systems", "A posting rhythm that sounds like the brand, not a content calendar leftover."),
        ("Meta ads", "Instagram & Facebook that find the right people — then bring them back."),
        ("Google ads", "Capture demand when someone is already looking for what you sell."),
        ("Video studio", "Shoot-to-export craft for Reels, ads, YouTube, and walkthroughs."),
        ("Graphic design", "Assets that hold up on a phone and on a storefront board."),
        ("Brand identity", "Colour, type, and tone — so staff and vendors stop guessing."),
        ("YouTube", "Channel shape, packaging, and a cadence people return to."),
        ("Content", "Scripts, stills, and lines written for how your customer actually talks."),
        ("Business branding", "The full face of the shop: from GST board energy to premium digital."),
    ]
    for i, (t, b) in enumerate(items):
        col, row = i % 3, i // 3
        left = Inches(0.55 + col * 4.2)
        top = Inches(2.35 + row * 1.55)
        rrect(s, left, top, Inches(3.95), Inches(1.42), CARD)
        tb(s, left + Inches(0.25), top + Inches(0.18), Inches(3.45), Inches(0.38),
           t, size=15, bold=True, color=GOLD, font=SANS)
        tb(s, left + Inches(0.25), top + Inches(0.55), Inches(3.45), Inches(0.75),
           b, size=12, color=MUTED, font=SANS)
    footer(s, 4, story=story)
    return s


def s_video_craft(prs, story):
    s = blank(prs)
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.55), Inches(12), Inches(0.3),
       "POWER 03  ·  VIDEO", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.92), Inches(8.2), Inches(1.0),
       "From raw clip to a film\nthat can sell.",
       size=28, bold=True, color=CREAM, font=SERIF)
    if story:
        ss_pic(s, "video-files.png", Inches(10.25), Inches(0.12), height=Inches(1.7))

    steps = [
        ("01", "Brief", "Objective, audience, and the one feeling the cut must leave behind."),
        ("02", "Story edit", "We keep only the shots that carry the message — nothing decorative."),
        ("03", "Pace", "Cuts and rhythm tuned for Reels, ads, or a two-minute walkthrough."),
        ("04", "Grade", "Colour that matches the brand and reads on a bright shop-floor phone."),
        ("05", "Sound & titles", "Mix, captions, and accessibility so the film works on mute."),
        ("06", "Export", "Platform-ready files. You post. We do not leave you with a project file."),
    ]
    for i, (n, t, b) in enumerate(steps):
        col, row = i % 3, i // 3
        left = Inches(0.55 + col * 4.2)
        top = Inches(2.55 + row * 2.2)
        rrect(s, left, top, Inches(3.95), Inches(2.0), CARD)
        tb(s, left + Inches(0.28), top + Inches(0.22), Inches(3.4), Inches(0.32),
           n, size=13, bold=True, color=GOLD, font=SANS)
        tb(s, left + Inches(0.28), top + Inches(0.55), Inches(3.4), Inches(0.4),
           t, size=20, bold=True, color=CREAM, font=SERIF)
        tb(s, left + Inches(0.28), top + Inches(1.05), Inches(3.4), Inches(0.75),
           b, size=13, color=MUTED, font=SANS)
    footer(s, 5, story=story)
    return s


def s_ads(prs, story):
    s = blank(prs)
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.55), Inches(12), Inches(0.3),
       "POWER 02  ·  PERFORMANCE", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.92), Inches(8.4), Inches(1.05),
       "One funnel. Three doors in.",
       size=30, bold=True, color=CREAM, font=SERIF)
    if story:
        ss_pic(s, "dashboard.png", Inches(10.2), Inches(0.08), height=Inches(1.7))

    tb(s, Inches(0.55), Inches(2.05), Inches(12.2), Inches(0.55),
       "Meta builds proof. Google catches intent. YouTube and display keep you in the room.\nA single channel starts a conversation. The mix finishes it.",
       size=15, color=MUTED, font=SANS)

    stages = [
        ("Research", "Who buys, what they type, where they hesitate."),
        ("Concept", "One idea strong enough to survive a 3-second thumb stop."),
        ("Setup", "Audiences, placements, pixels — clean before spend starts."),
        ("Test", "Creatives and lines compete. Winners earn budget."),
        ("Watch", "ROAS, CPA, CTR — read daily, not at month-end."),
        ("Tighten", "Bids, audiences, and the next cut. Compound, don't reset."),
    ]
    for i, (t, b) in enumerate(stages):
        left = Inches(0.45 + i * 2.14)
        rrect(s, left, Inches(2.85), Inches(2.04), Inches(3.85), CARD)
        rect(s, left, Inches(2.85), Inches(2.04), Inches(0.08), GOLD)
        tb(s, left + Inches(0.12), Inches(3.1), Inches(1.8), Inches(0.3),
           f"0{i+1}", size=12, bold=True, color=GOLD, font=SANS)
        tb(s, left + Inches(0.12), Inches(3.45), Inches(1.8), Inches(0.85),
           t, size=16, bold=True, color=CREAM, font=SERIF)
        tb(s, left + Inches(0.12), Inches(4.4), Inches(1.8), Inches(1.9),
           b, size=12, color=MUTED, font=SANS)
    footer(s, 6, story=story)
    return s


def s_process(prs, story):
    s = blank(prs)
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.55), Inches(12), Inches(0.3),
       "HOW WE WORK WITH YOU", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.92), Inches(8.5), Inches(1.0),
       "Four moves. Then we ship.",
       size=30, bold=True, color=CREAM, font=SERIF)
    if story:
        ss_pic(s, "business-plan.png", Inches(10.25), Inches(0.12), height=Inches(1.65))

    steps = [
        ("01", "Hear the brief", "Goals, constraints, what “good” looks like in 90 days — said in your words, not ours."),
        ("02", "Read the market", "Audience, competitors, and the local gap we can actually occupy."),
        ("03", "Lock the plan", "Channels, message, cadence, and the numbers we will watch together."),
        ("04", "Make and run", "Design, film, and media — one team, one calendar, no relay race."),
    ]
    for i, (n, t, b) in enumerate(steps):
        top = Inches(2.2 + i * 1.2)
        rrect(s, Inches(0.55), top, Inches(12.2), Inches(1.08), CARD)
        rrect(s, Inches(0.75), top + Inches(0.22), Inches(0.85), Inches(0.64), GOLD)
        tb(s, Inches(0.75), top + Inches(0.28), Inches(0.85), Inches(0.52),
           n, size=16, bold=True, color=INK, align=PP_ALIGN.CENTER, font=SANS, anchor=MSO_ANCHOR.MIDDLE)
        tb(s, Inches(1.85), top + Inches(0.16), Inches(4.2), Inches(0.75),
           t, size=20, bold=True, color=CREAM, font=SERIF, anchor=MSO_ANCHOR.MIDDLE)
        tb(s, Inches(6.2), top + Inches(0.18), Inches(6.2), Inches(0.75),
           b, size=14, color=MUTED, font=SANS, anchor=MSO_ANCHOR.MIDDLE)
    footer(s, 7, story=story)
    return s


def s_industries(prs, story):
    s = blank(prs)
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.55), Inches(12), Inches(0.3),
       "WHO THIS IS BUILT FOR", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.92), Inches(12), Inches(0.9),
       "Local businesses. Serious brands.\nSame craft, fitted to the category.",
       size=28, bold=True, color=CREAM, font=SERIF)

    cats = [
        "Retail & mobile stores", "Restaurants & cloud kitchens", "Clinics & hospitals",
        "Schools & institutes", "Real estate & plots", "Fashion & lifestyle",
        "Startups", "Personal brands", "Multi-outlet groups", "Service businesses",
    ]
    for i, c in enumerate(cats):
        col, row = i % 5, i // 5
        left = Inches(0.55 + col * 2.5)
        top = Inches(2.2 + row * 1.05)
        rrect(s, left, top, Inches(2.35), Inches(0.9), CARD)
        tb(s, left + Inches(0.1), top + Inches(0.18), Inches(2.15), Inches(0.55),
           c, size=13, bold=True, color=CREAM, align=PP_ALIGN.CENTER, font=SANS, anchor=MSO_ANCHOR.MIDDLE)

    if story:
        ss_pic(s, "shopping.png", Inches(1.3), Inches(4.4), width=Inches(2.6))
        ss_pic(s, "building.png", Inches(5.35), Inches(4.4), width=Inches(2.6))
        ss_pic(s, "fashion.png", Inches(9.4), Inches(4.4), width=Inches(2.6))
    else:
        tb(s, Inches(0.55), Inches(4.55), Inches(12.2), Inches(2.1),
           "Repeatable tactics — local targeting, mobile-first film, and a brand system —\nrewritten for how your category actually buys.",
           size=16, color=MUTED, font=SANS)
    footer(s, 8, story=story)
    return s


def s_results(prs, story):
    s = blank(prs)
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.55), Inches(12), Inches(0.3),
       "WHAT FOCUSED WORK CAN LOOK LIKE", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.95), Inches(12), Inches(0.85),
       "Direction of travel — not a lottery ticket.",
       size=28, bold=True, color=CREAM, font=SERIF)
    if story:
        ss_pic(s, "visual-data.png", Inches(10.25), Inches(0.08), height=Inches(1.65))

    metrics = [
        ("3×", "Leads in 90 days", "When creative, offer, and targeting finally point the same way."),
        ("−30%", "Cost per lead", "Waste comes out as the funnel learns. Spend gets quieter and sharper."),
        ("+2–4 pp", "Conversion lift", "Better pages, better films, fewer leaks between click and call."),
    ]
    for i, (n, t, b) in enumerate(metrics):
        left = Inches(0.55 + i * 4.2)
        rrect(s, left, Inches(2.3), Inches(3.95), Inches(3.85), CARD)
        tb(s, left + Inches(0.3), Inches(2.55), Inches(3.35), Inches(1.15),
           n, size=44, bold=True, color=GOLD, font=SERIF)
        tb(s, left + Inches(0.3), Inches(3.8), Inches(3.35), Inches(0.55),
           t, size=18, bold=True, color=CREAM, font=SANS)
        tb(s, left + Inches(0.3), Inches(4.45), Inches(3.35), Inches(1.3),
           b, size=14, color=MUTED, font=SANS)
    tb(s, Inches(0.55), Inches(6.4), Inches(12.2), Inches(0.55),
       "These are starter-engagement ranges we plan toward — then we report the real numbers, every week.",
       size=13, italic=True, color=MUTED, font=SANS)
    footer(s, 9, story=story)
    return s


def s_why(prs, story):
    s = blank(prs)
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.55), Inches(12), Inches(0.3),
       "WHY TEAMS STAY", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.92), Inches(8.6), Inches(1.05),
       "Less risk. More craft.\nA studio with a point of view.",
       size=28, bold=True, color=CREAM, font=SERIF)
    if story:
        ss_pic(s, "team-work.png", Inches(10.25), Inches(0.08), height=Inches(1.65))

    points = [
        ("One partner", "Design, media, and video in the same room. Faster calls. A story that holds."),
        ("Grown-up reporting", "You see what ran, what it cost, and what it returned — in language an owner can use."),
        ("Pace you can feel", "Campaigns and cuts move at business speed, not agency-calendar speed."),
        ("Women-led studio", "We grow businesses — and we build careers and financial independence for women on the work."),
        ("Scales with you", "Start tight. Add channels when the first ones are earning. No theatre."),
        ("Your money, your ads", "Media spend sits in your Meta and Google accounts. We steer. We do not siphon."),
    ]
    for i, (t, b) in enumerate(points):
        col, row = i % 3, i // 3
        left = Inches(0.55 + col * 4.2)
        top = Inches(2.35 + row * 2.25)
        rrect(s, left, top, Inches(3.95), Inches(2.08), CARD)
        tb(s, left + Inches(0.28), top + Inches(0.28), Inches(3.4), Inches(0.5),
           t, size=18, bold=True, color=GOLD, font=SERIF)
        tb(s, left + Inches(0.28), top + Inches(0.85), Inches(3.4), Inches(1.0),
           b, size=13, color=MUTED, font=SANS)
    footer(s, 10, story=story)
    return s


def s_partner(prs, story):
    s = blank(prs)
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.55), Inches(12), Inches(0.3),
       "WORKING TOGETHER", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.95), Inches(12), Inches(0.85),
       "A clear monthly partnership.\nNo mystery menu.",
       size=28, bold=True, color=CREAM, font=SERIF)

    rrect(s, Inches(0.55), Inches(2.2), Inches(6.0), Inches(4.45), CARD)
    tb(s, Inches(0.85), Inches(2.45), Inches(5.4), Inches(0.35),
       "STUDIO", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.85), Inches(2.9), Inches(5.4), Inches(0.7),
       "From ₹8,000 / month", size=26, bold=True, color=CREAM, font=SERIF)
    tb(s, Inches(0.85), Inches(3.7), Inches(5.4), Inches(2.5),
       "Strategy, creative, campaign setup, daily watch, and a report you can actually read.\n\nStandard start has no separate “setup tax.” Custom work is quoted only when you ask for it.",
       size=15, color=MUTED, font=SANS)

    rrect(s, Inches(6.8), Inches(2.2), Inches(6.0), Inches(4.45), CARD)
    tb(s, Inches(7.1), Inches(2.45), Inches(5.4), Inches(0.35),
       "MEDIA SPEND  ·  YOUR ACCOUNT", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(7.1), Inches(2.9), Inches(5.4), Inches(0.55),
       "You choose the daily fuel.", size=20, bold=True, color=CREAM, font=SERIF)

    bands = [
        ("Silver", "₹300 / day + GST", "Prove the offer."),
        ("Gold", "₹500 / day + GST", "Give winners room."),
        ("Diamond", "₹1,000 / day + GST", "Scale what already converts."),
    ]
    for i, (name, amt, note) in enumerate(bands):
        top = Inches(3.6 + i * 0.9)
        tb(s, Inches(7.1), top, Inches(1.7), Inches(0.7),
           name, size=16, bold=True, color=GOLD, font=SERIF, anchor=MSO_ANCHOR.MIDDLE)
        tb(s, Inches(8.85), top, Inches(2.7), Inches(0.7),
           amt, size=15, bold=True, color=CREAM, font=SANS, anchor=MSO_ANCHOR.MIDDLE)
        tb(s, Inches(11.5), top, Inches(1.05), Inches(0.7),
           note, size=12, color=MUTED, font=SANS, anchor=MSO_ANCHOR.MIDDLE)
    footer(s, 11, story=story)
    return s


def s_before(prs, story):
    s = blank(prs)
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.5), Inches(12), Inches(0.28),
       "PROOF  ·  BEFORE THE CUT", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.82), Inches(12), Inches(0.55),
       "What a shop floor actually looks like.", size=24, bold=True, color=CREAM, font=SERIF)

    shots = [
        (MEDIA / "image4.jpeg", "Shop energy — the room, the stock, the night."),
        (MEDIA / "image5.jpeg", "Product still — the phone has to feel inevitable."),
        (MEDIA / "image6.jpeg", "Inventory that sells — abundance, made readable."),
    ]
    for i, (path, cap) in enumerate(shots):
        left = Inches(0.45 + i * 4.25)
        rrect(s, left, Inches(1.55), Inches(4.05), Inches(5.15), CARD)
        try:
            s.shapes.add_picture(str(path), left + Inches(0.18), Inches(1.73), width=Inches(3.7), height=Inches(4.15))
        except Exception:
            pass
        tb(s, left + Inches(0.18), Inches(5.95), Inches(3.7), Inches(0.55),
           cap, size=12, color=MUTED, font=SANS)
    footer(s, 12, story=story)
    return s


def _video_stage(s, title, kicker, body, page, story, art=None):
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.48), Inches(12), Inches(0.26),
       kicker, size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.78), Inches(7.2), Inches(0.5),
       title, size=22, bold=True, color=CREAM, font=SERIF)
    if body:
        tb(s, Inches(0.55), Inches(1.28), Inches(6.6), Inches(0.7),
           body, size=13, color=MUTED, font=SANS)
    footer(s, page, story=story)


def s_vid_vertical(prs, story, media, poster, vw, vh, title, kicker, body, page, art=None):
    s = blank(prs)
    _video_stage(s, title, kicker, body, page, story, art)
    max_h = Inches(5.15)
    max_w = Inches(3.05)
    w, h = fit_video_box(vw, vh, max_w, max_h)
    left = Inches(8.55)
    top = Inches(1.85)
    rrect(s, left - Inches(0.12), top - Inches(0.12), Emu(w) + Inches(0.24), Emu(h) + Inches(0.24), CARD)
    add_video(s, media, poster, left, top, Emu(w), Emu(h))
    play_hint(s, Inches(0.55), Inches(2.15))
    return s


def s_vid_landscape(prs, story, media, poster, vw, vh, title, kicker, body, page, art=None):
    s = blank(prs)
    _video_stage(s, title, kicker, "", page, story, art)
    # title row uses top ~1.35; video below
    max_w = Inches(10.4)
    max_h = Inches(4.85)
    w, h = fit_video_box(vw, vh, max_w, max_h)
    left = int((W - w) / 2)
    top = Inches(1.55)
    rrect(s, Emu(left) - Inches(0.1), top - Inches(0.1), Emu(w) + Inches(0.2), Emu(h) + Inches(0.2), CARD)
    add_video(s, media, poster, Emu(left), top, Emu(w), Emu(h))
    play_hint(s, Inches(0.55), Inches(6.72), width=Inches(2.2))
    if body:
        tb(s, Inches(3.0), Inches(6.7), Inches(9.7), Inches(0.4),
           body, size=13, color=MUTED, font=SANS)
    return s


def s_vid_square(prs, story, media, poster, vw, vh, title, kicker, body, page, art=None):
    s = blank(prs)
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.5), Inches(7.2), Inches(0.26),
       kicker, size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.85), Inches(6.8), Inches(0.7),
       title, size=24, bold=True, color=CREAM, font=SERIF)
    tb(s, Inches(0.55), Inches(1.65), Inches(6.6), Inches(1.4),
       body, size=15, color=MUTED, font=SANS)
    play_hint(s, Inches(0.55), Inches(3.3))
    max_h = Inches(5.7)
    max_w = Inches(5.7)
    w, h = fit_video_box(vw, vh, max_w, max_h)
    left = Inches(7.55)
    top = Inches(1.15)
    rrect(s, left - Inches(0.12), top - Inches(0.12), Emu(w) + Inches(0.24), Emu(h) + Inches(0.24), CARD)
    add_video(s, media, poster, left, top, Emu(w), Emu(h))
    footer(s, page, story=story)
    return s


def s_cta(prs, story):
    s = blank(prs)
    rect(s, 0, 0, Inches(0.18), H, GOLD)
    gold_bar(s, Inches(0.7), Inches(0.7), Inches(1.4))
    tb(s, Inches(0.7), Inches(1.0), Inches(7.4), Inches(0.3),
       "NEXT THIRTY MINUTES", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.7), Inches(1.4), Inches(7.6), Inches(1.7),
       "A growth audit.\nThen a 90-day plan\nyou can act on.",
       size=32, bold=True, color=CREAM, font=SERIF)
    tb(s, Inches(0.7), Inches(3.35), Inches(7.2), Inches(1.15),
       "Thirty minutes with us. Within 48 hours: a tailored plan and a starter package that fits how you actually sell.",
       size=16, color=MUTED, font=SANS)

    btn = rrect(s, Inches(0.7), Inches(4.7), Inches(4.6), Inches(0.7), GOLD)
    btn.click_action.hyperlink.address = WA
    tf = btn.text_frame
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    set_run(p.add_run(), "WhatsApp a demo  →  " + PHONE, size=15, bold=True, color=INK, font=SANS)

    tb(s, Inches(0.7), Inches(5.6), Inches(7.2), Inches(1.0),
       f"{WEB}\n{MAIL}", size=16, color=CREAM, font=SANS)

    if story:
        ss_pic(s, "contact-us.png", Inches(8.35), Inches(0.85), width=Inches(4.5))
    else:
        rrect(s, Inches(8.55), Inches(1.5), Inches(4.15), Inches(4.4), CARD)
        tb(s, Inches(8.85), Inches(1.8), Inches(3.55), Inches(0.4),
           "YOU LEAVE WITH", size=12, bold=True, color=GOLD, font=SANS)
        for i, line in enumerate([
            "A clear 90-day sequence",
            "What to film first",
            "Where the first rupee of ads goes",
            "A package that matches the brief",
        ]):
            tb(s, Inches(8.85), Inches(2.4 + i * 0.7), Inches(3.55), Inches(0.6),
               f"0{i+1}    {line}", size=15, color=CREAM, font=SANS)

    tb(s, Inches(0.7), Inches(6.75), Inches(12), Inches(0.35),
       "Sneha Digital Hub  ·  Empowering women. Building digital businesses that last.",
       size=12, italic=True, color=MUTED, font=SERIF)
    return s


def build(story: bool) -> Presentation:
    prs = Presentation()
    prs.slide_width = W
    prs.slide_height = H

    s_cover(prs, story)
    s_problem(prs, story)
    s_powers(prs, story)
    s_stack(prs, story)
    s_video_craft(prs, story)
    s_ads(prs, story)
    s_process(prs, story)
    s_industries(prs, story)
    s_results(prs, story)
    s_why(prs, story)
    s_partner(prs, story)
    s_before(prs, story)

    s_vid_vertical(
        prs, story, "media1.mp4", "poster1.jpg", 474, 850,
        "Retail, after the cut.",
        "SHOWREEL  01  ·  VERTICAL REEL",
        "Same shop floor. A film that can run tonight — pace, grade, and titles built for the phone.",
        13,
    )
    s_vid_landscape(
        prs, story, "media2.mp4", "poster2.jpg", 848, 478,
        "AI-assisted edit — scholarship film.",
        "SHOWREEL  02  ·  MOTION + CRAFT",
        "Human taste on top of faster tools. A foundation film with a heartbeat, not a template.",
        14,
    )
    s_vid_vertical(
        prs, story, "media3.mp4", "poster3.jpg", 480, 864,
        "Lifestyle film. Place, cloth, feeling.",
        "SHOWREEL  03  ·  DESTINATION",
        "Manginapudi light, silk, and a walk that sells a world — not a product dump.",
        15,
    )
    s_vid_landscape(
        prs, story, "media4.mp4", "poster4.jpg", 848, 478,
        "Real estate, made desirable.",
        "SHOWREEL  04  ·  PROPERTY FILM",
        "Glass, greenery, and a life people can picture themselves walking into.",
        16,
    )
    s_vid_square(
        prs, story, "media5.mp4", "poster5.jpg", 368, 368,
        "Plot to lifestyle.",
        "SHOWREEL  05  ·  PROPERTY STORY",
        "A cottage, a lawn, a weekend someone can already feel. Square for the feed — cinematic in the cut.",
        17,
    )
    s_vid_landscape(
        prs, story, "media6.mp4", "poster6.jpg", 848, 478,
        "Motion design that lifts a brand.",
        "SHOWREEL  06  ·  3D / BRAND FILM",
        "When the story needs more than a camera: light, form, and a feeling of arrival.",
        18,
    )

    s_cta(prs, story)

    # core props
    prs.core_properties.title = "Sneha Digital Hub — Three Powers"
    prs.core_properties.author = "Sneha Digital Hub"
    prs.core_properties.subject = "Brand · Performance · Video"
    return prs


def main():
    plain = build(False)
    plain.save(str(OUT_PLAIN))
    print("wrote", OUT_PLAIN, "slides", len(plain.slides))

    story = build(True)
    story.save(str(OUT_STORY))
    print("wrote", OUT_STORY, "slides", len(story.slides))


if __name__ == "__main__":
    main()
