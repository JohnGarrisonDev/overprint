// Dev-only: how often attempts succeed, how long generation takes, and how distances spread over all stacks.
// node tools/explore.mjs
import { makeRng } from '../kit/kit.js'
import { makeSheet } from '../src/logic/generate.js'
import { makeEngine } from '../src/logic/sheet.js'
import { targets } from '../src/logic/words.js'

console.log('targets', { 3: targets[3].length, 4: targets[4].length, 5: targets[5].length })
const specs = [
  { name: 'small', n: 4, k: 3, print: [4, 7] },
  { name: 'large', n: 5, k: 4, print: [6, 10] },
  { name: 'sunday', n: 5, k: 5, print: [5, 9] },
  { name: 'j3x3-1', n: 3, k: 1, print: [3, 5] },
  { name: 'j3x3-2', n: 3, k: 2, print: [3, 5] },
]
for (const spec of specs) {
  const rng = makeRng(1234)
  const t0 = performance.now()
  const hist = {}, maxes = []
  let made = 0
  for (let i = 0; i < 12; i++) {
    const s = makeSheet(rng, { ...spec, band: [1, 40], pool: targets[spec.n], tries: 2000 })
    if (!s) continue
    made++
    const eng = makeEngine(s)
    const d = eng.distances([eng.encode(s.answer.order, s.answer.rots)])
    let mx = 0
    for (const x of d) { hist[x] = (hist[x] || 0) + 1; if (x > mx) mx = x }
    maxes.push(mx)
  }
  const t1 = performance.now()
  console.log(spec.name, 'made', made, 'ms/sheet', ((t1 - t0) / Math.max(1, made)).toFixed(0), 'max dist', maxes.join(','), 'hist', JSON.stringify(hist))
}
