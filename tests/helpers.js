// Shared checks: a sheet is well formed, provably unique, and its par is the true shortest route.
import assert from 'node:assert/strict'
import { makeEngine } from '../src/logic/sheet.js'
import { isCurated, isWord } from '../src/logic/words.js'
import { isBlocked } from '../src/logic/blocklist.js'

export function assertSheet(s, { strict = true } = {}) {
  const N = s.n * s.n
  assert.equal(s.base.length, N)
  assert.ok(/^[a-z]+$/.test(s.base), 'base fully printed')
  assert.equal(s.cards.length, s.k)
  for (const c of s.cards) { assert.equal(c.length, N); assert.ok(/^[a-z.]+$/.test(c)); assert.ok(c.includes('.'), 'a card has holes') }
  assert.equal(s.words.length, s.n)
  for (const w of s.words) { assert.equal(w.length, s.n); assert.ok(isCurated(w), w + ' is curated'); assert.ok(!isBlocked(w), w + ' not blocked') }
  const eng = makeEngine(s)
  const ans = eng.encode(s.answer.order, s.answer.rots)
  assert.equal(eng.grid(ans), s.words.join(''), 'the answer stack reads the words')
  const sol = eng.solve()
  assert.deepEqual(sol.curated, [ans], 'exactly one stack reads curated words')
  if (strict) assert.deepEqual(sol.any, [ans], 'no alternate edition')
  for (const st of sol.any) for (let r = 0; r < s.n; r++) assert.ok(isWord(eng.grid(st).slice(r * s.n, r * s.n + s.n)))
  const start = eng.encode(s.start.order, s.start.rots)
  const dist = eng.distances(sol.any)
  assert.equal(dist[start], s.par, 'par is the shortest route')
  assert.ok(s.par >= 1)
  // every card shows at least one square of the answer
  const own = eng.owners(ans)
  for (let c = 0; c < s.k; c++) assert.ok(own.includes(c), 'card ' + c + ' shows in the answer')
  // toehold: some answer row comes from the base and at most one card
  let toe = false
  for (let r = 0; r < s.n; r++) if (new Set(own.slice(r * s.n, r * s.n + s.n).filter((o) => o >= 0)).size <= 1) toe = true
  assert.ok(toe, 'some row has a toehold')
  return { eng, sol, start, dist }
}
