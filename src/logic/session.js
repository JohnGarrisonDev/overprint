// A sheet in play: the stack, moves, undo, hints, press. Pure (the engine does the maths).
//
// Session shape: { sheet, eng, dist, state, moves, hist, hints, printed, alt }
//   state    the current stack as an engine state number
//   moves    moves used so far: every turn, swap and undo counts one (undo is free to use, but not free)
//   hist     earlier states, newest last, for undo (capped)
//   hints    times the robots were asked for the next move
//   printed  true once the player pressed a solved sheet
//   alt      true when the printed rows are real words but not the answer (an "Alternate edition")
import { makeEngine, bestMove } from './sheet.js'

const HIST_CAP = 400
export const MOVE_CAP = 999

export function newSession(sheet) {
  const eng = makeEngine(sheet)
  const s = { sheet, eng, dist: null, state: eng.encode(sheet.start.order, sheet.start.rots), moves: 0, hist: [], hints: 0, printed: false, alt: false }
  return s
}

/** Distances to a solved stack, built the first time a hint is asked for. */
function distTable(s) {
  if (!s.dist) { const sol = s.eng.solve(); s.dist = s.eng.distances(sol.any) }
  return s.dist
}

export const stack = (s) => s.eng.decode(s.state)
export const grid = (s) => s.eng.grid(s.state)
export const marks = (s) => s.eng.rowMarks(s.state)
export const owners = (s) => s.eng.owners(s.state)
export const ready = (s) => !s.printed && s.eng.isWin(s.state)
export const isOver = (s) => s.printed

function step(s, to) {
  if (s.printed || s.moves >= MOVE_CAP) return false
  s.hist.push(s.state)
  if (s.hist.length > HIST_CAP) s.hist.shift()
  s.state = to
  s.moves++
  return true
}
/** Turn card c a quarter turn clockwise. */
export const turn = (s, c) => c >= 0 && c < s.sheet.k && step(s, s.eng.apply(s.state, { kind: 'turn', card: c }))
/** Swap the cards at stack positions pos and pos + 1 (0 = top). */
export const swap = (s, pos) => pos >= 0 && pos < s.sheet.k - 1 && step(s, s.eng.apply(s.state, { kind: 'swap', pos }))
/** Move card c one place up (dir -1) or down (dir 1) the stack. */
export function shift(s, c, dir) {
  const pos = stack(s).order.indexOf(c), to = pos + dir
  if (pos < 0 || to < 0 || to >= s.sheet.k) return false
  return swap(s, Math.min(pos, to))
}
export function undo(s) {
  if (s.printed || !s.hist.length || s.moves >= MOVE_CAP) return false
  s.state = s.hist.pop()
  s.moves++
  return true
}
/** The next move of a shortest route from here, or null if already solved. Counts a hint. */
export function hint(s) {
  if (s.printed) return null
  const m = bestMove(s.eng, distTable(s), s.state)
  if (m) s.hints++
  return m
}
/** A good first move for the onboarding nudge, preferring one that stamps a new row. Does not count as a hint. */
export function nudge(s) {
  if (s.printed) return null
  const d = distTable(s), cur = d[s.state], have = marks(s).filter(Boolean).length
  let any = null
  for (const m of s.eng.moves(s.state)) {
    if (d[m.to] !== cur - 1) continue
    if (!any) any = m
    if (s.eng.rowMarks(m.to).filter(Boolean).length > have) return m
  }
  return any
}
/** Fewest moves left from the current stack (for the debug hook and tests). */
export const left = (s) => distTable(s)[s.state]

/** Press a solved sheet into print. Returns false if some row is not a word yet. */
export function press(s) {
  if (!ready(s)) return false
  s.printed = true
  const ans = s.eng.encode(s.sheet.answer.order, s.sheet.answer.rots)
  s.alt = s.eng.grid(s.state) !== s.eng.grid(ans)
  return true
}
/** The rows as they read now, as words. */
export function rows(s) { const g = grid(s), n = s.sheet.n, out = []; for (let r = 0; r < n; r++) out.push(g.slice(r * n, r * n + n)); return out }

// ---- snapshots: what the save keeps. They are replayed through the rules, so junk is dropped, not trusted.
export function snapshot(s) { return { state: s.state, moves: s.moves, hist: s.hist.slice(-60), hints: s.hints, printed: s.printed } }
export function restore(sheet, snap) {
  if (!snap || typeof snap !== 'object') return null
  const s = newSession(sheet), total = s.eng.total
  const okState = (x) => Number.isInteger(x) && x >= 0 && x < total
  if (!okState(snap.state)) return null
  s.state = snap.state
  s.moves = Number.isInteger(snap.moves) ? Math.max(0, Math.min(MOVE_CAP, snap.moves)) : 0
  s.hist = Array.isArray(snap.hist) ? snap.hist.filter(okState).slice(-60) : []
  s.hints = Number.isInteger(snap.hints) ? Math.max(0, Math.min(999, snap.hints)) : 0
  if (snap.printed) { if (!press(s)) s.printed = false }
  return s
}
