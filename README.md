# Overprint

Three printer robots each punched holes in a card. Turn and restack the cards until every row reads a word.

An [Oddvale Games](https://games.oddvale.com) word puzzle, playable at **games.oddvale.com/overprint/**.

A letter grid is printed on a base sheet, and on top sit two to five punched cards. Each card has letters printed on its solid squares and holes everywhere else, so each square shows the topmost printed letter. Turn a card a quarter turn, or swap it with its neighbour in the stack, until every row read left to right is a real word. Then press it into print and read the Oddvale Gazette.

- **Daily:** a Small sheet (4×4, three cards) and a Large sheet (5×5, four cards), the same for everyone. Par rises from Monday to Saturday; Sunday's Large has five cards. Print the Small sheet to keep your streak. A 14-day archive and a spoiler-free result to copy.
- **Journey:** 60 sheets in six chapters, from 3×3 with one card up to 5×5 with four, with trick cards along the way.
- **Free play:** any size from 3×3 to 5×5 and two to five cards.

Every sheet is checked by a brute-force solver that tries every stack (up to 122,880 on a Sunday): exactly one stack makes every row a word. Par is the true fewest moves, found by a breadth-first search over every stack.

## Run it

No build step and no dependencies. Serve the folder with any static server, for example from the hub repo:

```
node ../oddvale-games/scripts/serve.mjs . 4309
```

then open http://localhost:4309/. Add `?debug` for the test hook (`window.__game`, see AGENTS.md).

Tests: `node --test tests/` (Node 20+).

## Code layout

```
index.html              page shell (from the hub's kit/template.html)
game.json               metadata the hub reads
cover.webp              cover art (supplied separately)
kit/                    copy of the hub kit. Do not edit; re-copy from the hub to update
src/main.js             app state, screen flow, input, saving, frame loop, debug hook
src/ui.js               DOM overlays: title, daily, journey, free play, play shell, the Gazette
src/board.js            the sheet (letters, owners, stamps, the turning ghost) and the card tray (tap, drag, wheel)
src/robots.js           the five printer robots: colours, patterns, faces (kit drawOddFace), quips
src/fx.js               canvas over the stage for ink splats and paper confetti
src/audio.js            synth sound effects
src/game.css            styles for everything inside the stage
src/data/guess.js       every 3-5 letter ENABLE word (copied from Rungs)
src/data/puzzle.js      curated common words (copied from Rungs)
src/data/journey.js     GENERATED: the 60 Journey sheets
src/logic/              pure rules, no DOM, shared with the tests
  words.js              word lists as integer codes and bitsets
  blocklist.js          words never used (copied from Rungs)
  sheet.js              the engine: turning, visible letters, the solver, distances (par)
  generate.js           the sheet generator, the dailies, free play
  session.js            a sheet in play: turn, swap, undo, hint, press, snapshots
  score.js              ratings, stars, dates, streaks, share text
  save.js               save schema + sanitiser
tools/                  dev-only: journey builder, par-band and timing report, random-tapping bot, explorer
tests/                  node --test
```

See [AGENTS.md](AGENTS.md) for architecture notes, the daily snapshot rule, balance data and the ideas backlog.

## License
Code is MIT licensed, see [LICENSE](LICENSE). The ENABLE word list is public domain (the lists in `src/data/` are copied from Rungs, another Oddvale game). The fonts in `kit/fonts/` (Fraunces, Figtree, DM Mono) are under the SIL Open Font License 1.1. The Oddvale name and mark are not covered by the MIT license.
