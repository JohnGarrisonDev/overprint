// Ratings, stars, daily dates, streaks and the share text. Pure.

/** How a finished sheet is described. moves = moves used (undo counts), par = the solver's fewest. */
export function rating(moves, par) {
  const d = moves - par
  if (d <= 0) return { label: 'Par', name: d < 0 ? 'Faster than the press' : 'Clean print', tone: 'gold' }
  const label = `+${d} move${d === 1 ? '' : 's'}`
  if (d <= 2) return { label, name: 'A little smudge', tone: 'good' }
  if (d <= 6) return { label, name: 'Second proof', tone: 'ok' }
  if (d <= 15) return { label, name: 'Ink everywhere', tone: 'plain' }
  return { label, name: 'The robots needed a nap', tone: 'plain' }
}

/** Journey stars: 3 = par with no hints, 2 = within par + 3 and at most one hint, 1 = printed. */
export function stars(moves, par, hints) {
  if (moves <= par && hints === 0) return 3
  if (moves <= par + 3 && hints <= 1) return 2
  return 1
}

// ---- dates (local calendar days as 'YYYY-MM-DD')
const pad = (n) => String(n).padStart(2, '0')
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export function isDateKey(k) {
  if (typeof k !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(k)) return false
  const [y, m, d] = k.split('-').map(Number)
  const t = new Date(y, m - 1, d)
  return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d
}
export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number)
  return dateKey(new Date(y, m - 1, d + n))
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const prettyDate = (key) => { const [, m, d] = key.split('-').map(Number); return `${d} ${MONTHS[m - 1]}` }
export const dayName = (wd) => DAYS[wd]
/** Time until the next local midnight (when new sheets come out), as '5h 12m' / '9m' / 'under a minute'. */
export function untilTomorrow(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const mins = Math.floor((next - now) / 60000)
  if (mins < 1) return 'under a minute'
  const h = Math.floor(mins / 60), m = mins % 60
  return h ? `${h}h ${m}m` : `${m}m`
}

// ---- daily results
// A day's summary is two entries [Small, Large], each { st, n, p, h }:
//   st 0 = not started, 1 = in progress, 2 = printed; n = moves used; p = par; h = hints.
export const ST = { none: 0, going: 1, done: 2 }
export const KINDS = ['Small', 'Large']
export const dayCount = (sum) => (Array.isArray(sum) ? sum.filter((e) => e && e.st === ST.done).length : 0)
/** A day counts for the streak once the Small sheet is printed (on that calendar day). */
export const dayCounts = (sum) => Array.isArray(sum) && !!sum[0] && sum[0].st === ST.done

/** Streak bookkeeping: { streak, best, last } where `last` is the date of the newest counted day. */
export function creditDay(daily, key) {
  if (daily.last === key) return daily
  daily.streak = daily.last === addDays(key, -1) ? daily.streak + 1 : 1
  daily.last = key
  if (daily.streak > daily.best) daily.best = daily.streak
  return daily
}
export const streakNow = (daily, today) => (daily.last === today || daily.last === addDays(today, -1) ? daily.streak : 0)

/** Spoiler-free result line for a day. Never contains a letter from the sheets. */
export function shareText(key, sum, sunday = false) {
  const parts = KINDS.map((name, i) => {
    const e = (sum && sum[i]) || { st: 0, n: 0, p: 0, h: 0 }
    const label = i === 1 && sunday ? 'Sunday Large' : name
    if (e.st !== ST.done) return `${label} –${e.p ? ` (par ${e.p})` : ''}`
    return `${label} ✓ ${e.n} move${e.n === 1 ? '' : 's'} (par ${e.p})${e.h ? ` 💡${e.h}` : ''}`
  })
  return `Overprint ${key} · ${parts.join(' · ')}\nhttps://games.oddvale.com/overprint/`
}
