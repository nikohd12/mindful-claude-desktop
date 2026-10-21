import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

// Beneath the plugin, the engine: its own band is empty, a command no hook answers says so.
const breathe = (args: string) => ({
  command: 'breathe', args,
  origin: { kind: 'composer' as const },
  presentation: { isFullscreen: false, columns: 100 },
})

function engine(on: On) {
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('command.run', () => ({ text: 'unanswered' }))
}

// The band above the prompt, drawn through the plugin as the engine asks for it.
const band = (isWorking: boolean) => ({
  plugin: 'mindful-desktop',
  component: 'AbovePrompt' as const,
  viewport: { columns: 100, rows: 40 },
  props: { isWorking, hasSurvey: false, maxRows: 12, bodyColumns: 95, scroll: { offset: 0, bodyRows: 11 }, view: {} },
})

test('desktop: a breathing circle appears after 3s of work, and only while Claude works', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  engine(on)

  const ui = await $.ui.mount({ ...band(true), surface: 'desktop' })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined() // under 3s: nothing yet

  await clock.advance(3000)
  await ui.redraw()
  const svg = await ui.find({ type: 'Svg' })
  expect(svg).toBeDefined()
  expect(String(svg!.props.source)).toContain('Coherent Breathing')
  expect(String(svg!.props.source)).toContain('begin="0s"') // the breath starts when the band shows
  expect(svg!.props.alt).toBe('Breathing guide: Coherent Breathing')

  await clock.advance(2500)
  await ui.redraw()
  expect(String((await ui.find({ type: 'Svg' }))!.props.source)).toContain('begin="-2.5s"')

  await ui.redraw({ ...band(false).props })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined() // Claude answered: gone
  await ui.unmount()
})

test('terminal: the original Mindful band, a Client module', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  engine(on)

  const ui = await $.ui.mount({ ...band(true), surface: 'terminal' })
  await clock.advance(3000)
  await ui.redraw()
  const client = await ui.find({ type: 'Client' })
  expect(client).toBeDefined()
  expect(client!.props.module).toBe('hooks/breathe.tsx')
  // its own frame clock moves the breath on: 5.5s in, the exhale starts
  expect(await ui.find({ type: 'Text', text: /Breathe in\.\.\. 6s/, in: client!.key })).toBeDefined()
  await ui.advance(6000)
  expect(await ui.find({ type: 'Text', text: /Breathe out\.\.\. 5s/, in: client!.key })).toBeDefined()
  await ui.unmount()
})

test('/breathe off hides it, /breathe box switches exercise, and back on', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  engine(on)

  const off = await $.command.run(breathe('off'))
  expect(off.text).toContain('breathe: off')

  const ui = await $.ui.mount({ ...band(true), surface: 'desktop' })
  await clock.advance(5000)
  await ui.redraw()
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()

  await $.command.run(breathe('on'))
  await $.command.run(breathe('box'))
  await clock.advance(3000)
  await ui.redraw()
  expect(String((await ui.find({ type: 'Svg' }))!.props.source)).toContain('Box Breathing')
  await ui.unmount()
})

test('settings saved in an earlier session are read back at start', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on, { config: { enabled: true, exercise: '478', style: 'random', delay: 0 } })
  engine(on)
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })

  const ui = await $.ui.mount({ ...band(true), surface: 'desktop' })
  await clock.settle()
  await ui.redraw()
  expect(String((await ui.find({ type: 'Svg' }))?.props.source)).toContain('4-7-8 Breathing')
  await ui.unmount()
})

test('a real turn: the band appears by itself after the delay, and a subagent never resets it', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  engine(on)
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }) as never)

  await $.turn.start({ text: 'go', turnId: 't1' })
  const ui = await $.ui.mount({ ...band(true), surface: 'desktop' })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()

  await clock.advance(3000) // the wake timer redraws: no manual redraw here
  expect(await ui.find({ type: 'Svg' })).toBeDefined()

  // 2s later a subagent starts and finishes: the breath keeps its place
  await clock.advance(2000)
  await $.turn.start({ text: 'sub', turnId: 't2', agentId: 'a1' })
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't2', agentId: 'a1', reason: 'answer', text: '' } as never)
  await ui.redraw()
  expect(String((await ui.find({ type: 'Svg' }))!.props.source)).toContain('begin="-2s"')
  await ui.unmount()
})

test('desktop: only the circle is centred; what others draw in the band keeps its place', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  engine(on)
  const ui = await $.ui.mount({ ...band(true), surface: 'desktop' })
  await clock.advance(3000)
  await ui.redraw()
  const boxes = await ui.findAll({ type: 'Box' })
  const centred = boxes.filter(b => b.props.alignItems === 'center')
  expect(centred).toHaveLength(1)
  expect(JSON.stringify(centred[0]!.children)).toContain('Svg')
  expect(JSON.stringify(centred[0]!.children)).not.toContain('"Box"')
  await ui.unmount()
})
