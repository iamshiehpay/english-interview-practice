import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {checkpointIdentity,readCheckpoint,writeCheckpoint,oncePerKey} from '../evaluation/checkpoints.js';
import {checkAnalysis,checkBilingualConsistency,checkFeedback,inputChecksum,outputChecksum} from '../evaluation/checks.js';
import {FakeLanguageModel} from '../src/providers.js';
import {MODEL_CONTRACT_VERSION} from '../src/model-contracts.js';

const manifest=JSON.parse(await readFile(new URL('../evaluation/v1/manifest.json',import.meta.url)));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const identity=checkpointIdentity({manifest,contractVersion:MODEL_CONTRACT_VERSION,codeChecksum:'a'.repeat(64),mode:'synthetic',model:null,configuration:null});
const provider=new FakeLanguageModel();
const analyses=new Map();
for(const job of manifest.jobs){const analysis=await provider.analyze({snapshot:job});checkAnalysis(analysis,job);analyses.set(job.text,analysis);}
const cases=await Promise.all(manifest.cases.map(async c=>{
  const job=manifest.jobs.find(j=>j.id===c.jobId);
  const question=analyses.get(job.text).questions.find(q=>q.category===c.category);
  const feedback=await provider.feedback({transcript:c.transcript});
  checkFeedback(feedback,c);
  return {caseId:c.id,inputChecksum:inputChecksum(job,c,question),question,feedback,bilingualAudit:checkBilingualConsistency(question,feedback),checks:['bilingual schema']};
}));
const result=(caseIndex,repeat)=>{
  const base=structuredClone(cases[caseIndex]);
  return {...base,repeat,outputChecksum:outputChecksum(base.caseId,repeat,base.question,base.feedback)};
};
const allResults=()=>manifest.cases.flatMap((_,index)=>[1,2,3].map(repeat=>result(index,repeat)));
const withCheckpoint=async fn=>{
  const dir=await mkdtemp(join(tmpdir(),'coach-checkpoint-test-'));
  try{await fn(join(dir,'state.json'),dir);}finally{await rm(dir,{recursive:true,force:true});}
};
const read=path=>readCheckpoint(path,{identity,manifest,analyses});
const mutate=async(path,change)=>{
  const state=JSON.parse(await readFile(path,'utf8'));
  change(state);
  await writeFile(path,JSON.stringify(state));
};
const resign=entry=>{entry.checksum=hash(entry.result);};

test('partial checkpoint survives interruption and identifies exactly the missing combinations',async()=>withCheckpoint(async path=>{
  const saved=[result(0,1),result(0,2),result(1,1)];
  await writeCheckpoint(path,{identity,entries:saved});
  const recovered=await read(path);
  assert.deepEqual(recovered,saved);
  const seen=new Set(recovered.map(item=>`${item.caseId}:${item.repeat}`));
  assert.equal(seen.size,3);
  assert.equal(allResults().filter(item=>!seen.has(`${item.caseId}:${item.repeat}`)).length,57);
}));

test('complete checkpoint validates all 60 distinct case/repeat results offline',async()=>withCheckpoint(async path=>{
  const saved=allResults();
  await writeCheckpoint(path,{identity,entries:saved});
  assert.deepEqual(await read(path),saved);
  assert.equal(new Set(saved.map(item=>`${item.caseId}:${item.repeat}`)).size,60);
}));

test('missing checkpoint and leftover temporary file are never counted as saved results',async()=>withCheckpoint(async(path,dir)=>{
  await writeFile(join(dir,'.state.json.interrupted.tmp'),'partial');
  await assert.rejects(read(path),{code:'ENOENT'});
  await writeCheckpoint(path,{identity,entries:[result(0,1)]});
  assert.equal((await read(path)).length,1);
  assert.deepEqual((await readdir(dir)).sort(),['.state.json.interrupted.tmp','state.json']);
}));

test('duplicate, out of range, unknown and invalid saved entries reject before reuse',async()=>{
  for(const change of [
    state=>state.entries.push(structuredClone(state.entries[0])),
    state=>{state.entries[0].result.repeat=4;resign(state.entries[0]);},
    state=>{state.entries[0].result.caseId='unknown';resign(state.entries[0]);},
    state=>{state.entries[0].result.feedback.ratings.relevance.level=5;resign(state.entries[0]);},
    state=>{state.entries[0].result.bilingualAudit.pass=false;resign(state.entries[0]);}
  ])await withCheckpoint(async path=>{
    await writeCheckpoint(path,{identity,entries:[result(0,1)]});
    await mutate(path,change);
    await assert.rejects(read(path));
  });
});

test('tampered bytes, selected question and input/output checksums reject even with a new entry checksum',async()=>{
  for(const change of [
    state=>{state.entries[0].result.feedback.strength.text='changed';},
    state=>{state.entries[0].result.question.text='Different question';resign(state.entries[0]);},
    state=>{state.entries[0].result.inputChecksum='0'.repeat(64);resign(state.entries[0]);},
    state=>{state.entries[0].result.outputChecksum='0'.repeat(64);resign(state.entries[0]);}
  ])await withCheckpoint(async path=>{
    await writeCheckpoint(path,{identity,entries:[result(0,1)]});
    await mutate(path,change);
    await assert.rejects(read(path));
  });
});

test('stale fixture, source, configuration and missing analysis reject',async()=>withCheckpoint(async path=>{
  await writeCheckpoint(path,{identity,entries:[result(0,1)]});
  for(const stale of [
    {...identity,codeChecksum:'b'.repeat(64)},
    {...identity,configuration:{temperature:0}},
    {...identity,manifestChecksum:'c'.repeat(64)}
  ])await assert.rejects(readCheckpoint(path,{identity:stale,manifest,analyses}));
  const modified=structuredClone(manifest);modified.cases[0].transcript+=' changed';
  await assert.rejects(readCheckpoint(path,{identity,manifest:modified,analyses}));
  await assert.rejects(readCheckpoint(path,{identity,manifest,analyses:new Map()}));
}));

test('a failed JD analysis is attempted only once across repeats',async()=>{
  let calls=0;
  const analyze=oncePerKey(async()=>{calls++;throw Error('analysis rejected');});
  for(let repeat=1;repeat<=3;repeat++)await assert.rejects(analyze('same JD'),/analysis rejected/);
  assert.equal(calls,1);
});
