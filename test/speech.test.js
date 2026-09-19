import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {harness,setup} from './helpers.js';
const upload={audio:Buffer.from('synthetic audio fixture').toString('base64'),mimeType:'audio/webm'};
test('voice transcript is reviewed before becoming an attempt and audio is cleaned',async t=>{
 let path;const speechProvider={name:'test speech',async transcribe(args){path=args.audioPath;assert.equal(await readFile(path,'utf8'),'synthetic audio fixture');return {transcript:'I would compare alternatives before deciding.'};}};
 const {api,directory}=await harness(t,undefined,{speechProvider});const {record}=await setup(api);
 const draft=await api(`/records/${record.id}/transcription`,upload);assert.equal(draft.status,200);assert.equal(draft.data.inputMode,'voice');
 assert.deepEqual(await readdir(join(directory,'temporary-audio')),[]);await assert.rejects(readFile(path));
 assert.equal((await api(`/records/${record.id}`)).data.attempts.length,0);
 const transcript=draft.data.transcript+' I would then test assumptions.';
 assert.equal((await api(`/records/${record.id}/attempts`,{transcript,transcriptDraftId:draft.data.id})).status,200);
 const r=(await api(`/records/${record.id}/feedback`,{})).data;assert.equal(r.attempts[0].inputMode,'voice');assert.equal(r.attempts[0].transcript,transcript);assert.ok(transcript.includes(r.attempts[0].feedback.ratings.support.quote));assert.equal(r.transcriptDraft,undefined);
 const persisted=await readFile(join(directory,'workspace.json'),'utf8');assert.ok(!persisted.includes(upload.audio));assert.ok(!persisted.includes('synthetic audio fixture'));
});
test('speech failure cleans audio, preserves state, and permits retry or text fallback',async t=>{
 let fail=true;const speechProvider={name:'test speech',async transcribe(){if(fail)throw Error('outage');return {transcript:'I would validate requirements.'};}};
 const {api,directory}=await harness(t,undefined,{speechProvider});const {record}=await setup(api);const before=(await api(`/records/${record.id}`)).data;
 assert.equal((await api(`/records/${record.id}/transcription`,upload)).status,502);assert.deepEqual((await api(`/records/${record.id}`)).data,before);assert.deepEqual(await readdir(join(directory,'temporary-audio')),[]);
 fail=false;assert.equal((await api(`/records/${record.id}/transcription`,upload)).status,200);
 const saved=(await api(`/records/${record.id}/attempts`,{transcript:'Text fallback instead.'})).data;assert.equal(saved.attempts[0].inputMode,'text');assert.equal(saved.transcriptDraft,undefined);
});
test('invalid speech output and audio input cannot create an attempt',async t=>{
 const {api,directory}=await harness(t,undefined,{speechProvider:{name:'invalid',async transcribe(){return {transcript:'',accentScore:4};}}});const {record}=await setup(api);
 assert.equal((await api(`/records/${record.id}/transcription`,upload)).status,502);assert.deepEqual(await readdir(join(directory,'temporary-audio')),[]);
 assert.equal((await api(`/records/${record.id}/transcription`,{...upload,audio:'%%%'})).status,400);
 assert.equal((await api(`/records/${record.id}/transcription`,{...upload,mimeType:'text/html'})).status,400);
 assert.equal((await api(`/records/${record.id}`)).data.attempts.length,0);
});
test('voice revision uses the same comparison and completion workflow as text',async t=>{
 const {api}=await harness(t,undefined,{speechProvider:{name:'fixture',async transcribe(){return {transcript:'I would test assumptions and compare alternatives.'};}}});const {record}=await setup(api);
 await api(`/records/${record.id}/attempts`,{transcript:'I would test.'});await api(`/records/${record.id}/feedback`,{});
 const draft=(await api(`/records/${record.id}/transcription`,upload)).data;
 assert.equal((await api(`/records/${record.id}/reference`)).status,409);
 await api(`/records/${record.id}/attempts`,{transcript:draft.transcript,transcriptDraftId:draft.id});await api(`/records/${record.id}/feedback`,{});
 const comparison=(await api(`/records/${record.id}/comparison`)).data;assert.deepEqual(comparison.attempts.map(a=>a.inputMode),['text','voice']);
 assert.equal((await api(`/records/${record.id}/complete`,{focusPoint:'State assumptions'})).data.status,'completed');
});
