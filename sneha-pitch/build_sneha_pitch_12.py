#!/usr/bin/env python3
"""Sneha Digital Hub — 12-slide meeting deck (shorter cut).

Does not overwrite the 21-slide files.
Writes:
  ../Sneha_Digital_Hub_Pitch_12.pptx
  ../Sneha_Digital_Hub_Pitch_12_Storyset.pptx
"""

from pptx import Presentation
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Emu, Inches, Pt

import build_sneha_pitch as b

OUT_PLAIN = b.REPO / "Sneha_Digital_Hub_Pitch_12.pptx"
OUT_STORY = b.REPO / "Sneha_Digital_Hub_Pitch_12_Storyset.pptx"
N = 12


def foot(s, page, story):
    b.footer(s, page, story=story, total=N)


def women_panel(s, left, top, width, height):
    """Full gold block — the mission, not a footnote."""
    b.rrect(s, left, top, width, height, b.GOLD)
    b.tb(
        s, left + Inches(0.35), top + Inches(0.22), width - Inches(0.7), Inches(0.35),
        "WOMEN AT THE CENTRE", size=13, bold=True, color=b.INK, font=b.SANS,
    )
    b.tb(
        s, left + Inches(0.35), top + Inches(0.58), width - Inches(0.7), height - Inches(0.75),
        "Every project grows a business — and a woman’s career. We build financial independence and inclusive leadership into the work, not beside it.",
        size=14, color=b.INK, font=b.SANS,
    )


def s_cover(prs, story):
    s = b.blank(prs)
    b.rect(s, 0, 0, Inches(0.18), b.H, b.GOLD)

    if story:
        b.ss_pic(s, "hero-marketing.png", Inches(7.55), Inches(0.55), height=Inches(6.5))
    else:
        try:
            s.shapes.add_picture(str(b.MEDIA / "cover-crop.jpg"), Inches(7.15), 0, height=b.H)
            b.rect(s, Inches(7.15), 0, Inches(0.08), b.H, b.GOLD)
        except Exception:
            pass

    b.tb(s, Inches(0.7), Inches(0.85), Inches(6.4), Inches(0.28),
         "SNEHA DIGITAL HUB", size=13, bold=True, color=b.GOLD, font=b.SANS)
    b.gold_bar(s, Inches(0.7), Inches(1.22), Inches(1.4))

    b.tb(s, Inches(0.7), Inches(1.6), Inches(6.4), Inches(2.2),
         "Creative digital work\nthat grows the\nbusiness.",
         size=36, bold=True, color=b.CREAM, font=b.SERIF)

    b.tb(s, Inches(0.7), Inches(4.2), Inches(6.2), Inches(0.9),
         "Design, ads, and video — one team, one story,\nresults you can measure.",
         size=16, color=b.MUTED, font=b.SANS)

    for i, lab in enumerate(["DESIGN", "ADS", "VIDEO"]):
        chip = b.rrect(s, Inches(0.7 + i * 1.85), Inches(5.4), Inches(1.7), Inches(0.42), b.CARD)
        tf = chip.text_frame
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        b.set_run(p.add_run(), lab, size=12, bold=True, color=b.GOLD, font=b.SANS)

    b.tb(s, Inches(0.7), Inches(6.15), Inches(6.4), Inches(0.4),
         f"{b.WEB}    ·    {b.PHONE}", size=13, color=b.CREAM, font=b.SANS)
    return s


def s_problem(prs, story):
    s = b.blank(prs)
    b.gold_bar(s)
    b.tb(s, Inches(0.55), Inches(0.55), Inches(8), Inches(0.3),
         "UNIFIED DIGITAL PRESENCE", size=12, bold=True, color=b.GOLD, font=b.SANS)
    b.tb(s, Inches(0.55), Inches(0.95), Inches(8.6 if story else 12.2), Inches(1.5),
         "Local customers decide online.\nA split footprint sends them away.",
         size=28, bold=True, color=b.CREAM, font=b.SERIF)
    if story:
        b.ss_pic(s, "connected.png", Inches(9.35), Inches(0.35), height=Inches(2.4))

    pains = [
        ("Inconsistent brand", "Website, social, and ads that do not match erode trust before the sale is asked for."),
        ("Wasted ad spend", "Clicks land on a story that does not hold. You pay twice — for traffic, then for confusion."),
        ("Missed lifetime value", "Each touchpoint competes for attention instead of building one persuasive brand story."),
    ]
    for i, (t, body) in enumerate(pains):
        left = Inches(0.55 + i * 4.2)
        b.rrect(s, left, Inches(3.45), Inches(3.95), Inches(3.25), b.CARD)
        b.rect(s, left, Inches(3.45), Inches(0.09), Inches(3.25), b.GOLD)
        b.tb(s, left + Inches(0.35), Inches(3.7), Inches(3.4), Inches(0.7),
             t, size=18, bold=True, color=b.CREAM, font=b.SERIF)
        b.tb(s, left + Inches(0.35), Inches(4.5), Inches(3.4), Inches(1.8),
             body, size=14, color=b.MUTED, font=b.SANS)
    foot(s, 2, story)
    return s


def s_partner(prs, story):
    s = b.blank(prs)
    b.gold_bar(s)
    b.tb(s, Inches(0.55), Inches(0.52), Inches(12), Inches(0.28),
         "UNIFIED DIGITAL PARTNER", size=12, bold=True, color=b.GOLD, font=b.SANS)
    b.tb(s, Inches(0.55), Inches(0.85), Inches(8.5), Inches(0.95),
         "One studio for design, ads, and video.",
         size=26, bold=True, color=b.CREAM, font=b.SERIF)
    if story:
        b.ss_pic(s, "collaboration.png", Inches(10.15), Inches(0.12), height=Inches(1.7))

    cards = [
        ("Design & branding", "Look and language that hold from a storefront board to a Reel."),
        ("Paid media", "Meta, Google, and YouTube as one mix — awareness, intent, return visits."),
        ("Video", "Edits built for the platform you will actually post. Fewer handoffs."),
    ]
    for i, (t, body) in enumerate(cards):
        left = Inches(0.55 + i * 4.2)
        b.rrect(s, left, Inches(2.0), Inches(3.95), Inches(2.35), b.CARD)
        b.tb(s, left + Inches(0.28), Inches(2.18), Inches(3.4), Inches(0.45),
             t, size=16, bold=True, color=b.GOLD, font=b.SERIF)
        b.tb(s, left + Inches(0.28), Inches(2.7), Inches(3.4), Inches(1.4),
             body, size=13, color=b.MUTED, font=b.SANS)

    women_panel(s, Inches(0.55), Inches(4.55), Inches(12.2), Inches(2.15))
    foot(s, 3, story)
    return s


def s_stack(prs, story):
    s = b.blank(prs)
    b.gold_bar(s)
    b.tb(s, Inches(0.55), Inches(0.5), Inches(12), Inches(0.28),
         "WHAT YOU GET", size=12, bold=True, color=b.GOLD, font=b.SANS)
    b.tb(s, Inches(0.55), Inches(0.82), Inches(12), Inches(0.55),
         "A complete growth stack. Not nine separate vendors.",
         size=22, bold=True, color=b.CREAM, font=b.SERIF)

    items = [
        ("Social media marketing", "A posting rhythm that sounds like the brand."),
        ("Meta ads", "Instagram and Facebook that find people — then bring them back."),
        ("Google ads", "Capture demand when someone is already looking."),
        ("Video editing", "Reels, ads, YouTube, walkthroughs — ready to post."),
        ("Graphic design", "Assets that hold on a phone and a storefront board."),
        ("Brand identity", "Colour, type, tone — so nobody guesses."),
        ("YouTube management", "Channel shape and a cadence people return to."),
        ("Content creation", "Scripts and stills in your customer’s language."),
        ("Business branding", "The full face of the shop, board to digital."),
    ]
    for i, (t, body) in enumerate(items):
        col, row = i % 3, i // 3
        left = Inches(0.55 + col * 4.2)
        top = Inches(1.55 + row * 1.28)
        b.rrect(s, left, top, Inches(3.95), Inches(1.18), b.CARD)
        b.tb(s, left + Inches(0.22), top + Inches(0.12), Inches(3.5), Inches(0.32),
             t, size=13, bold=True, color=b.GOLD, font=b.SANS)
        b.tb(s, left + Inches(0.22), top + Inches(0.46), Inches(3.5), Inches(0.6),
             body, size=12, color=b.MUTED, font=b.SANS)

    cats = [
        "Retail", "Restaurants", "Clinics", "Schools", "Real estate",
        "Fashion", "Startups", "Local shops", "Personal brands", "Services",
    ]
    for i, c in enumerate(cats):
        left = Inches(0.55 + i * 1.27)
        chip = b.rrect(s, left, Inches(5.55), Inches(1.2), Inches(0.42), b.CARD)
        tf = chip.text_frame
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        b.set_run(p.add_run(), c, size=10, bold=True, color=b.CREAM, font=b.SANS)

    b.tb(s, Inches(0.55), Inches(6.12), Inches(12.2), Inches(0.7),
         "Same craft, fitted to how your category buys — local targeting, mobile-first film, brand design.",
         size=13, color=b.MUTED, font=b.SANS)
    foot(s, 4, story)
    return s


def s_process(prs, story):
    s = b.blank(prs)
    b.gold_bar(s)
    b.tb(s, Inches(0.55), Inches(0.55), Inches(12), Inches(0.28),
         "HOW WE WORK", size=12, bold=True, color=b.GOLD, font=b.SANS)
    b.tb(s, Inches(0.55), Inches(0.92), Inches(8.5), Inches(0.7),
         "Four steps. Then we make.",
         size=28, bold=True, color=b.CREAM, font=b.SERIF)
    if story:
        b.ss_pic(s, "business-plan.png", Inches(10.25), Inches(0.15), height=Inches(1.7))

    steps = [
        ("01", "Understand briefs", "Requirements and success metrics — so expectations match from day one."),
        ("02", "Market research", "Audience, competitors, and the gap we can actually occupy."),
        ("03", "Strategy planning", "Channels, messaging, timing — a plan built to move numbers."),
        ("04", "Creative design", "Assets that reflect the strategy. Then we run ads and ship the films."),
    ]
    for i, (n, t, body) in enumerate(steps):
        top = Inches(1.95 + i * 1.22)
        b.rrect(s, Inches(0.55), top, Inches(12.2), Inches(1.1), b.CARD)
        b.rrect(s, Inches(0.75), top + Inches(0.22), Inches(0.85), Inches(0.66), b.GOLD)
        b.tb(s, Inches(0.75), top + Inches(0.28), Inches(0.85), Inches(0.55),
             n, size=16, bold=True, color=b.INK, align=PP_ALIGN.CENTER, font=b.SANS, anchor=MSO_ANCHOR.MIDDLE)
        b.tb(s, Inches(1.85), top + Inches(0.18), Inches(4.3), Inches(0.75),
             t, size=18, bold=True, color=b.CREAM, font=b.SERIF, anchor=MSO_ANCHOR.MIDDLE)
        b.tb(s, Inches(6.3), top + Inches(0.18), Inches(6.1), Inches(0.75),
             body, size=14, color=b.MUTED, font=b.SANS, anchor=MSO_ANCHOR.MIDDLE)
    foot(s, 5, story)
    return s


def s_results(prs, story):
    s = b.blank(prs)
    b.gold_bar(s)
    b.tb(s, Inches(0.55), Inches(0.55), Inches(12), Inches(0.28),
         "IMPACT SNAPSHOT", size=12, bold=True, color=b.GOLD, font=b.SANS)
    b.tb(s, Inches(0.55), Inches(0.92), Inches(12), Inches(0.7),
         "How optimisation shows up in the numbers.",
         size=24, bold=True, color=b.CREAM, font=b.SERIF)
    if story:
        b.ss_pic(s, "visual-data.png", Inches(10.25), Inches(0.12), height=Inches(1.55))

    metrics = [
        ("3×", "Monthly leads in 90 days", "Starter engagement — when creative, offer, and targeting point the same way."),
        ("−30%", "Average cost per lead", "Waste comes out as the funnel learns. Spend gets quieter and sharper."),
        ("+2–4 pp", "Landing-page conversion", "Uplift from stronger creative and tighter optimisation."),
    ]
    for i, (n, t, body) in enumerate(metrics):
        left = Inches(0.55 + i * 4.2)
        b.rrect(s, left, Inches(2.15), Inches(3.95), Inches(4.5), b.CARD)
        b.tb(s, left + Inches(0.3), Inches(2.45), Inches(3.35), Inches(1.15),
             n, size=42, bold=True, color=b.GOLD, font=b.SERIF)
        b.tb(s, left + Inches(0.3), Inches(3.75), Inches(3.35), Inches(0.7),
             t, size=16, bold=True, color=b.CREAM, font=b.SANS)
        b.tb(s, left + Inches(0.3), Inches(4.55), Inches(3.35), Inches(1.6),
             body, size=14, color=b.MUTED, font=b.SANS)
    foot(s, 6, story)
    return s


def s_packages(prs, story):
    s = b.blank(prs)
    b.gold_bar(s)
    b.tb(s, Inches(0.55), Inches(0.55), Inches(12), Inches(0.28),
         "WORKING TOGETHER", size=12, bold=True, color=b.GOLD, font=b.SANS)
    b.tb(s, Inches(0.55), Inches(0.92), Inches(12), Inches(0.75),
         "A clear monthly partnership.\nAd spend stays in your account.",
         size=26, bold=True, color=b.CREAM, font=b.SERIF)

    b.rrect(s, Inches(0.55), Inches(2.05), Inches(6.0), Inches(4.6), b.CARD)
    b.tb(s, Inches(0.85), Inches(2.3), Inches(5.4), Inches(0.32),
         "OUR SERVICE CHARGE", size=12, bold=True, color=b.GOLD, font=b.SANS)
    b.tb(s, Inches(0.85), Inches(2.7), Inches(5.4), Inches(0.65),
         "₹8,000 / month", size=28, bold=True, color=b.CREAM, font=b.SERIF)
    b.tb(s, Inches(0.85), Inches(3.5), Inches(5.4), Inches(2.7),
         "Audience research, creative, copy, campaign setup, daily monitoring, and a report you can read.\n\nWe run the ads. You keep the results — and the media account.",
         size=15, color=b.MUTED, font=b.SANS)

    b.rrect(s, Inches(6.8), Inches(2.05), Inches(6.0), Inches(4.6), b.CARD)
    b.tb(s, Inches(7.1), Inches(2.3), Inches(5.4), Inches(0.32),
         "DAILY AD BUDGET  ·  PLATFORM FEE", size=12, bold=True, color=b.GOLD, font=b.SANS)
    b.tb(s, Inches(7.1), Inches(2.75), Inches(5.4), Inches(0.5),
         "You choose the fuel.", size=20, bold=True, color=b.CREAM, font=b.SERIF)
    for i, (name, amt) in enumerate([
        ("Silver", "₹300 / day + GST"),
        ("Gold", "₹500 / day + GST"),
        ("Diamond", "₹1,000 / day + GST"),
    ]):
        top = Inches(3.5 + i * 0.9)
        b.tb(s, Inches(7.1), top, Inches(2.1), Inches(0.7),
             name, size=18, bold=True, color=b.GOLD, font=b.SERIF, anchor=MSO_ANCHOR.MIDDLE)
        b.tb(s, Inches(9.3), top, Inches(3.1), Inches(0.7),
             amt, size=16, bold=True, color=b.CREAM, font=b.SANS, anchor=MSO_ANCHOR.MIDDLE)
    foot(s, 7, story)
    return s


def place_video(s, media, poster, vw, vh, left, top, max_w, max_h):
    w, h = b.fit_video_box(vw, vh, max_w, max_h)
    b.rrect(s, left - Inches(0.08), top - Inches(0.08), Emu(w) + Inches(0.16), Emu(h) + Inches(0.16), b.CARD)
    movie = b.add_video(s, media, poster, left, top, Emu(w), Emu(h))
    return movie, Emu(w), Emu(h)


def s_retail(prs, story):
    s = b.blank(prs)
    b.gold_bar(s)
    b.tb(s, Inches(0.55), Inches(0.48), Inches(12), Inches(0.26),
         "WORK SAMPLE  ·  RETAIL", size=12, bold=True, color=b.GOLD, font=b.SANS)
    b.tb(s, Inches(0.55), Inches(0.78), Inches(7.4), Inches(0.45),
         "Before the cut. After the edit.", size=22, bold=True, color=b.CREAM, font=b.SERIF)

    shots = [
        (b.MEDIA / "image4.jpeg", "Shop floor"),
        (b.MEDIA / "image5.jpeg", "Product"),
        (b.MEDIA / "image6.jpeg", "Inventory"),
    ]
    for i, (path, cap) in enumerate(shots):
        top = Inches(1.4 + i * 1.85)
        b.rrect(s, Inches(0.5), top, Inches(4.35), Inches(1.72), b.CARD)
        try:
            s.shapes.add_picture(str(path), Inches(0.62), top + Inches(0.1), width=Inches(2.55), height=Inches(1.52))
        except Exception:
            pass
        b.tb(s, Inches(3.25), top + Inches(0.55), Inches(1.45), Inches(0.6),
             cap, size=12, color=b.MUTED, font=b.SANS, anchor=MSO_ANCHOR.MIDDLE)

    movie, _, h = place_video(
        s, "media1.mp4", "poster1.jpg", 474, 850,
        Inches(8.55), Inches(1.35), Inches(3.15), Inches(5.15),
    )
    b.tb(s, Inches(5.15), Inches(1.4), Inches(3.1), Inches(1.6),
         "Same shop floor. Pace, grade, and titles built for the phone.",
         size=13, color=b.MUTED, font=b.SANS)
    foot(s, 8, story)
    return s


def s_ai_lifestyle(prs, story):
    s = b.blank(prs)
    b.gold_bar(s)
    b.tb(s, Inches(0.55), Inches(0.45), Inches(12), Inches(0.25),
         "WORK SAMPLE  ·  FILM", size=12, bold=True, color=b.GOLD, font=b.SANS)

    b.tb(s, Inches(0.5), Inches(0.78), Inches(7.4), Inches(0.38),
         "AI video editing", size=18, bold=True, color=b.CREAM, font=b.SERIF)
    movie2, w2, h2 = place_video(
        s, "media2.mp4", "poster2.jpg", 848, 478,
        Inches(0.5), Inches(1.25), Inches(7.55), Inches(4.35),
    )
    b.tb(s, Inches(0.5), Inches(6.55), Inches(7.5), Inches(0.4),
         "Human taste on top of faster tools.", size=12, color=b.MUTED, font=b.SANS)

    b.tb(s, Inches(8.4), Inches(0.78), Inches(4.4), Inches(0.38),
         "Lifestyle film", size=18, bold=True, color=b.CREAM, font=b.SERIF)
    movie3, _, _ = place_video(
        s, "media3.mp4", "poster3.jpg", 480, 864,
        Inches(9.55), Inches(1.25), Inches(2.85), Inches(5.15),
    )
    foot(s, 9, story)
    return s


def s_property(prs, story):
    s = b.blank(prs)
    b.gold_bar(s)
    b.tb(s, Inches(0.55), Inches(0.45), Inches(12), Inches(0.25),
         "WORK SAMPLE  ·  PROPERTY", size=12, bold=True, color=b.GOLD, font=b.SANS)

    b.tb(s, Inches(0.5), Inches(0.78), Inches(7.2), Inches(0.38),
         "Real estate film", size=18, bold=True, color=b.CREAM, font=b.SERIF)
    movie4, _, _ = place_video(
        s, "media4.mp4", "poster4.jpg", 848, 478,
        Inches(0.5), Inches(1.25), Inches(7.4), Inches(4.25),
    )
    b.tb(s, Inches(0.5), Inches(6.55), Inches(7.3), Inches(0.4),
         "A life people can already walk into.", size=12, color=b.MUTED, font=b.SANS)

    b.tb(s, Inches(8.2), Inches(0.78), Inches(4.6), Inches(0.38),
         "Property story", size=18, bold=True, color=b.CREAM, font=b.SERIF)
    movie5, _, _ = place_video(
        s, "media5.mp4", "poster5.jpg", 368, 368,
        Inches(8.35), Inches(1.25), Inches(4.4), Inches(4.4),
    )
    foot(s, 10, story)
    return s


def s_motion(prs, story):
    s = b.blank(prs)
    b.gold_bar(s)
    b.tb(s, Inches(0.55), Inches(0.48), Inches(12), Inches(0.26),
         "WORK SAMPLE  ·  MOTION", size=12, bold=True, color=b.GOLD, font=b.SANS)
    b.tb(s, Inches(0.55), Inches(0.78), Inches(12), Inches(0.45),
         "Brand film — when the story needs more than a camera.",
         size=22, bold=True, color=b.CREAM, font=b.SERIF)
    movie, _, _ = place_video(
        s, "media6.mp4", "poster6.jpg", 848, 478,
        Inches(1.45), Inches(1.4), Inches(10.4), Inches(4.85),
    )
    foot(s, 11, story)
    return s


def s_cta(prs, story):
    s = b.blank(prs)
    b.rect(s, 0, 0, Inches(0.18), b.H, b.GOLD)
    b.gold_bar(s, Inches(0.7), Inches(0.55), Inches(1.4))
    b.tb(s, Inches(0.7), Inches(0.75), Inches(7.4), Inches(0.28),
         "GROWTH AUDIT", size=12, bold=True, color=b.GOLD, font=b.SANS)
    b.tb(s, Inches(0.7), Inches(1.15), Inches(7.5), Inches(1.55),
         "Thirty minutes.\nA 90-day plan in 48 hours.",
         size=28, bold=True, color=b.CREAM, font=b.SERIF)
    b.tb(s, Inches(0.7), Inches(2.85), Inches(7.2), Inches(0.85),
         "We uncover the tight wins, then send a tailored plan and a starter package aligned to your budget and market.",
         size=15, color=b.MUTED, font=b.SANS)

    btn = b.rrect(s, Inches(0.7), Inches(3.85), Inches(4.7), Inches(0.65), b.GOLD)
    btn.click_action.hyperlink.address = b.WA
    tf = btn.text_frame
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    b.set_run(p.add_run(), "Book the audit  →  " + b.PHONE, size=15, bold=True, color=b.INK, font=b.SANS)

    b.tb(s, Inches(0.7), Inches(4.65), Inches(7.2), Inches(0.7),
         f"{b.WEB}    ·    {b.MAIL}", size=15, color=b.CREAM, font=b.SANS)

    if story:
        b.ss_pic(s, "contact-us.png", Inches(8.45), Inches(1.15), width=Inches(4.4))
    else:
        b.rrect(s, Inches(8.5), Inches(1.3), Inches(4.2), Inches(4.0), b.CARD)
        b.tb(s, Inches(8.8), Inches(1.55), Inches(3.6), Inches(0.35),
             "WHAT YOU GAIN", size=12, bold=True, color=b.GOLD, font=b.SANS)
        for i, line in enumerate([
            "A 90-day plan you can act on",
            "High-impact next steps",
            "A starter package in 48 hours",
            "Grounded in your brand and market",
        ]):
            b.tb(s, Inches(8.8), Inches(2.1 + i * 0.7), Inches(3.6), Inches(0.6),
                 f"0{i+1}    {line}", size=14, color=b.CREAM, font=b.SANS)
    return s


def build(story: bool) -> Presentation:
    prs = Presentation()
    prs.slide_width = b.W
    prs.slide_height = b.H
    s_cover(prs, story)
    s_problem(prs, story)
    s_partner(prs, story)
    s_stack(prs, story)
    s_process(prs, story)
    s_results(prs, story)
    s_packages(prs, story)
    s_retail(prs, story)
    s_ai_lifestyle(prs, story)
    s_property(prs, story)
    s_motion(prs, story)
    s_cta(prs, story)
    prs.core_properties.title = "Sneha Digital Hub — Meeting deck"
    prs.core_properties.author = "Sneha Digital Hub"
    prs.core_properties.subject = "Women at the centre. Creative digital work that grows the business."
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
