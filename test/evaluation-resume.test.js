import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

const project=join(dirname(fileURLToPath(import.meta.url)),'..');
const checkpoint=root=>join(root,'checkpoints','v3-3.json');
const report=root=>join(root,'results','v3-3.json');
const start=(root,args=[])=>{
  const child=spawn(process.execPath,['evaluation/run.js','--output-root',root,...args],{cwd:project,env:{...process.env,NODE_TEST_CONTEXT:'1'}});
  let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
  const done=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal,output}));});
  return {child,done};
};

test('an interrupted fake evaluation resumes only missing repeats and complete replay uses zero calls', {timeout:30000},async()=>{
  const root=await mkdtemp(join(tmpdir(),'coach-evaluation-resume-'));
  try{
    const first=start(root);
    let saved=0;
    for(let attempt=0;attempt<500;attempt++){
      try{saved=JSON.parse(await readFile(checkpoint(root),'utf8')).entries.length;}catch(error){if(error.code!=='ENOENT')throw error;}
      if(saved>0)break;
      await delay(2);
    }
    assert.ok(saved>0,'first call must be durable before interruption');
    first.child.kill('SIGTERM');
    await first.done;
    const partial=JSON.parse(await readFile(checkpoint(root),'utf8'));
    const reused=partial.entries.length;
    assert.ok(reused>0&&reused<60,`expected an interrupted partial checkpoint, got ${reused}`);
    const resumed=await start(root,['--resume']).done;
    assert.equal(resumed.code,0,resumed.output);
    const evidence=JSON.parse(await readFile(report(root),'utf8'));
    assert.equal(evidence.contractVersion,'3.3.0');
    assert.equal(evidence.runnerVersion,'3.3.0');
    await assert.rejects(readFile(join(root,'results','v3-2.json'),'utf8'),{code:'ENOENT'});
    assert.equal(evidence.reusedResults,reused);
    assert.equal(evidence.newResults,60-reused);
    assert.equal(evidence.providerCalls,60-reused);
    assert.equal(evidence.cumulativeModelRequests,0);
    assert.equal(evidence.collectedResults,60);
    assert.equal(new Set(evidence.results.map(item=>`${item.caseId}:${item.repeat}`)).size,60);
    assert.equal(evidence.stability.pass,true);
    const replayed=await start(root,['--resume']).done;
    assert.equal(replayed.code,0,replayed.output);
    const replay=JSON.parse(await readFile(report(root),'utf8'));
    assert.equal(replay.providerCalls,0);
    assert.equal(replay.cumulativeModelRequests,0);
    assert.equal(replay.reusedResults,60);
    assert.equal(replay.newResults,0);
    assert.equal(replay.workspaces,0);
    assert.deepEqual(replay.results,evidence.results);

    const tampered=JSON.parse(await readFile(checkpoint(root),'utf8'));
    tampered.entries[0].result.feedback.ratings.relevance.level=4;
    await writeFile(checkpoint(root),JSON.stringify(tampered));
    const rejected=await start(root,['--resume']).done;
    assert.notEqual(rejected.code,0);
    assert.match(rejected.output,/Tampered checkpoint entry/);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('higher model-request cap requires a separate acknowledgement before any evaluation state is written',async()=>{
  const root=await mkdtemp(join(tmpdir(),'coach-evaluation-budget-'));
  try{
    const rejected=await start(root,['--max-total-model-requests','66']).done;
    assert.notEqual(rejected.code,0);
    assert.match(rejected.output,/separate approval and --accept-extra-model-usage/);
    await assert.rejects(readFile(checkpoint(root),'utf8'),{code:'ENOENT'});
  }finally{await rm(root,{recursive:true,force:true});}
});

test('analysis-only freezes blind inputs before any feedback and resumes the same cases', {timeout:30000},async()=>{
  const root=await mkdtemp(join(tmpdir(),'coach-evaluation-blind-'));
  try{
    const prepared=await start(root,['--analysis-only']).done;
    assert.equal(prepared.code,0,prepared.output);
    const blind=JSON.parse(await readFile(join(root,'v3-3','label-blind-packet.json'),'utf8'));
    assert.equal(blind.length,20);
    assert.equal(new Set(blind.map(item=>item.caseId)).size,20);
    assert.ok(blind.every(item=>item.contractVersion==='3.3.0'&&item.inputChecksum&&item.question&&item.transcript));
    assert.equal(JSON.parse(await readFile(checkpoint(root),'utf8')).entries.length,0);
    await assert.rejects(readFile(report(root),'utf8'),{code:'ENOENT'});
    const replayed=await start(root,['--analysis-only','--resume']).done;
    assert.equal(replayed.code,0,replayed.output);
    assert.deepEqual(JSON.parse(await readFile(join(root,'v3-3','label-blind-packet.json'),'utf8')),blind);
    const missingApproval=await start(root,['--resume','--require-blind-approval']).done;
    assert.notEqual(missingApproval.code,0);
    assert.match(missingApproval.output,/human-labels\.json/);
    await assert.rejects(readFile(report(root),'utf8'),{code:'ENOENT'});
    const approvalPath=join(root,'v3-3','human-labels.json');
    const labels={schemaVersion:2,contractVersion:'3.3.0',labelProvenance:{mode:'persona-drafted-ai-approved',blindReviewer:{type:'ai',identity:'Independent test reviewer',independentOfDraftRaters:true}},labels:blind.map(item=>({caseId:item.caseId,inputChecksum:item.inputChecksum,status:'approved',reviewerType:'ai',reviewer:'Independent test reviewer',reviewedAt:'2026-09-24T00:00:00Z',rationale:'Synthetic approval exercises the pre-feedback gate.',ranges:Object.fromEntries(['relevance','support','structure','englishExpression'].map(d=>[d,[2,2]])),evidenceQuotes:[item.transcript.slice(0,8)],requiredFindings:[],forbiddenFindings:[],bilingualSemanticConsistency:'approved'}))};
    labels.labels[0].ranges.relevance=[1,4];
    await writeFile(approvalPath,JSON.stringify(labels));
    const wide=await start(root,['--resume','--require-blind-approval']).done;
    assert.notEqual(wide.code,0);
    assert.match(wide.output,/ranges must be one level or adjacent levels/);
    labels.labels[0].ranges.relevance=[2,2];
    await writeFile(approvalPath,JSON.stringify(labels));
    const completed=await start(root,['--resume','--require-blind-approval']).done;
    assert.equal(completed.code,0,completed.output);
    const evidence=JSON.parse(await readFile(report(root),'utf8'));
    assert.equal(evidence.collectedResults,60);
    for(const item of blind)assert.equal(evidence.results.find(result=>result.caseId===item.caseId).inputChecksum,item.inputChecksum);
    assert.equal(JSON.parse(await readFile(join(root,'v3-3','fake-label-freeze.json'),'utf8')).contractVersion,'3.3.0');
    labels.labels[0].ranges.relevance=[3,3];
    await writeFile(approvalPath,JSON.stringify(labels));
    const changed=await start(root,['--resume','--require-blind-approval']).done;
    assert.notEqual(changed.code,0);
    assert.match(changed.output,/Blind approval changed after feedback began/);
    const latePacket=await start(root,['--analysis-only','--resume']).done;
    assert.notEqual(latePacket.code,0);
    assert.match(latePacket.output,/Blind packet cannot be created after feedback results exist/);
  }finally{await rm(root,{recursive:true,force:true});}
});
