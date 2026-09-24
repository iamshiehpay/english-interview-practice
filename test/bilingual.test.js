import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApplication} from '../src/server.js';
import {FakeLanguageModel} from '../src/providers.js';
import {MODEL_CONTRACT_VERSION} from '../src/model-contracts.js';
import {checkBilingualConsistency,labelStatus,semanticReviewStatus} from '../evaluation/checks.js';
import {harness,setup} from './helpers.js';

const zh=/\p{Script=Han}/u;

test('new Question Sets and Feedback Reports use the shared bilingual contract',async t=>{
  const {api}=await harness(t);const {analysis,record}=await setup(api);
  assert.equal(MODEL_CONTRACT_VERSION,'3.0.0');
  for(const question of analysis.questions){
    assert.ok(question.text.trim());assert.match(question.meaningZh,zh);
    assert.ok(question.rationale.trim());assert.match(question.rationaleZh,zh);
  }
  const transcript='I would validate inputs and test timeout failures because clients need predictable behavior.';
  await api(`/records/${record.id}/attempts`,{transcript});
  const report=(await api(`/records/${record.id}/feedback`,{})).data.attempts[0].feedback;
  for(const rating of Object.values(report.ratings)){
    assert.deepEqual(Object.keys(rating).sort(),['level','quote','reason','reasonZh'].sort());
    assert.ok(transcript.includes(rating.quote));assert.ok(rating.reason.trim());assert.match(rating.reasonZh,zh);
  }
  for(const finding of [report.strength,report.priorityImprovement]){
    assert.deepEqual(Object.keys(finding).sort(),['quote','text','textZh'].sort());
    assert.ok(transcript.includes(finding.quote));assert.ok(finding.text.trim());assert.match(finding.textZh,zh);
  }
  assert.equal(checkBilingualConsistency(analysis.questions[0],report).pass,true);
});

test('new provider output missing any bilingual field is rejected without persistence',async t=>{
  const provider=new FakeLanguageModel(),analyze=provider.analyze.bind(provider),feedback=provider.feedback.bind(provider);
  const {api}=await harness(t,provider);
  provider.analyze=async args=>{const value=await analyze(args);value.questions[0].meaningZh='English masquerading as Chinese';return value;};
  const snapshot=(await api('/snapshots',{text:'Build reliable Python APIs.\nExplain engineering trade-offs.'})).data;
  assert.equal((await api(`/snapshots/${snapshot.id}/analysis`,{})).status,502);
  assert.equal((await api('/workspace')).data.analyses[snapshot.id],undefined);
  provider.analyze=analyze;
  const analysis=(await api(`/snapshots/${snapshot.id}/analysis`,{})).data;
  const record=(await api('/records',{snapshotId:snapshot.id,questionId:analysis.questions[0].id})).data;
  await api(`/records/${record.id}/attempts`,{transcript:'I would test failures.'});
  provider.feedback=async args=>{const value=await feedback(args);delete value.ratings.support.reasonZh;return value;};
  assert.equal((await api(`/records/${record.id}/feedback`,{})).status,502);
  assert.equal((await api(`/records/${record.id}`)).data.attempts[0].feedback,null);
});

test('legacy single-language persisted records remain readable without model re-evaluation',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'coach-bilingual-legacy-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const capability={id:'c1',description:'Build APIs',evidence:'Build APIs',kind:'fact'};
  const questions=Array.from({length:8},(_,i)=>({id:`q${i+1}`,text:`Legacy question ${i+1}`,rationale:'Legacy rationale',category:['role-fit','experience-depth','behavioral','technical-communication'][i%4],capabilityIds:['c1'],evidence:'Build APIs'}));
  const quote='I built APIs.';
  const feedback={ratings:Object.fromEntries(['relevance','support','structure','englishExpression'].map(d=>[d,{level:2,quote,reason:'Legacy reason'}])),strength:{text:'Legacy strength',quote},priorityImprovement:{text:'Legacy priority',quote}};
  const workspace={version:1,snapshots:{s:{id:'s',text:'Build APIs',sourceType:'pasted-jd',capturedAt:'2026-09-17T00:00:00Z'}},analyses:{s:{capabilities:[capability],questions}},records:{r:{id:'r',snapshotId:'s',question:questions[0],attempts:[{id:'a',transcript:quote,inputMode:'text',submittedAt:'2026-09-17T00:00:00Z',feedback}],status:'revise',createdAt:'2026-09-17T00:00:00Z',focusPoint:null}}};
  await writeFile(join(directory,'workspace.json'),JSON.stringify(workspace));
  let calls=0;const provider=new FakeLanguageModel();provider.analyze=async()=>{calls++;throw Error('must not run');};provider.feedback=async()=>{calls++;throw Error('must not run');};
  const {server}=await createApplication({directory,languageModel:provider});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
  const api=async(path,data)=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});return {status:response.status,data:await response.json()};};
  assert.deepEqual((await api('/records/r')).data.attempts[0].feedback,feedback);
  assert.deepEqual((await api('/snapshots/s/analysis')).data.questions[1],questions[0]);
  assert.equal((await api('/snapshots/s/analysis',{})).status,200);assert.equal(calls,0);
});

test('new evaluation packets invalidate old labels and require pending human semantic review',()=>{
  const packet=Array.from({length:20},(_,i)=>({caseId:`case-${i}`,inputChecksum:`new-${i}`,transcript:'A quoted answer.',contractVersion:MODEL_CONTRACT_VERSION}));
  const stale={schemaVersion:1,labels:packet.map(item=>({caseId:item.caseId,inputChecksum:item.inputChecksum,status:'approved',reviewer:'Human',reviewedAt:'2026-09-18T00:00:00Z',rationale:'Reviewed.',ranges:{relevance:[1,4],support:[1,4],structure:[1,4],englishExpression:[1,4]},evidenceQuotes:['A quoted answer.'],requiredFindings:[],forbiddenFindings:[]}))};
  assert.equal(labelStatus(packet,stale).pass,false);
  const current={schemaVersion:2,contractVersion:MODEL_CONTRACT_VERSION,labels:stale.labels.map(label=>({...label,bilingualSemanticConsistency:'pending'}))};
  assert.equal(labelStatus(packet,current).pass,false);
  current.labels.forEach(label=>label.bilingualSemanticConsistency='approved');assert.equal(labelStatus(packet,current).pass,true);
});

test('independent semantic review binds every bilingual audit to the current checksum',()=>{
  const pairs=[{name:'question meaning',en:'What would you test?',zh:'你會測試什麼？'}];
  const audits=Array.from({length:20},(_,i)=>Array.from({length:3},(_,r)=>({caseId:`case-${i}`,repeat:r+1,outputChecksum:`checksum-${i}-${r+1}`,bilingualAudit:{pairs}}))).flat();
  const reviews={schemaVersion:2,contractVersion:MODEL_CONTRACT_VERSION,reviewerType:'ai',reviewer:'independent semantic reviewer',reviewedAt:'2026-09-18T00:00:00Z',reviews:audits.map(item=>({caseId:item.caseId,repeat:item.repeat,outputChecksum:item.outputChecksum,verdict:'consistent',rationale:'The paired text preserves the same request.',contradictoryPairs:[]}))};
  assert.equal(semanticReviewStatus(audits,reviews).pass,true);
  reviews.reviews[0].outputChecksum='stale';assert.equal(semanticReviewStatus(audits,reviews).pass,false);
  reviews.reviews[0].outputChecksum=audits[0].outputChecksum;reviews.reviews[0].verdict='inconsistent';reviews.reviews[0].contradictoryPairs=['question meaning'];assert.equal(semanticReviewStatus(audits,reviews).pass,false);
});
