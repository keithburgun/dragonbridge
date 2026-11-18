#!/usr/bin/env python3
"""Add 2nd Edition card faces to source/img as <id>_2e.webp.

    python3 tools/add_2e.py wz_eve=eve.png it_loom=loom_2E.png ...

Each file is one 825x1125 card. The id is the 1st Edition image name (see CARDS in make_assets.py)."""
import os, sys
from PIL import Image
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'img')
for a in sys.argv[1:]:
    gid, path = a.split('=', 1)
    assert os.path.exists(os.path.join(OUT, gid + '.webp')), 'no 1st Edition image called ' + gid
    Image.open(path).convert('RGB').resize((440, 600), Image.LANCZOS).save(os.path.join(OUT, gid + '_2e.webp'), 'WEBP', quality=80, method=6)
    print('wrote', gid + '_2e.webp')
