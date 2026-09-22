import { v } from 'convex/values';
export const terminal = v.union(
  v.object({ outcome: v.literal('sent'), messageId: v.string(), threadId: v.string() }),
  v.object({ outcome: v.literal('unknown'), reason: v.union(v.literal('attempt_in_progress'), v.literal('provider_uncertain'), v.literal('ledger_failure')) }),
  v.object({ outcome: v.literal('rejected'), reason: v.union(v.literal('invalid_request'), v.literal('not_configured'), v.literal('provider_rejected'), v.literal('already_rejected')) }),
);
export const ledgerOutcome = v.union(terminal, v.object({ outcome: v.literal('pending') }));
