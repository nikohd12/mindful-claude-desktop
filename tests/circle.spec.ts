import { describe, expect, test } from 'bun:test'
import { EXERCISES, cycleMs, exerciseOf, phaseAt, phaseLine } from '../hooks/breath/exercises.ts'
import { circleSvg, labelSegments, radiusKeys } from '../hooks/breath/circle.ts'

describe('label segments', () => {
  test('coherent breathing opens on "Breathe in... 6s" for half a second', () => {
    expect(labelSegments(exerciseOf('hrv'))[0]).toEqual({ text: 'Breathe in... 6s', startMs: 0, endMs: 500 })
  })

  for (const ex of EXERCISES) {
    test(`${ex.key}: segments tile one cycle with no gap or overlap`, () => {
      const segs = labelSegments(ex)
      expect(segs[0]!.startMs).toBe(0)
      expect(segs.at(-1)!.endMs).toBe(cycleMs(ex))
      segs.forEach((s, i) => {
        expect(s.endMs).toBeGreaterThan(s.startMs)
        if (i > 0) expect(s.startMs).toBe(segs[i - 1]!.endMs)
      })
    })

    test(`${ex.key}: every 50ms the circle's words match the terminal's phase line`, () => {
      const segs = labelSegments(ex)
      for (let t = 0; t < cycleMs(ex); t += 50) {
        const seg = segs.find(s => t >= s.startMs && t < s.endMs)
        expect(seg?.text).toBe(phaseLine(phaseAt(ex, t)))
      }
    })
  }
})

describe('radius keys', () => {
  test('box: in, hold full, out, hold empty, in equal quarters', () => {
    expect(radiusKeys(exerciseOf('box'))).toEqual({ keyTimes: [0, 0.25, 0.5, 0.75, 1], values: [0, 1, 1, 0, 0] })
  })

  test('coherent breathing has no holds: in then out', () => {
    expect(radiusKeys(exerciseOf('hrv'))).toEqual({ keyTimes: [0, 0.5, 1], values: [0, 1, 0] })
  })

  test('the sigh fills 85% on the first inhale, the sip takes the rest', () => {
    expect(radiusKeys(exerciseOf('sigh')).values).toEqual([0, 0.85, 1, 0])
  })

  for (const ex of EXERCISES) {
    test(`${ex.key}: key times rise strictly from 0 to 1`, () => {
      const { keyTimes, values } = radiusKeys(ex)
      expect(keyTimes[0]).toBe(0)
      expect(keyTimes.at(-1)).toBe(1)
      keyTimes.slice(1).forEach((k, i) => expect(k).toBeGreaterThan(keyTimes[i]!))
      expect(values).toHaveLength(keyTimes.length)
    })
  }
})

describe('circle svg', () => {
  const box = exerciseOf('box')

  test('is one self-animating svg with no script', () => {
    const svg = circleSvg(box, 0)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg).toContain('<animate')
    expect(svg).toContain('repeatCount="indefinite"')
    expect(svg).not.toMatch(/<script|on[a-z]+=/i)
  })

  test('draws one countdown line per segment, plus the exercise name', () => {
    const svg = circleSvg(box, 0)
    for (const s of labelSegments(box)) expect(svg).toContain(`>${s.text}<`)
    expect(svg).toContain('>Box Breathing<')
  })

  test('starts as far into the breath as the band has been showing', () => {
    expect(circleSvg(box, 0)).toContain('begin="0s"')
    expect(circleSvg(box, 2500)).toContain('begin="-2.5s"')
    // a whole cycle later lands on the same point of the breath
    expect(circleSvg(box, 16000 + 2500)).toContain('begin="-2.5s"')
  })

  test('a negative or odd time never breaks the markup', () => {
    expect(circleSvg(box, -100)).toContain('begin="0s"')
    expect(circleSvg(box, Number.NaN)).toContain('begin="0s"')
  })

  test('the radius animation lasts one cycle', () => {
    expect(circleSvg(exerciseOf('478'), 0)).toContain('dur="19s"')
  })
})

// What the desktop app draws: the inner circle's radius at `ms` after the band appeared, read
// from the SVG's own animation (values, keyTimes, calcMode, begin, dur) the way SMIL plays it.
function fullnessAt(svg: string, ms: number): number {
  const anim = /<circle[^>]*opacity="0\.85"><animate ([^>]*)\/>/.exec(svg)![1]!
  const attr = (n: string) => new RegExp(`${n}="([^"]*)"`).exec(anim)![1]!
  expect(attr('calcMode')).toBe('linear')
  const values = attr('values').split(';').map(Number)
  const keyTimes = attr('keyTimes').split(';').map(Number)
  const dur = parseFloat(attr('dur')) * 1000
  const begin = parseFloat(attr('begin')) * 1000
  const f = (((ms - begin) % dur) + dur) % dur / dur
  let i = keyTimes.findIndex((k, j) => f >= k && f <= keyTimes[j + 1]!)
  if (i < 0) i = keyTimes.length - 2
  const span = keyTimes[i + 1]! - keyTimes[i]!
  const r = values[i]! + (values[i + 1]! - values[i]!) * (span ? (f - keyTimes[i]!) / span : 0)
  return Math.round(((r - values[0]!) / (Math.max(...values) - values[0]!)) * 1000) / 10
}

describe('the circle follows the seconds evenly', () => {
  // [ms into the breath, % full]
  const marks: Record<string, [number, number][]> = {
    box: [[0, 0], [1000, 25], [2000, 50], [3000, 75], [4000, 100], [6000, 100], [8000, 100],
      [9000, 75], [10000, 50], [11000, 25], [12000, 0], [14000, 0], [15999, 0]],
    '478': [[0, 0], [2000, 50], [4000, 100], [7500, 100], [11000, 100], [13000, 75], [15000, 50], [19000, 0]],
    hrv: [[0, 0], [1100, 20], [2750, 50], [5500, 100], [6600, 80], [8250, 50], [11000, 0]],
    // the sigh: 85% over a 4s inhale, the last 15% on the 1s sip, out over 10s
    sigh: [[0, 0], [2000, 42.5], [4000, 85], [4500, 92.5], [5000, 100], [7500, 75], [10000, 50], [15000, 0]],
  }

  for (const [key, list] of Object.entries(marks)) {
    const ex = exerciseOf(key)
    test(`${key}: size at each mark, from the start and 12 cycles in`, () => {
      const svg = circleSvg(ex, 0)
      for (const [ms, pct] of list) {
        expect(fullnessAt(svg, ms)).toBeCloseTo(pct, 0)
        expect(fullnessAt(svg, ms + 12 * cycleMs(ex))).toBeCloseTo(pct, 0)
      }
    })

    test(`${key}: a redraw 12 cycles and 2.3s in picks up exactly where the breath is`, () => {
      const at = 12 * cycleMs(ex) + 2300
      const redrawn = circleSvg(ex, at)
      // the redrawn image at its own time t shows what the first one shows at at + t
      for (let t = 0; t < 2 * cycleMs(ex); t += 250) {
        expect(fullnessAt(redrawn, t)).toBeCloseTo(fullnessAt(circleSvg(ex, 0), at + t), 0)
      }
    })

    test(`${key}: each whole second of countdown changes the size by the same step`, () => {
      const svg = circleSvg(ex, 0)
      for (const [start, ms] of [[0, ex.inhaleMs], [ex.inhaleMs + ex.hold1Ms, ex.exhaleMs]] as const) {
        const steps: number[] = []
        for (let t = 1000; t <= Math.floor(ms / 1000) * 1000; t += 1000) {
          steps.push(Math.abs(fullnessAt(svg, start + t) - fullnessAt(svg, start + t - 1000)))
        }
        for (const s of steps) expect(s).toBeCloseTo(steps[0]!, 0)
      }
    })
  }
})
