import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {harness, setup} from './helpers.js';

const audio = text => ({audio: Buffer.from(text.padEnd(64, '.')).toString('base64'), mimeType: 'audio/webm'});
const speaking = (transcript = 'I would compare the two designs before deciding.') => ({name: 'fixture speech', async transcribe() { return {transcript}; }});
const files = directory => readdir(join(directory, 'recordings'));

async function primaryAnswer(api, recordId, text = 'primary take') {
  const draft = (await api(`/records/${recordId}/transcription`, audio(text))).data;
  await api(`/records/${recordId}/attempts`, {transcript: draft.transcript, transcriptDraftId: draft.id});
  await api(`/records/${recordId}/feedback`, {});
  return draft;
}

test('a follow-up answer can be spoken and keeps its own recording', async t => {
  const {api, directory, base} = await harness(t, undefined, {speechProvider: speaking()});
  const {record} = await setup(api);
  await primaryAnswer(api, record.id, 'primary take');
  const node = (await api(`/records/${record.id}/follow-ups`, {})).data;

  const draft = (await api(`/records/${record.id}/follow-ups/${node.id}/transcription`, audio('follow-up take'))).data;
  assert.equal(draft.inputMode, 'voice');
  assert.ok(draft.recordingId);
  // The draft belongs to the follow-up node, never to the practice record.
  const midway = (await api(`/records/${record.id}`)).data;
  assert.equal(midway.transcriptDraft, undefined, 'a follow-up recording must not create a primary transcript draft');
  assert.equal(midway.followUps[0].transcriptDraft.id, draft.id);
  assert.equal(midway.attempts.length, 1, 'a follow-up recording must not become a primary answer');

  const saved = (await api(`/records/${record.id}/follow-ups/${node.id}/attempt`, {transcript: draft.transcript, transcriptDraftId: draft.id})).data;
  assert.equal(saved.attempt.inputMode, 'voice');
  assert.equal(saved.attempt.recordingId, draft.recordingId);
  assert.equal(saved.attempt.transcriptEdited, false);
  assert.equal(saved.transcriptDraft, undefined, 'the draft is consumed by the answer');

  const after = (await api('/workspace')).data;
  assert.equal(after.recordings[draft.recordingId].state, 'retained');
  assert.equal(after.recordings[draft.recordingId].followUpId, node.id);
  assert.notEqual(after.records[record.id].attempts[0].recordingId, draft.recordingId, 'the follow-up recording must not land on the primary attempt');

  const playback = await fetch(`${base}/api/recordings/${draft.recordingId}`);
  assert.equal(playback.status, 200);
  assert.deepEqual(Buffer.from(await playback.arrayBuffer()), Buffer.from(audio('follow-up take').audio, 'base64'));
  assert.equal((await files(directory)).length, 2, 'the primary and follow-up recordings are both kept');
});

test('two follow-ups keep separate recordings and a revision keeps its own', async t => {
  const {api, directory} = await harness(t, undefined, {speechProvider: speaking()});
  const {record} = await setup(api);
  await primaryAnswer(api, record.id, 'primary take');

  const spokenFollowUp = async text => {
    const node = (await api(`/records/${record.id}/follow-ups`, {})).data;
    const draft = (await api(`/records/${record.id}/follow-ups/${node.id}/transcription`, audio(text))).data;
    await api(`/records/${record.id}/follow-ups/${node.id}/attempt`, {transcript: draft.transcript, transcriptDraftId: draft.id});
    await api(`/records/${record.id}/follow-ups/${node.id}/feedback`, {});
    return draft.recordingId;
  };
  const first = await spokenFollowUp('follow-up one');
  const second = await spokenFollowUp('follow-up two');
  assert.notEqual(first, second);

  // A same-question revision is also spoken and gets a third distinct recording.
  const revision = (await api(`/records/${record.id}/transcription`, audio('revision take'))).data;
  await api(`/records/${record.id}/attempts`, {transcript: revision.transcript + ' And I would then measure it.', transcriptDraftId: revision.id});
  await api(`/records/${record.id}/feedback`, {});

  const saved = (await api(`/records/${record.id}`)).data;
  assert.equal(saved.attempts.length, 2);
  assert.equal(saved.attempts[1].transcriptEdited, true);
  const ids = [saved.attempts[0].recordingId, saved.attempts[1].recordingId, first, second];
  assert.equal(new Set(ids).size, 4, 'every answer keeps its own recording');
  assert.equal((await files(directory)).length, 4);

  // Deleting the practice removes primary, revision and follow-up recordings together.
  await api(`/records/${record.id}`, undefined, 'DELETE');
  assert.deepEqual(await files(directory), []);
  assert.deepEqual((await api('/workspace')).data.recordings, {});
});

test('a follow-up transcript draft survives a reload and can be edited before submitting', async t => {
  const {api} = await harness(t, undefined, {speechProvider: speaking('I would check the logs.')});
  const {record} = await setup(api);
  await primaryAnswer(api, record.id);
  const node = (await api(`/records/${record.id}/follow-ups`, {})).data;
  const draft = (await api(`/records/${record.id}/follow-ups/${node.id}/transcription`, audio('spoken follow-up'))).data;

  // Reloading reads the saved state, exactly as the browser does.
  const reloaded = (await api(`/records/${record.id}`)).data.followUps[0];
  assert.equal(reloaded.transcriptDraft.transcript, 'I would check the logs.');

  const edited = 'I would check the logs and then reproduce the failure locally.';
  const saved = (await api(`/records/${record.id}/follow-ups/${node.id}/attempt`, {transcript: edited, transcriptDraftId: draft.id})).data;
  assert.equal(saved.attempt.transcript, edited);
  assert.equal(saved.attempt.transcriptEdited, true);
  assert.equal(saved.attempt.recordingId, draft.recordingId);
});

test('follow-up recording preconditions and failures leave saved state untouched', async t => {
  let fail = false;
  const {api, directory} = await harness(t, undefined, {speechProvider: {name: 'flaky', async transcribe() { if (fail) throw Error('outage'); return {transcript: 'I would validate the assumption first.'}; }}});
  const {record} = await setup(api);
  await primaryAnswer(api, record.id);
  const node = (await api(`/records/${record.id}/follow-ups`, {})).data;

  assert.equal((await api(`/records/${record.id}/follow-ups/no-such-node/transcription`, audio('x'))).status, 404);

  fail = true;
  const before = (await api(`/records/${record.id}`)).data;
  assert.equal((await api(`/records/${record.id}/follow-ups/${node.id}/transcription`, audio('failing take'))).status, 502);
  assert.deepEqual((await api(`/records/${record.id}`)).data, before, 'a failed transcription changes nothing');
  assert.equal((await files(directory)).length, 1, 'only the primary recording remains');

  fail = false;
  const draft = (await api(`/records/${record.id}/follow-ups/${node.id}/transcription`, audio('retry take'))).data;
  await api(`/records/${record.id}/follow-ups/${node.id}/attempt`, {transcript: draft.transcript, transcriptDraftId: draft.id});
  // A follow-up that already has an answer accepts no new recording.
  assert.equal((await api(`/records/${record.id}/follow-ups/${node.id}/transcription`, audio('too late'))).status, 409);
  assert.equal((await files(directory)).length, 2);
});

// Regression: a follow-up recording carries the practice's recordId as well as its own
// followUpId, so the primary-answer cleanup used to sweep it away.
test('recording a primary revision does not destroy an unsubmitted follow-up recording', async t => {
  const {api, directory} = await harness(t, undefined, {speechProvider: speaking()});
  const {record} = await setup(api);
  await primaryAnswer(api, record.id, 'primary one');
  const node = (await api(`/records/${record.id}/follow-ups`, {})).data;
  const followUp = (await api(`/records/${record.id}/follow-ups/${node.id}/transcription`, audio('follow-up take'))).data;

  // The learner goes back and re-records the primary answer instead.
  await api(`/records/${record.id}/transcription`, audio('primary revision'));
  assert.ok((await api('/workspace')).data.recordings[followUp.recordingId], 'the follow-up recording must survive');
  assert.equal((await api(`/records/${record.id}`)).data.followUps[0].transcriptDraft?.recordingId, followUp.recordingId);
  const submitted = await api(`/records/${record.id}/follow-ups/${node.id}/attempt`, {transcript: followUp.transcript, transcriptDraftId: followUp.id});
  assert.equal(submitted.status, 200, JSON.stringify(submitted.data));
  assert.equal(submitted.data.attempt.recordingId, followUp.recordingId);
  assert.equal((await files(directory)).length, 3, 'primary answer, primary revision draft and follow-up all kept');
});

test('a superseded follow-up recording is dropped and typing instead abandons it', async t => {
  const {api, directory} = await harness(t, undefined, {speechProvider: speaking()});
  const {record} = await setup(api);
  await primaryAnswer(api, record.id);
  const node = (await api(`/records/${record.id}/follow-ups`, {})).data;

  await api(`/records/${record.id}/follow-ups/${node.id}/transcription`, audio('first follow-up take'));
  await api(`/records/${record.id}/follow-ups/${node.id}/transcription`, audio('second follow-up take'));
  assert.equal((await files(directory)).length, 2, 'the superseded follow-up recording is removed');

  await api(`/records/${record.id}/follow-ups/${node.id}/attempt`, {transcript: 'I typed this follow-up answer instead.'});
  const saved = (await api(`/records/${record.id}`)).data.followUps[0];
  assert.equal(saved.attempt.inputMode, 'text');
  assert.equal(saved.attempt.recordingId, undefined);
  assert.equal(saved.transcriptDraft, undefined);
  assert.equal((await files(directory)).length, 1, 'only the primary recording remains');
});

test('completing a practice discards an unsubmitted follow-up recording', async t => {
  const {api, directory} = await harness(t, undefined, {speechProvider: speaking()});
  const {record} = await setup(api);
  await primaryAnswer(api, record.id);
  const node = (await api(`/records/${record.id}/follow-ups`, {})).data;
  await api(`/records/${record.id}/follow-ups/${node.id}/transcription`, audio('never submitted'));
  assert.equal((await files(directory)).length, 2);

  // An unanswered follow-up does not block completion; its recording goes with the draft.
  assert.equal((await api(`/records/${record.id}/complete`, {focusPoint: 'State assumptions'})).data.status, 'completed');
  assert.equal((await files(directory)).length, 1);
  assert.equal((await api(`/records/${record.id}`)).data.followUps[0].transcriptDraft, undefined);
  assert.equal(Object.values((await api('/workspace')).data.recordings).filter(entry => entry.state === 'pending').length, 0);
});

test('a Focus Point Continuation inherits the ordinary spoken answer path', async t => {
  const {api, directory, base} = await harness(t, undefined, {speechProvider: speaking()});
  const {record} = await setup(api);
  await primaryAnswer(api, record.id, 'source take');
  await api(`/records/${record.id}/complete`, {focusPoint: 'Give one concrete example'});

  const next = (await api('/records/from-focus', {recordId: record.id})).data;
  assert.equal(next.focusOrigin.recordId, record.id);
  const draft = (await api(`/records/${next.id}/transcription`, audio('continuation take'))).data;
  const saved = (await api(`/records/${next.id}/attempts`, {transcript: draft.transcript, transcriptDraftId: draft.id})).data;
  assert.equal(saved.attempts[0].inputMode, 'voice');
  assert.equal(saved.attempts[0].recordingId, draft.recordingId);
  const playback = await fetch(`${base}/api/recordings/${draft.recordingId}`);
  assert.equal(playback.status, 200);
  assert.deepEqual(Buffer.from(await playback.arrayBuffer()), Buffer.from(audio('continuation take').audio, 'base64'));
  assert.equal((await files(directory)).length, 2, 'the source practice keeps its own recording');
});
