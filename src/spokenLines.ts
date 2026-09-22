import { replyTo } from './discovery.ts';
import { visitors } from './mall/visitors.ts';
export const hello = 'Hey, I’m Ruru. Looking for anything, or just having a wander?';
// Authored lines are allowed directly; generated replies require a server-signed token.
export const spokenLines = new Set([
  hello, 'All forgotten. A fresh little hello!',
  ...['discount', 'yoga', 'running', 'newsletter', 'remember', 'exploring', 'thanks'].map(topic => replyTo(topic).text),
  ...visitors.flatMap(visitor => [visitor.greeting, visitor.reply, visitor.followup, `Let’s say hello to ${visitor.name}. I’m on my way!`]),
]);
