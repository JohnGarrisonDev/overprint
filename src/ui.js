// DOM overlays inside the stage: title, daily, journey, free play, the play screen shell, the Gazette, toast.
// Pure view code: it renders what main.js tells it and reports clicks through `actions[name](dataset, element)`.
// The board and the card tray inside the play screen are drawn by board.js.
const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`
export const ICON = {
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  hint: svg('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  next: svg('<path d="M9 5l7 7-7 7"/>'),
  turn: svg('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>'),
  up: svg('<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>'),
  down: svg('<path d="M12 5v14"/><path d="m6 13 6 6 6-6"/>'),
  left: svg('<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>'),
  right: svg('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>'),
  check: svg('<path d="m5 12 5 5 9-10"/>'),
  press: svg('<path d="M4 20h16"/><path d="M7 16h10l-1-5H8z"/><path d="M12 11V3"/><path d="m8 7 4-4 4 4"/>'),
}
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
export const starsHtml = (n, cls = '') => `<span class="stars ${cls}" aria-label="${n} of 3 stars">${[0, 1, 2].map((k) => `<i class="${k < n ? 'on' : ''}">★</i>`).join('')}</span>`

export function createUI(root, actions) {
  root.innerHTML = `
  <section class="screen title" data-screen="title">
    <div class="title-head">
      <span class="eyebrow">An Oddvale word puzzle</span>
      <h2 class="wordmark" aria-label="Overprint"><span aria-hidden="true">Over<em>print</em></span></h2>
      <p class="howto">Turn and stack the cards until every row is a word.</p>
    </div>
    <div class="crew" data-f="t-crew" aria-hidden="true"></div>
    <nav class="title-menu">
      <button class="bigbtn orange" data-act="daily"><b>Daily</b><span data-f="t-daily"></span><span class="strip" data-f="t-strip" aria-hidden="true"></span></button>
      <button class="bigbtn yellow" data-act="journey"><b>Journey</b><span data-f="t-journey"></span></button>
      <button class="bigbtn mint" data-act="free"><b>Free play</b><span data-f="t-free"></span></button>
    </nav>
  </section>

  <section class="screen menu daily" data-screen="daily" hidden>
    <header class="bar">
      <button class="iconbtn" data-act="title" aria-label="Back to title">${ICON.back}</button>
      <h2>Daily</h2>
      <span class="total" data-f="d-streak"></span>
    </header>
    <div class="pager">
      <button class="iconbtn" data-act="day" data-d="-1" data-f="d-prev" aria-label="Previous day">${ICON.back}</button>
      <div class="pager-name"><strong data-f="d-date"></strong><span class="blurb" data-f="d-note"></span></div>
      <button class="iconbtn" data-act="day" data-d="1" data-f="d-next" aria-label="Next day">${ICON.next}</button>
    </div>
    <div class="dlist" data-f="d-list"></div>
    <div class="row">
      <button class="btn primary small" data-act="copy" data-f="d-copy">Copy result</button>
      <span class="total" data-f="d-total"></span>
    </div>
    <div class="days" data-f="d-days" aria-label="Last 14 days"></div>
  </section>

  <section class="screen menu journey" data-screen="journey" hidden>
    <header class="bar">
      <button class="iconbtn" data-act="title" aria-label="Back to title">${ICON.back}</button>
      <h2>Journey</h2>
      <span class="total" data-f="j-total"></span>
    </header>
    <div class="pager">
      <button class="iconbtn" data-act="chapter" data-d="-1" data-f="j-prev" aria-label="Previous chapter">${ICON.back}</button>
      <div class="pager-name"><span class="eyebrow" data-f="j-chno"></span><strong data-f="j-chname"></strong><span class="blurb" data-f="j-blurb"></span></div>
      <button class="iconbtn" data-act="chapter" data-d="1" data-f="j-next" aria-label="Next chapter">${ICON.next}</button>
    </div>
    <div class="level-grid" data-f="j-grid"></div>
  </section>

  <section class="screen menu free" data-screen="free" hidden>
    <header class="bar">
      <button class="iconbtn" data-act="title" aria-label="Back to title">${ICON.back}</button>
      <h2>Free play</h2>
      <span class="total" data-f="f-total"></span>
    </header>
    <div class="free-body">
      <div class="seg-row"><span class="lbl">Sheet</span><div class="seg" data-f="f-size"></div></div>
      <div class="seg-row"><span class="lbl">Cards</span><div class="seg" data-f="f-cards"></div></div>
      <p class="note" data-f="f-note"></p>
      <div class="row">
        <button class="btn primary" data-act="free-new">New sheet</button>
        <button class="btn" data-act="free-resume" data-f="f-resume" hidden>Continue</button>
      </div>
    </div>
  </section>

  <section class="play" data-screen="play" hidden>
    <div class="hud">
      <button class="iconbtn" data-act="back" aria-label="Back" title="Back (Esc)">${ICON.back}</button>
      <div class="lv"><span class="eyebrow" data-f="p-mode"></span><strong data-f="p-name"></strong></div>
      <div class="chips">
        <span class="pchip">Par <b data-f="p-par"></b></span>
        <span class="pchip" data-f="p-mchip">Moves <b data-f="p-moves"></b></span>
        <span class="pchip hchip" data-f="p-hchip" title="Hints used">${ICON.hint}<span class="sr">Hints</span> <b data-f="p-hints"></b></span>
      </div>
    </div>
    <p class="msg" data-f="p-msg" aria-live="polite"></p>
    <div class="boardzone" data-f="p-zone"><div class="board" data-f="p-board"></div></div>
    <div class="side">
      <div class="tray" data-f="p-tray" role="group" aria-label="The card stack, top card first"></div>
      <div class="actions" data-f="p-actions">
        <button class="iconbtn" data-act="undo" data-f="p-undo" aria-label="Undo (counts as a move)" title="Undo (U), counts as a move">${ICON.undo}</button>
        <button class="iconbtn" data-act="hint" data-f="p-hint" aria-label="Hint: the robots make one good move" title="Hint (H)">${ICON.hint}</button>
        <span class="gap"></span>
        <button class="iconbtn mv" data-act="raise" data-f="p-raise" aria-label="Move the card up the stack" title="Up the stack (Up arrow)"><span class="v">${ICON.up}</span><span class="h">${ICON.left}</span></button>
        <button class="iconbtn turnbtn" data-act="turn" data-f="p-turn" aria-label="Turn the card a quarter turn" title="Turn (R or Space)">${ICON.turn}</button>
        <button class="iconbtn mv" data-act="lower" data-f="p-lower" aria-label="Move the card down the stack" title="Down the stack (Down arrow)"><span class="v">${ICON.down}</span><span class="h">${ICON.right}</span></button>
        <span class="gap"></span>
        <button class="btn primary pressbtn" data-act="press" data-f="p-press" disabled title="Press (Enter)">${ICON.press}<span>Press</span></button>
      </div>
      <div class="over-row" data-f="p-over" hidden>
        <button class="btn small" data-act="show-result">The Gazette</button>
        <button class="btn primary small" data-act="next" data-f="p-next">Next</button>
      </div>
    </div>
    <div class="modal" data-f="result" hidden>
      <article class="gazette" role="dialog" aria-modal="true" aria-label="The Oddvale Gazette">
        <div class="g-col g-left">
        <header class="mast">
          <span class="dateline" data-f="r-dateline"></span>
          <h3>The Oddvale Gazette</h3>
          <span class="edition" data-f="r-edition"></span>
        </header>
        <h4 class="headline" data-f="r-headline"></h4>
        <p class="deck" data-f="r-deck"></p>
        <div class="r-stars" data-f="r-stars"></div>
        </div>
        <div class="g-col g-right">
        <div class="story">
          <div class="crew small" data-f="r-crew" aria-hidden="true"></div>
          <p class="quote" data-f="r-quote"></p>
        </div>
        <p class="r-extra" data-f="r-extra"></p>
        <span class="altstamp" data-f="r-alt" hidden>Alternate edition</span>
        <div class="row">
          <button class="btn primary" data-act="next" data-f="r-next">Next</button>
          <button class="btn" data-act="copy" data-f="r-copy" hidden>Copy result</button>
          <button class="btn" data-act="hide-result">See the sheet</button>
        </div>
        <div class="r-talk" data-f="r-talk" hidden></div>
        </div>
      </article>
    </div>
  </section>
  <div class="toast" data-f="toast" hidden></div>`

  const f = {}
  for (const el of root.querySelectorAll('[data-f]')) f[el.dataset.f] = el
  const screens = {}
  for (const el of root.querySelectorAll('[data-screen]')) screens[el.dataset.screen] = el

  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]')
    if (!el || el.disabled || !root.contains(el)) return
    const fn = actions[el.dataset.act]
    if (fn) fn(el.dataset, el)
  })

  let toastTimer = 0
  return {
    f, screens,
    show(name) { for (const k in screens) screens[k].hidden = k !== name },
    text(key, s) { if (f[key].textContent !== s) f[key].textContent = s },
    html(key, s) { f[key].innerHTML = s },
    toast(s) {
      f.toast.textContent = s; f.toast.hidden = false
      clearTimeout(toastTimer); toastTimer = setTimeout(() => { f.toast.hidden = true }, 1700)
    },
    msg(s, tone = '') { f['p-msg'].textContent = s; f['p-msg'].className = 'msg ' + tone },
  }
}
