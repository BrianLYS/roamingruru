export type Interest = 'yoga' | 'running' | 'exploring';
export { officialSources } from './sourcePolicy.ts';
export function replyTo(text: string): { text: string; interest?: Interest } {
  if (/discount|offer|coupon|deal/i.test(text)) return { text: "I don’t have a discount to offer. We can check the official shop, though." };
  if (/yoga|stretch|pilates/i.test(text)) return { text: "Yoga, nice. Looking for something to wear, or somewhere to practise?", interest: 'yoga' };
  if (/run|jog|race/i.test(text)) return { text: "We could check Valley Fair’s events page for a running group. Any dates would need checking there.", interest: 'running' };
  if (/email|phone|newsletter|sign.?up/i.test(text)) return { text: "There’s a mailing-list option below if you’d like updates. You can leave your email there privately." };
  if (/remember|memory/i.test(text)) return { text: "Sure. Open ‘What Ruru remembers’ and choose what you’d like to save. You can forget it whenever you want." };
  if (/thanks|thank you|bye|see you/i.test(text)) return { text: "See you around." };
  return { text: "Hey, I’m Ruru. Looking for anything, or just having a wander?", ...(/explor|wander|brows|shopping|seeing where/i.test(text) ? { interest: 'exploring' as const } : {}) };
}
