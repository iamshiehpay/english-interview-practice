import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdir, readFile, writeFile, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createApplication} from '../src/server.js';
import {harness, setup} from './helpers.js';

const audio = text => Buffer.from(text.padEnd(64, '.')).toString('base64');
const upload = (text = 'first take') => ({audio: audio(text), mimeType: 'audio/webm'});
const speaking = (transcript = 'I would compare the two designs before deciding.') => ({name: 'fixture speech', async transcribe() { return {transcript}; }});
const files = directory => readdir(join(directory, 'recordings'));
const workspace = api => api('/workspace').then(r => r.data);

async function submitSpoken(api, recordId, {text = 'first take', transcript, edit} = {}) {
  const draft = (await api(`/records/${recordId}/transcription`, upload(text))).data;
  const submitted = edit ?? draft.transcript;
  const result = await api(`/records/${recordId}/attempts`, {transcript: submitted, transcriptDraftId: draft.id});
  assert.equal(result.status, 200, JSON.stringify(result.data));
  await api(`/records/${recordId}/feedback`, {});
  return draft;
}

test('a submitted spoken answer keeps its recording, replayable, with no audio in the database', async t => {
  const {api, directory, base} = await harness(t, undefined, {speechProvider: speaking()});
  const {record} = await setup(api);
  const draft = await submitSpoken(api, record.id, {text: 'my spoken answer'});

  const saved = (await api(`/records/${record.id}`)).data;
  const attempt = saved.attempts[0];
  assert.equal(attempt.inputMode, 'voice');
  assert.equal(attempt.recordingId, draft.recordingId);
  assert.equal(attempt.transcriptEdited, false);

  const entry = (await workspace(api)).recordings[attempt.recordingId];
  assert.equal(entry.state, 'retained');
  assert.equal(entry.attemptId, attempt.id);
  assert.equal(entry.mimeType, 'audio/webm');
  assert.ok(entry.bytes > 0 && Date.parse(entry.capturedAt));

  const playback = await fetch(`${base}/api/recordings/${attempt.recordingId}`);
  assert.equal(playback.status, 200);
  assert.equal(playback.headers.get('content-type'), 'audio/webm');
  assert.equal(playback.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Buffer.from(await playback.arrayBuffer()), Buffer.from(upload('my spoken answer').audio, 'base64'));

  const persisted = await readFile(join(directory, 'workspace.json'), 'utf8');
  assert.ok(!persisted.includes(upload('my spoken answer').audio), 'audio bytes must never enter the database');
  assert.equal((await files(directory)).length, 1);
});

test('editing the transcript labels the attempt without touching the recording bytes', async t => {
  const {api, directory, base} = await harness(t, undefined, {speechProvider: speaking('I would test it.')});
  const {record} = await setup(api);
  await submitSpoken(api, record.id, {text: 'original speech', edit: 'I would test it carefully and then measure the result.'});
  const attempt = (await api(`/records/${record.id}`)).data.attempts[0];
  assert.equal(attempt.transcriptEdited, true);
  assert.equal(attempt.transcript, 'I would test it carefully and then measure the result.');
  const bytes = Buffer.from(await (await fetch(`${base}/api/recordings/${attempt.recordingId}`)).arrayBuffer());
  assert.deepEqual(bytes, Buffer.from(upload('original speech').audio, 'base64'));
  assert.equal((await files(directory)).length, 1);
});

test('a revision keeps its own recording and neither attempt overwrites the other', async t => {
  const {api, directory, base} = await harness(t, undefined, {speechProvider: speaking()});
  const {record} = await setup(api);
  await submitSpoken(api, record.id, {text: 'take one'});
  await submitSpoken(api, record.id, {text: 'take two', edit: 'I would compare the two designs before deciding, then measure.'});

  const attempts = (await api(`/records/${record.id}`)).data.attempts;
  assert.equal(attempts.length, 2);
  assert.notEqual(attempts[0].recordingId, attempts[1].recordingId);
  assert.equal((await files(directory)).length, 2);
  for (const [index, name] of [[0, 'take one'], [1, 'take two']]) {
    const played = Buffer.from(await (await fetch(`${base}/api/recordings/${attempts[index].recordingId}`)).arrayBuffer());
    assert.deepEqual(played, Buffer.from(upload(name).audio, 'base64'));
  }
});

test('a typed answer and a failed transcription leave no recording behind', async t => {
  let fail = true;
  const {api, directory} = await harness(t, undefined, {speechProvider: {name: 'flaky', async transcribe() { if (fail) throw Error('outage'); return {transcript: 'I would validate the requirements.'}; }}});
  const {record} = await setup(api);

  assert.equal((await api(`/records/${record.id}/transcription`, upload())).status, 502);
  assert.deepEqual(await files(directory), [], 'a failed transcription writes neither a file nor a reference');
  assert.deepEqual((await workspace(api)).recordings ?? {}, {});

  await api(`/records/${record.id}/attempts`, {transcript: 'Typed instead.'});
  await api(`/records/${record.id}/feedback`, {});
  const attempt = (await api(`/records/${record.id}`)).data.attempts[0];
  assert.equal(attempt.inputMode, 'text');
  assert.equal(attempt.recordingId, undefined);
  assert.deepEqual(await files(directory), []);
});

test('a superseded or abandoned recording is removed rather than accumulating', async t => {
  const {api, directory} = await harness(t, undefined, {speechProvider: speaking()});
  const {record} = await setup(api);

  await api(`/records/${record.id}/transcription`, upload('discarded take'));
  assert.equal((await files(directory)).length, 1);
  const second = (await api(`/records/${record.id}/transcription`, upload('kept take'))).data;
  assert.equal((await files(directory)).length, 1, 'a new recording supersedes the earlier unsubmitted one');
  assert.equal(Object.keys((await workspace(api)).recordings).length, 1);

  // Submitting text instead abandons the pending recording.
  await api(`/records/${record.id}/attempts`, {transcript: 'I typed this answer instead of using the recording.'});
  assert.deepEqual(await files(directory), []);
  assert.deepEqual((await workspace(api)).recordings, {});
  assert.notEqual(second.recordingId, undefined);
});

test('completing a practice discards an unsubmitted recording', async t => {
  const {api, directory} = await harness(t, undefined, {speechProvider: speaking()});
  const {record} = await setup(api);
  await submitSpoken(api, record.id, {text: 'kept answer'});
  await api(`/records/${record.id}/transcription`, upload('never submitted'));
  assert.equal((await files(directory)).length, 2);
  assert.equal((await api(`/records/${record.id}/complete`, {focusPoint: 'State assumptions'})).data.status, 'completed');
  assert.equal((await files(directory)).length, 1, 'the retained answer survives, the unsubmitted recording does not');
  assert.equal(Object.values((await workspace(api)).recordings).filter(entry => entry.state === 'pending').length, 0);
});

test('deleting the practice, the job and the workspace each remove the recordings', async t => {
  const {api, directory, base} = await harness(t, undefined, {speechProvider: speaking()});
  const first = await setup(api);
  await submitSpoken(api, first.record.id, {text: 'answer one'});
  const attemptId = (await api(`/records/${first.record.id}`)).data.attempts[0].recordingId;
  assert.equal((await files(directory)).length, 1);

  assert.equal((await api(`/records/${first.record.id}`, undefined, 'DELETE')).status, 200);
  assert.deepEqual(await files(directory), []);
  assert.deepEqual((await workspace(api)).recordings, {});
  assert.equal((await fetch(`${base}/api/recordings/${attemptId}`)).status, 404);
  assert.equal((await api(`/records/${first.record.id}`, undefined, 'DELETE')).status, 404, 'a repeated delete is safe');

  const second = await setup(api);
  await submitSpoken(api, second.record.id, {text: 'answer two'});
  assert.equal((await files(directory)).length, 1);
  assert.equal((await api(`/snapshots/${second.snapshot.id}`, undefined, 'DELETE')).status, 200);
  assert.deepEqual(await files(directory), [], 'deleting a job removes the recordings of all its practices');

  const third = await setup(api);
  await submitSpoken(api, third.record.id, {text: 'answer three'});
  assert.equal((await files(directory)).length, 1);
  assert.equal((await api('/workspace/delete', {confirmation: 'DELETE ALL LOCAL DATA'})).status, 200);
  assert.deepEqual(await files(directory), []);
  assert.deepEqual((await workspace(api)).recordings ?? {}, {});
});

test('a restart keeps retained recordings, sweeps pending ones and removes unreferenced files', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'coach-recordings-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const open = async () => {
    const {server} = await createApplication({directory, speechProvider: speaking()});
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const api = async (path, data, method) => {
      const response = await fetch(base + '/api' + path, {method: method || (data === undefined ? 'GET' : 'POST'), headers: {'Content-Type': 'application/json'}, body: data === undefined ? undefined : JSON.stringify(data)});
      return {status: response.status, data: await response.json()};
    };
    return {api, base, close: () => new Promise(resolve => server.close(resolve))};
  };

  let session = await open();
  const {record} = await setup(session.api);
  await submitSpoken(session.api, record.id, {text: 'kept across restart'});
  const keptId = (await session.api(`/records/${record.id}`)).data.attempts[0].recordingId;
  await session.api(`/records/${record.id}/transcription`, upload('never submitted'));
  const pendingId = Object.values((await workspace(session.api)).recordings).find(entry => entry.state === 'pending').id;
  // A crash can leave a file with no reference at all.
  await writeFile(join(directory, 'recordings', 'orphan-file.webm'), Buffer.from('stray'));
  assert.equal((await files(directory)).length, 3);
  await session.close();

  session = await open();
  t.after(() => session.close());
  const remaining = await files(directory);
  assert.equal(remaining.length, 1, `expected only the retained recording, got ${remaining}`);
  assert.ok(remaining[0].startsWith(keptId));
  assert.deepEqual(Object.keys((await workspace(session.api)).recordings), [keptId]);
  const playback = await fetch(`${session.base}/api/recordings/${keptId}`);
  assert.equal(playback.status, 200);
  assert.deepEqual(Buffer.from(await playback.arrayBuffer()), Buffer.from(upload('kept across restart').audio, 'base64'));
  assert.equal((await fetch(`${session.base}/api/recordings/${pendingId}`)).status, 404);
});

test('playback refuses unknown ids, cross-origin requests and a reference whose file vanished', async t => {
  const {api, directory, base} = await harness(t, undefined, {speechProvider: speaking()});
  const {record} = await setup(api);
  await submitSpoken(api, record.id, {text: 'spoken answer'});
  const id = (await api(`/records/${record.id}`)).data.attempts[0].recordingId;

  assert.equal((await fetch(`${base}/api/recordings/00000000-0000-0000-0000-000000000000`)).status, 404);
  assert.equal((await fetch(`${base}/api/recordings/../workspace.json`)).status, 404);
  assert.equal((await fetch(`${base}/api/recordings/${id}`, {headers: {Origin: 'http://evil.example'}})).status, 403);

  // A reference whose file vanished reads as unavailable, not as a broken stream.
  await rm(join(directory, 'recordings', (await files(directory))[0]));
  const gone = await fetch(`${base}/api/recordings/${id}`);
  assert.equal(gone.status, 404);
  assert.match((await gone.json()).error, /找不到|deleted|available/i);
});
