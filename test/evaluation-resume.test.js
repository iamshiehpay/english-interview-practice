import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

const project=join(dirname(fileURLToPath(import.meta.url)),'..');
const checkpoint=root=>join(root,'checkpoints','v3-1.json');
const report=root=>join(root,'results','v3-1.json');
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
    assert.equal(evidence.reusedResults,reused);
    assert.equal(evidence.newResults,60-reused);
    assert.equal(evidence.providerCalls,60-reused);
    assert.equal(evidence.collectedResults,60);
    assert.equal(new Set(evidence.results.map(item=>`${item.caseId}:${item.repeat}`)).size,60);
    assert.equal(evidence.stability.pass,true);
    const replayed=await start(root,['--resume']).done;
    assert.equal(replayed.code,0,replayed.output);
    const replay=JSON.parse(await readFile(report(root),'utf8'));
    assert.equal(replay.providerCalls,0);
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
