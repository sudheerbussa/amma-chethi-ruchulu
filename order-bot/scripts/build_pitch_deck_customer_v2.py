#!/usr/bin/env python3
"""Visually bold customer pitch decks (feedback: previous versions felt dull).

Writes (overwrites customer-facing decks only):
  pitch/WhatsApp_System_Pitch_Minimal.pptx   — 3 slides, visual-first
  pitch/WhatsApp_System_Pitch_Customer.pptx  — 6 slides, no pricing

Design: big type, full-bleed color fields, Storyset illustrations, little text.
"""

from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Inches, Pt, Emu

PITCH = Path(__file__).resolve().parents[1] / "pitch"
OFFICIAL = PITCH / "storyset-assets" / "official"
PROOF = PITCH / "proof-screenshots"
QR = PITCH / "wa-discovery-qr.png"

# Atmosphere: deep ink + living teal + warm sand (not purple / not cream-terracotta cliché)
INK = RGBColor(0x12, 0x1A, 0x24)
TEAL = RGBColor(0x0B, 0x6E, 0x63)
TEAL_BRIGHT = RGBColor(0x12, 0x9A, 0x8A)
SAND = RGBColor(0xF3, 0xEB, 0xDF)
MIST = RGBColor(0xE8, 0xF2, 0xEF)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
MUTED = RGBColor(0x6B, 0x78, 0x84)
CORAL = RGBColor(0xD4, 0x5D, 0x3A)

WA_URL = (
    "https://wa.me/918055292935?text="
    "Hi%2C%20I%20want%20to%20see%20a%20demo%20of%20the%20WhatsApp%20system"
)


def set_run(run, text, size=18, bold=False, color=INK, font="Georgia"):
    run.text = text
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color
    run.font.name = font


def tb(slide, left, top, width, height, text, size=18, bold=False, color=INK, align=PP_ALIGN.LEFT, font="Georgia"):
    box = slide.shapes.add_textbox(left, top, width, height)
    tf = box.text_frame
    tf.word_wrap = True
    for i, line in enumerate(text.split("\n")):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        set_run(p.add_run(), line, size, bold, color, font)
    return box


def fill(shape, color):
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()


def rect(slide, left, top, width, height, color):
    sh = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
    fill(sh, color)
    return sh


def round_rect(slide, left, top, width, height, color):
    sh = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    fill(sh, color)
    return sh


def blank(prs):
    return prs.slides.add_slide(prs.slide_layouts[6])


def pic(slide, name, left, top, width=None, height=None):
    path = OFFICIAL / name
    if not path.exists():
        return None
    kwargs = {}
    if width is not None:
        kwargs["width"] = width
    if height is not None:
        kwargs["height"] = height
    return slide.shapes.add_picture(str(path), left, top, **kwargs)


def proof_strip(slide, top=Inches(1.55)):
    files = sorted(PROOF.glob("*.png")) + sorted(PROOF.glob("*.jpg")) + sorted(PROOF.glob("*.jpeg"))
    labels = ["Order on chat", "Pay & confirm", "Live status"]
    for i, label in enumerate(labels):
        left = Inches(0.55 + i * 4.2)
        panel = round_rect(slide, left, top, Inches(3.95), Inches(4.55), WHITE)
        if i < len(files):
            try:
                slide.shapes.add_picture(str(files[i]), left + Inches(0.2), top + Inches(0.2), width=Inches(3.55))
            except Exception:
                pass
        else:
            tb(
                slide,
                left + Inches(0.3),
                top + Inches(1.7),
                Inches(3.35),
                Inches(1.4),
                f"{label}\n\nAdd screenshot here",
                size=16,
                color=MUTED,
                align=PP_ALIGN.CENTER,
                font="Calibri",
            )
        tb(slide, left, top + Inches(4.65), Inches(3.95), Inches(0.35), label, size=12, bold=True, color=TEAL, align=PP_ALIGN.CENTER, font="Calibri")


def cta_chip(slide, left, top, width=Inches(5.6)):
    btn = round_rect(slide, left, top, width, Inches(1.05), TEAL_BRIGHT)
    btn.click_action.hyperlink.address = WA_URL
    tf = btn.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    set_run(p.add_run(), "WhatsApp  ·  +91 80552 92935", size=18, bold=True, color=WHITE, font="Calibri")
    return btn


# ─── MINIMAL (3) ───────────────────────────────────────────────


def build_minimal():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # 1 — HERO composition
    s = blank(prs)
    rect(s, Inches(0), Inches(0), Inches(13.333), Inches(7.5), INK)
    # soft teal wash panel
    rect(s, Inches(0), Inches(0), Inches(6.4), Inches(7.5), RGBColor(0x16, 0x2B, 0x2A))
    rect(s, Inches(0), Inches(0), Inches(0.22), Inches(7.5), TEAL_BRIGHT)
    tb(s, Inches(0.7), Inches(1.4), Inches(5.4), Inches(0.4), "WHATSAPP BUSINESS SYSTEM", size=12, bold=True, color=TEAL_BRIGHT, font="Calibri")
    tb(
        s,
        Inches(0.7),
        Inches(2.0),
        Inches(5.5),
        Inches(2.2),
        "Your customers\nare already\non WhatsApp.",
        size=40,
        bold=True,
        color=WHITE,
    )
    tb(
        s,
        Inches(0.7),
        Inches(4.5),
        Inches(5.3),
        Inches(1.0),
        "Turn that chat into orders,\nbookings, payments & updates.",
        size=18,
        color=SAND,
        font="Calibri",
    )
    pic(s, "01-hero-mobile-marketing.png", Inches(6.6), Inches(0.7), height=Inches(6.2))

    # 2 — PROBLEM → FIX (split)
    s = blank(prs)
    rect(s, Inches(0), Inches(0), Inches(6.66), Inches(7.5), SAND)
    rect(s, Inches(6.66), Inches(0), Inches(6.67), Inches(7.5), MIST)
    tb(s, Inches(0.6), Inches(0.55), Inches(5.5), Inches(0.35), "THE MESS", size=12, bold=True, color=CORAL, font="Calibri")
    tb(s, Inches(0.6), Inches(1.1), Inches(5.5), Inches(1.4), "Chats pile up.\nOrders get lost.\nNobody knows\nwho paid.", size=28, bold=True, color=INK)
    pic(s, "02-problem-questions.png", Inches(0.9), Inches(3.6), height=Inches(3.4))

    tb(s, Inches(7.2), Inches(0.55), Inches(5.5), Inches(0.35), "THE FIX", size=12, bold=True, color=TEAL, font="Calibri")
    tb(s, Inches(7.2), Inches(1.1), Inches(5.5), Inches(1.4), "A guided flow\non your number.\nConfirm. Pay.\nTrack.", size=28, bold=True, color=INK)
    pic(s, "03-solution-chatbot.png", Inches(7.5), Inches(3.4), height=Inches(3.6))

    # 3 — PROOF + CTA
    s = blank(prs)
    rect(s, Inches(0), Inches(0), Inches(13.333), Inches(7.5), SAND)
    rect(s, Inches(0), Inches(0), Inches(13.333), Inches(1.35), INK)
    tb(s, Inches(0.6), Inches(0.35), Inches(9), Inches(0.4), "PROOF", size=12, bold=True, color=TEAL_BRIGHT, font="Calibri")
    tb(s, Inches(0.6), Inches(0.7), Inches(12), Inches(0.5), "Live on WhatsApp — Amma Chethi Ruchulu", size=22, bold=True, color=WHITE)
    proof_strip(s, top=Inches(1.6))
    cta_chip(s, Inches(0.55), Inches(6.45), Inches(5.8))
    tb(s, Inches(6.6), Inches(6.65), Inches(6), Inches(0.5), "10-minute demo. No long pitch.", size=14, color=MUTED, font="Calibri")

    out = PITCH / "WhatsApp_System_Pitch_Minimal.pptx"
    prs.save(str(out))
    print("Wrote", out)


# ─── CUSTOMER (6) ──────────────────────────────────────────────


def build_customer():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)

    # 1 Hero
    s = blank(prs)
    rect(s, Inches(0), Inches(0), Inches(13.333), Inches(7.5), INK)
    rect(s, Inches(8.2), Inches(0), Inches(5.133), Inches(7.5), RGBColor(0x1A, 0x35, 0x32))
    tb(s, Inches(0.75), Inches(1.5), Inches(7), Inches(0.35), "FOR LOCAL BUSINESSES IN INDIA", size=13, bold=True, color=TEAL_BRIGHT, font="Calibri")
    tb(s, Inches(0.75), Inches(2.1), Inches(7.2), Inches(2.0), "Stop running\nyour business\nfrom a chat scroll.", size=40, bold=True, color=WHITE)
    tb(
        s,
        Inches(0.75),
        Inches(4.5),
        Inches(6.8),
        Inches(0.9),
        "Orders, appointments, payments and status —\nstructured on WhatsApp. No new app for customers.",
        size=16,
        color=SAND,
        font="Calibri",
    )
    pic(s, "01-hero-mobile-marketing.png", Inches(8.0), Inches(0.9), height=Inches(5.8))

    # 2 Problem — visual
    s = blank(prs)
    rect(s, Inches(0), Inches(0), Inches(13.333), Inches(7.5), SAND)
    tb(s, Inches(0.7), Inches(0.45), Inches(6), Inches(0.3), "THE PROBLEM", size=12, bold=True, color=CORAL, font="Calibri")
    tb(s, Inches(0.7), Inches(0.9), Inches(7), Inches(1.5), "WhatsApp brings\ncustomers.\nChaos keeps them\nwaiting.", size=34, bold=True, color=INK)
    pains = [
        "Messages buried under family chats",
        "Wrong items · wrong time slots",
        "“Did they pay?” every evening",
        "Customers calling for status again",
    ]
    for i, p in enumerate(pains):
        y = Inches(3.0 + i * 0.85)
        round_rect(s, Inches(0.7), y, Inches(6.5), Inches(0.7), WHITE)
        tb(s, Inches(1.0), y + Inches(0.18), Inches(5.9), Inches(0.4), p, size=16, color=INK, font="Calibri")
    pic(s, "02-problem-questions.png", Inches(7.6), Inches(1.2), height=Inches(5.5))

    # 3 Solution — visual flow
    s = blank(prs)
    rect(s, Inches(0), Inches(0), Inches(13.333), Inches(7.5), MIST)
    tb(s, Inches(0.7), Inches(0.4), Inches(12), Inches(0.3), "THE SOLUTION", size=12, bold=True, color=TEAL, font="Calibri")
    tb(s, Inches(0.7), Inches(0.85), Inches(12), Inches(0.9), "One guided WhatsApp journey.", size=32, bold=True, color=INK)
    steps = [
        ("01", "Open chat"),
        ("02", "Pick item / slot"),
        ("03", "Pay"),
        ("04", "You run it"),
        ("05", "Status back"),
    ]
    for i, (n, label) in enumerate(steps):
        left = Inches(0.5 + i * 2.5)
        round_rect(s, left, Inches(2.1), Inches(2.3), Inches(1.7), WHITE)
        tb(s, left + Inches(0.15), Inches(2.3), Inches(2.0), Inches(0.4), n, size=20, bold=True, color=TEAL_BRIGHT, align=PP_ALIGN.CENTER)
        tb(s, left + Inches(0.1), Inches(2.9), Inches(2.1), Inches(0.7), label, size=15, bold=True, color=INK, align=PP_ALIGN.CENTER, font="Calibri")
    pic(s, "03-solution-chatbot.png", Inches(3.8), Inches(4.0), height=Inches(3.2))
    tb(
        s,
        Inches(0.7),
        Inches(4.2),
        Inches(3.2),
        Inches(2.2),
        "Official Meta WhatsApp.\nYour brand number.\nTheir familiar app.",
        size=16,
        color=MUTED,
        font="Calibri",
    )

    # 4 Where it fits — three big image panels
    s = blank(prs)
    rect(s, Inches(0), Inches(0), Inches(13.333), Inches(7.5), INK)
    tb(s, Inches(0.6), Inches(0.35), Inches(12), Inches(0.3), "WHERE IT FITS", size=12, bold=True, color=TEAL_BRIGHT, font="Calibri")
    tb(s, Inches(0.6), Inches(0.7), Inches(12), Inches(0.55), "Same idea. Different businesses.", size=28, bold=True, color=WHITE)
    panels = [
        ("04-verticals-coffee.png", "Sell & deliver", "Food · bakery · shops"),
        ("09-online-doctor.png", "Book & appoint", "Clinics · salons · classes"),
        ("04c-groceries.png", "Repeat service", "Laundry · water · home"),
    ]
    for i, (img_name, title, sub) in enumerate(panels):
        left = Inches(0.45 + i * 4.25)
        round_rect(s, left, Inches(1.55), Inches(4.05), Inches(5.3), RGBColor(0x1C, 0x28, 0x34))
        pic(s, img_name, left + Inches(0.35), Inches(1.8), height=Inches(3.2))
        tb(s, left + Inches(0.25), Inches(5.2), Inches(3.55), Inches(0.45), title, size=20, bold=True, color=WHITE, align=PP_ALIGN.CENTER)
        tb(s, left + Inches(0.25), Inches(5.7), Inches(3.55), Inches(0.5), sub, size=13, color=SAND, align=PP_ALIGN.CENTER, font="Calibri")

    # 5 Proof
    s = blank(prs)
    rect(s, Inches(0), Inches(0), Inches(13.333), Inches(7.5), SAND)
    tb(s, Inches(0.6), Inches(0.35), Inches(12), Inches(0.3), "PROOF OF THE MODEL", size=12, bold=True, color=TEAL, font="Calibri")
    tb(s, Inches(0.6), Inches(0.75), Inches(12), Inches(0.55), "Already live — Amma Chethi Ruchulu", size=28, bold=True, color=INK)
    proof_strip(s, top=Inches(1.5))
    tb(s, Inches(0.6), Inches(6.5), Inches(12), Inches(0.4), "Real WhatsApp chats. Demo on request — we don’t publish the live order number.", size=13, color=MUTED, font="Calibri")

    # 6 CTA
    s = blank(prs)
    rect(s, Inches(0), Inches(0), Inches(13.333), Inches(7.5), INK)
    rect(s, Inches(0), Inches(0), Inches(0.22), Inches(7.5), TEAL_BRIGHT)
    tb(s, Inches(0.8), Inches(1.5), Inches(7.5), Inches(1.6), "See it on\nyour phone.", size=44, bold=True, color=WHITE)
    tb(
        s,
        Inches(0.8),
        Inches(3.4),
        Inches(7),
        Inches(0.8),
        "Bring your menu or appointment list.\nWe’ll show the flow — then talk a simple monthly fee.",
        size=16,
        color=SAND,
        font="Calibri",
    )
    cta_chip(s, Inches(0.8), Inches(4.6))
    if QR.exists():
        round_rect(s, Inches(9.3), Inches(1.8), Inches(3.3), Inches(4.0), WHITE)
        s.shapes.add_picture(str(QR), Inches(9.55), Inches(2.1), width=Inches(2.8), height=Inches(2.8))
        tb(s, Inches(9.3), Inches(5.1), Inches(3.3), Inches(0.4), "Scan to WhatsApp", size=14, bold=True, color=INK, align=PP_ALIGN.CENTER, font="Calibri")
    tb(s, Inches(0.8), Inches(6.5), Inches(8), Inches(0.35), "Illustrations: Storyset by Freepik  ·  storyset.com", size=10, color=MUTED, font="Calibri")

    out = PITCH / "WhatsApp_System_Pitch_Customer.pptx"
    prs.save(str(out))
    print("Wrote", out)


if __name__ == "__main__":
    PITCH.mkdir(parents=True, exist_ok=True)
    PROOF.mkdir(parents=True, exist_ok=True)
    build_minimal()
    build_customer()
