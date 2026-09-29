import {mkdir, unlink, readdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {requireValue, nonempty} from './domain.js';
import {RECORDING_MAX_BASE64, RECORDING_MAX_BYTES, recordingMediaTypes} from './speech.js';
import {WorkspaceQuota} from './workspace-quota.js';

// Answer Recordings live as files beside the practice database, never as base64 inside
// the JSON document, which is rewritten on every transaction. The database holds only a
// reference; ADR 0019 requires that a reference without a file can never be observed, so
// files are removed only after the transaction that dropped their reference commits.
const extensions = {'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/wav': 'wav'};
const identifier = /^[0-9a-f-]{36}$/;

export class RecordingStore {
  constructor(directory, {quota = new WorkspaceQuota(directory)} = {}) { this.directory = join(directory, 'recordings'); this.quota=quota; }
  async open() { await mkdir(this.directory, {recursive: true, mode: 0o700}); return this; }
  path(entry) {
    requireValue(identifier.test(entry.id) && Object.hasOwn(extensions, entry.mimeType), 'Not found', 404);
    return join(this.directory, `${entry.id}.${extensions[entry.mimeType]}`);
  }
  async write(entry, bytes) { await this.quota.write(this.path(entry), bytes, {mode: 0o600}); }
  async read(entry) { return readFile(this.path(entry)); }
  async remove(entries) {
    for (const entry of entries) await unlink(this.path(entry)).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
  // Delete every file no retained reference points to. This replaces the old
  // "delete all temporary audio at startup" rule, which would now destroy kept answers.
  async sweep(keep) {
    for (const name of await readdir(this.directory)) {
      const dot = name.lastIndexOf('.');
      if (dot <= 0 || !Object.values(extensions).includes(name.slice(dot + 1))) continue;
      if (!keep.has(name.slice(0, dot))) await unlink(join(this.directory, name)).catch(error => { if (error.code !== 'ENOENT') throw error; });
    }
  }
}

export function recordingsFor(data, predicate) {
  return Object.values(data.recordings || {}).filter(predicate);
}

// Decode and persist one upload. The caller registers it in the database only after the
// transcription succeeds, so a failed attempt leaves neither a file nor a reference.
export async function captureRecording({store, audio, mimeType}) {
  requireValue(typeof audio === 'string' && audio.length > 0 && audio.length <= RECORDING_MAX_BASE64 && /^[A-Za-z0-9+/]+={0,2}$/.test(audio) && audio.length % 4 === 0, `Audio must be valid base64, at most ${RECORDING_MAX_BYTES / 1_000_000} MB`);
  requireValue(recordingMediaTypes.includes(mimeType), 'Unsupported audio format');
  const bytes = Buffer.from(audio, 'base64');
  requireValue(bytes.length > 0, 'Recording is empty');
  const entry = {id: randomUUID(), mimeType, bytes: bytes.length, capturedAt: new Date().toISOString()};
  await store.write(entry, bytes);
  bytes.fill(0);
  return entry;
}

export async function transcribeRecording({store, provider, entry, signal}) {
  const work = provider.transcribe({audioPath: store.path(entry), mimeType: entry.mimeType, signal});
  let listener;
  const result = signal
    ? await Promise.race([work, new Promise((_, reject) => {listener = () => reject(signal.reason); if (signal.aborted) listener(); else signal.addEventListener('abort', listener, {once: true});})]).finally(() => signal.removeEventListener('abort', listener))
    : await work;
  // A provider that returns nothing is not broken: a silent, too-quiet or wrong-input
  // recording transcribes to an empty string. That is the learner's situation to fix,
  // not a provider fault, so it gets its own actionable message instead of a generic
  // "transcription failed" that invites a pointless retry of the same audio.
  requireValue(result && Object.keys(result).length === 1 && typeof result.transcript === 'string' && result.transcript.length <= 100000, 'Invalid speech provider transcript', 502);
  requireValue(nonempty(result.transcript), 'No speech was detected in the recording', 422);
  return result.transcript;
}
