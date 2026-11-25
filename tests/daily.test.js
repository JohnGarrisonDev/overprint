import test from 'node:test'
import assert from 'node:assert/strict'
import { dailySheets, sheetHash, BANDS, weekday, dayNumber, dayPool, freeSheet, FREE_SIZES } from '../src/logic/generate.js'
import { addDays } from '../src/logic/score.js'
import { assertSheet } from './helpers.js'

test('day numbers and weekdays use integer maths', () => {
  assert.equal(dayNumber('1970-01-01'), 0)
  assert.equal(dayNumber('2026-11-24') - dayNumber('2026-11-23'), 1)
  assert.equal(dayNumber('2028-03-01') - dayNumber('2028-02-28'), 2)
  assert.equal(weekday('2026-11-24'), 2) // a Tuesday
  assert.equal(weekday('2026-11-29'), 0) // a Sunday
})

test('a date always gives the same two sheets', () => {
  const a = dailySheets('2026-11-24'), b = dailySheets('2026-11-24')
  assert.deepEqual(a, b)
  assert.equal(a.length, 2)
  assert.deepEqual([a[0].n, a[0].k, a[1].n, a[1].k], [4, 3, 5, 4])
  assert.notEqual(sheetHash(a[0]), sheetHash(dailySheets('2026-11-25')[0]))
  const sun = dailySheets('2026-11-29')
  assert.equal(sun[1].k, 5)
  assert.ok(sun[1].sunday)
})

test('a year of dailies: provably one answer, par in the weekday band, no target word twice within 60 days', () => {
  let key = '2026-11-24'
  const lastSeen = new Map()
  for (let d = 0; d < 365; d++) {
    const wd = weekday(key)
    for (const s of dailySheets(key)) {
      assertSheet(s)
      const [lo, hi] = BANDS[s.kind][wd]
      assert.ok(s.par >= lo && s.par <= hi, `${key} ${s.kind} par ${s.par} in ${lo}-${hi}`)
      for (const w of s.words) {
        if (lastSeen.has(w)) assert.ok(d - lastSeen.get(w) >= 60, `${w} repeats after ${d - lastSeen.get(w)} days (${key})`)
        lastSeen.set(w, d)
      }
    }
    key = addDays(key, 1)
  }
})

test('word blocks never overlap within 60 days', () => {
  for (const n of [4, 5]) {
    const a = new Set(dayPool(n, '2026-11-24'))
    for (let d = 1; d < 60; d++) for (const w of dayPool(n, addDays('2026-11-24', d))) assert.ok(!a.has(w), `${n}: ${w} on day ${d}`)
  }
})

test('free play makes a sheet for every size and card count', () => {
  for (const size of FREE_SIZES) for (const k of size.cards) {
    const s = freeSheet(1234 + k, size.n, k)
    assert.ok(s, `${size.n}x${size.n} with ${k}`)
    assert.equal(s.n, size.n); assert.equal(s.k, k)
    assertSheet(s, { strict: false })
  }
})

// SNAPSHOT: these hashes pin the dailies every player gets. If this test fails you changed the generator, the word
// lists, the decoy letters or the rng call order. Do NOT paste new hashes in to make it pass (see AGENTS.md).
const SNAPSHOT = {
  '2026-11-24': [3286229577, 2489915437],
  '2026-11-29': [1429915588, 538920003],
  '2026-12-25': [967178909, 3355968136],
  '2027-01-01': [3111537292, 734841510],
  '2028-02-29': [1487888091, 4147689504],
}
test('daily snapshot hashes', () => {
  for (const [key, want] of Object.entries(SNAPSHOT)) assert.deepEqual(dailySheets(key).map(sheetHash), want, key)
})
