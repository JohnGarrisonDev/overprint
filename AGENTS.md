# Notes for the next AI

Overprint is an Oddvale Games title. Read the hub's `GAME_GUIDE.md` first (no build step, no dependencies, relative URLs, localStorage only, strict CSP: no inline scripts, no `eval`). This file is what you need on top of that.

## Architecture in one minute

- `src/logic/*` is pure: no DOM, no clock, no `window`, no `Math.random`. All rules live there and are covered by `tests/`.
- `src/main.js` owns the app: one `app` object (screen, day, chapter, `app.play` = the sheet on screen), the `actions` table (every button and key lands there by name), saving, the frame loop and the `?debug` hook.
- `src/ui.js` builds the menus, the play shell and the Gazette once. Buttons carry `data-act`; one click listener calls `actions[name](dataset, el)`.
- `src/board.js` draws the sheet and the tray as DOM. Card tabs keep their elements for the whole sheet and are reordered with CSS `order`, so a drag keeps its pointer capture while the stack changes under it. Taps are handled on `pointerup`; keyboard activation arrives as a `click` with `detail === 0`.
- `src/fx.js` is a canvas over the whole stage (pointer-events none) for ink splats and confetti; pooled particles.
- Sizes are in `em`: `layout()` sets the `.ui` font-size from the stage and adds `.portrait`; `board.layout()` sets `--cell` in px from the free space in `.boardzone`. Landscape: sheet left, tray (vertical, top card first) right. Portrait: tray is a row under the sheet (top card leftmost). **Wide** (landscape with the `.ui` under 560px tall, i.e. a phone on its side in full screen): `.wide` on the stage gives a slim HUD, 44px tabs, Press inside the button row and a two-column Gazette (`.g-col` wrappers, `display: contents` elsewhere). `layout()` measures `.ui`, which full screen insets by the safe areas. The stage is always light paper, also in dark mode.
- Touch (1.2): tapping a square on the sheet selects the card on top there (`board` `onCell`); the tray ignores a second finger and drops a drag on `lostpointercapture`; `haptic()` fires in `act()` (move, stronger on a fresh stamp) and on the press. In full screen the HUD and menu bars keep 50px clear on the right for the kit's exit button, and `.ui` carries the kit's `stage-inset` class (safe-area insets).
- `kit/talk.js` (hub kit, do not edit) adds the anonymous player-input widgets: `dailyTalk` fills `r-talk` at the bottom of the Gazette for **today's** daily sheets only (board `small`/`large`, score = moves, lower is better), and `tellUs` fills `#tell-us` in the info section. Both stay hidden when the studio API is unreachable.
- The shell's `.stage canvas { position: absolute }` would swallow the robot face canvases; `game.css` resets it for `.stage .ui canvas`.

## The rules, precisely

- A sheet: `{ n, k, base, cards, answer, start, par, words }` (schema at the top of `src/logic/sheet.js`). Card strings are in the card's own orientation; `rots[c]` is quarter turns clockwise. Letters stay upright: a turn moves where squares sit (`turnCell`), not how letters face.
- A square shows the letter of the topmost card printed there, else the base. Each robot index = card index (Pica, Elite, Smudge, Serif, Kern).
- A **move** is one clockwise quarter turn of one card, or one swap of two neighbouring cards. **Undo counts as a move** (it is still free to use). Hints make one move of a shortest route and count both a move and a hint. There is no counter-clockwise turn, so par counts three turns for "one back".
- A row **reads** when it is any ENABLE word that is not blocklisted; the sheet can be **pressed** when every row reads (`eng.isWin`). Since 1.3 a row is only **stamped** on screen (`S.marks` / `S.marksAt`) for a curated word, or when the whole sheet reads, so obscure words (MERK) are no false lead. This is display only: the generator and par still use the engine's `rowMarks` (2 curated / 1 ENABLE / 0). The target rows are curated words; a stack whose rows are other ENABLE words would still print as an "Alternate edition", but the generator makes sure that never happens for dailies and the Journey (`strict`). Only the free-play last-resort fallback allows it.
- Par = reverse-BFS distance from the start to a solved stack (`eng.distances`). Moves are not reversible (a turn takes three turns to undo), hence the reverse search with counter-clockwise predecessors.
- Stars (Journey): 3 = par with no hints, 2 = within par + 3 and at most one hint, 1 = printed. Sheet i unlocks when sheet i-1 has a star.
- Streak: a day counts when the **Small** sheet is printed on that calendar day. Archive days never count. The arcade's proposed streak freeze is not in v1 (the Director had not adopted it).
- First visit (no save key at all): the game opens straight on today's Small sheet. Until the player has printed one sheet, a fresh sheet shows a nudge: the tab of a good first move wiggles (a shortest-route move that stamps a row, `S.nudge`) and the message names it. After that only the top tab wiggles at move 0.

## The generator (`src/logic/generate.js`)

1. Pick n target words from the pool. 2. Pick the answer order and rotations, and each card's printed squares in answer position (Small 4-7, Large 6-10, Sunday 6-10 per card); reject a card whose holes look the same after a quarter or half turn (except the Journey's deliberate "twin"). 3. The top printed layer of each square gets the answer letter; every hidden printed layer gets a **decoy**: 35% of the time a letter that turns the answer row into another real word (so wrong stacks nearly read), else an English-frequency letter (no J/Q/X/Z), never the answer letter. Each card must show at least one answer square, and some answer row must come from the base plus at most one card (the **toehold**). 4. Cheap check: no neighbouring stack of the answer reads as words. Then the **solver** tries every stack (`eng.solve`, a tight loop over typed arrays and a word bitset): exactly one stack may read curated words in every row, and (strict) no other stack may read words at all. 5. Pick a random start with par in the band and at most one row already stamped, preferring a start where some shortest-route move stamps a new row.

Daily target words come from a fixed shuffle of the target list (`rota`), one block per day (`dayPool`); the block size makes the cycle at least 61 days, so no target word repeats within 60 days (tested over a year).

## Daily seeds and the snapshot rule

`dailySheets('YYYY-MM-DD')` seeds `makeRng(hashString('overprint:' + date + ':small'))` and `':large'`, uses `BANDS[kind][weekday]`, and Sunday's Large uses the `SUNDAY` spec (five cards). Weekdays come from integer day numbers (`dayNumber`), never `Date`, so every browser and time zone agrees once the local date is known.

Everything that feeds this is part of the daily's identity: the word lists and their order, `targets` filtering, the blocklist, `DECOY`, the rng call order in `attemptSheet` and `decoy`, `BANDS`, the specs, `BLOCK_DAYS`, the rota seed, the permutation order in `sheet.js` and the state encoding. Change any of them and every player's daily changes mid-day.

**Word versions (1.3).** From `WORDS_V2` ('2026-11-28') the day's word block is filtered through `RETIRED` (bookish or British-only words that stay valid and still stamp, but are never answer rows) by `answerPool`. A day whose block has none of them is unchanged. Dates before that use the 1.0 path untouched, and `tests/daily.test.js` freezes every daily from 2026-11-10 to 2026-11-27 (`PUBLISHED`). To retire more words, add a `WORDS_V3` date after the latest published day and keep the older sets as they are. Free play saves the word version with the sheet (`free.cur.w`: 2, missing = 1.0 list) because a free sheet is regenerated from its seed on resume.

`tests/daily.test.js` pins five dates with `sheetHash` (2026-11-29's Small changed once, in 1.3, before it was published). **If that test fails, you changed the dailies. Do not paste new hashes in to make it pass.** For a better generator, add a new code path chosen by date (`if (key >= '2027-06-01') return dailySheetsV2(key)`) with its own frozen copies, and leave the old path alone. Saved snapshots store engine state numbers, so a changed sheet would make old snapshots point at different stacks.

## Journey

`src/data/journey.js` is generated by `node tools/build-journey.mjs` from fixed seeds (`hashString('overprint:journey:' + i)`), and is data, not code: changing the generator does not change it. Stars are saved by index: never reorder, change or remove a sheet; append a chapter (add specs to the builder, regenerate, check the old 60 are byte-identical, update counts in tests, README, CHANGELOG). Tests prove every sheet unique with exact par, check the curve, the tricks (lone hole, half-turn twin) and that no word repeats in the Journey.

## Save data

One blob at `oddvale:overprint`; schema at the top of `src/logic/save.js`. `sanitize()` rebuilds a clean save from anything. In-progress sheets are snapshots `{ state, moves, hist, hints, printed }`, replayed through `session.restore`: bad states are dropped and a snapshot cannot claim a print its rows do not support. Daily keeps the newest 120 days. `last` remembers what was on screen for resume.

## Testing by hand

Serve the folder (README) and open `/?debug`. `window.__game` has `state()` (rows, marks, order, rots, moves, par, `left` = fewest moves left), `step(ms)` (advance the clock; the Gazette waits on it), `tap(card)` (select, or turn if selected), `solve(leave)` (play a shortest route, press at the end), `reset()`, plus `app`, `save`, `actions`, `board`, `fx`, `S`. Drive tabs with dispatched PointerEvents on `.tab[data-card]`; keys with `keydown` on `document.body`. Check desktop and 360-390px phones.

## Balance and feel notes (measured 2026-11-24)

- Target lists: 406 three-letter, 1,173 four-letter, 1,624 five-letter curated words.
- Par is structural (it depends only on how far the start stack is from the answer, not on letters). Over all stacks, Small (384 stacks) has distances 0-12, mean 6; Large (6,144) 0-18; Sunday (122,880) 0-25.
- Bands per weekday (Mon..Sat, Sun): Small 3-4, 4-5, 4-5, 5-6, 5-6, 6-7, Sun 5-6. Large 6-7, 7-8, 7-9, 8-9, 8-10, 9-11, Sunday five cards 10-13. Over 365 days from 2026-11-24 every sheet landed in its band with no fallback (`node tools/bands.mjs`).
- Timing in node: both weekday sheets in median 2 ms (max 65); a Sunday pair median 46 ms (max 149); the Sunday solver over 122,880 stacks median 11 ms. Measured in the browser: about 50 ms for a Sunday pair.
- The "tapping until it works" risk (`node tools/bot.mjs 91`): a random tapper needs a median 294 moves on Small (57x par; 1.5% of runs within par+2), and fails to solve Large in 3,000 moves more often than not. A hot-and-cold tapper that undoes any move that loses a stamp does better but still needs a median 145 moves on Small (27x par, 2.3% within par+2) and 559 on Large. So blind tapping lands nowhere near par and the pitch's "first press counts" rule was **not** needed.
- Until 1.2 stamps counted any ENABLE word, so a wrong stack could stamp a row (MERK). Since 1.3 only curated words stamp (the bots above were measured with the old rule; the hot-and-cold signal is now a little sparser).

## Known weak spots

- Copy result (1.3): when both `navigator.clipboard` and `execCommand('copy')` fail, `showShareText` in `main.js` puts a `.sharepop` (selected read-only text and a Done button) over the game inside `.ui`. Checked by stubbing both to fail; a real copy on a phone is unconfirmed. The share text ends with `https://games.oddvale.com/overprint/`.
- QA saw 5 fast clicks on the picked tray card make 4 moves (free play 5x5, 5 cards, 360x640). Not reproduced in 1.3: 5 single clicks and a double plus a triple click each gave one move per click, with a clean pointerdown / gotpointercapture / pointerup / lostpointercapture order. Suspect a click landing on the wiggling top tab's edge at move 0, which picks the neighbour instead. Retest with a real finger.

- No human playtest of seven consecutive dailies yet (the pitch asked for one). Difficulty claims rest on par data and the bots.
- Mini cards: since 1.3 the picked card opens wider in a portrait tray with 4-5 cards (its mini letters about 7.7px at 360x640 in the page, 9px in full screen; was 4.6px). The other minis got slightly smaller (about 4px). Phone landscape (`.wide`) with five cards still has 4.7px mini letters: tabs are height-limited there.
- Bookish words: 1.3 retired 50 obvious ones from dailies from 2026-11-28 and new free sheets (`RETIRED`). The 3-letter list, the Journey (frozen data) and dailies up to 2026-11-27 still have them; the pick was one AI's judgement, not a player survey.
- Retired words and other curated words still stamp; a curated-but-wrong row (a real common word that is not the answer) is still a valid lead, by design.
- The next-sheets countdown uses the device clock (local midnight), like the daily itself.
- Phone landscape: the kit sizes the stage from viewport height, so it is small unless full screen (full screen uses the `.wide` layout).
- Not checked on a real phone: native full screen (the dev browser pane never settles `requestFullscreen`; the kit falls back to focus mode), iPhone Safari's focus mode, real multi-touch.
- No colour-blind toggle beyond the built-in cues (pattern per robot on every square and tab, name, numbered tabs).

## Ideas backlog

- Landscape phones: a bigger preview of the picked card (the wide tray's tabs are only 44px tall).
- Streak freeze if the studio adopts it (one per five solves, two stored).
- A counter-clockwise turn (would change par for every sheet: version the generator).
- "Proof" mode: show a faint outline of where each card sits in the answer after three hints.
- A seventh Journey chapter with 5×5 five-card sheets and lone-hole tricks.
- A share image of the stamped sheet without letters.
