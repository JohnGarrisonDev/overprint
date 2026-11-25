// Sound effects, all synthesised through the kit's sfx (shared Oddvale mute state). Rate-limited where it matters.
import { sfx } from '../kit/kit.js'

const note = (semi, base = 330) => base * 2 ** (semi / 12)
const STEPS = [0, 4, 7, 12, 16, 19]
const last = {}
const gate = (k, ms) => { const now = Date.now(); if (now - (last[k] || 0) < ms) return false; last[k] = now; return true }

export const snd = {
  /** Paper flap: a card turns. */
  turn() {
    if (!gate('turn', 40)) return
    sfx.noise({ dur: 0.09, vol: 0.13, freq: 3200, slide: 700 })
    sfx.tone({ freq: 300, slide: 420, dur: 0.06, type: 'triangle', vol: 0.06 })
  },
  /** Two cards slide past each other. */
  swap() {
    if (!gate('swap', 40)) return
    sfx.noise({ dur: 0.06, vol: 0.1, freq: 1800, slide: 900 })
    sfx.noise({ dur: 0.07, vol: 0.09, freq: 1400, slide: 2400, delay: 0.06 })
  },
  pick() { if (gate('pick', 30)) sfx.tone({ freq: 620, slide: 760, dur: 0.045, type: 'triangle', vol: 0.08 }) },
  undo() { sfx.tone({ freq: 520, slide: 360, dur: 0.08, type: 'triangle', vol: 0.09 }); sfx.noise({ dur: 0.05, vol: 0.05, freq: 1500, slide: 600 }) },
  /** A rubber stamp lands on a row that reads. k = how many rows now read. */
  stamp(k) {
    if (!gate('stamp', 60)) return
    sfx.tone({ freq: 150, slide: 70, dur: 0.12, type: 'sine', vol: 0.24 })
    sfx.noise({ dur: 0.05, vol: 0.14, freq: 500, slide: 160 })
    sfx.tone({ freq: note(STEPS[Math.min(STEPS.length - 1, k)]), dur: 0.18, type: 'triangle', vol: 0.11, delay: 0.05 })
  },
  unstamp() { if (gate('unstamp', 60)) sfx.tone({ freq: 360, slide: 250, dur: 0.1, type: 'sine', vol: 0.07 }) },
  ready() { sfx.tune([[note(7), 0.08], [note(12), 0.08], [note(16), 0.16]], { type: 'triangle', vol: 0.12 }) },
  /** The press comes down: ka-chunk, then a little fanfare. */
  press() {
    sfx.noise({ dur: 0.18, vol: 0.22, freq: 700, slide: 90 })
    sfx.tone({ freq: 110, slide: 55, dur: 0.22, type: 'sine', vol: 0.3 })
    sfx.noise({ dur: 0.08, vol: 0.14, freq: 2400, slide: 800, delay: 0.24 })
    sfx.tune([[0, 0.3], [note(0), 0.1], [note(4), 0.1], [note(7), 0.1], [note(12), 0.32]], { type: 'triangle', vol: 0.14 })
  },
  hint() { sfx.tune([[880, 0.06], [1175, 0.06], [880, 0.08]], { type: 'sine', vol: 0.1 }) },
  nope() { sfx.noise({ dur: 0.06, vol: 0.14, freq: 600, slide: 200 }); sfx.tone({ freq: 180, slide: 120, dur: 0.08, type: 'sine', vol: 0.14 }) },
  click() { if (gate('click', 30)) sfx.tone({ freq: 520, slide: 640, dur: 0.045, type: 'triangle', vol: 0.09 }) },
  back() { sfx.tone({ freq: 480, slide: 360, dur: 0.05, type: 'triangle', vol: 0.08 }) },
  star(n) { sfx.tone({ freq: note([7, 12, 16][n] ?? 16, 440), dur: 0.22, type: 'triangle', vol: 0.14 }) },
  copy() { sfx.tune([[700, 0.05], [1050, 0.08]], { type: 'sine', vol: 0.11 }) },
}
