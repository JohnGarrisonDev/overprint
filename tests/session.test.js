import test from 'node:test'
import assert from 'node:assert/strict'
import * as S from '../src/logic/session.js'
import { JOURNEY } from '../src/data/journey.js'
import { dailySheets } from '../src/logic/generate.js'

test('moves, undo counts, press only when every row is a word', () => {
  const sheet = JOURNEY[12]
  const s = S.newSession(sheet)
  assert.equal(s.moves, 0)
  assert.equal(S.press(s), false)
  assert.ok(S.turn(s, 0))
  assert.equal(s.moves, 1)
  const after = s.state
  assert.ok(S.undo(s))
  assert.equal(s.moves, 2, 'undo costs a move')
  assert.notEqual(s.state, after)
  assert.ok(!S.undo(s), 'nothing left to undo')
  assert.ok(!S.swap(s, 5) && !S.turn(s, 9), 'bad moves are refused')
})

test('following hints reaches the answer in exactly par moves', () => {
  for (const sheet of [JOURNEY[0], JOURNEY[20], JOURNEY[55], ...dailySheets('2026-11-29')]) {
    const s = S.newSession(sheet)
    let guard = 0
    while (!S.ready(s) && guard++ < 50) {
      const m = S.hint(s)
      if (m.kind === 'turn') S.turn(s, m.card); else S.swap(s, m.pos)
    }
    assert.equal(s.moves, sheet.par)
    assert.equal(s.hints, sheet.par)
    assert.ok(S.press(s))
    assert.ok(S.isOver(s))
    assert.equal(s.alt, false)
    assert.deepEqual(S.rows(s), sheet.words)
    assert.ok(!S.turn(s, 0), 'a printed sheet is final')
  }
})

test('shift moves a card up or down the stack', () => {
  const sheet = JOURNEY[15], s = S.newSession(sheet)
  const top = S.stack(s).order[0]
  assert.ok(!S.shift(s, top, -1), 'the top card cannot go higher')
  assert.ok(S.shift(s, top, 1))
  assert.equal(S.stack(s).order[1], top)
})

test('snapshots restore, junk is dropped', () => {
  const sheet = JOURNEY[30], s = S.newSession(sheet)
  S.turn(s, 1); S.swap(s, 0); S.turn(s, 2)
  const back = S.restore(sheet, JSON.parse(JSON.stringify(S.snapshot(s))))
  assert.equal(back.state, s.state)
  assert.equal(back.moves, 3)
  assert.ok(S.undo(back))
  assert.equal(S.restore(sheet, { state: 1e9 }), null)
  assert.equal(S.restore(sheet, 'junk'), null)
  const lied = S.restore(sheet, { state: s.state, moves: 3, printed: true })
  assert.equal(lied.printed, false, 'a snapshot cannot claim a print the rows do not support')
})
