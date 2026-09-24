import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {mkdir, open, readFile, rename, unlink} from 'node:fs/promises';
import {basename, dirname, join} from 'node:path';
import {checkAnalysis, checkBilingualConsistency, checkFeedback, inputChecksum, outputChecksum} from './checks.js';

const sha256=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const exactKeys=(value, expected)=>{
  assert.ok(value && typeof value==='object' && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(),expected.slice().sort());
};

export function oncePerKey(call){
  const attempts=new Map();
  return (key,...args)=>{
    if(!attempts.has(key))attempts.set(key,Promise.resolve().then(()=>call(key,...args)));
    return attempts.get(key);
  };
}

export function checkpointIdentity({manifest,contractVersion,codeChecksum,mode,model,configuration}){
  assert.ok(manifest && typeof manifest==='object');
  assert.ok(typeof manifest.suiteVersion==='string' && manifest.suiteVersion);
  assert.ok(typeof contractVersion==='string' && contractVersion);
  assert.match(codeChecksum,/^[a-f0-9]{64}$/);
  assert.ok(typeof mode==='string' && mode);
  assert.ok(model===null || typeof model==='string' && model);
  assert.ok(configuration===null || configuration && typeof configuration==='object' && !Array.isArray(configuration));
  return {suiteVersion:manifest.suiteVersion,manifestChecksum:sha256(manifest),contractVersion,codeChecksum,mode,model,configuration:structuredClone(configuration)};
}

export async function readCheckpoint(path,{identity,manifest,analyses}){
  // Read and validate the whole checkpoint before the caller starts any provider work.
  const checkpoint=JSON.parse(await readFile(path,'utf8'));
  exactKeys(checkpoint,['schemaVersion','identity','entries']);
  assert.equal(checkpoint.schemaVersion,1,'Unsupported checkpoint schema');
  assert.deepEqual(checkpoint.identity,identity,'Stale checkpoint identity');
  assert.equal(identity.manifestChecksum,sha256(manifest),'Checkpoint fixture identity does not match manifest');
  assert.ok(analyses instanceof Map,'Validated analyses Map required');
  assert.ok(Array.isArray(checkpoint.entries),'Checkpoint entries must be an array');
  const seen=new Set();
  const results=[];
  for(const entry of checkpoint.entries){
    exactKeys(entry,['result','checksum']);
    assert.match(entry.checksum,/^[a-f0-9]{64}$/);
    assert.equal(entry.checksum,sha256(entry.result),'Tampered checkpoint entry');
    const result=entry.result;
    exactKeys(result,['caseId','repeat','inputChecksum','outputChecksum','question','feedback','bilingualAudit','checks']);
    assert.ok(Number.isInteger(result.repeat) && result.repeat>=1 && result.repeat<=3,'Invalid checkpoint repeat');
    const c=manifest.cases.find(item=>item.id===result.caseId);
    assert.ok(c,`Unknown checkpoint case: ${result.caseId}`);
    const key=`${result.caseId}:${result.repeat}`;
    assert.ok(!seen.has(key),`Duplicate checkpoint case/repeat: ${key}`);
    seen.add(key);
    const job=manifest.jobs.find(item=>item.id===c.jobId);
    assert.ok(job,`Missing job for checkpoint case: ${result.caseId}`);
    const analysis=analyses.get(job.text);
    assert.ok(analysis,`Missing validated analysis for checkpoint case: ${result.caseId}`);
    checkAnalysis(analysis,job);
    const selected=analysis.questions.find(question=>question.category===c.category);
    assert.ok(selected,`Missing selected question for checkpoint case: ${result.caseId}`);
    assert.deepEqual(result.question,selected,`Stale question for checkpoint case: ${result.caseId}`);
    assert.equal(result.inputChecksum,inputChecksum(job,c,result.question,identity.contractVersion),`Stale input checksum for checkpoint case: ${result.caseId}`);
    checkFeedback(result.feedback,c);
    const audit=checkBilingualConsistency(result.question,result.feedback);
    assert.equal(audit.pass,true,`Failed bilingual audit for checkpoint case: ${result.caseId}`);
    assert.deepEqual(result.bilingualAudit,audit,`Stale bilingual audit for checkpoint case: ${result.caseId}`);
    assert.equal(result.outputChecksum,outputChecksum(c.id,result.repeat,result.question,result.feedback,identity.contractVersion),`Stale output checksum for checkpoint case: ${result.caseId}`);
    assert.ok(Array.isArray(result.checks) && result.checks.every(check=>typeof check==='string' && check.trim()),'Invalid checkpoint checks');
    results.push(result);
  }
  return results;
}

export async function writeCheckpoint(path,{identity,entries}){
  assert.ok(Array.isArray(entries),'Checkpoint entries must be an array');
  const wrapped=entries.map(item=>{
    const result=item?.result ?? item;
    return {result,checksum:sha256(result)};
  });
  await writeJsonAtomic(path,{schemaVersion:1,identity,entries:wrapped});
}

export async function writeJsonAtomic(path,value){
  const data=JSON.stringify(value,null,2)+'\n';
  const directory=dirname(path);
  await mkdir(directory,{recursive:true});
  const temporary=join(directory,`.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
  let file;
  try{
    file=await open(temporary,'wx',0o600);
    await file.writeFile(data);
    await file.sync();
    await file.close();file=undefined;
    await rename(temporary,path);
    const dir=await open(directory,'r');
    try{await dir.sync();}finally{await dir.close();}
  }catch(error){
    if(file)await file.close();
    await unlink(temporary).catch(cleanup=>{if(cleanup.code!=='ENOENT')throw cleanup;});
    throw error;
  }
}
