import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { profile } from './profileFields';
import { ledgerOutcome } from './shortlistMailFields';
export default defineSchema({
  visitorSessions: defineTable({ ownerHash: v.string(), expiresAt: v.number(), revoked: v.boolean(), profileVersion: v.optional(v.number()), newsletterVersion: v.optional(v.number()) }).index('by_ownerHash', ['ownerHash']),
  visitorMemories: defineTable({ ownerHash: v.string(), interest: v.union(v.literal('yoga'), v.literal('running'), v.literal('exploring')), consentedAt: v.number(), updatedAt: v.number() }).index('by_ownerHash', ['ownerHash']),
  styleProfiles: defineTable({ ownerHash: v.string(), profile, consentedAt: v.number() }).index('by_ownerHash', ['ownerHash']),
  mailingRequests: defineTable({ ownerHash: v.string(), emailCiphertext: v.string(), emailDigest: v.string(), keyVersion: v.literal(1), emailHint: v.string(), status: v.union(v.literal('pending'), v.literal('active')), consentedAt: v.number() }).index('by_ownerHash', ['ownerHash']),
  shortlistMail: defineTable({ operationId: v.optional(v.string()), ownerHash: v.string(), expiresAt: v.number(), recipientDigest: v.string(), idempotencyKey: v.string(), result: ledgerOutcome }).index('by_ownerHash', ['ownerHash']).index('by_ownerHash_and_operationId', ['ownerHash', 'operationId']),
  personalMemories: defineTable({ ownerHash: v.string(), name: v.string(), preferences: v.array(v.string()), consentedAt: v.number() }).index('by_ownerHash', ['ownerHash']),
  faceReferences: defineTable({ ownerHash: v.string(), model: v.string(), embedding: v.array(v.number()), consentedAt: v.number(), expiresAt: v.number() }).index('by_ownerHash', ['ownerHash']).index('by_model', ['model']),
  discoveries: defineTable({
    shop: v.string(), title: v.string(), description: v.string(),
    kind: v.union(v.literal('shop'), v.literal('event'), v.literal('offer')),
    sourceUrl: v.string(), checkedAt: v.number(), validUntil: v.number(),
    status: v.union(v.literal('draft'), v.literal('approved'), v.literal('withdrawn')),
    terms: v.string(),
  }).index('by_status_and_validUntil', ['status', 'validUntil']),
  sources: defineTable({ url: v.string(), markdown: v.string(), fetchedAt: v.number(), status: v.literal('needs_review') })
    .index('by_url', ['url']),
});
