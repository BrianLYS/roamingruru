import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const ROOT = resolve(import.meta.dirname, '../..');
const OUTPUT_DIR = resolve(ROOT, '.local/launch-film/ruru-selected-audio');
const MANIFEST_PATH = resolve(import.meta.dirname, 'dialogue.json');
const MODEL_ID = 'eleven_v3';
const OUTPUT_FORMAT = 'mp3_44100_128';

const LINES = [
  { id: 0, speaker: 'Ruru', text: 'Hello! I haven’t seen you here before. What’s your name?', file: '00-lulu-introduction.mp3' },
  { id: 1, speaker: 'Brian', text: 'My name’s Brian!', file: '01-brian-name.mp3' },
  { id: 2, speaker: 'Ruru', text: 'Hi Brian! You look drenched. You can get an umbrella at 7-Eleven. Have a discount on me!', file: '02-lulu-umbrella.mp3' },
  { id: 3, speaker: 'Brian', text: 'Thanks! I was out for a run and got caught in the rain.', file: '03-brian-rain.mp3' },
  { id: 4, speaker: 'Ruru', text: 'Well, let’s get you dry first!', file: '04-lulu-dry-first.mp3' },
  { id: 5, speaker: 'Ruru', text: 'Hey Brian! You don’t look as wet today.', file: '05-lulu-second-visit.mp3' },
  { id: 6, speaker: 'Brian', text: 'Your umbrella was so helpful. Thanks so much!', file: '06-brian-umbrella-thanks.mp3' },
  { id: 7, speaker: 'Ruru', text: 'You’re welcome! Been out running again?', file: '07-lulu-running-again.mp3' },
  { id: 8, speaker: 'Brian', text: 'Yes! Much better weather this time.', file: '08-brian-better-weather.mp3' },
  { id: 9, speaker: 'Ruru', text: 'Then you might like this. Lululemon’s having an event today. Come check it out!', file: '09-lulu-event.mp3' },
  { id: 10, speaker: 'Brian', text: 'Good looking out, Ruru!', file: '10-brian-good-looking-out.mp3' },
  { id: 11, speaker: 'Ruru', text: 'That’s what I’m here for!', file: '11-lulu-here-for.mp3' },
  { id: 12, speaker: 'Ruru', text: 'Hello! I haven’t seen you here before.', file: '12-lulu-closing.mp3' },
];

const VOICES = {
  Ruru: {
    id: undefined,
    name: 'Roaminglulu Lulu - Selected 1',
    settings: { stability: 0.5 },
  },
  Brian: {
    id: undefined,
    name: 'Roaminglulu Brian - Selected 1',
    settings: { stability: 0.5 },
  },
};

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

function duration(path) {
  const probe = spawnSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', path,
  ], { encoding: 'utf8' });
  if (probe.status !== 0) throw new Error(`ffprobe rejected ${path}: ${probe.stderr.trim()}`);
  const seconds = Number(probe.stdout.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error(`Invalid audio duration for ${path}`);
  return Number(seconds.toFixed(6));
}

function safeResponseHeaders(headers) {
  return Object.fromEntries([
    'character-cost',
    'x-character-count',
    'x-character-cost',
    'request-id',
    'x-request-id',
    'history-item-id',
  ].flatMap(name => headers.get(name) ? [[name, headers.get(name)]] : []));
}

function receiptPath(line) {
  return resolve(OUTPUT_DIR, line.file.replace(/\.mp3$/, '.receipt.json'));
}

function readReceipt(line) {
  const path = receiptPath(line);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

function validateExisting(line) {
  const audioPath = resolve(OUTPUT_DIR, line.file);
  const receipt = readReceipt(line);
  if (!receipt && !existsSync(audioPath)) return null;
  if (!receipt) throw new Error(`Audio exists without a receipt for line ${line.id}; refusing a possible duplicate request.`);
  if (receipt.status !== 'generated') throw new Error(`Line ${line.id} has ${receipt.status} receipt state; inspect it before any retry.`);
  if (!existsSync(audioPath)) throw new Error(`Receipt exists but audio is missing for line ${line.id}; refusing a duplicate request.`);
  if (receipt.textSha256 !== sha256(line.text) || receipt.audioSha256 !== sha256(readFileSync(audioPath))) {
    throw new Error(`Receipt integrity check failed for line ${line.id}; refusing a duplicate request.`);
  }
  return { line, duration: duration(audioPath), reused: true, characters: receipt.characters };
}

async function generate(line, apiKey) {
  const voice = VOICES[line.speaker];
  const audioPath = resolve(OUTPUT_DIR, line.file);
  const receiptFile = receiptPath(line);
  const characters = [...line.text].length;
  const startedAt = new Date().toISOString();
  const baseReceipt = {
    status: 'requesting',
    lineId: line.id,
    speaker: line.speaker,
    text: line.text,
    textSha256: sha256(line.text),
    characters,
    voice: voice.name,
    voiceId: voice.id,
    modelId: MODEL_ID,
    outputFormat: OUTPUT_FORMAT,
    startedAt,
  };
  writeJson(receiptFile, baseReceipt);

  let response;
  try {
    response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice.id)}?output_format=${OUTPUT_FORMAT}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text: line.text, model_id: MODEL_ID, voice_settings: voice.settings }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    writeJson(receiptFile, { ...baseReceipt, status: 'uncertain', failedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) });
    throw new Error(`Line ${line.id} request ended without a provider response; refusing an automatic retry.`);
  }

  const responseHeaders = safeResponseHeaders(response.headers);
  if (!response.ok || !response.headers.get('content-type')?.startsWith('audio/')) {
    const body = (await response.text()).slice(0, 1000);
    writeJson(receiptFile, {
      ...baseReceipt,
      status: 'failed',
      failedAt: new Date().toISOString(),
      responseStatus: response.status,
      responseHeaders,
      responseBody: body,
    });
    throw new Error(`Line ${line.id} failed with HTTP ${response.status}; receipt saved and no retry attempted.`);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (!audio.length || audio.length > 5_000_000) {
    writeJson(receiptFile, { ...baseReceipt, status: 'failed', failedAt: new Date().toISOString(), responseStatus: response.status, responseHeaders, bytes: audio.length });
    throw new Error(`Line ${line.id} returned invalid audio; receipt saved and no retry attempted.`);
  }
  const partialPath = `${audioPath}.partial`;
  writeFileSync(partialPath, audio, { mode: 0o600 });
  const audioDuration = duration(partialPath);
  renameSync(partialPath, audioPath);
  writeJson(receiptFile, {
    ...baseReceipt,
    status: 'generated',
    completedAt: new Date().toISOString(),
    responseStatus: response.status,
    responseHeaders,
    bytes: audio.length,
    duration: audioDuration,
    audioSha256: sha256(audio),
  });
  return { line, duration: audioDuration, reused: false, characters };
}

async function main() {
  if (process.argv.some(argument => !['--plan'].includes(argument) && argument !== process.argv[0] && argument !== process.argv[1])) {
    throw new Error('Supported option: --plan');
  }
  process.loadEnvFile(resolve(ROOT, '.env.local'));
  const selected = JSON.parse(readFileSync(resolve(ROOT, '.local/voice-auditions/character/selected-voices.json'), 'utf8'));
  VOICES.Ruru.id = selected.Lulu; VOICES.Brian.id = selected.Brian;
  if (!selected.Lulu || !selected.Brian) throw new Error('Selected voices missing');

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const existing = new Map();
  for (const line of LINES) {
    const result = validateExisting(line);
    if (result) existing.set(line.id, result);
  }

  const pending = LINES.filter(line => !existing.has(line.id));
  const pendingCharacters = pending.reduce((sum, line) => sum + [...line.text].length, 0);
  console.log(JSON.stringify({ lines: LINES.length, existing: existing.size, pending: pending.length, pendingCharacters }, null, 2));
  if (process.argv.includes('--plan')) return;
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is missing from .env.local.');

  const results = [];
  for (const line of LINES) results.push(existing.get(line.id) ?? await generate(line, apiKey));
  const manifest = results.map(({ line, duration: audioDuration }) => ({
    id: line.id,
    speaker: line.speaker,
    text: line.text,
    file: `.local/launch-film/ruru-selected-audio/${line.file}`,
    duration: audioDuration,
  }));
  writeJson(MANIFEST_PATH, manifest);
  const generatedCharacters = results.filter(result => !result.reused).reduce((sum, result) => sum + result.characters, 0);
  console.log(JSON.stringify({ status: 'complete', generatedLines: results.filter(result => !result.reused).length, reusedLines: results.filter(result => result.reused).length, generatedCharacters, manifest: 'tools/launch-film/dialogue.json' }, null, 2));
}

await main();
