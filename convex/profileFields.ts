import { v } from 'convex/values';
export const profile = v.object({
  name: v.string(), interest: v.union(v.literal('yoga'), v.literal('running'), v.literal('exploring')),
  garment: v.union(v.literal('top'), v.literal('leggings'), v.literal('shorts'), v.literal('jacket'), v.literal('trousers'), v.literal('dress'), v.literal('unknown')),
  color: v.union(v.literal('black'), v.literal('white'), v.literal('grey'), v.literal('blue'), v.literal('green'), v.literal('red'), v.literal('pink'), v.literal('neutral'), v.literal('other')),
  style: v.union(v.literal('active'), v.literal('casual'), v.literal('smart'), v.literal('unknown')),
});
