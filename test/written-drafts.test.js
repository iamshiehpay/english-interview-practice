import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness,setup} from './helpers.js';

test('written drafts survive reload, submit once, and keep revision separate',async t=>{
  const {api}=await harness(t);const {record}=await setup(api);const path=`/records/${record.id}`;
  const saved=await api(path+'/draft',{transcript:'I would test assumptions.',attemptIndex:0});
  assert.equal(saved.status,200);
  assert.equal((await api(path)).data.attempts.length,0);
  assert.equal((await api(path)).data.writtenDraft.transcript,'I would test assumptions.');
  const input={transcript:'I would test assumptions.',submissionId:'first-submission',attemptIndex:0};
  assert.equal((await api(path+'/attempts',input)).status,200);
  assert.equal((await api(path+'/attempts',input)).data.attempts.length,1);
  assert.equal((await api(path+'/attempts',{...input,transcript:'Changed'})).status,409);
  assert.equal((await api(path+'/draft',{transcript:'Premature',attemptIndex:1})).status,409);
  await api(path+'/feedback',{});
  assert.equal((await api(path+'/draft',{transcript:'I would test failure modes because risk matters.',attemptIndex:1})).status,200);
  const r=(await api(path)).data;
  assert.equal(r.attempts[0].transcript,input.transcript);
  assert.equal(r.writtenDraft.attemptIndex,1);
  assert.equal((await api(path+'/draft',{transcript:'Stale tab',attemptIndex:0})).status,409);
  assert.equal((await api(path+'/attempts',input)).data.attempts.length,1);
  await api(path,undefined,'DELETE');
  assert.equal((await api(path+'/draft',{transcript:'Late',attemptIndex:1})).status,404);
  assert.deepEqual((await api('/workspace')).data.records,{});
});

test('drafts persist across server restart and snapshot/all deletion removes them',async t=>{
  const {api,directory,server}=await harness(t);const {snapshot,record}=await setup(api);
  await api(`/records/${record.id}/draft`,{transcript:'Last saved text',attemptIndex:0});
  await new Promise(r=>server.close(r));
  const {createApplication}=await import('../src/server.js');
  const restarted=await createApplication({directory});
  await new Promise(r=>restarted.server.listen(0,'127.0.0.1',r));
  t.after(()=>new Promise(r=>restarted.server.close(r)));
  const request=async(path,input,method)=>{
    const response=await fetch(`http://127.0.0.1:${restarted.server.address().port}/api${path}`,{method:method||(input===undefined?'GET':'POST'),headers:{'Content-Type':'application/json'},body:input===undefined?undefined:JSON.stringify(input)});
    return {status:response.status,data:await response.json()};
  };
  assert.equal((await request(`/records/${record.id}`)).data.writtenDraft.transcript,'Last saved text');
  await request(`/snapshots/${snapshot.id}`,undefined,'DELETE');
  assert.deepEqual((await request('/workspace')).data.records,{});
  const next=await setup(request);
  await request(`/records/${next.record.id}/draft`,{transcript:'Another draft',attemptIndex:0});
  await request('/workspace/delete',{confirmation:'DELETE ALL LOCAL DATA'});
  assert.deepEqual((await request('/workspace')).data.records,{});
  assert.equal((await request(`/records/${next.record.id}/draft`,{transcript:'Late autosave',attemptIndex:0})).status,404);
});

test('simultaneous submissions and stale draft writes cannot overwrite an answer',async t=>{
  const {api}=await harness(t);const {record}=await setup(api);const path=`/records/${record.id}`;
  const input={transcript:'Saved answer',submissionId:'same-request',attemptIndex:0};
  const responses=await Promise.all([api(path+'/attempts',input),api(path+'/attempts',input)]);
  assert.ok(responses.every(r=>[200,409].includes(r.status)));
  assert.equal((await api(path+'/attempts',input)).data.attempts.length,1);
  assert.equal((await api(path+'/draft',{transcript:'Late write',attemptIndex:0})).status,409);
  assert.equal((await api(path)).data.attempts[0].transcript,'Saved answer');
  await api(path+'/feedback',{});
  await api(path+'/attempts',{transcript:'Revision',submissionId:'revision-request',attemptIndex:1});
  assert.equal((await api(path+'/reference')).status,409);
  await api(path+'/feedback',{});
  assert.equal((await api(path+'/reference')).status,200);
});

test('a failed workspace write retains the last successful draft and allows retry',async t=>{
  const {rename}=await import('node:fs/promises');
  const {api,directory}=await harness(t);const {record}=await setup(api);const path=`/records/${record.id}`;
  await api(path+'/draft',{transcript:'Previously saved',attemptIndex:0});
  await rename(directory,directory+'-offline');
  try {
    assert.equal((await api(path+'/draft',{transcript:'Unsaved edit',attemptIndex:0})).status,502);
    assert.equal((await api(path)).data.writtenDraft.transcript,'Previously saved');
    assert.equal((await api(path+'/attempts',{transcript:'Unsaved edit',submissionId:'retry-write',attemptIndex:0})).status,502);
    assert.equal((await api(path)).data.attempts.length,0);
  } finally { await rename(directory+'-offline',directory); }
  assert.equal((await api(path+'/draft',{transcript:'Unsaved edit',attemptIndex:0})).status,200);
  assert.equal((await api(path+'/attempts',{transcript:'Unsaved edit',submissionId:'retry-write',attemptIndex:0})).status,200);
  assert.equal((await api(path)).data.attempts.length,1);
});

test('feedback can retry the same request after operation metadata storage fails',async t=>{
  const {rename}=await import('node:fs/promises');
  const {api,base,directory}=await harness(t);const {record}=await setup(api);
  await api(`/records/${record.id}/attempts`,{transcript:'I would compare trade-offs.',submissionId:'saved-before-model',attemptIndex:0});
  const feedback=()=>fetch(base+`/api/records/${record.id}/feedback`,{method:'POST',headers:{'Content-Type':'application/json','X-Request-Id':'storage-recovery-request'},body:'{}'});
  await rename(directory,directory+'-offline');
  try { assert.equal((await feedback()).status,502); }
  finally { await rename(directory+'-offline',directory); }
  assert.equal((await feedback()).status,200);
  const saved=(await api(`/records/${record.id}`)).data;
  assert.equal(saved.attempts.length,1);assert.ok(saved.attempts[0].feedback);
});

test('feedback retry recovers an orphan pending operation after result persistence fails',async t=>{
  const {rename}=await import('node:fs/promises');
  const {FakeLanguageModel}=await import('../src/providers.js');const provider=new FakeLanguageModel();
  const {api,base,directory}=await harness(t,provider);const {record}=await setup(api);
  const original=provider.feedback.bind(provider);let failWrite=true;
  provider.feedback=async input=>{const result=await original(input);if(failWrite)await rename(directory,directory+'-offline');return result;};
  await api(`/records/${record.id}/attempts`,{transcript:'I would validate the result.',submissionId:'persisted-answer',attemptIndex:0});
  const feedback=()=>fetch(base+`/api/records/${record.id}/feedback`,{method:'POST',headers:{'Content-Type':'application/json','X-Request-Id':'result-write-recovery'},body:'{}'});
  try { assert.equal((await feedback()).status,502); }
  finally {failWrite=false;await rename(directory+'-offline',directory);}
  assert.equal((await feedback()).status,200);
  assert.equal((await api(`/records/${record.id}`)).data.attempts.length,1);
});

test('different request IDs cannot run or overwrite feedback for the same answer concurrently',async t=>{
  const {FakeLanguageModel}=await import('../src/providers.js');const provider=new FakeLanguageModel();
  const original=provider.feedback.bind(provider);let release,started,calls=0;
  const gate=new Promise(r=>release=r), entered=new Promise(r=>started=r);
  provider.feedback=async input=>{calls++;started();await gate;return original(input);};
  const {api,base}=await harness(t,provider);const {record}=await setup(api);
  await api(`/records/${record.id}/attempts`,{transcript:'I would test reliability.'});
  const feedback=id=>fetch(base+`/api/records/${record.id}/feedback`,{method:'POST',headers:{'Content-Type':'application/json','X-Request-Id':id},body:'{}'});
  const first=feedback('first-browser-request');await entered;
  let second;
  try {
    second=await Promise.race([feedback('other-browser-request'),new Promise(resolve=>setTimeout(()=>resolve(null),100))]);
    assert.ok(second,'Second request should be rejected while the first is running');
    assert.equal(second.status,409);assert.equal(calls,1);
  } finally { release(); }
  assert.equal((await first).status,200);
  const saved=(await api(`/records/${record.id}`)).data;
  assert.equal((await feedback('retry-after-completed')).status,200);
  assert.equal(calls,1);
  assert.deepEqual((await api(`/records/${record.id}`)).data,saved);
});
