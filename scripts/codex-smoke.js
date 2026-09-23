// Explicit opt-in: three subscription calls, synthetic text only; never creator evidence.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApplication} from '../src/server.js';
import {CodexLanguageModel} from '../src/codex-language.js';
if(!process.argv.includes('--accept-subscription-usage'))throw Error('Pass --accept-subscription-usage for three synthetic model calls');
const directory=await mkdtemp(join(tmpdir(),'coach-subscription-smoke-'));let server;
try{
 ({server}=await createApplication({directory,languageModel:new CodexLanguageModel(),operationTimeoutMs:180000}));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const api=async(path,data)=>{const res=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});const result=await res.json();assert.equal(res.status,200,JSON.stringify(result));return result;};
 const snapshot=await api('/snapshots',{text:'Software Engineer. Build reliable Python APIs. Explain engineering trade-offs. Collaborate with product teams. Test invalid input and service failures.'});
 const analysis=await api(`/snapshots/${snapshot.id}/analysis`,{});console.log('PASS subscription JD analysis:',analysis.questions.length,'questions');
 const record=await api('/records',{snapshotId:snapshot.id,questionId:analysis.questions.find(q=>q.category==='technical-communication').id});
 for(const transcript of ['I have not built a production API. I would test invalid inputs.','I have not built a production API. I would validate invalid inputs first, then simulate timeouts because clients need predictable failures. For example, a missing field should return a clear error instead of crashing.']){
  await api(`/records/${record.id}/attempts`,{transcript});await api(`/records/${record.id}/feedback`,{});console.log('PASS subscription feedback and exact-quote validation');
 }
 assert.equal((await api(`/records/${record.id}/comparison`)).attempts.length,2);assert.equal((await api(`/records/${record.id}/complete`,{focusPoint:'Explain an approach with a concrete example'})).status,'completed');console.log('PASS synthetic Practice Loop; not a creator validation loop.');
}finally{if(server)await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});}
