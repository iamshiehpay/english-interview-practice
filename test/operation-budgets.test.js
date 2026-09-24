import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness,setup} from './helpers.js';
import {FakeLanguageModel} from '../src/providers.js';
import {AppError} from '../src/domain.js';
import {withValidationRetry} from '../src/operations.js';
import {operationBudgets} from '../src/server.js';

// Generating a question set on a real ~3.5 KB JD took about 2m45s with Codex, and a
// validation rejection asks the model a second time, so an analysis whose first output
// was rejected always outran the single-call 180 s budget and surfaced as TIMEOUT.
// Question-set generation now has its own budget sized for two attempts; everything
// else keeps the single-call budget. Budgets here are scaled down (ms, not minutes).
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const operation=async(api,kind)=>(await api('/operations')).data.filter(o=>o.kind===kind).at(-1);
const BUDGETS={operationTimeoutMs:150,generationTimeoutMs:600};

test('an analysis rejected once and accepted on retry finishes within the generation budget, beyond the single-call budget',async t=>{
  const provider=new FakeLanguageModel(),analyze=provider.analyze.bind(provider);let calls=0;
  provider.analyze=async args=>{calls++;await delay(110);const value=await analyze(args);if(calls===1)value.questions[0].meaningZh='English only';return value;};
  const {api}=await harness(t,provider,BUDGETS);
  const snapshot=(await api('/snapshots',{text:'Build reliable Python APIs.\nExplain engineering trade-offs.'})).data;
  const started=Date.now(),response=await api(`/snapshots/${snapshot.id}/analysis`,{}),elapsed=Date.now()-started;
  assert.equal(response.status,200);assert.equal(calls,2);assert.ok(elapsed>BUDGETS.operationTimeoutMs,`took ${elapsed} ms`);
  const op=await operation(api,'analysis');assert.equal(op.state,'succeeded');assert.equal(op.validationRetries,1);
  assert.equal(op.firstRejection,'Invalid provider output: analysis questions[0].meaningZh has no Han characters');
});

test('adding questions to a set shares the generation budget',async t=>{
  const provider=new FakeLanguageModel(),additional=provider.additionalQuestions.bind(provider);let calls=0;
  const {api}=await harness(t,provider,BUDGETS);const {snapshot}=await setup(api);
  provider.additionalQuestions=async args=>{calls++;await delay(110);const value=await additional(args);if(calls===1)value.questions.at(-1).meaningZh='English only';return value;};
  const response=await api(`/snapshots/${snapshot.id}/questions`,{});
  assert.equal(response.status,200);assert.equal(calls,2);assert.equal(response.data.questions.length,12);
  assert.equal((await operation(api,'questions')).validationRetries,1);
});

test('feedback keeps the single-call budget',async t=>{
  const provider=new FakeLanguageModel(),feedback=provider.feedback.bind(provider);
  const {api}=await harness(t,provider,BUDGETS);const {record}=await setup(api);
  await api(`/records/${record.id}/attempts`,{transcript:'I would validate inputs and test the failure path first.'});
  provider.feedback=async args=>{await delay(250);return feedback(args);};
  assert.equal((await api(`/records/${record.id}/feedback`,{})).status,504);
  const op=await operation(api,'feedback');assert.equal(op.state,'failed');assert.equal(op.errorCode,'TIMEOUT');
});

test('a rejection too late in the budget for a second attempt fails with its own reason, not TIMEOUT',async t=>{
  const provider=new FakeLanguageModel(),feedback=provider.feedback.bind(provider);let calls=0;
  const {api}=await harness(t,provider,{operationTimeoutMs:300,logRejectedOutput:()=>{}});const {record}=await setup(api);
  await api(`/records/${record.id}/attempts`,{transcript:'I would validate inputs and test the failure path first.'});
  provider.feedback=async args=>{calls++;await delay(200);const value=await feedback(args);value.ratings.support.quote='misquote';return value;};
  const response=await api(`/records/${record.id}/feedback`,{});
  assert.equal(response.status,502);assert.equal(calls,1);assert.equal(response.data.error,'Invalid provider output: feedback ratings.support.quote not in transcript');
  const op=await operation(api,'feedback');assert.equal(op.errorCode,'OPERATION_FAILED');assert.equal(op.errorMessage,'Invalid provider output: feedback ratings.support.quote not in transcript');
  assert.equal(op.validationRetries,undefined);assert.equal(op.validationRetrySkipped,true);
  await delay(150);assert.equal(calls,1);
});

test('withValidationRetry retries only when the time left fits another attempt as long as the first',async()=>{
  const bad=()=>{throw new AppError('Invalid provider output: x',502);};let calls=0;
  const slow=async()=>{calls++;await delay(60);return calls;};
  const seen=[];
  await assert.rejects(withValidationRetry(slow,bad,{deadline:Date.now()+100,onRejection:(error,output,attempt,retrying)=>seen.push([attempt,retrying])}),{message:'Invalid provider output: x'});
  assert.equal(calls,1);assert.deepEqual(seen,[[1,false]]);
  calls=0;seen.length=0;
  assert.equal(await withValidationRetry(slow,value=>value===1?bad():value,{deadline:Date.now()+1000,onRejection:(error,output,attempt,retrying)=>seen.push([attempt,retrying])}),2);
  assert.deepEqual(seen,[[1,true]]);
});

test('operation budgets default by provider, allow two generation attempts and stay within their caps',async t=>{
  assert.deepEqual(operationBudgets({COACH_LANGUAGE_PROVIDER:'codex'}),{operationTimeoutMs:180000,generationTimeoutMs:360000});
  assert.deepEqual(operationBudgets({COACH_LANGUAGE_PROVIDER:'claude'}),{operationTimeoutMs:90000,generationTimeoutMs:180000});
  assert.deepEqual(operationBudgets({}),{operationTimeoutMs:30000,generationTimeoutMs:60000});
  assert.deepEqual(operationBudgets({COACH_LANGUAGE_PROVIDER:'codex',COACH_TIMEOUT_MS:'120000'}),{operationTimeoutMs:120000,generationTimeoutMs:240000});
  assert.deepEqual(operationBudgets({COACH_LANGUAGE_PROVIDER:'codex',COACH_GENERATION_TIMEOUT_MS:'420000'}),{operationTimeoutMs:180000,generationTimeoutMs:420000});
  assert.deepEqual(operationBudgets({COACH_TIMEOUT_MS:'300000'}),{operationTimeoutMs:300000,generationTimeoutMs:600000});
  await assert.rejects(harness(t,undefined,{generationTimeoutMs:600001}),/Generation timeout must be between 10 and 600000/);
  await assert.rejects(harness(t,undefined,{generationTimeoutMs:5}),/Generation timeout must be between 10 and 600000/);
  const {api}=await harness(t,undefined,{operationTimeoutMs:300000});assert.equal((await api('/providers')).status,200);
});
