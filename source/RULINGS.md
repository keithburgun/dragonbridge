# Rulings used by the digital version

Where a card or the manual leaves room, the game does the following. Change any of these in `engine.js`.

**Board and turn**
- 21 tiles: 0–9 on each side of the center. The Dragon starts at the end marked "Dragon Start"; the first player starts on the Start tile nearer the Dragon.
- First player is chosen at random (the manual's Wing-draw gives the same odds).
- Wizards do not block each other and may share a tile.
- You must play an Action card if you have one. The Gem Action is optional.
- If no Gem Action is available to you, the Gem Phase is skipped without asking.
- A MOVE started while standing on an Exit tile wins at once, even a MOVE of 0. Teleports never win.
- Pounce is checked right after the Gem Phase, before the Dragon Check.
- On a Flight the last card put into the Nest becomes the Dragon Power.
- Dragon Powers apply to both players.

**Costs and bonuses**
- "Deplete a Gem to …" on Fireball, Leap and Checkmate is optional.
- A Bump is chosen by picking the tile the target lands on. Each direction offers the plain Bump and the Bump with all your optional bonuses from Items, Wizards and Dragon Powers; with Ruupart's Blade, also each of those with its extra +4. Turn-long Bump changes (Abragail, December, 2nd Edition Eve) are always applied.
- "Away from center" is judged from where the bumped Wizard stands when the Bump starts.
- Gale: the optional Teleport goes the way the opponent was actually pushed.
- Step goes to the Nest before the extra card is played, so the extra card is the "last card played".
- White Gems: every Bump gains one (from the opponent if the supply is empty) unless the card says not to. Other White Gem gains come from the supply only.

**Wizards**
- Derby's Roost Teleport works on any Roost, on either player's turn.
- Eve's "+2 from Purple tiles" looks at the tile Eve stands on.
- Gelf's "MOVE to the opponent's position" counts as a MOVE, so it escapes from an Exit tile. His Gem on the Dragon keeps its ready/depleted side.
- Andromeda stacks depleted Gems first. Her Gem comes back depleted whenever the opponent Bumps her.
- May: the Hack she flips face-up goes under the Hack deck. On her reverse side she can still buy Items when they cost 2.
- Robot Boy's Move value (1, or 3) replaces the printed Move on cards played in his Action Phase.
- Trevor's three Actions are shuffled into the deck instead of going to the Nest.
- Bill and Andromeda's "BUMP Action card" means Fireball, Flame Arrow, Magic Dart, Gale, Shockwave, Checkmate. "MOVE Action card" (Shockwave, Robot Boy) means Dazzle, Charge, Hop, Leap, Checkmate.

**Items**
- Techno-Cutlass "End tile" means any of the ten orange tiles.
- Wing counts read from the cards: Bait 3; Fireball, Flame Arrow, Magic Dart, Transfer, Checkmate 2; Charge, Gale, Insight, Leap, Shockwave 1; Dazzle, Soda, Step, Hop 0.

**Known cards**
- A card counts as seen by the other player when a hand is revealed (Insight, or Shockwave against a hand with no MOVE card) or when it is taken in the open: from the Nest, from a revealed hand, as Bill's gift or Dragon Power swap, or by Lori's search.
- A seen card stays known until it leaves the hand. With two copies of a card and one of them known, playing one leaves the other known.
- The CPU uses the same information and nothing more when it plans.

**2nd Edition (on by default)**

New matches use the 2nd Edition cards unless "2nd Edition rules" is unticked on the Play screen or in Options. The Daily Challenge, the tutorial and the Puzzles always use 2nd Edition. Ten cards differ so far; everything else is unchanged.

| Card | 2nd Edition | Read as |
|---|---|---|
| Eve Williams | Turn start: on a purple tile, +2 Bump this turn | Checked once at turn start, always applied; her 1E Bump and Teleport bonuses are gone |
| May Danaris | After Hacking: Teleport 1 or a White Gem. Gem Action on a purple tile: Bump 1 and the opponent gives a random card | No Hack discount, no face-down Hacks, no reverse side. The Bump gains a White Gem as usual. The card is picked at random by the game; the giver knows which card it was |
| Robot Boy | Game start and Flight: gain a random Item. Roost: lose 1 Item of your choice | "Random" is the top of the shuffled Item Deck, not the Market. Any Flight or Roost counts, on either player's turn. His 1E powers are gone |
| Abragail | 2 or 3 ready Gems for +1 Move, +1 Bump. After buying: may take a Nest card | The "or ready a Gem" choice is gone |
| Roller Skates | +1 Move | Either direction |
| Cool Backpack | When you ready from a green Gem tile, ready again | Applies to the "ready a Gem" Gem Action; nothing on Roost |
| Techno-Cutlass | Opponent lands on an End or Gem tile: they deplete a Gem and discard a White Gem | No +1 Bump. The White Gem returns to the supply |
| Accursed Loom | Its Bump gains no White Gem | |
| Thunderbox | On Flight: Bump 2 | Its owner Bumps on any Flight and keeps the Item; the Dragon Check choice is gone. The Bump gains a White Gem |
| chip tune lullaby | Opponent may reveal and reshuffle a 2-Wing card; if they don't, gain a free Item | 2-Wing cards: Fireball, Flame Arrow, Magic Dart, Transfer, Checkmate. The free Item is chosen from the Market |

**Undo**
- Undo takes back your own choices in the current turn, one at a time.
- It stops at anything that showed hidden information or involved the other player: a card drawn, a revealed hand (Insight, Shockwave), a choice the opponent made (Shockwave, Bill, Lori, chip tune lullaby), a random card or Item, a new Hack or Market card turned up, a Roost or Flight. Choices made after such a moment can still be taken back, down to that moment.
