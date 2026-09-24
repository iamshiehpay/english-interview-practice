import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {CodexLanguageModel,CODEX_DEFAULT_MODEL,CODEX_DEFAULT_EFFORT,CODEX_DEFAULT_SERVICE_TIER} from '../src/codex-language.js';
import {OpenAILanguageModel} from '../src/cloud.js';
import {createApplication} from '../src/server.js';
import {FakeLanguageModel} from '../src/providers.js';
import {validateAnalysis} from '../src/domain.js';
import {MODEL_CONTRACT_VERSION} from '../src/model-contracts.js';
import {jobGroundedAnalysis} from './job-grounded-analysis.js';
import {checkpointIdentity,readCheckpoint,writeCheckpoint,readAttemptLedger,writeAttemptLedger,reserveModelAttempt,writeJsonAtomic,oncePerKey} from './checkpoints.js';
import {validateManifest,checkAnalysis,checkFeedback,checkBilingualConsistency,automaticBilingualAuditPass,stability,checkFrozenAnalysis,inputChecksum,outputChecksum,labelStatus,compareLabelExpectations,evaluationGateSummary,semanticReviewStatus,creatorStatus,dimensions} from './checks.js';
const root=dirname(fileURLToPath(import.meta.url));
const readFixture=name=>readFile(join(root,'v1',name),'utf8').then(JSON.parse);
const optionValue=name=>{const index=process.argv.indexOf(name);if(index<0)return null;const value=process.argv[index+1];if(!value||value.startsWith('--'))throw Error(`${name} requires a path`);return resolve(value);};
const requestLimitOption=process.argv.indexOf('--max-total-model-requests');
const maxTotalModelRequests=requestLimitOption<0?65:Number(process.argv[requestLimitOption+1]);
if(!Number.isSafeInteger(maxTotalModelRequests)||maxTotalModelRequests<1||maxTotalModelRequests>999999)throw Error('--max-total-model-requests requires an integer from 1 to 999999');
if(maxTotalModelRequests>65&&!process.argv.includes('--accept-extra-model-usage'))throw Error('More than 65 model requests requires separate approval and --accept-extra-model-usage');
const outputRoot=optionValue('--output-root');
const artifactRoot=outputRoot||root;
const portfolioRoot=outputRoot?join(outputRoot,'portfolio'):join(root,'..','docs','portfolio');
const artifactVersion='v3-3';
const artifactDirectory=join(artifactRoot,artifactVersion);
const readArtifact=async(name,fallback)=>{try{return JSON.parse(await readFile(join(artifactDirectory,name),'utf8'));}catch(error){if(error.code==='ENOENT')return fallback;throw error;}};
const manifest=await readFixture('manifest.json');validateManifest(manifest);
if(MODEL_CONTRACT_VERSION!=='3.3.0')throw Error('Select a new artifact version for the changed model contract before evaluating.');
const subscription=process.argv.includes('--codex');
if(subscription&&process.argv.includes('--live'))throw Error('Choose only one live provider');
const live=subscription||process.argv.includes('--live');
const analysisOnly=process.argv.includes('--analysis-only');
const requireBlindApproval=live||process.argv.includes('--require-blind-approval');
if(analysisOnly&&process.argv.includes('--release'))throw Error('--analysis-only cannot enforce release gates');
if(subscription&&!process.argv.includes('--accept-subscription-usage'))throw Error(`Codex evaluation requires --accept-subscription-usage: up to ${maxTotalModelRequests} requests count toward your plan limits.`);
if(live&&!subscription&&!process.argv.includes('--accept-provider-cost'))throw Error(`Live evaluation requires --accept-provider-cost: up to ${maxTotalModelRequests} paid model requests using synthetic inputs.`);
const cloud=subscription?new CodexLanguageModel({profile:process.env.COACH_CODEX_HOME,binary:process.env.COACH_CODEX_BIN||'codex',model:process.env.COACH_CODEX_MODEL||CODEX_DEFAULT_MODEL,effort:process.env.COACH_CODEX_EFFORT||CODEX_DEFAULT_EFFORT,serviceTier:process.env.COACH_CODEX_SERVICE_TIER??CODEX_DEFAULT_SERVICE_TIER}):live?new OpenAILanguageModel({apiKey:process.env.OPENAI_API_KEY,model:process.env.COACH_MODEL||'gpt-4.1-mini'}):null;
const cliVersion=subscription?await promisify(execFile)(cloud.binary,['--version'],{timeout:5000,maxBuffer:10000}).then(({stdout})=>{const match=stdout.trim().match(/^codex-cli (\S+)$/);if(!match)throw Error(`Unrecognised Codex CLI version output: ${stdout.trim()}`);return match[1];},error=>{throw Error(`Codex CLI version check failed: ${error.message}`);}):null;
const frozenSettings=live?{model:cloud.model,effort:cloud.effort??null,serviceTier:cloud.serviceTier??null}:null;
const modeName=subscription?'codex-v3-3':live?'live-v3-3':'v3-3';
const evaluationConfiguration=live?{...(subscription?{cliVersion,effort:cloud.effort,serviceTier:cloud.serviceTier,ephemeral:true}:{temperature:0,maxCompletionTokens:5000}),analysisPolicy:'one live generation per JD, frozen across three feedback repeats',operationTimeoutMs:subscription?180000:30000}:null;
const codeHash=createHash('sha256');for(const file of ['run.js','checks.js','checkpoints.js','job-grounded-analysis.js','../src/common-questions.js','../src/server.js','../src/operations.js','../src/store.js','../src/domain.js','../src/providers.js','../src/cloud.js','../src/codex-language.js','../src/codex-profile.js','../src/codex-rpc.js','../src/codex-audit.js','../src/codex-sandbox.js','../src/codex-runtime.js','../src/model-contracts.js','../src/model-schemas.js','../src/resume.js','../src/progress.js','../src/evidence.js','../src/jobs.js','../src/speech.js','../src/recordings.js','../src/mock-sessions.js'])codeHash.update(await readFile(join(root,file)));
const codeChecksum=codeHash.digest('hex');
const results=[],failures=[],analyses=new Map();let providerCalls=0,analysisCalls=0,workspaces=0,blindApprovalFreeze=null;
let attempts,attemptLedgerFile,identity;
const analysisFile=join(artifactDirectory,`${subscription?'codex':'live'}-analysis.json`);
const jdChecksum=createHash('sha256').update(JSON.stringify(manifest.jobs)).digest('hex');
if(live&&!process.argv.includes('--refresh-analysis')){
  try{const frozen=JSON.parse(await readFile(analysisFile,'utf8'));checkFrozenAnalysis(frozen,{contractVersion:MODEL_CONTRACT_VERSION,...frozenSettings,jdChecksum});
    for(const [text,analysis] of frozen.entries){const job=manifest.jobs.find(j=>j.text===text);assert.ok(job);checkAnalysis(analysis,job);analyses.set(text,analysis);}
  }catch(error){if(error.code!=='ENOENT')throw error;}
}
const analyzeOnce=oncePerKey(async(text,args)=>{
  await reserveModelAttempt(attemptLedgerFile,{identity,attempts,kind:'analysis',limit:maxTotalModelRequests});
  analysisCalls++;
  const generated=validateAnalysis(await cloud.analyze(args),{text});
  checkAnalysis(generated,manifest.jobs.find(j=>j.text===text));
  try{await writeJsonAtomic(analysisFile,{schemaVersion:2,contractVersion:MODEL_CONTRACT_VERSION,...frozenSettings,jdChecksum,entries:[...analyses,[text,generated]]});}
  catch(error){error.checkpointFatal=true;throw error;}
  analyses.set(text,generated);
  return generated;
});
if(!live){const fake=new FakeLanguageModel();for(const job of manifest.jobs){const analysis=validateAnalysis(await fake.analyze({snapshot:job}),job);checkAnalysis(analysis,job);analyses.set(job.text,analysis);}}
const checkpointFile=optionValue('--checkpoint')||join(artifactRoot,'checkpoints',`${modeName}.json`);
attemptLedgerFile=`${checkpointFile}.attempts.json`;
identity=checkpointIdentity({manifest,contractVersion:MODEL_CONTRACT_VERSION,codeChecksum,mode:modeName,model:live?cloud.model:null,configuration:evaluationConfiguration});
const resume=process.argv.includes('--resume');
if(resume&&process.argv.includes('--refresh-analysis'))throw Error('Cannot refresh frozen analysis while resuming a checkpoint');
if(resume){
  results.push(...await readCheckpoint(checkpointFile,{identity,manifest,analyses}));
  attempts=await readAttemptLedger(attemptLedgerFile,{identity});
  if(live)assert.ok(attempts.filter(kind=>kind==='feedback').length>=results.length,'Attempt ledger has fewer feedback calls than saved results');
}
else{
  for(const path of [checkpointFile,attemptLedgerFile])try{await readFile(path);throw Error(`Evaluation state already exists: ${path}; use --resume or a new --checkpoint path`);}catch(error){if(error.code!=='ENOENT')throw error;}
  await mkdir(dirname(checkpointFile),{recursive:true});
  await writeCheckpoint(checkpointFile,{identity,entries:[]});
  attempts=[];
  await writeAttemptLedger(attemptLedgerFile,{identity,attempts});
}
const reusedResults=results.length;
const blindFile=join(artifactDirectory,live?`${subscription?'codex':'live'}-label-blind-packet.json`:'label-blind-packet.json');
const freezeFile=join(artifactDirectory,live?`${subscription?'codex':'live'}-label-freeze.json`:'fake-label-freeze.json');
const buildBlindPacket=()=>manifest.cases.map(c=>{
  const job=manifest.jobs.find(item=>item.id===c.jobId),question=analyses.get(job.text)?.questions.find(item=>item.category===c.category);
  assert.ok(question,`Missing frozen selected question for ${c.id}`);
  return {caseId:c.id,inputChecksum:inputChecksum(job,c,question),contractVersion:MODEL_CONTRACT_VERSION,job:job.text,question,transcript:c.transcript,tags:c.tags,proposedExpectation:c.proposedExpectation};
});
if(analysisOnly){
  assert.equal(results.length,0,'Blind packet cannot be created after feedback results exist');
  assert.ok(attempts.every(kind=>kind==='analysis'),'Blind packet cannot be created after feedback or unfinished model attempts');
  for(const job of manifest.jobs)if(!analyses.has(job.text))await analyzeOnce(job.text,{snapshot:job});
  const blindPacket=buildBlindPacket();
  await mkdir(artifactDirectory,{recursive:true});
  try{assert.deepEqual(JSON.parse(await readFile(blindFile,'utf8')),blindPacket,'Saved blind packet differs from frozen analyses');}
  catch(error){if(error.code!=='ENOENT')throw error;await writeFile(blindFile,JSON.stringify(blindPacket,null,2)+'\n',{flag:'wx'});}
  console.log(JSON.stringify({analysisOnly:true,contractVersion:MODEL_CONTRACT_VERSION,analyses:analyses.size,blindCases:blindPacket.length,cumulativeModelRequests:(await readAttemptLedger(attemptLedgerFile,{identity})).length,blindFile},null,2));
  process.exit(0);
}
if(requireBlindApproval){
  const blindPacket=JSON.parse(await readFile(blindFile,'utf8'));
  assert.deepEqual(blindPacket,buildBlindPacket(),'Blind packet differs from frozen analyses');
  const labelArtifact=JSON.parse(await readFile(join(artifactDirectory,'human-labels.json'),'utf8'));
  const labels=labelStatus(blindPacket,labelArtifact);
  assert.ok(labels.pass&&labels.mode==='ai'&&labelArtifact.labelProvenance?.mode==='persona-drafted-ai-approved'&&labelArtifact.labelProvenance?.blindReviewer?.type==='ai'&&labelArtifact.labelProvenance?.blindReviewer?.independentOfDraftRaters===true,'Twenty independently approved blind AI labels are required before feedback');
  for(const label of labels.approved)for(const range of Object.values(label.ranges))assert.ok(range[1]-range[0]<=1,'Blind label ranges must be one level or adjacent levels');
  const freeze={schemaVersion:1,contractVersion:MODEL_CONTRACT_VERSION,packetChecksum:createHash('sha256').update(JSON.stringify(blindPacket)).digest('hex'),labelChecksum:createHash('sha256').update(JSON.stringify(labelArtifact)).digest('hex')};
  try{assert.deepEqual(JSON.parse(await readFile(freezeFile,'utf8')),freeze,'Blind approval changed after feedback began');}
  catch(error){if(error.code!=='ENOENT')throw error;assert.equal(results.length,0,'Cannot freeze labels after feedback results exist');assert.ok(attempts.every(kind=>kind==='analysis'),'Cannot freeze labels after feedback or unfinished model attempts');await writeFile(freezeFile,JSON.stringify(freeze,null,2)+'\n',{flag:'wx'});}
  blindApprovalFreeze=freeze;
}
const completed=new Set(results.map(({caseId,repeat})=>`${caseId}:${repeat}`));

for(let repeat=1;repeat<=3;repeat++){
  if(manifest.cases.every(c=>completed.has(`${c.id}:${repeat}`)))continue;
  const directory=await mkdtemp(join(tmpdir(),'coach-evaluation-'));
  workspaces++;
  let server;
  try{
    const provider=new FakeLanguageModel(),feedback=live?cloud.feedback.bind(cloud):provider.feedback.bind(provider);
    if(live){provider.name=cloud.name;provider.external=true;provider.analyze=async args=>{
      if(!analyses.has(args.snapshot.text))await analyzeOnce(args.snapshot.text,args);
      return structuredClone(analyses.get(args.snapshot.text));
    };}
    provider.feedback=async args=>{assert.deepEqual(args.approvedEvidence,[]);if(live)await reserveModelAttempt(attemptLedgerFile,{identity,attempts,kind:'feedback',limit:maxTotalModelRequests});providerCalls++;return feedback(args);};
    ({server}=await createApplication({directory,languageModel:provider,operationTimeoutMs:subscription?180000:30000,validationRetryLimit:0}));
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const api=async(path,data,expected=200)=>{
      const response=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{method:data===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Request-Id':randomUUID()},body:data===undefined?undefined:JSON.stringify(data)});
      const body=await response.json();assert.equal(response.status,expected,`${path}: ${JSON.stringify(body)}`);return body;
    };
    for(const job of manifest.jobs){
      if(manifest.cases.filter(c=>c.jobId===job.id).every(c=>completed.has(`${c.id}:${repeat}`)))continue;
      let snapshot,analysis;
      try{snapshot=await api('/snapshots',{text:job.text});analysis=jobGroundedAnalysis(await api(`/snapshots/${snapshot.id}/analysis`,{}));checkAnalysis(analysis,job);}
      catch(error){if(error.checkpointFatal)throw error;failures.push({repeat,jobId:job.id,check:'analysis grounding/schema',error:error.message});continue;}
      for(const c of manifest.cases.filter(c=>c.jobId===job.id)){
        if(completed.has(`${c.id}:${repeat}`))continue;
        try{
          const question=analysis.questions.find(q=>q.category===c.category);
          const record=await api('/records',{snapshotId:snapshot.id,questionId:question.id});
          await api(`/records/${record.id}/reference`,undefined,409);
          await api(`/records/${record.id}/attempts`,{transcript:c.transcript});
          const report=await api(`/records/${record.id}/feedback`,{});const feedback=report.attempts[0].feedback;checkFeedback(feedback,c);const bilingualAudit=checkBilingualConsistency(question,feedback);assert.equal(bilingualAudit.pass,true);
          const context=await api(`/records/${record.id}/evidence-context`);assert.deepEqual(context.approvedEvidence,[]);
          await api(`/records/${record.id}/reference`,undefined,409);
          const checksum=inputChecksum(job,c,question);
          const result={caseId:c.id,repeat,inputChecksum:checksum,outputChecksum:outputChecksum(c.id,repeat,question,feedback),question,feedback,bilingualAudit,checks:['bilingual schema','JD citations','question links','exact shared feedback quotes','prohibited phrase sentinels in both languages','unverified evidence exclusion','automatic bilingual pair checks','pre-revision reference gate']};
          try{await writeCheckpoint(checkpointFile,{identity,entries:[...results,result]});}catch(error){error.checkpointFatal=true;throw error;}
          results.push(result);completed.add(`${c.id}:${repeat}`);
        }catch(error){if(error.checkpointFatal)throw error;failures.push({repeat,caseId:c.id,check:'case constraints',error:error.message});}
      }
    }
  }finally{if(server?.listening)await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});}
}
attempts=await readAttemptLedger(attemptLedgerFile,{identity});
if(requireBlindApproval){
  assert.deepEqual(JSON.parse(await readFile(freezeFile,'utf8')),blindApprovalFreeze,'Blind approval freeze changed during feedback');
  assert.equal(createHash('sha256').update(JSON.stringify(JSON.parse(await readFile(blindFile,'utf8')))).digest('hex'),blindApprovalFreeze.packetChecksum,'Blind packet changed during feedback');
  assert.equal(createHash('sha256').update(JSON.stringify(JSON.parse(await readFile(join(artifactDirectory,'human-labels.json'),'utf8')))).digest('hex'),blindApprovalFreeze.labelChecksum,'Approved labels changed during feedback');
}
results.sort((a,b)=>a.repeat-b.repeat||manifest.cases.findIndex(c=>c.id===a.caseId)-manifest.cases.findIndex(c=>c.id===b.caseId));
const packet=manifest.cases.flatMap(c=>{const result=results.find(item=>item.caseId===c.id&&item.repeat===1);if(!result)return [];const job=manifest.jobs.find(item=>item.id===c.jobId);return [{caseId:c.id,inputChecksum:result.inputChecksum,contractVersion:MODEL_CONTRACT_VERSION,job:job.text,question:result.question,transcript:c.transcript,tags:c.tags,proposedExpectation:c.proposedExpectation,bilingualAudit:result.bilingualAudit,humanLabelTemplate:{caseId:c.id,inputChecksum:result.inputChecksum,status:'pending',reviewer:null,reviewedAt:null,ranges:Object.fromEntries(dimensions.map(d=>[d,null])),rationale:null,evidenceQuotes:[],requiredFindings:[],forbiddenFindings:[],bilingualSemanticConsistency:'pending'}}];});
let repeated={pass:false,stable:0,total:80,ratio:0};
try{repeated=stability(results);for(const c of manifest.cases)assert.equal(new Set(results.filter(r=>r.caseId===c.id).map(r=>r.inputChecksum)).size,1);}catch(error){failures.push({check:'identical three-repeat inputs and independent evidence',error:error.message});}
const labelArtifact=await readArtifact('human-labels.json',{schemaVersion:2,contractVersion:MODEL_CONTRACT_VERSION,labels:[]}),labels=labelStatus(packet,labelArtifact);const semanticAudits=results.map(({caseId,repeat,outputChecksum,bilingualAudit})=>({caseId,repeat,outputChecksum,bilingualAudit}));const semanticReview=semanticReviewStatus(semanticAudits,await readArtifact('semantic-reviews.json',{schemaVersion:2,contractVersion:MODEL_CONTRACT_VERSION,reviews:[]}));const creator=creatorStatus(await readArtifact('creator-validation.json',{creator:null,loops:[]}));
const comparedLabels=compareLabelExpectations(results,labels.approved),labelComparisons=comparedLabels.comparisons;
const automaticAuditPass=automaticBilingualAuditPass(semanticAudits,manifest);
const gates=evaluationGateSummary({failures,results,repeated,semanticReview,labels,comparedLabels,creator,live}),blockers=gates.blockers,labelGate={...gates.labelGate,provenanceMode:labelArtifact.labelProvenance?.mode||null};
const summary={suiteVersion:manifest.suiteVersion,runnerVersion:'3.3.0',contractVersion:MODEL_CONTRACT_VERSION,generatedAt:new Date().toISOString(),runtime:process.version,codeChecksum,provider:live?cloud.name:'Deterministic demonstration provider',model:live?cloud.model:null,configuration:evaluationConfiguration,mode:live?'live model on synthetic inputs':'synthetic pipeline regression; no external requests',jobs:5,cases:20,repeats:3,providerCalls,analysisCalls,cumulativeModelRequests:attempts.length,cumulativeAnalysisRequests:attempts.filter(kind=>kind==='analysis').length,cumulativeFeedbackRequests:attempts.filter(kind=>kind==='feedback').length,maxTotalModelRequests,attemptLedgerFile,reusedResults,newResults:results.length-reusedResults,collectedResults:results.length,workspaces,checkpointFile,automatedPass:gates.automatedPass,stability:repeated,bilingualSemanticReview:{pass:semanticReview.pass,status:semanticReview.pass?'independent-ai-reviewed':'pending-or-failed',automaticPairChecks:automaticAuditPass,errors:semanticReview.errors},labelGate,humanLabels:labelGate,creator,modelJudge:{status:'not used',results:[]},releaseStatus:gates.releaseStatus,blockers,failures,labelComparisons,results};
await mkdir(join(artifactRoot,'results'),{recursive:true});
  await mkdir(artifactDirectory,{recursive:true});await writeFile(join(artifactRoot,'results',`${modeName}.json`),JSON.stringify(summary,null,2)+'\n');const packetName=live?`${subscription?'codex':'live'}-review-packet.json`:'review-packet.json';await writeFile(join(artifactDirectory,packetName),JSON.stringify(packet,null,2)+'\n');await writeFile(join(artifactDirectory,live?`${subscription?'codex':'live'}-bilingual-audit.json`:'bilingual-audit.json'),JSON.stringify({schemaVersion:2,contractVersion:MODEL_CONTRACT_VERSION,status:'pending-independent-ai-review',automaticPass:automaticAuditPass,cases:semanticAudits.map(({caseId,repeat,outputChecksum,bilingualAudit})=>({caseId,repeat,outputChecksum,...bilingualAudit}))},null,2)+'\n');
  const md=`# Evaluation summary\n\nGenerated: ${summary.generatedAt}. Fixture suite ${manifest.suiteVersion}; runner ${summary.runnerVersion}; model contract ${MODEL_CONTRACT_VERSION}; ${process.version}.\n\n**MVP release: ${summary.releaseStatus}.**\n\n- Automatic constraints: ${summary.automatedPass?'PASS':'FAIL'} (${results.length}/60 case runs).\n- Five synthetic JDs; twenty synthetic transcripts; all four categories (five cases each).\n- New feedback invocations: ${providerCalls}; cumulative model requests including interrupted or rejected attempts: ${attempts.length}/${maxTotalModelRequests}; newly collected results: ${summary.newResults}; reused saved results: ${reusedResults}; total independent case/repeat evidence: ${results.length}. Workspaces opened: ${workspaces}.\n- Stability: ${repeated.stable}/${repeated.total} dimensions within one level (${(repeated.ratio*100).toFixed(1)}%; minimum90%). **${live?'Live model: '+cloud.name+'; review approved label expectations.':'Fixed fake provider only; not substantive model quality.'}**\n- Bilingual automatic pair checks: ${summary.bilingualSemanticReview.automaticPairChecks?'PASS':'FAIL'}; semantic consistency: ${summary.bilingualSemanticReview.status}.\n- ${labels.mode==='ai'?'AI-reviewed labels':labels.mode==='human'?'Human-reviewed labels':labels.mode==='mixed'?'Mixed AI/human-reviewed labels':'Evaluation labels'}: ${labelGate.pass?'PASS':labels.approved.length?'FAIL':'PENDING'}. ${creator.validationMode==='ai-persona'?'AI persona':'Creator'} validation: ${creator.pass?'PASS':'PENDING'} (${creator.count} loops). Model judge: not used.\n\n## Release blockers\n\n${blockers.map(b=>'- '+b).join('\n')}\n\n## Case coverage\n\n| Case | Tags | Passed runs |\n|---|---|---|\n${manifest.cases.map(c=>`| ${c.id} | ${c.tags.join(', ')} | ${results.filter(r=>r.caseId===c.id).length}/3 |`).join('\n')}\n\nEvery successful case checks the bilingual schema, exact JD citations, question links, one shared exact quote per bilingual finding, prohibited generated phrases in both languages, unverified-evidence exclusion, automatic bilingual pair checks, and reference gating. Automatic pair checks establish presence and script separation, not semantic equivalence; each paired English/Chinese artifact requires independent semantic review. All inputs are AI-authored synthetic fixtures; no creator records are included. Full per-case output and failures: [machine report](../../evaluation/results/${modeName}.json). Evaluation review packet: [version3.3](../../evaluation/${artifactVersion}/${packetName}).\n\nFailures: ${failures.length?JSON.stringify(failures):'none in this deterministic run'}.\n`;
  await mkdir(portfolioRoot,{recursive:true});await writeFile(join(portfolioRoot,`${modeName}-evaluation-summary.md`),md);
console.log(JSON.stringify({automatedPass:summary.automatedPass,stability:repeated,releaseStatus:summary.releaseStatus,blockers},null,2));
if(!summary.automatedPass||!repeated.pass||(process.argv.includes('--release')&&blockers.length))process.exitCode=1;
