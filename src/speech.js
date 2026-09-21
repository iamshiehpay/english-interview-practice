import {mkdir, writeFile, unlink, readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {requireValue, nonempty} from './domain.js';

// One stated recording budget. The browser timer, the browser byte check, the
// interface wording and the server-side validation all derive from these, so the
// four cannot drift apart. Browsers encode speech at roughly 24–128 kbps in Opus
// (WebM/Ogg) or AAC (MP4); the byte budget leaves headroom well above that.
export const RECORDING_LIMIT_SECONDS = 180;
export const RECORDING_WARNING_SECONDS = 30;
export const RECORDING_MAX_BYTES = 10_000_000;
export const RECORDING_MAX_BASE64 = Math.ceil(RECORDING_MAX_BYTES / 3) * 4;
export const RECORDING_MAX_REQUEST_BYTES = RECORDING_MAX_BASE64 + 100_000;
export const recordingMediaTypes = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav'];

// Read-aloud speeds are a small fixed set; the browser may only name one of these.
export const readAloudSpeeds = {slow: 0.75, normal: 1, fast: 1.25};
export const readAloudMediaTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'];
// A long question plus its rationale stays far below this; the cap bounds outbound text.
export const READ_ALOUD_MAX_CHARACTERS = 4000;

export class FakeSpeechProvider {
  name = 'Demonstration speech provider (fixed sample transcript)';
  // Deliberately not speech: a short tone proves the whole read-aloud path works
  // without a key, and the interface labels it as a demonstration.
  demonstrationSpeech = true;
  async transcribe({audioPath, mimeType}) {
    return {transcript: 'I would first clarify the requirements, then compare alternatives and test the assumptions. This is a demonstration transcript, not a transcription of your recording.'};
  }
  async speak({speed}) {
    return {audio: tone(0.6 / (speed || 1)), mimeType: 'audio/wav'};
  }
}

function tone(seconds, rate = 8000, hertz = 440) {
  const samples = Math.max(1, Math.round(seconds * rate));
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * hertz * i) / rate) * 4000), i * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

export const canSpeak = provider => typeof provider?.speak === 'function';

// The caller resolves `text` from stored English content; free browser text never
// reaches here. The script check is defence in depth for legacy or corrupted records:
// an English question may quote a short Chinese resume line, but text that is mostly
// Han is not English practice text and is not sent out.
const mostlyHan = text => {
  const letters = text.match(/\p{L}/gu) || [];
  return letters.length > 0 && (text.match(/\p{Script=Han}/gu) || []).length * 5 > letters.length * 2;
};
export async function readAloud({provider, text, speed = 'normal', signal}) {
  requireValue(canSpeak(provider), 'This speech provider cannot read text aloud', 409);
  requireValue(Object.hasOwn(readAloudSpeeds, speed), 'Choose a supported reading speed');
  requireValue(nonempty(text) && text.length <= READ_ALOUD_MAX_CHARACTERS, 'Nothing to read aloud');
  requireValue(/\p{Script=Latin}/u.test(text) && !mostlyHan(text), 'Only English practice text is read aloud');
  const work = provider.speak({text, speed: readAloudSpeeds[speed], signal});
  let listener;
  const result = signal ? await Promise.race([work, new Promise((_, reject) => {listener = () => reject(signal.reason); if (signal.aborted) listener(); else signal.addEventListener('abort', listener, {once: true});})]).finally(() => signal.removeEventListener('abort', listener)) : await work;
  requireValue(result && Object.keys(result).length === 2 && Buffer.isBuffer(result.audio) && result.audio.length > 0 && result.audio.length <= 4_000_000 && readAloudMediaTypes.includes(result.mimeType), 'Invalid read-aloud provider output', 502);
  return {audio: result.audio.toString('base64'), mimeType: result.mimeType, speed};
}
export async function clearTemporaryAudio(directory) {
  await mkdir(directory, {recursive: true, mode: 0o700});
  for (const name of await readdir(directory)) if (name.endsWith('.audio')) await unlink(join(directory, name));
}
export async function transcribeTemporary({directory, provider, audio, mimeType, signal}) {
  requireValue(typeof audio === 'string' && audio.length > 0 && audio.length <= RECORDING_MAX_BASE64 && /^[A-Za-z0-9+/]+={0,2}$/.test(audio) && audio.length % 4 === 0, `Audio must be valid base64, at most ${RECORDING_MAX_BYTES / 1_000_000} MB`);
  requireValue(recordingMediaTypes.includes(mimeType), 'Unsupported audio format');
  const bytes = Buffer.from(audio, 'base64');
  requireValue(bytes.length > 0, 'Recording is empty');
  const audioPath = join(directory, `${randomUUID()}.audio`);
  try {
    await writeFile(audioPath, bytes, {mode: 0o600});
    const work = provider.transcribe({audioPath, mimeType, signal});
    let listener;
    const result = signal ? await Promise.race([work, new Promise((_,reject)=>{listener=()=>reject(signal.reason);if(signal.aborted)listener();else signal.addEventListener('abort',listener,{once:true});})]).finally(()=>signal.removeEventListener('abort',listener)) : await work;
    requireValue(result && Object.keys(result).length === 1 && nonempty(result.transcript) && result.transcript.length <= 100000, 'Invalid speech provider transcript', 502);
    return result.transcript;
  } finally {
    bytes.fill(0);
    await unlink(audioPath).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}
