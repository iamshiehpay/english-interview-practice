import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness, setup} from './helpers.js';
import {FakeSpeechProvider, readAloudSpeeds} from '../src/speech.js';

// A provider that records exactly what the application asked it to speak.
function recordingProvider(overrides = {}) {
  const calls = [];
  return {calls, provider: {
    name: 'test read-aloud',
    external: true,
    async transcribe() { return {transcript: 'unused'}; },
    async speak(args) { calls.push(args); return overrides.speak ? overrides.speak(args) : {audio: Buffer.from('spoken-audio'), mimeType: 'audio/mpeg'}; }
  }};
}

test('a stored question is read aloud with exactly the stored English text', async t => {
  const {calls, provider} = recordingProvider();
  const {api} = await harness(t, undefined, {speechProvider: provider});
  const {snapshot, analysis, record} = await setup(api);

  const fromSet = await api('/speech', {snapshotId: snapshot.id, questionId: analysis.questions[0].id});
  assert.equal(fromSet.status, 200);
  assert.deepEqual(Object.keys(fromSet.data).sort(), ['audio', 'mimeType', 'speed']);
  assert.equal(fromSet.data.mimeType, 'audio/mpeg');
  assert.equal(Buffer.from(fromSet.data.audio, 'base64').toString(), 'spoken-audio');
  assert.equal(calls.at(-1).text, analysis.questions[0].text);
  assert.equal(calls.at(-1).speed, readAloudSpeeds.normal);

  const fromRecord = await api('/speech', {recordId: record.id});
  assert.equal(fromRecord.status, 200);
  assert.equal(calls.at(-1).text, record.question.text);

  const slower = await api('/speech', {recordId: record.id, speed: 'slow'});
  assert.equal(slower.data.speed, 'slow');
  assert.equal(calls.at(-1).speed, readAloudSpeeds.slow);
  assert.equal((await api('/speech', {recordId: record.id, speed: 'sonic'})).status, 400);
});

test('read aloud takes references only, and unknown or Chinese-only references are refused', async t => {
  const {calls, provider} = recordingProvider();
  const {api, store} = await harness(t, undefined, {speechProvider: provider});
  const {snapshot, analysis, record} = await setup(api);

  assert.equal((await api('/speech', {recordId: record.id, text: 'Say whatever I want'})).status, 400);
  assert.equal((await api('/speech', {snapshotId: snapshot.id, questionId: 'no-such-question'})).status, 404);
  assert.equal((await api('/speech', {recordId: 'no-such-record'})).status, 404);
  assert.equal((await api('/speech', {recordId: record.id, followUpId: 'no-such-follow-up'})).status, 404);
  assert.equal((await api('/speech', {recordId: record.id, attemptId: 'no-such-attempt', correctionIndex: 0})).status, 404);

  // A Traditional Chinese hint is cached beside the Illustrative Answer; only the
  // Illustrative Answer is addressable, and the Chinese one stays unspeakable.
  const hint = (await api(`/records/${record.id}/coaching`, {mode: 'hint'})).data;
  assert.equal((await api('/speech', {recordId: record.id, coachingId: hint.id})).status, 404);
  const illustrative = (await api(`/records/${record.id}/coaching`, {mode: 'illustrative'})).data;
  assert.equal((await api('/speech', {recordId: record.id, coachingId: illustrative.id})).status, 200);
  assert.equal(calls.at(-1).text, illustrative.text);

  // Defence in depth for legacy stored data: a question with no Latin script is refused.
  await store.transact(d => { d.records[record.id].question.text = '請說明你的做法與取捨。'; });
  assert.equal((await api('/speech', {recordId: record.id})).status, 400);
  assert.ok(calls.every(call => !/\p{Script=Han}/u.test(call.text)));
});

test('a follow-up question and a key-sentence rewrite are readable, the learner transcript is not', async t => {
  const {calls, provider} = recordingProvider();
  const {api} = await harness(t, undefined, {speechProvider: provider});
  const {record} = await setup(api);
  const transcript = 'I would compare the two designs. I would then test the riskiest assumption first.';
  await api(`/records/${record.id}/attempts`, {transcript});
  await api(`/records/${record.id}/feedback`, {});
  const node = (await api(`/records/${record.id}/follow-ups`, {})).data;
  assert.equal((await api('/speech', {recordId: record.id, followUpId: node.id})).status, 200);
  assert.equal(calls.at(-1).text, node.question.text);

  const attemptId = (await api(`/records/${record.id}`)).data.attempts[0].id;
  const corrections = (await api(`/records/${record.id}/corrections`, {attemptId})).data;
  assert.ok(corrections.corrections.length, 'demonstration provider returns one correction');
  assert.equal((await api('/speech', {recordId: record.id, attemptId, correctionIndex: 0})).status, 200);
  assert.equal(calls.at(-1).text, corrections.corrections[0].rewrite);
  assert.equal((await api('/speech', {recordId: record.id, attemptId, correctionIndex: 9})).status, 404);
});

test('a provider without a speaking capability is reported and refuses cleanly', async t => {
  const {api} = await harness(t, undefined, {speechProvider: {name: 'transcribe only', async transcribe() { return {transcript: 'x'}; }}});
  const {record} = await setup(api);
  const providers = (await api('/providers')).data;
  assert.equal(providers.speech.canSpeak, false);
  const refused = await api('/speech', {recordId: record.id});
  assert.equal(refused.status, 409);
  assert.ok(!/api|key|secret/i.test(JSON.stringify(refused.data)));
});

test('a read-aloud failure changes nothing and stays retryable', async t => {
  let fail = true;
  const {provider} = recordingProvider({speak: () => { if (fail) throw Error('tts outage'); return {audio: Buffer.from('ok'), mimeType: 'audio/mpeg'}; }});
  const {api} = await harness(t, undefined, {speechProvider: provider});
  const {record} = await setup(api);
  const before = (await api('/workspace')).data;
  assert.equal((await api('/speech', {recordId: record.id})).status, 502);
  assert.deepEqual((await api('/workspace')).data, before);
  fail = false;
  assert.equal((await api('/speech', {recordId: record.id})).status, 200);
});

test('invalid read-aloud provider output is rejected and concurrency is bounded', async t => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let gated = 0;
  const provider = {
    name: 'gated', external: true,
    async transcribe() { return {transcript: 'x'}; },
    async speak({text}) {
      if (text.includes('BAD')) return {audio: 'not-a-buffer', mimeType: 'audio/mpeg'};
      gated += 1; await gate; return {audio: Buffer.from('ok'), mimeType: 'audio/mpeg'};
    }
  };
  const {api, store} = await harness(t, undefined, {speechProvider: provider});
  const {record} = await setup(api);

  const held = [api('/speech', {recordId: record.id}), api('/speech', {recordId: record.id})];
  while (gated < 2) await new Promise(r => setTimeout(r, 5));
  assert.equal((await api('/speech', {recordId: record.id})).status, 429);
  release();
  for (const result of await Promise.all(held)) assert.equal(result.status, 200);

  await store.transact(d => { d.records[record.id].question.text = 'BAD question text'; });
  assert.equal((await api('/speech', {recordId: record.id})).status, 502);
});

test('the demonstration provider speaks a labelled non-speech tone', async t => {
  const {api} = await harness(t, undefined, {speechProvider: new FakeSpeechProvider()});
  const {record} = await setup(api);
  const providers = (await api('/providers')).data;
  assert.equal(providers.speech.canSpeak, true);
  assert.equal(providers.speech.demonstrationSpeech, true);
  const spoken = await api('/speech', {recordId: record.id});
  assert.equal(spoken.status, 200);
  assert.equal(spoken.data.mimeType, 'audio/wav');
  assert.equal(Buffer.from(spoken.data.audio, 'base64').subarray(0, 4).toString(), 'RIFF');
});
