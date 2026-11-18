#!/usr/bin/env python3
"""Make the app icons and Android splash screens from the card-back emblem.

    python3 source/tools/make_branding.py BASECARDS-backs.png

Writes branding/res/** (Android launcher icons and splash screens) and desktop/icon.ico, desktop/icon.png."""
import os, sys
from PIL import Image, ImageDraw
Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BG = (122, 12, 28)       # the card back's maroon
sheet = Image.open(sys.argv[1]).convert('RGB')
emblem = sheet.crop((132, 290, 692, 850))   # the round emblem on the first card back
mask = Image.new('L', emblem.size, 0); ImageDraw.Draw(mask).ellipse((6, 6, emblem.width - 7, emblem.height - 7), fill=255)
emblem = emblem.convert('RGBA'); emblem.putalpha(mask)
def canvas(w, h, frac, bg=BG, round_=False):
    im = Image.new('RGBA', (w, h), bg + (255,) if bg else (0, 0, 0, 0))
    s = int(min(w, h) * frac); e = emblem.resize((s, s), Image.LANCZOS); im.alpha_composite(e, ((w - s) // 2, (h - s) // 2))
    if round_: m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).ellipse((0, 0, w - 1, h - 1), fill=255); im.putalpha(m)
    return im
def save(im, *p):
    f = os.path.join(ROOT, *p); os.makedirs(os.path.dirname(f), exist_ok=True); im.save(f)
for d, px in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    save(canvas(px, px, 0.86), 'branding', 'res', f'mipmap-{d}', 'ic_launcher.png')
    save(canvas(px, px, 0.86, round_=True), 'branding', 'res', f'mipmap-{d}', 'ic_launcher_round.png')
    save(canvas(px * 9 // 4, px * 9 // 4, 0.56, bg=None), 'branding', 'res', f'mipmap-{d}', 'ic_launcher_foreground.png')
for d, (w, h) in {'mdpi': (320, 480), 'hdpi': (480, 800), 'xhdpi': (720, 1280), 'xxhdpi': (960, 1600), 'xxxhdpi': (1280, 1920)}.items():
    save(canvas(w, h, 0.5).convert('RGB'), 'branding', 'res', f'drawable-port-{d}', 'splash.png')
    save(canvas(h, w, 0.5).convert('RGB'), 'branding', 'res', f'drawable-land-{d}', 'splash.png')
save(canvas(480, 320, 0.5).convert('RGB'), 'branding', 'res', 'drawable', 'splash.png')
icon = canvas(512, 512, 0.9, round_=False)
save(icon, 'desktop', 'icon.png')
icon.save(os.path.join(ROOT, 'desktop', 'icon.ico'), sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print('wrote branding/res and desktop icons')
