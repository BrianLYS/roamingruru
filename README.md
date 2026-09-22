# RoamingRuru

**Every mall needs a Ruru.** Imagine walking into your usual mall and a little robot rolls over to say hello. Ruru chats with shoppers, helps them explore what the mall has to offer and, with permission, remembers them next time. For stores, these conversations create opportunities to introduce relevant products, offers, events and memberships.

This is a Valley Fair inspired software prototype with live conversation, official source discovery, consented memory and independent mailing signup. Physical robotics, offer redemption, event registration and retailer membership enrollment are not implemented. The layout is illustrative; no mall affiliation or measured sales uplift is claimed.

[Live demo](https://roaminglulu.fraylabs.chatgpt.site) · [Launch film](https://roaminglulu.fraylabs.chatgpt.site/media/roaminglulu-launch.mp4) · [Hackathon log](hackathon.md)

## Run locally

```sh
npm ci
npm run dev -- --port 4317
```

Open http://127.0.0.1:4317. Use **Meet Ruru** for voice or typed conversation, **Ruru’s view** for first person, or **Watch an encounter** for the explicitly simulated NPC experience. Talk with Ruru is the first section. The header’s Presentation link scrolls to the final inline section, with slide navigation and fullscreen controls. The presentation also remains usable offline.

Ruru's OpenAI agent chooses eight direct tools: look_at_person, recognize_person, remember_person, find_in_mall, go_to_store, show_mailing_qr, show_face and forget_person. Generated replies can use ElevenLabs. Stop/mute cancels pending work and playback; typing remains available. Live OpenAI conversation, agent-selected official search, generated speech playback and separately consented clothing vision are verified with the existing key after Brian’s new funding update.

The visitor enables Ruru’s camera once for the demo. Local face detection and embeddings support gaze and return-visit matching; `look_at_person` analyses the current clothing frame when the agent chooses it. No continuous video is stored. The local model is tested on controlled fixtures, not certified for production identification.

`remember_person` saves name, preferences and an optional face representation directly after conversational agreement; `forget_person` removes personal memory. Neither opens a feature form. Mailing signup remains independent: `show_mailing_qr` changes her face to a code for the phone form, and `show_face` restores her expressions. The hosted demo is public for the hackathon. No campaign is running; existing synthetic email allowances remain consumed.

`go_to_store` walks Ruru along fixture-aware routes to lululemon, Apple or Aēsop in the illustrative scene. She stops at the storefront; this is simulated guidance, not a real mall floorplan.

Official discovery uses Firecrawl within the assigned provider scope. Sources are linked, and product/category/editorial/event pages are distinguished. No stock, discounts, bookings or events are fabricated. A requested shortlist email uses a durable operation ID so retrying cannot duplicate a send; a later distinct request gets a new ID.

## Local configuration

Use only assigned server-side keys in ignored `.env.local`: `OPENAI_API_KEY`, `OPENAI_MODEL`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `FIRECRAWL_API_KEY`, `AGENTMAIL_API_KEY`, `AGENTMAIL_INBOX_ID`, `CONVEX_URL`, `CONVEX_DEPLOY_KEY`, `MEMORY_SESSION_SECRET`. Never expose these through `VITE_` variables. Preserve the existing memory signer; it also derives contact encryption keys.

The sole allocated database is development `famous-tapir-87`. Local API routes accept loopback same-origin requests, derive ownership from signed HttpOnly cookies, and invoke internal Convex functions with server-held access. Fixed sessions expire after30days; delayed writes after removal are rejected. Synthetic mall NPC data never enters real visitor memory. The inherited browser ownership session manages deletion/subscription; facial recognition does not grant those permissions in another browser.

The ChatGPT Sites deployment is tracked in `.openai/hosting.json`. See [hosting details](docs/sites-deployment.md). Brian authorized this public hackathon release under BrianLYS; new spending is outside scope.

## Checks

```sh
npm test
npm run build
npx playwright test
```

Browser tests mock provider endpoints and use synthetic camera fixtures. Do not rerun private real-mail/search verification scripts without checking their receipts and remaining authorization. Browser speech recognition needs browser support and microphone permission; it can use a browser-vendor service. Camera access starts only on explicit action and requests no microphone.
