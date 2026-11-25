// Overprint: app state, screen flow, input, saving, frame loop and the ?debug hook.
// Rules live in src/logic (pure, tested). ui.js builds the menus, board.js draws the sheet and the tray,
// fx.js draws ink splats and confetti on a canvas over everything. None of them hold game state.
import { makeStore, wireChrome } from '../kit/kit.js'
import { dailyTalk, tellUs } from '../kit/talk.js'
import { createUI, starsHtml, esc } from './ui.js'
import { createBoard } from './board.js'
import { createFx } from './fx.js'
import { snd } from './audio.js'
import { ROBOTS, paintRobot, quip } from './robots.js'
import { sanitize, defaults } from './logic/save.js'
import { dailySheets, freeSheet, FREE_SIZES, weekday } from './logic/generate.js'
import { JOURNEY, CHAPTERS, PER_CHAPTER } from './data/journey.js'
import * as S from './logic/session.js'
import { rating, stars as starCount, dateKey, addDays, prettyDate, dayName, ST, KINDS, dayCount, dayCounts, creditDay, streakNow, shareText } from './logic/score.js'

const stage = document.getElementById('stage')
const canvas = document.getElementById('game')
const uiRoot = document.getElementById('ui')
let firstVisit = false
try { firstVisit = localStorage.getItem('oddvale:overprint') === null } catch { firstVisit = false }
const store = makeStore('overprint', defaults())
const save = sanitize(store.data)
const persist = () => store.set(save)
const ARCHIVE_DAYS = 14

const app = { screen: 'title', today: dateKey(), day: dateKey(), chapter: 0, play: null, portrait: false }
const fx = createFx(canvas)
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')

// ---------------------------------------------------------------- helpers
const dailyCache = new Map()
function sheetsFor(key) {
  if (!dailyCache.has(key)) { if (dailyCache.size > 16) dailyCache.clear(); dailyCache.set(key, dailySheets(key)) }
  return dailyCache.get(key)
}
function dayEntry(key, create) {
  let d = save.daily.days[key]
  if (!d && create) d = save.daily.days[key] = { sum: [0, 1].map(() => ({ st: 0, n: 0, p: 0, h: 0 })), snaps: [null, null] }
  return d
}
const journeyUnlocked = (i) => i === 0 || (save.journey.stars[i - 1] || 0) > 0
const journeyNext = () => { for (let i = 0; i < JOURNEY.length; i++) if (!(save.journey.stars[i] > 0)) return i; return JOURNEY.length - 1 }
const totalStars = () => save.journey.stars.slice(0, JOURNEY.length).reduce((a, b) => a + (b || 0), 0)
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
const kindName = (sheet) => (sheet.kind === 'large' ? (sheet.sunday ? 'Sunday Large' : 'Large') : 'Small')

function crewHtml(list) { return list.map((c) => `<canvas class="face r${c}" data-robot="${c}"></canvas>`).join('') }
function paintCrew(el) { for (const cv of el.querySelectorAll('canvas[data-robot]')) paintRobot(cv, Number(cv.dataset.robot)) }

// ---------------------------------------------------------------- title + menus
function go(screen) {
  if (screen !== app.screen) fx.clear()
  app.screen = screen
  ui.show(screen)
  layout()
}

function openTitle() {
  app.today = dateKey(); app.play = null
  save.last = null; persist()
  const sum = save.daily.days[app.today] && save.daily.days[app.today].sum
  const n = dayCount(sum), streak = streakNow(save.daily, app.today)
  ui.text('t-daily', `${n === 2 ? 'Today: both sheets printed' : n ? 'Today: 1 of 2 printed' : `${dayName(weekday(app.today))}'s two sheets`} · streak ${streak}`)
  let strip = ''
  for (let i = 6; i >= 0; i--) {
    const k = addDays(app.today, -i), s = save.daily.days[k] && save.daily.days[k].sum, c = dayCount(s)
    strip += `<i class="dot ${c === 2 ? 'full' : dayCounts(s) ? 'most' : c ? 'part' : ''}${i === 0 ? ' today' : ''}"></i>`
  }
  ui.html('t-strip', strip)
  ui.text('t-journey', `${totalStars()} of ${JOURNEY.length * 3} stars · ${JOURNEY.length} sheets`)
  ui.text('t-free', save.free.printed ? `${plural(save.free.printed, 'sheet')} printed` : 'Pick a size and a stack')
  go('title')
}

function openDaily(key) {
  app.today = dateKey()
  app.day = key && key <= app.today && key >= addDays(app.today, -(ARCHIVE_DAYS - 1)) ? key : app.today
  paintDaily()
  go('daily')
}
function paintDaily() {
  const key = app.day, isToday = key === app.today, sheets = sheetsFor(key), d = dayEntry(key, false), wd = weekday(key)
  ui.text('d-streak', `Streak ${streakNow(save.daily, app.today)} · best ${save.daily.best}`)
  ui.text('d-date', isToday ? `Today · ${dayName(wd)}` : `${dayName(wd)} ${prettyDate(key)}`)
  ui.text('d-note', isToday ? `${prettyDate(key)} · the same two sheets for everyone${wd === 0 ? ' · Sunday edition' : ''}` : 'From the archive · does not count for the streak')
  ui.f['d-prev'].disabled = key <= addDays(app.today, -(ARCHIVE_DAYS - 1))
  ui.f['d-next'].disabled = isToday
  ui.html('d-list', sheets.map((s, i) => {
    const e = d ? d.sum[i] : { st: 0 }
    const status = e.st === ST.done ? `<b>${e.n}</b> moves · par ${s.par}` : e.st === ST.going && e.n ? `${plural(e.n, 'move')} in` : 'Print'
    return `<button class="dcard k${i} ${e.st === ST.done ? 'done' : ''}" data-act="daily-play" data-i="${i}">
      <span class="dk"><b>${kindName(s)}</b><small>${s.n}×${s.n} · ${s.k} cards · par ${s.par}</small></span>
      <span class="dmini" aria-hidden="true">${crewHtml(Array.from({ length: s.k }, (_, c) => c))}</span>
      <span class="ds st${e.st}">${status}</span></button>`
  }).join(''))
  paintCrew(ui.f['d-list'])
  const sum = d && d.sum, n = dayCount(sum)
  ui.f['d-copy'].disabled = !n
  ui.text('d-copy', 'Copy result')
  let total = 'Print the Small sheet to keep your streak.'
  if (n === 2) { const used = sum.reduce((a, e) => a + e.n, 0), par = sum.reduce((a, e) => a + e.p, 0); total = `Both printed: ${used} moves, par ${par}.` }
  else if (dayCounts(sum)) total = 'Small printed. The Large sheet is the bonus.'
  else if (n) total = 'Large printed. The Small sheet counts for the streak.'
  ui.text('d-total', total)
  let days = ''
  for (let i = ARCHIVE_DAYS - 1; i >= 0; i--) {
    const k = addDays(app.today, -i), s = save.daily.days[k] && save.daily.days[k].sum, c = dayCount(s)
    days += `<button class="day ${c === 2 ? 'full' : dayCounts(s) ? 'most' : c ? 'part' : ''}${k === key ? ' on' : ''}" data-act="goday" data-date="${k}" aria-label="${prettyDate(k)}: ${c} of 2 printed">${Number(k.slice(8))}</button>`
  }
  ui.html('d-days', days)
}

function openJourney(chapter) {
  app.chapter = Math.max(0, Math.min(CHAPTERS.length - 1, chapter ?? Math.floor(journeyNext() / PER_CHAPTER)))
  paintJourney()
  go('journey')
}
function paintJourney() {
  const c = app.chapter, ch = CHAPTERS[c]
  ui.text('j-total', `${totalStars()} / ${JOURNEY.length * 3} ★`)
  ui.text('j-chno', `Chapter ${c + 1} of ${CHAPTERS.length}`)
  ui.text('j-chname', ch.name)
  ui.text('j-blurb', ch.blurb)
  ui.f['j-prev'].disabled = c === 0
  ui.f['j-next'].disabled = c === CHAPTERS.length - 1
  const next = journeyNext()
  let h = ''
  for (let k = 0; k < PER_CHAPTER; k++) {
    const i = c * PER_CHAPTER + k, s = JOURNEY[i], st = save.journey.stars[i] || 0
    if (!journeyUnlocked(i)) { h += `<button class="lvl locked" disabled aria-label="Sheet ${i + 1}, locked"><b>${i + 1}</b><small>locked</small></button>`; continue }
    h += `<button class="lvl ${st ? 'done' : ''} ${i === next ? 'next' : ''}" data-act="journey-play" data-i="${i}" aria-label="Sheet ${i + 1}: ${s.n} by ${s.n}, ${s.k} cards, par ${s.par}, ${st} stars">
      <b>${i + 1}</b><small>${s.n}×${s.n} · ${plural(s.k, 'card')}</small>${starsHtml(st)}</button>`
  }
  ui.html('j-grid', h)
}

function openFree() { paintFree(); go('free') }
function paintFree() {
  const f = save.free
  const size = FREE_SIZES.find((s) => s.n === f.n) || FREE_SIZES[1]
  if (!size.cards.includes(f.k)) f.k = size.cards[1]
  ui.text('f-total', `${f.printed} printed`)
  ui.html('f-size', FREE_SIZES.map((s) => `<button class="${f.n === s.n ? 'on' : ''}" data-act="f-size" data-v="${s.n}" aria-pressed="${f.n === s.n}">${s.n}×${s.n}</button>`).join(''))
  ui.html('f-cards', size.cards.map((k) => `<button class="${f.k === k ? 'on' : ''}" data-act="f-cards" data-v="${k}" aria-pressed="${f.k === k}">${k}</button>`).join(''))
  ui.text('f-note', `${f.n}-letter rows, ${plural(f.k, 'card')}. A fresh sheet every time, still with exactly one answer.`)
  ui.f['f-resume'].hidden = !(f.cur && f.cur.snap && !f.cur.snap.printed)
}

// ---------------------------------------------------------------- play
function begin(mode, sheet, snap, meta) {
  const session = S.restore(sheet, snap) || S.newSession(sheet)
  const top = S.stack(session).order[0]
  app.play = { mode, sheet, session, meta, sel: top, resultIn: 0, fresh: null, note: null, wasReady: S.ready(session), nudge: null }
  save.last = mode === 'daily' ? { mode, date: meta.date, idx: meta.idx } : { mode }
  persist()
  go('play')
  board.build(sheet, session.eng)
  ui.f.result.hidden = true
  if (session.moves === 0 && !session.printed) {
    if (save.printed === 0) {
      const m = S.nudge(session)
      if (m) app.play.nudge = m
      if (m && m.kind === 'turn') app.play.sel = m.card
    }
  }
  paint()
  board.wiggle(session.moves === 0 && !session.printed ? (app.play.nudge && app.play.nudge.kind === 'turn' ? app.play.nudge.card : top) : -1)
  if (S.isOver(session)) openResult(false)
}
function startDaily(i) {
  const key = app.day, sheet = sheetsFor(key)[i], d = dayEntry(key, false)
  begin('daily', sheet, d && d.snaps[i], { date: key, idx: i })
}
function startJourney(i, resume = true) {
  if (!JOURNEY[i] || !journeyUnlocked(i)) return openJourney()
  const cur = save.journey.cur
  begin('journey', JOURNEY[i], resume && cur && cur.level === i ? cur.snap : null, { level: i })
}
function startFree(fresh) {
  const f = save.free
  if (fresh || !f.cur) f.cur = { seed: ((Date.now() % 2147483647) ^ Math.floor(Math.random() * 4294967296)) >>> 0, n: f.n, k: f.k, snap: null }
  const sheet = freeSheet(f.cur.seed, f.cur.n, f.cur.k)
  if (!sheet) { ui.toast('The press jammed. Try again.'); return openFree() }
  begin('free', sheet, f.cur.snap, {})
}

function view(changed = null, fresh = null) {
  const p = app.play, s = p.session, st = S.stack(s)
  return { grid: S.grid(s), owners: S.owners(s), marks: S.marks(s), order: st.order, rots: st.rots, sel: S.isOver(s) ? -1 : p.sel, changed, fresh }
}
function defaultMsg() {
  const p = app.play, s = p.session, n = p.sheet.n
  const read = S.marks(s).filter(Boolean).length
  if (S.ready(s)) return 'Every row reads! Press it into print.'
  if (p.nudge && s.moves === 0) {
    const m = p.nudge
    if (m.kind === 'turn') return `Tap ${ROBOTS[m.card].name}'s tab to turn the card.`
    const c = S.stack(s).order[m.pos]
    return `Drag ${ROBOTS[c].name}'s tab down the stack, or press the down arrow.`
  }
  if (s.moves === 0) return 'Turn and stack the cards until every row is a word.'
  return read ? `${read} of ${n} rows read. ${read === n - 1 ? 'One to go.' : ''}`.trim() : 'No row reads yet. Keep turning.'
}
function paint(changed = null, fresh = null) {
  const p = app.play
  if (!p) return
  const s = p.session, l = p.sheet, over = S.isOver(s), ready = S.ready(s)
  if (p.mode === 'daily') { ui.text('p-mode', p.meta.date === app.today ? 'Daily' : `Daily · ${prettyDate(p.meta.date)}`); ui.text('p-name', kindName(l)) }
  else if (p.mode === 'journey') { ui.text('p-mode', CHAPTERS[JOURNEY[p.meta.level].chapter].name); ui.text('p-name', `Sheet ${p.meta.level + 1}`) }
  else { ui.text('p-mode', 'Free play'); ui.text('p-name', `${l.n}×${l.n} · ${plural(l.k, 'card')}`) }
  ui.text('p-par', String(l.par))
  ui.text('p-moves', String(s.moves))
  ui.f['p-mchip'].classList.toggle('over', s.moves > l.par)
  ui.text('p-hints', String(s.hints))
  ui.f['p-hchip'].hidden = !s.hints
  board.render(view(changed, fresh))
  const top = S.stack(s).order[0], bottom = S.stack(s).order[l.k - 1]
  ui.f['p-undo'].disabled = over || !s.hist.length
  ui.f['p-hint'].disabled = over || ready
  ui.f['p-turn'].disabled = over
  ui.f['p-raise'].disabled = over || p.sel === top
  ui.f['p-lower'].disabled = over || p.sel === bottom
  ui.f['p-press'].disabled = !ready
  ui.f['p-press'].classList.toggle('ready', ready)
  ui.f['p-actions'].hidden = over
  ui.f['p-over'].hidden = !over
  stage.classList.toggle('one-card', l.k === 1)
  if (over) {
    const r = rating(s.moves, l.par)
    ui.text('p-next', nextLabel())
    ui.msg(s.alt ? 'Printed: an alternate edition.' : `Printed · ${r.label} · ${r.name}`, 'good')
  } else if (p.note) ui.msg(p.note.text, p.note.tone)
  else ui.msg(defaultMsg(), ready ? 'go' : '')
}
const note = (text, tone = '') => { app.play.note = { text, tone } }

function savePlay() {
  const p = app.play, s = p.session, snap = S.snapshot(s)
  if (p.mode === 'daily') {
    const d = dayEntry(p.meta.date, true)
    d.snaps[p.meta.idx] = snap
    d.sum[p.meta.idx] = { st: s.printed ? ST.done : ST.going, n: s.moves, p: p.sheet.par, h: s.hints }
  } else if (p.mode === 'journey') save.journey.cur = s.printed ? null : { level: p.meta.level, snap }
  else if (save.free.cur) save.free.cur.snap = snap
  persist()
}

/** Run one move (a function that changes the session) and show what it did. */
function act(fn, sound, after) {
  const p = app.play
  if (!p || S.isOver(p.session)) return false
  const s = p.session
  const g0 = S.grid(s), m0 = S.marks(s), o0 = S.owners(s)
  if (!fn()) { snd.nope(); return false }
  p.note = null
  if (p.nudge) { p.nudge = null; board.wiggle(-1) }
  const g1 = S.grid(s), m1 = S.marks(s), o1 = S.owners(s)
  const changed = new Set()
  for (let i = 0; i < g1.length; i++) if (g0[i] !== g1[i] || o0[i] !== o1[i]) changed.add(i)
  const fresh = new Set()
  let lost = false
  m1.forEach((m, r) => { if (m && !m0[r]) fresh.add(r); if (!m && m0[r]) lost = true })
  if (after) after()
  paint(changed, fresh)
  sound()
  const read = m1.filter(Boolean).length
  if (fresh.size) {
    setTimeout(() => snd.stamp(read), 120)
    const sr = stage.getBoundingClientRect()
    for (const r of fresh) { const pt = board.stampPoint(r, sr); fx.splat(pt.x, pt.y, ROBOTS[(r + read) % ROBOTS.length].color, 14) }
  } else if (lost) setTimeout(() => snd.unstamp(), 90)
  const ready = S.ready(s)
  if (ready && !p.wasReady) setTimeout(() => snd.ready(), 260)
  p.wasReady = ready
  savePlay()
  return true
}

function turnCard(c) {
  const p = app.play
  if (!p || S.isOver(p.session)) return
  const from = S.stack(p.session).rots[c]
  p.sel = c
  act(() => S.turn(p.session, c), () => snd.turn(), () => board.ghostTurn(c, from))
}
function shiftCard(c, dir) {
  const p = app.play
  if (!p || S.isOver(p.session)) return
  p.sel = c
  act(() => S.shift(p.session, c, dir), () => snd.swap(), () => board.bump(c))
}
function selectCard(c) {
  const p = app.play
  if (!p || S.isOver(p.session) || p.sel === c) return
  p.sel = c
  snd.pick()
  paint()
}

function finish() {
  const p = app.play, s = p.session, n = s.moves, par = p.sheet.par
  p.fresh = { stars: 0, best: false, streak: 0 }
  save.printed++
  if (p.mode === 'journey') {
    const i = p.meta.level, j = save.journey
    while (j.stars.length <= i) j.stars.push(0)
    while (j.best.length <= i) j.best.push(0)
    const st = starCount(n, par, s.hints)
    p.fresh.stars = st
    p.fresh.best = j.best[i] > 0 && n < j.best[i]
    j.stars[i] = Math.max(j.stars[i], st)
    j.best[i] = j.best[i] > 0 ? Math.min(j.best[i], n) : n
  } else if (p.mode === 'free') save.free.printed++
  savePlay()
  if (p.mode === 'daily' && p.meta.date === dateKey() && p.meta.idx === 0) {
    if (save.daily.last !== p.meta.date) { creditDay(save.daily, p.meta.date); p.fresh.streak = save.daily.streak; persist() }
  }
  // the press comes down
  const sr = stage.getBoundingClientRect(), box = board.sheetRect(sr)
  for (let r = 0; r < p.sheet.n; r++) { const pt = board.stampPoint(r, sr); fx.splat(pt.x, pt.y, ROBOTS[r % p.sheet.k].color, 18) }
  fx.confetti(box.x, box.y, box.w, ROBOTS.slice(0, Math.max(2, p.sheet.k)).map((r) => r.color).concat(['#fbf6ec']))
  const b = ui.f['p-board']
  b.classList.remove('pressed'); void b.offsetWidth; b.classList.add('pressed')
  snd.press()
  p.resultIn = reduced.matches ? 0.4 : 1.2
}

function nextLabel() {
  const p = app.play
  if (p.mode === 'journey') return p.meta.level + 1 < JOURNEY.length ? 'Next sheet' : 'Back to Journey'
  if (p.mode === 'free') return 'New sheet'
  return p.meta.idx === 0 ? 'Large sheet' : 'Back to Daily'
}

function openResult(animated = true) {
  const p = app.play
  if (!p || !S.isOver(p.session)) return
  const s = p.session, l = p.sheet, n = s.moves, r = rating(n, l.par)
  if (p.mode === 'daily') {
    ui.text('r-dateline', `${dayName(weekday(p.meta.date))} ${prettyDate(p.meta.date)} · Daily`)
    ui.text('r-edition', l.sunday ? 'Sunday edition · five robots' : `${kindName(l)} edition`)
  } else if (p.mode === 'journey') {
    ui.text('r-dateline', `Journey · sheet ${p.meta.level + 1} of ${JOURNEY.length}`)
    ui.text('r-edition', CHAPTERS[JOURNEY[p.meta.level].chapter].name + ' edition')
  } else {
    ui.text('r-dateline', 'Free play · late edition')
    ui.text('r-edition', `${l.n}×${l.n} · ${plural(l.k, 'card')}`)
  }
  const rows = S.rows(s)
  ui.html('r-headline', rows.map((w) => `<span>${esc(w.toUpperCase())}</span>`).join(' '))
  ui.text('r-deck', `Printed in ${plural(n, 'move')} · par ${l.par} · ${r.name}${s.hints ? ` · ${plural(s.hints, 'hint')}` : ''}`)
  const st = p.mode === 'journey' ? starCount(n, l.par, s.hints) : 0
  ui.html('r-stars', st ? starsHtml(st, 'big') : '')
  const crew = S.stack(s).order
  ui.html('r-crew', crewHtml(crew))
  ui.text('r-quote', quip(crew.map((c) => ROBOTS[c].name), l.words))
  let extra = ''
  if (s.alt) extra = `Real words, but not the robots' layout. Their edition read ${l.words.map((w) => w.toUpperCase()).join(' ')}.`
  else if (n < l.par) extra = 'Under par? The press is impressed.'
  else if (p.mode === 'journey' && p.fresh && p.fresh.best) extra = 'A new best for this sheet.'
  if (p.mode === 'daily') {
    const d = dayEntry(p.meta.date, false), c = dayCount(d && d.sum)
    if (p.fresh && p.fresh.streak) extra = (extra ? extra + ' ' : '') + `Streak: ${p.fresh.streak}.`
    else if (!extra) extra = c === 2 ? (p.meta.date === app.today ? 'Both sheets printed. New ones tomorrow.' : 'Both sheets printed for this day.') : p.meta.idx === 0 ? 'The Large sheet is waiting, if you fancy it.' : 'The Small sheet counts for the streak.'
  }
  ui.text('r-extra', extra)
  ui.f['r-alt'].hidden = !s.alt
  ui.text('r-next', nextLabel())
  ui.f['r-copy'].hidden = p.mode !== 'daily'
  ui.text('r-copy', 'Copy result')
  // Anonymous "you beat N%" and difficulty vote: today's daily only (never archive days, the Journey or free play).
  const talk = ui.f['r-talk']
  if (p.mode === 'daily' && p.meta.date === app.today && s.printed) {
    const large = l.kind === 'large'
    dailyTalk(talk, { game: 'overprint', key: p.meta.date, board: large ? 'large' : 'small', score: n, label: large ? 'Large sheet' : 'Small sheet', compact: true })
  } else { talk.replaceChildren(); talk.hidden = true }
  ui.f.result.hidden = false
  ui.f.result.classList.toggle('pop', animated && !reduced.matches)
  paintCrew(ui.f['r-crew'])
  if (animated && st) for (let k = 0; k < st; k++) setTimeout(() => snd.star(k), 300 + k * 170)
  paint()
  setTimeout(() => { if (!ui.f.result.hidden) ui.f['r-next'].focus({ preventScroll: true }) }, 50)
}

function copyResult(el) {
  const key = app.screen === 'play' && app.play && app.play.mode === 'daily' ? app.play.meta.date : app.day
  const d = dayEntry(key, false)
  const sum = d ? d.sum.map((e, i) => ({ ...e, p: e.p || sheetsFor(key)[i].par })) : sheetsFor(key).map((s) => ({ st: 0, n: 0, p: s.par, h: 0 }))
  const text = shareText(key, sum, weekday(key) === 0)
  const done = () => { snd.copy(); if (el) el.textContent = 'Copied!'; ui.toast('Copied!') }
  const fallback = () => {
    const ta = document.createElement('textarea')
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-999px;top:0;opacity:0'
    document.body.appendChild(ta); ta.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { ok = false }
    ta.remove()
    if (ok) done(); else ui.toast('Could not copy')
  }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback)
  else fallback()
  return text
}

const playing = () => app.screen === 'play' && app.play && !S.isOver(app.play.session)

const actions = {
  title() { snd.back(); openTitle() },
  daily() { snd.click(); openDaily() },
  journey() { snd.click(); openJourney() },
  free() { snd.click(); openFree() },
  day(d) { snd.click(); openDaily(addDays(app.day, Number(d.d))) },
  goday(d) { snd.click(); openDaily(d.date) },
  'daily-play'(d) { snd.click(); startDaily(Number(d.i)) },
  chapter(d) { snd.click(); openJourney(app.chapter + Number(d.d)) },
  'journey-play'(d) { snd.click(); startJourney(Number(d.i)) },
  'f-size'(d) { snd.click(); save.free.n = Number(d.v); persist(); paintFree() },
  'f-cards'(d) { snd.click(); save.free.k = Number(d.v); persist(); paintFree() },
  'free-new'() { snd.click(); startFree(true) },
  'free-resume'() { snd.click(); startFree(false) },
  copy(_, el) { copyResult(el) },
  back() {
    snd.back()
    const p = app.play
    if (!p) return openTitle()
    if (p.mode === 'daily') openDaily(p.meta.date)
    else if (p.mode === 'journey') openJourney(Math.floor(p.meta.level / PER_CHAPTER))
    else openFree()
    app.play = null
    save.last = null; persist()
  },
  turn() { if (playing()) turnCard(app.play.sel) },
  raise() { if (playing()) shiftCard(app.play.sel, -1) },
  lower() { if (playing()) shiftCard(app.play.sel, 1) },
  undo() {
    if (!playing()) return
    const p = app.play
    act(() => S.undo(p.session), () => snd.undo())
  },
  hint() {
    if (!playing()) return
    const p = app.play, s = p.session
    const m = S.hint(s)
    if (!m) return
    snd.hint()
    if (m.kind === 'turn') { turnCard(m.card); note(`The robots turn ${ROBOTS[m.card].name}.`, 'hint') }
    else { const c = S.stack(s).order[m.pos]; shiftCard(c, 1); note(`The robots move ${ROBOTS[c].name} down the stack.`, 'hint') }
    savePlay(); paint()
  },
  press() {
    if (!playing()) return
    const p = app.play
    if (!S.press(p.session)) { note('Not yet: every row must read as a word.', 'bad'); snd.nope(); return paint() }
    board.wiggle(-1)
    finish()
    paint()
  },
  'show-result'() { snd.click(); openResult(false) },
  'hide-result'() { snd.click(); ui.f.result.hidden = true },
  next() {
    snd.click()
    const p = app.play
    if (!p) return openTitle()
    if (p.mode === 'journey') return p.meta.level + 1 < JOURNEY.length ? startJourney(p.meta.level + 1, false) : openJourney(CHAPTERS.length - 1)
    if (p.mode === 'free') return startFree(true)
    app.day = p.meta.date
    return p.meta.idx === 0 ? startDaily(1) : openDaily(p.meta.date)
  },
}
const ui = createUI(uiRoot, actions)
const board = createBoard({ board: ui.f['p-board'], tray: ui.f['p-tray'], zone: ui.f['p-zone'] }, {
  order: () => (app.play ? S.stack(app.play.session).order : []),
  onTap(c) { if (!playing()) return; if (app.play.sel === c) turnCard(c); else selectCard(c) },
  onShift(c, dir) { if (playing()) shiftCard(c, dir) },
  onWheel(c) { if (playing()) turnCard(c) },
})
const setReduced = () => { fx.setReduced(reduced.matches); board.setReduced(reduced.matches) }
setReduced()
reduced.addEventListener('change', setReduced)

// ---------------------------------------------------------------- keyboard
window.addEventListener('keydown', (e) => {
  if (e.altKey || e.metaKey) return
  const t = e.target instanceof HTMLElement ? e.target : null
  const onButton = t && t.closest('button, a') && !t.closest('.tab')
  if (e.ctrlKey) { if (e.key.toLowerCase() === 'z' && playing()) { e.preventDefault(); actions.undo() } return }
  if (e.key === 'Escape') {
    if (app.screen === 'play') { if (!ui.f.result.hidden) ui.f.result.hidden = true; else actions.back() }
    else if (app.screen !== 'title') actions.title()
    return
  }
  if (app.screen !== 'play' || !app.play) return
  const p = app.play
  if (S.isOver(p.session)) {
    if (e.key === 'Enter' && !onButton) { e.preventDefault(); if (ui.f.result.hidden) openResult(false); else actions.next() }
    return
  }
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
  const order = S.stack(p.session).order
  if (/^[1-5]$/.test(key)) { const c = order[Number(key) - 1]; if (c !== undefined) { e.preventDefault(); selectCard(c) } }
  else if (key === 'r' || (key === ' ' && !onButton)) { e.preventDefault(); actions.turn() }
  else if (key === 'ArrowUp') { e.preventDefault(); actions.raise() }
  else if (key === 'ArrowDown') { e.preventDefault(); actions.lower() }
  else if (key === 'ArrowLeft' || key === 'ArrowRight') {
    e.preventDefault()
    const pos = order.indexOf(p.sel), to = Math.max(0, Math.min(order.length - 1, pos + (key === 'ArrowLeft' ? -1 : 1)))
    selectCard(order[to])
  }
  else if (key === 'u' || key === 'Backspace') { e.preventDefault(); actions.undo() }
  else if (key === 'h' || key === '?') { e.preventDefault(); actions.hint() }
  else if (key === 'Enter' && !onButton) { e.preventDefault(); actions.press() }
})

// ---------------------------------------------------------------- layout + loop
function layout() {
  const r = stage.getBoundingClientRect()
  const w = r.width, h = r.height
  if (!w || !h) return
  app.portrait = w < h * 0.95
  stage.classList.toggle('portrait', app.portrait)
  const fs = app.portrait ? Math.min(w / 23, h / 41) : Math.min(w / 60, h / 37)
  uiRoot.style.fontSize = `${Math.max(11, Math.min(18, fs)).toFixed(2)}px`
  fx.resize()
  if (app.screen === 'play') board.layout()
  if (ui.screens[app.screen]) paintCrew(ui.screens[app.screen])
}
ui.html('t-crew', crewHtml([0, 1, 2, 3, 4]))
const ro = new ResizeObserver(layout)
ro.observe(stage)
ro.observe(ui.f['p-zone'])
document.addEventListener('fullscreenchange', layout)
if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout)

function tick(dt) {
  fx.update(dt)
  const p = app.play
  if (p && p.resultIn > 0) { p.resultIn -= dt; if (p.resultIn <= 0) { p.resultIn = 0; if (app.screen === 'play') openResult(true) } }
  fx.draw()
}
let lastT = 0
function frame(now) {
  requestAnimationFrame(frame)
  if (document.hidden) { lastT = now; return }
  const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000))
  lastT = now
  tick(dt)
}
document.addEventListener('visibilitychange', () => { lastT = performance.now(); if (!document.hidden && app.screen === 'title') openTitle() })

// ---------------------------------------------------------------- boot
wireChrome({ stage })
tellUs(document.getElementById('tell-us'), { game: 'overprint', issueUrl: 'https://github.com/JohnGarrisonDev/overprint/issues/new?template=feedback.yml' })
function boot() {
  const last = save.last
  app.today = dateKey()
  try {
    if (firstVisit) { app.day = app.today; startDaily(0) }
    else if (last && last.mode === 'daily' && last.date <= app.today && last.date >= addDays(app.today, -(ARCHIVE_DAYS - 1))) { app.day = last.date; startDaily(last.idx) }
    else if (last && last.mode === 'journey' && save.journey.cur) startJourney(save.journey.cur.level)
    else if (last && last.mode === 'free' && save.free.cur) startFree(false)
    else openTitle()
  } catch (err) { console.warn('Overprint: could not resume', err); openTitle() }
  requestAnimationFrame((t) => { lastT = t; frame(t) })
}
boot()

// Debug hook for automated play-testing: only with ?debug in the URL.
if (new URLSearchParams(location.search).has('debug')) {
  window.__game = {
    app, save, actions, ui, board, fx, S,
    state() {
      const p = app.play
      if (!p) return { screen: app.screen, portrait: app.portrait }
      const s = p.session, st = S.stack(s)
      return { screen: app.screen, portrait: app.portrait, mode: p.mode, n: p.sheet.n, k: p.sheet.k, par: p.sheet.par, moves: s.moves, hints: s.hints, order: st.order, rots: st.rots, sel: p.sel, rows: S.rows(s), marks: S.marks(s), ready: S.ready(s), printed: s.printed, alt: s.alt, left: S.left(s), msg: ui.f['p-msg'].textContent, result: !ui.f.result.hidden }
    },
    /** Advance the animation clock by ms (the tab is often in the background, where frames barely run). */
    step(ms = 500) { for (let t = 0; t < ms; t += 16) tick(0.016); return this.state() },
    /** Tap a card's tab (select it, or turn it if it is already selected), like a pointer tap. */
    tap(c) { const p = app.play; if (p) { if (p.sel === c) turnCard(c); else selectCard(c) } return this.state() },
    /** Play the shortest route from here, leaving `leave` moves, then press if solved. */
    solve(leave = 0) {
      const p = app.play
      let guard = 0
      while (p && !S.isOver(p.session) && S.left(p.session) > leave && guard++ < 60) {
        const m = S.nudge(p.session)
        if (!m) break
        if (m.kind === 'turn') turnCard(m.card); else shiftCard(S.stack(p.session).order[m.pos], 1)
      }
      if (leave === 0 && p && S.ready(p.session)) actions.press()
      return this.state()
    },
    reset() { store.reset(); Object.assign(save, defaults()); persist(); openTitle() },
  }
}
