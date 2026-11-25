import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitize, defaults } from '../src/logic/save.js'
import { creditDay, streakNow, shareText, rating, stars, ST, dayCounts } from '../src/logic/score.js'
import { dailySheets } from '../src/logic/generate.js'

test('sanitize survives junk', () => {
  for (const junk of [null, 5, 'x', [], { daily: 7 }, { daily: { days: { nope: 1, '2026-02-30': {} } } }, { journey: { stars: 'x', cur: { level: -1 } } }, { free: { n: 9, cur: { seed: 'a' } } }]) {
    const s = sanitize(junk)
    assert.deepEqual(Object.keys(s).sort(), Object.keys(defaults()).sort())
  }
  const s = sanitize({ daily: { days: { '2026-11-24': { sum: [{ st: 2, n: 5, p: 4 }], snaps: [{ state: 3, moves: 2, hist: [1, 'x'] }] } }, streak: 3, best: 1, last: '2026-11-24' } })
  assert.deepEqual(s.daily.days['2026-11-24'].sum[0], { st: 2, n: 5, p: 4, h: 0 })
  assert.deepEqual(s.daily.days['2026-11-24'].snaps[0].hist, [1])
  assert.equal(s.daily.best, 3)
})

test('streaks count days with the Small sheet printed', () => {
  const d = { streak: 0, best: 0, last: '' }
  creditDay(d, '2026-11-24'); creditDay(d, '2026-11-25'); creditDay(d, '2026-11-25')
  assert.equal(d.streak, 2)
  assert.equal(streakNow(d, '2026-11-26'), 2)
  assert.equal(streakNow(d, '2026-11-28'), 0)
  creditDay(d, '2026-11-28')
  assert.deepEqual([d.streak, d.best], [1, 2])
  assert.ok(dayCounts([{ st: ST.done }, { st: 0 }]))
  assert.ok(!dayCounts([{ st: 0 }, { st: ST.done }]))
})

test('share text is spoiler free and ends with the URL', () => {
  const sheets = dailySheets('2026-12-01')
  const t = shareText('2026-12-01', [{ st: 2, n: 6, p: 5, h: 0 }, { st: 2, n: 13, p: 11, h: 1 }])
  assert.equal(t, 'Overprint 2026-12-01 · Small ✓ 6 moves (par 5) · Large ✓ 13 moves (par 11) 💡1\ngames.oddvale.com/overprint/')
  for (const s of sheets) for (const w of s.words) assert.ok(!t.toLowerCase().includes(w))
  assert.ok(shareText('2026-11-29', [{ st: 0, p: 5 }, { st: 0 }], true).includes('Sunday Large –'))
})

test('ratings and stars', () => {
  assert.equal(rating(5, 5).label, 'Par')
  assert.equal(rating(7, 5).label, '+2 moves')
  assert.equal(stars(5, 5, 0), 3)
  assert.equal(stars(8, 5, 1), 2)
  assert.equal(stars(9, 5, 0), 1)
})
