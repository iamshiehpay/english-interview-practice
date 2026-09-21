import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {harness, setup} from './helpers.js';
import {RECORDING_LIMIT_SECONDS, RECORDING_MAX_BYTES, RECORDING_MAX_BASE64, RECORDING_MAX_REQUEST_BYTES} from '../src/speech.js';

const base64 = bytes => Buffer.alloc(bytes, 7).toString('base64');

test('the stated recording budget, the enforced byte limit and the request cap cannot drift apart', async t => {
  // Browsers encode speech well under 320 kbps in Opus or AAC; the byte budget must
  // hold a full-length answer at that generous rate, or the browser timer would let a
  // learner record something the server then refuses.
  const generousBytesPerSecond = 320_000 / 8;
  assert.ok(RECORDING_MAX_BYTES >= RECORDING_LIMIT_SECONDS * generousBytesPerSecond,
    `${RECORDING_MAX_BYTES} bytes cannot hold ${RECORDING_LIMIT_SECONDS}s at 320 kbps`);
  assert.equal(RECORDING_LIMIT_SECONDS, 180);
  assert.equal(RECORDING_MAX_BASE64, Math.ceil(RECORDING_MAX_BYTES / 3) * 4);
  assert.ok(RECORDING_MAX_REQUEST_BYTES > RECORDING_MAX_BASE64, 'the request cap must leave room for the JSON envelope');

  const {api} = await harness(t, undefined, {speechProvider: {name: 'sized', async transcribe() { return {transcript: 'A full length spoken answer.'}; }}});
  const {record} = await setup(api);
  // The browser reports the limits it must enforce, so one constant governs both sides.
  const speech = (await api('/providers')).data.speech;
  assert.equal(speech.recordingLimitSeconds, RECORDING_LIMIT_SECONDS);
  assert.equal(speech.recordingMaxBytes, RECORDING_MAX_BYTES);
  assert.ok(speech.recordingWarningSeconds > 0 && speech.recordingWarningSeconds < RECORDING_LIMIT_SECONDS);

  // A full-length answer at a realistic bitrate is accepted.
  const realistic = base64(Math.round(RECORDING_LIMIT_SECONDS * 96_000 / 8));
  assert.ok(realistic.length <= RECORDING_MAX_BASE64);
  assert.equal((await api(`/records/${record.id}/transcription`, {audio: realistic, mimeType: 'audio/webm'})).status, 200);
});

test('an oversized upload and an unsupported media type are refused with nothing written', async t => {
  let calls = 0;
  const {api, directory} = await harness(t, undefined, {speechProvider: {name: 'counting', async transcribe() { calls++; return {transcript: 'ok'}; }}});
  const {record} = await setup(api);
  const before = (await api(`/records/${record.id}`)).data;

  const oversized = 'A'.repeat(RECORDING_MAX_BASE64 + 4);
  assert.equal((await api(`/records/${record.id}/transcription`, {audio: oversized, mimeType: 'audio/webm'})).status, 400);
  assert.equal((await api(`/records/${record.id}/transcription`, {audio: base64(64), mimeType: 'audio/aiff'})).status, 400);
  assert.equal((await api(`/records/${record.id}/transcription`, {audio: '', mimeType: 'audio/webm'})).status, 400);

  assert.equal(calls, 0, 'a refused upload must never reach the speech provider');
  assert.deepEqual((await api(`/records/${record.id}`)).data, before);
  assert.deepEqual(await readdir(join(directory, 'temporary-audio')), []);
});

test('a request larger than the recording budget is rejected as too large, not parsed', async t => {
  const {api, base} = await harness(t, undefined, {speechProvider: {name: 'unused', async transcribe() { throw Error('should not be called'); }}});
  const {record} = await setup(api);
  const response = await fetch(`${base}/api/records/${record.id}/transcription`, {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({audio: 'A'.repeat(RECORDING_MAX_REQUEST_BYTES + 1000), mimeType: 'audio/webm'})
  });
  assert.equal(response.status, 413);
  assert.deepEqual((await api(`/records/${record.id}`)).data.attempts, []);
});
