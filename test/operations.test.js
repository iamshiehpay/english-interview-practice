import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {harness,setup} from './helpers.js';
import {FakeLanguageModel} from '../src/providers.js';
import {OpenAILanguageModel,configuredProviders} from '../src/cloud.js';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function pending(api){for(let i=0;i<100;i++){const op=(await api('/operations')).data.find(o=>o.state==='pending');if(op)return op;await delay(5);}throw Error('No pending operation');}
async function keyed(base,path,data,id){const response=await fetch(base+'/api'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Request-Id':id},body:JSON.stringify(data)});return {status:response.status,data:await response.json()};}
test('cancelled analysis cannot write after late provider resolution and same request retries safely',async t=>{
 const p=new FakeLanguageModel(),original=p.analyze.bind(p);let resolve;let signal;
 p.analyze=args=>{signal=args.signal;return new Promise(r=>{resolve=()=>original(args).then(r);});};
 const {api,base}=await harness(t,p);const s=(await api('/snapshots',{text:'Build APIs'})).data;
 const request=keyed(base,`/snapshots/${s.id}/analysis`,{},'analysis-request-1');const op=await pending(api);
 assert.equal((await keyed(base,`/snapshots/${s.id}/analysis`,{},'analysis-request-1')).status,409);
 await api(`/operations/${op.id}/cancel`,{});assert.equal((await request).status,409);assert.equal(signal.aborted,true);
 await resolve();await delay(10);assert.equal((await api('/workspace')).data.analyses[s.id],undefined);
 p.analyze=original;assert.equal((await keyed(base,`/snapshots/${s.id}/analysis`,{},'analysis-request-1')).status,200);
 const before=(await api('/workspace')).data;assert.equal((await keyed(base,`/snapshots/${s.id}/analysis`,{},'analysis-request-1')).status,200);assert.deepEqual((await api('/workspace')).data,before);
});
test('model timeout retains attempt and late feedback cannot attach; metadata excludes transcript',async t=>{
 const p=new FakeLanguageModel();let resolve;const original=p.feedback.bind(p);p.feedback=args=>new Promise(r=>{resolve=()=>original(args).then(r);});
 const {api,directory}=await harness(t,p,{operationTimeoutMs:80});const {record}=await setup(api);await api(`/records/${record.id}/attempts`,{transcript:'PRIVATE_TRANSCRIPT_SENTINEL'});
 assert.equal((await api(`/records/${record.id}/feedback`,{})).status,504);await resolve();await delay(10);
 assert.equal((await api(`/records/${record.id}`)).data.attempts[0].feedback,null);
 const ops=(await api('/operations')).data;assert.ok(ops.some(o=>o.errorCode==='TIMEOUT'&&o.retryable));assert.ok(!JSON.stringify(ops).includes('PRIVATE_TRANSCRIPT_SENTINEL'));
 assert.ok(JSON.parse(await readFile(join(directory,'workspace.json'),'utf8')).operations);
});
test('delete all cancels late transcription without resurrecting data or retaining audio',async t=>{
 let resolve;const speechProvider={name:'deferred',transcribe:()=>new Promise(r=>{resolve=()=>r({transcript:'late transcript'});})};
 const {api,directory}=await harness(t,undefined,{speechProvider});const {record}=await setup(api);
 const request=api(`/records/${record.id}/transcription`,{audio:Buffer.from('audio').toString('base64'),mimeType:'audio/webm'});await pending(api);
 await api('/workspace/delete',{confirmation:'DELETE ALL LOCAL DATA'});assert.equal((await request).status,409);resolve?.();await delay(20);
 assert.deepEqual((await api('/workspace')).data,{version:1,snapshots:{},analyses:{},records:{}});assert.deepEqual(await readdir(join(directory,'temporary-audio')),[]);assert.deepEqual((await api('/operations')).data,[]);
});
test('snapshot delete cascades only related data and strips resume links',async t=>{
 const {api}=await harness(t);const a=await setup(api),b=await setup(api);const c=(await api('/evidence/import',{text:'Built APIs'})).data.claims[0];await api(`/evidence/${c.id}`,{status:'approved',capabilityLinks:[{snapshotId:a.snapshot.id,capabilityId:'c1'}]});
 await api(`/records/${a.record.id}/attempts`,{transcript:'I built a prototype.'});
 assert.equal((await api(`/snapshots/${a.snapshot.id}`,undefined,'DELETE')).status,200);assert.equal((await api(`/records/${a.record.id}`)).status,404);assert.equal((await api(`/snapshots/${b.snapshot.id}`)).status,200);assert.deepEqual((await api('/evidence')).data.claims[c.id].capabilityLinks,[]);
});
test('cloud adapter sends minimal DTO and never stores or returns credentials/provider body errors',async t=>{
 const key='SECRET_KEY_SENTINEL',requests=[];const p=new OpenAILanguageModel({apiKey:key,fetcher:async(url,options)=>{requests.push({url,options});return new Response(JSON.stringify({error:key}),{status:500});}});
 const {api,directory}=await harness(t,p);const s=(await api('/snapshots',{text:'Build APIs'})).data;await api('/evidence/import',{text:'RESUME_SENTINEL'});
 const failure=await api(`/snapshots/${s.id}/analysis`,{});assert.equal(failure.status,502);assert.ok(!JSON.stringify(failure).includes(key));
 const sent=JSON.parse(requests[0].options.body);assert.equal(sent.store,false);assert.deepEqual(JSON.parse(sent.messages[1].content),{jobDescription:'Build APIs',difficulty:'standard'});assert.ok(!requests[0].options.body.includes('RESUME_SENTINEL'));
 for(const path of ['/health','/providers','/workspace','/operations'])assert.ok(!JSON.stringify((await api(path)).data).includes(key));assert.ok(!(await readFile(join(directory,'workspace.json'),'utf8')).includes(key));
 assert.throws(()=>configuredProviders({COACH_LANGUAGE_PROVIDER:'openai'}));const disclosure=(await api('/providers')).data.languageModel;assert.ok(disclosure.external);assert.ok(disclosure.outbound.some(s=>s.includes('existing capability/question set')));
});
test('successful addition receipt replays without adding another batch',async t=>{
 const {api,base}=await harness(t);const {snapshot}=await setup(api);const path=`/snapshots/${snapshot.id}/questions`;
 const first=await keyed(base,path,{},'addition-request-1');assert.equal(first.data.questions.length,12);
 const replay=await keyed(base,path,{},'addition-request-1');assert.equal(replay.data.questions.length,12);
 assert.equal((await api(`/snapshots/${snapshot.id}/analysis`)).data.questions.length,12);
});
test('deleting record cancels pending feedback and prevents late report recreation',async t=>{
 const p=new FakeLanguageModel();let resolve;const original=p.feedback.bind(p);p.feedback=args=>new Promise(r=>{resolve=()=>original(args).then(r);});
 const {api}=await harness(t,p);const {record}=await setup(api);await api(`/records/${record.id}/attempts`,{transcript:'I built a service.'});
 const request=api(`/records/${record.id}/feedback`,{});const op=await pending(api);await api(`/records/${record.id}`,undefined,'DELETE');assert.equal((await request).status,409);await resolve();await delay(10);
 assert.equal((await api(`/records/${record.id}`)).status,404);assert.equal((await api('/operations')).data.find(o=>o.id===op.id).state,'cancelled');
});
test('restart reconciles orphan pending metadata without making external calls',async t=>{
 const {writeFile,mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {createApplication}=await import('../src/server.js');
 const directory=await mkdtemp(join(tmpdir(),'coach-interrupted-'));await writeFile(join(directory,'workspace.json'),JSON.stringify({version:1,snapshots:{},analyses:{},records:{},operations:{orphan:{id:'orphan',kind:'analysis',targetId:'missing',state:'pending',retryable:false}}}));
 let calls=0;const {server}=await createApplication({directory,languageModel:{name:'spy',analyze(){calls++;}}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});});
 const ops=await(await fetch(`http://127.0.0.1:${server.address().port}/api/operations`)).json();assert.equal(ops[0].state,'failed');assert.equal(ops[0].errorCode,'INTERRUPTED');assert.equal(ops[0].retryable,true);assert.equal(calls,0);
});
test('reserved identifiers cannot mutate object prototypes or create operation receipts',async t=>{
 const {api,base}=await harness(t);const {snapshot}=await setup(api);await api('/evidence/import',{text:'Built an API.'});
 assert.equal((await api('/evidence/__proto__',{status:'approved'})).status,404);
 assert.equal((await api('/snapshots/constructor')).status,404);
 assert.equal((await keyed(base,`/snapshots/${snapshot.id}/analysis`,{},'__proto__')).status,400);
 assert.equal((await api('/operations/constructor/cancel',{})).status,404);
});
test('a failed operation can be dismissed; an unknown operation cannot',async t=>{
 const provider=new FakeLanguageModel();provider.analyze=async()=>{throw new Error('boom');};
 const {api}=await harness(t,provider);const s=(await api('/snapshots',{text:'Build APIs'})).data;
 assert.equal((await api(`/snapshots/${s.id}/analysis`,{})).status,502);
 const failed=(await api('/operations')).data.find(o=>o.state==='failed');assert.ok(failed);
 assert.equal((await api(`/operations/${failed.id}`,undefined,'DELETE')).status,200);
 assert.equal((await api('/operations')).data.find(o=>o.id===failed.id),undefined);
 assert.equal((await api('/operations/does-not-exist',undefined,'DELETE')).status,404);
});
