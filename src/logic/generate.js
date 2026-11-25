// Sheet generator: target rows, punched cards, decoy letters, a uniqueness proof and par. Pure and seeded.
// Everything here feeds the dailies. Read AGENTS.md ("Daily seeds and the snapshot rule") before changing a line.
import { makeRng, hashString } from '../../kit/kit.js'
import { targets, enable, wordCode } from './words.js'
import { makeEngine, turnCell } from './sheet.js'

// Letter weights for decoys (rough English frequency; no J, Q, X, Z so wrong stacks still look like words).
const DECOY = 'eeeeeeeeeeeetttttttttaaaaaaaaooooooooiiiiiiinnnnnnnssssssrrrrrrhhhhhllllddddcccuuummmffppggwwyybbvk'

const shuffle = (rng, a) => { for (let i = a.length - 1; i > 0; i--) { const j = rng.int(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t } return a }
const sample = (rng, n, m) => shuffle(rng, Array.from({ length: n }, (_, i) => i)).slice(0, m)

function maskTurn(n, cells, r) { return new Set([...cells].map((i) => turnCell(n, i, r))) }
const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x))
/** 1 = looks the same after a quarter turn, 2 = after a half turn, 0 = never. */
export function symmetry(n, cells) {
  const s = new Set(cells)
  if (sameSet(s, maskTurn(n, s, 1))) return 1
  if (sameSet(s, maskTurn(n, s, 2))) return 2
  return 0
}

/**
 * Make one sheet, or null if `tries` attempts all fail.
 * spec: { n, k, print: [lo, hi] printed squares per card, band: [lo, hi] par band, pool: target words,
 *         trick: '' | 'lone' (one card printed everywhere but one hole) | 'twin' (one card's holes look the same after
 *         a half turn), strict: true to reject any alternate answer made of other ENABLE words,
 *         mustSwap: the start stack is in a different order from the answer, tries }
 */
export function makeSheet(rng, spec) {
  const { n, k, print, band, pool, trick = '', strict = true, mustSwap = false, tries = 400 } = spec
  const N = n * n
  for (let attempt = 0; attempt < tries; attempt++) {
    const sheet = attemptSheet(rng, n, k, N, print, band, pool, trick, strict, mustSwap)
    if (sheet) return sheet
  }
  return null
}

function attemptSheet(rng, n, k, N, print, band, pool, trick, strict, mustSwap) {
  // 1. target rows
  const words = sample(rng, pool.length, n).map((i) => pool[i])
  // 2. answer stack and where each card prints, in answer position
  const order = shuffle(rng, Array.from({ length: k }, (_, i) => i))
  const rots = Array.from({ length: k }, () => rng.int(4))
  const masks = []
  for (let c = 0; c < k; c++) {
    let m = print[0] + rng.int(print[1] - print[0] + 1)
    if (trick === 'lone' && c === order[k - 1]) m = N - 1
    let cells = new Set(sample(rng, N, m))
    if (trick === 'twin' && c === order[0]) {
      // build a mask that repeats after a half turn: pick cells in pairs (i, its half-turn partner)
      cells = new Set()
      for (const i of sample(rng, N, N)) {
        if (cells.size >= m) break
        cells.add(i); cells.add(turnCell(n, i, 2))
      }
      if (symmetry(n, cells) !== 2) return null
    } else if (symmetry(n, cells)) return null
    masks.push(cells)
  }
  // 3. letters: the top printed layer of each square gets the answer letter, every hidden printed layer a decoy
  const target = words.join('')
  const frame = masks.map(() => new Array(N).fill('.'))
  const base = new Array(N).fill('')
  const shown = new Array(k).fill(0)
  const ownerOf = new Array(N).fill(-1)
  for (let i = 0; i < N; i++) {
    let top = true
    for (const c of order) {
      if (!masks[c].has(i)) continue
      frame[c][i] = top ? target[i] : decoy(rng, n, words, i)
      if (top) { shown[c]++; ownerOf[i] = c }
      top = false
    }
    base[i] = top ? target[i] : decoy(rng, n, words, i)
  }
  if (shown.some((x) => x === 0)) return null
  // toehold: some answer row is printed by the base and at most one card
  let toehold = false
  for (let r = 0; r < n && !toehold; r++) { const own = new Set(); for (let x = 0; x < n; x++) if (ownerOf[r * n + x] >= 0) own.add(ownerOf[r * n + x]); if (own.size <= 1) toehold = true }
  if (!toehold) return null
  // the card in its own orientation: cell i shows at turnCell(i, rots[c]) once turned rots[c] times
  const cards = frame.map((f, c) => Array.from({ length: N }, (_, i) => f[turnCell(n, i, rots[c])]).join(''))
  const sheet = { n, k, base: base.join(''), cards, answer: { order, rots }, start: null, par: 0, words }
  // 4. the proof: exactly one stack reads curated words in every row (and, when strict, no other stack reads words at all)
  const eng = makeEngine(sheet)
  const ans = eng.encode(order, rots)
  // cheap first: a neighbouring stack that also reads as words (two cards that never overlap, say) fails fast
  if (eng.moves(ans).some((m) => eng.isWin(m.to))) return null
  const sol = eng.solve()
  if (sol.curated.length !== 1 || sol.curated[0] !== ans) return null
  if (strict && sol.any.length !== 1) return null
  // 5. a scrambled start whose par sits in the band. Prefer starts where one good move stamps a new row (the toehold).
  const dist = eng.distances(sol.any)
  const stamps = (s) => eng.rowMarks(s).filter(Boolean).length
  let start = -1
  for (let t = 0; t < 300; t++) {
    const s = rng.int(eng.total), d = dist[s]
    if (d < band[0] || d > band[1]) continue
    if (mustSwap && Math.floor(s / eng.R) === Math.floor(ans / eng.R)) continue
    const stamped = stamps(s)
    if (stamped > 1) continue
    if (start < 0) start = s
    if (eng.moves(s).some((m) => dist[m.to] === d - 1 && stamps(m.to) > stamped)) { start = s; break }
  }
  if (start < 0) return null
  sheet.start = eng.decode(start)
  sheet.par = dist[start]
  return sheet
}

/** A decoy for square i: never the answer letter; sometimes one that turns the answer row into another word. */
function decoy(rng, n, words, i) {
  const r = (i / n) | 0, x = i % n, w = words[r], want = w[x]
  if (rng() < 0.35) {
    const near = []
    for (let l = 0; l < 26; l++) {
      const ch = String.fromCharCode(97 + l)
      if (ch === want) continue
      if (enable[n].has(wordCode(w.slice(0, x) + ch + w.slice(x + 1)))) near.push(ch)
    }
    if (near.length) return near[rng.int(near.length)]
  }
  let ch = want
  while (ch === want) ch = DECOY[rng.int(DECOY.length)]
  return ch
}

// ---------------------------------------------------------------- daily

/** Days since 1970-01-01 for a 'YYYY-MM-DD' key. Integer maths only (no Date, no time zones). */
export function dayNumber(key) {
  let [y, m, d] = key.split('-').map(Number)
  y -= m <= 2 ? 1 : 0
  const era = Math.floor(y / 400), yoe = y - era * 400
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}
/** 0 = Sunday ... 6 = Saturday. */
export const weekday = (key) => (((dayNumber(key) + 4) % 7) + 7) % 7

/** Par bands per weekday (Sunday first). Measured over a year of dates: see tools/bands.mjs and AGENTS.md. */
export const BANDS = {
  small: [[5, 6], [3, 4], [4, 5], [4, 5], [5, 6], [5, 6], [6, 7]],
  large: [[10, 13], [6, 7], [7, 8], [7, 9], [8, 9], [8, 10], [9, 11]],
}
export const DAILY = [
  { id: 'small', name: 'Small', n: 4, k: 3, print: [4, 7] },
  { id: 'large', name: 'Large', n: 5, k: 4, print: [6, 10] },
]
export const SUNDAY = { id: 'large', name: 'Large', n: 5, k: 5, print: [6, 10], sunday: true }

// Target words come from a fixed shuffle of the list, a block per day, so no word repeats within 60 days.
const BLOCK_DAYS = 61
const rotaCache = {}
function rota(n) {
  if (!rotaCache[n]) rotaCache[n] = shuffle(makeRng(hashString('overprint:rota:' + n)), targets[n].slice())
  return rotaCache[n]
}
export function dayPool(n, key) {
  const list = rota(n), L = list.length, S = Math.floor(L / BLOCK_DAYS)
  const d = dayNumber(key), cycle = Math.floor(L / S)
  const b = ((d % cycle) + cycle) % cycle
  return list.slice(b * S, b * S + S)
}

/** The two daily sheets for a date: [Small, Large]. Sunday's Large has five cards. */
export function dailySheets(key) {
  const wd = weekday(key)
  return DAILY.map((kind, i) => {
    const spec = i === 1 && wd === 0 ? SUNDAY : kind
    const rng = makeRng(hashString('overprint:' + key + ':' + kind.id))
    const band = BANDS[kind.id][wd]
    let sheet = makeSheet(rng, { ...spec, band, pool: dayPool(spec.n, key), tries: 300 })
    // Fallbacks keep the day playable if the strict search ever comes up empty: widen the band, then allow
    // alternate ENABLE answers (still accepted in play, still never a second curated answer).
    if (!sheet) sheet = makeSheet(rng, { ...spec, band: [band[0] - 1, band[1] + 2], pool: dayPool(spec.n, key), tries: 300 })
    if (!sheet) sheet = makeSheet(rng, { ...spec, band: [2, 20], pool: dayPool(spec.n, key), strict: false, tries: 600 })
    return { ...sheet, kind: kind.id, sunday: !!spec.sunday }
  })
}

// ---------------------------------------------------------------- free play

export const FREE_SIZES = [
  { n: 3, cards: [1, 2, 3], print: [3, 5] },
  { n: 4, cards: [2, 3, 4], print: [4, 7] },
  { n: 5, cards: [3, 4, 5], print: [5, 10] },
]
export function freeSpec(n, k) {
  const size = FREE_SIZES.find((s) => s.n === n) || FREE_SIZES[1]
  const kk = size.cards.includes(k) ? k : size.cards[1]
  const lo = kk <= 2 ? 2 : kk === 3 ? 3 : kk === 4 ? 5 : 7
  return { n: size.n, k: kk, print: size.print, band: [lo, lo + (kk >= 4 ? 5 : 3)] }
}
export function freeSheet(seed, n, k) {
  const spec = freeSpec(n, k)
  const rng = makeRng(seed >>> 0)
  return makeSheet(rng, { ...spec, pool: targets[spec.n], tries: 300 })
    || makeSheet(rng, { ...spec, band: [1, 30], pool: targets[spec.n], strict: false, tries: 600 })
}

/** A short stable fingerprint of a sheet, for snapshot tests. */
export function sheetHash(s) {
  return hashString([s.n, s.k, s.base, s.cards.join('|'), s.answer.order.join(''), s.answer.rots.join(''), s.start.order.join(''), s.start.rots.join(''), s.par, s.words.join(',')].join('/'))
}
