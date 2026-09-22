# Hackathon log

- **Project:** RoamingRuru
- **Event:** Convex All Gas Hackathon
- **What it does:** An armless tracked robot with an expressive screen face roams a Three.js mall, greets simulated visitors and supports voice-first conversation with a typed alternative.
- **Live app:** https://roaminglulu.fraylabs.chatgpt.site
- **Repo:** https://github.com/BrianLYS/roamingruru
- **Frontend:** React + Three.js on ChatGPT Sites
- **Convex deployment:** famous-tapir-87 — dedicated development functions deployed
- **Components:** none
- **Convex features:** schema, indexed internal queries/mutations and fixed scheduled expiry for consented activity/clothing memory and independent mailing subscriptions, personal memory and face references; atomic per-operation email reservations and duplicate-send protection
- **Auth:** anonymous signed HttpOnly browser session through same-origin server routes; internal Convex memory functions
- **AI models:** ElevenLabs v3 (selected animated voice), Multilingual v2 (classic voice), local BlazeFace short-range (face position); local Human/MobileFace recognition; gpt-4.1-mini live conversation and separately consented clothing vision verified
- **Started:** 2026-09-21T06:35:25Z
- **Last updated:** 2026-09-22T17:00:00Z

## Demo

- **Film:** https://roaminglulu.fraylabs.chatgpt.site/media/roaminglulu-launch.mp4 (2:50)
- **Try it:** open Talk with Ruru and send the prefilled mailing-list request. Ruru chooses `show_mailing_qr`, changes her face to a QR code and opens a signup form. No email is required to explore the demo.
- **Presentation:** final section on the same page.

## What works

OpenAI chooses tools for conversation, visible clothing, remembered preferences, official mall discovery, simulated store navigation and QR signup. Convex stores visitor memory and independent mailing subscriptions behind signed sessions; internal mutations enforce consent, deletion and per-operation email deduplication. Firecrawl retrieves official store sources. AgentMail sends requested shortlists from the dedicated inbox; one bounded synthetic send/reply exchange was verified. ElevenLabs voices Ruru. Three.js renders the armless robot, expressive screen, visitors and fixture-aware pathfinding.

The mall, animated story offers and events are illustrative. This is a software prototype, not physical robotics. There is no automated marketing campaign. Real memory matching is a demo capability, not a claim of production recognition accuracy.

## Current product result

[Agent, consented face memory and mailing-list result](docs/style-profile-result.md) is authoritative. Local implementation and bounded real provider acceptance are complete, including live conversation, official discovery, generated speech, separately consented clothing vision, face return visits and forgetting.

## Log

### 2026-09-21 - working tree
Created a Three.js mall with storefronts, seating, plants and seven animated people.
Lulu is a roaming display that approaches three selectable visitors and plays
scripted encounters (`src/mall/`). The shared expression engine supports six
expressions, blinking, gaze and eased transitions in the scene and a Face only
view (`src/face.ts`, `src/Lulu.tsx`). Body/hand mechanics are outside the MVP.
Retained browser voice, typed discovery, opt-in browser interest memory and a
consent-preview pass (`src/App.tsx`). Installed the official hackathon skill and
Convex development guidance, and prepared internal provider actions (`convex/`).
Build/typecheck and browser checks verify scene travel/pause, visitor selection,
expression views, mobile layout, memory/consent and voice fallback. Real audio
quality, provider integration and physical hardware remain unverified.

### 2026-09-21 - presentation refinement
Refined the local demo with warmer colour and typography, a guided encounter
invitation, a following camera, turn-by-turn visitor dialogue, a quieter control
layout and collapsed expression previews. Removed the redundant scene speech
bubble so dialogue has one clear home. Retained voice-first input and typing.
Build and two unit tests pass; browser coverage includes the guided encounter,
visitor dialogue, mobile fit, travel/pause, expression views and voice fallback.

### 2026-09-21 - concept introduction
Added a “What is roaminglulu?” section beneath the demo and an introduction link.
Explains the expressive character, discovery concept and optional continued
connection, distinguishing the vision from the current scripted demonstration.
Build passes; checked the section and anchor at desktop and mobile widths.

### 2026-09-21 - grounded robot character
Brian expanded the visual scope to a cute, armless rolling robot. Added a rounded
body, rubber tracks with moving tread segments, wheel hubs, neck joint and tilting
screen head. Travel turns toward the destination and slows on approach; the body
stays grounded. Moved the concept section above the introduction and updated its
copy to the revised scope. Physical hardware remains out of scope.
Build and four mall browser checks pass, including travel/pause, encounters,
mobile layout, expression view and WebGL fallback. Inspected the rendered robot.

### 2026-09-21 - HTML introduction presentation
Replaced the concept section with an embedded four-slide presentation. The same
self-contained `public/intro.html` opens separately or offline, with keyboard,
slide buttons, fullscreen and print layouts. It introduces Lulu, personality,
discovery and the bounded demo. Verified offline navigation, mobile width and
the embedded link back to the interactive demo; inspected desktop/mobile images.

### 2026-09-21 - clearer brand-guide explanation
Clarified the presentation and demo introduction around Brian’s core concept:
Lulu roams malls and talks with visitors about the brands there. Added a concrete
illustrative lululemon conversation and explained products, experiences, events
and approved promotions as the intended discovery topics.

### 2026-09-21 - readability redesign
Reworked the landing page with a clear brand-guide explanation, an animated Lulu
illustration, larger text and darker labels. The HTML presentation is optional,
with both an expandable embed and standalone links. Dialogue now sits below the
mall scene; the conversation controls use a separate white panel. Removed the
external font dependency. Desktop/mobile visual checks show no horizontal
overflow. Reduced offscreen face animation and redundant paused-scene shadow work.
Build and all nine browser scenarios passed across the final checks and reruns.
The full memory/consent journey took 43.4 seconds in software-rendered Chromium;
its overall timeout is now 60 seconds, with assertions unchanged.

### 2026-09-21 - ElevenLabs voice preparation
Replaced browser speech synthesis with a local server-side ElevenLabs adapter,
authored-line allowlist, bounded generation and an audio cache. Playback cancels
on mute/replacement and failures preserve readable text. Five unit tests and two
mocked voice browser checks pass. No real provider request or audio-quality
verification: the project configuration does not yet contain the ElevenLabs key;
its location was requested from Brian. A voice must still be selected. The Vite
route is local only, not a deployed production backend.

### 2026-09-21 - real ElevenLabs speech verified
Scoped key delivery completed without exposing credentials. Voice metadata read
succeeded and Jessica (Playful, Bright, Warm) was selected. Generated a 60-character
authored greeting: HTTP200 audio/mpeg, 53,960 bytes, decoded duration 3.297 seconds.
Real Chromium playback advanced, mute stopped it, and replay completed with zero
page errors. Repeat server retrieval matched the saved audio; local caching works.
Evidence: `docs/style-profile-result.md`. This is local TTS, not a live conversational
AI integration or public deployment. Brian’s subjective voice preference is untested.

### 2026-09-21 - reduced page clutter
Simplified the page to one explanation and primary action, with one standalone
presentation link in the header. Removed repeated explanatory strips, decorative
captions and suggested-question buttons. Camera settings and visitor selection
are collapsed by default. Preserved expressive faces, typing, voice, presentation
and consent controls. Build and eight relevant browser scenarios passed, including
mobile, scene/visitor interaction, expression views and mocked ElevenLabs playback.

### 2026-09-21 - encounter states and consented Convex memory
Deployed development functions to the existing famous-tapir-87 allocation. Added
signed anonymous browser ownership, explicit interest consent, return recognition,
confirmed forgetting, revocation and scheduled expiry. Added thinking/finished
speech states, a large Stop target, and pause-preserving mall dialogue. Kept the
simplified page and existing armless robot. Build, 10 unit tests, 11 regression
browser scenarios and seven independently reviewed QA scenarios pass. Replayed
existing Jessica audio to verify actual Stop/completion without new generation.
Current result, security boundaries and residual synthetic QA data:
`docs/style-profile-result.md`; independent evidence: `docs/style-profile-result.md`.
Selected skills: committed-execution v1.4, official Convex expert v1.10.0,
project-local Convex hackathon skill and installed CLI Convex guidelines.

### 2026-09-21 - working tree: complete encounter integration
Added screen-height first-person view, direct Meet Lulu greeting, bounded OpenAI
conversation with explicit scripted fallback, contextual official-shop shortlist
and separately consented one-off email controls. Convex now records a send attempt
before AgentMail, preventing retries after uncertain outcomes. Development deploy
and synthetic ledger read/duplicate/forget/revocation checks passed without email.
OpenAI key/model access succeeded, but bounded real generation was rejected with exhausted credit. Build, 37 unit tests, 11 existing browser regressions and 4 independent mocked journey scenarios pass. Firecrawl and AgentMail remain unconnected.

### 2026-09-22 - working tree: live email path
Delivered scoped AgentMail configuration and submitted exactly one clearly marked
synthetic shortlist through the actual browser form to the controlled recipient.
Provider acceptance, Convex status, controlled recipient receipt and one reply
back into Lulu’s scoped inbox are verified. The bounded exchange is complete. Search used a synthetic fixture, not Firecrawl.
A fresh OpenAI check after reported funding still failed with exhausted credit.

### 2026-09-22 - working tree: real Firecrawl search
Verified exactly one official Singapore shop search through the actual shortlist
button. Three allowed pages returned and two links rendered with a signed receipt.
Results included yoga articles and a leggings category, not two specific products.
No recursive crawl, email or additional OpenAI call occurred.

## Remaining submission evidence

The local app and dedicated Convex development functions are verified. Live conversation/vision, official Firecrawl discovery, ElevenLabs playback and the previously authorized AgentMail exchange are verified. No live stock, discounts or affiliation are asserted.
Registration is not verified. Public source, hosted app, a video under three minutes and social sharing/submission remain outside this completed local scope, pending authorization and actual delivery.

## September22 — approved agent and recognition spec

Saved Brian-approved `docs/style-profile-result.md` and integrated tool-using OpenAI conversation, signed generated ElevenLabs replies, official source discovery, local consented face embeddings, general Convex memory and independent mailing-list signup/forget/unsubscribe. Removed one-send-per-browser logic in favor of operation IDs. Existing mall and first-person view retained. Development functions deployed to the existing allocation; synthetic real storage/read/cross-session-match/delete checks passed. New official product search and new Jessica sample playback/Stop verified; no new mail.50unit tests and build pass. Live OpenAI inference remains blocked by the last confirmed credit error, so no fully live-agent or submission-ready claim. Current result: `docs/style-profile-result.md`.

September22 funding follow-up: Brian reported a new actual top-up after the prior failed checks. The unchanged key now passed real agent-selected search, speech playback/Stop, explicit synthetic clothing analysis and a context-aware follow-up. No email replay. All 50 unit tests, 21 browser tests and build/type checks remain passing; no product code changed during provider acceptance. Current evidence is linked above.

## September22 — Valley Fair setting

Brian selected Westfield Valley Fair. The existing demo now uses a stylized two-level glass atrium, geometric stone flooring, skylight structure, escalator and real store names. US lululemon and Valley Fair official sources replace Singapore discovery. All 55 unit tests/build pass; two bounded real localized searches passed. No new resource, email or public deployment. Current verification and references: `docs/style-profile-result.md`.

### 2026-09-22 — local hackathon video
Recorded actual Lulu-led conversation and official discovery, with generated Jessica audio. Produced a narrated/captioned 2:13 1080p MP4 at [local verification artifact]. No mail, profile writes or publication. Current result and evidence: `docs/style-profile-result.md`.

### 2026-09-22 — animated launch film replacement
Brian rejected the walkthrough. Replaced it with an86-second original JavaScript-animated launch film, original synthesized score, existing verified Lulu voice and14seconds of actual product proof. Embedded locally below the encounter; no public upload/submission or new provider calls. Evidence/source: `docs/style-profile-result.md`, `tools/launch-film/`.

### 2026-09-22 — public RoamingRuru release
Renamed the character and project, simplified the conversation UI and added the mailing QR tool, an inline presentation and an original JavaScript launch film. The final170second film includes a real recorded QR interaction after Behind the scenes.90unit tests and the Sites build pass; desktop/mobile navigation, film and signup journeys pass.
Published the current app on ChatGPT Sites and a clean public source snapshot under BrianLYS. Anonymous conversation status returns200/live. A real hosted request displayed the QR face and opened the empty signup form; no email submitted. Luma shows registration confirmed. Submitted at https://vibeapps.dev/s/roamingruru before the deadline. Launch film and technical thread: https://x.com/LimYiShengBrian/status/2102447606551187960
