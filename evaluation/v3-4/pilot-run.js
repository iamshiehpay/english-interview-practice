import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {open,readFile,unlink,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CodexLanguageModel,CODEX_DEFAULT_MODEL,CODEX_DEFAULT_EFFORT,CODEX_DEFAULT_SERVICE_TIER} from '../../src/codex-language.js';
import {feedbackSchema} from '../../src/model-schemas.js';
import {validateFeedback} from '../../src/domain.js';
import {readAttemptLedger,reserveModelAttempt,writeAttemptLedger,writeJsonAtomic} from '../checkpoints.js';
import {candidateFeedbackContract,CANDIDATE_CONTRACT_VERSION} from './contract-candidate.js';

const root=dirname(fileURLToPath(import.meta.url));
const at=name=>join(root,name);
const sha=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const readJson=async name=>JSON.parse(await readFile(at(name),'utf8'));
const inputs=await readJson('pilot-inputs.json');
const packet=await readJson('pilot-blind-packet.json');
const expected=inputs.map(({caseId,question,transcript})=>({caseId,inputChecksum:sha({contractVersion:CANDIDATE_CONTRACT_VERSION,question,transcript}),contractVersion:CANDIDATE_CONTRACT_VERSION,question,transcript}));
assert.deepEqual(packet,expected,'Pilot blind packet differs from frozen inputs');
assert.equal(inputs.length,8,'Pilot requires eight inputs');
assert.equal(new Set(inputs.map(item=>item.caseId)).size,8,'Pilot case IDs must be unique');
const slots=packet.flatMap(item=>[1,2].map(repeat=>({caseId:item.caseId,repeat})));
assert.equal(slots.length,16,'Pilot request cap must be 16');
const execute=process.argv.includes('--execute');
const preflight=process.argv.includes('--preflight');
assert.ok(!(execute&&preflight),'Choose either --execute or --preflight');
if(!execute&&!preflight){
  console.log(JSON.stringify({mode:'dry-run',contractVersion:CANDIDATE_CONTRACT_VERSION,cases:packet.length,requestCap:slots.length,packetChecksum:sha(packet),promptChecksum:sha(candidateFeedbackContract),requires:'pre-feedback independent label approval; --execute --accept-subscription-usage after user approval'},null,2));
  process.exit(0);
}
if(execute)assert.ok(process.argv.includes('--accept-subscription-usage'),'Execution requires explicit --accept-subscription-usage');
const approval=await readJson('pilot-label-approval.json');
assert.equal(approval.schemaVersion,1);
assert.equal(approval.contractVersion,CANDIDATE_CONTRACT_VERSION);
assert.equal(approval.packetChecksum,sha(packet),'Label approval must match blind packet');
assert.ok(approval.approvedBy?.trim()&&Number.isFinite(Date.parse(approval.approvedAt)),'Independent pre-feedback approval required');
assert.equal(approval.blindToModelFeedback,true,'Label approval must precede and be blind to feedback');
assert.equal(approval.labels.length,packet.length,'All eight labels must be approved');
assert.deepEqual(approval.labels.map(({caseId,inputChecksum})=>({caseId,inputChecksum})),packet.map(({caseId,inputChecksum})=>({caseId,inputChecksum})),'Approved labels differ from packet');
for(const label of approval.labels){
  assert.deepEqual(Object.keys(label.ranges).sort(),['englishExpression','relevance','structure','support']);
  for(const range of Object.values(label.ranges))assert.ok(Array.isArray(range)&&range.length===2&&range.every(n=>Number.isInteger(n)&&n>=1&&n<=4)&&range[0]<=range[1]&&range[1]-range[0]<=1,'Invalid approved range');
  assert.ok(label.rationale?.trim()&&Array.isArray(label.evidenceQuotes)&&label.evidenceQuotes.length>0,'Approved label needs rationale and evidence');
  const item=packet.find(row=>row.caseId===label.caseId);
  assert.ok(label.evidenceQuotes.every(quote=>typeof quote==='string'&&quote&&item.transcript.includes(quote)),'Label evidence must quote transcript exactly');
}
const draftA=await readJson('label-draft-a.json'),draftB=await readJson('label-draft-b.json');
assert.deepEqual(approval.draftChecksums,{a:sha(draftA),b:sha(draftB)},'Approval must bind both independent drafts');
const model=new CodexLanguageModel({profile:process.env.COACH_CODEX_HOME,binary:process.env.COACH_CODEX_BIN||'codex',model:process.env.COACH_CODEX_MODEL||CODEX_DEFAULT_MODEL,effort:process.env.COACH_CODEX_EFFORT||CODEX_DEFAULT_EFFORT,serviceTier:process.env.COACH_CODEX_SERVICE_TIER??CODEX_DEFAULT_SERVICE_TIER});
const {stdout}=await promisify(execFile)(model.binary,['--version'],{timeout:5000,maxBuffer:10000});
const cliVersion=stdout.trim();
assert.match(cliVersion,/^codex-cli \S+$/,'Unrecognised Codex CLI version');
const sourceFiles=['pilot-run.js','contract-candidate.js','pilot-inputs.json','pilot-blind-packet.json','pilot-blind-rater-guide.md','../../src/model-contracts.js','../../src/codex-language.js','../../src/model-schemas.js','../../src/domain.js','../../src/codex-rpc.js','../../src/codex-profile.js'];
const sourceChecksums=Object.fromEntries(await Promise.all(sourceFiles.map(async name=>[name,sha(await readFile(at(name),'utf8'))])));
const freeze={schemaVersion:1,contractVersion:CANDIDATE_CONTRACT_VERSION,requestCap:16,packetChecksum:sha(packet),approvalChecksum:sha(approval),promptChecksum:sha(candidateFeedbackContract),sourceChecksums,model:model.model,effort:model.effort,serviceTier:model.serviceTier,cliVersion};
if(preflight){console.log(JSON.stringify({mode:'preflight',freeze,approvedLabels:approval.labels.length,requestCap:16},null,2));process.exit(0);}
const freezePath=at('pilot-freeze.json'),statePath=at('pilot-results.json'),ledgerPath=at('pilot-attempts.json'),lockPath=at('pilot-run.lock');
let lock;
try{lock=await open(lockPath,'wx',0o600);}catch(error){if(error.code==='EEXIST')throw Error('Pilot already running or stale lock requires manual review');throw error;}
try{
  let savedFreeze,state;
  try{savedFreeze=await readJson('pilot-freeze.json');assert.deepEqual(savedFreeze,freeze,'Pilot source, labels or model configuration changed after freeze');state=await readJson('pilot-results.json');}
  catch(error){
    if(error.code!=='ENOENT')throw error;
    try{await writeFile(freezePath,JSON.stringify(freeze,null,2)+'\n',{flag:'wx'});}catch(writeError){if(writeError.code!=='EEXIST')throw writeError;throw Error('Partial pilot freeze requires manual review');}
    state={schemaVersion:1,freezeChecksum:sha(freeze),slots:{}};
    await writeJsonAtomic(statePath,state);
    await writeAttemptLedger(ledgerPath,{identity:freeze,attempts:[]});
  }
  assert.equal(state.schemaVersion,1);
  assert.equal(state.freezeChecksum,sha(freeze),'Pilot state identity changed');
  assert.ok(Object.values(state.slots).every(slot=>slot.status==='completed'),'Interrupted or failed pilot slot requires manual review; no further model calls');
  const attempts=[];
  const recorded=await readAttemptLedger(ledgerPath,{identity:freeze});
  assert.ok(recorded.length<=16,'Pilot request cap exceeded');
  assert.ok(Object.keys(state.slots).length>=recorded.length,'Attempt ledger exceeds recorded slots; manual review required');
  const feedbackPairs=feedback=>[
    ...['relevance','support','structure','englishExpression'].map(name=>[`${name} reason`,feedback.ratings[name].reason,feedback.ratings[name].reasonZh]),
    ['strength',feedback.strength.text,feedback.strength.textZh],
    ['priority improvement',feedback.priorityImprovement.text,feedback.priorityImprovement.textZh]
  ];
  for(const slot of slots){
    const key=`${slot.caseId}:${slot.repeat}`;
    if(state.slots[key])continue; // A reserved, failed, or interrupted slot is never retried.
    state.slots[key]={status:'reserved',reservedAt:new Date().toISOString()};
    await writeJsonAtomic(statePath,state);
    await reserveModelAttempt(ledgerPath,{identity:freeze,attempts,kind:'feedback',limit:16});
    const item=packet.find(row=>row.caseId===slot.caseId);
    let raw;
    try{
      raw=await model.json(candidateFeedbackContract,{question:item.question,transcript:item.transcript,approvedEvidence:[]},feedbackSchema);
      const feedback=validateFeedback(raw,item.transcript);
      const pairs=feedbackPairs(feedback);
      const automaticErrors=pairs.flatMap(([name,en,zh])=>typeof en!=='string'||!en.trim()||typeof zh!=='string'||!/\p{Script=Han}/u.test(zh)||en.normalize('NFKC').trim()===zh.normalize('NFKC').trim()?[`${name}: missing or untranslated counterpart`]:[]);
      assert.deepEqual(automaticErrors,[],'Automatic bilingual checks failed');
      state.slots[key]={status:'completed',reservedAt:state.slots[key].reservedAt,completedAt:new Date().toISOString(),caseId:slot.caseId,repeat:slot.repeat,inputChecksum:item.inputChecksum,outputChecksum:sha({contractVersion:CANDIDATE_CONTRACT_VERSION,caseId:slot.caseId,repeat:slot.repeat,question:item.question,feedback}),feedback,automaticBilingualPairs:pairs.map(([name,en,zh])=>({name,en,zh}))};
      await writeJsonAtomic(statePath,state);
      console.log(`${key}: saved`);
    }catch(error){
      state.slots[key]={status:'failed',reservedAt:state.slots[key].reservedAt,failedAt:new Date().toISOString(),caseId:slot.caseId,repeat:slot.repeat,error:error.message,...(raw?{rawOutput:raw}:{})};
      await writeJsonAtomic(statePath,state);
      throw Error(`${key}: ${error.message}; no retry attempted`);
    }
  }
  console.log(JSON.stringify({saved:Object.values(state.slots).filter(slot=>slot.status==='completed').length,requestCap:16,attempts:(await readAttemptLedger(ledgerPath,{identity:freeze})).length,output:statePath},null,2));
}finally{await lock.close();await unlink(lockPath);}
