# Dragon Bridge — digital

The 2-player card game Dragon Bridge as a single-file web game, modelled on the Spellstorm app.
Open `www/index.html` (or `source/dist/dragonbridge.html`) in a browser to play.

## What's in the first version

- Full rules with the Bridge-Hacking expansion always on: 17 Action cards, 15 Wizards, 9 Items, 9 Bridge Hacks, White Gems, Dragon Powers, Flight and Roost.
- 2nd Edition rules, on by default, with a setting to play the printed 1st Edition. The changed cards are listed in `source/RULINGS.md`; add new 2E faces with `tools/add_2e.py`.
- The bridge lies sideways; Wizards and the Dragon are circular face tokens.
- CPU opponents: Easy, Normal, Hard, Expert. Optional Expert Tips.
- Modes: Versus, Tournament (8 Wizards, single elimination), Ranked (Elo, ranks 1–10; every Wizard has its own rating, and so does playing Random), Daily Challenge, Puzzles (9 hand-built positions that each teach one thing, with a named goal such as "Escape in 2 turns!"; they use the normal rules, full hands and normal draws, and each player's draws are scripted so they come in the same order whatever anyone plays; each is proved solvable, and proved unsolvable without its lesson).
- How to Play (coached first match), Card Library, Rulebook (the printed manual), Stats and Achievements, Options, match log, save and continue.

- Undo for your own choices this turn, until something hidden is revealed. Mobile View (Options) plays in a phone-shaped portrait layout on any screen.

Not ported from Spellstorm yet: online play, the Linux / Steam / Reddit builds, translations, controller prompts, replays.
Left out on purpose: Free-for-All, Co-op and Two-on-Two (Dragon Bridge is 2-player). Mirror matches (both players as the same Wizard) are not offered anywhere.

- Optional account (Options → Account): sign in to keep stats, Ranked ratings, achievements, puzzles and settings in sync across devices. See "Accounts and sync" below.
- The Android app and the Windows .exe update themselves: the title screen shows **Update Available!** when a newer release exists.

## Layout

| Path | What it is |
|---|---|
| `source/engine.js` | The rules. `play(S)` is a generator that asks for every choice a player makes |
| `source/ai.js` | CPU players and the exact search used for puzzles |
| `source/template.html` | The interface: screens, bridge, modes, stats, tutorial |
| `source/img/` | Card art, face tokens, bridge and rulebook pages (cut from the print sheets by `tools/make_assets.py`) |
| `source/puzzles.json` | The puzzles, written by `tests/puzzle_build.js`, which defines each one by hand and proves it |
| `source/build.py` | Assembles everything into one HTML file |
| `source/RULINGS.md` | How the cards were read where the text leaves room |
| `www/index.html` | The built game |
| `desktop/`, `capacitor.config.json`, `branding/` | The Windows (Electron) and Android (Capacitor) wrappers and their icons |
| `branding/java/` | The Android app's activity and its updater plugin (downloads the new APK and opens Android's installer) |
| `docs/supabase_setup.sql` | The one-time database setup for account sync |
| `PRIVACY.md` | The privacy policy |
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

## Accounts and sync

Signing in is optional and works the way it does in Spellstorm. Dragon Bridge has its own Supabase project ("dragonbridge"), so its accounts are separate from Spellstorm's. Save data is in the table `dragonbridge_saves`: one private row per account.

**One-time setup (done for the current project):** open the Supabase project → SQL Editor, paste `docs/supabase_setup.sql` and run it. Until that table exists, signing in works but the game says "Account sync isn't switched on for Dragon Bridge yet" and keeps progress on the device.

- What syncs: stats, Ranked ratings, achievements, trophies, puzzles, Daily results, a Tournament in progress, and most options. Mobile View and Sound stay per device. A match in progress stays on the device.
- If two devices both played before syncing, the results are merged: wins, losses and games add up; ratings and settings take the more recent value; achievements keep their earliest date.
- Signing out leaves everything in the account and returns the device to a fresh guest profile. "Erase all progress" while signed in also empties the account's copy.
- The project URL, publishable key and table name are at `SUPA` in `source/template.html`. To move to another Supabase project, change them there and run the same SQL in that project.
- Password-reset and confirmation emails come from that Supabase project, so they use its email templates and its Site URL (Authentication → URL Configuration).
- Sync is on in the apps, the itch.io page and `dist/dragonbridge.html`. It is off in `dist/page.html` (the claude.ai version), which has no network access.

## In-app updates

The Android app and the Windows .exe ask GitHub for the latest release of this repository when the title screen opens (at most every few minutes). If it is newer than the running version, the title screen shows **Update Available!** and Options shows an Updates box.

- Windows: the portable .exe downloads the new one, replaces itself in place and restarts (`desktop/main.js`).
- Android: the app downloads the new APK and opens Android's installer, which asks the player to confirm (`branding/java/UpdaterPlugin.java`). This only works when every release is signed with the same key, so `ANDROID_KEYSTORE` must be set.
- Only files from this repository's own releases are accepted. The browser versions are always current and show no update prompts.

## Build and test

    cd source
    python3 build.py                       # writes dist/dragonbridge.html, ../www/index.html, tests/eng_all.js
    node tests/fuzz.js 6                   # 1,350 random games across every Wizard pair; must not crash or lose a card
    node tests/ai_sense.js                 # a lost CPU still doesn't walk toward the Dragon
    node tests/ladder.js hard normal 30    # CPU ladder: the first level should win more
    tests/arena_par.sh expert v2:expert 300 2  # current CPU vs an earlier one (tests/ai_v2.js = v1.0.10, ai_v1.js = first release), 600 games on 2 cores
    tests/exp.sh '{"base":"hard","dets":4}' 200   # A/B one change to a level's settings or evaluation weights against v2
    node tests/tune.js 1500 1              # hill-climb the evaluation weights by fast one-ply self-play
    node tests/browser_check.js 1280 800   # plays every mode in a real browser (needs Playwright); also try 390 780
    node tests/ed2.js                      # each 2nd Edition card change
    node tests/browser_ed.js               # the 2nd Edition setting in a browser
    node tests/known.js                    # Insight / Shockwave reveals and which cards stay known
    node tests/browser_drama.js            # slides, the Dragon's Flight arc, escape and pounce endings
    node tests/browser_view.js             # Mobile View and Undo
    node tests/browser_ui.js               # drag-to-play, hover preview, Buy / Hack menus, side log
    node tests/puzzle_draws.js             # puzzle draws come in the same order whatever is played
    node tests/browser_sync.js             # Ranked ratings, account sync (against tests/supa_mock.js), update prompts

Needs Python 3.9+ and Node 18+. Rebuilding the images needs Pillow and the four print sheets.
