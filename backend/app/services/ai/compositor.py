"""
Ad Compositor — overlays structured text/design onto a photo background.

Split-layout pharma ad style:
  TOP : solid color panel with headline (serif bold) + emphasis words + divider + subtext
  BOTTOM : AI-generated photo (GPT-image-1 output, no text)

Usage:
    from app.services.ai.compositor import composite_ad
    png_bytes = composite_ad(photo_bytes, layout, canvas_w=1080, canvas_h=1920)
"""

import io
import os
import re
from typing import Tuple
from PIL import Image, ImageDraw, ImageFont

# ── Font candidates (tried in order, first match wins) ────────────────────────

_SERIF_BOLD = [
    # Linux / Docker (DejaVu, Liberation, FreeFonts)
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSerifBold.ttf",
    # macOS
    "/Library/Fonts/Georgia Bold.ttf",
    "/System/Library/Fonts/Times.ttc",
    # Windows
    "C:/Windows/Fonts/georgiab.ttf",
    "C:/Windows/Fonts/timesbd.ttf",
]

_SANS_REGULAR = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    "/Library/Fonts/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "C:/Windows/Fonts/arial.ttf",
    "C:/Windows/Fonts/calibri.ttf",
]


def _load_font(candidates: list, size: int) -> ImageFont.FreeTypeFont:
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    # Pillow built-in fallback (fixed size, ignores size param)
    return ImageFont.load_default()


def _hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def _is_emphasis(word: str) -> bool:
    """True for ALL-CAPS tokens (≥2 letters) — these are rendered larger."""
    clean = re.sub(r"[^a-zA-Z]", "", word)
    return len(clean) >= 2 and clean.isupper()


def _draw_headline(
    draw: ImageDraw.ImageDraw,
    text: str,
    canvas_w: int,
    top_h: int,
    padding: int,
    text_color: Tuple[int, int, int],
) -> int:
    """
    Renders the headline with word-level emphasis:
    - ALL CAPS words → larger bold serif (emphasis)
    - Other words    → standard bold serif

    Returns the y-coordinate immediately after the last line.
    """
    max_text_w = canvas_w - padding * 2

    # Two font sizes — emphasis is ~25% larger
    font_std = _load_font(_SERIF_BOLD, 68)
    font_emp = _load_font(_SERIF_BOLD, 88)

    words = text.split()

    # Greedy line-breaking using per-word widths
    lines: list[list[tuple[str, ImageFont.FreeTypeFont]]] = []
    current_line: list[tuple[str, ImageFont.FreeTypeFont]] = []
    current_w = 0.0

    for word in words:
        font = font_emp if _is_emphasis(word) else font_std
        word_w = draw.textlength(word, font=font)
        space_w = draw.textlength(" ", font=font)
        gap = space_w if current_line else 0
        if current_line and current_w + gap + word_w > max_text_w:
            lines.append(current_line)
            current_line = [(word, font)]
            current_w = word_w
        else:
            current_line.append((word, font))
            current_w += gap + word_w

    if current_line:
        lines.append(current_line)

    # Measure line heights
    line_heights = []
    for line in lines:
        max_h = max(draw.textbbox((0, 0), w, font=f)[3] for w, f in line)
        line_heights.append(max_h)

    line_gap   = 18
    total_text_h = sum(line_heights) + line_gap * max(0, len(lines) - 1)
    # Vertically center within the upper 65% of the top panel
    usable_h = int(top_h * 0.65)
    start_y  = max(padding, (usable_h - total_text_h) // 2)

    y = start_y
    for i, line in enumerate(lines):
        # Measure actual rendered line width for centering
        parts = []
        total_w = 0.0
        for j, (word, font) in enumerate(line):
            w = draw.textlength(word, font=font)
            sp = draw.textlength(" ", font=font) if j < len(line) - 1 else 0
            parts.append((word, font, w))
            total_w += w + sp

        x = (canvas_w - total_w) / 2
        for word, font, w in parts:
            draw.text((x, y), word, font=font, fill=text_color)
            x += w + draw.textlength(" ", font=font)

        y += line_heights[i] + line_gap

    return int(y)


def composite_ad(
    photo_bytes: bytes,
    layout: dict,
    canvas_w: int = 1080,
    canvas_h: int = 1920,
) -> bytes:
    """
    Composites the final ad creative.

    Args:
        photo_bytes : Raw PNG/JPEG from GPT-image-1 (the scene photo, no text)
        layout      : Design spec dict from Claude (colors, texts, percentages)
        canvas_w/h  : Output dimensions (default 1080×1920 story format)

    Returns:
        Final ad as PNG bytes.
    """
    bg_color      = _hex_to_rgb(layout.get("top_bg_color",    "#0a1f5c"))
    top_pct       = layout.get("top_height_pct", 42) / 100
    headline_text = layout.get("headline_text",  "")
    subtext       = layout.get("subtext",         "")
    text_color    = _hex_to_rgb(layout.get("text_color",       "#FFFFFF"))
    divider_color = _hex_to_rgb(layout.get("divider_color",    "#FFFFFF"))
    subtext_color = _hex_to_rgb(layout.get("subtext_color",    "#CCCCCC"))

    top_h    = int(canvas_h * top_pct)
    bottom_h = canvas_h - top_h
    padding  = 72

    # ── Canvas ────────────────────────────────────────────────────────────────
    canvas = Image.new("RGB", (canvas_w, canvas_h), bg_color)
    draw   = ImageDraw.Draw(canvas)

    # ── Bottom: photo (center-crop to fill) ───────────────────────────────────
    photo = Image.open(io.BytesIO(photo_bytes)).convert("RGB")
    ph_w, ph_h = photo.size
    target_ratio = canvas_w / bottom_h
    photo_ratio  = ph_w / ph_h

    if photo_ratio > target_ratio:
        new_w = int(ph_h * target_ratio)
        left  = (ph_w - new_w) // 2
        photo = photo.crop((left, 0, left + new_w, ph_h))
    else:
        new_h = int(ph_w / target_ratio)
        top_c = (ph_h - new_h) // 2
        photo = photo.crop((0, top_c, ph_w, top_c + new_h))

    photo = photo.resize((canvas_w, bottom_h), Image.LANCZOS)
    canvas.paste(photo, (0, top_h))

    # ── Top: headline ─────────────────────────────────────────────────────────
    headline_bottom = _draw_headline(
        draw, headline_text, canvas_w, top_h, padding, text_color
    )

    # ── Divider ───────────────────────────────────────────────────────────────
    div_y  = headline_bottom + 28
    div_x0 = padding
    div_x1 = canvas_w - padding
    draw.line([(div_x0, div_y), (div_x1, div_y)], fill=divider_color, width=2)

    # ── Subtext ───────────────────────────────────────────────────────────────
    font_sub   = _load_font(_SANS_REGULAR, 42)
    sub_y      = div_y + 30
    max_sub_w  = canvas_w - padding * 2

    # Word-wrap subtext
    wrapped: list[str] = []
    current: list[str] = []
    for word in subtext.split():
        test = " ".join(current + [word])
        if draw.textlength(test, font=font_sub) <= max_sub_w:
            current.append(word)
        else:
            if current:
                wrapped.append(" ".join(current))
            current = [word]
    if current:
        wrapped.append(" ".join(current))

    for line in wrapped:
        lw = draw.textlength(line, font=font_sub)
        draw.text(((canvas_w - lw) // 2, sub_y), line, font=font_sub, fill=subtext_color)
        bbox  = draw.textbbox((0, 0), line, font=font_sub)
        sub_y += (bbox[3] - bbox[1]) + 14

    # ── Save ──────────────────────────────────────────────────────────────────
    output = io.BytesIO()
    canvas.save(output, format="PNG", optimize=True)
    return output.getvalue()
