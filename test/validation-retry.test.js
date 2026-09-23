import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {harness,setup} from './helpers.js';
import {FakeLanguageModel} from '../src/providers.js';
import {AppError,validateFeedback,validateAnalysis,validateCorrections,validateMockSummary,validateFollowUp,validateCoaching} from '../src/domain.js';
import {withValidationRetry} from '../src/operations.js';

// An intermittent rejection of one misquoted field used to surface as one combined
// message with no field named and no second chance. These tests pin the field-level
// message (content-free) and the single automatic retry recorded on the operation.
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const ANSWER='PRIVATE_ANSWER_SENTINEL I would validate inputs and test the failure path first.';
const fake=new FakeLanguageModel();
const feedbackFor=transcript=>fake.feedback({transcript});
const rejects=(fn,message)=>assert.throws(fn,error=>{assert.equal(error.status,502);assert.equal(error.message,`Invalid provider output: ${message}`);assert.equal(error.reason,error.message);return true;});
async function feedbackRun(t,provider,options={}){
  const logged=[];const {api,directory}=await harness(t,provider,{logRejectedOutput:line=>logged.push(line),...options});const {record}=await setup(api);
  await api(`/records/${record.id}/attempts`,{transcript:ANSWER});return {api,directory,record,logged};
}
const operation=async(api,kind)=>(await api('/operations')).data.find(o=>o.kind===kind);

test('validator messages name the first failing field and check, never the content',async()=>{
  const good=await feedbackFor(ANSWER);assert.ok(validateFeedback(good,ANSWER));
  const mutate=change=>{const value=structuredClone(good);change(value);return value;};
  rejects(()=>validateFeedback(mutate(v=>{v.ratings.support.quote='SECRET misquote';}),ANSWER),'feedback ratings.support.quote not in transcript');
  rejects(()=>validateFeedback(mutate(v=>{v.strength.textZh='English only';}),ANSWER),'feedback strength.textZh has no Han characters');
  rejects(()=>validateFeedback(mutate(v=>{v.ratings.structure.level=5;}),ANSWER),'feedback ratings.structure.level out of range');
  rejects(()=>validateFeedback(mutate(v=>{delete v.ratings.support.reasonZh;}),ANSWER),'feedback ratings.support missing or extra fields');
  rejects(()=>validateFeedback(mutate(v=>{v.priorityImprovement.quote='';}),ANSWER),'feedback priorityImprovement.quote empty');
  rejects(()=>validateFeedback(mutate(v=>{v.ratings.relevance.reason='只有中文';}),ANSWER),'feedback ratings.relevance.reason has no Latin characters');
  rejects(()=>validateFeedback(mutate(v=>{delete v.ratings.englishExpression;}),ANSWER),'feedback ratings missing or extra fields');
  rejects(()=>validateCorrections({corrections:[{original:'not said',rewrite:'Fine.',reasonZh:'說明'}]},ANSWER),'corrections[0].original not in transcript');
  rejects(()=>validateCorrections({corrections:[{original:'test the failure path',rewrite:'test 3 failure paths',reasonZh:'說明'}]},ANSWER),'corrections[0].rewrite has an invented number');
  const summary=await fake.mockSummary({answers:[{transcript:ANSWER}]});
  rejects(()=>validateMockSummary({...summary,priorityImprovement:{...summary.priorityImprovement,quote:'elsewhere'}},[ANSWER]),'session summary priorityImprovement.quote not in any answer');
  rejects(()=>validateFollowUp({text:'Why?',meaningZh:'Why?'}),'follow-up meaningZh has no Han characters');
  rejects(()=>validateCoaching({text:'English hint',explanationZh:'提示'},'hint'),'coaching text has no Han characters');
  const snapshot={text:'Build reliable Python APIs.\nExplain engineering trade-offs.'},analysis=await fake.analyze({snapshot});
  analysis.questions[2].meaningZh='English masquerading as Chinese';
  rejects(()=>validateAnalysis(analysis,snapshot),'analysis questions[2].meaningZh has no Han characters');
  for(const bad of [mutate(v=>{v.ratings.support.quote='SECRET misquote';})])try{validateFeedback(bad,ANSWER);}catch(error){assert.ok(!error.message.includes('SECRET')&&!error.message.includes('PRIVATE'));}
});

test('a misquoted feedback output is regenerated once and the retry is recorded without content',async t=>{
  const provider=new FakeLanguageModel(),original=provider.feedback.bind(provider);let calls=0;
  provider.feedback=async args=>{calls++;const value=await original(args);if(calls===1)value.ratings.support.quote='REJECTED_QUOTE_SENTINEL';return value;};
  const {api,directory,record,logged}=await feedbackRun(t,provider);
  const response=await api(`/records/${record.id}/feedback`,{});
  assert.equal(response.status,200);assert.equal(calls,2);assert.ok(response.data.attempts[0].feedback.ratings.support.quote);
  const op=await operation(api,'feedback');
  assert.equal(op.state,'succeeded');assert.equal(op.validationRetries,1);assert.equal(op.firstRejection,'Invalid provider output: feedback ratings.support.quote not in transcript');
  assert.equal(logged.length,1);assert.match(logged[0],/^\[provider-output-rejected\] feedback attempt 1 of 2: Invalid provider output: feedback ratings\.support\.quote not in transcript/);assert.ok(logged[0].includes('REJECTED_QUOTE_SENTINEL'));
  const saved=await readFile(join(directory,'workspace.json'),'utf8');
  assert.ok(!saved.includes('REJECTED_QUOTE_SENTINEL'));assert.ok(!saved.includes('provider-output-rejected'));
});

test('follow-up question generation and follow-up feedback also get one validation retry',async t=>{
  const provider=new FakeLanguageModel(),followUp=provider.followUp.bind(provider),feedback=provider.feedback.bind(provider);let followUps=0,feedbacks=0;
  const {api,record}=await feedbackRun(t,provider);assert.equal((await api(`/records/${record.id}/feedback`,{})).status,200);
  provider.followUp=async args=>++followUps===1?{text:'English only',meaningZh:'English only'}:followUp(args);
  const node=(await api(`/records/${record.id}/follow-ups`,{})).data;assert.equal(followUps,2);
  assert.equal((await operation(api,'follow-up')).firstRejection,'Invalid provider output: follow-up meaningZh has no Han characters');
  provider.feedback=async args=>{const value=await feedback(args);if(++feedbacks===1)value.strength.textZh='No Han here';return value;};
  await api(`/records/${record.id}/follow-ups/${node.id}/attempt`,{transcript:'I would test the timeout path first.'});
  assert.equal((await api(`/records/${record.id}/follow-ups/${node.id}/feedback`,{})).data.status,'completed');assert.equal(feedbacks,2);
  const op=await operation(api,'follow-up-feedback');assert.equal(op.validationRetries,1);assert.equal(op.firstRejection,'Invalid provider output: feedback strength.textZh has no Han characters');
});

test('two invalid outputs fail with the second field-level reason and no answer text',async t=>{
  const provider=new FakeLanguageModel(),original=provider.feedback.bind(provider);let calls=0;
  provider.feedback=async args=>{calls++;const value=await original(args);if(calls===1)value.ratings.support.quote='first misquote';else value.strength.textZh='still English';return value;};
  const {api,directory,record}=await feedbackRun(t,provider);
  const response=await api(`/records/${record.id}/feedback`,{});
  assert.equal(response.status,502);assert.equal(calls,2);assert.equal(response.data.error,'Invalid provider output: feedback strength.textZh has no Han characters');assert.equal(response.data.retryable,true);
  assert.match(response.data.error,/Invalid provider output|schema|citation/i);
  const op=await operation(api,'feedback');
  assert.equal(op.state,'failed');assert.equal(op.errorCode,'OPERATION_FAILED');assert.equal(op.errorMessage,'Invalid provider output: feedback strength.textZh has no Han characters');
  assert.equal(op.validationRetries,1);assert.equal(op.firstRejection,'Invalid provider output: feedback ratings.support.quote not in transcript');
  assert.equal((await api(`/records/${record.id}`)).data.attempts[0].feedback,null);
  const operations=JSON.stringify((await api('/operations')).data)+JSON.stringify(JSON.parse(await readFile(join(directory,'workspace.json'),'utf8')).operations);
  for(const secret of ['PRIVATE_ANSWER_SENTINEL','first misquote','still English'])assert.ok(!operations.includes(secret)&&!JSON.stringify(response.data).includes(secret));
});

test('cancelling during the retry cancels cleanly with no further call',async t=>{
  const provider=new FakeLanguageModel(),original=provider.feedback.bind(provider);let calls=0,signal;
  provider.feedback=async args=>{calls++;if(calls===1){const value=await original(args);value.ratings.support.quote='misquote';return value;}signal=args.signal;return new Promise(()=>{});};
  const {api,record}=await feedbackRun(t,provider);
  const request=api(`/records/${record.id}/feedback`,{});
  for(let i=0;i<100&&calls<2;i++)await delay(5);assert.equal(calls,2);
  const op=await operation(api,'feedback');await api(`/operations/${op.id}/cancel`,{});
  assert.equal((await request).status,409);assert.equal(signal.aborted,true);await delay(20);assert.equal(calls,2);
  const cancelled=await operation(api,'feedback');assert.equal(cancelled.state,'cancelled');assert.equal(cancelled.validationRetries,1);
  assert.equal((await api(`/records/${record.id}`)).data.attempts[0].feedback,null);
});

test('withValidationRetry does not call again once the operation is aborted',async()=>{
  const controller=new AbortController();let calls=0;
  const call=async()=>{calls++;controller.abort(new AppError('Operation cancelled',409));return {bad:true};};
  const validate=()=>{throw new AppError('Invalid provider output: feedback ratings missing or extra fields',502);};
  await assert.rejects(withValidationRetry(call,validate,{signal:controller.signal}),{status:409});assert.equal(calls,1);
  let seen=[];assert.deepEqual(await withValidationRetry(async()=>++calls,value=>{if(value===2)throw new AppError('Invalid provider output: x',502);return value;},{onRejection:(error,output,attempt)=>seen.push([error.message,output,attempt])}),3);
  assert.deepEqual(seen,[['Invalid provider output: x',2,1]]);
  await assert.rejects(withValidationRetry(async()=>1,()=>{throw new AppError('A session with no answers has nothing to assess',409);}),{status:409});
});

test('provider errors that are not validation failures are never retried',async t=>{
  const provider=new FakeLanguageModel();let calls=0,failure;provider.feedback=async()=>{calls++;throw failure;};
  const {api,record,logged}=await feedbackRun(t,provider);
  for(const [error,status] of [[new AppError('Provider operation timed out; retry your original action',504),504],[new AppError('Sign in to Codex again',401),401],[new AppError('Codex isolation fingerprint changed',428),428],[new AppError('Provider rate limit; retry later',429),429],[new Error('socket hang up'),502]]){
    calls=0;failure=error;assert.equal((await api(`/records/${record.id}/feedback`,{})).status,status);assert.equal(calls,1);
    const op=(await api('/operations')).data.filter(o=>o.kind==='feedback').at(-1);assert.equal(op.validationRetries,undefined);assert.equal(op.firstRejection,undefined);
  }
  provider.feedback=args=>{calls++;return new Promise(()=>{});};calls=0;
  const slow=await feedbackRun(t,provider,{operationTimeoutMs:40});assert.equal((await slow.api(`/records/${slow.record.id}/feedback`,{})).status,504);await delay(20);assert.equal(calls,1);
  assert.deepEqual(logged,[]);
});
