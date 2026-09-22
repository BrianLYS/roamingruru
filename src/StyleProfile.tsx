import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import LiveCamera from './LiveCamera';
import { fetchMemory } from './memorySession';
import './style-profile.css';

type Interest = 'yoga' | 'running' | 'exploring';
type Garment = 'top' | 'leggings' | 'shorts' | 'jacket' | 'trousers' | 'dress' | 'unknown';
type Colour = 'black' | 'white' | 'grey' | 'blue' | 'green' | 'red' | 'pink' | 'neutral' | 'other';
type OutfitStyle = 'active' | 'casual' | 'smart' | 'unknown';

type Profile = {
  name: string;
  interest: Interest;
  garment: Garment;
  color: Colour;
  style: OutfitStyle;
};

type ProfileDraft = Omit<Profile, 'interest'> & { interest: Interest | '' };
type Snapshot = {
  profile: Profile | null;
  profileVersion: number;
  newsletterVersion: number;
  newsletter: null | { status: 'pending' | 'active'; emailHint: string };
  capabilities: { vision: boolean; search: boolean; email: boolean };
};
type Suggestion = { title: string; url: string; description: string };

const interests = ['yoga', 'running', 'exploring'] as const;
const garments = ['top', 'leggings', 'shorts', 'jacket', 'trousers', 'dress', 'unknown'] as const;
const colours = ['black', 'white', 'grey', 'blue', 'green', 'red', 'pink', 'neutral', 'other'] as const;
const styles = ['active', 'casual', 'smart', 'unknown'] as const;
const emptyProfile: ProfileDraft = { name: '', interest: '', garment: 'unknown', color: 'neutral', style: 'unknown' };
const storeUrl = 'https://www.westfield.com/en/united-states/valleyfair/retailers/lululemon/75610';
const maxPhotoBytes = 3 * 1024 * 1024;

function isChoice<T extends string>(value: unknown, choices: readonly T[]): value is T {
  return typeof value === 'string' && choices.includes(value as T);
}

function parseProfile(value: unknown): Profile | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.name !== 'string' ||
    !isChoice(item.interest, interests) ||
    !isChoice(item.garment, garments) ||
    !isChoice(item.color, colours) ||
    !isChoice(item.style, styles)
  ) return null;
  return { name: item.name, interest: item.interest, garment: item.garment, color: item.color, style: item.style };
}

function parseSnapshot(value: unknown): Snapshot {
  if (!value || typeof value !== 'object') throw new Error('Style memory returned an unexpected response.');
  const item = value as Record<string, unknown>;
  const capabilities = item.capabilities as Record<string, unknown> | null;
  const newsletterValue = item.newsletter as Record<string, unknown> | null;
  if (item.newsletter !== null && (!newsletterValue || typeof newsletterValue !== 'object' || !['pending','active'].includes(newsletterValue.status as string) || typeof newsletterValue.emailHint !== 'string')) {
    throw new Error('Style memory returned an unexpected newsletter status.');
  }
  const newsletter = newsletterValue
    ? { status: 'pending' as const, emailHint: newsletterValue.emailHint as string }
    : null;
  if (
    !Number.isInteger(item.profileVersion) ||
    !Number.isInteger(item.newsletterVersion) ||
    !capabilities ||
    typeof capabilities.vision !== 'boolean' ||
    typeof capabilities.search !== 'boolean' ||
    typeof capabilities.email !== 'boolean'
  ) throw new Error('Style memory returned an unexpected response.');
  const profile = item.profile === null ? null : parseProfile(item.profile);
  if (item.profile !== null && !profile) throw new Error('Style memory returned an unexpected profile.');
  return {
    profile,
    profileVersion: item.profileVersion as number,
    newsletterVersion: item.newsletterVersion as number,
    newsletter,
    capabilities: capabilities as Snapshot['capabilities'],
  };
}

async function responseError(response: Response, fallback: string) {
  const body: unknown = await response.json().catch(() => null);
  if (body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string') {
    return (body as { error: string }).error;
  }
  return fallback;
}

function label(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function safeSuggestions(value: unknown): { items: Suggestion[]; checkedAt: string } {
  if (!value || typeof value !== 'object') throw new Error('Outfit suggestions returned an unexpected response.');
  const result = value as { items?: unknown; checkedAt?: unknown };
  if (!Array.isArray(result.items) || typeof result.checkedAt !== 'string') {
    throw new Error('Outfit suggestions returned an unexpected response.');
  }
  const items = result.items.flatMap((candidate): Suggestion[] => {
    if (!candidate || typeof candidate !== 'object') return [];
    const item = candidate as Record<string, unknown>;
    if (typeof item.title !== 'string' || typeof item.description !== 'string' || typeof item.url !== 'string') return [];
    try {
      const url = new URL(item.url);
      return url.protocol === 'https:' ? [{ title: item.title, description: item.description, url: url.toString() }] : [];
    } catch {
      return [];
    }
  });
  return { items, checkedAt: result.checkedAt };
}

export function StyleProfile({ contextual = false }: { contextual?: boolean }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [profile, setProfile] = useState<ProfileDraft>(emptyProfile);
  const [profileDirty, setProfileDirty] = useState(false);
  const profileDirtyRef = useRef(false);
  const [profileConsent, setProfileConsent] = useState(false);
  const [photo, setPhoto] = useState<{ dataUrl: string; name: string; source: 'camera' | 'upload' } | null>(null);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [analysisMessage, setAnalysisMessage] = useState('');
  const [suggestionMessage, setSuggestionMessage] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [checkedAt, setCheckedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [forgetting, setForgetting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [analysing, setAnalysing] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileAwaitingRefresh, setProfileAwaitingRefresh] = useState(false);
  const generation = useRef(0);
  const controllers = useRef(new Set<AbortController>());
  const photoReader = useRef<FileReader | null>(null);
  const photoReadId = useRef(0);
  const analysisId = useRef(0);
  const analysisAbort = useRef<AbortController | null>(null);
  const suggestionId = useRef(0);
  const profileEditId = useRef(0);
  const savedProfileEditId = useRef(-1);

  function active(expected: number) {
    return expected === generation.current;
  }

  function stopRequests() {
    generation.current += 1;
    controllers.current.forEach(controller => controller.abort());
    controllers.current.clear();
    photoReadId.current += 1;
    analysisId.current += 1;
    suggestionId.current += 1;
    analysisAbort.current = null;
    photoReader.current?.abort();
    photoReader.current = null;
    return generation.current;
  }

  async function request(path: string, init: RequestInit, expected: number, suppliedController?: AbortController, timeoutMs = 15000) {
    const controller = suppliedController ?? new AbortController();
    controllers.current.add(controller);
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchMemory(path, { ...init, signal: controller.signal });
      if (!active(expected)) throw new DOMException('Superseded', 'AbortError');
      return response;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError' && active(expected)) {
        throw new Error('The request took too long. Please try again.');
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
      controllers.current.delete(controller);
    }
  }

  async function reload(expected: number, replaceProfile: boolean, replaceAtEditId?: number) {
    const response = await request('/api/lulu/memory/profile', { cache: 'no-store' }, expected);
    if (!response.ok) throw new Error(await responseError(response, 'Style memory is unavailable. Please retry.'));
    const next = parseSnapshot(await response.json());
    if (!active(expected)) return;
    setSnapshot(next);
    setLoadError('');

    setProfileAwaitingRefresh(false);
    if ((replaceProfile && (replaceAtEditId === undefined || replaceAtEditId === profileEditId.current)) || !profileDirtyRef.current) {
      const nextProfile: ProfileDraft = next.profile ? { ...next.profile } : { ...emptyProfile };
      profileDirtyRef.current = false;
      setProfileDirty(false);
      setProfile(nextProfile);
      setProfileConsent(false);
    }
  }

  function clearBusy() {
    setAnalysing(false);
    setSuggesting(false);
    setSavingProfile(false);


  }

  function clearProfileLocal() {
    profileEditId.current += 1;
    analysisId.current += 1;
    suggestionId.current += 1;
    profileDirtyRef.current = false;
    setProfile({ ...emptyProfile });
    setProfileDirty(false);
    setProfileConsent(false);
    setPhoto(null);
    setPhotoConsent(false);
    setPhotoError('');
    setProfileMessage('');
    setAnalysisMessage('');
    setSuggestionMessage('');
    setSuggestions([]);
    setCheckedAt('');
    setProfileAwaitingRefresh(false);
  }

  useEffect(() => {
    const expected = generation.current;
    void reload(expected, true)
      .catch(error => { if (active(expected)) setLoadError(error instanceof Error ? error.message : 'Style memory is unavailable. Please retry.'); })
      .finally(() => { if (active(expected)) setLoading(false); });

    const forgotten = () => {
      const next = stopRequests();
      clearBusy();
      clearProfileLocal();
      setSnapshot(null);




      setLoadError('');
      setLoading(true);
      void reload(next, true)
        .catch(error => { if (active(next)) setLoadError(error instanceof Error ? error.message : 'Style memory is unavailable. Please retry.'); })
        .finally(() => { if (active(next)) setLoading(false); });
    };
    const interestCleared = () => {
      const next = stopRequests();
      clearBusy();
      clearProfileLocal();
      setLoadError('');
      setLoading(true);
      void reload(next, true)
        .catch(error => { if (active(next)) setLoadError(error instanceof Error ? error.message : 'Style memory is unavailable. Please retry.'); })
        .finally(() => { if (active(next)) setLoading(false); });
    };
    const newConversation = () => {
      photoReadId.current += 1;
      photoReader.current?.abort();
      photoReader.current = null;
      cancelAnalysis();
      setPhoto(null);
      setPhotoConsent(false);
      setPhotoError('');
      setAnalysisMessage('');
    };
    const forgetStarted = () => { stopRequests(); clearBusy(); setLoading(false); setForgetting(true); };
    const forgetSettled = () => setForgetting(false);
    window.addEventListener('lulu-forgetting', forgetStarted);
    window.addEventListener('lulu-forget-settled', forgetSettled);
    window.addEventListener('lulu-forgotten', forgotten);
    window.addEventListener('lulu-interest-cleared', interestCleared);
    window.addEventListener('lulu-new-conversation', newConversation);
    return () => {
      window.removeEventListener('lulu-forgotten', forgotten);
      window.removeEventListener('lulu-interest-cleared', interestCleared);
      window.removeEventListener('lulu-new-conversation', newConversation);
      window.removeEventListener('lulu-forgetting', forgetStarted);
      window.removeEventListener('lulu-forget-settled', forgetSettled);
      stopRequests();
    };
  }, []);

  function updateProfile<K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) {
    window.dispatchEvent(new Event('lulu-clothing-cleared'));
    cancelAnalysis();
    profileEditId.current += 1;
    suggestionId.current += 1;
    setSuggesting(false);
    profileDirtyRef.current = true;
    setProfileDirty(true);
    setProfile(current => ({ ...current, [key]: value }));
    setProfileConsent(false);
    setProfileMessage('');
    setAnalysisMessage('');
    setSuggestions([]);
    setSuggestionMessage('');
  }

  function cancelAnalysis(showMessage = false) {
    const wasAnalysing = analysisAbort.current !== null;
    analysisId.current += 1;
    analysisAbort.current?.abort();
    analysisAbort.current = null;
    setAnalysing(false);
    if (showMessage && wasAnalysing) setAnalysisMessage('Analysis stopped. Your selected frame stays in this browser.');
  }

  function useCameraFrame(dataUrl: string) {
    cancelAnalysis();
    photoReadId.current += 1;
    photoReader.current?.abort();
    photoReader.current = null;
    setPhoto({ dataUrl, name: 'Selected camera frame', source: 'camera' });
    setPhotoConsent(false);
    setPhotoError('');
    setAnalysisMessage('Camera frame selected. Review it, then choose whether to send this one frame for analysis.');
  }

  function cameraStopped() {
    window.dispatchEvent(new Event('lulu-clothing-cleared'));
    const cameraFrameSelected = photo?.source === 'camera';
    cancelAnalysis(true);
    if (!cameraFrameSelected) return;
    setPhoto(null);
    setPhotoConsent(false);
    setPhotoError('');
    setAnalysisMessage('Camera stopped. The selected frame was cleared.');
  }

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    photoReadId.current += 1;
    photoReader.current?.abort();
    photoReader.current = null;
    setPhotoError('');
    setAnalysisMessage('');
    setPhotoConsent(false);
    cancelAnalysis();
    if (!file) return;
    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      setPhoto(null);
      setPhotoError('Choose a PNG or JPEG photo.');
      return;
    }
    if (file.size > maxPhotoBytes) {
      setPhoto(null);
      setPhotoError('Choose a photo no larger than 3 MB.');
      return;
    }
    const reader = new FileReader();
    const readId = photoReadId.current;
    const expected = generation.current;
    photoReader.current = reader;
    reader.onload = async () => {
      if (!active(expected) || readId !== photoReadId.current || typeof reader.result !== 'string') return;
      try {
        const image = new Image(); image.src = reader.result; await image.decode();
        if (image.naturalWidth * image.naturalHeight > 12000000) throw new Error('Photo too large.');
        if (!active(expected) || readId !== photoReadId.current) return;
        const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d'); if (!context) throw new Error('Photo unavailable.');
        context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
        setPhoto({ dataUrl: canvas.toDataURL('image/jpeg', .8), name: file.name, source: 'upload' });
      } catch {
        if (active(expected) && readId === photoReadId.current) { setPhoto(null); setPhotoError('Choose a valid PNG or JPEG under 12 megapixels.'); }
      } finally { if (readId === photoReadId.current) photoReader.current = null; }
    };
    reader.onerror = () => {
      if (!active(expected) || readId !== photoReadId.current) return;
      setPhoto(null);
      setPhotoError('That photo could not be read. Please choose another.');
      photoReader.current = null;
    };
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    window.dispatchEvent(new Event('lulu-clothing-cleared'));
    photoReadId.current += 1;
    photoReader.current?.abort();
    photoReader.current = null;
    cancelAnalysis();
    setPhoto(null);
    setPhotoConsent(false);
    setPhotoError('');
    setAnalysisMessage('');
  }

  async function analysePhoto() {
    if (!photo || !photoConsent || !snapshot?.capabilities.vision || analysing) return;
    const expected = generation.current;
    const operation = ++analysisId.current;
    const controller = new AbortController();
    analysisAbort.current?.abort();
    analysisAbort.current = controller;
    setAnalysing(true);
    setAnalysisMessage('Describing the clothes in your photo…');
    try {
      const response = await request('/api/lulu/outfit/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent: true, image: photo.dataUrl }),
      }, expected, controller, 25000);
      if (!response.ok) throw new Error(await responseError(response, 'The photo could not be analysed. Please try again.'));
      const result: unknown = await response.json();
      if (!result || typeof result !== 'object') throw new Error('Photo analysis returned an unexpected response.');
      const item = result as Record<string, unknown>;
      if (!isChoice(item.garment, garments) || !isChoice(item.color, colours) || !isChoice(item.style, styles)) {
        throw new Error('Photo analysis returned an unexpected response.');
      }
      if (!active(expected) || operation !== analysisId.current) return;
      profileEditId.current += 1;
      suggestionId.current += 1;
      setSuggesting(false);
      profileDirtyRef.current = true;
      setProfileDirty(true);
      setProfile(current => ({ ...current, garment: item.garment as Garment, color: item.color as Colour, style: item.style as OutfitStyle }));
      setProfileConsent(false);
      setSuggestions([]);
      setCheckedAt('');
      setSuggestionMessage('');
      setAnalysisMessage('Description added below. Ruru can use it in this conversation. Please review before saving.');
      if (typeof item.clothingToken === 'string') window.dispatchEvent(new CustomEvent('lulu-clothing-reviewed', { detail: { clothingToken: item.clothingToken } }));
    } catch (error) {
      if (active(expected) && operation === analysisId.current) setAnalysisMessage(error instanceof Error ? error.message : 'The photo could not be analysed. Please try again.');
    } finally {
      if (active(expected) && operation === analysisId.current) {
        analysisAbort.current = null;
        setAnalysing(false);
      }
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!snapshot || !profile.interest || !profileConsent || savingProfile || profileAwaitingRefresh) return;
    const expected = generation.current;
    const editAtSave = profileEditId.current;
    const reviewed: Profile = { ...profile, name: profile.name.trim(), interest: profile.interest };
    setSavingProfile(true);
    setProfileMessage('Saving your reviewed profile…');
    try {
      let response = await request('/api/lulu/memory/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consent: true, purpose: 'profile' }),
      }, expected);
      if (!response.ok) throw new Error(await responseError(response, 'A private browser session could not be started. Please retry.'));
      response = await request('/api/lulu/memory/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent: true, version: snapshot.profileVersion, profile: reviewed }),
      }, expected);
      if (response.status === 409) {
        setProfileConsent(false);
        try {
          await reload(expected, false);
          if (active(expected)) setProfileMessage('The saved profile changed in another request. Your edits are still here. Review them, renew consent, and save again.');
        } catch {
          if (active(expected)) { setLoadError('The saved profile changed. Retry status before saving.'); setProfileAwaitingRefresh(true); setProfileMessage('The saved profile changed, but its current version could not be refreshed. Your edits are still here; retry status before saving.'); }
        }
        return;
      }
      if (!response.ok) throw new Error(await responseError(response, 'Your style profile could not be saved. Please retry.'));
      if (!active(expected)) return;
      savedProfileEditId.current = editAtSave;
      setProfileAwaitingRefresh(true);
      setProfileMessage('Profile saved. Refreshing its current status…');
      window.dispatchEvent(new Event('lulu-profile-changed'));
      try {
        await reload(expected, true, editAtSave);
        const hasNewerEdits = profileEditId.current !== editAtSave;
        if (active(expected)) setProfileMessage(hasNewerEdits
          ? 'The reviewed profile was saved. Your newer edits are still here and have not been saved yet. The photo was not saved.'
          : 'Your reviewed style profile is remembered until this browser’s 30-day permission expires. The photo was not saved.');
      } catch {
        if (active(expected)) setProfileMessage('Your profile was saved, but its current status could not be refreshed. Retry status before saving again.');
      }
    } catch (error) {
      if (active(expected)) setProfileMessage(error instanceof Error ? error.message : 'Your style profile could not be saved. Please retry.');
    } finally {
      if (active(expected)) setSavingProfile(false);
    }
  }

  async function findSuggestions() {
    if (!snapshot?.capabilities.search || !profile.interest || suggesting) return;
    const expected = generation.current;
    const operation = ++suggestionId.current;
    setSuggesting(true);
    setSuggestions([]);
    setCheckedAt('');
    setSuggestionMessage('Checking current outfit ideas…');
    try {
      const response = await request('/api/lulu/outfit/suggest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ garment: profile.garment, color: profile.color, style: profile.style, interest: profile.interest }),
      }, expected, undefined, 25000);
      if (!response.ok) throw new Error(await responseError(response, 'Outfit suggestions are unavailable. Please try again.'));
      const result = safeSuggestions(await response.json());
      if (!active(expected) || operation !== suggestionId.current) return;
      setSuggestions(result.items);
      setCheckedAt(result.checkedAt);
      setSuggestionMessage(result.items.length ? 'Related pages from the official store. Availability and prices need checking on the shop page.' : 'No matching suggestions were returned. You can still browse the official store.');
    } catch (error) {
      if (active(expected) && operation === suggestionId.current) setSuggestionMessage(error instanceof Error ? error.message : 'Outfit suggestions are unavailable. Please try again.');
    } finally {
      if (active(expected) && operation === suggestionId.current) setSuggesting(false);
    }
  }

  async function retryStatus() {
    const expected = generation.current;
    setLoading(true);
    setLoadError('');
    try {
      await reload(
        expected,
        profileAwaitingRefresh || !profileDirtyRef.current,
        profileAwaitingRefresh ? savedProfileEditId.current : undefined,
      );
    } catch (error) {
      if (active(expected)) setLoadError(error instanceof Error ? error.message : 'Style memory is unavailable. Please retry.');
    } finally {
      if (active(expected)) setLoading(false);
    }
  }

  const statusCopy = loading
    ? 'Checking this browser’s saved choices…'
    : loadError
      ? loadError
      : snapshot?.profile
        ? 'A saved profile is ready to review or edit.'
        : snapshot?.newsletter ? 'A signup request is saved; no style profile is remembered.' : 'Nothing from this section is remembered until you choose to save it.';

  const Container = contextual ? 'section' : 'details';
  return (
    <Container className="style-profile">
      {!contextual && <summary>Camera &amp; clothing</summary>}
      <fieldset className="style-profile__body" disabled={forgetting} style={{ border: 0, margin: 0, minWidth: 0 }}>
        <p className="style-profile__intro">Let Ruru look your way, recognize you with permission, or describe a clothing frame you choose.</p>
        <p className={`style-profile__status ${loadError ? 'is-error' : ''}`} role="status">
          {statusCopy}
          {loadError && <button type="button" className="style-profile__link-button" onClick={() => void retryStatus()} disabled={loading}>Retry status</button>}
        </p>

        <section className="style-profile__section" aria-labelledby="outfit-photo-heading">
          <div className="style-profile__heading">
            <div><span className="style-profile__step">Optional camera</span><h3 id="outfit-photo-heading">Let Ruru see you</h3></div>
            <span className="style-profile__private">Video stays in your browser</span>
          </div>
          <p>Start the camera when you are ready, then choose one view to review. Only a chosen frame can be sent for analysis.</p>
          <LiveCamera onFrame={useCameraFrame} onStop={cameraStopped} />
          <details className="style-profile__upload">
            <summary>Upload a photo instead</summary>
            <label className="style-profile__file">
              <span>{photo?.source === 'upload' ? 'Choose a different photo' : 'Choose a PNG or JPEG'}</span>
              <input type="file" accept="image/png,image/jpeg" onChange={choosePhoto} />
              <small>Up to 3 MB</small>
            </label>
          </details>
          {photo && <div className="style-profile__preview"><img src={photo.dataUrl} alt={photo.source === 'camera' ? 'Selected camera frame' : 'Selected outfit preview'} /><div><strong>{photo.name}</strong><button type="button" className="style-profile__link-button" onClick={removePhoto}>Remove {photo.source === 'camera' ? 'frame' : 'photo'}</button></div></div>}
          {photoError && <p className="style-profile__feedback is-error" role="alert">{photoError}</p>}
          {!snapshot?.capabilities.vision && !loading && <p className="style-profile__unavailable">Photo analysis is not connected yet. Describe your outfit below.</p>}
          {photo && snapshot?.capabilities.vision && <>
            <label className="style-profile__consent"><input type="checkbox" checked={photoConsent} onChange={event => { setPhotoConsent(event.target.checked); if (!event.target.checked) cancelAnalysis(true); }} /><span>Use this photo to describe my clothes. The image is sent to OpenAI only when I choose Analyse.</span></label>
            <button type="button" className="style-profile__secondary" onClick={() => void analysePhoto()} disabled={!photoConsent || analysing}>{analysing ? 'Analysing…' : photo.source === 'camera' ? 'Analyse selected frame' : 'Analyse photo'}</button>
          </>}
          {analysisMessage && <p className="style-profile__feedback" role="status">{analysisMessage}</p>}
        </section>

        <form className="style-profile__section" onSubmit={event => void saveProfile(event)}>
          <div className="style-profile__heading"><div><span className="style-profile__step">Your review</span><h3>Style profile</h3></div></div>
          <p>Check these details before asking Ruru to remember them. Camera and photo suggestions are editable.</p>
          <div className="style-profile__fields">
            <label className="style-profile__wide"><span>What should Ruru call you? <small>Optional</small></span><input value={profile.name} maxLength={40} autoComplete="nickname" onChange={event => updateProfile('name', event.target.value)} placeholder="A name or nickname" /></label>
            <label><span>What are you into?</span><select required value={profile.interest} onChange={event => updateProfile('interest', event.target.value as Interest | '')}><option value="">Choose one</option>{interests.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
            <label><span>Garment</span><select value={profile.garment} onChange={event => updateProfile('garment', event.target.value as Garment)}>{garments.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
            <label><span>Colour</span><select value={profile.color} onChange={event => updateProfile('color', event.target.value as Colour)}>{colours.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
            <label><span>Style</span><select value={profile.style} onChange={event => updateProfile('style', event.target.value as OutfitStyle)}>{styles.map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
          </div>
          <label className="style-profile__consent"><input type="checkbox" checked={profileConsent} onChange={event => setProfileConsent(event.target.checked)} /><span>Remember this reviewed style profile for 30 days on this browser. Do not save the photo.</span></label>
          <div className="style-profile__actions">
            <button className="style-profile__primary" disabled={!snapshot || !profile.interest || !profileConsent || savingProfile || profileAwaitingRefresh}>{savingProfile ? 'Saving…' : 'Save reviewed profile'}</button>
            {profileDirty && <span>Unsaved edits</span>}
          </div>
          {profileMessage && <p className="style-profile__feedback" role="status">{profileMessage} {profileAwaitingRefresh && <button type="button" className="style-profile__link-button" onClick={() => void retryStatus()}>Retry status</button>}</p>}
        </form>

        <section className="style-profile__section" aria-labelledby="outfit-ideas-heading">
          <div className="style-profile__heading"><div><span className="style-profile__step">Optional ideas</span><h3 id="outfit-ideas-heading">Related official shop pages</h3></div></div>
          {snapshot?.capabilities.search ? <>
            <p>Search uses only the garment, colour, style and interest above. Your photo, name and email are not sent.</p>
            <button type="button" className="style-profile__secondary" disabled={!profile.interest || suggesting} onClick={() => void findSuggestions()}>{suggesting ? 'Checking…' : 'Find outfit ideas'}</button>
          </> : !loading && <p className="style-profile__unavailable">Outfit search is not connected yet. <a href={storeUrl} target="_blank" rel="noreferrer">Browse the official lululemon store finder</a>.</p>}
          {suggestionMessage && <p className="style-profile__feedback" role="status">{suggestionMessage}</p>}
          {suggestions.length > 0 && <ul className="style-profile__suggestions">{suggestions.map(item => <li key={item.url}><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a><p>{item.description}</p></li>)}</ul>}
          {checkedAt && <p className="style-profile__checked">Sources checked {new Date(checkedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>}
        </section>

      </fieldset>
    </Container>
  );
}

export default StyleProfile;
