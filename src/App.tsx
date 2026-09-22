import presentationHtml from './presentation.html?raw';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowUpRight, Mic, RotateCcw, Volume2, VolumeX, Pause, Play, Maximize2, Map, Navigation, Focus, SlidersHorizontal } from 'lucide-react';
import Ruru from './Ruru';
import { signupUrl } from './signupQr';
import { expressions, type Expression } from './face';
import { visitors, type VisitorId } from './mall/visitors';
import type { MallEvent } from './mall/world';
const MallScene = lazy(() => import('./mall/MallScene'));
import type { Interest } from './discovery';
import { recognitionConstructor, type Recognition } from './voice';

import HowRuruWorks from './HowRuruWorks';
import AgentCamera, { type AgentCameraHandle } from './AgentCamera';
import Shortlist from './Shortlist';
import { hello, spokenLines } from './spokenLines';
export default function App() {
  const [showSignupQr, setShowSignupQr] = useState(false);
  const qrUrl = showSignupQr ? signupUrl(location.origin) : undefined;
  function showMailingQr() { setDestination(undefined); setShowSignupQr(true); setPaused(true); setView('mall'); setCameraMode('conversation'); }
  const [view, setView] = useState<'mall' | 'face'>('mall');
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [selected, setSelected] = useState<VisitorId | null>(null);
  const [encounter, setEncounter] = useState<MallEvent>({ phase: 'roaming', visitor: null });
  const [cameraReset, setCameraReset] = useState(0);
  const [cameraMode, setCameraMode] = useState<'story' | 'explore' | 'firstPerson' | 'conversation'>('conversation');
  const [speaker, setSpeaker] = useState('Ruru');
  const stage = useRef<HTMLDivElement>(null);
  const launchVideo = useRef<HTMLVideoElement>(null);
  const [encounterExpression, setEncounterExpression] = useState<Expression>('happy');
  const [previewExpression, setPreviewExpression] = useState<Expression | null>(null);
  const [message, setMessage] = useState(hello);
  const [input, setInput] = useState("i'd like to sign up to the mall's mailing list!");
  const [interest, setInterest] = useState<Interest | null>(null);
  const interestRef = useRef(interest); interestRef.current = interest;
  useEffect(() => { const attend = () => setPaused(true); window.addEventListener('lulu-camera-started', attend); return () => window.removeEventListener('lulu-camera-started', attend); }, []);
  const [mood, setMood] = useState<'idle' | 'listening' | 'thinking' | 'speaking' | 'finished'>('idle');
  const [sound, setSound] = useState(true);
  const soundRef = useRef(sound); soundRef.current = sound;
  const [notice, setNotice] = useState('');
  const [replyToken, setReplyToken] = useState<string | undefined>();
  const [cameraOpen, setCameraOpen] = useState(false);
  const agentCamera = useRef<AgentCameraHandle>(null);
  const [destination, setDestination] = useState<{ store: 'lululemon' | 'apple' | 'aesop'; requestId: number }>();
  const destinationSequence = useRef(0);
  const [destinationReached, setDestinationReached] = useState(false);
  useEffect(() => {
    const arrived = (event: Event) => { if ((event as CustomEvent).detail?.requestId === destinationSequence.current) setDestinationReached(true); };
    window.addEventListener('lulu-arrived', arrived);
    return () => window.removeEventListener('lulu-arrived', arrived);
  }, []);
  const [agentDiscoveries, setAgentDiscoveries] = useState<{items:unknown[];receipt?:string}|null>(null);
  const [conversationMode, setConversationMode] = useState<'live' | 'scripted' | 'checking'>('checking');
  const conversationRequest = useRef<AbortController | null>(null);
  const conversationTurns = useRef<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const conversationGeneration = useRef(0);
  const recognitionMode = useRef(false);
  const recognitionToken = useRef<string | undefined>(undefined);
  const clothingToken = useRef<string | undefined>(undefined);
  useEffect(() => {
    const visitorChanged = () => { setShowSignupQr(false); stopVoice(); conversationTurns.current = []; setHistory([]); setInput(''); setMessage(hello); setAgentDiscoveries(null); interestRef.current = null; setInterest(null); clothingToken.current = undefined; recognitionToken.current = undefined; setReplyToken(undefined); };
    const cameraStart = () => { recognitionMode.current = true; visitorChanged(); }; 
    const cameraStop = () => { recognitionMode.current = false; visitorChanged(); };
    const recognized = (event: Event) => { const value = (event as CustomEvent).detail; const returning = !recognitionToken.current; recognitionToken.current = typeof value?.recognitionToken === 'string' ? value.recognitionToken : undefined; if (returning && recognitionToken.current && typeof value.greeting === 'string' && typeof value.voiceToken === 'string') { stopVoice(); setPaused(true); setSpeaker('Ruru'); setMessage(value.greeting); setReplyToken(value.voiceToken); void say(value.greeting,value.voiceToken); } };
    const clothing = (event: Event) => { const value = (event as CustomEvent).detail; clothingToken.current = typeof value?.clothingToken === 'string' ? value.clothingToken : undefined; };
    const clearFace = () => { if (recognitionToken.current) { stopVoice(); conversationTurns.current = []; setHistory([]); setMessage(hello); setAgentDiscoveries(null); setReplyToken(undefined); interestRef.current = null; setInterest(null); clearClothing(); } recognitionToken.current = undefined; };
    const clearClothing = () => { clothingToken.current = undefined; };
    const clear = () => { clearFace(); clearClothing(); setAgentDiscoveries(null); setReplyToken(undefined); };
    window.addEventListener('lulu-visitor-changed', visitorChanged);
    window.addEventListener('lulu-camera-started', cameraStart); window.addEventListener('lulu-camera-stopped', cameraStop);
    window.addEventListener('lulu-recognized', recognized); window.addEventListener('lulu-recognition-cleared', clearFace);
    window.addEventListener('lulu-clothing-reviewed', clothing); window.addEventListener('lulu-clothing-cleared', clearClothing);
    window.addEventListener('lulu-forgetting', clear); window.addEventListener('lulu-new-conversation', clear);
    return () => { window.removeEventListener('lulu-visitor-changed', visitorChanged); window.removeEventListener('lulu-camera-started', cameraStart); window.removeEventListener('lulu-camera-stopped', cameraStop); window.removeEventListener('lulu-recognized', recognized); window.removeEventListener('lulu-recognition-cleared', clearFace); window.removeEventListener('lulu-clothing-reviewed', clothing); window.removeEventListener('lulu-clothing-cleared', clearClothing); window.removeEventListener('lulu-forgetting', clear); window.removeEventListener('lulu-new-conversation', clear); };
  }, []);
  useEffect(() => {
    const target = location.hash === '#launch-film' ? 'launch-film' : location.hash === '#demo' ? 'demo' : null;
    if (!target) return;
    const frame = requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, []);
  const talkPanel = useRef<HTMLElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/lulu/conversation/status', { signal: controller.signal }).then(response => response.json()).then(result => { if (!controller.signal.aborted) setConversationMode(result.mode === 'live' ? 'live' : 'scripted'); }).catch(() => { if (!controller.signal.aborted) setConversationMode('scripted'); });
    return () => controller.abort();
  }, []);
  const [history, setHistory] = useState<{ who: string; text: string }[]>([]);
  const recognition = useRef<Recognition | null>(null);
  const voiceGeneration = useRef(0);
  const audio = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);
  const speechRequest = useRef<AbortController | null>(null);
  const [voiceChoice, setVoiceChoice] = useState<'animated' | 'classic'>('animated');
  const activeVisitor = visitors.find(visitor => visitor.id === encounter.visitor);
  const expression: Expression = previewExpression ?? (mood !== 'idle' ? (mood === 'finished' ? 'curious' : mood) : paused ? 'curious' : encounter.phase === 'greeting' ? encounterExpression : encounter.phase === 'approaching' ? 'listening' : 'curious');

  useEffect(() => {
    if (!previewExpression) return;
    const timer = window.setTimeout(() => setPreviewExpression(null), 5000);
    return () => window.clearTimeout(timer);
  }, [previewExpression]);
  const encounterProgress = useRef<{ encounter: MallEvent | null; elapsed: number; step: number }>({ encounter: null, elapsed: 0, step: -1 });
  useEffect(() => {
    if (encounter.phase !== 'greeting' || !activeVisitor || paused || cameraMode === 'conversation') return;
    const progress = encounterProgress.current;
    if (progress.encounter !== encounter) { progress.encounter = encounter; progress.elapsed = 0; progress.step = -1; }
    let last = performance.now();
    const tick = () => {
      const now = performance.now(); progress.elapsed += Math.min(now - last, 300); last = now;
      const step = progress.elapsed < 3500 ? 0 : progress.elapsed < 6000 ? 1 : progress.elapsed < 6800 ? 2 : progress.elapsed < 11800 ? 3 : 4;
      if (step === progress.step) return; progress.step = step;
      setMood('idle');
      if (step === 0) { setMessage(activeVisitor.greeting); setSpeaker('Ruru'); setEncounterExpression('speaking'); }
      if (step === 1) { setMessage(activeVisitor.reply); setSpeaker(activeVisitor.name); setEncounterExpression('listening'); }
      if (step === 2) { setEncounterExpression('thinking'); }
      if (step === 3) {
        const result = { text: activeVisitor.followup }; setSpeaker('Ruru'); setEncounterExpression('speaking'); setMessage(result.text);
        setHistory([{ who: 'Ruru', text: activeVisitor.greeting }, { who: `${activeVisitor.name} (simulated)`, text: activeVisitor.reply }, { who: 'Ruru', text: result.text }]);
      }
      if (step === 4) setEncounterExpression('happy');
    };
    tick(); const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [encounter, activeVisitor, paused, cameraMode]);
  function selectVisitor(id: VisitorId) {
    agentCamera.current?.stop(); setCameraOpen(false); setDestination(undefined);
    setShowSignupQr(false);
    stopVoice(); setPreviewExpression(null); setSelected(id); setPaused(false); setHistory([]); setView('mall'); setCameraMode(mode => mode === 'firstPerson' ? mode : 'story'); setSpeaker('Ruru');
    if (selected === id && encounter.phase === 'greeting') setEncounter({ phase: 'greeting', visitor: id });
    else setMessage(`Let’s say hello to ${visitors.find(visitor => visitor.id === id)!.name}. I’m on my way!`);
  }


  useEffect(() => () => { voiceGeneration.current++; conversationGeneration.current++; conversationRequest.current?.abort(); recognition.current?.abort(); stopAudio(); }, []);
  useEffect(() => { const forget = () => { stopVoice(); conversationTurns.current = []; }; window.addEventListener('lulu-forgetting', forget); window.addEventListener('lulu-interest-cleared', forget); return () => { window.removeEventListener('lulu-forgetting', forget); window.removeEventListener('lulu-interest-cleared', forget); }; }, []);

  function stopAudio() {
    speechRequest.current?.abort(); speechRequest.current = null;
    if (audio.current) { audio.current.onended = null; audio.current.onerror = null; audio.current.pause(); audio.current.removeAttribute('src'); audio.current.load(); audio.current = null; }
    if (audioUrl.current) { URL.revokeObjectURL(audioUrl.current); audioUrl.current = null; }
  }
  function stopVoice() {
    voiceGeneration.current++;
    conversationGeneration.current++; conversationRequest.current?.abort(); conversationRequest.current = null;
    recognition.current?.abort(); recognition.current = null;
    stopAudio(); setMood('idle'); setNotice('');
  }
  async function say(text: string, token?: string) {
    launchVideo.current?.pause();
    const generation = ++voiceGeneration.current;
    stopAudio();
    if (!soundRef.current) { setMood('finished'); return; }
    const controller = new AbortController(); speechRequest.current = controller;
    setMood('thinking'); setNotice('One moment…');
    try {
      const response = await fetch('/api/lulu/voice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, voice: voiceChoice, ...(token ? { token } : {}) }), signal: controller.signal });
      if (generation !== voiceGeneration.current) return;
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Ruru’s voice is unavailable. You can still read her reply.');
      }
      if (!response.headers.get('content-type')?.startsWith('audio/')) throw new Error('Ruru’s voice is unavailable. You can still read her reply.');
      const blob = await response.blob();
      if (generation !== voiceGeneration.current) return;
      const url = URL.createObjectURL(blob); audioUrl.current = url;
      const player = new Audio(url); audio.current = player;
      player.onended = () => { if (generation === voiceGeneration.current) { setMood('finished'); stopAudio(); } };
      player.onerror = () => { if (generation === voiceGeneration.current) { setMood('idle'); setNotice('Audio couldn’t play. Try hearing the line again.'); stopAudio(); } };
      await player.play();
      if (generation === voiceGeneration.current && audio.current === player) { setMood('speaking'); setNotice(''); }
    } catch (error) {
      if (generation !== voiceGeneration.current || controller.signal.aborted) return;
      stopAudio(); setMood('idle'); setNotice(error instanceof Error ? error.message : 'Ruru’s voice is unavailable. Please try again.');
    }
  }
  async function respond(text: string) {
    launchVideo.current?.pause();
    const clean = text.trim().slice(0, 500); if (!clean) return;
    stopVoice();
    setPaused(true); setPreviewExpression(null); setSpeaker('Ruru');
    setInput(''); setMood('thinking'); setNotice('');
    const generation = conversationGeneration.current;
    const controller = new AbortController(); conversationRequest.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 60000);
    try {
      const senses = await agentCamera.current?.capture();
      if (controller.signal.aborted || generation !== conversationGeneration.current) return;
      const response = await fetch('/api/lulu/conversation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: clean, history: conversationTurns.current.slice(-8), interest: interestRef.current, recognitionMode: recognitionMode.current, recognitionToken: recognitionToken.current, clothingToken: clothingToken.current, ...(senses ? { senses } : {}) }), signal: controller.signal });
      const result = await response.json();
      if (generation !== conversationGeneration.current) return;
      if (!response.ok || typeof result.text !== 'string' || !['live', 'scripted'].includes(result.mode) || (result.interest !== null && !['yoga', 'running', 'exploring'].includes(result.interest))) throw new Error(result.error || 'Ruru couldn’t finish that reply. Please try again.');
      setConversationMode(result.mode); setMessage(result.text);
      setReplyToken(typeof result.voiceToken === 'string' ? result.voiceToken : undefined);
      const actions = Array.isArray(result.actions) ? result.actions : [];
      for (const action of actions) {
        if (action.type === 'show_mailing_qr') showMailingQr();
        else if (action.type === 'show_face') setShowSignupQr(false);
        else if (action.type === 'start_camera') setCameraOpen(true);
        else if (action.type === 'go_to_store' && ['lululemon', 'apple', 'aesop'].includes(action.store)) {
          setShowSignupQr(false); setSelected(null); setView('mall'); setCameraMode('story'); setPaused(false);
          setDestinationReached(false); setDestination({ store: action.store, requestId: ++destinationSequence.current });
        } else if (action.type === 'person_remembered') window.dispatchEvent(new Event('lulu-profile-changed'));
        else if (action.type === 'person_forgotten') {
          recognitionToken.current = undefined; clothingToken.current = undefined;
          conversationTurns.current = []; setHistory([]); interestRef.current = null; setInterest(null);
          window.dispatchEvent(new Event('lulu-profile-changed'));
        }
      }
      setAgentDiscoveries(Array.isArray(result.discoveries) && result.discoveries.length ? { items: result.discoveries, receipt: result.receipt } : null);
      if (result.interest) { setInterest(result.interest);  }
      conversationTurns.current = [...conversationTurns.current, { role: 'user' as const, content: clean }, { role: 'assistant' as const, content: result.text }].slice(-8);
      setHistory(prev => [...prev, { who: 'You', text: clean }, { who: 'Ruru', text: result.text }].slice(-12));
      if (spokenLines.has(result.text) || typeof result.voiceToken === 'string') void say(result.text, result.voiceToken);
      else setMood('finished');
    } catch (error) {
      if (generation !== conversationGeneration.current) return;
      setMood('idle'); setInput(clean);
      setNotice(controller.signal.aborted ? 'Ruru took too long. Your message is ready to retry.' : error instanceof Error ? error.message : 'Ruru couldn’t reply. Please try again.');
    } finally { window.clearTimeout(timeout); if (generation === conversationGeneration.current) conversationRequest.current = null; }
  }
  function listen() {
    launchVideo.current?.pause();
    setPaused(true); setPreviewExpression(null);
    if (mood === 'listening') { stopVoice(); return; }
    stopVoice();
    const Constructor = recognitionConstructor();
    if (!Constructor) { setNotice('Voice input isn’t available in this browser. Please type below, or try Chrome.'); return; }
    const instance = new Constructor(); const generation = voiceGeneration.current;
    recognition.current = instance; instance.lang = 'en-SG'; instance.interimResults = false; instance.continuous = false;
    instance.onresult = event => { if (generation === voiceGeneration.current) respond(event.results[0]?.[0]?.transcript ?? ''); };
    instance.onerror = event => {
      if (generation !== voiceGeneration.current) return;
      setMood('idle'); setNotice(event.error === 'not-allowed' ? 'Microphone access was declined. You can type below.' : 'I didn’t catch that. Try the microphone again, or type below.');
    };
    instance.onend = () => { if (generation === voiceGeneration.current) setMood(current => current === 'listening' ? 'idle' : current); };
    try { setMood('listening'); setNotice('Listening now. Your browser’s speech service processes your voice.'); instance.start(); }
    catch { setMood('idle'); setNotice('The microphone couldn’t start. You can type below.'); }
  }
  function reset(forget = false) {
    agentCamera.current?.stop(); setCameraOpen(false); setDestination(undefined);
    setShowSignupQr(false);
    if (forget) { try { localStorage.removeItem('roaminglulu-interest'); } catch { /* Storage may be disabled; Convex deletion is already confirmed. */ } }
    window.dispatchEvent(new Event('lulu-new-conversation'));
    conversationTurns.current = []; setReplyToken(undefined); setAgentDiscoveries(null);
    setSelected(null); setPaused(true); setPreviewExpression(null); setSpeaker('Ruru');
    stopVoice(); setInput(''); setHistory([]); setMessage(forget ? 'All forgotten. A fresh little hello!' : hello); setNotice('');
    interestRef.current = null; setInterest(null);
  }


  return <div className="app-shell">
    <header>
      <a href="/" className="wordmark"><span className="brand-flower" aria-hidden="true">✳</span> roamingruru<span className="wordmark-dot">.</span></a>
      <nav className="site-nav" aria-label="Main navigation"><a href="#demo">Talk with Ruru</a><a href="#how-lulu-works">How it works</a><a href="#launch-film">Film</a><a href="#presentation">Presentation</a></nav>
      <button className="icon-button" aria-label={sound ? 'Mute Ruru' : 'Unmute Ruru'} onClick={() => { stopVoice(); setSound(!sound); }}>{sound ? <Volume2 size={18}/> : <VolumeX size={18}/>}</button>
    </header>
    <main className="encounter-main">
      <section ref={talkPanel} className="encounter-section" id="demo" aria-label="Talk with Ruru">
        <div className="demo-introduction"><div><span className="location-kicker">COME AND MEET HER</span><h2>Talk with Ruru</h2></div><p>She’ll say hello first. You can talk or type back.</p></div>
      <section className="simulation" aria-label="Ruru’s mall simulation">
        <div ref={stage} className={`world-stage encounter-stage ${cameraMode === 'conversation' ? 'conversation-view' : ''} ${view === 'face' ? 'face-mode' : ''} ${qrUrl ? 'signup-qr-active' : ''}`}>
          {qrUrl && <div className="qr-invitation" role="status"><span>Scan to join Ruru’s mailing list</span><a href="/?signup=1" target="_blank" rel="noopener noreferrer">Open signup form</a><button type="button" onClick={() => setShowSignupQr(false)}>Back to Ruru’s face</button></div>}
          <div className="stage-topline"><div className="view-switch" aria-label="View"><button aria-pressed={view === 'mall' && cameraMode === 'conversation'} onClick={() => { setView('mall'); setCameraMode('conversation'); setPaused(true); }}>With Ruru</button><button aria-label="Mall" aria-pressed={view === 'mall' && (cameraMode === 'story' || cameraMode === 'explore')} onClick={() => { setView('mall'); setCameraMode('story'); }}><Map size={14}/> The mall</button><button aria-pressed={view === 'mall' && cameraMode === 'firstPerson'} onClick={() => { setView('mall'); setCameraMode('firstPerson'); }}><Focus size={14}/> Ruru’s view</button><button aria-pressed={view === 'face'} onClick={() => setView('face')}><Maximize2 size={14}/> Face only</button></div></div>
          <div className="world-mount" style={{ visibility: view === 'mall' ? 'visible' : 'hidden' }}><Suspense fallback={<div className="world-loading">A little world is waking up…</div>}><MallScene input={{ destination, qrUrl, expression, paused: paused || view === 'face' || cameraMode === 'conversation', selected, cameraReset, visible: view === 'mall', cameraMode }} onEvent={setEncounter} onSelect={selectVisitor} onExplore={() => setCameraMode('explore')}/></Suspense></div>
          {view === 'face' && <div className="face-stage"><Ruru qrUrl={qrUrl} expression={expression} large/></div>}
          {view === 'mall' && cameraMode !== 'conversation' && <div className="world-status"><span className={`status-dot ${paused ? 'paused' : ''}`}/>{paused ? 'A moment to ourselves' : encounter.phase === 'greeting' ? `A new friend: ${activeVisitor?.name}` : encounter.phase === 'approaching' ? `${activeVisitor?.name} caught Ruru’s eye` : destination ? `${destinationReached ? 'Here we are: ' : 'On our way to '}${destination.store === 'aesop' ? 'Aēsop' : destination.store === 'apple' ? 'Apple' : 'lululemon'}` : 'Following her curiosity'}</div>}
          {cameraMode !== 'conversation' && <div className="world-toolbar"><details className="camera-options"><summary>Camera</summary><div>{view === 'mall' && <button className="camera-button" aria-pressed={cameraMode === 'story'} onClick={() => setCameraMode(mode => mode === 'story' ? 'explore' : 'story')}><Focus size={14}/>Follow Ruru</button>}<button aria-label="Reset mall camera" onClick={() => { setCameraReset(value => value + 1); setCameraMode('explore'); }}><RotateCcw size={14}/> Reset</button></div></details><button aria-label={paused ? 'Resume roaming' : 'Pause roaming'} onClick={() => { stopVoice(); setPaused(value => !value); }}>{paused ? <Play size={16}/> : <Pause size={16}/>}</button></div>}

          <div className="dialogue-hud">
          <div className={`story-caption ${speaker !== 'Ruru' ? 'visitor-speaking' : ''}`} aria-live="polite"><span className="caption-speaker"><span className="caption-symbol">{speaker === 'Ruru' ? '✳' : '“'}</span>{speaker === 'Ruru' ? 'RURU' : `${speaker.toUpperCase()} · VISITOR`}<span className="caption-line"/></span><h2>{message}</h2>{(spokenLines.has(message) || replyToken) && speaker === 'Ruru' && <button className="read-aloud" aria-label="Read this line aloud" onClick={() => { setPaused(true); recognition.current?.abort(); recognition.current = null; void say(message, replyToken); }}><Volume2 size={13}/> Hear this line</button>}</div>
            <div className="dialogue-controls">
        <button className={`talk-button ${mood === 'listening' ? 'is-listening' : ''}`} aria-label={mood === 'listening' ? 'Stop listening' : 'Talk with Ruru'} onClick={listen}><Mic size={19}/><span>{mood === 'listening' ? 'Listening… tap to stop' : 'Talk'}</span></button>
        <form className="type-form" onSubmit={event => { event.preventDefault(); respond(input); }}><label className="sr-only" htmlFor="message">Type a message to Ruru</label><input id="message" value={input} maxLength={500} onChange={event => setInput(event.target.value)} placeholder="Type a message…" autoComplete="off"/><button aria-label="Send message" disabled={!input.trim()}><ArrowUp size={18}/></button></form>
        <div className="interaction-status" role="status"><span>{mood === 'thinking' ? 'One moment…' : mood === 'speaking' ? 'Ruru is speaking' : mood === 'listening' ? 'Ruru is listening' : mood === 'finished' ? 'Your turn' : 'Ready when you are'}</span>{['thinking', 'speaking', 'listening'].includes(mood) && <button className="text-button" onClick={stopVoice}>Stop</button>}</div>
        <details className="composer-options"><summary>Voice & options</summary><div className="composer-options-content"><label className="voice-choice">Voice <select aria-label="Ruru voice" value={voiceChoice} onChange={event => { stopVoice(); setVoiceChoice(event.target.value as 'animated' | 'classic'); }}><option value="animated">Ruru 1 · Film voice</option><option value="classic">Jessica · Previous voice</option></select></label>
        <p className="voice-note">Mic off until you tap. Input uses browser speech recognition. {conversationMode === 'live' ? 'AI conversation · messages go to OpenAI.' : conversationMode === 'scripted' ? 'Scripted demo conversation · AI connection pending.' : 'Checking conversation…'}</p>

              <button className="text-button fresh-conversation" onClick={() => reset()} aria-label="New visitor"><RotateCcw size={12}/> Start fresh</button></div></details>
        {notice && <p className="notice" role="status">{notice}</p>}
            </div>
          </div>
        </div>
        <details className="visitor-picker"><summary>Choose who Ruru meets</summary><div className="visitor-strip"><div className="visitor-list">{visitors.map(visitor => <button key={visitor.id} className={`visitor-card ${encounter.visitor === visitor.id ? 'active' : ''}`} aria-label={`Meet ${visitor.name}`} aria-pressed={selected === visitor.id} onClick={() => selectVisitor(visitor.id)}><span className="visitor-avatar" style={{ background: visitor.color }}><span style={{ background: visitor.skin }}/></span><span><strong>{visitor.name}</strong><small>{visitor.interest}</small></span><ArrowUpRight size={14}/></button>)}</div><button className="wander-button" aria-label="Let Ruru roam freely" onClick={() => { setDestination(undefined); setShowSignupQr(false); stopVoice(); setSelected(null); setPaused(false); setPreviewExpression(null); setCameraMode(mode => mode === 'firstPerson' ? mode : 'story'); }}><Navigation size={16}/><span>Let her wander</span></button></div></details>
      </section>
      <div className="conversation encounter-extras">
        <Shortlist interest={interest} agentResult={agentDiscoveries} onReviewStyle={() => setCameraOpen(true)}/>
        <AgentCamera ref={agentCamera} open={cameraOpen} onVisitorChanged={duringCapture => {
          recognitionToken.current = undefined; clothingToken.current = undefined; conversationTurns.current = []; setHistory([]); setAgentDiscoveries(null); interestRef.current = null; setInterest(null); setShowSignupQr(false);
          if (!duringCapture) { stopVoice(); setMessage(hello); }
        }} onClose={() => setCameraOpen(false)} onStarted={() => {
          recognitionMode.current = true; recognitionToken.current = undefined; clothingToken.current = undefined;
          setPaused(true);
          void respond('The camera is on now. Continue.');
        }} onStopped={() => {
          recognitionMode.current = false; recognitionToken.current = undefined; clothingToken.current = undefined;
          conversationTurns.current = []; setHistory([]); stopVoice();
        }}/>
        <details className="expression-details"><summary><SlidersHorizontal size={13}/> A closer look at her expressions</summary><div className="expression-controls" aria-label="Preview Ruru’s expressions">{expressions.map(item => <button key={item.id} aria-label={`Preview ${item.label} expression`} aria-pressed={expression === item.id} onClick={() => setPreviewExpression(item.id)}>{item.label}</button>)}</div></details>
        {history.length > 0 && <details><summary>This conversation</summary><div className="transcript">{history.map((entry, i) => <p key={i}><strong>{entry.who}</strong> {entry.text}</p>)}</div></details>}
      </div>
      </section>
      <HowRuruWorks/>
      <section className="launch-film" id="launch-film" aria-labelledby="launch-film-title">
        <div className="launch-film-heading"><div><span className="location-kicker">MEET ROAMINGRURU</span><h2 id="launch-film-title">Imagine meeting Ruru at your mall.</h2></div><p>Watch the launch film · 2:50</p></div>
        <video ref={launchVideo} controls playsInline preload="none" poster="/media/roaminglulu-launch.jpg" aria-label="RoamingRuru launch film" onPlay={() => { stopVoice(); setPaused(true); }}>
          <source src="/media/roaminglulu-launch.mp4" type="video/mp4"/>
          <track kind="captions" src="/media/roaminglulu-launch.vtt" srcLang="en" label="English dialogue"/>
          Your browser cannot play this video. <a href="/media/roaminglulu-launch.mp4">Download the launch film</a>.
        </video>
        <p className="film-study">Indoor mall visits rose 5% year over year in August 2026.<br/><span>Source: </span><a href="https://www.placer.ai/anchor/articles/placer-ai-august-2026-mall-index-open-air-leads-as-indoor-malls-see-their-best-yoy-growth-of-2026" target="_blank" rel="noopener noreferrer">Placer.ai, August 2026 Mall Index ↗</a></p>
      </section>
      <section className="presentation-section" id="presentation" aria-labelledby="presentation-title">
        <div className="launch-film-heading"><h2 id="presentation-title">Presentation</h2></div>
        <iframe title="RoamingRuru presentation" srcDoc={presentationHtml} allowFullScreen loading="lazy"/>
      </section>
    </main>
    <footer><p>Valley Fair inspired demo · Simplified layout & simulated visitors. Independent; no mall or brand affiliation.<br/>No live offers or bookings. Shortlist email requires your request.</p></footer>
  </div>;
}
