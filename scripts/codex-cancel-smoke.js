import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {lstat} from 'node:fs/promises';
import {dirname} from 'node:path';
import {CodexLanguageModel} from '../src/codex-language.js';
if(!process.argv.includes('--accept-subscription-usage'))throw Error('Explicit subscription usage opt-in required');
const controller=new AbortController();let child,runtime,started=false;
const provider=new CodexLanguageModel({spawnProcess:(binary,args,options)=>{
 child=spawn(binary,args,options);runtime=dirname(options.cwd);let buffer='';
 child.stdout.on('data',data=>{buffer+=data.toString();for(let i;(i=buffer.indexOf('\n'))>=0;){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);let m;try{m=JSON.parse(line);}catch{continue;}if(m.method==='turn/started'){started=true;controller.abort();}}});return child;
}});
await assert.rejects(provider.feedback({question:{id:'cancel',text:'Explain testing.',category:'technical-communication',capabilityIds:['c'],evidence:'Test APIs.',rationale:'Synthetic cancellation test.'},transcript:'I would test invalid input and service timeouts.',signal:controller.signal}),{status:409});
assert.ok(started);assert.throws(()=>process.kill(child.pid,0),{code:'ESRCH'});await assert.rejects(lstat(runtime),{code:'ENOENT'});console.log('PASS real Codex turn cancellation: process exited and temporary directory removed.');
