// The play view: the printed sheet (letters, owners, stamps, the turning ghost) and the card tray (tabs with
// robot faces and mini cards). Pure view: main.js hands it what to show and gets taps, drags and wheel turns back.
import { ROBOTS, paintRobot } from './robots.js'

const L = (c) => (c >= 0 ? String.fromCharCode(65 + c) : '')

export function createBoard(els, cb) {
  const { board, tray, zone } = els
  let n = 0, k = 0, eng = null
  let cells = [], stamps = [], sheetEl = null
  const tabs = new Map() // card -> { el, mini: [i], face }
  let baseMini = []
  let reduced = false

  function build(sheet, engine) {
    eng = engine; n = sheet.n; k = sheet.k
    board.style.setProperty('--n', n)
    tray.className = 'tray k' + k
    board.innerHTML = `<div class="sheet" role="grid" aria-label="The sheet">${Array.from({ length: n }, (_, r) => `<div class="srow" role="row">${Array.from({ length: n }, (_, x) => `<div class="cell ob" role="gridcell" data-i="${r * n + x}"><b></b><i class="gl"></i></div>`).join('')}</div>`).join('')}</div>
      <div class="stamps" aria-hidden="true">${Array.from({ length: n }, () => '<span class="stamp"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16"/><path d="m12 20 6 6 11-12"/></svg></span>').join('')}</div>
      <span class="reg tl" aria-hidden="true"></span><span class="reg br" aria-hidden="true"></span>`
    sheetEl = board.querySelector('.sheet')
    cells = [...board.querySelectorAll('.cell')]
    stamps = [...board.querySelectorAll('.stamp')]
    tabs.clear()
    const miniHtml = () => `<span class="mini" style="--n:${n}">${'<i></i>'.repeat(n * n)}</span>`
    tray.innerHTML = `<span class="tray-label" aria-hidden="true"><span class="v">Top of the stack ↓</span><span class="h">Top of the stack →</span></span>` +
      Array.from({ length: k }, (_, c) => `<button class="tab r${c}" data-card="${c}" type="button"><span class="kno"></span><canvas class="face" aria-hidden="true"></canvas><span class="tname">${ROBOTS[c].name}</span>${miniHtml()}</button>`).join('') +
      `<div class="tab base" aria-label="The base sheet, always at the bottom"><span class="tname">Base</span>${miniHtml()}</div>`
    for (const el of tray.querySelectorAll('.tab[data-card]')) {
      const c = Number(el.dataset.card)
      tabs.set(c, { el, mini: [...el.querySelectorAll('.mini i')], face: el.querySelector('.face'), miniEl: el.querySelector('.mini') })
    }
    baseMini = [...tray.querySelectorAll('.tab.base .mini i')]
    sheet.base.split('').forEach((ch, i) => { baseMini[i].textContent = ch.toUpperCase(); baseMini[i].className = 'p' })
    tray.querySelector('.tab.base').style.order = 99
    layout()
  }

  /** view: { grid, owners, marks, order, rots, sel, changed (Set of cells) | null, fresh (Set of rows newly stamped) } */
  function render(v) {
    const selLay = v.sel >= 0 ? eng.lay[v.sel * 4 + v.rots[v.sel]] : null
    for (let i = 0; i < n * n; i++) {
      const el = cells[i], o = v.owners[i]
      let cls = 'cell ' + (o < 0 ? 'ob' : 'o' + o)
      const mine = selLay && selLay[i] >= 0
      if (mine) cls += o === v.sel ? ' sel' : ' cov'
      if (v.changed && v.changed.has(i) && !reduced) cls += ' flip'
      if (el.className !== cls) { if (cls.includes('flip')) { el.className = cls.replace(' flip', ''); void el.offsetWidth } el.className = cls }
      const ch = v.grid[i].toUpperCase()
      const b = el.firstChild
      if (b.textContent !== ch) b.textContent = ch
      const gl = mine && o !== v.sel ? L(selLay[i]) : ''
      if (el.lastChild.textContent !== gl) el.lastChild.textContent = gl
    }
    const labels = []
    for (let r = 0; r < n; r++) {
      const on = v.marks[r] > 0
      const st = stamps[r]
      const cls = 'stamp' + (on ? ' on' : '') + (on && v.fresh && v.fresh.has(r) && !reduced ? ' fresh' : '')
      if (st.className !== cls) { st.className = 'stamp'; if (on) { void st.offsetWidth; st.className = cls } }
      cells[r * n].parentElement.classList.toggle('word', on)
      labels.push(v.grid.slice(r * n, r * n + n).toUpperCase() + (on ? ' (a word)' : ''))
    }
    sheetEl.setAttribute('aria-label', 'The sheet, rows: ' + labels.join(', '))
    // tray
    v.order.forEach((c, pos) => {
      const t = tabs.get(c)
      t.el.style.order = pos + 1
      t.el.classList.toggle('on', c === v.sel)
      t.el.setAttribute('aria-pressed', String(c === v.sel))
      t.el.setAttribute('aria-label', `${ROBOTS[c].name}, card ${pos + 1} of ${k} from the top${c === v.sel ? ', selected: press again to turn it' : ''}`)
      t.el.querySelector('.kno').textContent = String(pos + 1)
      const lay = eng.lay[c * 4 + v.rots[c]]
      for (let i = 0; i < n * n; i++) {
        const m = t.mini[i], p = lay[i] >= 0
        const cls = p ? 'p' : 'h'
        if (m.className !== cls) m.className = cls
        const ch = p ? L(lay[i]) : ''
        if (m.textContent !== ch) m.textContent = ch
      }
    })
  }

  /** The turning card sweeps a quarter turn over the sheet before the letters settle. */
  function ghostTurn(card, fromRot) {
    const t = tabs.get(card)
    if (t && !reduced) { t.miniEl.classList.remove('spin'); void t.miniEl.offsetWidth; t.miniEl.classList.add('spin') }
    if (reduced || !sheetEl) return
    const old = sheetEl.querySelector('.ghost')
    if (old) old.remove()
    const lay = eng.lay[card * 4 + fromRot]
    const g = document.createElement('div')
    g.className = 'ghost r' + card
    let h = ''
    for (let i = 0; i < n * n; i++) if (lay[i] >= 0) h += `<i style="left:${((i % n) / n) * 100}%;top:${(Math.floor(i / n) / n) * 100}%"><b>${L(lay[i])}</b></i>`
    g.innerHTML = h
    sheetEl.appendChild(g)
    g.addEventListener('animationend', (e) => { if (e.target === g) g.remove() })
    setTimeout(() => g.remove(), 700)
  }
  function bump(card) {
    const t = tabs.get(card)
    if (!t || reduced) return
    t.el.classList.remove('bump'); void t.el.offsetWidth; t.el.classList.add('bump')
  }
  function wiggle(card) {
    for (const [c, t] of tabs) t.el.classList.toggle('wiggle', c === card)
  }

  function layout() {
    if (!n) return
    const r = zone.getBoundingClientRect()
    if (r.width < 10 || r.height < 10) return
    const cell = Math.max(24, Math.min(96, Math.floor(Math.min(r.width / (n + 0.85), r.height / (n + 0.25)))))
    board.style.setProperty('--cell', cell + 'px')
    // mini cards: fit the tab
    for (const [c, t] of tabs) { paintRobot(t.face, c) }
  }
  /** Centre of a row's stamp, in stage coordinates (for ink splats). */
  function stampPoint(r, stageRect) {
    const s = stamps[r].getBoundingClientRect()
    return { x: s.left + s.width / 2 - stageRect.left, y: s.top + s.height / 2 - stageRect.top }
  }
  function sheetRect(stageRect) {
    const s = sheetEl.getBoundingClientRect()
    return { x: s.left - stageRect.left, y: s.top - stageRect.top, w: s.width, h: s.height }
  }

  // ---- input on the tabs: tap to select (tap again to turn), drag along the tray to restack, wheel to turn
  let drag = null
  const horizontal = () => getComputedStyle(tray).flexDirection.startsWith('row')
  tray.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.tab[data-card]')
    if (!el || e.button > 0 || (drag && !e.isPrimary)) return // one tab at a time: a second finger is ignored
    e.preventDefault()
    try { el.setPointerCapture(e.pointerId) } catch { /* synthetic events */ }
    if (drag) drag.el.classList.remove('lift')
    drag = { el, card: Number(el.dataset.card), id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, h: horizontal() }
  })
  tray.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return
    const d = drag.h ? e.clientX - drag.x : e.clientY - drag.y
    if (!drag.moved && Math.abs(d) < 10) return
    if (!drag.moved) { drag.moved = true; drag.el.classList.add('lift') }
    // swap with a neighbour once the pointer passes the neighbour's middle
    const order = cb.order()
    const pos = order.indexOf(drag.card)
    const p = drag.h ? e.clientX : e.clientY
    for (const dir of [-1, 1]) {
      const nb = order[pos + dir]
      if (nb === undefined) continue
      const r = tabs.get(nb).el.getBoundingClientRect()
      const mid = drag.h ? r.left + r.width / 2 : r.top + r.height / 2
      if ((dir < 0 && p < mid) || (dir > 0 && p > mid)) { cb.onShift(drag.card, dir); break }
    }
  })
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return
    const d = drag
    drag = null
    d.el.classList.remove('lift')
    if (e.type === 'pointerup' && !d.moved) cb.onTap(d.card)
  }
  tray.addEventListener('pointerup', end)
  tray.addEventListener('pointercancel', end)
  tray.addEventListener('lostpointercapture', end) // capture lost (system gesture, tab rebuilt): drop the drag, no tap

  // ---- taps on the sheet: a square picks the card printed on top there (a big target on phones)
  let press = null
  board.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.cell')
    if (!el || e.button > 0 || press) return
    press = { id: e.pointerId, i: Number(el.dataset.i), x: e.clientX, y: e.clientY }
  })
  board.addEventListener('pointerup', (e) => {
    if (!press || e.pointerId !== press.id) return
    const p = press
    press = null
    const el = e.target.closest('.cell')
    if (el && Number(el.dataset.i) === p.i && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 14) cb.onCell(p.i)
  })
  board.addEventListener('pointercancel', (e) => { if (press && e.pointerId === press.id) press = null })
  tray.addEventListener('click', (e) => {
    const el = e.target.closest('.tab[data-card]')
    if (el && e.detail === 0) cb.onTap(Number(el.dataset.card)) // keyboard activation; pointer taps are handled above
  })
  let lastWheel = 0
  tray.addEventListener('wheel', (e) => {
    const el = e.target.closest('.tab[data-card]')
    if (!el) return
    e.preventDefault()
    const now = performance.now()
    if (now - lastWheel < 180 || Math.abs(e.deltaY) + Math.abs(e.deltaX) < 1) return
    lastWheel = now
    cb.onWheel(Number(el.dataset.card))
  }, { passive: false })

  return { build, render, ghostTurn, bump, wiggle, layout, stampPoint, sheetRect, focusTab(c) { const t = tabs.get(c); if (t) t.el.focus() }, setReduced(v) { reduced = v } }
}

