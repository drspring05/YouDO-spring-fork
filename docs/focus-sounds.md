# Focus sounds

Calm sound that plays during a focus session. It starts with the timer, pauses
with it, fades out when the session ends, and pauses when you leave the app
unless **Keep playing** is on.

## Sources

Every recording is CC0 (public domain): no attribution is required, but we
credit the authors anyway. Files are in `public/sounds/`, converted to Opus.

| In the app | File | Original | Author | Source |
| --- | --- | --- | --- | --- |
| Acoustic guitar | `guitar.ogg` | A Small Fire Will Do (calming loop) | Trex0n | [OpenGameArt](https://opengameart.org/content/a-small-fire-will-do-calming-loop) |
| Soft piano | `piano-jrpg.ogg` | JRPG Piano | Joth | [OpenGameArt](https://opengameart.org/content/jrpg-piano) |
| Gentle piano | `piano-catmint.ogg` | Catmint | Kistol | [OpenGameArt](https://opengameart.org/content/catmint) |
| Soft thunder | `thunder.ogg` | Rain and storm #2 (0740), trimmed to 120 s | Joseph Sardin | [BigSoundBank](https://bigsoundbank.com/rain-and-storm-2-s0740.html) |
| Forest stream | `forest.ogg` | Forest and stream #3 (2716), trimmed to 120 s | Joseph Sardin | [BigSoundBank](https://bigsoundbank.com/forest-and-stream-3-s2716.html) |

Brown and pink noise are generated in the app (`generateNoise` in
`src/lib/focusSounds.ts`), so they have no file.

## How it plays

- Web Audio, so music loops are gapless. The two nature recordings are not
  loops; each pass fades into the next over 4 seconds.
- **Keep playing** on Android: while a sound plays, the live session
  notification becomes a media-playback foreground service
  (`FocusSoundService`), so the phone keeps the app and the sound running with
  the screen off. Swiping the app away stops it.
