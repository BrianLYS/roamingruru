export const visitors = [
  { id: 'maya', name: 'Maya', interest: 'Yoga & a little me-time', color: '#c89289', skin: '#c48e68', hair: '#3d302a', x: -4, z: 1, greeting: 'Hey Maya. How was your yoga class?', reply: 'Good! I could use a new top for the next one.', topic: 'I love yoga', followup: 'There’s lululemon just over there. Worth a look for your next class.' },
  { id: 'leo', name: 'Leo', interest: 'A run after work', color: '#829d9c', skin: '#d8ae86', hair: '#4c382e', x: 4, z: 2, greeting: 'Hey Leo. Heading out for a run?', reply: 'Later. Trying to find some people to run with.', topic: 'I like running', followup: 'Running’s better with company. We could check the community page for a group.' },
  { id: 'sam', name: 'Sam', interest: 'Just looking around', color: '#b2a3c7', skin: '#986949', hair: '#292925', x: -1, z: 5, greeting: 'Hey Sam. Back for another wander?', reply: 'Yep. Anything worth a look?', topic: 'Just exploring', followup: 'Lululemon’s just over there. Or you can hang out here with me.' },
] as const;
export type VisitorId = typeof visitors[number]['id'];
export type MallPhase = 'roaming' | 'approaching' | 'greeting';
