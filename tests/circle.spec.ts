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
    expect(radiusKeys(exerciseOf('box'))).toEqual({
      keyTimes: [0, 0.25, 0.5, 0.75, 1],
      values: [0, 1, 1, 0, 0],
      splines: ['ease', 'linear', 'ease', 'linear'],
    })
  })

  test('coherent breathing has no holds: in then out', () => {
    expect(radiusKeys(exerciseOf('hrv'))).toEqual({ keyTimes: [0, 0.5, 1], values: [0, 1, 0], splines: ['ease', 'ease'] })
  })

  test('the sigh fills 85% on the first inhale, the sip takes the rest', () => {
    expect(radiusKeys(exerciseOf('sigh')).values).toEqual([0, 0.85, 1, 0])
  })

  for (const ex of EXERCISES) {
    test(`${ex.key}: key times rise strictly from 0 to 1`, () => {
      const { keyTimes, values, splines } = radiusKeys(ex)
      expect(keyTimes[0]).toBe(0)
      expect(keyTimes.at(-1)).toBe(1)
      keyTimes.slice(1).forEach((k, i) => expect(k).toBeGreaterThan(keyTimes[i]!))
      expect(values).toHaveLength(keyTimes.length)
      expect(splines).toHaveLength(keyTimes.length - 1)
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
