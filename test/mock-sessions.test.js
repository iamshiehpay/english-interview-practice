import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {harness, setup} from './helpers.js';
import {FakeLanguageModel} from '../src/providers.js';

const audio = text => ({audio: Buffer.from(text.padEnd(64, '.')).toString('base64'), mimeType: 'audio/webm'});
const speaking = (transcript = 'I would clarify the goal before deciding.') => ({name: 'fixture speech', async transcribe() { return {transcript}; }});
const files = directory => readdir(join(directory, 'recordings'));

async function startSession(api) {
  const {snapshot} = await setup(api);
  const session = (await api('/mock-sessions', {snapshotId: snapshot.id})).data;
  return {snapshot, session};
}
const answer = (api, session, entryId, transcript) => api(`/mock-sessions/${session.id}/answer`, {entryId, transcript});
const skip = (api, session, entryId) => api(`/mock-sessions/${session.id}/skip`, {entryId});
const reload = (api, session) => api(`/mock-sessions/${session.id}`).then(r => r.data);

test('a session draws three questions from three categories and freezes the resume version', async t => {
  const {api} = await harness(t);
  await api('/resume', {name: 'Practice resume', text: 'Built a Python task manager.'});
  const snapshot = (await api('/snapshots', {text: 'Build reliable Python APIs.\nExplain engineering trade-offs.', useResume: true})).data;
  await api(`/snapshots/${snapshot.id}/analysis`, {});

  const session = (await api('/mock-sessions', {snapshotId: snapshot.id})).data;
  assert.equal(session.status, 'in-progress');
  assert.equal(session.entries.length, 3);
  assert.equal(session.entries[0].question.id, 'self-introduction');
  assert.equal(session.entries[0].question.source, 'common');
  assert.equal(session.entries[0].question.text, 'Tell me about yourself.');
  assert.equal(new Set(session.entries.map(entry => entry.question.category)).size, 3, 'three different Question Categories');
  assert.equal(new Set(session.entries.map(entry => entry.question.id)).size, 3);
  const stored=(await api('/workspace')).data.analyses[snapshot.id].questions;
  assert.ok(session.entries.slice(1).every(entry => stored.some(question => question.id === entry.question.id)), 'remaining questions are Job-grounded');
  assert.ok(session.entries.slice(1).every(entry => entry.question.source !== 'common'));
  assert.equal(session.resume.text, 'Built a Python task manager.');
  assert.equal(session.currentPosition, 1);
  assert.equal(session.currentEntryId, session.entries[0].id);

  // A second unfinished session on the same job is refused.
  assert.equal((await api('/mock-sessions', {snapshotId: snapshot.id})).status, 409);
  // A job with no Question Set is refused with an actionable message.
  const bare = (await api('/snapshots', {text: 'Another posting for a different role.'})).data;
  const refused = await api('/mock-sessions', {snapshotId: bare.id});
  assert.equal(refused.status, 409);
  assert.match(refused.data.error, /題目|Question Set/i);
});

test('repeated short mocks draw only the introduction from Common Questions',async t=>{
  const {api}=await harness(t);
  const {snapshot}=await setup(api);
  for(let i=0;i<6;i++){
    const response=await api('/mock-sessions',{snapshotId:snapshot.id});
    assert.equal(response.status,200);
    const session=response.data;
    assert.equal(session.entries[0].question.id,'self-introduction');
    assert.ok(session.entries.slice(1).every(entry=>entry.question.source!=='common'));
    assert.equal((await api(`/mock-sessions/${session.id}`,undefined,'DELETE')).status,200);
  }
});

test('a session prefers unpractised questions and refuses a Question Set with too few categories', async t => {
  const narrow = new FakeLanguageModel();
  const original = narrow.analyze.bind(narrow);
  narrow.analyze = async args => { const result = await original(args); result.questions = result.questions.map(q => ({...q, category: 'role-fit'})); return result; };
  const {api} = await harness(t, narrow);
  const snapshot = (await api('/snapshots', {text: 'Build reliable Python APIs.\nExplain trade-offs.'})).data;
  assert.equal((await api(`/snapshots/${snapshot.id}/analysis`, {})).status, 502, 'the Question Set validator already requires all four categories');

  // With a normal Question Set, a question already practised is avoided.
  const {api: plain} = await harness(t);
  const {snapshot: job, analysis} = await setup(plain);
  const practisedQuestion=analysis.questions.find(question => question.category === 'experience-depth');
  const record=(await plain('/records',{snapshotId:job.id,questionId:practisedQuestion.id})).data;
  await plain(`/records/${record.id}/attempts`, {transcript: 'I would start by clarifying the requirements.'});
  const session = (await plain('/mock-sessions', {snapshotId: job.id})).data;
  assert.ok(!session.entries.some(entry => entry.question.id === practisedQuestion.id) || analysis.questions.filter(q => q.category === practisedQuestion.category).length === 1,
    'the already-practised question is avoided when its category has an alternative');
});

test('answers advance in order, are immutable, and submission is idempotent', async t => {
  const {api} = await harness(t);
  const {session} = await startSession(api);
  const [first, second, third] = session.entries;

  assert.equal((await answer(api, session, second.id, 'Out of order.')).status, 409, 'answering out of order is refused');
  const after = (await api(`/mock-sessions/${session.id}/answer`, {entryId: first.id, transcript: 'I would clarify the goal first.', submissionId: 'submission-one'})).data;
  assert.equal(after.answeredCount, 1);
  assert.equal(after.currentEntryId, second.id);
  assert.equal(after.currentPosition, 2);
  assert.equal(after.entries[0].feedback, null, 'no Feedback Report between questions');

  // The same submission identifier replays without adding a second answer.
  const replay = (await api(`/mock-sessions/${session.id}/answer`, {entryId: first.id, transcript: 'I would clarify the goal first.', submissionId: 'submission-one'})).data;
  assert.equal(replay.answeredCount, 1);
  assert.equal((await api(`/mock-sessions/${session.id}/answer`, {entryId: first.id, transcript: 'Different text.', submissionId: 'submission-one'})).status, 409);
  assert.equal((await answer(api, session, first.id, 'Replacing my answer.')).status, 409, 'a submitted session answer cannot be replaced');
  assert.equal((await answer(api, session, second.id, '   ')).status, 400);

  await answer(api, session, second.id, 'I would compare two approaches and name the trade-off.');
  const skipped = (await skip(api, session, third.id)).data;
  assert.equal(skipped.status, 'awaiting-summary');
  assert.equal(skipped.skippedCount, 1);
  assert.equal(skipped.entries[2].skipped, true);
  assert.equal(skipped.entries[2].answer, null);
  assert.equal(skipped.currentEntryId, null);
});

test('assistance is refused during a session and available once it ends', async t => {
  const {api} = await harness(t);
  const {session} = await startSession(api);
  const [first, second, third] = session.entries;
  await answer(api, session, first.id, 'I would clarify the goal. Then I would test the riskiest assumption.');

  for (const action of ['feedback', 'corrections', 'coaching']) {
    const refused = await api(`/mock-sessions/${session.id}/entries/${first.id}/${action}`, {mode: 'rewrite'});
    assert.equal(refused.status, 409, `${action} must be refused during a session`);
    assert.match(refused.data.error, /結束|after the mock session/i);
  }

  await answer(api, session, second.id, 'I would explain the trade-off to a non-specialist first.');
  await skip(api, session, third.id);
  const completed = (await api(`/mock-sessions/${session.id}/summary`, {})).data;
  assert.equal(completed.status, 'completed');

  const feedback = (await api(`/mock-sessions/${session.id}/entries/${first.id}/feedback`, {})).data;
  assert.deepEqual(Object.keys(feedback.feedback.ratings).sort(), ['englishExpression', 'relevance', 'structure', 'support']);
  assert.ok(first.question.text);
  const corrections = (await api(`/mock-sessions/${session.id}/entries/${first.id}/corrections`, {})).data;
  assert.ok(Array.isArray(corrections.corrections));
  const rewrite = (await api(`/mock-sessions/${session.id}/entries/${first.id}/coaching`, {mode: 'rewrite'})).data;
  assert.equal(rewrite.mode, 'rewrite');
  assert.equal((await api(`/mock-sessions/${session.id}/entries/${first.id}/coaching`, {mode: 'illustrative'})).status, 400, 'only a rewrite is offered for a session answer');

  // A skipped question is never assessed and never gets a fabricated rating.
  assert.equal((await api(`/mock-sessions/${session.id}/entries/${third.id}/feedback`, {})).status, 409);
  const stored = await reload(api, session);
  assert.equal(stored.entries[2].feedback, null);
  assert.equal(stored.entries[1].feedback, null, 'per-question feedback is generated only when opened');
});

test('the Session Summary quotes one of the learner own answers and rejects anything else', async t => {
  const inventing = new FakeLanguageModel();
  inventing.mockSummary = async () => ({strength: {text: 'You did well.', textZh: '你表現不錯。', quote: 'a sentence the learner never said'}, priorityImprovement: {text: 'Add an example.', textZh: '請補一個例子。', quote: 'also never said'}});
  const {api} = await harness(t, inventing);
  const {session} = await startSession(api);
  for (const entry of session.entries) await answer(api, session, entry.id, `I would handle ${entry.question.category} by naming my assumption first.`);

  const refused = await api(`/mock-sessions/${session.id}/summary`, {});
  assert.equal(refused.status, 502, 'a quote the learner never said is invalid provider output');
  const intact = await reload(api, session);
  assert.equal(intact.answeredCount, 3);
  assert.equal(intact.summary, null);
  assert.equal(intact.status, 'awaiting-summary', 'the session stays retryable with its answers intact');

  // A well-behaved provider completes the session.
  inventing.mockSummary = new FakeLanguageModel().mockSummary;
  const completed = (await api(`/mock-sessions/${session.id}/summary`, {})).data;
  assert.equal(completed.status, 'completed');
  assert.ok(Date.parse(completed.completedAt));
  const transcripts = completed.entries.map(entry => entry.answer.transcript);
  for (const finding of [completed.summary.strength, completed.summary.priorityImprovement]) {
    assert.ok(transcripts.some(transcript => transcript.includes(finding.quote)), 'the summary must quote a session answer verbatim');
    assert.match(finding.textZh, /\p{Script=Han}/u);
    assert.match(finding.text, /\p{Script=Latin}/u);
  }
  assert.deepEqual(Object.keys(completed.summary).sort(), ['priorityImprovement', 'strength'], 'no score, grade or verdict');
  // Requesting the summary again replays it rather than calling the provider twice.
  assert.deepEqual((await api(`/mock-sessions/${session.id}/summary`, {})).data.summary, completed.summary);
});

test('a session where every question was skipped completes honestly with no provider call', async t => {
  let calls = 0;
  const counting = new FakeLanguageModel();
  counting.mockSummary = async () => { calls++; return {strength: {text: 'x', textZh: '一', quote: 'x'}, priorityImprovement: {text: 'y', textZh: '二', quote: 'y'}}; };
  const {api} = await harness(t, counting);
  const {session} = await startSession(api);
  for (const entry of session.entries) await skip(api, session, entry.id);

  const completed = (await api(`/mock-sessions/${session.id}/summary`, {})).data;
  assert.equal(completed.status, 'completed');
  assert.deepEqual(completed.summary, {nothingToAssess: true});
  assert.equal(calls, 0, 'an all-skipped session makes no model call');
  assert.equal(completed.skippedCount, 3);
});

test('a summary covering skipped questions works and a provider failure keeps the answers', async t => {
  let fail = true;
  const flaky = new FakeLanguageModel();
  const good = flaky.mockSummary.bind(flaky);
  flaky.mockSummary = async args => { if (fail) throw Error('outage'); return good(args); };
  const {api} = await harness(t, flaky);
  const {session} = await startSession(api);
  await answer(api, session, session.entries[0].id, 'I would name the assumption and test it with a small experiment.');
  await skip(api, session, session.entries[1].id);
  await skip(api, session, session.entries[2].id);

  assert.equal((await api(`/mock-sessions/${session.id}/summary`, {})).status, 502);
  const afterFailure = await reload(api, session);
  assert.equal(afterFailure.answeredCount, 1);
  assert.equal(afterFailure.status, 'awaiting-summary');

  fail = false;
  const completed = (await api(`/mock-sessions/${session.id}/summary`, {})).data;
  assert.equal(completed.status, 'completed');
  assert.ok(completed.entries[0].answer.transcript.includes(completed.summary.strength.quote));
});

test('a session can be resumed, abandoned, and never touches a Practice Record', async t => {
  const {api} = await harness(t);
  const {snapshot, analysis, record} = await setup(api);
  await api(`/records/${record.id}/attempts`, {transcript: 'My existing practice answer stays exactly as it is.'});
  await api(`/records/${record.id}/feedback`, {});
  const recordBefore = (await api(`/records/${record.id}`)).data;
  const progressBefore = (await api('/progress')).data;

  const session = (await api('/mock-sessions', {snapshotId: snapshot.id})).data;
  await answer(api, session, session.entries[0].id, 'I would start by restating the problem in my own words.');

  // Resuming reads the saved state and lands on the next unanswered question.
  const resumed = await reload(api, session);
  assert.equal(resumed.currentEntryId, session.entries[1].id);
  assert.equal(resumed.currentPosition, 2);
  assert.equal(resumed.status, 'in-progress');
  assert.equal((await api('/mock-sessions')).data.filter(s => s.status === 'in-progress').length, 1);

  assert.deepEqual((await api(`/records/${record.id}`)).data, recordBefore, 'an existing Practice Record is byte-identical');
  assert.deepEqual((await api('/progress')).data, progressBefore, 'a session contributes nothing to the progress view');
  assert.equal(Object.keys((await api('/workspace')).data.records).length, 1, 'a session creates no Practice Records');
  assert.ok(analysis.questions.length >= 8);

  assert.equal((await api(`/mock-sessions/${session.id}`, undefined, 'DELETE')).status, 200);
  assert.equal((await api(`/mock-sessions/${session.id}`)).status, 404);
  assert.deepEqual((await api(`/records/${record.id}`)).data, recordBefore);
});

test('a session answer can be spoken, replayed, and is deleted with the session and the job', async t => {
  const {api, directory, base} = await harness(t, undefined, {speechProvider: speaking()});
  const {snapshot, session} = await startSession(api);
  const entry = session.entries[0];

  const draft = (await api(`/mock-sessions/${session.id}/entries/${entry.id}/transcription`, audio('session take'))).data;
  assert.equal(draft.entryId, entry.id);
  const saved = (await api(`/mock-sessions/${session.id}/answer`, {entryId: entry.id, transcript: draft.transcript, transcriptDraftId: draft.id})).data;
  assert.equal(saved.entries[0].answer.inputMode, 'voice');
  assert.equal(saved.entries[0].answer.recordingId, draft.recordingId);
  assert.equal(saved.transcriptDraft, undefined);

  const playback = await fetch(`${base}/api/recordings/${draft.recordingId}`);
  assert.equal(playback.status, 200);
  assert.deepEqual(Buffer.from(await playback.arrayBuffer()), Buffer.from(audio('session take').audio, 'base64'));
  assert.equal((await files(directory)).length, 1);

  // Skipping the next question discards an unsubmitted recording.
  await api(`/mock-sessions/${session.id}/entries/${session.entries[1].id}/transcription`, audio('never submitted'));
  assert.equal((await files(directory)).length, 2);
  await skip(api, session, session.entries[1].id);
  assert.equal((await files(directory)).length, 1);

  assert.equal((await api(`/snapshots/${snapshot.id}`, undefined, 'DELETE')).status, 200);
  assert.deepEqual(await files(directory), [], 'deleting the job deletes the session recordings');
  assert.equal((await api(`/mock-sessions/${session.id}`)).status, 404);
  assert.deepEqual((await api('/workspace')).data.recordings, {});
});

test('deleting all local data removes sessions and their recordings', async t => {
  const {api, directory} = await harness(t, undefined, {speechProvider: speaking()});
  const {session} = await startSession(api);
  const draft = (await api(`/mock-sessions/${session.id}/entries/${session.entries[0].id}/transcription`, audio('kept take'))).data;
  await api(`/mock-sessions/${session.id}/answer`, {entryId: session.entries[0].id, transcript: draft.transcript, transcriptDraftId: draft.id});
  assert.equal((await files(directory)).length, 1);

  assert.equal((await api('/workspace/delete', {confirmation: 'DELETE ALL LOCAL DATA'})).status, 200);
  assert.deepEqual(await files(directory), []);
  assert.deepEqual((await api('/mock-sessions')).data, []);
});
