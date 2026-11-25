// Dev-only: generate a year of dailies and report par per weekday, generation time and solver time.
// node tools/bands.mjs [start=2026-11-24] [days=365]
import { dailySheets, weekday, BANDS } from '../src/logic/generate.js'
import { makeEngine } from '../src/logic/sheet.js'
import { addDays, dayName } from '../src/logic/score.js'

const start = process.argv[2] || '2026-11-24', days = Number(process.argv[3] || 365)
const par = { small: Array.from({ length: 7 }, () => []), large: Array.from({ length: 7 }, () => []) }
const gen = { small: [], large: [], sunday: [] }, solveMs = [], fallbacks = []
let key = start
for (let d = 0; d < days; d++) {
  const wd = weekday(key)
  const t0 = performance.now()
  const sheets = dailySheets(key)
  const t1 = performance.now()
  sheets.forEach((s) => {
    par[s.kind][wd].push(s.par)
    const [lo, hi] = BANDS[s.kind][wd]
    if (s.par < lo || s.par > hi) fallbacks.push(`${key} ${s.kind} par ${s.par}`)
  })
  gen[wd === 0 ? 'sunday' : 'large'].push(t1 - t0)
  if (wd === 0) { const e = makeEngine(sheets[1]); const a = performance.now(); e.solve(); solveMs.push(performance.now() - a) }
  key = addDays(key, 1)
}
const stat = (a) => { if (!a.length) return '-'; const b = a.slice().sort((x, y) => x - y); return `min ${b[0]} median ${b[b.length >> 1]} max ${b[b.length - 1]}` }
const ms = (a) => { const b = a.slice().sort((x, y) => x - y); return `median ${b[b.length >> 1].toFixed(0)}ms, max ${b[b.length - 1].toFixed(0)}ms` }
for (const kind of ['small', 'large']) {
  console.log(kind)
  for (const wd of [1, 2, 3, 4, 5, 6, 0]) {
    const hist = {}
    for (const p of par[kind][wd]) hist[p] = (hist[p] || 0) + 1
    console.log(`  ${dayName(wd).padEnd(9)} band ${BANDS[kind][wd].join('-').padEnd(5)} ${stat(par[kind][wd])}  ${JSON.stringify(hist)}`)
  }
}
console.log('generate both sheets, weekdays:', ms(gen.large))
console.log('generate both sheets, Sundays:', ms(gen.sunday))
console.log('Sunday solver (all 122,880 stacks):', ms(solveMs))
console.log('outside band (fallbacks):', fallbacks.length ? fallbacks.join('; ') : 'none')
