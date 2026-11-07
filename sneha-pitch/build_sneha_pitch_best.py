#!/usr/bin/env python3
"""Best-of merge: Claude copy/layout ideas + our dark-gold studio template.

Work samples use the earlier dedicated video slides (not a photo gallery
or a 6-video grid). The three shop stills are inputs to the retail promo.

Writes:
  ../Sneha_Digital_Hub_Pitch_Best.pptx
  ../Sneha_Digital_Hub_Pitch_Best_Storyset.pptx
"""

from pptx import Presentation
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Emu, Inches, Pt

import build_sneha_pitch as b

OUT_PLAIN = b.REPO / "Sneha_Digital_Hub_Pitch_Best.pptx"
OUT_STORY = b.REPO / "Sneha_Digital_Hub_Pitch_Best_Storyset.pptx"
CLAUDE = b.MEDIA / "claude"
N = 14


def foot(s, page, story):
    b.footer(s, page, story=story, total=N)


def pic(s, path, left, top, width=None, height=None):
    kw = {}
    if width is not None:
        kw["width"] = width
    if height is not None:
        kw["height"] = height
    return s.shapes.add_picture(str(path), left, top, **kw)


def s_cover(prs, story):
    s = b.blank(prs)
    b.rect(s, 0, 0, Inches(0.18), b.H, b.GOLD)
    if story:
        b.ss_pic(s, "hero-marketing.png", Inches(7.55), Inches(0.45), height=Inches(6.6))
    else:
        try:
            s.shapes.add_picture(str(b.MEDIA / "cover-crop.jpg"), Inches(7.15), 0, height=b.H)
            b.rect(s, Inches(7.15), 0, Inches(0.08), b.H, b.GOLD)
        except Exception:
            pass

    b.tb(s, Inches(0.7), Inches(0.75), Inches(6.4), Inches(0.28),
         "SNEHA DIGITAL HUB", size=13, bold=True, color=b.GOLD, font=b.SANS)
    b.gold_bar(s, Inches(0.7), Inches(1.12), Inches(1.4))
    b.tb(s, Inches(0.7), Inches(1.35), Inches(6.3), Inches(0.32),
         "DIGITAL MARKETING & CREATIVE PARTNER", size=12, bold=True, color=b.MUTED, font=b.SANS)

    b.tb(s, Inches(0.7), Inches(1.9), Inches(6.4), Inches(1.8),
         "Let's grow your\nbrand, together.",
         size=36, bold=True, color=b.CREAM, font=b.SERIF)

    b.tb(s, Inches(0.7), Inches(4.0), Inches(6.2), Inches(1.2),
         "We help local businesses show up beautifully everywhere their customers look — and turn that attention into real, measurable growth.",
         size=15, color=b.MUTED, font=b.SANS)

    b.tb(s, Inches(0.7), Inches(5.45), Inches(6.2), Inches(0.4),
         "A partner-led studio for social, ads, video & brand",
         size=13, italic=True, color=b.GOLD, font=b.SERIF)

    b.tb(s, Inches(0.7), Inches(6.2), Inches(6.4), Inches(0.4),
         f"{b.WEB}    ·    {b.PHONE}", size=13, color=b.CREAM, font=b.SANS)
    return s


def s_challenge(prs, story):
    s = b.blank(prs)
    b.gold_bar(s)
    b.tb(s, Inches(0.55), Inches(0.52), Inches(12), Inches(0.28),
         "THE CHALLENGE WE SEE", size=12, bold=True, color=b.GOLD, font=b.SANS)
    b.tb(s, Inches(0.55), Inches(0.9), Inches(8.6 if story else 12.2), Inches(1.0),
         "Your customers are deciding online —\nbefore they ever reach you.",
         size=26, bold=True, color=b.CREAM, font=b.SERIF)
    if story:
        b.ss_pic(s, "connected.png", Inches(9.5), Inches(0.25), height=Inches(2.2))

    b.tb(s, Inches(0.55), Inches(2.15), Inches(12.2), Inches(0.85),
         "Most local businesses aren't short on effort. They're spread thin — a website here, a social page there, ads that don't quite match. Trust leaks. Budget gets wasted.",
         size=15, color=b.MUTED, font=b.SANS)

    pains = [
        ("Fragmented presence", "Inconsistent branding across web, social and ads quietly erodes trust."),
        ("Wasted spend", "Disconnected campaigns compete with each other instead of compounding."),
        ("Missed customers", "Without one clear story, each touchpoint works alone — and converts less."),
    ]
    for i, (t, body) in enumerate(pains):
        left = Inches(0.55 + i * 4.2)
        b.rrect(s, left, Inches(3.2), Inches(3.95), Inches(3.5), b.CARD)
        b.rect(s, left, Inches(3.2), Inches(0.09), Inches(3.5), b.GOLD)
        b.tb(s, left + Inches(0.35), Inches(3.5), Inches(3.4), Inches(0.8),
             t, size=18, bold=True, color=b.CREAM, font=b.SERIF)
        b.tb(s, left + Inches(0.35), Inches(4.45), Inches(3.4), Inches(1.8),
             body, size=14, color=b.MUTED, font=b.SANS)
    foot(s, 2, story)
    return s


def s_help(prs, story):
    s = b.blank(prs)
    b.gold_bar(s)
    b.tb(s, Inches(0.55), Inches(0.52), Inches(12), Inches(0.28),
         "HOW WE HELP", size=12, bold=True, color=b.GOLD, font=b.SANS)
    b.tb(s, Inches(0.55), Inches(0.88), Inches(12), Inches(0.85),
         "One team for design, ads and video —\npulling in the same direction.",
         size=26, bold=True, color=b.CREAM, font=b.SERIF)
    if story:
        b.ss_pic(s, "collaboration.png", Inches(10.2), Inches(0.15), height=Inches(1.65))

    cards = [
        ("Unified branding", "One consistent voice and look across every channel you own."),
        ("Performance ads", "Meta & Google campaigns built around intent, not guesswork."),
        ("Video that sells", "Scroll-stopping edits made for Reels, YouTube and ads."),
        ("Fewer handoffs", "One point of contact means faster decisions, clearer results."),
    ]
    arts = ["designer.png", "online-ads.png", "videographer.png", "team-work.png"]
    for i, ((t, body), art) in enumerate(zip(cards, arts)):
        col, row = i % 2, i // 2
        left = Inches(0.55 + col * 6.35)
        top = Inches(2.15 + row * 2.4)
        b.rrect(s, left, top, Inches(6.1), Inches(2.2), b.CARD)
        if story:
            b.ss_pic(s, art, left + Inches(4.15), top + Inches(0.25), height=Inches(1.7))
        b.tb(s, left + Inches(0.35), top + Inches(0.35), Inches(3.7 if story else 5.4), Inches(0.5),
             t, size=18, bold=True, color=b.GOLD, font=b.SERIF)
        b.tb(s, left + Inches(0.35), top + Inches(0.95), Inches(3.7 if story else 5.4), Inches(0.95),
             body, size=14, color=b.MUTED, font=b.SANS)
    foot(s, 3, story)
    return s


def s_why(prs, story):
    s = b.blank(prs)
    b.gold_bar(s)
    b.tb(s, Inches(0.55), Inches(0.52), Inches(12), Inches(0.28),
         "WHY WE DO THIS", size=12, bold=True, color=b.GOLD, font=b.SANS)
    b.tb(s, Inches(0.55), Inches(0.9), Inches(12), Inches(0.7),
         "Growth with purpose.",
         size=30, bold=True, color=b.CREAM, font=b.SERIF)
    b.tb(s, Inches(0.55), Inches(1.7), Inches(12), Inches(0.7),
         "We're here to help businesses grow — and to prove that doing it ethically, transparently and inclusively makes the results better, not slower.",
         size=15, color=b.MUTED, font=b.SANS)

    # Inclusive card is gold — women highlighted once
    items = [
        (False, "Real growth", "Innovative marketing that moves the numbers that matter to you."),
        (True, "Women at the centre", "We create careers and financial independence for women in every engagement. Inclusive leadership is built into the work."),
        (False, "Transparent always", "Honest reporting and ethical practices on every project."),
    ]
    for i, (gold, t, body) in enumerate(items):
        left = Inches(0.55 + i * 4.2)
        bg, title_c, body_c = (b.GOLD, b.INK, b.INK) if gold else (b.CARD, b.CREAM, b.MUTED)
        b.rrect(s, left, Inches(2.65), Inches(3.95), Inches(4.05), bg)
        b.tb(s, left + Inches(0.3), Inches(2.95), Inches(3.35), Inches(1.0),
             t, size=20, bold=True, color=title_c, font=b.SERIF)
        b.tb(s, left + Inches(0.3), Inches(4.1), Inches(3.35), Inches(2.2),
             body, size=15, color=body_c, font=b.SANS)
    foot(s, 4, story)
    return s


def s_stack(prs, story):
    s = b.blank(prs)
    b.gold_bar(s)
    b.tb(s, Inches(0.55), Inches(0.5), Inches(12), Inches(0.28),
         "WHAT WE DO", size=12, bold=True, color=b.GOLD, font=b.SANS)
    b.tb(s, Inches(0.55), Inches(0.85), Inches(12), Inches(0.7),
         "A complete growth stack — no gaps, no handoffs.",
         size=24, bold=True, color=b.CREAM, font=b.SERIF)
    if story:
        b.ss_pic(s, "creative-team.png", Inches(10.35), Inches(0.12), height=Inches(1.5))

    items = [
        "Social Media Marketing", "Meta Ads", "Google Ads",
        "Video Editing", "Graphic Design", "Brand Identity",
        "YouTube Management", "Content Creation", "Business Branding",
    ]
    for i, t in enumerate(items):
        col, row = i % 3, i // 3
        left = Inches(0.55 + col * 4.2)
        top = Inches(1.9 + row * 1.6)
        b.rrect(s, left, top, Inches(3.95), Inches(1.4), b.CARD)
        b.tb(s, left + Inches(0.25), top + Inches(0.15), Inches(0.5), Inches(0.35),
             f"0{i+1}", size=12, bold=True, color=b.GOLD, font=b.SANS)
        b.tb(s, left + Inches(0.25), top + Inches(0.55), Inches(3.45), Inches(0.6),
             t, size=18, bold=True, color=b.CREAM, font=b.SERIF)
    foot(s, 5, story)
    return s


def s_process(prs, story):
    s = b.blank(prs)
    b.gold_bar(s)
    b.tb(s, Inches(0.55), Inches(0.52), Inches(12), Inches(0.28),
         "HOW WE WORK WITH YOU", size=12, bold=True, color=b.GOLD, font=b.SANS)
    b.tb(s, Inches(0.55), Inches(0.9), Inches(8.5), Inches(0.65),
         "A simple, repeatable rhythm.",
         size=28, bold=True, color=b.CREAM, font=b.SERIF)
    if story:
        b.ss_pic(s, "business-plan.png", Inches(10.25), Inches(0.15), height=Inches(1.65))

    steps = [
        ("1", "Understand the brief", "Clarify requirements and define what success looks like."),
        ("2", "Market research", "Map your audience, competitors and local opportunity gaps."),
        ("3", "Strategy planning", "Set channels, messaging and timing for measurable growth."),
        ("4", "Creative & design", "Produce assets and content that reflect the strategy and brand."),
    ]
    for i, (n, t, body) in enumerate(steps):
        left = Inches(0.45 + i * 3.22)
        b.rrect(s, left, Inches(1.95), Inches(3.05), Inches(4.55), b.CARD)
        b.rrect(s, left + Inches(0.25), Inches(2.25), Inches(0.7), Inches(0.7), b.GOLD)
        b.tb(s, left + Inches(0.25), Inches(2.25), Inches(0.7), Inches(0.7),
             n, size=20, bold=True, color=b.INK, align=PP_ALIGN.CENTER, font=b.SANS, anchor=MSO_ANCHOR.MIDDLE)
        b.tb(s, left + Inches(0.25), Inches(3.2), Inches(2.55), Inches(1.0),
             t, size=18, bold=True, color=b.CREAM, font=b.SERIF)
        b.tb(s, left + Inches(0.25), Inches(4.35), Inches(2.55), Inches(1.7),
             body, size=14, color=b.MUTED, font=b.SANS)
    foot(s, 6, story)
    return s


def s_industries(prs, story):
    s = b.blank(prs)
    b.gold_bar(s)
    b.tb(s, Inches(0.55), Inches(0.52), Inches(12), Inches(0.28),
         "WHO WE WORK WITH", size=12, bold=True, color=b.GOLD, font=b.SANS)
    b.tb(s, Inches(0.55), Inches(0.9), Inches(12), Inches(0.7),
         "Built to adapt to your world.",
         size=28, bold=True, color=b.CREAM, font=b.SERIF)
    b.tb(s, Inches(0.55), Inches(1.7), Inches(12.2), Inches(0.7),
         "From retail and mobile stores to restaurants, hospitals, schools, real estate, fashion, startups and personal brands — we tailor tactics to how each category actually wins.",
         size=15, color=b.MUTED, font=b.SANS)

    cats = [
        "Retail & mobile stores", "Restaurants", "Hospitals & clinics",
        "Schools", "Real estate", "Fashion brands",
        "Startups", "Local businesses", "Personal brands",
    ]
    for i, c in enumerate(cats):
        col, row = i % 3, i // 3
        left = Inches(0.55 + col * 4.2)
        top = Inches(2.6 + row * 1.4)
        b.rrect(s, left, top, Inches(3.95), Inches(1.2), b.CARD)
        b.tb(s, left + Inches(0.25), top + Inches(0.32), Inches(3.45), Inches(0.55),
             c, size=16, bold=True, color=b.CREAM, font=b.SANS, anchor=MSO_ANCHOR.MIDDLE)
    foot(s, 7, story)
    return s


def s_numbers(prs, story):
    s = b.blank(prs)
    b.gold_bar(s)
    b.tb(s, Inches(0.55), Inches(0.52), Inches(12), Inches(0.28),
         "WHAT GROWTH LOOKS LIKE", size=12, bold=True, color=b.GOLD, font=b.SANS)
    b.tb(s, Inches(0.55), Inches(0.9), Inches(12), Inches(0.65),
         "Numbers our clients feel.",
         size=28, bold=True, color=b.CREAM, font=b.SERIF)
    if story:
        b.ss_pic(s, "visual-data.png", Inches(10.25), Inches(0.12), height=Inches(1.5))

    metrics = [
        ("3×", "Monthly leads", "within 90 days of a starter engagement"),
        ("−30%", "Cost per lead", "reduced on average through optimisation"),
        ("+2–4 pp", "Conversion uplift", "on landing pages via creative & testing"),
    ]
    for i, (n, t, body) in enumerate(metrics):
        left = Inches(0.55 + i * 4.2)
        b.rrect(s, left, Inches(1.9), Inches(3.95), Inches(4.15), b.CARD)
        b.tb(s, left + Inches(0.3), Inches(2.2), Inches(3.35), Inches(1.15),
             n, size=42, bold=True, color=b.GOLD, font=b.SERIF)
        b.tb(s, left + Inches(0.3), Inches(3.5), Inches(3.35), Inches(0.55),
             t, size=18, bold=True, color=b.CREAM, font=b.SANS)
        b.tb(s, left + Inches(0.3), Inches(4.2), Inches(3.35), Inches(1.3),
             body, size=14, color=b.MUTED, font=b.SANS)
    b.tb(s, Inches(0.55), Inches(6.3), Inches(12.2), Inches(0.55),
         "A snapshot of how coordinated optimisation compounds: more leads, lower cost, better conversion.",
         size=13, italic=True, color=b.MUTED, font=b.SANS)
    foot(s, 8, story)
    return s


def place_video(s, media, poster, vw, vh, left, top, max_w, max_h, center_x=False):
    w, h = b.fit_video_box(vw, vh, max_w, max_h)
    x = int(left) + ((int(max_w) - w) // 2 if center_x else 0)
    y = int(top)
    b.rrect(s, Emu(x) - Inches(0.08), Emu(y) - Inches(0.08), Emu(w) + Inches(0.16), Emu(h) + Inches(0.16), b.CARD)
    b.add_video(s, media, poster, Emu(x), Emu(y), Emu(w), Emu(h))
    return Emu(w), Emu(h)


def s_shopee(prs, story):
    """Retail promo + lifestyle — same mobile shop, both portrait."""
    s = b.blank(prs)
    b.gold_bar(s)
    b.tb(s, Inches(0.55), Inches(0.45), Inches(12), Inches(0.24),
         "WORK SAMPLE  ·  MOBILE SHOP", size=12, bold=True, color=b.GOLD, font=b.SANS)
    b.tb(s, Inches(0.55), Inches(0.72), Inches(12), Inches(0.4),
         "Same shop. Two portrait films.",
         size=22, bold=True, color=b.CREAM, font=b.SERIF)

    b.tb(s, Inches(2.15), Inches(1.18), Inches(3.4), Inches(0.32),
         "Retail promo", size=16, bold=True, color=b.GOLD, font=b.SERIF, align=PP_ALIGN.CENTER)
    place_video(
        s, "media1.mp4", "poster1.jpg", 474, 850,
        Inches(2.15), Inches(1.52), Inches(3.4), Inches(5.15), center_x=True,
    )

    b.tb(s, Inches(7.75), Inches(1.18), Inches(3.4), Inches(0.32),
         "Lifestyle film", size=16, bold=True, color=b.GOLD, font=b.SERIF, align=PP_ALIGN.CENTER)
    place_video(
        s, "media3.mp4", "poster3.jpg", 480, 864,
        Inches(7.75), Inches(1.52), Inches(3.4), Inches(5.15), center_x=True,
    )
    foot(s, 9, story)
    return s


def s_scholarship(prs, story):
    s = b.blank(prs)
    b.gold_bar(s)
    b.tb(s, Inches(0.55), Inches(0.48), Inches(12), Inches(0.24),
         "WORK SAMPLE  ·  AI VIDEO EDITING", size=12, bold=True, color=b.GOLD, font=b.SANS)
    b.tb(s, Inches(0.55), Inches(0.78), Inches(12), Inches(0.5),
         "Sravani scholarship film.",
         size=24, bold=True, color=b.CREAM, font=b.SERIF)
    place_video(
        s, "media2.mp4", "poster2.jpg", 848, 478,
        Inches(1.45), Inches(1.45), Inches(10.4), Inches(4.85), center_x=True,
    )
    b.tb(s, Inches(0.55), Inches(6.55), Inches(12.2), Inches(0.4),
         "Human taste on top of faster tools — one brand story, cut for the screen.",
         size=13, color=b.MUTED, font=b.SANS, align=PP_ALIGN.CENTER)
    foot(s, 10, story)
    return s


def s_brand_film(prs, story):
    s = b.blank(prs)
    b.gold_bar(s)
    b.tb(s, Inches(0.55), Inches(0.48), Inches(12), Inches(0.24),
         "WORK SAMPLE  ·  BRAND FILM", size=12, bold=True, color=b.GOLD, font=b.SANS)
    b.tb(s, Inches(0.55), Inches(0.78), Inches(12), Inches(0.5),
         "Same brand. When the story needs more than a camera.",
         size=22, bold=True, color=b.CREAM, font=b.SERIF)
    place_video(
        s, "media6.mp4", "poster6.jpg", 848, 478,
        Inches(1.45), Inches(1.45), Inches(10.4), Inches(4.85), center_x=True,
    )
    foot(s, 11, story)
    return s


def s_property(prs, story):
    s = b.blank(prs)
    b.gold_bar(s)
    b.tb(s, Inches(0.55), Inches(0.45), Inches(12), Inches(0.25),
         "WORK SAMPLE  ·  PROPERTY", size=12, bold=True, color=b.GOLD, font=b.SANS)

    b.tb(s, Inches(0.5), Inches(0.78), Inches(7.2), Inches(0.38),
         "Real estate film", size=18, bold=True, color=b.CREAM, font=b.SERIF)
    place_video(
        s, "media4.mp4", "poster4.jpg", 848, 478,
        Inches(0.5), Inches(1.25), Inches(7.4), Inches(4.25),
    )
    b.tb(s, Inches(0.5), Inches(6.55), Inches(7.3), Inches(0.4),
         "A life people can already walk into.", size=12, color=b.MUTED, font=b.SANS)

    b.tb(s, Inches(8.2), Inches(0.78), Inches(4.6), Inches(0.38),
         "Property story", size=18, bold=True, color=b.CREAM, font=b.SERIF)
    place_video(
        s, "media5.mp4", "poster5.jpg", 368, 368,
        Inches(8.35), Inches(1.25), Inches(4.4), Inches(4.4),
    )
    foot(s, 12, story)
    return s


def s_meta(prs, story):
    s = b.blank(prs)
    b.gold_bar(s)
    b.tb(s, Inches(0.55), Inches(0.48), Inches(7.4), Inches(0.26),
         "A READY-TO-GO PACKAGE", size=12, bold=True, color=b.GOLD, font=b.SANS)
    b.tb(s, Inches(0.55), Inches(0.82), Inches(7.5), Inches(1.0),
         "Meta Ads that get you\nreal results.",
         size=26, bold=True, color=b.CREAM, font=b.SERIF)
    b.tb(s, Inches(0.55), Inches(1.95), Inches(7.3), Inches(0.85),
         "Instagram & Facebook, built and managed end to end. Pick the daily budget — we handle targeting, creative and reporting.",
         size=14, color=b.MUTED, font=b.SANS)

    b.rrect(s, Inches(0.55), Inches(2.95), Inches(7.35), Inches(1.15), b.CARD)
    b.tb(s, Inches(0.8), Inches(3.08), Inches(6.9), Inches(0.32),
         "SERVICE  ·  ₹8,000 / month", size=16, bold=True, color=b.GOLD, font=b.SERIF)
    b.tb(s, Inches(0.8), Inches(3.45), Inches(6.9), Inches(0.5),
         "Strategy, creative, setup, daily watch, performance report. Ad spend stays in your account.",
         size=13, color=b.MUTED, font=b.SANS)

    for i, (name, amt) in enumerate([
        ("Silver", "₹300 / day + GST"),
        ("Gold", "₹500 / day + GST"),
        ("Diamond", "₹1,000 / day + GST"),
    ]):
        top = Inches(4.3 + i * 0.85)
        b.rrect(s, Inches(0.55), top, Inches(7.35), Inches(0.75), b.CARD)
        b.tb(s, Inches(0.8), top + Inches(0.12), Inches(2.4), Inches(0.5),
             name, size=16, bold=True, color=b.GOLD, font=b.SERIF, anchor=MSO_ANCHOR.MIDDLE)
        b.tb(s, Inches(3.3), top + Inches(0.12), Inches(4.3), Inches(0.5),
             amt, size=16, bold=True, color=b.CREAM, font=b.SANS, anchor=MSO_ANCHOR.MIDDLE)

    # Poster — native 2:3 flyer
    b.tb(s, Inches(8.75), Inches(0.48), Inches(3.9), Inches(0.28),
         "OUR SERVICE POSTER", size=11, bold=True, color=b.GOLD, font=b.SANS)
    b.rrect(s, Inches(8.70), Inches(0.82), Inches(4.05), Inches(5.95), b.CARD)
    try:
        pic(s, CLAUDE / "meta-poster.png", Inches(8.83), Inches(0.95), width=Inches(3.80), height=Inches(5.70))
    except Exception:
        pass
    foot(s, 13, story)
    return s


def s_cta(prs, story):
    s = b.blank(prs)
    b.rect(s, 0, 0, Inches(0.18), b.H, b.GOLD)
    b.gold_bar(s, Inches(0.7), Inches(0.45), Inches(1.4))
    b.tb(s, Inches(0.7), Inches(0.65), Inches(12), Inches(0.26),
         "LET'S BEGIN", size=12, bold=True, color=b.GOLD, font=b.SANS)
    b.tb(s, Inches(0.7), Inches(1.0), Inches(12), Inches(0.85),
         "Start with a 30-minute growth audit.",
         size=28, bold=True, color=b.CREAM, font=b.SERIF)
    b.tb(s, Inches(0.7), Inches(1.9), Inches(12.0), Inches(0.7),
         "We'll uncover quick wins. Within 48 hours you'll have a tailored 90-day plan and a proposed starter package — no obligation.",
         size=15, color=b.MUTED, font=b.SANS)

    steps = [
        ("1", "Book the audit", "A relaxed 30-minute conversation about your goals."),
        ("2", "Get your plan", "A tailored 90-day roadmap within 48 hours."),
        ("3", "Grow together", "A starter package matched to your budget and priorities."),
    ]
    for i, (n, t, body) in enumerate(steps):
        left = Inches(0.55 + i * 4.2)
        b.rrect(s, left, Inches(2.75), Inches(3.95), Inches(2.35), b.CARD)
        b.rrect(s, left + Inches(0.28), Inches(2.95), Inches(0.5), Inches(0.5), b.GOLD)
        b.tb(s, left + Inches(0.28), Inches(2.95), Inches(0.5), Inches(0.5),
             n, size=16, bold=True, color=b.INK, align=PP_ALIGN.CENTER, font=b.SANS, anchor=MSO_ANCHOR.MIDDLE)
        b.tb(s, left + Inches(0.9), Inches(2.95), Inches(2.8), Inches(0.5),
             t, size=15, bold=True, color=b.CREAM, font=b.SANS, anchor=MSO_ANCHOR.MIDDLE)
        b.tb(s, left + Inches(0.28), Inches(3.6), Inches(3.4), Inches(1.2),
             body, size=13, color=b.MUTED, font=b.SANS)

    btn = b.rrect(s, Inches(0.55), Inches(5.3), Inches(4.4), Inches(0.62), b.GOLD)
    btn.click_action.hyperlink.address = b.WA
    tf = btn.text_frame
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    b.set_run(p.add_run(), f"WhatsApp  ·  {b.PHONE}", size=15, bold=True, color=b.INK, font=b.SANS)

    if story:
        b.ss_pic(s, "contact-us.png", Inches(8.7), Inches(5.05), height=Inches(1.9))
    b.tb(s, Inches(5.2), Inches(5.3), Inches(7.4), Inches(0.62),
         f"{b.WEB}    ·    {b.MAIL}    ·    Andhra Pradesh",
         size=14, color=b.CREAM, font=b.SANS, anchor=MSO_ANCHOR.MIDDLE)
    foot(s, 14, story)
    return s


def build(story: bool) -> Presentation:
    prs = Presentation()
    prs.slide_width = b.W
    prs.slide_height = b.H
    s_cover(prs, story)
    s_challenge(prs, story)
    s_help(prs, story)
    s_why(prs, story)
    s_stack(prs, story)
    s_process(prs, story)
    s_industries(prs, story)
    s_numbers(prs, story)
    s_shopee(prs, story)
    s_scholarship(prs, story)
    s_brand_film(prs, story)
    s_property(prs, story)
    s_meta(prs, story)
    s_cta(prs, story)
    prs.core_properties.title = "Sneha Digital Hub"
    prs.core_properties.author = "Sneha Digital Hub"
    prs.core_properties.subject = "Let's grow your brand, together."
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
