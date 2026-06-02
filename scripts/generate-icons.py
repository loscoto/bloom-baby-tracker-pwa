from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
PUBLIC.mkdir(exist_ok=True)

SIZE_MAP = {
    'icon-192.png': 192,
    'icon-512.png': 512,
    'apple-touch-icon.png': 180,
}

BG_TOP = (240, 233, 225, 255)
BG_BOTTOM = (248, 246, 241, 255)
ACCENT = (125, 156, 141, 255)
ACCENT_DARK = (87, 119, 107, 255)
WHITE = (255, 255, 255, 255)
TEXT = (64, 53, 44, 255)
SOFT_BLUE = (142, 160, 179, 255)
SOFT_ROSE = (210, 143, 149, 255)


def gradient(size: int) -> Image.Image:
    image = Image.new('RGBA', (size, size), BG_BOTTOM)
    draw = ImageDraw.Draw(image)
    for y in range(size):
        t = y / max(1, size - 1)
        r = int(BG_TOP[0] * (1 - t) + BG_BOTTOM[0] * t)
        g = int(BG_TOP[1] * (1 - t) + BG_BOTTOM[1] * t)
        b = int(BG_TOP[2] * (1 - t) + BG_BOTTOM[2] * t)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))
    return image


def round_rect(draw: ImageDraw.ImageDraw, bounds, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(bounds, radius=radius, fill=fill, outline=outline, width=width)


def make_icon(size: int) -> Image.Image:
    image = gradient(size)
    draw = ImageDraw.Draw(image)

    pad = int(size * 0.08)
    inner = [pad, pad, size - pad, size - pad]
    round_rect(draw, inner, int(size * 0.2), fill=(255, 255, 255, 182), outline=(255, 255, 255, 200), width=max(1, size // 120))

    # soft background glows
    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((size * 0.10, size * 0.14, size * 0.50, size * 0.54), fill=(164, 190, 177, 85))
    glow_draw.ellipse((size * 0.52, size * 0.16, size * 0.88, size * 0.52), fill=(174, 191, 216, 70))
    glow_draw.ellipse((size * 0.22, size * 0.60, size * 0.78, size * 0.94), fill=(221, 206, 180, 58))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=size * 0.045))
    image = Image.alpha_composite(image, glow)

    # chart frame
    chart = [size * 0.20, size * 0.30, size * 0.80, size * 0.74]
    round_rect(draw, chart, int(size * 0.12), fill=(255, 255, 255, 108), outline=(255, 255, 255, 160), width=max(1, size // 160))

    # line chart path
    points = [
        (size * 0.26, size * 0.62),
        (size * 0.40, size * 0.54),
        (size * 0.54, size * 0.46),
        (size * 0.70, size * 0.35),
    ]
    draw.line(points, fill=ACCENT_DARK, width=max(3, size // 54), joint='curve')
    for x, y in points:
        r = max(4, size // 24)
        draw.ellipse((x - r, y - r, x + r, y + r), fill=WHITE, outline=ACCENT_DARK, width=max(1, size // 140))

    # tiny heartbeat / life mark
    pulse_y = size * 0.70
    pulse = [
        (size * 0.26, pulse_y),
        (size * 0.36, pulse_y),
        (size * 0.41, pulse_y - size * 0.07),
        (size * 0.48, pulse_y + size * 0.03),
        (size * 0.56, pulse_y - size * 0.02),
        (size * 0.64, pulse_y),
    ]
    draw.line(pulse, fill=SOFT_ROSE, width=max(2, size // 72), joint='curve')

    # monogram circle
    cx, cy = size * 0.50, size * 0.55
    radius = size * 0.11
    draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=(250, 248, 244, 240), outline=(255, 255, 255, 245), width=max(1, size // 160))

    try:
        font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf', int(size * 0.17))
    except Exception:
        font = ImageFont.load_default()
    letter = 'B'
    bbox = draw.textbbox((0, 0), letter, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((cx - tw / 2, cy - th / 2 - size * 0.012), letter, font=font, fill=TEXT)

    # corner sparkle
    sparkle = [
        (size * 0.73, size * 0.22),
        (size * 0.75, size * 0.28),
        (size * 0.81, size * 0.30),
        (size * 0.75, size * 0.32),
        (size * 0.73, size * 0.38),
        (size * 0.71, size * 0.32),
        (size * 0.65, size * 0.30),
        (size * 0.71, size * 0.28),
    ]
    draw.polygon(sparkle, fill=(255, 255, 255, 190))

    return image


def make_svg() -> str:
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Bloom logo">
  <defs>
    <linearGradient id="bg" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#f1ebe4"/>
      <stop offset="100%" stop-color="#f8f6f1"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#7d9c8d"/>
      <stop offset="100%" stop-color="#a7beb0"/>
    </linearGradient>
  </defs>
  <rect x="24" y="24" width="464" height="464" rx="112" fill="url(#bg)"/>
  <rect x="96" y="116" width="320" height="280" rx="60" fill="white" fill-opacity="0.7" stroke="white" stroke-opacity="0.8"/>
  <path d="M128 316L182 282L238 246L302 204L372 168" fill="none" stroke="#5e7d6e" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="128" cy="316" r="16" fill="#fff" stroke="#5e7d6e" stroke-width="8"/>
  <circle cx="182" cy="282" r="16" fill="#fff" stroke="#5e7d6e" stroke-width="8"/>
  <circle cx="238" cy="246" r="16" fill="#fff" stroke="#5e7d6e" stroke-width="8"/>
  <circle cx="302" cy="204" r="16" fill="#fff" stroke="#5e7d6e" stroke-width="8"/>
  <circle cx="372" cy="168" r="16" fill="#fff" stroke="#5e7d6e" stroke-width="8"/>
  <path d="M128 338H160L180 306L202 350L228 324L260 338" fill="none" stroke="#d28f95" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="256" cy="260" r="54" fill="#faf8f4" stroke="white" stroke-opacity="0.9"/>
  <text x="256" y="278" text-anchor="middle" font-family="Arial Rounded MT Bold, Arial, sans-serif" font-size="98" fill="#3e342b">B</text>
</svg>
'''

for filename, size in SIZE_MAP.items():
    make_icon(size).save(PUBLIC / filename)

(PUBLIC / 'favicon.svg').write_text(make_svg(), encoding='utf-8')

print('icons generated')
