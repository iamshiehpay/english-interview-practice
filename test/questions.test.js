import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness,setup} from './helpers.js';
import {FakeLanguageModel} from '../src/providers.js';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

test('a Common Question is served before the stored Job-grounded Question Set without rewriting it', async t => {
 const {api,directory}=await harness(t);
 const snapshot=(await api('/snapshots',{text:'Build reliable Python APIs.\nExplain engineering trade-offs.'})).data;
 assert.equal((await api(`/snapshots/${snapshot.id}/analysis`)).status,409);
 const view=(await api(`/snapshots/${snapshot.id}/analysis`,{})).data;
 const intro=view.questions[0];
 assert.equal(intro.id,'self-introduction');
 assert.equal(intro.text,'Tell me about yourself.');
 assert.equal(intro.meaningZh,'請用一到兩分鐘介紹自己：你的背景、和這個職位相關的經驗，以及為什麼想應徵。');
 assert.equal(intro.category,'role-fit');
 assert.deepEqual(intro.capabilityIds,[]);
 assert.equal(intro.source,'common');
 assert.equal(intro.group,'self-introduction');
 assert.equal(intro.evidence,undefined);
 assert.equal(view.questions.length,9);
 assert.equal((await api('/workspace')).data.analyses[snapshot.id].questions.length,8);
 const persisted=await readFile(join(directory,'workspace.json'),'utf8');
 assert.deepEqual((await api(`/snapshots/${snapshot.id}/analysis`)).data.questions,view.questions);
 assert.equal(await readFile(join(directory,'workspace.json'),'utf8'),persisted,'serving a Common Question never rewrites stored analysis');
});

test('full Question Set, coverage recommendation, manual override and append preserve history',async t=>{
 const {api}=await harness(t);const {snapshot,analysis,record}=await setup(api);
 assert.equal(analysis.questions.length,9);assert.equal(new Set(analysis.questions.map(q=>q.category)).size,4);
 assert.ok(analysis.review.required);assert.equal(analysis.gapGuidance.length,4);
 const view=(await api(`/snapshots/${snapshot.id}/analysis`)).data;
 assert.equal(view.history[record.question.id][0].recordId,record.id);
 assert.notEqual(view.recommendation.questionId,record.question.id);
 const alternate=analysis.questions.at(-1);
 assert.equal((await api('/records',{snapshotId:snapshot.id,questionId:alternate.id})).data.question.id,alternate.id);
 const expanded=(await api(`/snapshots/${snapshot.id}/questions`,{})).data;
 assert.equal(expanded.questions.length,13);assert.deepEqual(expanded.questions.slice(0,9),analysis.questions);
 assert.deepEqual((await api(`/snapshots/${snapshot.id}`)).data,snapshot);
 assert.equal((await api(`/snapshots/${snapshot.id}/questions`,{})).data.questions.length,17);
});
test('schema, coverage, duplicates and unsupported posting facts reject atomically',async t=>{
 const p=new FakeLanguageModel(),original=p.analyze.bind(p);const {api}=await harness(t,p);
 const mutations=[v=>v.questions.pop(),v=>{v.questions.push(...v.questions.slice(0,5).map((q,i)=>({...q,id:'extra'+i,text:'different '+i})));},v=>{v.questions.forEach(q=>q.category='role-fit');},v=>{v.questions[1].text=v.questions[0].text.toUpperCase()+'!!!';},v=>{v.questions[1].id=v.questions[0].id;},v=>{v.capabilities[0].description='Must have ten years of AWS experience';},v=>{v.questions[0].evidence=v.capabilities[1].evidence;}];
 for(const mutate of mutations){p.analyze=async args=>{const v=await original(args);mutate(v);return v;};const s=(await api('/snapshots',{text:'Build Python APIs\nDiscuss trade-offs'})).data;assert.equal((await api(`/snapshots/${s.id}/analysis`,{})).status,502);assert.equal((await api('/workspace')).data.analyses[s.id],undefined);}
});
test('model questions cannot take a reserved Common Question id on initial generation or expansion',async t=>{
 const provider=new FakeLanguageModel(),analyze=provider.analyze.bind(provider),add=provider.additionalQuestions.bind(provider);
 const {api}=await harness(t,provider);
 provider.analyze=async args=>{const output=await analyze(args);output.questions[0].id='self-introduction';return output;};
 const snapshot=(await api('/snapshots',{text:'Build reliable Python APIs.\nExplain engineering trade-offs.'})).data;
 const initial=await api(`/snapshots/${snapshot.id}/analysis`,{});
 assert.equal(initial.status,502);
 assert.match(initial.data.error,/reserved Common Question id/i);
 assert.equal((await api('/workspace')).data.analyses[snapshot.id],undefined);
 provider.analyze=analyze;
 assert.equal((await api(`/snapshots/${snapshot.id}/analysis`,{})).status,200);
 const before=(await api('/workspace')).data;
 provider.additionalQuestions=async args=>{const output=await add(args);output.questions.at(-1).id='self-introduction';return output;};
 const expanded=await api(`/snapshots/${snapshot.id}/questions`,{});
 assert.equal(expanded.status,502);
 assert.match(expanded.data.error,/reserved Common Question id/i);
 assert.deepEqual((await api('/workspace')).data,before);
});

test('a preexisting reserved-id collision fails explicitly instead of serving ambiguous questions',async t=>{
 const {api,store}=await harness(t);const {snapshot}=await setup(api);
 await store.transact(data=>{data.analyses[snapshot.id].questions[0].id='self-introduction';});
 assert.equal((await api(`/snapshots/${snapshot.id}/analysis`)).status,409);
 assert.equal((await api('/records',{snapshotId:snapshot.id,questionId:'self-introduction'})).status,409);
 assert.equal((await api('/speech',{snapshotId:snapshot.id,questionId:'self-introduction'})).status,409);
 assert.equal((await api('/mock-sessions',{snapshotId:snapshot.id})).status,409);
});
test('failed additions preserve the entire workspace and valid retry appends once',async t=>{
 const p=new FakeLanguageModel();const add=p.additionalQuestions.bind(p);const {api}=await harness(t,p);const {snapshot}=await setup(api);
 const before=(await api('/workspace')).data;
 p.additionalQuestions=async({analysis})=>({...analysis,questions:[...analysis.questions,analysis.questions[0]]});
 assert.equal((await api(`/snapshots/${snapshot.id}/questions`,{})).status,502);assert.deepEqual((await api('/workspace')).data,before);
 p.additionalQuestions=add;assert.equal((await api(`/snapshots/${snapshot.id}/questions`,{})).data.questions.length,13);
});
test('Experience Gap framing remains selectable and provider ratings are not lowered',async t=>{
 const {api}=await harness(t);const {snapshot,analysis}=await setup(api);
 const q=analysis.questions.find(q=>q.category==='experience-depth');const r=(await api('/records',{snapshotId:snapshot.id,questionId:q.id})).data;
 await api(`/records/${r.id}/attempts`,{transcript:'I have not done this at work. Hypothetically, I would test assumptions, compare trade-offs and validate a small prototype.'});
 const feedback=(await api(`/records/${r.id}/feedback`,{})).data.attempts[0].feedback;assert.equal(feedback.ratings.support.level,2);
 assert.equal((await api(`/snapshots/${snapshot.id}/analysis`)).data.questions.length,9);
});
test('twelve-question initial set and explicitly labelled inference are valid',async t=>{
 const p=new FakeLanguageModel(),original=p.analyze.bind(p);p.analyze=async args=>{const v=await original(args);v.capabilities[0].kind='inference';v.capabilities[0].description='The coach infers that clear explanations may matter.';v.questions=p.makeQuestions(v.capabilities,0,12);return v;};
 const {api}=await harness(t,p);const {analysis}=await setup(api);assert.equal(analysis.questions.length,13);assert.equal(analysis.capabilities[0].kind,'inference');
});
test('legacy one-question workspace upgrade retains linked practice history',async t=>{
 const {writeFile}=await import('node:fs/promises');const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {createApplication}=await import('../src/server.js');
 const directory=await mkdtemp(join(tmpdir(),'coach-legacy-'));const c={id:'c1',description:'Build APIs',evidence:'Build APIs',kind:'fact'};const q={id:'q1',text:'Explain an approach to Build APIs',category:'technical-communication',capabilityIds:['c1'],evidence:'Build APIs',rationale:'Practice'};
 await writeFile(join(directory,'workspace.json'),JSON.stringify({version:1,snapshots:{s:{id:'s',text:'Build APIs',sourceType:'pasted-jd',capturedAt:'2026-09-17T00:00:00Z'}},analyses:{s:{capabilities:[c],questions:[q]}},records:{r:{id:'r',snapshotId:'s',question:q,attempts:[],status:'answer'}}}));
 const {server}=await createApplication({directory});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});});
 const base=`http://127.0.0.1:${server.address().port}/api`;const response=await fetch(base+'/snapshots/s/analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,200);const a=await response.json();assert.equal(a.questions[0].id,'self-introduction');assert.deepEqual(a.questions[1],q);assert.equal(a.history.q1[0].recordId,'r');assert.equal(a.questions.length,9);
});
test('demonstration provider cites a short posting excerpt, not the whole posting',async t=>{
 const {api}=await harness(t);
 const longLine='Senior Backend Engineer building and scaling distributed payment systems in Go and Kubernetes, leading incident response, mentoring engineers, and owning reliable API design for high-traffic fintech services across the region.';
 const snapshot=(await api('/snapshots',{text:longLine})).data;
 const analysis=(await api(`/snapshots/${snapshot.id}/analysis`,{})).data;
 assert.equal(analysis.questions.length,9);
 for(const cap of analysis.capabilities){
  assert.ok(cap.evidence.trim().length>0,'evidence non-empty');
  assert.ok(cap.evidence.length<=100,`capability evidence too long: ${cap.evidence.length}`);
  assert.ok(snapshot.text.includes(cap.evidence),'evidence must be a verbatim substring of the Job Snapshot');
 }
 for(const q of analysis.questions.filter(question => question.source !== 'common')){
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
