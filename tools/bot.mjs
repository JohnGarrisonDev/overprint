// Dev-only: does blind tapping get anywhere near par? (the pitch's "tapping until it works" risk)
// node tools/bot.mjs [days=60]
// Two bots play every daily sheet of the next N days from the real start:
//   random  - taps a random card (turn) or a random neighbouring swap, every time
//   stamps  - a "hot and cold" tapper: tries a random move, keeps it if it does not lose a stamped row,
//             otherwise undoes it (the undo costs a move, as it does for players); 1 in 10 moves is kept regardless
// Both stop at a solved sheet (any word in every row) or after 3000 moves.
import { makeRng } from '../kit/kit.js'
import { dailySheets } from '../src/logic/generate.js'
import { makeEngine } from '../src/logic/sheet.js'
import { addDays } from '../src/logic/score.js'

const days = Number(process.argv[2] || 60)
const CAP = 3000
const rng = makeRng(99)
const stampsOf = (eng, s) => eng.rowMarks(s).filter(Boolean).length

function randomBot(eng, s0) {
  let s = s0, n = 0
  while (!eng.isWin(s) && n < CAP) { const ms = eng.moves(s); s = ms[rng.int(ms.length)].to; n++ }
  return n
}
function stampBot(eng, s0) {
  let s = s0, n = 0
  while (!eng.isWin(s) && n < CAP) {
    const ms = eng.moves(s), m = ms[rng.int(ms.length)]
    const before = stampsOf(eng, s), after = stampsOf(eng, m.to)
    n++
    if (after >= before || rng() < 0.1) s = m.to
    else n++ // tried it, saw a stamp fall off, undid it
  }
  return n
}

const rows = { small: [], large: [], sunday: [] }
let key = '2026-11-24'
for (let d = 0; d < days; d++) {
  for (const sh of dailySheets(key)) {
    const eng = makeEngine(sh), s0 = eng.encode(sh.start.order, sh.start.rots)
    const r = [], g = []
    for (let t = 0; t < 20; t++) { r.push(randomBot(eng, s0)); g.push(stampBot(eng, s0)) }
    rows[sh.sunday ? 'sunday' : sh.kind].push({ par: sh.par, random: r, stamps: g })
  }
  key = addDays(key, 1)
}
const median = (a) => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1] }
const pct = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(b.length * p))] }
for (const [kind, list] of Object.entries(rows)) {
  if (!list.length) continue
  const pars = list.map((x) => x.par), rand = list.flatMap((x) => x.random), st = list.flatMap((x) => x.stamps)
  const ratioR = list.flatMap((x) => x.random.map((v) => v / x.par)), ratioS = list.flatMap((x) => x.stamps.map((v) => v / x.par))
  const nearR = list.flatMap((x) => x.random.map((v) => v <= x.par + 2)).filter(Boolean).length / ratioR.length
  const nearS = list.flatMap((x) => x.stamps.map((v) => v <= x.par + 2)).filter(Boolean).length / ratioS.length
  console.log(`${kind}: ${list.length} sheets, median par ${median(pars)}`)
  console.log(`  random tapper: median ${median(rand)} moves (${median(ratioR).toFixed(1)}x par), 10th pct ${pct(rand, 0.1)}, within par+2: ${(nearR * 100).toFixed(1)}%`)
  console.log(`  stamp tapper:  median ${median(st)} moves (${median(ratioS).toFixed(1)}x par), 10th pct ${pct(st, 0.1)}, within par+2: ${(nearS * 100).toFixed(1)}%`)
}
