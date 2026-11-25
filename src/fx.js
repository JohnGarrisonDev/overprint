// The effects layer: one canvas over the whole stage (pointer-events: none) for ink splats and paper confetti.
// Holds only animation state. Pooled particles, capped, nothing allocated per frame.
import { C, fitCanvas } from '../kit/kit.js'

const MAX = 220
export function createFx(canvas) {
  const g = canvas.getContext('2d')
  const P = Array.from({ length: MAX }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, r: 0, life: 0, max: 1, col: C.ink, kind: 0, rot: 0, vr: 0 }))
  let w = 1, h = 1, dpr = 1, reduced = false, live = 0
  const take = () => { for (const p of P) if (!p.on) return p; return null }

  function resize() { const s = fitCanvas(canvas); w = s.w; h = s.h; dpr = s.dpr }
  /** An ink splat at x, y (stage pixels): a blob plus droplets. */
  function splat(x, y, col, size = 18) {
    const n = reduced ? 3 : 9
    for (let i = 0; i < n; i++) {
      const p = take(); if (!p) return
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6, sp = i === 0 ? 0 : (40 + Math.random() * 140) * (size / 18)
      Object.assign(p, { on: true, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: i === 0 ? size * 0.55 : size * (0.1 + Math.random() * 0.16), life: 0, max: 0.55 + Math.random() * 0.25, col, kind: 0, rot: 0, vr: 0 })
    }
  }
  /** Paper confetti from the top of a box (the printed sheet). */
  function confetti(x0, y0, bw, cols) {
    const n = reduced ? 16 : 70
    for (let i = 0; i < n; i++) {
      const p = take(); if (!p) return
      Object.assign(p, { on: true, x: x0 + Math.random() * bw, y: y0 - Math.random() * 20, vx: (Math.random() - 0.5) * 160, vy: -120 - Math.random() * 260, r: 4 + Math.random() * 5, life: 0, max: 1.4 + Math.random() * 0.8, col: cols[i % cols.length], kind: 1, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14 })
    }
  }
  function update(dt) {
    live = 0
    for (const p of P) {
      if (!p.on) continue
      p.life += dt
      if (p.life >= p.max) { p.on = false; continue }
      live++
      if (p.kind === 0) { p.vx *= 1 - Math.min(1, dt * 7); p.vy *= 1 - Math.min(1, dt * 7) }
      else { p.vy += 520 * dt; p.vx *= 1 - Math.min(1, dt * 1.2); p.rot += p.vr * dt }
      p.x += p.vx * dt; p.y += p.vy * dt
    }
  }
  function draw() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, h)
    if (!live) return
    for (const p of P) {
      if (!p.on) continue
      const t = p.life / p.max
      g.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3
      g.fillStyle = p.col
      if (p.kind === 0) {
        const r = p.r * (t < 0.15 ? 0.4 + t * 4 : 1)
        g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.fill()
      } else {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot)
        g.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2)
        g.strokeStyle = C.ink; g.lineWidth = 1; g.strokeRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2)
        g.restore()
      }
    }
    g.globalAlpha = 1
  }
  const clear = () => { for (const p of P) p.on = false; live = 0 }
  return { resize, splat, confetti, update, draw, clear, setReduced(v) { reduced = v }, get live() { return live } }
}
