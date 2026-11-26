import test from 'node:test'
import assert from 'node:assert/strict'
import { dailySheets, sheetHash, BANDS, weekday, dayNumber, dayPool, freeSheet, FREE_SIZES, RETIRED, WORDS_V2 } from '../src/logic/generate.js'
import { targets } from '../src/logic/words.js'
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
// 2026-11-29 Small changed once, in 1.3 (before it was published), when bookish words left the answer pool
// (RETIRED, from WORDS_V2 = 2026-11-28). It was [1429915588, 538920003].
const SNAPSHOT = {
  '2026-11-24': [3286229577, 2489915437],
  '2026-11-29': [1012184944, 538920003],
  '2026-12-25': [967178909, 3355968136],
  '2027-01-01': [3111537292, 734841510],
  '2028-02-29': [1487888091, 4147689504],
}
test('daily snapshot hashes', () => {
  for (const [key, want] of Object.entries(SNAPSHOT)) assert.deepEqual(dailySheets(key).map(sheetHash), want, key)
})

// FROZEN: every daily up to 2026-11-27 has been published (and the archive shows 14 days back). These hashes were
// taken from 1.2.0 before the 1.3 word change; they must never change.
const PUBLISHED = {
  '2026-11-10': [2719191106, 2789404824], '2026-11-11': [2237405971, 3284718354], '2026-11-12': [217048546, 107580324],
  '2026-11-13': [152646453, 4269007294], '2026-11-14': [2107623502, 2799334438], '2026-11-15': [2693356421, 2859467063],
  '2026-11-16': [4004082607, 2269733403], '2026-11-17': [3747854218, 1895435976], '2026-11-18': [2666272641, 812325842],
  '2026-11-19': [3472141057, 4069438123], '2026-11-20': [188348974, 713218652], '2026-11-21': [2370492159, 750429075],
  '2026-11-22': [3852610524, 3719995003], '2026-11-23': [2562869394, 2751653057], '2026-11-24': [3286229577, 2489915437],
  '2026-11-25': [2560038813, 1492531631], '2026-11-26': [3012961826, 358269499], '2026-11-27': [2354339948, 1804758298],
}
test('published dailies (up to 2026-11-27) are unchanged', () => {
  assert.ok(WORDS_V2 > '2026-11-27')
  for (const [key, want] of Object.entries(PUBLISHED)) assert.deepEqual(dailySheets(key).map(sheetHash), want, key)
})

test('retired bookish words: still words, never an answer row from 2026-11-28 on', () => {
  for (const w of RETIRED) assert.ok(targets[w.length].includes(w), `${w} is a target word`)
  let key = WORDS_V2
  for (let d = 0; d < 120; d++) {
    for (const s of dailySheets(key)) for (const w of s.words) assert.ok(!RETIRED.has(w), `${key}: ${w}`)
    key = addDays(key, 1)
  }
  for (let seed = 1; seed <= 20; seed++) for (const w of freeSheet(seed, 4, 3, 2).words) assert.ok(!RETIRED.has(w), w)
})
