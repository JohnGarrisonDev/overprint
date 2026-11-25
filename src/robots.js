// The printer robots: one per card. Colour is never the only cue: each also has a name, a tab pattern and its own
// face. Faces are drawn with the kit's drawOddFace on small canvases.
import { C, drawOddFace } from '../kit/kit.js'

export const ROBOTS = [
  { name: 'Pica', color: C.orange, ink: '#a8310b', tint: '#ffe0d4', eye: C.yellow, pattern: 'stripes', look: [0.6, 0.35] },
  { name: 'Elite', color: C.blue, ink: '#2f2fb8', tint: '#e0e0ff', eye: C.orange, pattern: 'dots', look: [-0.5, 0.4] },
  { name: 'Smudge', color: C.mint, ink: '#0a6b4f', tint: '#cff5e8', eye: C.orange, pattern: 'checks', look: [0.2, -0.55] },
  { name: 'Serif', color: C.pink, ink: '#a3236a', tint: '#ffe0f0', eye: C.blue, pattern: 'bars', look: [-0.6, -0.2] },
  { name: 'Kern', color: C.yellow, ink: '#7a5200', tint: '#fff0c4', eye: C.orange, pattern: 'hatch', look: [0.55, 0.55] },
]

/** Paint a robot head (a little printer with a face) on a canvas, sized to its CSS box. */
export function paintRobot(canvas, i, { blink = false, look } = {}) {
  const r = ROBOTS[i]
  const box = canvas.getBoundingClientRect()
  const w = Math.max(1, Math.round(box.width)), h = Math.max(1, Math.round(box.height))
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr) }
  const g = canvas.getContext('2d')
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, w, h)
  const s = Math.min(w, h)
  const x0 = (w - s) / 2, y0 = (h - s) / 2
  const lw = Math.max(1.5, s * 0.06)
  // paper slot on top (the printer's mouth)
  g.fillStyle = C.paper; g.strokeStyle = C.ink; g.lineWidth = lw
  g.beginPath(); g.roundRect(x0 + s * 0.24, y0 + s * 0.04, s * 0.52, s * 0.2, s * 0.04); g.fill(); g.stroke()
  // head
  g.fillStyle = r.color
  g.beginPath(); g.roundRect(x0 + s * 0.08, y0 + s * 0.16, s * 0.84, s * 0.76, s * 0.2); g.fill(); g.stroke()
  const [lx, ly] = look || r.look
  drawOddFace(g, x0 + s * 0.5, y0 + s * 0.56, s * 0.62, { look: lx, lookY: ly, eye: r.eye, blink })
}

/** The robots' end-of-print argument. Picked from the words so it is the same for everyone. */
export function quip(names, words) {
  let h = 0
  for (const ch of words.join('')) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const [a, b] = [names[h % names.length], names[(h >> 3) % names.length === h % names.length ? (h % names.length + 1) % names.length : (h >> 3) % names.length]]
  const lines = [
    `“That smudge is ${b}'s,” says ${a}. ${b} denies everything.`,
    `${a} would like it noted that ${a} did not smudge anything.`,
    `${b} says the letters are too close together. ${b} always says that.`,
    `${a} and ${b} are still arguing about whose ink is on the ceiling.`,
    `“Straight off the press,” beams ${a}. ${b} is still looking for its other eye.`,
    `${b} stamped it twice to be sure. ${a} is not speaking to ${b}.`,
    `${a} wants a byline. ${b} wants a nap.`,
    `“I punched the holes,” says ${a}. “I punched them better,” says ${b}.`,
  ]
  return names.length < 2 ? `${a} printed it alone and is very proud.` : lines[h % lines.length]
}
