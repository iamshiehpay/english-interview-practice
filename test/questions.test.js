import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness,setup} from './helpers.js';
import {FakeLanguageModel} from '../src/providers.js';

test('full Question Set, coverage recommendation, manual override and append preserve history',async t=>{
 const {api}=await harness(t);const {snapshot,analysis,record}=await setup(api);
 assert.equal(analysis.questions.length,8);assert.equal(new Set(analysis.questions.map(q=>q.category)).size,4);
 assert.ok(analysis.review.required);assert.equal(analysis.gapGuidance.length,4);
 const view=(await api(`/snapshots/${snapshot.id}/analysis`)).data;
 assert.equal(view.history[record.question.id][0].recordId,record.id);
 assert.notEqual(view.recommendation.questionId,record.question.id);
 const alternate=analysis.questions.at(-1);
 assert.equal((await api('/records',{snapshotId:snapshot.id,questionId:alternate.id})).data.question.id,alternate.id);
 const expanded=(await api(`/snapshots/${snapshot.id}/questions`,{})).data;
 assert.equal(expanded.questions.length,12);assert.deepEqual(expanded.questions.slice(0,8),analysis.questions);
 assert.deepEqual((await api(`/snapshots/${snapshot.id}`)).data,snapshot);
 assert.equal((await api(`/snapshots/${snapshot.id}/questions`,{})).data.questions.length,16);
});
test('schema, coverage, duplicates and unsupported posting facts reject atomically',async t=>{
 const p=new FakeLanguageModel(),original=p.analyze.bind(p);const {api}=await harness(t,p);
 const mutations=[v=>v.questions.pop(),v=>{v.questions.push(...v.questions.slice(0,5).map((q,i)=>({...q,id:'extra'+i,text:'different '+i})));},v=>{v.questions.forEach(q=>q.category='role-fit');},v=>{v.questions[1].text=v.questions[0].text.toUpperCase()+'!!!';},v=>{v.questions[1].id=v.questions[0].id;},v=>{v.capabilities[0].description='Must have ten years of AWS experience';},v=>{v.questions[0].evidence=v.capabilities[1].evidence;}];
 for(const mutate of mutations){p.analyze=async args=>{const v=await original(args);mutate(v);return v;};const s=(await api('/snapshots',{text:'Build Python APIs\nDiscuss trade-offs'})).data;assert.equal((await api(`/snapshots/${s.id}/analysis`,{})).status,502);assert.equal((await api('/workspace')).data.analyses[s.id],undefined);}
});
test('failed additions preserve the entire workspace and valid retry appends once',async t=>{
 const p=new FakeLanguageModel();const add=p.additionalQuestions.bind(p);const {api}=await harness(t,p);const {snapshot}=await setup(api);
 const before=(await api('/workspace')).data;
 p.additionalQuestions=async({analysis})=>({...analysis,questions:[...analysis.questions,analysis.questions[0]]});
 assert.equal((await api(`/snapshots/${snapshot.id}/questions`,{})).status,502);assert.deepEqual((await api('/workspace')).data,before);
 p.additionalQuestions=add;assert.equal((await api(`/snapshots/${snapshot.id}/questions`,{})).data.questions.length,12);
});
test('Experience Gap framing remains selectable and provider ratings are not lowered',async t=>{
 const {api}=await harness(t);const {snapshot,analysis}=await setup(api);
 const q=analysis.questions.find(q=>q.category==='experience-depth');const r=(await api('/records',{snapshotId:snapshot.id,questionId:q.id})).data;
 await api(`/records/${r.id}/attempts`,{transcript:'I have not done this at work. Hypothetically, I would test assumptions, compare trade-offs and validate a small prototype.'});
 const feedback=(await api(`/records/${r.id}/feedback`,{})).data.attempts[0].feedback;assert.equal(feedback.ratings.support.level,2);
 assert.equal((await api(`/snapshots/${snapshot.id}/analysis`)).data.questions.length,8);
});
test('twelve-question initial set and explicitly labelled inference are valid',async t=>{
 const p=new FakeLanguageModel(),original=p.analyze.bind(p);p.analyze=async args=>{const v=await original(args);v.capabilities[0].kind='inference';v.capabilities[0].description='The coach infers that clear explanations may matter.';v.questions=p.makeQuestions(v.capabilities,0,12);return v;};
 const {api}=await harness(t,p);const {analysis}=await setup(api);assert.equal(analysis.questions.length,12);assert.equal(analysis.capabilities[0].kind,'inference');
});
test('legacy one-question workspace upgrade retains linked practice history',async t=>{
 const {writeFile}=await import('node:fs/promises');const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {createApplication}=await import('../src/server.js');
 const directory=await mkdtemp(join(tmpdir(),'coach-legacy-'));const c={id:'c1',description:'Build APIs',evidence:'Build APIs',kind:'fact'};const q={id:'q1',text:'Explain an approach to Build APIs',category:'technical-communication',capabilityIds:['c1'],evidence:'Build APIs',rationale:'Practice'};
 await writeFile(join(directory,'workspace.json'),JSON.stringify({version:1,snapshots:{s:{id:'s',text:'Build APIs',sourceType:'pasted-jd',capturedAt:'2026-09-17T00:00:00Z'}},analyses:{s:{capabilities:[c],questions:[q]}},records:{r:{id:'r',snapshotId:'s',question:q,attempts:[],status:'answer'}}}));
 const {server}=await createApplication({directory});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}/api`;const response=await fetch(base+'/snapshots/s/analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,200);const a=await response.json();assert.deepEqual(a.questions[0],q);assert.equal(a.history.q1[0].recordId,'r');assert.equal(a.questions.length,8);
});
test('demonstration provider cites a short posting excerpt, not the whole posting',async t=>{
 const {api}=await harness(t);
 const longLine='Senior Backend Engineer building and scaling distributed payment systems in Go and Kubernetes, leading incident response, mentoring engineers, and owning reliable API design for high-traffic fintech services across the region.';
 const snapshot=(await api('/snapshots',{text:longLine})).data;
 const analysis=(await api(`/snapshots/${snapshot.id}/analysis`,{})).data;
 assert.equal(analysis.questions.length,8);
 for(const cap of analysis.capabilities){
  assert.ok(cap.evidence.trim().length>0,'evidence non-empty');
  assert.ok(cap.evidence.length<=100,`capability evidence too long: ${cap.evidence.length}`);
  assert.ok(snapshot.text.includes(cap.evidence),'evidence must be a verbatim substring of the Job Snapshot');
 }
 for(const q of analysis.questions){
  assert.ok(q.evidence.length<=100,`question evidence too long: ${q.evidence.length}`);
  assert.ok(snapshot.text.includes(q.evidence),'question evidence must be grounded');
  assert.ok(q.text.length<longLine.length,'question text should not embed the whole posting');
 }
});
test('irregular expansion batches cannot exceed the documented forty-question limit',async t=>{
 const p=new FakeLanguageModel();let batch=3;p.additionalQuestions=async({analysis})=>({...analysis,questions:[...analysis.questions,...p.makeQuestions(analysis.capabilities,analysis.questions.length,batch)]});
 const {api}=await harness(t,p);const {snapshot}=await setup(api);
 for(let i=0;i<10;i++)assert.equal((await api(`/snapshots/${snapshot.id}/questions`,{})).status,200);
 const before=(await api('/workspace')).data;batch=4;
 assert.equal((await api(`/snapshots/${snapshot.id}/questions`,{})).status,502);
 assert.deepEqual((await api('/workspace')).data,before);
});
