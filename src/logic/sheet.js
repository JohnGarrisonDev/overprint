// A sheet and its engine. Pure: no DOM, no clock, no randomness.
//
// A sheet is plain data (JSON safe):
//   { n, k, base, cards, answer, start, par, words }
//   n      grid size (3, 4 or 5); cells are numbered row by row, 0 .. n*n-1
//   k      number of punched cards (1-5)
//   base   the base sheet: n*n lowercase letters, every square printed
//   cards  k strings of n*n characters, a letter where the card is printed and '.' for a hole,
//          in the card's own (unturned) orientation
//   answer { order, rots }: order = card indexes from the top of the stack down, rots[c] = quarter turns
//          clockwise card c has made. `start` has the same shape: how the sheet is handed to the player.
//   par    fewest moves from start to a solved stack (reverse BFS over every stack)
//   words  the answer rows, top to bottom
//
// A move is one quarter turn (clockwise) of one card, or one swap of two neighbouring cards in the stack.
// Letters stay upright when a card turns: a turn moves where the printed squares sit, not which way they face.
import { enable, curated, enableBits, curatedBits } from './words.js'

/** Where cell i of an n x n card lands after r clockwise quarter turns. */
export function turnCell(n, i, r) {
  let row = (i / n) | 0, col = i % n
  for (let t = 0; t < (r & 3); t++) { const nr = col; col = n - 1 - row; row = nr }
  return row * n + col
}

/** Every permutation of 0..k-1 in lexicographic order. */
export function permutations(k) {
  const out = []
  const rec = (pre, rest) => {
    if (!rest.length) { out.push(pre); return }
    for (let i = 0; i < rest.length; i++) rec([...pre, rest[i]], [...rest.slice(0, i), ...rest.slice(i + 1)])
  }
  rec([], Array.from({ length: k }, (_, i) => i))
  return out
}

const permCache = new Map()
function permTables(k) {
  if (permCache.has(k)) return permCache.get(k)
  const perms = permutations(k)
  const index = new Map(perms.map((p, i) => [p.join(','), i]))
  // swapTo[pi * (k-1) + p] = index of the order with positions p and p+1 swapped
  const swapTo = new Int32Array(perms.length * Math.max(1, k - 1))
  perms.forEach((p, pi) => {
    for (let s = 0; s < k - 1; s++) { const q = p.slice(); const t = q[s]; q[s] = q[s + 1]; q[s + 1] = t; swapTo[pi * (k - 1) + s] = index.get(q.join(',')) }
  })
  const t = { perms, index, swapTo }
  permCache.set(k, t)
  return t
}

const code = (ch) => (ch >= 'a' && ch <= 'z' ? ch.charCodeAt(0) - 97 : -1)

/** Build the solver/engine for a sheet. States are integers: permIndex * 4^k + sum(rots[c] * 4^c). */
export function makeEngine(sheet) {
  const { n, k } = sheet, N = n * n
  const { perms, index, swapTo } = permTables(k)
  const R = 4 ** k, total = perms.length * R
  const P4 = Array.from({ length: k }, (_, c) => 4 ** c)
  const base = Int8Array.from(sheet.base, code)
  // lay[c * 4 + r][cell] = letter code shown at `cell` by card c turned r times, or -1 for a hole
  const lay = []
  for (let c = 0; c < k; c++) {
    for (let r = 0; r < 4; r++) {
      const a = new Int8Array(N).fill(-1)
      for (let i = 0; i < N; i++) { const l = code(sheet.cards[c][i]); if (l >= 0) a[turnCell(n, i, r)] = l }
      lay.push(a)
    }
  }

  const encode = (order, rots) => { let s = index.get(order.join(',')) * R; for (let c = 0; c < k; c++) s += (rots[c] & 3) * P4[c]; return s }
  const decode = (s) => {
    const pi = Math.floor(s / R); let rc = s % R
    const rots = []
    for (let c = 0; c < k; c++) { rots.push(rc & 3); rc >>= 2 }
    return { order: perms[pi].slice(), rots }
  }

  // Scratch: the layers of the current stack, top first.
  const stackLay = new Array(k)
  const setStack = (s) => {
    const p = perms[Math.floor(s / R)]; let rc = s % R
    const rots = new Array(k)
    for (let c = 0; c < k; c++) { rots[c] = rc & 3; rc >>= 2 }
    for (let j = 0; j < k; j++) stackLay[j] = lay[p[j] * 4 + rots[p[j]]]
  }
  const cellAt = (i) => { for (let j = 0; j < k; j++) { const l = stackLay[j][i]; if (l >= 0) return l } return base[i] }
  const rowCode = (r) => { let c = 0, m = 1; for (let x = 0; x < n; x++) { c += cellAt(r * n + x) * m; m *= 26 } return c }

  /** Letters on view for a state, as a string of n*n letters. */
  function grid(s) { setStack(s); let out = ''; for (let i = 0; i < N; i++) out += String.fromCharCode(97 + cellAt(i)); return out }
  /** Which card shows at each cell (-1 = the base sheet). */
  function owners(s) {
    const { order, rots } = decode(s), out = []
    for (let i = 0; i < N; i++) { let o = -1; for (const c of order) if (lay[c * 4 + rots[c]][i] >= 0) { o = c; break } out.push(o) }
    return out
  }
  /** For each row: 2 = a curated word, 1 = another ENABLE word, 0 = not a word. */
  function rowMarks(s) {
    setStack(s)
    const out = []
    for (let r = 0; r < n; r++) { const c = rowCode(r); out.push(curated[n].has(c) ? 2 : enable[n].has(c) ? 1 : 0) }
    return out
  }
  const isWin = (s) => { setStack(s); for (let r = 0; r < n; r++) if (!enable[n].has(rowCode(r))) return false; return true }

  /** Try every stack. Returns the states where every row is a curated word, and where every row is a word at all. */
  // flat[(c * 4 + r) * N + cell] = lay[c * 4 + r][cell], for the hot loop below
  const flat = new Int8Array(k * 4 * N)
  for (let q = 0; q < k * 4; q++) flat.set(lay[q], q * N)
  function solve() {
    const cur = [], any = [], en = enableBits[n], cu = curatedBits[n]
    const off = new Int32Array(k)
    for (let pi = 0; pi < perms.length; pi++) {
      const p = perms[pi]
      for (let rc = 0; rc < R; rc++) {
        for (let j = 0; j < k; j++) off[j] = (p[j] * 4 + ((rc >> (2 * p[j])) & 3)) * N
        let ok = true, allCur = true
        for (let r = 0; r < n && ok; r++) {
          let c = 0, m = 1
          for (let x = 0, i = r * n; x < n; x++, i++) {
            let l = -1
            for (let j = 0; j < k; j++) { l = flat[off[j] + i]; if (l >= 0) break }
            if (l < 0) l = base[i]
            c += l * m; m *= 26
          }
          if (!((en[c >>> 5] >>> (c & 31)) & 1)) ok = false
          else if (allCur && !((cu[c >>> 5] >>> (c & 31)) & 1)) allCur = false
        }
        if (ok) { const s = pi * R + rc; any.push(s); if (allCur) cur.push(s) }
      }
    }
    return { curated: cur, any }
  }

  /** Every move from state s: { kind: 'turn', card } or { kind: 'swap', pos }, with the state it leads to. */
  function moves(s) {
    const pi = Math.floor(s / R), rc = s % R, out = []
    for (let c = 0; c < k; c++) { const r = (rc >> (2 * c)) & 3; out.push({ kind: 'turn', card: c, to: s + (((r + 1) & 3) - r) * P4[c] }) }
    for (let p = 0; p < k - 1; p++) out.push({ kind: 'swap', pos: p, to: swapTo[pi * (k - 1) + p] * R + rc })
    return out
  }
  function apply(s, m) {
    const pi = Math.floor(s / R), rc = s % R
    if (m.kind === 'turn') { const r = (rc >> (2 * m.card)) & 3; return s + (((r + 1) & 3) - r) * P4[m.card] }
    return swapTo[pi * (k - 1) + m.pos] * R + rc
  }

  /** Distance from every state to the nearest of `wins`, by reverse BFS (a turn is undone by three more turns). */
  function distances(wins) {
    const dist = new Int16Array(total).fill(-1)
    const q = new Int32Array(total)
    let h = 0, t = 0
    for (const w of wins) if (dist[w] < 0) { dist[w] = 0; q[t++] = w }
    while (h < t) {
      const s = q[h++], d = dist[s] + 1, pi = Math.floor(s / R), rc = s % R
      for (let c = 0; c < k; c++) {
        const r = (rc >> (2 * c)) & 3, prev = s + (((r + 3) & 3) - r) * P4[c] // the state one clockwise turn before
        if (dist[prev] < 0) { dist[prev] = d; q[t++] = prev }
      }
      for (let p = 0; p < k - 1; p++) { const prev = swapTo[pi * (k - 1) + p] * R + rc; if (dist[prev] < 0) { dist[prev] = d; q[t++] = prev } }
    }
    return dist
  }

  return { n, k, N, total, R, perms, lay, base, encode, decode, grid, owners, rowMarks, isWin, solve, moves, apply, distances }
}

/** Shortest moves from `from` to a winning state, given a distance table. Deterministic (first good move wins). */
export function bestMove(eng, dist, from) {
  const d = dist[from]
  if (d <= 0) return null
  for (const m of eng.moves(from)) if (dist[m.to] === d - 1) return m
  return null
}
