import { useState } from 'react';
import './how-lulu-works.css';

const parts = {
  screen: {
    label: 'Screen', title: 'A face you can talk to.',
    description: 'Ruru listens, speaks and reacts with her eyes and expressions. When you want updates, her face becomes a QR code you can scan to join her mailing list.',
    connection: 'OpenAI chooses her next action. ElevenLabs gives her a voice.',
  },
  camera: {
    label: 'Camera', title: 'She notices who’s in front of her.',
    description: 'Ruru can notice your outfit, recognize a familiar face and pick up where you left off. She remembers your name, preferences and useful details from your conversations.',
    connection: 'Face matching runs locally. OpenAI interprets a shared camera frame; Convex stores her memories.',
  },
  base: {
    label: 'Base', title: 'She can show you the way.',
    description: 'Ask Ruru to take you to a store. She plans a path around the mall’s fixtures, rolls to the entrance and waits when she gets there.',
    connection: 'Three.js brings the mall to life. Movement and pathfinding run in this simulation.',
  },
} as const;
type Part = keyof typeof parts;
const journey = [
  ['Sees and listens', 'She says hello, notices what’s around her and hears what you’re looking for.'],
  ['Gets to know you', 'Your name, your style, your favourite things. Next time, you’re a familiar face.'],
  ['Finds something relevant', 'A store, a product, an event or a membership that fits the conversation.'],
  ['Takes action', 'She can guide you to a store or show a QR code on her face.'],
  ['Keeps the connection', 'Join her mailing list for shop updates after your visit.'],
];
const tools = [
  ['look_at_person', 'Look at a shared camera frame and describe visible clothing or what’s happening.'],
  ['recognize_person', 'Match the current face with a remembered visitor and recall their preferences.'],
  ['remember_person', 'Save or update a person’s name, face, preferences and useful conversation details.'],
  ['find_in_mall', 'Search official sources for relevant stores, products, events, offers and memberships.'],
  ['go_to_store', 'Plan a route and roll to a store entrance in the simulated mall.'],
  ['show_mailing_qr', 'Turn Ruru’s screen into a QR code that opens mailing-list signup on your phone.'],
  ['show_face', 'Bring back Ruru’s animated face.'],
  ['forget_person', 'Remove the person’s saved face and memories when they ask.'],
];
const integrations = [
  ['OpenAI', 'Conversation & tool choices'], ['Convex', 'Visitor memory & mailing list'],
  ['Firecrawl', 'Official store sources'], ['ElevenLabs', 'Ruru’s voice'],
  ['AgentMail', 'Requested email delivery'], ['Three.js', 'Mall & movement simulation'],
];

function RobotDiagram({ selected }: { selected: Part }) {
  return <svg className={`lulu-diagram is-${selected}`} viewBox="0 0 380 330" aria-hidden="true">
    <ellipse cx="190" cy="300" rx="118" ry="15" fill="#dddccd"/>
    <g className="diagram-base">
      <rect x="89" y="230" width="53" height="68" rx="24" fill="#424d41"/>
      <rect x="238" y="230" width="53" height="68" rx="24" fill="#424d41"/>
      {[111,264].map(x => <g key={x} fill="none" stroke="#89957b" strokeWidth="5"><circle cx={x} cy="250" r="9"/><circle cx={x} cy="278" r="9"/></g>)}
      <rect x="125" y="205" width="130" height="82" rx="20" fill="#d7bf89" stroke="#a6936c" strokeWidth="2"/>
      <rect x="136" y="217" width="108" height="53" rx="13" fill="#ecdbb4"/>
      <text x="190" y="250" textAnchor="middle" fill="#74694b" fontSize="22" fontFamily="Arial,sans-serif" fontWeight="600">ruru</text>
      <circle cx="152" cy="258" r="3" fill="#889574"/><circle cx="228" cy="258" r="3" fill="#889574"/>
    </g>
    <rect x="179" y="178" width="22" height="35" rx="7" fill="#7d8871"/>
    <g className="diagram-screen">
      <rect x="79" y="52" width="222" height="139" rx="29" fill="#ddc48d" stroke="#b69d6c" strokeWidth="2"/>
      <rect x="91" y="64" width="198" height="115" rx="20" fill="#263e33"/>
      <g className="diagram-eyes" fill="#ecf2c2"><rect x="129" y="99" width="25" height="36" rx="12.5"/><rect x="226" y="99" width="25" height="36" rx="12.5"/></g>
      <path d="M171 141 Q190 155 209 141" fill="none" stroke="#ecf2c2" strokeWidth="5" strokeLinecap="round"/>
      <circle cx="115" cy="140" r="8" fill="#cfaa8b" opacity=".38"/><circle cx="265" cy="140" r="8" fill="#cfaa8b" opacity=".38"/>
    </g>
    <g className="diagram-camera"><circle cx="190" cy="57" r="8" fill="#4e5b45"/><circle cx="190" cy="57" r="3" fill="#bccea6"/></g>
    <path className="diagram-line diagram-screen-line" d="M88 112 H37 V144"/>
    <path className="diagram-line diagram-camera-line" d="M200 56 H335 V89"/>
    <path className="diagram-line diagram-base-line" d="M282 256 H338 V223"/>
    <circle className="diagram-dot diagram-screen-dot" cx="37" cy="147" r="4"/>
    <circle className="diagram-dot diagram-camera-dot" cx="335" cy="92" r="4"/>
    <circle className="diagram-dot diagram-base-dot" cx="338" cy="220" r="4"/>
  </svg>;
}

export default function HowRuruWorks() {
  const [selected, setSelected] = useState<Part>('screen');
  const part = parts[selected];
  return <section className="how-lulu-works" id="how-lulu-works" aria-labelledby="how-lulu-title">
    <div className="how-lulu-heading"><span className="location-kicker">A LITTLE ROBOT. A FAMILIAR FACE.</span><h2 id="how-lulu-title">How Ruru works</h2><p>She gets to know the people in her mall—and helps them discover more of it.</p></div>
    <div className="lulu-anatomy">
      <div className="lulu-diagram-wrap">
        <RobotDiagram selected={selected}/>
        <div className="lulu-part-buttons" role="group" aria-label="Explore Ruru’s robot">
          {(Object.keys(parts) as Part[]).map(key => <button key={key} type="button" className={`lulu-part-button part-${key}`} aria-pressed={selected === key} aria-controls="lulu-part-explanation" onClick={() => setSelected(key)}>{parts[key].label}<span aria-hidden="true">↗</span></button>)}
        </div>
      </div>
      <div className="lulu-part-explanation" id="lulu-part-explanation" aria-live="polite" aria-atomic="true"><span className="lulu-part-label">{part.label}{selected === 'base' ? ' · Simulation' : ''}</span><h3>{part.title}</h3><p>{part.description}</p><p className="lulu-part-connection">{part.connection}</p></div>
    </div>
    <ol className="lulu-journey" aria-label="The shopper experience">{journey.map(([title,description],index) => <li key={title}><span className="lulu-step-number" aria-hidden="true">0{index+1}</span><h3>{title}</h3><p>{description}</p></li>)}</ol>
    <details className="lulu-under-hood"><summary><span>The tools behind the conversation</span><span className="lulu-expand-label">Explore <span aria-hidden="true">+</span></span></summary><div className="lulu-under-hood-content"><p className="lulu-tools-intro">Ruru chooses which tool to use as the conversation unfolds. Explore a tool to see what it does.</p><div className="lulu-tool-list">{tools.map(([name,description])=><details className="lulu-tool" key={name}><summary><code>{name}</code><span aria-hidden="true">+</span></summary><p>{description}</p></details>)}</div><div className="lulu-integrations" aria-label="Ruru’s integrations">{integrations.map(([name,description])=><div key={name}><strong>{name}</strong><span>{description}</span></div>)}</div><p className="lulu-email-note">Scanning the QR opens signup. It doesn’t send an email; AgentMail handles email delivery separately.</p></div></details>
  </section>;
}
