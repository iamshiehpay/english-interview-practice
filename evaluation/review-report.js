import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MODEL_CONTRACT_VERSION} from '../src/model-contracts.js';
import {checkAnalysis,checkFeedback,checkBilingualConsistency,compareLabelExpectations,creatorStatus,dimensions,inputChecksum,labelStatus,outputChecksum,semanticReviewStatus,stability,validateManifest} from './checks.js';

const sha=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const same=(actual,expected,message)=>assert.deepEqual(actual,expected,message);
const codeFiles=['evaluation/run.js','evaluation/checks.js','evaluation/checkpoints.js','evaluation/job-grounded-analysis.js','src/common-questions.js','src/server.js','src/request-policy.js','src/workspace-quota.js','src/operations.js','src/store.js','src/domain.js','src/providers.js','src/cloud.js','src/codex-language.js','src/codex-profile.js','src/codex-rpc.js','src/codex-audit.js','src/codex-sandbox.js','src/codex-runtime.js','src/model-contracts.js','src/model-schemas.js','src/resume.js','src/progress.js','src/evidence.js','src/jobs.js','src/speech.js','src/recordings.js','src/mock-sessions.js'];
const protectedModelFiles=['src/model-contracts.js','src/model-schemas.js','src/domain.js','src/providers.js','src/cloud.js','src/codex-language.js'];
const historicalCodexContract='3.0.0';
const priorCodexContract='3.2.0';
const artifactVersions={v3:{contractVersion:historicalCodexContract,directory:'v3',name:'codex-v3'},'v3-3':{contractVersion:'3.3.0',directory:'v3-3',name:'codex-v3-3'}};

function artifactVersion(version){
  assert.ok(Object.hasOwn(artifactVersions,version),`Unsupported offline review artifact version: ${version}`);
  return artifactVersions[version];
}

export function reviewArtifacts({raw,frozen,audit,reviewPacket,semanticReviews,source,currentSource,manifest,humanLabels,creator,blindPacket,labelFreeze}){
  validateManifest(manifest);
  assert.ok([historicalCodexContract,priorCodexContract,MODEL_CONTRACT_VERSION].includes(raw.contractVersion),'Raw report contract changed');
  assert.equal(raw.runnerVersion,raw.contractVersion,'Raw report runner changed');
  assert.equal(raw.mode,'live model on synthetic inputs','Expected a live-model raw report');
  assert.ok(typeof raw.model==='string'&&raw.model.trim(),'Codex model is required');
  const configuration=raw.configuration;
  assert.ok(configuration&&typeof configuration==='object'&&!Array.isArray(configuration),'Codex configuration is required');
  assert.ok(typeof configuration.effort==='string'&&configuration.effort.trim(),'Codex reasoning effort is required');
  assert.ok(Object.hasOwn(configuration,'serviceTier')&&(configuration.serviceTier===null||typeof configuration.serviceTier==='string'&&configuration.serviceTier.trim()),'Codex service tier must be recorded');
  assert.equal(raw.provider,`Codex / ChatGPT subscription / ${raw.model} / ${configuration.effort}${configuration.serviceTier==='priority'?' / fast':''}`,'Expected Codex subscription provider');
  assert.ok(typeof configuration.cliVersion==='string'&&configuration.cliVersion.trim(),'Codex CLI version is required');
  assert.equal(configuration.ephemeral,true,'Codex evaluation must use ephemeral sessions');
  assert.equal(configuration.analysisPolicy,'one live generation per JD, frozen across three feedback repeats','Codex analysis policy changed');
  assert.equal(raw.jobs,5);assert.equal(raw.cases,20);assert.equal(raw.repeats,3);
  if(raw.contractVersion==='3.3.0'){
    assert.ok(Number.isSafeInteger(raw.maxTotalModelRequests)&&raw.maxTotalModelRequests>=65&&raw.maxTotalModelRequests<=999999,'Recorded model request limit is invalid');
    assert.ok(Number.isSafeInteger(raw.cumulativeModelRequests)&&raw.cumulativeModelRequests>=65&&raw.cumulativeModelRequests<=raw.maxTotalModelRequests,'Raw model requests exceed the recorded limit or omit required attempts');
    assert.ok(Number.isSafeInteger(raw.cumulativeAnalysisRequests)&&raw.cumulativeAnalysisRequests>=5,'Raw report must account for at least five analysis requests');
    assert.ok(Number.isSafeInteger(raw.cumulativeFeedbackRequests)&&raw.cumulativeFeedbackRequests>=60,'Raw report must account for at least sixty feedback requests');
    assert.equal(raw.cumulativeModelRequests,raw.cumulativeAnalysisRequests+raw.cumulativeFeedbackRequests,'Raw cumulative request counts differ');
    assert.ok(Number.isSafeInteger(raw.analysisCalls)&&raw.analysisCalls>=0&&raw.analysisCalls<=raw.cumulativeAnalysisRequests,'Current-process analysis calls are invalid');
    assert.ok(Number.isSafeInteger(raw.providerCalls)&&raw.providerCalls>=0&&raw.providerCalls<=raw.cumulativeFeedbackRequests,'Current-process feedback calls are invalid');
    assert.ok(Number.isInteger(raw.reusedResults)&&raw.reusedResults>=0&&raw.reusedResults<=60,'Reused result count is invalid');
    assert.equal(raw.newResults,60-raw.reusedResults,'New result count differs from reused results');
    assert.ok(raw.providerCalls>=raw.newResults,'Current-process feedback calls cannot be fewer than new results');
  }else{
    assert.equal(raw.providerCalls,60,'Raw report must contain sixty independent feedback calls');
    assert.equal(raw.analysisCalls,5,'Raw report must contain five live analysis calls');
  }
  assert.equal(raw.automatedPass,true,'Raw automatic evaluation did not pass');
  assert.deepEqual(raw.failures,[],'Raw report contains automatic failures');
  assert.match(source.codeChecksum,/^[a-f0-9]{64}$/);assert.equal(raw.codeChecksum,source.codeChecksum,'Raw report does not match captured model-run source');
  assert.ok(source.note?.trim());assert.ok(source.files&&typeof source.files==='object');
  for(const required of ['evaluation/run.js','src/model-contracts.js'])assert.match(source.files[required],/^[a-f0-9]{64}$/,`Missing captured source hash: ${required}`);
  assert.match(currentSource.codeChecksum,/^[a-f0-9]{64}$/);assert.ok(currentSource.files&&typeof currentSource.files==='object');
  for(const file of protectedModelFiles){assert.match(source.files[file],/^[a-f0-9]{64}$/,`Missing captured model-contract source hash: ${file}`);if(file==='src/model-contracts.js'&&raw.contractVersion!==MODEL_CONTRACT_VERSION)continue;assert.equal(currentSource.files[file],source.files[file],`Model-contract source changed after the live run: ${file}`);}

  assert.equal(frozen.schemaVersion,2);assert.equal(frozen.contractVersion,raw.contractVersion);assert.equal(frozen.model,raw.model,'Frozen analysis model differs from raw report');
  assert.equal(frozen.effort,raw.configuration?.effort,'Frozen analysis effort differs from raw report');
  assert.equal(frozen.serviceTier,raw.configuration?.serviceTier,'Frozen analysis service tier differs from raw report');
  assert.equal(frozen.jdChecksum,sha(manifest.jobs),'Frozen analysis does not match evaluation jobs');
  assert.equal(frozen.entries.length,5);assert.equal(new Set(frozen.entries.map(([text])=>text)).size,5);
  const analyses=new Map(frozen.entries);
  for(const job of manifest.jobs){const analysis=analyses.get(job.text);assert.ok(analysis,`Missing frozen analysis for ${job.id}`);checkAnalysis(analysis,job);}

  assert.equal(raw.results.length,60,'Raw report must contain all sixty case repeats');
  assert.equal(audit.schemaVersion,2);assert.equal(audit.contractVersion,raw.contractVersion);assert.equal(audit.automaticPass,true);assert.equal(audit.cases.length,60,'Bilingual audit must contain all sixty outputs');
  const seen=new Set(),semanticAudits=[];
  for(const result of raw.results){
    const key=`${result.caseId}:${result.repeat}`;assert.ok(!seen.has(key),`Duplicate result ${key}`);seen.add(key);
    assert.ok(Number.isInteger(result.repeat)&&result.repeat>=1&&result.repeat<=3);
    const c=manifest.cases.find(item=>item.id===result.caseId);assert.ok(c,`Unknown case ${result.caseId}`);
    const job=manifest.jobs.find(item=>item.id===c.jobId),analysis=analyses.get(job.text);
    const selected=analysis.questions.find(question=>question.category===c.category);assert.ok(selected,`${key}: frozen category missing`);same(result.question,selected,`${key}: question differs from the frozen selected category question`);
    assert.equal(result.inputChecksum,inputChecksum(job,c,result.question,raw.contractVersion),`${key}: stale input checksum`);
    checkFeedback(result.feedback,c);
    assert.equal(result.outputChecksum,outputChecksum(result.caseId,result.repeat,result.question,result.feedback,raw.contractVersion),`${key}: stale output checksum`);
    const rebuilt=checkBilingualConsistency(result.question,result.feedback);assert.equal(rebuilt.pass,true,`${key}: automatic bilingual checks failed`);same(result.bilingualAudit,rebuilt,`${key}: raw bilingual audit changed`);
    const matches=audit.cases.filter(item=>item.caseId===result.caseId&&item.repeat===result.repeat);assert.equal(matches.length,1,`${key}: missing or duplicate audit`);const audited=matches[0];
    assert.equal(audited.outputChecksum,result.outputChecksum,`${key}: audit checksum changed`);same(audited.pairs,rebuilt.pairs,`${key}: audited bilingual pairs changed`);same(audited.errors,rebuilt.errors,`${key}: audited errors changed`);
    semanticAudits.push({caseId:result.caseId,repeat:result.repeat,outputChecksum:result.outputChecksum,bilingualAudit:rebuilt});
  }
  for(const c of manifest.cases){const repeats=raw.results.filter(result=>result.caseId===c.id);assert.deepEqual(repeats.map(result=>result.repeat).sort(),[1,2,3]);assert.equal(new Set(repeats.map(result=>result.inputChecksum)).size,1,`${c.id}: input changed across repeats`);}
  const repeated=stability(raw.results);same(raw.stability,repeated,'Raw stability summary changed');assert.equal(repeated.pass,true,'Live rating stability failed');

  const semantic=semanticReviewStatus(semanticAudits,semanticReviews,raw.contractVersion);
  const hasInconsistency=(semanticReviews.reviews||[]).some(review=>review.verdict==='inconsistent');
  const bilingualStatus=semantic.pass?'PASS':hasInconsistency?'FAIL':'PENDING';
  const packet=manifest.cases.map(c=>{const result=raw.results.find(item=>item.caseId===c.id&&item.repeat===1),job=manifest.jobs.find(job=>job.id===c.jobId);return {caseId:c.id,inputChecksum:result.inputChecksum,contractVersion:raw.contractVersion,job:job.text,question:result.question,transcript:c.transcript,tags:c.tags,proposedExpectation:c.proposedExpectation,bilingualAudit:result.bilingualAudit,humanLabelTemplate:{caseId:c.id,inputChecksum:result.inputChecksum,status:'pending',reviewer:null,reviewedAt:null,ranges:Object.fromEntries(dimensions.map(d=>[d,null])),rationale:null,evidenceQuotes:[],requiredFindings:[],forbiddenFindings:[],bilingualSemanticConsistency:'pending'}};});
  same(reviewPacket,packet,'Saved Codex review packet differs from the raw report and fixtures');
  if(raw.contractVersion==='3.3.0'){
    const expectedBlind=manifest.cases.map(c=>{
      const job=manifest.jobs.find(item=>item.id===c.jobId),analysis=analyses.get(job.text),question=analysis.questions.find(item=>item.category===c.category);
      return {caseId:c.id,inputChecksum:inputChecksum(job,c,question,raw.contractVersion),contractVersion:raw.contractVersion,job:job.text,question,transcript:c.transcript,tags:c.tags,proposedExpectation:c.proposedExpectation};
    });
    same(blindPacket,expectedBlind,'Saved blind packet differs from frozen analyses and fixtures');
    same(blindPacket,reviewPacket.map(({caseId,inputChecksum,contractVersion,job,question,transcript,tags,proposedExpectation})=>({caseId,inputChecksum,contractVersion,job,question,transcript,tags,proposedExpectation})),'Saved blind packet differs from review packet');
    same(labelFreeze,{schemaVersion:1,contractVersion:raw.contractVersion,packetChecksum:sha(blindPacket),labelChecksum:sha(humanLabels)},'Frozen blind packet or approved labels changed after feedback began');
  }
  const labels=labelStatus(packet,humanLabels,raw.contractVersion),comparedLabels=compareLabelExpectations(raw.results,labels.approved),creatorGate=creatorStatus(creator);
  const labelPass=labels.pass&&comparedLabels.failures.length===0;
  const labelGate={pass:labelPass,status:labelPass?'PASS':humanLabels.labels?.length?'FAIL':'PENDING',mode:labels.mode,provenanceMode:humanLabels.labelProvenance?.mode||null,approved:labels.approved.length,comparedOutputs:comparedLabels.comparisons.length,errors:labels.errors,comparisonFailures:comparedLabels.failures};
  const blockers=[];
  if(bilingualStatus!=='PASS')blockers.push('Independent bilingual semantic review pending, stale or inconsistent');
  if(!labelPass)blockers.push('Evaluation labels pending, stale or outside approved expectations');
  blockers.push(...creatorGate.errors);
  return {
    reviewVersion:'1.0.0',contractVersion:raw.contractVersion,generatedAt:new Date().toISOString(),
    rawReport:{generatedAt:raw.generatedAt,provider:raw.provider,model:raw.model,codeChecksum:raw.codeChecksum,checksum:sha(raw)},
    sourceEvidence:{rawCodeChecksum:source.codeChecksum,capturedModelRunMatchesRaw:true,capturedNote:source.note,currentCodeChecksum:currentSource.codeChecksum,currentMatchesRaw:currentSource.codeChecksum===source.codeChecksum,changedFiles:Object.keys(source.files).filter(file=>currentSource.files[file]!==source.files[file]).sort()},
    artifactChecksums:{frozenAnalysis:sha(frozen),reviewPacket:sha(reviewPacket),bilingualAudit:sha(audit),semanticReviews:sha(semanticReviews),humanLabels:sha(humanLabels),creatorValidation:sha(creator),...(raw.contractVersion==='3.3.0'?{blindPacket:sha(blindPacket),labelFreeze:sha(labelFreeze)}:{})},
    automaticRevalidation:{pass:true,cases:20,repeats:3,outputs:60,stability:repeated},
    bilingualGate:{status:bilingualStatus,pass:semantic.pass,reviewedOutputs:semantic.reviewed.length,reviewer:semanticReviews.reviewer||null,reviewedAt:semanticReviews.reviewedAt||null,errors:semantic.errors},
    labelGate,humanLabels:labelGate,
    creator:{pass:creatorGate.pass,status:creatorGate.pass?'PASS':'PENDING',count:creatorGate.count,validationMode:creatorGate.validationMode},
    releaseStatus:blockers.length?'BLOCKED':creatorGate.validationMode==='ai-persona'?'AI-validated':'PASS',blockers
  };
}

export async function captureCurrentSource({codeRoot}={}){
  const repoRoot=codeRoot||join(dirname(fileURLToPath(import.meta.url)),'..'),hash=createHash('sha256'),files={};
  for(const file of codeFiles){const content=await readFile(join(repoRoot,file));hash.update(content);files[file]=createHash('sha256').update(content).digest('hex');}
  return {codeChecksum:hash.digest('hex'),files};
}

export async function captureModelRunSource({root=dirname(fileURLToPath(import.meta.url)),codeRoot=join(root,'..'),version='v3-3'}={}){
  const {name}=artifactVersion(version);
  const source={...await captureCurrentSource({codeRoot}),capturedAt:new Date().toISOString(),note:`Captured immediately before the single authorized Codex ${version} evaluation run.`};
  const output=join(root,'..','docs','verification',`${name}-model-run-source.json`);
  await mkdir(dirname(output),{recursive:true});
  await writeFile(output,JSON.stringify(source,null,2)+'\n',{flag:'wx'});
  return {source,output};
}

export async function createReviewedReport({root=dirname(fileURLToPath(import.meta.url)),codeRoot=join(root,'..'),version='v3-3'}={}){
  const {contractVersion,directory,name}=artifactVersion(version);
  const paths={
    raw:join(root,'results',`${name}.json`),frozen:join(root,directory,'codex-analysis.json'),audit:join(root,directory,'codex-bilingual-audit.json'),reviewPacket:join(root,directory,'codex-review-packet.json'),semanticReviews:join(root,directory,'semantic-reviews.json'),manifest:join(root,'v1','manifest.json'),humanLabels:join(root,directory,'human-labels.json'),creator:join(root,directory,'creator-validation.json'),source:join(root,'..','docs','verification',`${name}-model-run-source.json`),...(version==='v3-3'?{blindPacket:join(root,directory,'codex-label-blind-packet.json'),labelFreeze:join(root,directory,'codex-label-freeze.json')}:{}),output:join(root,'results',`${name}-reviewed.json`)
  };
  const entries=await Promise.all(Object.entries(paths).filter(([name])=>name!=='output').map(async([name,path])=>[name,JSON.parse(await readFile(path,'utf8'))]));
  assert.equal(Object.fromEntries(entries).raw.contractVersion,contractVersion,`Raw report does not match ${version} artifacts`);
  const reviewed=reviewArtifacts({...Object.fromEntries(entries),currentSource:await captureCurrentSource({codeRoot})});
  await writeFile(paths.output,JSON.stringify(reviewed,null,2)+'\n');
  return {reviewed,output:paths.output};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{
    const version=process.argv.includes('--v3')?'v3':'v3-3';
    if(process.argv.includes('--capture-source')){const {source,output}=await captureModelRunSource({version});console.log(JSON.stringify({output,codeChecksum:source.codeChecksum},null,2));}
    else{const {reviewed,output}=await createReviewedReport({version});console.log(JSON.stringify({output,bilingualGate:reviewed.bilingualGate.status,labelGate:reviewed.labelGate.status,labelMode:reviewed.labelGate.mode,creator:reviewed.creator.status,releaseStatus:reviewed.releaseStatus},null,2));if(!reviewed.bilingualGate.pass||!reviewed.labelGate.pass||!reviewed.creator.pass)process.exitCode=1;}
  }
  catch(error){console.error(`Offline evaluation review failed: ${error.message}`);process.exitCode=1;}
}
