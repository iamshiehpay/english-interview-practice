import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateManifest,checkAnalysis,checkFeedback,stability,labelStatus,creatorStatus,dimensions} from '../evaluation/checks.js';
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
});
test('approved human labels bind to exact inputs and transcript evidence; stale approval fails',()=>{
  const packet=Array.from({length:20},(_,i)=>({caseId:String(i),inputChecksum:'checksum-'+i,transcript:'I would test the failure path.'}));
  const labels={schemaVersion:1,labels:packet.map(p=>({caseId:p.caseId,inputChecksum:p.inputChecksum,status:'approved',reviewer:'Human',reviewedAt:'2026-09-18T00:00:00Z',rationale:'Reasoned hypothetical support.',ranges:Object.fromEntries(dimensions.map(d=>[d,[2,3]])),evidenceQuotes:['test the failure path'],requiredFindings:[],forbiddenFindings:[]}))};
  assert.equal(labelStatus(packet,labels).pass,true);labels.labels[0].inputChecksum='old';assert.equal(labelStatus(packet,labels).pass,false);
  labels.labels[0].inputChecksum=packet[0].inputChecksum;labels.labels[0].evidenceQuotes=['invented evidence'];assert.equal(labelStatus(packet,labels).pass,false);
});
