#!/usr/bin/env python3
"""Sneha Digital Hub — client pitch, redesigned from the original deck.

Content follows the source presentation (unified presence, one partner,
offerings, video flow, ads timeline, proof, videos, growth audit).
Filename of the source file is ignored.

Writes:
  ../Sneha_Digital_Hub_Pitch.pptx
  ../Sneha_Digital_Hub_Pitch_Storyset.pptx
"""

from pathlib import Path

from lxml import etree
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.oxml import parse_xml
from pptx.oxml.ns import nsdecls, qn
from pptx.util import Emu, Inches, Pt

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
SS = ROOT / "storyset" / "clear"
MEDIA = ROOT / "media"
POSTERS = ROOT / "posters"

OUT_PLAIN = REPO / "Sneha_Digital_Hub_Pitch.pptx"
OUT_STORY = REPO / "Sneha_Digital_Hub_Pitch_Storyset.pptx"

INK = RGBColor(0x0B, 0x0F, 0x14)
PANEL = RGBColor(0x12, 0x18, 0x22)
CARD = RGBColor(0x18, 0x20, 0x2C)
GOLD = RGBColor(0xD4, 0xAF, 0x37)
CREAM = RGBColor(0xF4, 0xEF, 0xE4)
MUTED = RGBColor(0x9A, 0xA3, 0xAE)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

PHONE = "+91 95508 37035"
WEB = "www.snehadigitals.com"
MAIL = "info@snehadigitals.com"
WA = "https://wa.me/919550837035?text=Hi%2C%20I%20want%20a%2030-minute%20growth%20audit"

W = Inches(13.333)
H = Inches(7.5)
TOTAL = 21

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


def footer(slide, page, story=False, total=None):
    total = TOTAL if total is None else total
    rect(slide, 0, Inches(7.28), W, Inches(0.22), PANEL)
    tb(slide, Inches(0.55), Inches(7.28), Inches(7.5), Inches(0.22),
       "SNEHA DIGITAL HUB", size=9, color=MUTED, font=SANS, anchor=MSO_ANCHOR.MIDDLE)
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
    max_w, max_h = int(max_w), int(max_h)
    scale = min(max_w / vw, max_h / vh)
    return int(vw * scale), int(vh * scale)


VIDEO_MS = {
    "media1.mp4": 28665,
    "media2.mp4": 37840,
    "media3.mp4": 37440,
    "media4.mp4": 60300,
    "media5.mp4": 53049,
    "media6.mp4": 60672,
}


def add_video(slide, media_name, poster_name, left, top, width, height):
    return slide.shapes.add_movie(
        str(MEDIA / media_name),
        left, top, width, height,
        poster_frame_image=str(POSTERS / poster_name),
        mime_type="video/mp4",
    )


def _next_ctn_ids(sld, count):
    ids = [int(x) for x in sld.xpath(".//p:cTn/@id")]
    start = (max(ids) if ids else 1) + 1
    return list(range(start, start + count))


def wire_click_to_play(slide, button, video, duration_ms):
    """Make a shape start the video on click (PowerPoint Slide Show + click action)."""
    sld = slide._element
    child = sld.get_or_add_childTnLst()
    btn_id = button.shape_id
    vid_id = video.shape_id
    i8, i9, i10, i11, i12 = _next_ctn_ids(sld, 5)
    xml = (
        f'<p:seq {nsdecls("p")} concurrent="1" nextAc="seek">'
        f'  <p:cTn id="{i8}" restart="whenNotActive" fill="hold"'
        f'        evtFilter="cancelBubble" nodeType="interactiveSeq">'
        f"    <p:stCondLst>"
        f'      <p:cond evt="onClick" delay="0">'
        f"        <p:tgtEl><p:spTgt spid=\"{btn_id}\"/></p:tgtEl>"
        f"      </p:cond>"
        f"    </p:stCondLst>"
        f'    <p:endSync evt="end" delay="0"><p:rtn val="all"/></p:endSync>'
        f"    <p:childTnLst>"
        f"      <p:par>"
        f'        <p:cTn id="{i9}" fill="hold">'
        f"          <p:stCondLst><p:cond delay=\"0\"/></p:stCondLst>"
        f"          <p:childTnLst>"
        f"            <p:par>"
        f'              <p:cTn id="{i10}" fill="hold">'
        f"                <p:stCondLst><p:cond delay=\"0\"/></p:stCondLst>"
        f"                <p:childTnLst>"
        f"                  <p:par>"
        f'                    <p:cTn id="{i11}" presetID="1" presetClass="mediacall"'
        f'                          presetSubtype="0" fill="hold" nodeType="clickEffect">'
        f"                      <p:stCondLst><p:cond delay=\"0\"/></p:stCondLst>"
        f"                      <p:childTnLst>"
        f'                        <p:cmd type="call" cmd="playFrom(0.0)">'
        f"                          <p:cBhvr>"
        f'                            <p:cTn id="{i12}" dur="{int(duration_ms)}" fill="hold"/>'
        f'                            <p:tgtEl><p:spTgt spid="{vid_id}"/></p:tgtEl>'
        f"                          </p:cBhvr>"
        f"                        </p:cmd>"
        f"                      </p:childTnLst>"
        f"                    </p:cTn>"
        f"                  </p:par>"
        f"                </p:childTnLst>"
        f"              </p:cTn>"
        f"            </p:par>"
        f"          </p:childTnLst>"
        f"        </p:cTn>"
        f"      </p:par>"
        f"    </p:childTnLst>"
        f"  </p:cTn>"
        f"  <p:nextCondLst>"
        f'    <p:cond evt="onClick" delay="0">'
        f"      <p:tgtEl><p:spTgt spid=\"{btn_id}\"/></p:tgtEl>"
        f"    </p:cond>"
        f"  </p:nextCondLst>"
        f"</p:seq>"
    )
    child.append(parse_xml(xml))

    cNvPr = button._element.nvSpPr.cNvPr
    if cNvPr.find(qn("a:hlinkClick")) is None:
        cNvPr.append(
            parse_xml(
                f'<a:hlinkClick {nsdecls("a", "r")} r:id="" '
                f'action="ppaction://noaction" tooltip="Play video"/>'
            )
        )


def play_hint(slide, left, top, video, media_name, width=Inches(2.4)):
    chip = rrect(slide, left, top, width, Inches(0.36), GOLD)
    tf = chip.text_frame
    tf.word_wrap = False
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    set_run(p.add_run(), "▶   Click to play", size=11, bold=True, color=INK, font=SANS)
    wire_click_to_play(slide, chip, video, VIDEO_MS[media_name])
    return chip


# ─── slides (mapped to original deck content) ───────────────────


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

    tb(s, Inches(0.7), Inches(1.7), Inches(6.5), Inches(2.2),
       "Creative digital work\nthat grows the\nbusiness.",
       size=36, bold=True, color=CREAM, font=SERIF)

    tb(s, Inches(0.7), Inches(4.35), Inches(6.3), Inches(1.0),
       "Design, ads, and video — one team, one story,\nresults you can measure.",
       size=16, color=MUTED, font=SANS)

    labels = ["DESIGN", "ADS", "VIDEO"]
    for i, lab in enumerate(labels):
        chip = rrect(s, Inches(0.7 + i * 1.85), Inches(5.7), Inches(1.7), Inches(0.42), CARD)
        tf = chip.text_frame
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.CENTER
        set_run(p.add_run(), lab, size=12, bold=True, color=GOLD, font=SANS)

    tb(s, Inches(0.7), Inches(6.4), Inches(6.4), Inches(0.4),
       f"{WEB}    ·    {PHONE}", size=13, color=CREAM, font=SANS)
    return s


def s_problem(prs, story):
    s = blank(prs)
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.55), Inches(8), Inches(0.3),
       "UNIFIED DIGITAL PRESENCE", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.95), Inches(8.6 if story else 12.2), Inches(1.6),
       "Local customers decide online.\nA split footprint sends them away.",
       size=28, bold=True, color=CREAM, font=SERIF)
    if story:
        ss_pic(s, "connected.png", Inches(9.35), Inches(0.35), height=Inches(2.55))

    pains = [
        ("Inconsistent brand", "Website, social, and ads that do not match erode trust before the sale is even asked for."),
        ("Wasted ad spend", "Clicks land on a story that does not hold. You pay twice — once for traffic, again for confusion."),
        ("Missed lifetime value", "Each touchpoint competes for attention instead of building one persuasive brand story."),
    ]
    for i, (t, b) in enumerate(pains):
        left = Inches(0.55 + i * 4.2)
        rrect(s, left, Inches(3.55), Inches(3.95), Inches(3.15), CARD)
        rect(s, left, Inches(3.55), Inches(0.09), Inches(3.15), GOLD)
        tb(s, left + Inches(0.35), Inches(3.8), Inches(3.4), Inches(0.35),
           f"0{i+1}", size=14, bold=True, color=GOLD, font=SANS)
        tb(s, left + Inches(0.35), Inches(4.2), Inches(3.4), Inches(0.7),
           t, size=18, bold=True, color=CREAM, font=SERIF)
        tb(s, left + Inches(0.35), Inches(5.0), Inches(3.4), Inches(1.35),
           b, size=14, color=MUTED, font=SANS)
    footer(s, 2, story=story)
    return s


def s_partner(prs, story):
    s = blank(prs)
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.55), Inches(12), Inches(0.3),
       "UNIFIED DIGITAL PARTNER", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.92), Inches(8.4), Inches(1.15),
       "One studio for design,\nads, and video.",
       size=30, bold=True, color=CREAM, font=SERIF)
    if story:
        ss_pic(s, "collaboration.png", Inches(9.9), Inches(0.2), height=Inches(1.9))

    tb(s, Inches(0.55), Inches(2.25), Inches(12.2), Inches(0.7),
       "Sneha Digital Hub coordinates social marketing, Meta and Google campaigns, professional video editing, and branding — so the message stays consistent across every channel.",
       size=15, color=MUTED, font=SANS)

    cards = [
        ("Design & branding", "Look, language, and assets that hold from a storefront board to a Reel."),
        ("Paid media", "Meta, Google, and YouTube run as one mix — awareness, intent, and the return visit."),
        ("Video", "Edits built for the platform you will actually post on. Fewer handoffs. Faster calls."),
    ]
    arts = ["designer.png", "online-ads.png", "videographer.png"]
    for i, ((t, b), art) in enumerate(zip(cards, arts)):
        left = Inches(0.55 + i * 4.2)
        rrect(s, left, Inches(3.15), Inches(3.95), Inches(3.55), CARD)
        if story:
            ss_pic(s, art, left + Inches(1.05), Inches(3.25), width=Inches(1.85))
            tt, bt = Inches(5.1), Inches(5.55)
        else:
            tt, bt = Inches(3.45), Inches(4.15)
        tb(s, left + Inches(0.3), tt, Inches(3.35), Inches(0.45),
           t, size=16, bold=True, color=GOLD, font=SERIF)
        tb(s, left + Inches(0.3), bt, Inches(3.35), Inches(0.95),
           b, size=13, color=MUTED, font=SANS)
    footer(s, 3, story=story)
    return s


def s_mission(prs, story):
    s = blank(prs)
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.55), Inches(12), Inches(0.3),
       "MISSION WITH IMPACT", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.95), Inches(8.6), Inches(1.2),
       "Growth for your business.\nOpportunity in the work.",
       size=30, bold=True, color=CREAM, font=SERIF)
    if story:
        ss_pic(s, "team-work.png", Inches(9.7), Inches(0.2), height=Inches(2.1))

    points = [
        ("Business impact", "Marketing that is built to grow sales — innovative where it helps, practical where it must."),
        ("Ethical delivery", "Transparent practices. Reliable timelines. You always know what ran and why."),
        ("Women at the centre", "We create career opportunities and financial independence for women, and fold inclusive leadership into every project."),
    ]
    for i, (t, b) in enumerate(points):
        left = Inches(0.55 + i * 4.2)
        rrect(s, left, Inches(3.0), Inches(3.95), Inches(3.7), CARD)
        rect(s, left, Inches(3.0), Inches(0.09), Inches(3.7), GOLD)
        tb(s, left + Inches(0.35), Inches(3.3), Inches(3.4), Inches(0.7),
           t, size=20, bold=True, color=CREAM, font=SERIF)
        tb(s, left + Inches(0.35), Inches(4.15), Inches(3.4), Inches(2.1),
           b, size=15, color=MUTED, font=SANS)
    footer(s, 4, story=story)
    return s


def s_stack(prs, story):
    s = blank(prs)
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.55), Inches(12), Inches(0.3),
       "END-TO-END OFFERINGS", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.92), Inches(8.6), Inches(1.05),
       "A complete growth stack.\nNot nine separate vendors.",
       size=28, bold=True, color=CREAM, font=SERIF)
    if story:
        ss_pic(s, "creative-team.png", Inches(10.35), Inches(0.18), height=Inches(1.55))

    items = [
        ("Social media marketing", "A posting rhythm that sounds like the brand, not a leftover calendar."),
        ("Meta ads", "Instagram and Facebook that find the right people — then bring them back."),
        ("Google ads", "Capture demand when someone is already looking for what you sell."),
        ("Video editing", "Shoot-to-export craft for Reels, ads, YouTube, and walkthroughs."),
        ("Graphic design", "Assets that hold up on a phone and on a storefront board."),
        ("Brand identity", "Colour, type, and tone — so staff and vendors stop guessing."),
        ("YouTube management", "Channel shape, packaging, and a cadence people return to."),
        ("Content creation", "Scripts, stills, and lines written for how your customer actually talks."),
        ("Business branding", "The full face of the shop: from board to premium digital."),
    ]
    for i, (t, b) in enumerate(items):
        col, row = i % 3, i // 3
        left = Inches(0.55 + col * 4.2)
        top = Inches(2.25 + row * 1.58)
        rrect(s, left, top, Inches(3.95), Inches(1.45), CARD)
        tb(s, left + Inches(0.25), top + Inches(0.16), Inches(3.45), Inches(0.38),
           t, size=14, bold=True, color=GOLD, font=SANS)
        tb(s, left + Inches(0.25), top + Inches(0.55), Inches(3.45), Inches(0.75),
           b, size=12, color=MUTED, font=SANS)
    footer(s, 5, story=story)
    return s


def s_video_flow(prs, story):
    s = blank(prs)
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.55), Inches(12), Inches(0.3),
       "VIDEO EDIT FLOW", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.92), Inches(8.4), Inches(0.9),
       "From brief to a file you can post.",
       size=28, bold=True, color=CREAM, font=SERIF)
    if story:
        ss_pic(s, "video-files.png", Inches(10.25), Inches(0.12), height=Inches(1.7))

    steps = [
        ("01", "Brief", "Objectives and audience needs — so every cut serves engagement, not decoration."),
        ("02", "Story edit", "Shape the narrative around the core message. Viewers stay because the story holds."),
        ("03", "Transitions & pace", "Smooth cuts and rhythm tuned for Reels, ads, or longer films."),
        ("04", "Colour grading", "Mood and consistency that support the brand on every screen."),
        ("05", "Sound & subtitles", "A balanced mix, clear captions, and accessibility across formats."),
        ("06", "Final export", "Platform-ready files for YouTube, Reels, and ads — ready the same day."),
    ]
    for i, (n, t, b) in enumerate(steps):
        col, row = i % 3, i // 3
        left = Inches(0.55 + col * 4.2)
        top = Inches(2.35 + row * 2.3)
        rrect(s, left, top, Inches(3.95), Inches(2.1), CARD)
        tb(s, left + Inches(0.28), top + Inches(0.22), Inches(3.4), Inches(0.32),
           n, size=13, bold=True, color=GOLD, font=SANS)
        tb(s, left + Inches(0.28), top + Inches(0.55), Inches(3.4), Inches(0.42),
           t, size=18, bold=True, color=CREAM, font=SERIF)
        tb(s, left + Inches(0.28), top + Inches(1.05), Inches(3.4), Inches(0.85),
           b, size=13, color=MUTED, font=SANS)
    footer(s, 6, story=story)
    return s


def s_ads_timeline(prs, story):
    s = blank(prs)
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.55), Inches(12), Inches(0.3),
       "DIGITAL MARKETING TIMELINE", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.92), Inches(8.4), Inches(0.85),
       "How a campaign actually runs.",
       size=28, bold=True, color=CREAM, font=SERIF)
    if story:
        ss_pic(s, "dashboard.png", Inches(10.2), Inches(0.08), height=Inches(1.7))

    stages = [
        ("Research", "Audience segments, intents, and funnels — so creative and channels have a reason."),
        ("Concepting", "Ideas locked to those insights and to the brand, before a rupee of spend."),
        ("Setup", "Targeted Meta, Google, and YouTube campaigns. Precise audiences and placements."),
        ("Testing", "Controlled A/B tests on creatives, headlines, and CTAs. Winners earn budget."),
        ("Monitor", "ROAS, CPA, CTR in real time. Gaps flagged while there is still time to act."),
        ("Optimize", "Bids, budgets, and audiences iterated — lower CPA, higher impact."),
    ]
    for i, (t, b) in enumerate(stages):
        left = Inches(0.45 + i * 2.14)
        rrect(s, left, Inches(2.55), Inches(2.04), Inches(4.15), CARD)
        rect(s, left, Inches(2.55), Inches(2.04), Inches(0.08), GOLD)
        tb(s, left + Inches(0.12), Inches(2.8), Inches(1.8), Inches(0.3),
           f"0{i+1}", size=12, bold=True, color=GOLD, font=SANS)
        tb(s, left + Inches(0.12), Inches(3.15), Inches(1.8), Inches(0.95),
           t, size=16, bold=True, color=CREAM, font=SERIF)
        tb(s, left + Inches(0.12), Inches(4.15), Inches(1.8), Inches(2.2),
           b, size=12, color=MUTED, font=SANS)
    footer(s, 7, story=story)
    return s


def s_multichannel(prs, story):
    s = blank(prs)
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.55), Inches(12), Inches(0.3),
       "MULTI-CHANNEL WINS", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.95), Inches(12), Inches(0.85),
       "Meta and Google together.\nOne mix, not one bet.",
       size=28, bold=True, color=CREAM, font=SERIF)
    if story:
        ss_pic(s, "online-ads.png", Inches(10.15), Inches(0.15), height=Inches(1.7))

    rrect(s, Inches(0.55), Inches(2.3), Inches(7.85), Inches(4.4), CARD)
    tb(s, Inches(0.9), Inches(2.55), Inches(7.2), Inches(0.4),
       "THE MIX", size=12, bold=True, color=GOLD, font=SANS)
    rows = [
        ("Facebook / Instagram", "Social proof and remarketing. People see you where they already spend time."),
        ("Google Search", "High-intent leads — they typed the need. You should be the answer."),
        ("Display & YouTube", "Reach and memory. Stay in the room after the first click."),
    ]
    for i, (t, b) in enumerate(rows):
        top = Inches(3.1 + i * 1.1)
        tb(s, Inches(0.9), top, Inches(7.15), Inches(0.35),
           t, size=18, bold=True, color=CREAM, font=SERIF)
        tb(s, Inches(0.9), top + Inches(0.38), Inches(7.15), Inches(0.55),
           b, size=14, color=MUTED, font=SANS)

    rrect(s, Inches(8.65), Inches(2.3), Inches(4.15), Inches(4.4), CARD)
    tb(s, Inches(8.95), Inches(2.55), Inches(3.55), Inches(0.4),
       "ONE CHANNEL ALONE", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(8.95), Inches(3.15), Inches(3.55), Inches(3.1),
       "A single channel can spark interest. It rarely finishes the sale.\n\nYou miss intent signals, lose re-engagement, and conversion velocity slows.\n\nIntegrated channels accelerate it.",
       size=15, color=MUTED, font=SANS)
    footer(s, 8, story=story)
    return s


def s_risk(prs, story):
    s = blank(prs)
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.55), Inches(12), Inches(0.3),
       "REDUCE YOUR RISK", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.92), Inches(8.6), Inches(1.1),
       "An experienced team.\nA package that can grow.",
       size=30, bold=True, color=CREAM, font=SERIF)
    if story:
        ss_pic(s, "audit.png", Inches(10.1), Inches(0.15), height=Inches(1.8))

    points = [
        ("Professional creative", "Designs and strategies built for your business — not a template with your logo dropped in."),
        ("Fast, clear delivery", "Work moves at business speed. You see what shipped, not a status fog."),
        ("Transparent reporting", "Dedicated support focused on growth, so ROI is readable, not rumoured."),
        ("Affordable to start", "Packages scale with you. Lower upfront risk, aligned to the goal you named."),
    ]
    for i, (t, b) in enumerate(points):
        col, row = i % 2, i // 2
        left = Inches(0.55 + col * 6.35)
        top = Inches(2.5 + row * 2.2)
        rrect(s, left, top, Inches(6.1), Inches(2.0), CARD)
        tb(s, left + Inches(0.35), top + Inches(0.3), Inches(5.4), Inches(0.5),
           t, size=18, bold=True, color=GOLD, font=SERIF)
        tb(s, left + Inches(0.35), top + Inches(0.9), Inches(5.4), Inches(0.85),
           b, size=14, color=MUTED, font=SANS)
    footer(s, 9, story=story)
    return s


def s_process(prs, story):
    s = blank(prs)
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.55), Inches(12), Inches(0.3),
       "PROCESS CADENCE", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.92), Inches(8.5), Inches(0.9),
       "Four steps. Then we make.",
       size=30, bold=True, color=CREAM, font=SERIF)
    if story:
        ss_pic(s, "business-plan.png", Inches(10.25), Inches(0.12), height=Inches(1.65))

    steps = [
        ("01", "Understand briefs", "Clarify requirements and define success metrics so expectations match from day one."),
        ("02", "Market research", "Target audiences, competitors, and the gap we can actually occupy."),
        ("03", "Strategy planning", "Channels, messaging, and timing — a plan built to drive measurable growth."),
        ("04", "Creative design", "Assets and content that reflect the strategy and the brand. Then we run."),
    ]
    for i, (n, t, b) in enumerate(steps):
        top = Inches(2.2 + i * 1.2)
        rrect(s, Inches(0.55), top, Inches(12.2), Inches(1.08), CARD)
        rrect(s, Inches(0.75), top + Inches(0.22), Inches(0.85), Inches(0.64), GOLD)
        tb(s, Inches(0.75), top + Inches(0.28), Inches(0.85), Inches(0.52),
           n, size=16, bold=True, color=INK, align=PP_ALIGN.CENTER, font=SANS, anchor=MSO_ANCHOR.MIDDLE)
        tb(s, Inches(1.85), top + Inches(0.16), Inches(4.4), Inches(0.75),
           t, size=20, bold=True, color=CREAM, font=SERIF, anchor=MSO_ANCHOR.MIDDLE)
        tb(s, Inches(6.4), top + Inches(0.18), Inches(6.0), Inches(0.75),
           b, size=14, color=MUTED, font=SANS, anchor=MSO_ANCHOR.MIDDLE)
    footer(s, 10, story=story)
    return s


def s_industries(prs, story):
    s = blank(prs)
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.55), Inches(12), Inches(0.3),
       "INDUSTRY REACH", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.92), Inches(12), Inches(0.9),
       "The same craft, fitted to\nhow your category buys.",
       size=28, bold=True, color=CREAM, font=SERIF)

    cats = [
        "Retail & mobile stores", "Restaurants", "Hospitals & clinics",
        "Schools", "Real estate", "Fashion brands",
        "Startups", "Local businesses", "Personal brands", "Service businesses",
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
           "Local targeting, mobile-first experiences, compelling video, and brand design —\ncustomised for the size and dynamics of each industry.",
           size=16, color=MUTED, font=SANS)
    footer(s, 11, story=story)
    return s


def s_results(prs, story):
    s = blank(prs)
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.55), Inches(12), Inches(0.3),
       "IMPACT SNAPSHOT", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.95), Inches(12), Inches(0.85),
       "How optimisation shows up\nin the numbers.",
       size=28, bold=True, color=CREAM, font=SERIF)
    if story:
        ss_pic(s, "visual-data.png", Inches(10.25), Inches(0.08), height=Inches(1.65))

    metrics = [
        ("3×", "Monthly leads in 90 days", "Starter engagement — when creative, offer, and targeting finally point the same way."),
        ("−30%", "Average cost per lead", "Waste comes out as the funnel learns. Spend gets quieter and sharper."),
        ("+2–4 pp", "Landing-page conversion", "Uplift from stronger creative and tighter optimisation — fewer leaks between click and call."),
    ]
    for i, (n, t, b) in enumerate(metrics):
        left = Inches(0.55 + i * 4.2)
        rrect(s, left, Inches(2.35), Inches(3.95), Inches(3.8), CARD)
        tb(s, left + Inches(0.3), Inches(2.55), Inches(3.35), Inches(1.1),
           n, size=42, bold=True, color=GOLD, font=SERIF)
        tb(s, left + Inches(0.3), Inches(3.75), Inches(3.35), Inches(0.7),
           t, size=16, bold=True, color=CREAM, font=SANS)
        tb(s, left + Inches(0.3), Inches(4.5), Inches(3.35), Inches(1.3),
           b, size=13, color=MUTED, font=SANS)
    footer(s, 12, story=story)
    return s


def s_packages(prs, story):
    s = blank(prs)
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.55), Inches(12), Inches(0.3),
       "WORKING TOGETHER", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.95), Inches(12), Inches(0.85),
       "A clear monthly partnership.\nAd spend stays in your account.",
       size=28, bold=True, color=CREAM, font=SERIF)

    rrect(s, Inches(0.55), Inches(2.2), Inches(6.0), Inches(4.45), CARD)
    tb(s, Inches(0.85), Inches(2.45), Inches(5.4), Inches(0.35),
       "OUR SERVICE CHARGE", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.85), Inches(2.9), Inches(5.4), Inches(0.7),
       "₹8,000 / month", size=28, bold=True, color=CREAM, font=SERIF)
    tb(s, Inches(0.85), Inches(3.7), Inches(5.4), Inches(2.5),
       "Audience research, ad creative, copy, campaign setup, daily monitoring, and a performance report.\n\nWe run the ads. You keep the results — and the media account.",
       size=15, color=MUTED, font=SANS)

    rrect(s, Inches(6.8), Inches(2.2), Inches(6.0), Inches(4.45), CARD)
    tb(s, Inches(7.1), Inches(2.45), Inches(5.4), Inches(0.35),
       "DAILY AD BUDGET  ·  PLATFORM FEE", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(7.1), Inches(2.9), Inches(5.4), Inches(0.5),
       "You choose the fuel.", size=20, bold=True, color=CREAM, font=SERIF)

    bands = [
        ("Silver", "₹300 / day + GST"),
        ("Gold", "₹500 / day + GST"),
        ("Diamond", "₹1,000 / day + GST"),
    ]
    for i, (name, amt) in enumerate(bands):
        top = Inches(3.65 + i * 0.85)
        tb(s, Inches(7.1), top, Inches(2.0), Inches(0.65),
           name, size=18, bold=True, color=GOLD, font=SERIF, anchor=MSO_ANCHOR.MIDDLE)
        tb(s, Inches(9.2), top, Inches(3.2), Inches(0.65),
           amt, size=16, bold=True, color=CREAM, font=SANS, anchor=MSO_ANCHOR.MIDDLE)
    footer(s, 13, story=story)
    return s


def s_before(prs, story):
    s = blank(prs)
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.5), Inches(12), Inches(0.28),
       "BEFORE EDITING", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.82), Inches(12), Inches(0.55),
       "The raw stills we start from.", size=24, bold=True, color=CREAM, font=SERIF)

    shots = [
        (MEDIA / "image4.jpeg", "Shop floor"),
        (MEDIA / "image5.jpeg", "Product still"),
        (MEDIA / "image6.jpeg", "Inventory"),
    ]
    for i, (path, cap) in enumerate(shots):
        left = Inches(0.45 + i * 4.25)
        rrect(s, left, Inches(1.55), Inches(4.05), Inches(5.15), CARD)
        try:
            s.shapes.add_picture(str(path), left + Inches(0.18), Inches(1.73), width=Inches(3.7), height=Inches(4.15))
        except Exception:
            pass
        tb(s, left + Inches(0.18), Inches(5.95), Inches(3.7), Inches(0.5),
           cap, size=13, color=MUTED, font=SANS)
    footer(s, 14, story=story)
    return s


def _video_stage(s, title, kicker, body, page, story):
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.48), Inches(12), Inches(0.26),
       kicker, size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.78), Inches(7.2), Inches(0.5),
       title, size=22, bold=True, color=CREAM, font=SERIF)
    if body:
        tb(s, Inches(0.55), Inches(1.28), Inches(6.6), Inches(0.7),
           body, size=13, color=MUTED, font=SANS)
    footer(s, page, story=story)


def s_vid_vertical(prs, story, media, poster, vw, vh, title, kicker, body, page):
    s = blank(prs)
    _video_stage(s, title, kicker, body, page, story)
    max_h = Inches(5.15)
    max_w = Inches(3.05)
    w, h = fit_video_box(vw, vh, max_w, max_h)
    left = Inches(8.55)
    top = Inches(1.85)
    rrect(s, left - Inches(0.12), top - Inches(0.12), Emu(w) + Inches(0.24), Emu(h) + Inches(0.24), CARD)
    movie = add_video(s, media, poster, left, top, Emu(w), Emu(h))
    return s


def s_vid_landscape(prs, story, media, poster, vw, vh, title, kicker, body, page):
    s = blank(prs)
    _video_stage(s, title, kicker, "", page, story)
    max_w = Inches(10.4)
    max_h = Inches(4.85)
    w, h = fit_video_box(vw, vh, max_w, max_h)
    left = int((W - w) / 2)
    top = Inches(1.55)
    rrect(s, Emu(left) - Inches(0.1), top - Inches(0.1), Emu(w) + Inches(0.2), Emu(h) + Inches(0.2), CARD)
    movie = add_video(s, media, poster, Emu(left), top, Emu(w), Emu(h))
    if body:
        tb(s, Inches(3.0), Inches(6.7), Inches(9.7), Inches(0.4),
           body, size=13, color=MUTED, font=SANS)
    return s


def s_vid_square(prs, story, media, poster, vw, vh, title, kicker, body, page):
    s = blank(prs)
    gold_bar(s)
    tb(s, Inches(0.55), Inches(0.5), Inches(7.2), Inches(0.26),
       kicker, size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.55), Inches(0.85), Inches(6.8), Inches(0.7),
       title, size=24, bold=True, color=CREAM, font=SERIF)
    tb(s, Inches(0.55), Inches(1.65), Inches(6.6), Inches(1.4),
       body, size=15, color=MUTED, font=SANS)
    max_h = Inches(5.7)
    max_w = Inches(5.7)
    w, h = fit_video_box(vw, vh, max_w, max_h)
    left = Inches(7.55)
    top = Inches(1.15)
    rrect(s, left - Inches(0.12), top - Inches(0.12), Emu(w) + Inches(0.24), Emu(h) + Inches(0.24), CARD)
    movie = add_video(s, media, poster, left, top, Emu(w), Emu(h))
    footer(s, page, story=story)
    return s


def s_cta(prs, story):
    s = blank(prs)
    rect(s, 0, 0, Inches(0.18), H, GOLD)
    gold_bar(s, Inches(0.7), Inches(0.7), Inches(1.4))
    tb(s, Inches(0.7), Inches(1.0), Inches(7.4), Inches(0.3),
       "GROWTH AUDIT", size=12, bold=True, color=GOLD, font=SANS)
    tb(s, Inches(0.7), Inches(1.4), Inches(7.6), Inches(1.7),
       "Thirty minutes.\nA 90-day plan\nin 48 hours.",
       size=32, bold=True, color=CREAM, font=SERIF)
    tb(s, Inches(0.7), Inches(3.35), Inches(7.2), Inches(1.15),
       "We uncover the tight wins, then send a tailored plan and a starter package aligned to your budget and your market.",
       size=16, color=MUTED, font=SANS)

    btn = rrect(s, Inches(0.7), Inches(4.7), Inches(4.6), Inches(0.7), GOLD)
    btn.click_action.hyperlink.address = WA
    tf = btn.text_frame
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    set_run(p.add_run(), "Book the audit  →  " + PHONE, size=15, bold=True, color=INK, font=SANS)

    tb(s, Inches(0.7), Inches(5.6), Inches(7.2), Inches(1.0),
       f"{WEB}\n{MAIL}", size=16, color=CREAM, font=SANS)

    if story:
        ss_pic(s, "contact-us.png", Inches(8.35), Inches(0.85), width=Inches(4.5))
    else:
        rrect(s, Inches(8.55), Inches(1.5), Inches(4.15), Inches(4.4), CARD)
        tb(s, Inches(8.85), Inches(1.8), Inches(3.55), Inches(0.4),
           "WHAT YOU GAIN", size=12, bold=True, color=GOLD, font=SANS)
        for i, line in enumerate([
            "A 90-day plan you can act on",
            "High-impact next steps",
            "A starter package in 48 hours",
            "Grounded in your brand and market",
        ]):
            tb(s, Inches(8.85), Inches(2.4 + i * 0.7), Inches(3.55), Inches(0.6),
               f"0{i+1}    {line}", size=15, color=CREAM, font=SANS)

    tb(s, Inches(0.7), Inches(6.75), Inches(12), Inches(0.35),
       "Sneha Digital Hub  ·  Empowering women. Creating digital success.",
       size=12, italic=True, color=MUTED, font=SERIF)
    return s


def build(story: bool) -> Presentation:
    prs = Presentation()
    prs.slide_width = W
    prs.slide_height = H

    s_cover(prs, story)
    s_problem(prs, story)
    s_partner(prs, story)
    s_mission(prs, story)
    s_stack(prs, story)
    s_video_flow(prs, story)
    s_ads_timeline(prs, story)
    s_multichannel(prs, story)
    s_risk(prs, story)
    s_process(prs, story)
    s_industries(prs, story)
    s_results(prs, story)
    s_packages(prs, story)
    s_before(prs, story)

    s_vid_vertical(
        prs, story, "media1.mp4", "poster1.jpg", 474, 850,
        "After editing.",
        "WORK SAMPLE",
        "Same shop floor. Pace, grade, and titles built for the phone.",
        15,
    )
    s_vid_landscape(
        prs, story, "media2.mp4", "poster2.jpg", 848, 478,
        "AI video editing.",
        "WORK SAMPLE",
        "Human taste on top of faster tools — a foundation film with a heartbeat.",
        16,
    )
    s_vid_vertical(
        prs, story, "media3.mp4", "poster3.jpg", 480, 864,
        "Lifestyle film.",
        "WORK SAMPLE",
        "Place, cloth, and feeling — a walk that sells a world.",
        17,
    )
    s_vid_landscape(
        prs, story, "media4.mp4", "poster4.jpg", 848, 478,
        "Real estate film.",
        "WORK SAMPLE",
        "A property people can already picture themselves walking into.",
        18,
    )
    s_vid_square(
        prs, story, "media5.mp4", "poster5.jpg", 368, 368,
        "Property story.",
        "WORK SAMPLE",
        "Plot to lifestyle — square for the feed, cinematic in the cut.",
        19,
    )
    s_vid_landscape(
        prs, story, "media6.mp4", "poster6.jpg", 848, 478,
        "Motion and brand film.",
        "WORK SAMPLE",
        "When the story needs more than a camera.",
        20,
    )

    s_cta(prs, story)

    prs.core_properties.title = "Sneha Digital Hub"
    prs.core_properties.author = "Sneha Digital Hub"
    prs.core_properties.subject = "Creative digital solutions that drive measurable growth"
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
