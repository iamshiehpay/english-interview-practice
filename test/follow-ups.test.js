import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {harness,setup} from './helpers.js';
import {FakeLanguageModel} from '../src/providers.js';
import {OpenAILanguageModel} from '../src/cloud.js';
import {LocalWorkspace} from '../src/store.js';

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function keyed(base,path,data,id){
  const response=await fetch(base+'/api'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Request-Id':id},body:JSON.stringify(data)});
  return {status:response.status,data:await response.json()};
}
async function pending(api,kind){
  for(let i=0;i<100;i++){
    const operation=(await api('/operations')).data.find(value=>value.state==='pending'&&value.kind===kind);
    if(operation)return operation;
    await delay(5);
  }
  throw Error(`No pending ${kind} operation`);
}
async function primaryFeedback(api,record,transcript='I would validate requests and test failures.'){
  await api(`/records/${record.id}/attempts`,{transcript});
  return (await api(`/records/${record.id}/feedback`,{})).data;
}

test('bounded follow-ups preserve primary attempts and frozen formal context',async t=>{
  const provider=new FakeLanguageModel(),calls=[];
  const original=provider.followUp.bind(provider);
  provider.followUp=async input=>{calls.push(structuredClone(input));return original(input);};
  const {api,base}=await harness(t,provider);const {record}=await setup(api);
  assert.deepEqual(record.followUps,[]);
  assert.equal((await api(`/records/${record.id}/follow-ups`,{})).status,409);
  const primary=await primaryFeedback(api,record);
  provider.coach=async()=>({text:'只使用你真正做過的內容。',explanationZh:'這是回答提示。'});
  await api(`/records/${record.id}/coaching`,{mode:'hint'});
  const beforeAttempts=structuredClone(primary.attempts);

  const first=(await keyed(base,`/records/${record.id}/follow-ups`,{},'follow-up-generate-1')).data;
  assert.equal(first.status,'answer');assert.ok(first.question.text);assert.ok(first.question.meaningZh);
  assert.deepEqual(first.primaryAnswerSnapshot,{attemptId:beforeAttempts[0].id,transcript:beforeAttempts[0].transcript,feedback:beforeAttempts[0].feedback,capturedAt:first.createdAt});
  assert.deepEqual(first.previousFollowUpsSnapshot,[]);
  assert.ok(!JSON.stringify(calls[0]).includes('只使用你真正做過的內容'));
  assert.deepEqual(Object.keys(calls[0]).sort(),['previousFollowUps','primaryAnswer','primaryQuestion','signal'].sort());
  assert.deepEqual(calls[0].primaryAnswer,{transcript:beforeAttempts[0].transcript});
  assert.deepEqual(calls[0].primaryQuestion,{text:primary.question.text,meaningZh:primary.question.meaningZh});
  assert.ok(!JSON.stringify(calls[0]).includes('priorityImprovement'));
  assert.deepEqual((await api(`/records/${record.id}`)).data.attempts,beforeAttempts);
  assert.equal((await keyed(base,`/records/${record.id}/follow-ups`,{},'follow-up-generate-1')).data.id,first.id);
  assert.equal((await api(`/records/${record.id}/follow-ups`,{})).status,409);

  const answered=(await api(`/records/${record.id}/follow-ups/${first.id}/attempt`,{transcript:'I would test authentication failures first.',submissionId:'follow-up-answer-1'})).data;
  assert.equal(answered.status,'feedback');assert.equal(answered.attempt.feedback,null);
  assert.equal((await api(`/records/${record.id}/follow-ups/${first.id}/attempt`,{transcript:'I would test authentication failures first.',submissionId:'follow-up-answer-1'})).data.attempt.id,answered.attempt.id);
  const firstDone=(await keyed(base,`/records/${record.id}/follow-ups/${first.id}/feedback`,{},'follow-up-feedback-1')).data;
  assert.equal(firstDone.status,'completed');assert.ok(firstDone.attempt.feedback.priorityImprovement.textZh);

  await api(`/records/${record.id}/attempts`,{transcript:'My revised primary answer uses a staged rollout.'});
  await api(`/records/${record.id}/feedback`,{});
  const second=(await api(`/records/${record.id}/follow-ups`,{})).data;
  assert.deepEqual(second.primaryAnswerSnapshot,first.primaryAnswerSnapshot);
  assert.equal(second.previousFollowUpsSnapshot.length,1);
  assert.deepEqual(second.previousFollowUpsSnapshot[0].attempt,firstDone.attempt);
  assert.deepEqual(calls[1].primaryAnswer,{transcript:first.primaryAnswerSnapshot.transcript});
  assert.deepEqual(calls[1].previousFollowUps,[{question:first.question,answer:{transcript:firstDone.attempt.transcript}}]);
  assert.ok(!JSON.stringify(calls[1]).includes('priorityImprovement'));
  const persistedFirst=(await api(`/records/${record.id}`)).data.followUps[0];
  assert.deepEqual(persistedFirst.primaryAnswerSnapshot,first.primaryAnswerSnapshot);
  assert.equal((await api(`/records/${record.id}`)).data.attempts.length,2);
  assert.equal((await api(`/records/${record.id}/follow-ups`,{})).status,409);
  await api(`/records/${record.id}/follow-ups/${second.id}/attempt`,{transcript:'I would revisit the rollout threshold.'});
  assert.equal((await api(`/records/${record.id}/follow-ups/${second.id}/feedback`,{})).data.status,'completed');
});

test('follow-up provider failures retry atomically and completed records reject late writes',async t=>{
  const provider=new FakeLanguageModel();const original=provider.followUp.bind(provider);let bad=true;
  provider.followUp=async input=>bad?{text:'English only',meaningZh:'English only'}:original(input);
  const {api,base}=await harness(t,provider);const {record}=await setup(api);await primaryFeedback(api,record);
  assert.equal((await keyed(base,`/records/${record.id}/follow-ups`,{},'follow-up-retry-1')).status,502);
  assert.deepEqual((await api(`/records/${record.id}`)).data.followUps,[]);
  bad=false;const followUp=(await keyed(base,`/records/${record.id}/follow-ups`,{},'follow-up-retry-1')).data;
  await api(`/records/${record.id}/complete`,{focusPoint:'Explain one concrete trade-off'});
  assert.equal((await api(`/records/${record.id}/follow-ups/${followUp.id}/attempt`,{transcript:'A late answer'})).status,409);
  assert.equal((await api(`/records/${record.id}/follow-ups`,{})).status,409);
  assert.equal((await api(`/records/${record.id}`)).data.followUps[0].attempt,null);
});

test('cancellation and deletion prevent late follow-up writes, and persistence contains no coaching context',async t=>{
  const provider=new FakeLanguageModel();const original=provider.followUp.bind(provider);let resolve;
  provider.followUp=input=>new Promise(done=>{resolve=()=>original(input).then(done);});
  const {api,directory}=await harness(t,provider);const {record}=await setup(api);await primaryFeedback(api,record,'I use one true formal answer.');
  const request=api(`/records/${record.id}/follow-ups`,{});const operation=await pending(api,'follow-up');
  await api(`/operations/${operation.id}/cancel`,{});assert.equal((await request).status,409);await resolve();await delay(10);
  assert.deepEqual((await api(`/records/${record.id}`)).data.followUps,[]);

  let resolveDeleted;provider.followUp=input=>new Promise(done=>{resolveDeleted=()=>original(input).then(done);});
  const deletedRequest=api(`/records/${record.id}/follow-ups`,{});await pending(api,'follow-up');
  await api(`/records/${record.id}`,undefined,'DELETE');assert.equal((await deletedRequest).status,409);await resolveDeleted();await delay(10);
  assert.equal((await api(`/records/${record.id}`)).status,404);
  const saved=await readFile(join(directory,'workspace.json'),'utf8');
  assert.equal(JSON.parse(saved).records[record.id],undefined);
});

test('completion waits for submitted follow-up feedback and rejects post-completion writes',async t=>{
  const provider=new FakeLanguageModel();const originalFeedback=provider.feedback.bind(provider);let hold=false,resolve;
  provider.feedback=input=>hold?new Promise(done=>{resolve=()=>originalFeedback(input).then(done);}):originalFeedback(input);
  const {api}=await harness(t,provider);const {record}=await setup(api);await primaryFeedback(api,record);
  const followUp=(await api(`/records/${record.id}/follow-ups`,{})).data;
  await api(`/records/${record.id}/follow-ups/${followUp.id}/attempt`,{transcript:'I would start with the highest-risk failure.'});
  hold=true;const request=api(`/records/${record.id}/follow-ups/${followUp.id}/feedback`,{});await pending(api,'follow-up-feedback');
  assert.equal((await api(`/records/${record.id}/complete`,{focusPoint:'Add an explicit validation result'})).status,409);
  await resolve();assert.equal((await request).status,200);await delay(10);
  assert.equal((await api(`/records/${record.id}/complete`,{focusPoint:'Add an explicit validation result'})).status,200);
  assert.equal((await api(`/records/${record.id}/follow-ups/${followUp.id}/feedback`,{})).status,409);
  const saved=(await api(`/records/${record.id}`)).data;
  assert.equal(saved.status,'completed');assert.equal(saved.followUps[0].status,'completed');assert.ok(saved.followUps[0].attempt.feedback);
});

test('follow-ups survive workspace reopen and legacy records without followUps can start the flow',async t=>{
  const {api,directory,store}=await harness(t);const current=await setup(api);await primaryFeedback(api,current.record);
  const followUp=(await api(`/records/${current.record.id}/follow-ups`,{})).data;
  await api(`/records/${current.record.id}/follow-ups/${followUp.id}/attempt`,{transcript:'I would validate the riskiest assumption first.'});
  const completed=(await api(`/records/${current.record.id}/follow-ups/${followUp.id}/feedback`,{})).data;
  const reopened=await new LocalWorkspace(directory).open();
  assert.deepEqual(reopened.data.records[current.record.id].followUps[0],completed);

  const legacy=await setup(api);await store.transact(data=>{delete data.records[legacy.record.id].followUps;});
  assert.equal((await api(`/records/${legacy.record.id}`)).data.followUps,undefined);
  await primaryFeedback(api,legacy.record,'I would keep the legacy record compatible.');
  const generated=(await api(`/records/${legacy.record.id}/follow-ups`,{})).data;
  assert.equal(generated.status,'answer');assert.equal((await api(`/records/${legacy.record.id}`)).data.followUps.length,1);
});

test('OpenAI follow-up adapter strips feedback, coaching and non-question metadata',async()=>{
  const requests=[];
  const provider=new OpenAILanguageModel({apiKey:'test-key',fetcher:async(_url,options)=>{requests.push(JSON.parse(options.body));return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({text:'Which failure would you test first?',meaningZh:'你會先測試哪一種失敗？'})}}]}),{status:200});}});
  await provider.followUp({
    primaryQuestion:{text:'How would you build it?',meaningZh:'你會怎麼建構？',rationale:'PRIVATE_RATIONALE'},
    primaryAnswer:{transcript:'I would test failures.',feedback:{priorityImprovement:{text:'PRIVATE_FEEDBACK'}},coaching:'PRIVATE_COACHING'},
    previousFollowUps:[{question:{text:'Why?',meaningZh:'為什麼？',rationale:'PRIVATE_RATIONALE'},answer:{transcript:'Because risk matters.',feedback:'PRIVATE_FEEDBACK'}}]
  });
  const context=JSON.parse(requests[0].messages[1].content);
  assert.deepEqual(context,{primaryQuestion:{text:'How would you build it?',meaningZh:'你會怎麼建構？'},primaryAnswer:{transcript:'I would test failures.'},previousFollowUps:[{question:{text:'Why?',meaningZh:'為什麼？'},answer:{transcript:'Because risk matters.'}}]});
  assert.ok(!requests[0].messages[1].content.includes('PRIVATE_'));
});
