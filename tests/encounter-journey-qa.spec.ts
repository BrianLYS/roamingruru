// Retired September 22, 2026: these scenarios asserted the superseded manual
// shortlist search, browser-lifetime one-send rule, fixed-interest memory, and
// global Forget behavior. Their current replacements are:
//
// - tests/agent-spec-qa.spec.ts: open-ended agent/tool discovery, independent
//   consent, sourced cards, stale-reply cancellation, email operation retries,
//   repeated requests, and desktop/mobile layout.
// - tests/face-memory.spec.ts: optional enrollment, return recognition, refresh,
//   and departure clearing.
// - tests/memory-qa.spec.ts: Stop during waiting, playback, and listening.
// - tests/style-profile-qa.spec.ts: local camera and clothing-frame consent.
//
// The legacy cases are intentionally absent from Playwright collection rather
// than skipped, so the default run reports only current product contracts.
export {};
