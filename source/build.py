#!/usr/bin/env python3
"""Build Dragon Bridge from source.

    python3 build.py

Produces:
  dist/dragonbridge.html   the game as one self-contained web page (open it in a browser)
  ../www/index.html        the same file, where app packaging expects it
  dist/page.html           the page without the <html> wrapper (for hosts that add their own)
  tests/eng_all.js         the rules engine + CPU as a Node module, for the automated tests
Needs only Python 3.9+ (no packages)."""
import base64, datetime, json, os, re
H = os.path.dirname(os.path.abspath(__file__))
rd = lambda f: open(os.path.join(H, f), encoding='utf-8').read()
def wr(f, s):
    p = os.path.join(H, f); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'w', encoding='utf-8').write(s)

imgs = {}
for f in sorted(os.listdir(os.path.join(H, 'img'))):
    if f.endswith('.webp'): imgs[f[:-5]] = 'data:image/webp;base64,' + base64.b64encode(open(os.path.join(H, 'img', f), 'rb').read()).decode()
pages = len([k for k in imgs if k.startswith('manual_')])
engine = rd('engine.js') + '\n' + rd('ai.js')
ver = os.environ.get('DRAGONBRIDGE_VERSION') or datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
page = (rd('template.html').replace('/*ENGINE*/', engine + '\nconst APP_VERSION = ' + json.dumps(ver) + ';')
        .replace('/*IMGS*/{}', json.dumps(imgs, separators=(',', ':'))).replace('/*MANUAL_PAGES*/0', str(pages))
        .replace('/*PUZZLES*/[]', rd('puzzles.json').strip()))
full = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>body{margin:0}[hidden]{display:none!important}</style>\n' + page + '\n</html>\n'
wr('dist/page.html', page); wr('dist/dragonbridge.html', full); wr('../www/index.html', full)
EXPORTS = 'ACTIONS,DECK,ITEMS,HACKS,WIZ,WIZ_IDS,newState,Game,simulate,snapshot,checkState,evalS,aiChoose,LEVELS,play,clone,probe,forcedWin,puzzleReply,isExit,isThreat,wings,flightNeed'
wr('tests/eng_all.js', engine + '\nmodule.exports={' + EXPORTS + '};\n')
print(f'dist/dragonbridge.html  {len(full) / 1e6:.2f} MB  ({len(imgs)} images, {pages} rulebook pages)')
