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
- Bump bonuses from Items, Wizards and Dragon Powers are offered as one yes/no ("Bump 4 instead of 2"); Ruupart's Blade's extra +4 is asked separately. Abragail's and December's turn-long Bump changes are always applied.
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
