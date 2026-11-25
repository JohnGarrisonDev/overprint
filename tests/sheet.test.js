import test from 'node:test'
import assert from 'node:assert/strict'
import { turnCell, permutations, makeEngine, bestMove } from '../src/logic/sheet.js'
import { targets, isWord, isCurated, wordCode, codeWord } from '../src/logic/words.js'
import { isBlocked } from '../src/logic/blocklist.js'
import { symmetry } from '../src/logic/generate.js'

test('word lists', () => {
  for (const n of [3, 4, 5]) {
    assert.ok(targets[n].length > 300, `${n}-letter targets`)
    for (const w of targets[n]) { assert.ok(isWord(w) && isCurated(w) && !isBlocked(w), w); assert.equal(codeWord(wordCode(w), n), w) }
  }
  assert.ok(isWord('gear') && isWord('qat') && !isWord('gxar'))
  assert.ok(!targets[5].includes('cards'), 'plain plurals of shorter words are not targets')
})

test('turning a cell four times comes home; one turn is clockwise', () => {
  for (const n of [3, 4, 5]) for (let i = 0; i < n * n; i++) assert.equal(turnCell(n, i, 4), i)
  assert.equal(turnCell(3, 0, 1), 2) // top-left goes to top-right
  assert.equal(turnCell(3, 2, 1), 8) // top-right goes to bottom-right
  assert.equal(turnCell(4, 5, 2), 10)
})

test('permutations', () => {
  assert.equal(permutations(3).length, 6)
  assert.equal(permutations(5).length, 120)
  assert.deepEqual(permutations(2), [[0, 1], [1, 0]])
})

test('symmetry check', () => {
  assert.equal(symmetry(3, [0, 2, 6, 8]), 1)
  assert.equal(symmetry(3, [0, 8]), 2)
  assert.equal(symmetry(3, [0, 1]), 0)
})

// A hand-made sheet: one 3x3 card over a base. The card prints the top row; turned once it prints the right column.
const tiny = { n: 3, k: 1, base: 'xxxbatxxx'.replace(/x/g, 'o'), cards: ['cat......'], answer: { order: [0], rots: [0] }, start: { order: [0], rots: [1] }, par: 3, words: [] }
test('engine: visible letters, owners, moves, distances', () => {
  const e = makeEngine(tiny)
  assert.equal(e.total, 4)
  assert.equal(e.grid(e.encode([0], [0])), 'catbatooo')
  assert.equal(e.grid(e.encode([0], [1])), 'oocbaaoot')
  assert.deepEqual(e.owners(e.encode([0], [0])), [0, 0, 0, -1, -1, -1, -1, -1, -1])
  assert.deepEqual(e.moves(0).map((m) => m.kind), ['turn'])
  const two = { n: 3, k: 2, base: 'ooooooooo', cards: ['a........', 'b........'], answer: { order: [0, 1], rots: [0, 0] } }
  const e2 = makeEngine(two)
  const s = e2.encode([0, 1], [0, 0])
  assert.equal(e2.grid(s)[0], 'a')
  const sw = e2.apply(s, { kind: 'swap', pos: 0 })
  assert.deepEqual(e2.decode(sw).order, [1, 0])
  assert.equal(e2.grid(sw)[0], 'b')
  // a turn takes three more turns to undo, so distances are not symmetric
  const d = e.distances([e.encode([0], [0])])
  assert.deepEqual([...d], [0, 3, 2, 1])
  const m = bestMove(e, d, e.encode([0], [1]))
  assert.deepEqual([m.kind, m.card], ['turn', 0])
})
