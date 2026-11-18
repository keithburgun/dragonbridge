# Dragon Bridge — digital

The 2-player card game Dragon Bridge as a single-file web game, modelled on the Spellstorm app.
Open `www/index.html` (or `source/dist/dragonbridge.html`) in a browser to play.

## What's in the first version

- Full rules with the Bridge-Hacking expansion always on: 17 Action cards, 15 Wizards, 9 Items, 9 Bridge Hacks, White Gems, Dragon Powers, Flight and Roost.
- 2nd Edition rules, on by default, with a setting to play the printed 1st Edition. The changed cards are listed in `source/RULINGS.md`; add new 2E faces with `tools/add_2e.py`.
- The bridge lies sideways; Wizards and the Dragon are circular face tokens.
- CPU opponents: Easy, Normal, Hard, Expert. Optional Expert Tips.
- Modes: Versus, Tournament (8 Wizards, single elimination), Ranked (Elo, ranks 1–10), Daily Challenge, Puzzles (10, each with a verified forced win).
- How to Play (coached first match), Card Library, Rulebook (the printed manual), Stats and Achievements, Options, match log, save and continue.

- Undo for your own choices this turn, until something hidden is revealed. Mobile View (Options) plays in a phone-shaped portrait layout on any screen.

Not ported from Spellstorm yet: online play and accounts, the Linux / Steam / Reddit builds, in-app updates, translations, controller prompts, replays.
Left out on purpose: Free-for-All, Co-op and Two-on-Two (Dragon Bridge is 2-player).

## Layout

| Path | What it is |
|---|---|
| `source/engine.js` | The rules. `play(S)` is a generator that asks for every choice a player makes |
| `source/ai.js` | CPU players and the exact search used for puzzles |
| `source/template.html` | The interface: screens, bridge, modes, stats, tutorial |
| `source/img/` | Card art, face tokens, bridge and rulebook pages (cut from the print sheets by `tools/make_assets.py`) |
| `source/puzzles.json` | The puzzles (made by `tests/puzzle_gen.js`) |
| `source/build.py` | Assembles everything into one HTML file |
| `source/RULINGS.md` | How the cards were read where the text leaves room |
| `www/index.html` | The built game |
| `desktop/`, `capacitor.config.json`, `branding/` | The Windows (Electron) and Android (Capacitor) wrappers and their icons |
| `source/fonts/` | Fira Sans and Cormorant Garamond (SIL Open Font License), embedded in the page |

## Releases (GitHub Actions → itch.io)

Every push to `main` runs **Build Dragon Bridge** (`.github/workflows/build.yml`): it builds the browser version from
`source/`, runs the rules tests, wraps the same page as an Android APK (Capacitor, locked to portrait) and a Windows
portable EXE (Electron), publishes all three as a GitHub Release numbered `1.0.<run number>`, and pushes them to
itch.io with butler (channels `android`, `windows`, `html5`).

One-time setup, in the repo's Settings → Secrets and variables → Actions:

| Name | Kind | What it is |
|---|---|---|
| `BUTLER_API_KEY` | secret | An itch.io API key (itch.io → Settings → API keys → Generate new API key). Without it the release is still built, but nothing is uploaded to itch.io |
| `ANDROID_KEYSTORE`, `ANDROID_KEYSTORE_PASSWORD` | secrets | The APK signing key as base64, and its password. The same two values as in the Spellstorm repo work. Without them each APK is signed with a throwaway key, so a new version won't install over an old one |
| `ITCH_GAME` | variable (optional) | `user/game` on itch.io. Defaults to `keithburgungames/dragon-bridge-digital` |

To make a new signing key instead: `keytool -genkeypair -keystore db.jks -alias dragonbridge -keyalg RSA -keysize 2048 -validity 10000`, then `base64 -w0 db.jks` is the `ANDROID_KEYSTORE` value. Keep the file: losing it means players must uninstall before updating.

After the first upload, on the itch.io page's Edit screen: tick "This file will be played in the browser" on the `html5` upload and set the kind of project to HTML.

**Upload to itch.io** (`itch.yml`) re-sends the latest release without rebuilding, for example right after adding the key.

App icons and splash screens come from `source/tools/make_branding.py`.

## Build and test

    cd source
    python3 build.py                       # writes dist/dragonbridge.html, ../www/index.html, tests/eng_all.js
    node tests/fuzz.js 6                   # 1,350 random games across every Wizard pair; must not crash or lose a card
    node tests/ladder.js hard normal 30    # CPU ladder: the first level should win more
    tests/arena_par.sh expert v1:expert 60 2   # current CPU vs the first-release CPU (tests/ai_v1.js), 120 games on 2 cores
    node tests/browser_check.js 1280 800   # plays every mode in a real browser (needs Playwright); also try 390 780
    node tests/ed2.js                      # each 2nd Edition card change
    node tests/browser_ed.js               # the 2nd Edition setting in a browser
    node tests/known.js                    # Insight / Shockwave reveals and which cards stay known
    node tests/browser_view.js             # Mobile View and Undo
    node tests/browser_ui.js               # drag-to-play, hover preview, Buy / Hack menus, side log

Needs Python 3.9+ and Node 18+. Rebuilding the images needs Pillow and the four print sheets.
