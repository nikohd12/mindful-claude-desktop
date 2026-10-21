# Mindful Claude for the desktop app

A guided breathing exercise above the prompt while Claude works, in the **Claude desktop app's Code tab**.

This is the desktop app version of [Mindful Claude](https://github.com/halluton/Mindful-Claude) by Halluton. The original draws its breathing band only in the terminal, because it uses a component the desktop app can't show. This version draws a soft circle the desktop app can show. It grows as you breathe in, holds, and shrinks as you breathe out, with a countdown under it. In the terminal you still get Mindful Claude's original band.

<p align="center"><img src="preview.svg" alt="An orange circle grows and shrinks with a countdown: Breathe in... 6s, Breathe out... 6s" width="360"></p>

## Install

Type this at the prompt of a Claude Code terminal session:

```
/plugin install mindful-desktop --marketplace nikohd12/mindful-claude-desktop
```

Answer `y` to add the marketplace, then pick a scope (user scope makes it show in every session, desktop app included).

In the desktop app, where `/plugin` doesn't run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `nikohd12/mindful-claude-desktop`, then **Add plugin**.

Needs a Claude Code build with function hooks (mods).

Install either Mindful Claude or this mod, not both: each adds a `/breathe` command.

## How it behaves

- Shows once Claude has been working for 3 seconds, so quick replies don't flash it.
- Goes away when Claude answers.
- Leaves the spinner line alone.
- Remembers your settings between sessions.

## Commands

| Command | What it does |
| --- | --- |
| `/breathe` | Shows your current settings |
| `/breathe on` / `/breathe off` | Turns the breathing guide on or off |
| `/breathe hrv` | Coherent Breathing: 5.5s in, 5.5s out (the default) |
| `/breathe sigh` | Physiological Sigh: double inhale, long exhale |
| `/breathe box` | Box Breathing: 4s in, 4s hold, 4s out, 4s hold |
| `/breathe 478` | 4-7-8 Breathing: 4s in, 7s hold, 8s out |
| `/breathe delay <s>` | Seconds of work before it shows (0 shows it at once) |
| `/breathe style <name>` | Terminal only: pulse, ripples, dots, wave or random |

## How it works

The mod hooks the band above the prompt (`AbovePrompt`). On the desktop app it draws one SVG that animates itself, so it moves smoothly and the mod doesn't redraw it every frame. In the terminal it mounts Mindful Claude's original band module. It makes no network calls and runs no commands. It stores only its own settings.

## Tests

```
bun test spec
claude plugin test .
```

## Credits and license

The exercises, timing, terminal shapes and terminal band come from [Mindful Claude](https://github.com/halluton/Mindful-Claude) by Halluton, under the MIT license. Every file taken from it says so at the top. This version is MIT too; see [LICENSE](LICENSE).
