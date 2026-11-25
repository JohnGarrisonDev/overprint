// Save schema for localStorage key "oddvale:overprint". Pure: sanitize() turns anything into a well-formed save.
//
// {
//   v: 1,
//   daily:   { days: { 'YYYY-MM-DD': { sum: [{ st, n, p, h } x2], snaps: [snap | null x2] } }, streak, best, last },
//   journey: { stars: [0..3 per level], best: [fewest moves or 0 per level], cur: { level, snap } | null },
//   free:    { n, k, printed, cur: { seed, n, k, snap } | null },
//   last:    { mode: 'daily' | 'journey' | 'free', date?, idx? } | null   (what was on screen, for resume)
//   printed: total sheets printed anywhere (the first-sheet nudges stop after one)
// }
// `sum` entries: st 0 none / 1 going / 2 printed, n moves, p par, h hints (see score.js). Index 0 = Small, 1 = Large.
// `snap` is a session snapshot (session.js): { state, moves, hist, hints, printed }. It is replayed through the
// rules when loaded, so a junk snapshot is dropped rather than trusted.
import { isDateKey } from './score.js'

export const SAVE_VERSION = 1
const DAYS_CAP = 120, LEVEL_CAP = 600

export const defaults = () => ({
  v: SAVE_VERSION,
  daily: { days: {}, streak: 0, best: 0, last: '' },
  journey: { stars: [], best: [], cur: null },
  free: { n: 4, k: 3, printed: 0, cur: null },
  last: null,
  printed: 0,
})

const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {})
const int = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d)

export function cleanSnap(raw) {
  const r = obj(raw)
  if (!Number.isInteger(r.state) || r.state < 0 || r.state > 1e7) return null
  const hist = Array.isArray(r.hist) ? r.hist.filter((x) => Number.isInteger(x) && x >= 0 && x <= 1e7).slice(-60) : []
  return { state: r.state, moves: int(r.moves, 0, 999, 0), hist, hints: int(r.hints, 0, 999, 0), printed: !!r.printed }
}
const cleanSum = (raw) => {
  const out = []
  for (let i = 0; i < 2; i++) {
    const e = obj(Array.isArray(raw) ? raw[i] : null)
    out.push({ st: int(e.st, 0, 2, 0), n: int(e.n, 0, 999, 0), p: int(e.p, 0, 99, 0), h: int(e.h, 0, 999, 0) })
  }
  return out
}

/** Return a clean save built from whatever was in storage. Never throws. */
export function sanitize(raw) {
  const out = defaults()
  try {
    const r = obj(raw)
    const d = obj(r.daily), days = obj(d.days)
    for (const k of Object.keys(days).filter(isDateKey).sort().slice(-DAYS_CAP)) {
      const e = obj(days[k])
      out.daily.days[k] = { sum: cleanSum(e.sum), snaps: [0, 1].map((i) => cleanSnap(Array.isArray(e.snaps) ? e.snaps[i] : null)) }
    }
    out.daily.streak = int(d.streak, 0, 1e6, 0)
    out.daily.best = Math.max(int(d.best, 0, 1e6, 0), out.daily.streak)
    out.daily.last = isDateKey(d.last) ? d.last : ''
    if (!out.daily.last) out.daily.streak = 0

    const j = obj(r.journey)
    if (Array.isArray(j.stars)) out.journey.stars = j.stars.slice(0, LEVEL_CAP).map((s) => int(s, 0, 3, 0))
    if (Array.isArray(j.best)) out.journey.best = j.best.slice(0, LEVEL_CAP).map((s) => int(s, 0, 999, 0))
    const jc = obj(j.cur), js = cleanSnap(jc.snap)
    if (Number.isInteger(jc.level) && jc.level >= 0 && jc.level < LEVEL_CAP && js) out.journey.cur = { level: jc.level, snap: js }

    const f = obj(r.free)
    out.free.n = [3, 4, 5].includes(f.n) ? f.n : 4
    out.free.k = int(f.k, 1, 5, 3)
    out.free.printed = int(f.printed, 0, 1e9, 0)
    const fc = obj(f.cur), fs = cleanSnap(fc.snap)
    if (Number.isFinite(fc.seed) && [3, 4, 5].includes(fc.n) && Number.isInteger(fc.k) && fc.k >= 1 && fc.k <= 5 && fs) out.free.cur = { seed: fc.seed >>> 0, n: fc.n, k: fc.k, snap: fs }

    const l = obj(r.last)
    if (l.mode === 'journey' || l.mode === 'free') out.last = { mode: l.mode }
    else if (l.mode === 'daily' && isDateKey(l.date)) out.last = { mode: 'daily', date: l.date, idx: int(l.idx, 0, 1, 0) }
    out.printed = int(r.printed, 0, 1e9, 0)
  } catch { return defaults() }
  return out
}
