# Roaminglulu launch film

Brian-approved problem-first opening and two-visit product story: 146 seconds, original JavaScript SVG animation, two-character ElevenLabs dialogue and original synthesized music. No third-party footage or subscriptions. Exact dialogue and on-screen copy were approved in the builder conversation before implementation.

- `dialogue.json`: approved lines, audio paths, measured durations.
- `voice.mjs`: bounded named-line synthesis; generated receipt/hash checks prevent blind replay. Existing product ElevenLabs allocation only. Do not run generation merely to render.
- `timeline.mjs`: speech-aware scene clock and pauses.
- `film.mjs` / `illustrations.mjs`: same Brian, jacket and yellow umbrella through the rainy meeting and sunny return; expressive armless Lulu, mall navigation and store visit.
- `music.mjs`: original synthesized stereo score, ducked under dialogue.
- `render.mjs`: 30fps picture or representative stills (`--stills`).
- `finish.mjs`: 1080p H.264/AAC export, exact dialogue mix, VTT and production receipt.

Render with existing audio: `node tools/launch-film/music.mjs`, `node tools/launch-film/render.mjs --stills`, `node tools/launch-film/render.mjs`, `node tools/launch-film/finish.mjs`. Requires existing Sharp and ffmpeg. Missing approved audio fails finalization. Ignored audio/receipts live in `.local/launch-film/story-audio/`; the checked-in final movie/poster/captions live in `public/media/` for the existing website.

This is an animated marketing story. It does not perform a transaction or assert a verified real retailer promotion. It replaces the earlier live-recording inset film. No mail, profile writes or live product operations are part of rendering. Source stays private and the existing owner-private Site audience is preserved.

Selected final voices: original animated Lulu 1 and Brian 1. Regeneration uses `selected-voice.mjs` with saved selection receipts; legacy `voice.mjs` retains the original stock-voice production path. Current runtime 2:26, including the approved 15-second Behind the scenes sequence after the story’s closing line.

Current product name: RoamingRuru / Ruru. `rename-audio.mjs` records the single changed Brian line and reuses the other selected recordings. Historical asset paths remain compatible.

QR story: three approved lines via `qr-voice.mjs`, then an eleven-second animated scan/signup/face-return sequence. No real signup or mail operation occurs during rendering.

Natural invitation refinement: `qr-natural-voice.mjs` updates only line 13; face/phone transitions ease continuously in `qrEncounter`.

## Real product appendix

The delivered local film is 170 seconds: the 146-second animated film followed by the approved three-second “Meet Ruru for yourself.” intro, 16 seconds of the authentic Talk with Ruru flow and five seconds of its empty signup form. The real recorded response invokes `show_mailing_qr`; no email was submitted. The exact recorded agent reply was recovered from the running voice cache and aligned to the QR reveal at158seconds. Existing captions describe the animated portion.

`node tools/launch-film/append-live-demo.mjs` reconstructs the final media from the retained ignored `.local/live-demo/receipt.json` and raw recordings, plus `.local/launch-film/roaminglulu-launch.mp4`. It does not issue a new conversation or any external action. Run after the animated rendering/finish pipeline; `finish.mjs` alone produces only the 146-second animated base.
