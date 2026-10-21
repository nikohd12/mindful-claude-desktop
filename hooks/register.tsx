/* @jsx h */
import type { Register, Timer } from 'claude-code'
import { DEFAULTS, applyCommand, readConfig, type Config } from './breath/config.ts'
import { circleSvg } from './breath/circle.ts'
import { exerciseOf } from './breath/exercises.ts'
import { pickStyle, type Style } from './breath/shapes.ts'

// The hooks module, adapted from Mindful Claude by Halluton (MIT; see LICENSE). While a turn
// runs, and once it has run `delay` seconds, it draws a breathing guide above the prompt:
// in the terminal, Mindful Claude's band (./breathe.tsx, a Client module); on the desktop
// app (and any surface with Svg), one self-animating SVG circle (./breath/circle.ts).
// /breathe changes the settings, kept in $.store.

const BAND_ROWS = 9 // the terminal band: seven rows of picture, the phase line, the exercise name

let config: Config = DEFAULTS
// the running turn: when it started and which terminal style it drew
let turn: { startedAt: number; style: Style } | undefined
let lastStyle: Style | undefined
// the pending redraw for when the delay has passed
let wake: Timer | undefined

const log = ($: { ui: { log: (text: string) => void } }, what: string) => (err: unknown) => $.ui.log(`mindful-desktop: ${what}: ${err}`)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    config = readConfig(await $.store.get('config').catch(log($, 'store read failed')))
    await $.command.register({
      name: 'breathe',
      description: 'Breathing guide above the prompt while Claude works: on, off, hrv, sigh, box, 478, delay (mindful-desktop)',
      argumentHint: '[on | off | hrv | sigh | box | 478 | style <name> | delay <s> | help]',
      immediate: true,
    }).catch(log($, '/breathe not registered'))
    return r
  })

  on('command.run', { command: 'breathe' }, async ($, e) => {
    const applied = applyCommand(config, e.args)
    if (applied.config !== config) {
      config = applied.config
      await $.store.set('config', config).catch(log($, 'store write failed'))
      $.ui.invalidate('ui.render')
    }
    return { text: applied.text }
  })

  // the main loop's turns alone: a subagent's start or end must not restart or clear the band
  on('turn.start', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    const style = pickStyle(config.style, lastStyle)
    lastStyle = style
    wake?.cancel()
    wake = undefined
    turn = { startedAt: await $.clock.now(), style }
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId !== undefined) return r
    wake?.cancel()
    wake = undefined
    turn = undefined
    $.ui.invalidate('ui.render')
    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (!config.enabled || !e.props.isWorking || e.props.hasSurvey) return next(e)
    const now = await $.clock.now()
    // a turn the hook saw start; else one that is working anyway (started before the plugin loaded)
    turn ??= { startedAt: now, style: pickStyle(config.style, lastStyle) }
    // the breath starts when the band appears, on its first inhale
    const breathMs = now - turn.startedAt - config.delay * 1000
    if (breathMs < 0) {
      // not yet: draw again when the delay has passed (also after /breathe delay mid-turn)
      wake ??= $.clock.after(-breathMs, () => {
        wake = undefined
        $.ui.invalidate('ui.render')
      })
      return next(e)
    }

    if (e.surface === 'terminal') {
      const { Box, Client } = $.ui.resolve(e)
      const rows = Math.min(BAND_ROWS, e.props.maxRows)
      if (rows < 1) return next(e)
      // the key names the turn: one instance per turn, remounted when the settings change mid-turn
      const key = `breathe:${turn.startedAt}:${config.exercise}:${turn.style}`
      return (
        <Box flexDirection="column">
          <Client key={key} module="./breathe.tsx" width={e.props.bodyColumns} height={rows}
            props={{ exercise: config.exercise, style: turn.style, elapsedMs: breathMs }} />
          {await next(e)}
        </Box>
      )
    }

    const table = $.ui.resolve(e)
    if (!('Svg' in table)) return next(e)
    const { Box, Svg } = table
    const exercise = exerciseOf(config.exercise)
    // no width: the image takes its own 360px, scaled down where the band is narrower
    return (
      <Box flexDirection="column">
        <Box flexDirection="column" alignItems="center">
          <Svg source={circleSvg(exercise, breathMs)} alt={`Breathing guide: ${exercise.name}`} />
        </Box>
        {await next(e)}
      </Box>
    )
  })
}
