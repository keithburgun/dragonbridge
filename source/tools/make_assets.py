#!/usr/bin/env python3
"""Cut the printed card sheets into the game's images (source/img/*.webp).

    python3 tools/make_assets.py BASECARDS.png BASECARDS-backs.png EXPCARDS.png EXPCARDS-backs.png [Manual.pdf]

Each sheet is 6x6 cards of 825x1125. Needs Pillow (and poppler's pdftoppm for the rulebook pages)."""
import os, subprocess, sys, tempfile
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(H, 'img')
sheets = dict(zip(['b', 'bb', 'e', 'eb'], [Image.open(p).convert('RGB') for p in sys.argv[1:5]]))
def cell(k):
    tag, rc = k.split('_'); r, c = int(rc[0]), int(rc[1])
    return sheets[tag].crop((c * 825, r * 1125, (c + 1) * 825, (r + 1) * 1125))
def save(im, name, q=80): im.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=q, method=6)

CARDS = {  # game id -> sheet cell
 'fireball': 'b_00', 'dazzle': 'b_01', 'flamearrow': 'b_02', 'dart': 'b_03', 'soda': 'b_04', 'transfer': 'b_05', 'charge': 'b_10',
 'step': 'b_12', 'gale': 'b_13', 'bait': 'b_15', 'insight': 'b_20', 'hop': 'b_21', 'leap': 'b_22', 'shockwave': 'b_23', 'checkmate': 'b_54',
 'wz_derby': 'b_31', 'wz_eve': 'b_32', 'wz_bunny': 'b_33', 'wz_abragail': 'b_34', 'wz_venice': 'b_35', 'wz_may': 'e_00', 'wz_may2': 'eb_00',
 'wz_omar': 'e_01', 'wz_lori': 'e_02', 'wz_bill': 'e_03', 'wz_robot': 'e_04', 'wz_andromeda': 'e_45', 'wz_peebnup': 'e_50',
 'wz_december': 'e_51', 'wz_trevor': 'e_52', 'wz_gelf': 'e_53',
 'it_loom': 'b_51', 'it_thunderbox': 'b_52', 'it_blade': 'b_53', 'it_skates': 'b_55', 'it_cutlass': 'e_05', 'it_transmog': 'e_10',
 'it_blink': 'e_11', 'it_backpack': 'e_12', 'it_vr': 'e_13',
 'hk_law': 'e_14', 'hk_sk8': 'e_15', 'hk_lullaby': 'e_20', 'hk_forge': 'e_21', 'hk_mondo': 'e_22', 'hk_wyrm': 'e_23', 'hk_gems': 'e_24',
 'hk_pills': 'e_25', 'hk_deals': 'e_30',
 'gem': 'b_41', 'gemdep': 'bb_41', 'white': 'e_31', 'dragon': 'b_40', 'back': 'bb_00', 'itemback': 'bb_51', 'hackback': 'eb_14', 'ref': 'bb_31',
}
for gid, k in CARDS.items(): save(cell(k).resize((440, 600), Image.LANCZOS), gid)

FACES = {  # face centre (x, y) and radius on the 825x1125 card
 'derby': (425, 295, 115), 'eve': (490, 330, 120), 'bunny': (400, 500, 160), 'abragail': (335, 320, 120), 'venice': (400, 350, 140),
 'may': (392, 270, 105), 'may2': (392, 270, 105), 'omar': (400, 430, 125), 'lori': (410, 340, 120), 'bill': (416, 220, 90),
 'robot': (410, 275, 120), 'andromeda': (415, 330, 120), 'peebnup': (370, 360, 135), 'december': (410, 250, 95), 'trevor': (330, 275, 100),
 'gelf': (395, 280, 100), 'dragon': (412, 730, 175),
}
for w, (x, y, r) in FACES.items():
    src = cell(CARDS['dragon' if w == 'dragon' else 'wz_' + w])
    save(src.crop((x - r, y - r, x + r, y + r)).resize((168, 168), Image.LANCZOS), 'face_' + w, 84)

# The bridge, sideways: Dragon-start end on the left. 21 tiles, 150px each on the sheet.
parts = [cell(k).rotate(90, expand=True).crop((48, 60, 1098, 770)) for k in ('b_30', 'b_25', 'b_24')]
br = Image.new('RGB', (3150, 710))
for i, p in enumerate(parts): br.paste(p, (i * 1050, 0))
save(br.resize((1890, 426), Image.LANCZOS), 'bridge', 82)
def icon(k, box, size, name):   # a soft-edged cut-out of the gem artwork
    from PIL import ImageDraw, ImageFilter
    im = cell(k).crop(box).resize(size, Image.LANCZOS).convert('RGBA')
    m = Image.new('L', size, 0); ImageDraw.Draw(m).rounded_rectangle((3, 3, size[0] - 4, size[1] - 4), radius=min(size) // 3, fill=255)
    im.putalpha(m.filter(ImageFilter.GaussianBlur(2))); im.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=90, method=6)
icon('b_41', (252, 236, 568, 644), (78, 100), 'icon_gem')
icon('bb_41', (252, 236, 568, 644), (78, 100), 'icon_gemdep')
icon('e_31', (180, 350, 644, 726), (112, 90), 'icon_white')
def round_icon(k, box, size, name):
    from PIL import ImageDraw
    im = cell(k).crop(box).resize((size * 3, size * 3), Image.LANCZOS).convert('RGBA')
    m = Image.new('L', im.size, 0); ImageDraw.Draw(m).ellipse((2, 2, im.width - 3, im.height - 3), fill=255)
    im.putalpha(m); im.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=92, method=6)
round_icon('b_02', (378, 907, 428, 957), 64, 'icon_wing')   # the Wing symbol from Flame Arrow's Dragon Power text
logo = cell('bb_00').crop((132, 290, 692, 850)); save(logo.resize((360, 360), Image.LANCZOS), 'logo', 85)
center = cell('b_25').rotate(90, expand=True).crop((490, 250, 640, 580)); save(center.rotate(-90, expand=True), 'wordmark', 88)

if len(sys.argv) > 5:
    with tempfile.TemporaryDirectory() as t:
        subprocess.run(['pdftoppm', '-png', '-r', '130', sys.argv[5], os.path.join(t, 'p')], check=True)
        for i, f in enumerate(sorted(os.listdir(t))): save(Image.open(os.path.join(t, f)).convert('RGB'), 'manual_%02d' % (i + 1), 72)
print('wrote', len(os.listdir(OUT)), 'images to', OUT)
