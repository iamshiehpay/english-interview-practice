import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateManifest,checkAnalysis,checkFrozenAnalysis,checkFeedback,stability,labelStatus,creatorStatus,dimensions} from '../evaluation/checks.js';
import {FakeLanguageModel} from '../src/providers.js';
const manifest=JSON.parse(await readFile(new URL('../evaluation/v1/manifest.json',import.meta.url)));
test('evaluation fixtures cover required matrix and reject missing/duplicate cases',()=>{
  validateManifest(manifest);
  for(const mutate of [m=>m.cases.pop(),m=>m.cases[1].id=m.cases[0].id,m=>m.cases[0].jobId='absent',m=>m.cases[0].category='accent',m=>m.cases.forEach(c=>c.tags=[])]){const m=structuredClone(manifest);mutate(m);assert.throws(()=>validateManifest(m));}
});
test('independent evaluation catches unsupported requirements and fabricated coaching but permits exact quotes',async()=>{
  const p=new FakeLanguageModel(),job=manifest.jobs[0],c=manifest.cases[1];
  const a=await p.analyze({snapshot:job});checkAnalysis(a,job);a.questions[0].text+=' Kubernetes certification';assert.throws(()=>checkAnalysis(a,job));
  const f=await p.feedback({transcript:c.transcript});checkFeedback(f,c);f.priorityImprovement.text='You saved 900 million dollars.';assert.throws(()=>checkFeedback(f,c));
});
test('stability is measured across all 80 dimensions with exact 90 percent boundary',()=>{
  const results=manifest.cases.flatMap(c=>[1,2,3].map(repeat=>({caseId:c.id,repeat,feedback:{ratings:Object.fromEntries(dimensions.map(d=>[d,{level:2}]))}})));
  for(let i=0;i<8;i++)results[Math.floor(i/4)*3+2].feedback.ratings[dimensions[i%4]].level=4;
  assert.equal(stability(results).stable,72);assert.equal(stability(results).pass,true);
  results[8].feedback.ratings.relevance.level=4;assert.equal(stability(results).pass,false);
  assert.throws(()=>stability(results.slice(1)));
});
test('machine fixtures never satisfy human review or creator gates by default',()=>{
  assert.equal(labelStatus(Array.from({length:20},(_,i)=>({caseId:String(i)})),{schemaVersion:1,labels:[]}).pass,false);
  assert.equal(creatorStatus({creator:null,loops:[]}).pass,false);
  const loops=Array.from({length:5},(_,i)=>({recordId:String(i),snapshotId:String(i%2),category:i%2?'behavioral':'role-fit',completedAt:'2026-09-18T00:00:00Z',completed:true,synthetic:false,inputMode:'text',experienceGap:i===0,inducedFailure:i===1?{type:'cancelled request',recovered:true}:null}));
  const ledger={creator:'Human reviewer',attestedAt:'2026-09-18T01:00:00Z',loops};assert.equal(creatorStatus(ledger).pass,true);loops[0].synthetic=true;assert.equal(creatorStatus(ledger).pass,false);
  loops[0].synthetic=false;ledger.validationMode='creator';assert.equal(creatorStatus(ledger).pass,true);ledger.creator=null;assert.equal(creatorStatus(ledger).pass,false);
});
const personaLoops=()=>Array.from({length:5},(_,i)=>({recordId:`record-${i}`,snapshotId:`snapshot-${i%2}`,category:i%2?'behavioral':'role-fit',completedAt:'2026-09-18T00:00:00Z',completed:true,synthetic:true,inputMode:'text',persona:'林小安',evidence:'docs/verification/persona-walkthrough-2026-09-23.md',experienceGap:i===0,inducedFailure:i===1?{type:'cancelled feedback and retried',recovered:true}:null}));
const personaLedger=()=>({validationMode:'ai-persona',creator:null,attestedBy:'Independent AI verifier',attestedAt:'2026-09-18T01:00:00Z',loops:personaLoops()});
test('AI persona mode accepts five attested completed loops with shared coverage',()=>{
  assert.deepEqual(creatorStatus(personaLedger()),{pass:true,count:5,validationMode:'ai-persona',errors:[]});
});
test('AI persona mode requires an independent attestation and stays separate from creator identity',()=>{
  for(const [change,error] of [
    [ledger=>{ledger.creator='Human';},'creator must be null'],
    [ledger=>{ledger.attestedBy=null;},'AI attestation pending'],
    [ledger=>{ledger.attestedAt=null;},'AI attestation pending'],
    [ledger=>{ledger.attestedAt='invalid';},'AI attestation pending']
  ]){const ledger=personaLedger();change(ledger);const result=creatorStatus(ledger);assert.equal(result.pass,false);assert.ok(result.errors.some(message=>message.includes(error)),JSON.stringify(result));}
});
test('AI persona mode rejects incomplete, non-persona and untraceable loops',()=>{
  for(const [change,error] of [
    [ledger=>{ledger.loops.pop();},'Pending fifth persona loop'],
    [ledger=>{ledger.loops[1].recordId=ledger.loops[0].recordId;},'unique record ids'],
    [ledger=>{ledger.loops[1].completed=false;},'completed'],
    [ledger=>{ledger.loops[1].synthetic=false;},'synthetic'],
    [ledger=>{ledger.loops[1].persona=' ';},'persona'],
    [ledger=>{ledger.loops[1].evidence='';},'evidence'],
    [ledger=>{ledger.loops[1].evidence='docs/verification/ ';},'evidence'],
    [ledger=>{ledger.loops[1].evidence='../docs/verification/walkthrough.md';},'evidence'],
    [ledger=>{ledger.loops[1].evidence='docs/verification/../private.md';},'evidence']
  ]){const ledger=personaLedger();change(ledger);const result=creatorStatus(ledger);assert.equal(result.pass,false);assert.ok(result.errors.some(message=>message.includes(error)),JSON.stringify(result));}
});
test('AI persona coverage failures identify the missing rule',()=>{
  for(const [change,error] of [
    [ledger=>ledger.loops.forEach(loop=>loop.snapshotId='same'),'two Job Snapshots'],
    [ledger=>ledger.loops.forEach(loop=>loop.category='role-fit'),'two Question Categories'],
    [ledger=>ledger.loops.forEach(loop=>loop.experienceGap=false),'Experience Gap'],
    [ledger=>ledger.loops.forEach(loop=>loop.inducedFailure=null),'induced failure with recovery'],
    [ledger=>{ledger.loops[1].inducedFailure.recovered=false;},'induced failure with recovery']
  ]){const ledger=personaLedger();change(ledger);const result=creatorStatus(ledger);assert.equal(result.pass,false);assert.ok(result.errors.some(message=>message.includes(error)),JSON.stringify(result));}
});
test('v3 ledger reports only the pending fifth persona loop and AI attestation',async()=>{
  const ledger=JSON.parse(await readFile(new URL('../evaluation/v3/creator-validation.json',import.meta.url)));
  assert.equal(ledger.validationMode,'ai-persona');assert.equal(ledger.loops.length,4);
  assert.equal(ledger.creator,null);assert.equal(ledger.attestedBy,null);assert.equal(ledger.attestedAt,null);
  assert.deepEqual(creatorStatus(ledger).errors,['AI attestation pending: attestedBy and valid attestedAt required','Pending fifth persona loop (4/5 completed)']);
});
test('approved human labels bind to exact inputs and transcript evidence; stale approval fails',()=>{
  const packet=Array.from({length:20},(_,i)=>({caseId:String(i),inputChecksum:'checksum-'+i,transcript:'I would test the failure path.'}));
  const labels={schemaVersion:1,labels:packet.map(p=>({caseId:p.caseId,inputChecksum:p.inputChecksum,status:'approved',reviewer:'Human',reviewedAt:'2026-09-18T00:00:00Z',rationale:'Reasoned hypothetical support.',ranges:Object.fromEntries(dimensions.map(d=>[d,[2,3]])),evidenceQuotes:['test the failure path'],requiredFindings:[],forbiddenFindings:[]}))};
  assert.equal(labelStatus(packet,labels).pass,true);labels.labels[0].inputChecksum='old';assert.equal(labelStatus(packet,labels).pass,false);
  labels.labels[0].inputChecksum=packet[0].inputChecksum;labels.labels[0].evidenceQuotes=['invented evidence'];assert.equal(labelStatus(packet,labels).pass,false);
});
test('frozen analysis is reused only when contract, model, effort, service tier and JDs all match',()=>{
  const expected={contractVersion:'3.0.0',model:'gpt-5.6-luna',effort:'xhigh',serviceTier:'priority',jdChecksum:'abc'},frozen={schemaVersion:2,...expected,entries:[]};
  checkFrozenAnalysis(frozen,expected);
  for(const [key,value] of [['model','gpt-5.6-sol'],['effort','medium'],['serviceTier',null],['jdChecksum','other'],['contractVersion','2.0.0'],['schemaVersion',1]])assert.throws(()=>checkFrozenAnalysis({...frozen,[key]:value},expected));
  for(const key of ['effort','serviceTier']){const legacy={...frozen};delete legacy[key];assert.throws(()=>checkFrozenAnalysis(legacy,expected),/missing/);assert.throws(()=>checkFrozenAnalysis(legacy,{...expected,[key]:undefined}),/missing/);}
  checkFrozenAnalysis({...frozen,effort:null,serviceTier:null},{...expected,effort:null,serviceTier:null});
});
