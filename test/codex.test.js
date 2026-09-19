import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough,Writable} from 'node:stream';
import {mkdtemp,rm,readdir,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {CodexLanguageModel} from '../src/codex-language.js';
import {processEnvironment,profileConfig} from '../src/codex-profile.js';
import {FakeLanguageModel} from '../src/providers.js';
import {harness,setup} from './helpers.js';
const fake=new FakeLanguageModel();
async function provider(t,options={}){
 const outer=await mkdtemp(join(tmpdir(),'coach-codex-test-')),profile=join(outer,'.coach-codex');t.after(()=>rm(outer,{recursive:true,force:true}));
 const calls=[],processes=[];
 const spawnProcess=(_binary,args,config)=>{
  const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.killed=false;
  child.kill=()=>{if(!child.killed){child.killed=true;if(!options.refuseExit)queueMicrotask(()=>child.emit('close',0));}return true;};
  const emit=m=>{const line=JSON.stringify(m)+'\r\n';child.stdout.write(line.slice(0,7));child.stdout.write(line.slice(7));};
  child.stdin=new Writable({write(data,_enc,done){
   for(const line of data.toString().trim().split('\n')){const m=JSON.parse(line);calls.push(m);
    Promise.resolve().then(async()=>{
     if(options.hang===m.method)return;
     let result={};
     if(m.method==='account/read')result={account:options.account===undefined?{type:'chatgpt',email:'PRIVATE_EMAIL',planType:'plus'}:options.account,requiresOpenaiAuth:true};
     if(m.method==='thread/start')result={thread:{id:'thread-'+processes.length,ephemeral:true,path:null,environments:[]},model:m.params.model,modelProvider:'openai',approvalPolicy:'never',sandbox:{type:'readOnly',networkAccess:false},instructionSources:[],runtimeWorkspaceRoots:[],multiAgentMode:'explicitRequestOnly',activePermissionProfile:null,cwd:config.cwd,...options.start};
     if(m.method==='turn/start'){
      if(options.attack==='tool'){emit({method:'item/started',params:{item:{type:'commandExecution'}}});return;}
      if(options.attack==='request'){emit({id:900,method:'item/commandExecution/requestApproval',params:{secret:'TOKEN'}});return;}
      if(options.attack==='malformed'){child.stdout.write('not JSON\n');return;}
      if(options.attack==='oversized'){child.stdout.write('x'.repeat(2_000_001));return;}
      const input=JSON.parse(m.params.input[0].text);
      let value=input.jobDescription?await fake.analyze({snapshot:{text:input.jobDescription}}):input.primaryQuestion?await fake.followUp(input):await fake.feedback(input);
      if(options.badQuote&&value.ratings)value.ratings.support.quote='invented';
      result={turn:{id:'turn1'}};emit({id:m.id,result});
      emit({method:'item/completed',params:{threadId:m.params.threadId,turnId:'turn1',item:{type:'agentMessage',phase:'final_answer',text:JSON.stringify(value)}}});
      if(options.duplicate)emit({method:'item/completed',params:{threadId:m.params.threadId,turnId:'turn1',item:{type:'agentMessage',phase:'final_answer',text:JSON.stringify(value)}}});
      emit({method:'turn/completed',params:{threadId:m.params.threadId,turn:{id:'turn1',status:'completed'}}});return;
     }
     if(m.id!==undefined&&m.method)emit({id:m.id,result});
    }).catch(error=>child.emit('error',error));
   }done();
  }});
  processes.push({child,args,config});return child;
 };
 const p=new CodexLanguageModel({profile,verifyVersion:false,spawnProcess,timeoutMs:options.timeoutMs||500});return {p,calls,processes,profile};
}
test('Codex protocol uses fresh ephemeral sessions, exact minimal inputs and isolated environment',async t=>{
 const {p,calls,processes,profile}=await provider(t);
 assert.deepEqual(await p.status(),{provider:p.name,authenticated:true,loginRequired:false,verified:false,ready:false});
 await p.analyze({snapshot:{text:'Build APIs',secret:'PRIVATE_RESUME'}});
 await p.feedback({question:{id:'q'},transcript:'I would test failures.',approvedEvidence:[{excerpt:'Approved excerpt',secret:'PRIVATE_RESUME'}]});
 await p.followUp({primaryQuestion:{text:'How would you build it?',meaningZh:'你會怎麼建構？',rationale:'PRIVATE_RATIONALE'},primaryAnswer:{transcript:'I would test failures.',feedback:{priorityImprovement:{text:'PRIVATE_FEEDBACK'}},coaching:'PRIVATE_COACHING'},previousFollowUps:[{question:{text:'Why?',meaningZh:'為什麼？',rationale:'PRIVATE_RATIONALE'},answer:{transcript:'Because risk matters.',feedback:'PRIVATE_FEEDBACK'}}]});
 const turns=calls.filter(c=>c.method==='turn/start');assert.equal(turns.length,3);
 const inputs=turns.map(t=>{const {_retentionMarker,...context}=JSON.parse(t.params.input[0].text);assert.match(_retentionMarker,/^COACH_RUNTIME_CANARY_/);return context;});
 assert.deepEqual(inputs[0],{jobDescription:'Build APIs',difficulty:'standard'});
 assert.deepEqual(inputs[1],{question:{id:'q'},transcript:'I would test failures.',approvedEvidence:[{excerpt:'Approved excerpt'}]});
 assert.deepEqual(inputs[2],{primaryQuestion:{text:'How would you build it?',meaningZh:'你會怎麼建構？'},primaryAnswer:{transcript:'I would test failures.'},previousFollowUps:[{question:{text:'Why?',meaningZh:'為什麼？'},answer:{transcript:'Because risk matters.'}}]});
 assert.ok(!JSON.stringify(turns).includes('PRIVATE_RESUME'));assert.ok(!JSON.stringify(turns).includes('PRIVATE_FEEDBACK'));assert.ok(!JSON.stringify(turns).includes('PRIVATE_COACHING'));assert.ok(!JSON.stringify(turns).includes('PRIVATE_RATIONALE'));assert.ok(turns.every(c=>c.params.outputSchema.additionalProperties===false));
 assert.equal(new Set(calls.filter(c=>c.method==='thread/delete').map(c=>c.params.threadId)).size,3);
 for(const proc of processes){assert.equal(proc.config.env.CODEX_HOME,profile);assert.equal(proc.config.shell,false);assert.ok(proc.child.killed);await assert.rejects(readdir(proc.config.cwd),{code:'ENOENT'});}
 assert.equal(processEnvironment(profile,{PATH:'/bin',HOME:'/safe',OPENAI_API_KEY:'SECRET',NODE_OPTIONS:'--import evil',CODEX_HOME:'global'}).OPENAI_API_KEY,undefined);
 assert.ok(profileConfig.includes('shell_tool = false'));assert.ok(profileConfig.includes('skip_host_skill_discovery = true'));
});
test('Codex rejects missing/wrong account and untrusted isolation responses before sending a transcript',async t=>{
 for(const account of [null,{type:'apiKey'},{type:'amazonBedrock'}]){const {p,calls}=await provider(t,{account});await assert.rejects(p.feedback({question:{},transcript:'private'}),{status:401});assert.ok(!calls.some(c=>c.method==='thread/start'));}
 for(const start of [{instructionSources:['/private/AGENTS.md']},{thread:{id:'t',ephemeral:false,path:'/rollout'}},{sandbox:{type:'readOnly',networkAccess:true}},{runtimeWorkspaceRoots:['/private']}]){const {p,calls}=await provider(t,{start});await assert.rejects(p.feedback({question:{},transcript:'private'}),{status:503});assert.ok(!calls.some(c=>c.method==='turn/start'));}
});
test('Codex aborts tools, interactive requests, malformed or oversized output and duplicate finals',async t=>{
 for(const options of [{attack:'tool'},{attack:'request'},{attack:'malformed'},{attack:'oversized'},{duplicate:true}]){const {p,processes}=await provider(t,options);await assert.rejects(p.feedback({question:{},transcript:'private'}),{status:502});assert.ok(processes.every(p=>p.child.killed));}
});
test('Codex timeout and cancellation terminate the process and remove temporary directories',async t=>{
 const {p,processes}=await provider(t,{hang:'account/read',timeoutMs:30});await assert.rejects(p.status(),{status:504});assert.ok(processes[0].child.killed);
 const b=await provider(t,{hang:'turn/start'}),controller=new AbortController();const pending=b.p.feedback({question:{},transcript:'private',signal:controller.signal});setTimeout(()=>controller.abort(),30);await assert.rejects(pending,{status:409});assert.ok(b.calls.some(c=>c.method==='thread/delete'));assert.ok(b.processes[0].child.killed);
});
test('Codex uses existing HTTP validation: bad quote cannot persist, retry succeeds',async t=>{
 const options={badQuote:true},{p}=await provider(t,options);const {api}=await harness(t,p);const {record}=await setup(api);
 await api(`/records/${record.id}/attempts`,{transcript:'I would test failures.'});assert.equal((await api(`/records/${record.id}/feedback`,{})).status,502);
 assert.equal((await api(`/records/${record.id}`)).data.attempts[0].feedback,null);options.badQuote=false;assert.equal((await api(`/records/${record.id}/feedback`,{})).status,200);
});

test('private input is blocked without current isolation evidence; status strips identity',async t=>{
 const {p,calls}=await provider(t);p.verifyVersion=true;
 await assert.rejects(p.feedback({question:{},transcript:'PRIVATE'}),{status:428});assert.equal(calls.length,0);
 p.verifyVersion=false;const {api}=await harness(t,p);const status=await api('/providers/language-status');assert.equal(status.status,200);assert.equal(status.data.authenticated,true);assert.ok(!JSON.stringify(status.data).includes('PRIVATE_EMAIL'));assert.ok(!JSON.stringify(status.data).includes('planType'));
});

test('unconfirmed process exit preserves temporary state instead of deleting under a live child',async t=>{
 const {p,processes}=await provider(t,{refuseExit:true});
 await assert.rejects(p.status(),{status:503});const cwd=processes[0].config.cwd;assert.ok(await readdir(cwd));
 await rm(join(cwd,'..'),{recursive:true,force:true});
});
