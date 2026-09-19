import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness,setup} from './helpers.js';
async function complete(api,record,focus='Explain trade-offs'){
 for(const transcript of ['I built a prototype.','I built a prototype and compared alternatives.']){await api(`/records/${record.id}/attempts`,{transcript});await api(`/records/${record.id}/feedback`,{});}
 return (await api(`/records/${record.id}/complete`,{focusPoint:focus})).data;
}
test('one-off, explicit confirmation, rejection and two distinct loops govern recurrence',async t=>{
 const {api}=await harness(t);const {record,snapshot,analysis}=await setup(api);await complete(api,record);
 let pattern=(await api('/progress')).data[0];assert.equal(pattern.recurring,false);assert.equal(pattern.evidence.length,1);
 await api(`/records/${record.id}/complete`,{focusPoint:'Explain trade-offs'});assert.equal((await api('/progress')).data[0].recurring,false);
 pattern=(await api(`/progress/${pattern.id}`,{action:'confirm'})).data;assert.equal(pattern.recurring,true);
 assert.equal((await api(`/progress/${pattern.id}`,{action:'status',status:'improving'})).data.status,'improving');
 await api(`/progress/${pattern.id}`,{action:'reject'});assert.equal((await api('/progress')).data[0].recurring,false);
 const second=(await api('/records',{snapshotId:snapshot.id,questionId:analysis.questions[1].id})).data;await complete(api,second,'EXPLAIN trade-offs!');
 assert.equal((await api('/progress')).data[0].recurring,false);
 await api(`/progress/${pattern.id}`,{action:'confirm'});assert.equal((await api('/progress')).data[0].evidence.length,2);
 assert.equal((await api(`/progress/${pattern.id}`,{action:'status',status:'resolved'})).data.status,'resolved');
});
test('automatic promotion, recommendation and deletion keep evidence consistent',async t=>{
 const {api}=await harness(t);const first=await setup(api);await complete(api,first.record);
 const second=(await api('/records',{snapshotId:first.snapshot.id,questionId:first.analysis.questions[4].id})).data;await complete(api,second);
 let pattern=(await api('/progress')).data[0];assert.equal(pattern.recurring,true);assert.equal(pattern.confirmed,false);
 const view=(await api(`/snapshots/${first.snapshot.id}/analysis`)).data;assert.ok(view.recommendation.reason.includes('Focus Point'));assert.equal((await api('/records',{snapshotId:first.snapshot.id,questionId:view.questions[3].id})).status,200);
 await api(`/records/${first.record.id}`,undefined,'DELETE');pattern=(await api('/progress')).data[0];assert.equal(pattern.recurring,false);assert.deepEqual(pattern.evidence.map(e=>e.recordId),[second.id]);
 assert.ok(Object.values((await api('/evidence')).data.claims).every(c=>c.recordId!==first.record.id));
 await api(`/records/${second.id}`,undefined,'DELETE');assert.deepEqual((await api('/progress')).data,[]);
});
test('delete all requires exact confirmation and removes profiles/evidence/runs/progress and snapshots',async t=>{
 const {api}=await harness(t);const {record}=await setup(api);await complete(api,record);await api('/evidence/import',{text:'Built a service.'});await api('/discovery',{});
 const before=(await api('/workspace')).data;assert.equal((await api('/workspace/delete',{confirmation:'yes'})).status,400);assert.deepEqual((await api('/workspace')).data,before);
 assert.equal((await api('/workspace/delete',{confirmation:'DELETE ALL LOCAL DATA'})).status,200);assert.deepEqual((await api('/workspace')).data,{version:1,snapshots:{},analyses:{},records:{}});assert.deepEqual((await api('/progress')).data,[]);assert.deepEqual((await api('/evidence')).data,{sources:{},claims:{}});
});
test('confirmation/status persist through process restart and completed focus is immutable',async t=>{
 const {spawn}=await import('node:child_process');const {api,server,directory}=await harness(t);const {record}=await setup(api);await complete(api,record);
 const pattern=(await api('/progress')).data[0];await api(`/progress/${pattern.id}`,{action:'confirm'});await api(`/progress/${pattern.id}`,{action:'status',status:'improving'});
 assert.equal((await api(`/records/${record.id}/complete`,{focusPoint:'Different historical claim'})).status,409);
 const expected=(await api('/progress')).data;await new Promise(r=>server.close(r));
 const child=spawn(process.execPath,['src/server.js'],{env:{...process.env,WORKSPACE_DIR:directory,PORT:'0'},stdio:['ignore','pipe','pipe']});t.after(()=>child.kill());
 const url=await new Promise((resolve,reject)=>{child.stdout.on('data',d=>{const m=d.toString().match(/http:\/\/127.0.0.1:\d+/);if(m)resolve(m[0]);});child.on('error',reject);});
 assert.deepEqual(await(await fetch(url+'/api/progress')).json(),expected);
 const deletion=await fetch(url+'/api/workspace/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmation:'DELETE ALL LOCAL DATA'})});assert.equal(deletion.status,200);
 assert.deepEqual(await(await fetch(url+'/api/progress')).json(),[]);
});
