import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness,setup} from './helpers.js';

async function completed(api,record,focusPoint='用具體例子支持你的做法',transcript='I would measure latency and compare the plans.'){
  await api(`/records/${record.id}/attempts`,{transcript});
  await api(`/records/${record.id}/feedback`,{});
  await api(`/records/${record.id}/complete`,{focusPoint});
  return (await api(`/records/${record.id}`)).data;
}

test('a saved Focus Point starts a new same-JD practice with source attribution',async t=>{
  const {api}=await harness(t);const {snapshot,record}=await setup(api);
  const source=await completed(api,record);
  const created=(await api('/records/from-focus',{recordId:source.id})).data;
  assert.equal(created.snapshotId,snapshot.id,'same Job Snapshot');
  assert.notEqual(created.id,source.id);
  assert.equal(created.status,'answer');
  assert.deepEqual(created.attempts,[]);
  assert.equal(created.focusPoint,null);
  assert.equal(created.focusOrigin.recordId,source.id);
  assert.equal(created.focusOrigin.focusPoint,'用具體例子支持你的做法');
  assert.equal(created.focusOrigin.questionId,source.question.id);
});

test('starting a Focus Point practice never overwrites the source record or its resume version',async t=>{
  const {api}=await harness(t);const {record}=await setup(api);
  const source=await completed(api,record);
  const before=structuredClone(source);
  await api('/records/from-focus',{recordId:source.id});
  const after=(await api(`/records/${source.id}`)).data;
  assert.deepEqual(after.attempts,before.attempts,'source answers preserved');
  assert.equal(after.status,'completed');
  assert.equal(after.focusPoint,before.focusPoint);
  const snap=(await api(`/snapshots/${source.snapshotId}`)).data;
  assert.equal(snap.id,source.snapshotId,'frozen Job Snapshot / resume version unchanged');
});

test('Focus Point practice requires a completed practice with a Focus Point',async t=>{
  const {api}=await harness(t);const {record}=await setup(api);
  assert.equal((await api('/records/from-focus',{recordId:record.id})).status,409);
  assert.equal((await api('/records/from-focus',{recordId:'missing'})).status,404);
});

test('the new Focus Point practice can complete and shows an evidence-grounded outcome',async t=>{
  const {api}=await harness(t);const {record}=await setup(api);
  const source=await completed(api,record);
  const created=(await api('/records/from-focus',{recordId:source.id})).data;
  await api(`/records/${created.id}/attempts`,{transcript:'This time I add a concrete example about indexing costs.'});
  const withFeedback=(await api(`/records/${created.id}/feedback`,{})).data;
  assert.ok(withFeedback.attempts.at(-1).feedback.priorityImprovement.quote,'evidence-grounded priority quote present');
  const done=(await api(`/records/${created.id}/complete`,{focusPoint:'持續用可驗證的例子'})).data;
  assert.equal(done.status,'completed');
  // Source attribution survives completion for the progress display.
  assert.equal(done.focusOrigin.recordId,source.id);
});

test('the new practice prefers a different question in the same category (a new scenario)',async t=>{
  const {api}=await harness(t);const {snapshot,analysis,record}=await setup(api);
  const source=await completed(api,record);
  const created=(await api('/records/from-focus',{recordId:source.id})).data;
  const sourceCategory=source.question.category;
  assert.equal(created.question.category,sourceCategory,'stays in the same capability category');
  assert.notEqual(created.question.id,source.question.id,'presents a fresh scenario question');
  assert.ok(analysis.questions.some(q=>q.id===created.question.id),'question comes from the same Job Snapshot set');
});
