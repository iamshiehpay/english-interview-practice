import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {harness,setup} from './helpers.js';
import {FakeLanguageModel} from '../src/providers.js';

test('complete text loop, immutable snapshot, evidence comparison and real process restart',async t=>{
  const {api,directory,server}=await harness(t);
  assert.equal((await api('/health')).data.status,'ok');
  const {snapshot,analysis,record}=await setup(api);
  assert.equal(snapshot.sourceType,'pasted-jd');assert.ok(Date.parse(snapshot.capturedAt));
  assert.equal(analysis.capabilities.length,2);assert.equal(analysis.questions.length,8);
  assert.equal((await api(`/snapshots/${snapshot.id}`,{text:'changed'},'PUT')).status,404);
  assert.deepEqual((await api(`/snapshots/${snapshot.id}`)).data,snapshot);
  assert.equal((await api(`/records/${record.id}/reference`)).status,409);
  assert.equal((await api(`/records/${record.id}/complete`,{focusPoint:'too early'})).status,409);
  for(const transcript of ['I would build a Python API.','I would validate requests and test failures because reliability matters.']){
    assert.equal((await api(`/records/${record.id}/attempts`,{transcript})).status,200);
    const response=await api(`/records/${record.id}/feedback`,{});assert.equal(response.status,200);
    const f=response.data.attempts.at(-1).feedback;
    assert.deepEqual(Object.keys(f.ratings),['relevance','support','structure','englishExpression']);
    for(const rating of Object.values(f.ratings)){assert.ok(transcript.includes(rating.quote));assert.ok(rating.level>=1&&rating.level<=4);}
    assert.ok(transcript.includes(f.strength.quote));assert.ok(transcript.includes(f.priorityImprovement.quote));
    if(response.data.attempts.length===1)assert.equal((await api(`/records/${record.id}/reference`)).status,409);
  }
  assert.equal((await api(`/records/${record.id}/reference`)).status,200);
  assert.equal((await api(`/records/${record.id}/comparison`)).data.attempts.length,2);
  const saved=(await api(`/records/${record.id}/complete`,{focusPoint:'Explain trade-offs with an example'})).data;
  assert.equal(saved.status,'completed');
  assert.equal(saved.comparison.attemptIds.length,2);
  await new Promise(r=>server.close(r));
  const child=spawn(process.execPath,['src/server.js'],{env:{...process.env,WORKSPACE_DIR:directory,PORT:'0'},stdio:['ignore','pipe','pipe']});
  t.after(()=>child.kill());
  const url=await new Promise((resolve,reject)=>{child.stdout.on('data',d=>{const match=d.toString().match(/http:\/\/127.0.0.1:\d+/);if(match)resolve(match[0]);});child.on('error',reject);child.on('exit',code=>reject(Error('startup exited '+code)));});
  assert.deepEqual(await (await fetch(url+`/api/records/${record.id}`)).json(),saved);
  assert.deepEqual(await (await fetch(url+`/api/snapshots/${snapshot.id}`)).json(),snapshot);
});
test('malformed analysis is rejected atomically and can be retried',async t=>{
  const provider=new FakeLanguageModel(), original=provider.analyze.bind(provider);
  let bad=true;provider.analyze=async args=>{const v=await original(args);if(bad)v.capabilities[0].evidence='absent quote';return v;};
  const {api}=await harness(t,provider);
  const snapshot=(await api('/snapshots',{text:'Build APIs'})).data;
  assert.equal((await api(`/snapshots/${snapshot.id}/analysis`,{})).status,502);
  assert.deepEqual((await api(`/snapshots/${snapshot.id}`)).data,snapshot);
  assert.deepEqual((await api('/workspace')).data.analyses,{});
  bad=false;assert.equal((await api(`/snapshots/${snapshot.id}/analysis`,{})).status,200);
});
test('invalid feedback quotes preserve the attempt and retry without duplication',async t=>{
  const provider=new FakeLanguageModel(), original=provider.feedback.bind(provider);
  let bad=true;provider.feedback=async args=>{const v=await original(args);if(bad)v.ratings.support.quote='not in answer';return v;};
  const {api}=await harness(t,provider);const {record}=await setup(api);
  await api(`/records/${record.id}/attempts`,{transcript:'My approach begins with testing.'});
  assert.equal((await api(`/records/${record.id}/feedback`,{})).status,502);
  const partial=(await api(`/records/${record.id}`)).data;assert.equal(partial.attempts.length,1);assert.equal(partial.attempts[0].feedback,null);
  assert.equal((await api(`/records/${record.id}/attempts`,{transcript:'premature'})).status,409);
  bad=false;assert.equal((await api(`/records/${record.id}/feedback`,{})).status,200);
  assert.equal((await api(`/records/${record.id}/feedback`,{})).data.attempts.length,1);
});
test('blank input and malformed schemas do not create domain state',async t=>{
  const provider=new FakeLanguageModel();provider.analyze=async()=>({capabilities:null});const {api}=await harness(t,provider);
  assert.equal((await api('/snapshots',{text:'  '})).status,400);
  const s=(await api('/snapshots',{text:'Build APIs'})).data;
  assert.equal((await api(`/snapshots/${s.id}/analysis`,{})).status,502);
  assert.deepEqual((await api('/workspace')).data.records,{});
});
test('provider schema matrix rejects unsupported links, categories and rating values',async t=>{
  const provider=new FakeLanguageModel();const analyze=provider.analyze.bind(provider),feedback=provider.feedback.bind(provider);
  const {api}=await harness(t,provider);
  for(const mutate of [v=>{v.questions[0].capabilityIds=['missing'];},v=>{v.questions[0].category='pronunciation';},v=>{v.questions[0].evidence='absent';},v=>{v.capabilities[0].kind='employer-belief';}]){
    provider.analyze=async args=>{const v=await analyze(args);mutate(v);return v;};
    const s=(await api('/snapshots',{text:'Build APIs'})).data;
    assert.equal((await api(`/snapshots/${s.id}/analysis`,{})).status,502);
    assert.deepEqual((await api(`/snapshots/${s.id}`)).data,s);
  }
  provider.analyze=analyze;const {record}=await setup(api);
  await api(`/records/${record.id}/attempts`,{transcript:'I explain a trade-off.'});
  for(const mutate of [v=>{v.ratings.relevance.level=5;},v=>{delete v.ratings.support;},v=>{v.strength.quote='Build APIs';},v=>{v.priorityImprovement=null;}]){
    provider.feedback=async args=>{const v=await feedback(args);mutate(v);return v;};
    assert.equal((await api(`/records/${record.id}/feedback`,{})).status,502);
    assert.equal((await api(`/records/${record.id}`)).data.attempts[0].feedback,null);
  }
});
test('pre-revision model answer fields cannot cross the schema boundary',async t=>{
  const provider=new FakeLanguageModel(), original=provider.feedback.bind(provider);
  const {api}=await harness(t,provider);const {record}=await setup(api);
  await api(`/records/${record.id}/attempts`,{transcript:'I would test failure cases.'});
  for(const nested of [false,true]){
    provider.feedback=async args=>{const v=await original(args);if(nested)v.priorityImprovement.sampleAnswer='A full sample answer';else v.referenceAnswer='A full reference answer';return v;};
    assert.equal((await api(`/records/${record.id}/feedback`,{})).status,502);
    assert.equal((await api(`/records/${record.id}`)).data.attempts[0].feedback,null);
    assert.equal((await api(`/records/${record.id}/reference`)).status,409);
  }
});
