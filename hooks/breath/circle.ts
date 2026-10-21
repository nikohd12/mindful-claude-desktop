// The desktop band: one SVG whose own SMIL animation breathes, so the app animates it smoothly
// with no redraws. A circle grows on the inhale and shrinks on the exhale; under it, the same
// countdown line the terminal shows. Pure: `bun test` covers it.

import { cycleMs, phaseAt, phaseLine, type Exercise } from './exercises.ts'

export const SVG_WIDTH = 360
export const SVG_HEIGHT = 178

const ORANGE = '#d97757'
const GREY = '#8b8580'
const CX = SVG_WIDTH / 2
const CY = 66
const R_MIN = 10
const R_MAX = 44

// cubic-bezier forms of the terminal's quadratic ease-out, and of a straight hold
const SPLINE = { ease: '0.333 0.667 0.667 1', linear: '0 0 1 1' } as const
type Spline = keyof typeof SPLINE

export type Segment = { text: string; startMs: number; endMs: number }

/** The countdown lines across one cycle, each with the stretch of time it shows. */
export function labelSegments(ex: Exercise): Segment[] {
  const segs: Segment[] = []
  let start = 0
  for (const ms of [ex.inhaleMs, ex.hold1Ms, ex.exhaleMs, ex.hold2Ms]) {
    if (ms <= 0) continue
    // whole seconds left, rounded up: k shows while (k-1)s < left <= ks
    for (let k = Math.ceil(ms / 1000); k >= 1; k--) {
      const from = start + ms - Math.min(k * 1000, ms)
      const to = start + ms - (k - 1) * 1000
      segs.push({ text: phaseLine(phaseAt(ex, from)), startMs: from, endMs: to })
    }
    start += ms
  }
  return segs
}

/** How full the circle is (0..1) at each phase boundary, as fractions of one cycle. */
export function radiusKeys(ex: Exercise): { keyTimes: number[]; values: number[]; splines: Spline[] } {
  const cycle = cycleMs(ex)
  const firstFull = ex.sip ? 0.85 : 1
  const phases: [number, number, Spline][] = [
    [ex.inhaleMs, firstFull, 'ease'],
    [ex.hold1Ms, 1, ex.sip ? 'ease' : 'linear'],
    [ex.exhaleMs, 0, 'ease'],
    [ex.hold2Ms, 0, 'linear'],
  ]
  const keyTimes = [0]
  const values = [0]
  const splines: Spline[] = []
  let at = 0
  for (const [ms, value, spline] of phases) {
    if (ms <= 0) continue
    at += ms
    keyTimes.push(round(at / cycle))
    values.push(value)
    splines.push(spline)
  }
  return { keyTimes, values, splines }
}

/** The band's picture, `breathMs` into the breath: every redraw restarts an image's animation,
 * so the start is set back by that much and the restart lands where the last drawing was. */
export function circleSvg(ex: Exercise, breathMs: number): string {
  const cycle = cycleMs(ex)
  const into = Number.isFinite(breathMs) && breathMs > 0 ? breathMs % cycle : 0
  const begin = into === 0 ? '0s' : `-${round(into / 1000)}s`
  const dur = `${round(cycle / 1000)}s`
  const loop = `dur="${dur}" begin="${begin}" repeatCount="indefinite"`

  const { keyTimes, values, splines } = radiusKeys(ex)
  const radius = (grow: number) =>
    `<animate attributeName="r" values="${values.map(v => round(R_MIN + grow + (R_MAX - R_MIN) * v)).join(';')}" ` +
    `keyTimes="${keyTimes.join(';')}" calcMode="spline" keySplines="${splines.map(s => SPLINE[s]).join(';')}" ${loop}/>`

  const lines = labelSegments(ex).map(s => {
    const from = round(s.startMs / cycle)
    const to = round(s.endMs / cycle)
    // shown from `from` to `to` of each cycle, hidden the rest
    const shown = from === 0 ? { values: '1;0', keyTimes: `0;${to}` } : { values: '0;1;0', keyTimes: `0;${from};${to}` }
    return (
      `<text x="${CX}" y="146" opacity="0">${esc(s.text)}` +
      `<animate attributeName="opacity" values="${shown.values}" keyTimes="${shown.keyTimes}" calcMode="discrete" ${loop}/></text>`
    )
  })

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" ` +
    `font-family="system-ui, -apple-system, sans-serif" text-anchor="middle">` +
    `<circle cx="${CX}" cy="${CY}" r="${R_MIN + 8}" fill="${ORANGE}" opacity="0.18">${radius(8)}</circle>` +
    `<circle cx="${CX}" cy="${CY}" r="${R_MIN}" fill="${ORANGE}" opacity="0.85">${radius(0)}</circle>` +
    `<g font-size="15" fill="${ORANGE}">${lines.join('')}</g>` +
    `<text x="${CX}" y="166" font-size="12" fill="${GREY}">${esc(ex.name)}</text>` +
    `</svg>`
  )
}

const round = (n: number): number => Math.round(n * 10000) / 10000

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
