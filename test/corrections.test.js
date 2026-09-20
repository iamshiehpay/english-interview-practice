import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness,setup} from './helpers.js';
import {FakeLanguageModel} from '../src/providers.js';

const NORMAL='I would measure query latency and compare the execution plans.';

async function answered(api,record,transcript=NORMAL){
  await api(`/records/${record.id}/attempts`,{transcript});
  await api(`/records/${record.id}/feedback`,{});
  return (await api(`/records/${record.id}`)).data;
}

test('key-sentence corrections are stored separately, quote the learner, and preserve facts',async t=>{
  const provider=new FakeLanguageModel(),inputs=[];
  const original=provider.corrections.bind(provider);
  provider.corrections=async input=>{inputs.push(structuredClone({...input,signal:undefined}));return original(input);};
  const {api}=await harness(t,provider);const {record}=await setup(api);
  const attempt=(await answered(api,record)).attempts.at(-1);

  const result=(await api(`/records/${record.id}/corrections`,{attemptId:attempt.id})).data;
  assert.equal(result.id,attempt.id);
  assert.ok(Array.isArray(result.corrections)&&result.corrections.length>=1&&result.corrections.length<=2);
  for(const item of result.corrections){
    assert.ok(NORMAL.includes(item.original),'original must be a verbatim substring of the learner transcript');
    assert.ok(/[A-Za-z]/.test(item.rewrite),'rewrite is English');
    assert.ok(/\p{Script=Han}/u.test(item.reasonZh),'reason is Traditional Chinese');
  }
  // Stored separately from Answer Attempts (attempts remain unchanged).
  const stored=(await api(`/records/${record.id}`)).data;
  assert.equal(stored.attempts.length,1);
  assert.equal(stored.attempts[0].corrections,undefined);
  assert.deepEqual(stored.corrections[attempt.id].corrections,result.corrections);

  // Payload minimization at the server seam: the provider only receives the
  // question and the learner's own transcript — never feedback, ratings or coaching.
  assert.equal(inputs.length,1);
  assert.deepEqual(Object.keys(inputs[0]).sort(),['question','signal','transcript']);
  assert.equal(inputs[0].transcript,NORMAL);
  assert.equal(inputs[0].question.feedback,undefined);
  assert.equal(inputs[0].question.ratings,undefined);
});

test('external adapters send only the question text and transcript for corrections',async t=>{
  const {OpenAILanguageModel}=await import('../src/cloud.js');
  let body;
  const fetcher=async(_url,options)=>{body=JSON.parse(options.body);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({corrections:[]})}}]}),{headers:{'Content-Type':'application/json'}});};
  const model=new OpenAILanguageModel({apiKey:'test-key',fetcher});
  await model.corrections({question:{id:'q1',text:'Explain a trade-off.',meaningZh:'請說明取捨。',rationale:'x',evidence:'y'},transcript:NORMAL});
  const sent=JSON.parse(body.messages.at(-1).content);
  assert.deepEqual(sent,{question:{text:'Explain a trade-off.'},transcript:NORMAL});
});

test('no-change path returns zero corrections without fabrication',async t=>{
  const {api}=await harness(t);const {record}=await setup(api);
  const attempt=(await answered(api,record,'Yes.')).attempts.at(-1);
  const result=(await api(`/records/${record.id}/corrections`,{attemptId:attempt.id})).data;
  assert.deepEqual(result.corrections,[]);
});

test('corrections require completed feedback and a real attempt',async t=>{
  const {api}=await harness(t);const {record}=await setup(api);
  assert.equal((await api(`/records/${record.id}/corrections`,{attemptId:'nope'})).status,404);
  await api(`/records/${record.id}/attempts`,{transcript:NORMAL});
  const beforeFeedback=(await api(`/records/${record.id}`)).data.attempts.at(-1);
  assert.equal((await api(`/records/${record.id}/corrections`,{attemptId:beforeFeedback.id})).status,409);
  assert.equal((await api(`/records/${record.id}/corrections`,{})).status,400);
});

test('corrections are idempotent and retry after a provider failure',async t=>{
  const provider=new FakeLanguageModel();let fail=true;
  const original=provider.corrections.bind(provider);
  provider.corrections=async input=>{if(fail){fail=false;throw new Error('synthetic provider failure');}return original(input);};
  const {api}=await harness(t,provider);const {record}=await setup(api);
  const attempt=(await answered(api,record)).attempts.at(-1);
  assert.equal((await api(`/records/${record.id}/corrections`,{attemptId:attempt.id})).status,502);
  const retry=(await api(`/records/${record.id}/corrections`,{attemptId:attempt.id})).data;
  assert.ok(retry.corrections.length>=1);
  // Second success replays the cached result rather than regenerating.
  const again=(await api(`/records/${record.id}/corrections`,{attemptId:attempt.id})).data;
  assert.deepEqual(again,retry);
});

test('evidence-safety: invalid corrections output is rejected without writing the record',async t=>{
  const provider=new FakeLanguageModel();
  const {api}=await harness(t,provider);const {record}=await setup(api);
  const attempt=(await answered(api,record)).attempts.at(-1);
  const bad=[
    {corrections:[{original:'a sentence the learner never wrote',rewrite:'A rewrite.',reasonZh:'原句不在回答中。'}]},
    {corrections:[{original:NORMAL,rewrite:'I improved latency by 42 percent.',reasonZh:'加入了原句沒有的數字。'}]},
    {corrections:[{original:NORMAL,rewrite:'One.',reasonZh:'一。'},{original:NORMAL,rewrite:'Two.',reasonZh:'二。'},{original:NORMAL,rewrite:'Three.',reasonZh:'三。'}]},
    {corrections:[{original:NORMAL,rewrite:'只有中文沒有英文。',reasonZh:'改寫必須是英文。'}]}
  ];
  for(const output of bad){
    provider.corrections=async()=>structuredClone(output);
    assert.equal((await api(`/records/${record.id}/corrections`,{attemptId:attempt.id})).status,502,JSON.stringify(output));
    assert.equal((await api(`/records/${record.id}`)).data.corrections,undefined,'no partial write');
  }
});

test('a follow-up formal answer can also surface corrections',async t=>{
  const {api}=await harness(t);const {record}=await setup(api);
  await answered(api,record);
  const followUp=(await api(`/records/${record.id}/follow-ups`,{})).data;
  await api(`/records/${record.id}/follow-ups/${followUp.id}/attempt`,{transcript:'I would test the riskiest failure mode first and confirm the result.'});
  await api(`/records/${record.id}/follow-ups/${followUp.id}/feedback`,{});
  const node=(await api(`/records/${record.id}`)).data.followUps[0];
  const result=(await api(`/records/${record.id}/corrections`,{attemptId:node.attempt.id})).data;
  assert.equal(result.id,node.attempt.id);
  assert.ok(result.corrections.length>=1);
  const stored=(await api(`/records/${record.id}`)).data;
  assert.ok(stored.corrections[node.attempt.id]);
});

test('old records without corrections stay readable and are not auto-evaluated',async t=>{
  const {api}=await harness(t);const {record}=await setup(api);
  await answered(api,record);
  const reopened=(await api(`/records/${record.id}`)).data;
  assert.equal(reopened.corrections,undefined,'reading a record never generates corrections');
});
