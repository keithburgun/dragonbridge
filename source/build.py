#!/usr/bin/env python3
"""Build Dragon Bridge from source.

    python3 build.py

Produces:
  dist/dragonbridge.html   the game as one self-contained web page (open it in a browser)
  ../www/index.html        the same file, where app packaging expects it
  dist/page.html           the page without the <html> wrapper (for hosts that add their own)
  dist/dragonbridge-web.zip  index.html zipped, for itch.io's browser player
  tests/eng_all.js         the rules engine + CPU as a Node module, for the automated tests
Needs only Python 3.9+ (no packages)."""
import base64, datetime, json, os, re, zipfile
H = os.path.dirname(os.path.abspath(__file__))
rd = lambda f: open(os.path.join(H, f), encoding='utf-8').read()
def wr(f, s):
    p = os.path.join(H, f); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'w', encoding='utf-8').write(s)

imgs = {}
for f in sorted(os.listdir(os.path.join(H, 'img'))):
    if f.endswith('.webp'): imgs[f[:-5]] = 'data:image/webp;base64,' + base64.b64encode(open(os.path.join(H, 'img', f), 'rb').read()).decode()
pages = len([k for k in imgs if k.startswith('manual_')])
# The two typefaces are embedded so the game looks the same offline and inside the apps (SIL Open Font License).
FONTS = [('Fira Sans', 400, 'normal', 'fira-sans-latin-400-normal'), ('Fira Sans', 600, 'normal', 'fira-sans-latin-600-normal'),
         ('Fira Sans', 800, 'normal', 'fira-sans-latin-800-normal'), ('Cormorant Garamond', 700, 'italic', 'cormorant-garamond-latin-700-italic')]
fontcss = ''.join("@font-face{font-family:'%s';font-weight:%d;font-style:%s;font-display:swap;src:url(data:font/woff2;base64,%s) format('woff2')}\n"
                  % (fam, wt, st, base64.b64encode(open(os.path.join(H, 'fonts', f + '.woff2'), 'rb').read()).decode()) for fam, wt, st, f in FONTS)
engine = rd('engine.js') + '\n' + rd('ai.js')
ver = os.environ.get('DRAGONBRIDGE_VERSION') or datetime.datetime.now().strftime('%Y-%m-%d %H:%M')
page = (rd('template.html').replace('/*FONTS*/', fontcss).replace('/*ENGINE*/', engine + '\nconst APP_VERSION = ' + json.dumps(ver) + ';')
        .replace('/*IMGS*/{}', json.dumps(imgs, separators=(',', ':'))).replace('/*MANUAL_PAGES*/0', str(pages))
        .replace('/*PUZZLES*/[]', rd('puzzles.json').strip())
        .replace('/*REPLAY*/', rd('replay.js')).replace('/*ONLINE*/', rd('online.js')).replace('/*PAD*/', rd('pad.js')))
os.makedirs(os.path.join(H, 'dist'), exist_ok=True)
full = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>body{margin:0}[hidden]{display:none!important}</style>\n<script>window.DB_SYNC=true;window.DB_P2P=true;</script>\n<script>' + rd('vendor/peerjs.min.js').replace('</script', '<\\/script') + '</script>\n' + page   # account sync and online play (PeerJS): the apps, itch.io and your own site (page.html, for claude.ai, has no network access) + '\n</html>\n'
with zipfile.ZipFile(os.path.join(H, 'dist', 'dragonbridge-web.zip'), 'w', zipfile.ZIP_DEFLATED) as z: z.writestr('index.html', full)
# page.html runs inside a host that never lets a page save files, so the replay file-save code is left out of it (the code to copy remains)
wr('dist/page.html', re.sub(r'/\*FILESAVE\*/.*?/\*END FILESAVE\*/', '', page, flags=re.S)); wr('dist/dragonbridge.html', full); wr('../www/index.html', full)
EXPORTS = 'searchTurn,stateKey,evalS,ED2,itemText,hackText,wizLines,ACTIONS,DECK,ITEMS,HACKS,WIZ,WIZ_IDS,newState,Game,simulate,snapshot,checkState,evalS,aiChoose,LEVELS,play,clone,probe,puzzleTurns,puzzleOk,puzzleForced,puzzleTurnsLeft,puzzleReply,puzzleHint,isExit,isThreat,wings,flightNeed'
wr('tests/eng_all.js', engine + '\nmodule.exports={' + EXPORTS + '};\n')
print(f'dist/dragonbridge.html  {len(full) / 1e6:.2f} MB  ({len(imgs)} images, {pages} rulebook pages)')
