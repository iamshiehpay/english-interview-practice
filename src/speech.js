import {mkdir, writeFile, unlink, readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {requireValue, nonempty} from './domain.js';

export class FakeSpeechProvider {
  name = 'Demonstration speech provider (fixed sample transcript)';
  async transcribe({audioPath, mimeType}) {
    return {transcript: 'I would first clarify the requirements, then compare alternatives and test the assumptions. This is a demonstration transcript, not a transcription of your recording.'};
  }
}
export async function clearTemporaryAudio(directory) {
  await mkdir(directory, {recursive: true, mode: 0o700});
  for (const name of await readdir(directory)) if (name.endsWith('.audio')) await unlink(join(directory, name));
}
export async function transcribeTemporary({directory, provider, audio, mimeType, signal}) {
  requireValue(typeof audio === 'string' && audio.length > 0 && audio.length <= 8_000_000 && /^[A-Za-z0-9+/]+={0,2}$/.test(audio) && audio.length % 4 === 0, 'Audio must be valid base64, at most 6 MB');
  requireValue(['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav'].includes(mimeType), 'Unsupported audio format');
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
