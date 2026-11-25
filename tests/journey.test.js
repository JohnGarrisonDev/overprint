import test from 'node:test'
import assert from 'node:assert/strict'
import { JOURNEY, CHAPTERS, PER_CHAPTER } from '../src/data/journey.js'
import { makeEngine } from '../src/logic/sheet.js'
import { symmetry } from '../src/logic/generate.js'
import { assertSheet } from './helpers.js'

test('60 sheets in 6 chapters of 10', () => {
  assert.equal(JOURNEY.length, 60)
  assert.equal(CHAPTERS.length, 6)
  JOURNEY.forEach((s, i) => assert.equal(s.chapter, Math.floor(i / PER_CHAPTER)))
})

test('the curve: 3x3 with 1-2 cards, then 4x4 with 3, tricks, 4 cards, then 5x5', () => {
  JOURNEY.forEach((s, i) => {
    if (i < 10) { assert.equal(s.n, 3); assert.ok(s.k <= 2) }
    else if (i < 40) { assert.equal(s.n, 4); assert.equal(s.k, 3) }
    else if (i < 50) { assert.equal(s.n, 4); assert.equal(s.k, 4) }
    else { assert.equal(s.n, 5); assert.equal(s.k, 4) }
  })
  assert.equal(JOURNEY[0].par, 1, 'the first sheet is one turn')
  assert.equal(JOURNEY[0].k, 1)
  assert.notDeepEqual(JOURNEY[3].start.order, JOURNEY[3].answer.order, 'sheet 4 teaches the swap')
})

test('every Journey sheet is provably unique and its par is exact', () => {
  for (const s of JOURNEY) assertSheet(s)
})

test('trick sheets carry their trick', () => {
  for (const s of JOURNEY) {
    if (s.trick === 'lone') assert.ok(s.cards.some((c) => c.split('.').length - 1 === 1), 'a card with a lone hole')
    if (s.trick === 'twin') assert.ok(s.cards.some((c) => symmetry(s.n, [...c].flatMap((ch, i) => (ch === '.' ? [] : [i]))) === 2), 'a half-turn twin')
  }
  assert.ok(JOURNEY.filter((s) => s.trick).length >= 10)
})

test('no word is used twice in the Journey', () => {
  const all = JOURNEY.flatMap((s) => s.words)
  assert.equal(new Set(all).size, all.length)
  for (const s of JOURNEY) assert.ok(makeEngine(s))
})
