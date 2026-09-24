import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './helpers.js';
import {checkAnalysis} from '../evaluation/checks.js';
import {jobGroundedAnalysis} from '../evaluation/job-grounded-analysis.js';

test('offline evaluation validates and selects only job-grounded questions from the served set', async t => {
  const {api}=await harness(t);
  const job={text:'Build reliable Python APIs.\nExplain engineering trade-offs.',absentRequirements:[]};
  const snapshot=(await api('/snapshots',{text:job.text})).data;
  const served=(await api(`/snapshots/${snapshot.id}/analysis`,{})).data;
  assert.equal(served.questions[0].id,'self-introduction');
  assert.throws(()=>checkAnalysis(served,job),'the served view itself is not model output');
  const grounded=jobGroundedAnalysis(served);
  checkAnalysis(grounded,job);
  assert.deepEqual(grounded,(await api('/workspace')).data.analyses[snapshot.id]);
  for(const category of ['role-fit','experience-depth','behavioral','technical-communication']) {
    const selected=grounded.questions.find(question => question.category === category);
    assert.ok(selected);
    assert.notEqual(selected.id,'self-introduction');
    assert.equal(selected.source,undefined);
  }
});
