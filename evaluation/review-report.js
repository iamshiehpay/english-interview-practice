import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MODEL_CONTRACT_VERSION} from '../src/model-contracts.js';
import {checkAnalysis,checkFeedback,checkBilingualConsistency,creatorStatus,inputChecksum,labelStatus,outputChecksum,semanticReviewStatus,stability,validateManifest} from './checks.js';

const sha=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const same=(actual,expected,message)=>assert.deepEqual(actual,expected,message);
const codeFiles=['evaluation/run.js','evaluation/checks.js','src/server.js','src/operations.js','src/store.js','src/domain.js','src/providers.js','src/cloud.js','src/codex-language.js','src/codex-profile.js','src/codex-rpc.js','src/codex-audit.js','src/codex-sandbox.js','src/codex-runtime.js','src/model-contracts.js','src/model-schemas.js'];
const protectedModelFiles=['src/model-contracts.js','src/model-schemas.js','src/domain.js','src/providers.js','src/cloud.js','src/codex-language.js'];

export function reviewArtifacts({raw,frozen,audit,semanticReviews,source,currentSource,manifest,humanLabels,creator}){
  validateManifest(manifest);
  assert.equal(raw.contractVersion,MODEL_CONTRACT_VERSION,'Raw report contract changed');
  assert.equal(raw.runnerVersion,'2.0.0','Raw report runner changed');
  assert.equal(raw.mode,'live model on synthetic inputs','Expected a live-model raw report');
  assert.equal(raw.jobs,5);assert.equal(raw.cases,20);assert.equal(raw.repeats,3);
  assert.equal(raw.providerCalls,60,'Raw report must contain sixty independent feedback calls');
  assert.equal(raw.analysisCalls,5,'Raw report must contain five live analysis calls');
  assert.equal(raw.automatedPass,true,'Raw automatic evaluation did not pass');
  assert.deepEqual(raw.failures,[],'Raw report contains automatic failures');
  assert.match(source.codeChecksum,/^[a-f0-9]{64}$/);assert.equal(raw.codeChecksum,source.codeChecksum,'Raw report does not match captured model-run source');
  assert.ok(source.note?.trim());assert.ok(source.files&&typeof source.files==='object');
  for(const required of ['evaluation/run.js','src/model-contracts.js'])assert.match(source.files[required],/^[a-f0-9]{64}$/,`Missing captured source hash: ${required}`);
  assert.match(currentSource.codeChecksum,/^[a-f0-9]{64}$/);assert.ok(currentSource.files&&typeof currentSource.files==='object');
  for(const file of protectedModelFiles){assert.match(source.files[file],/^[a-f0-9]{64}$/,`Missing captured model-contract source hash: ${file}`);assert.equal(currentSource.files[file],source.files[file],`Model-contract source changed after the live run: ${file}`);}

  assert.equal(frozen.schemaVersion,2);assert.equal(frozen.contractVersion,MODEL_CONTRACT_VERSION);assert.equal(frozen.model,raw.model,'Frozen analysis model differs from raw report');
  assert.equal(frozen.jdChecksum,sha(manifest.jobs),'Frozen analysis does not match evaluation jobs');
  assert.equal(frozen.entries.length,5);assert.equal(new Set(frozen.entries.map(([text])=>text)).size,5);
  const analyses=new Map(frozen.entries);
  for(const job of manifest.jobs){const analysis=analyses.get(job.text);assert.ok(analysis,`Missing frozen analysis for ${job.id}`);checkAnalysis(analysis,job);}

  assert.equal(raw.results.length,60,'Raw report must contain all sixty case repeats');
  assert.equal(audit.schemaVersion,2);assert.equal(audit.contractVersion,MODEL_CONTRACT_VERSION);assert.equal(audit.automaticPass,true);assert.equal(audit.cases.length,60,'Bilingual audit must contain all sixty outputs');
  const seen=new Set(),semanticAudits=[];
  for(const result of raw.results){
    const key=`${result.caseId}:${result.repeat}`;assert.ok(!seen.has(key),`Duplicate result ${key}`);seen.add(key);
    assert.ok(Number.isInteger(result.repeat)&&result.repeat>=1&&result.repeat<=3);
    const c=manifest.cases.find(item=>item.id===result.caseId);assert.ok(c,`Unknown case ${result.caseId}`);
    const job=manifest.jobs.find(item=>item.id===c.jobId),analysis=analyses.get(job.text);
    const selected=analysis.questions.find(question=>question.category===c.category);assert.ok(selected,`${key}: frozen category missing`);same(result.question,selected,`${key}: question differs from the frozen selected category question`);
    assert.equal(result.inputChecksum,inputChecksum(job,c,result.question),`${key}: stale input checksum`);
    checkFeedback(result.feedback,c);
    assert.equal(result.outputChecksum,outputChecksum(result.caseId,result.repeat,result.question,result.feedback),`${key}: stale output checksum`);
    const rebuilt=checkBilingualConsistency(result.question,result.feedback);assert.equal(rebuilt.pass,true,`${key}: automatic bilingual checks failed`);same(result.bilingualAudit,rebuilt,`${key}: raw bilingual audit changed`);
    const matches=audit.cases.filter(item=>item.caseId===result.caseId&&item.repeat===result.repeat);assert.equal(matches.length,1,`${key}: missing or duplicate audit`);const audited=matches[0];
    assert.equal(audited.outputChecksum,result.outputChecksum,`${key}: audit checksum changed`);same(audited.pairs,rebuilt.pairs,`${key}: audited bilingual pairs changed`);same(audited.errors,rebuilt.errors,`${key}: audited errors changed`);
    semanticAudits.push({caseId:result.caseId,repeat:result.repeat,outputChecksum:result.outputChecksum,bilingualAudit:rebuilt});
  }
  for(const c of manifest.cases){const repeats=raw.results.filter(result=>result.caseId===c.id);assert.deepEqual(repeats.map(result=>result.repeat).sort(),[1,2,3]);assert.equal(new Set(repeats.map(result=>result.inputChecksum)).size,1,`${c.id}: input changed across repeats`);}
  const repeated=stability(raw.results);same(raw.stability,repeated,'Raw stability summary changed');assert.equal(repeated.pass,true,'Live rating stability failed');

  const semantic=semanticReviewStatus(semanticAudits,semanticReviews);
  const hasInconsistency=(semanticReviews.reviews||[]).some(review=>review.verdict==='inconsistent');
  const bilingualStatus=semantic.pass?'PASS':hasInconsistency?'FAIL':'PENDING';
  const packet=manifest.cases.map(c=>{const result=raw.results.find(item=>item.caseId===c.id&&item.repeat===1);return {caseId:c.id,inputChecksum:result.inputChecksum,contractVersion:MODEL_CONTRACT_VERSION,transcript:c.transcript};});
  const labels=labelStatus(packet,humanLabels),creatorGate=creatorStatus(creator);
  const blockers=[];
  if(bilingualStatus!=='PASS')blockers.push('Independent bilingual semantic review pending, stale or inconsistent');
  if(!labels.pass)blockers.push('Human-labelled expectations pending or stale');
  if(!creatorGate.pass)blockers.push('Creator five-loop real-use validation pending');
  return {
    reviewVersion:'1.0.0',contractVersion:MODEL_CONTRACT_VERSION,generatedAt:new Date().toISOString(),
    rawReport:{generatedAt:raw.generatedAt,provider:raw.provider,model:raw.model,codeChecksum:raw.codeChecksum,checksum:sha(raw)},
    sourceEvidence:{rawCodeChecksum:source.codeChecksum,capturedModelRunMatchesRaw:true,capturedNote:source.note,currentCodeChecksum:currentSource.codeChecksum,currentMatchesRaw:currentSource.codeChecksum===source.codeChecksum,changedFiles:Object.keys(source.files).filter(file=>currentSource.files[file]!==source.files[file]).sort()},
    artifactChecksums:{frozenAnalysis:sha(frozen),bilingualAudit:sha(audit),semanticReviews:sha(semanticReviews),humanLabels:sha(humanLabels),creatorValidation:sha(creator)},
    automaticRevalidation:{pass:true,cases:20,repeats:3,outputs:60,stability:repeated},
    bilingualGate:{status:bilingualStatus,pass:semantic.pass,reviewedOutputs:semantic.reviewed.length,reviewer:semanticReviews.reviewer||null,reviewedAt:semanticReviews.reviewedAt||null,errors:semantic.errors},
    humanLabels:{pass:labels.pass,status:labels.pass?'PASS':'PENDING',approved:labels.approved.length,errors:labels.errors},
    creator:{pass:creatorGate.pass,status:creatorGate.pass?'PASS':'PENDING',count:creatorGate.count},
    releaseStatus:blockers.length?'BLOCKED':'PASS',blockers
  };
}

export async function createReviewedReport({root=dirname(fileURLToPath(import.meta.url))}={}){
  const paths={
    raw:join(root,'results','codex-v2.json'),frozen:join(root,'v2','codex-analysis.json'),audit:join(root,'v2','codex-bilingual-audit.json'),semanticReviews:join(root,'v2','semantic-reviews.json'),manifest:join(root,'v1','manifest.json'),humanLabels:join(root,'v2','human-labels.json'),creator:join(root,'v2','creator-validation.json'),source:join(root,'..','docs','verification','ui-redesign','model-run-source.json'),output:join(root,'results','codex-v2-reviewed.json')
  };
  const entries=await Promise.all(Object.entries(paths).filter(([name])=>name!=='output').map(async([name,path])=>[name,JSON.parse(await readFile(path,'utf8'))]));
  const repoRoot=join(root,'..'),hash=createHash('sha256'),files={};
  for(const file of codeFiles){const content=await readFile(join(repoRoot,file));hash.update(content);files[file]=createHash('sha256').update(content).digest('hex');}
  const reviewed=reviewArtifacts({...Object.fromEntries(entries),currentSource:{codeChecksum:hash.digest('hex'),files}});
  await writeFile(paths.output,JSON.stringify(reviewed,null,2)+'\n');
  return {reviewed,output:paths.output};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  try{const {reviewed,output}=await createReviewedReport();console.log(JSON.stringify({output,bilingualGate:reviewed.bilingualGate.status,humanLabels:reviewed.humanLabels.status,creator:reviewed.creator.status,releaseStatus:reviewed.releaseStatus},null,2));if(reviewed.bilingualGate.status!=='PASS')process.exitCode=1;}
  catch(error){console.error(`Offline evaluation review failed: ${error.message}`);process.exitCode=1;}
}
