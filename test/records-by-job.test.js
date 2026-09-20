import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './helpers.js';

async function jobWithRecord(api, text) {
  const snapshot = (await api('/snapshots', {text})).data;
  const analysis = (await api(`/snapshots/${snapshot.id}/analysis`, {})).data;
  const record = (await api('/records', {snapshotId: snapshot.id, questionId: analysis.questions[0].id})).data;
  return {snapshot, analysis, record};
}

test('a job can be renamed and cleared without touching its posting or records', async t => {
  const {api} = await harness(t);
  const {snapshot, record} = await jobWithRecord(api, 'Build reliable Python APIs.\nOperate services.');
  const renamed = (await api(`/snapshots/${snapshot.id}/title`, {title: '  Senior Backend @ Acme  '})).data;
  assert.equal(renamed.title, 'Senior Backend @ Acme', 'title is trimmed and stored');
  assert.equal(renamed.text, snapshot.text, 'posting text unchanged');
  assert.equal((await api(`/records/${record.id}`)).data.id, record.id, 'record preserved');
  const cleared = (await api(`/snapshots/${snapshot.id}/title`, {title: '   '})).data;
  assert.equal(cleared.title, undefined, 'empty title clears the custom name');
});

test('rename rejects invalid input and unknown jobs', async t => {
  const {api} = await harness(t);
  const {snapshot} = await jobWithRecord(api, 'Build services.');
  assert.equal((await api(`/snapshots/${snapshot.id}/title`, {title: 'x'.repeat(121)})).status, 400);
  assert.equal((await api(`/snapshots/${snapshot.id}/title`, {title: 42})).status, 400);
  assert.equal((await api('/snapshots/missing/title', {title: 'x'})).status, 404);
});

test('deleting one job leaves other jobs and their records intact', async t => {
  const {api} = await harness(t);
  const one = await jobWithRecord(api, 'Job one: Python APIs.');
  const two = await jobWithRecord(api, 'Job two: Kubernetes operations.');
  await api(`/snapshots/${one.snapshot.id}`, undefined, 'DELETE');
  const workspace = (await api('/workspace')).data;
  assert.equal(workspace.snapshots[one.snapshot.id], undefined, 'deleted job removed');
  assert.ok(workspace.snapshots[two.snapshot.id], 'unrelated job kept');
  assert.ok(workspace.records[two.record.id], 'unrelated record kept');
  assert.equal(workspace.records[one.record.id], undefined, 'deleted job records removed');
});
