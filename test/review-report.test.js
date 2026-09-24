import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {FakeLanguageModel} from '../src/providers.js';
import {MODEL_CONTRACT_VERSION} from '../src/model-contracts.js';
import {checkBilingualConsistency,dimensions,inputChecksum,outputChecksum,stability} from '../evaluation/checks.js';
import {captureCurrentSource,captureModelRunSource,createReviewedReport,reviewArtifacts} from '../evaluation/review-report.js';

const manifest=JSON.parse(await readFile(new URL('../evaluation/v1/manifest.json',import.meta.url)));

async function fixtures(){
  const provider=new FakeLanguageModel(),entries=[],results=[];
  for(const job of manifest.jobs){
    const analysis=await provider.analyze({snapshot:job});entries.push([job.text,analysis]);
    for(const c of manifest.cases.filter(item=>item.jobId===job.id)){
      const question=analysis.questions.find(item=>item.category===c.category);
      for(let repeat=1;repeat<=3;repeat++){
        const feedback=await provider.feedback({transcript:c.transcript});
        results.push({caseId:c.id,repeat,inputChecksum:inputChecksum(job,c,question),outputChecksum:outputChecksum(c.id,repeat,question,feedback),question,feedback,bilingualAudit:checkBilingualConsistency(question,feedback)});
      }
    }
  }
  const stable=stability(results),codeChecksum='a'.repeat(64);
  const raw={suiteVersion:manifest.suiteVersion,runnerVersion:'3.0.0',contractVersion:MODEL_CONTRACT_VERSION,generatedAt:'2026-09-24T00:00:00Z',codeChecksum,provider:'Codex / ChatGPT subscription / gpt-test / xhigh / fast',model:'gpt-test',configuration:{cliVersion:'1.0.0',effort:'xhigh',serviceTier:'priority',ephemeral:true,analysisPolicy:'one live generation per JD, frozen across three feedback repeats'},mode:'live model on synthetic inputs',jobs:5,cases:20,repeats:3,providerCalls:60,analysisCalls:5,automatedPass:true,stability:stable,failures:[],results};
  const frozen={schemaVersion:2,contractVersion:MODEL_CONTRACT_VERSION,model:'gpt-test',effort:'xhigh',serviceTier:'priority',jdChecksum:(await import('node:crypto')).createHash('sha256').update(JSON.stringify(manifest.jobs)).digest('hex'),entries};
  const audit={schemaVersion:2,contractVersion:MODEL_CONTRACT_VERSION,status:'pending-independent-ai-review',automaticPass:true,cases:results.map(({caseId,repeat,outputChecksum,bilingualAudit})=>({caseId,repeat,outputChecksum,...bilingualAudit}))};
  const reviewPacket=manifest.cases.map(c=>{const result=results.find(item=>item.caseId===c.id&&item.repeat===1);return {caseId:c.id,inputChecksum:result.inputChecksum,contractVersion:MODEL_CONTRACT_VERSION,job:manifest.jobs.find(job=>job.id===c.jobId).text,question:result.question,transcript:c.transcript,tags:c.tags,proposedExpectation:c.proposedExpectation,bilingualAudit:result.bilingualAudit,humanLabelTemplate:{caseId:c.id,inputChecksum:result.inputChecksum,status:'pending',reviewer:null,reviewedAt:null,ranges:Object.fromEntries(dimensions.map(d=>[d,null])),rationale:null,evidenceQuotes:[],requiredFindings:[],forbiddenFindings:[],bilingualSemanticConsistency:'pending'}};});
  const semanticReviews={schemaVersion:2,contractVersion:MODEL_CONTRACT_VERSION,reviewerType:'ai',reviewer:'Independent reviewer',reviewedAt:'2026-09-18T01:00:00Z',reviews:audit.cases.map(item=>({caseId:item.caseId,repeat:item.repeat,outputChecksum:item.outputChecksum,verdict:'consistent',rationale:'The paired coaching preserves the assessment and advice.',contradictoryPairs:[]}))};
  const protectedFiles=['src/model-contracts.js','src/model-schemas.js','src/domain.js','src/providers.js','src/cloud.js','src/codex-language.js'];
  const source={note:'Captured before later guard-only changes.',codeChecksum,files:{'evaluation/run.js':'b'.repeat(64),...Object.fromEntries(protectedFiles.map((file,index)=>[file,String(index+1).repeat(64)]))}};
  const currentSource={codeChecksum:'d'.repeat(64),files:{'evaluation/run.js':'e'.repeat(64),...Object.fromEntries(protectedFiles.map((file,index)=>[file,String(index+1).repeat(64)]))}};
  return {raw,frozen,audit,reviewPacket,semanticReviews,source,currentSource,manifest,humanLabels:{schemaVersion:2,contractVersion:MODEL_CONTRACT_VERSION,status:'pending-human-review',labels:[]},creator:{schemaVersion:2,contractVersion:MODEL_CONTRACT_VERSION,creator:null,attestedAt:null,loops:[]}};
}

function approveFixtureLabels(input){
  input.humanLabels={schemaVersion:2,contractVersion:MODEL_CONTRACT_VERSION,labelProvenance:{mode:'persona-drafted-ai-approved',drafter:'Rater persona',approver:'Independent AI reviewer'},labels:input.reviewPacket.map(item=>({caseId:item.caseId,inputChecksum:item.inputChecksum,status:'approved',reviewerType:'ai',reviewer:'Independent AI reviewer',reviewedAt:'2026-09-24T01:00:00Z',rationale:'The quoted answer shows a concrete basis for the ratings.',ranges:Object.fromEntries(dimensions.map(d=>[d,[1,4]])),evidenceQuotes:[item.transcript.slice(0,Math.min(12,item.transcript.length))],requiredFindings:['Demonstration rating only'],forbiddenFindings:['Invented specific metric'],bilingualSemanticConsistency:'approved'}))};
  input.creator={validationMode:'ai-persona',creator:null,attestedBy:'Independent AI verifier',attestedAt:'2026-09-24T01:00:00Z',loops:Array.from({length:5},(_,i)=>({recordId:`record-${i}`,snapshotId:`snapshot-${i%2}`,category:i%2?'behavioral':'role-fit',completedAt:'2026-09-24T00:00:00Z',completed:true,synthetic:true,inputMode:'text',persona:'Test persona',evidence:'docs/verification/test-persona.md',experienceGap:i===0,inducedFailure:i===1?{type:'cancelled and retried',recovered:true}:null}))};
}

test('offline review compares all sixty outputs against twenty AI-approved labels before AI validation',async()=>{
  const input=await fixtures();approveFixtureLabels(input);
  const reviewed=reviewArtifacts(input);
  assert.equal(reviewed.labelGate.status,'PASS');
  assert.equal(reviewed.labelGate.mode,'ai');
  assert.equal(reviewed.labelGate.approved,20);
  assert.equal(reviewed.labelGate.comparedOutputs,60);
  assert.equal(reviewed.releaseStatus,'AI-validated');
});

test('offline review blocks ranges and required or forbidden literal findings that fail saved feedback',async()=>{
  for(const [change,message] of [
    [label=>{label.ranges.support=[4,4];},/support rating outside approved range/],
    [label=>{label.requiredFindings=['never-written-finding'];},/Required finding missing/],
    [label=>{label.forbiddenFindings=['You supplied an answer to review.'];},/Forbidden finding present/]
  ]){
    const input=await fixtures();approveFixtureLabels(input);change(input.humanLabels.labels[0]);
    const reviewed=reviewArtifacts(input);
    assert.equal(input.raw.automatedPass,true);
    assert.deepEqual(input.raw.failures,[]);
    assert.equal(reviewed.automaticRevalidation.pass,true);
    assert.equal(reviewed.labelGate.status,'FAIL');
    assert.equal(reviewed.releaseStatus,'BLOCKED');
    assert.match(reviewed.labelGate.comparisonFailures[0].error,message);
  }
});

test('saved Codex run retains automatic PASS while approved label mismatches block release',async()=>{
  const root=join(dirname(fileURLToPath(import.meta.url)),'..');
  const paths={raw:'evaluation/results/codex-v3.json',frozen:'evaluation/v3/codex-analysis.json',audit:'evaluation/v3/codex-bilingual-audit.json',reviewPacket:'evaluation/v3/codex-review-packet.json',semanticReviews:'evaluation/v3/semantic-reviews.json',source:'docs/verification/codex-v3-model-run-source.json',manifest:'evaluation/v1/manifest.json',humanLabels:'evaluation/v3/human-labels.json',creator:'evaluation/v3/creator-validation.json'};
  const artifacts=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([name,path])=>[name,JSON.parse(await readFile(join(root,path),'utf8'))])));
  const reviewed=reviewArtifacts({...artifacts,currentSource:await captureCurrentSource({codeRoot:root})});
  assert.equal(artifacts.raw.automatedPass,true);
  assert.deepEqual(artifacts.raw.failures,[]);
  assert.equal(reviewed.automaticRevalidation.pass,true);
  assert.equal(reviewed.labelGate.mode,'ai');
  assert.equal(reviewed.labelGate.approved,20);
  assert.equal(reviewed.labelGate.comparedOutputs,60);
  assert.equal(reviewed.labelGate.comparisonFailures.length,8);
  assert.deepEqual(reviewed.labelGate.comparisonFailures.map(({caseId,repeat,error})=>[caseId,repeat,error]),[
    ['ai-experience-depth',1,'englishExpression rating outside approved range'],
    ['ai-experience-depth',3,'englishExpression rating outside approved range'],
    ['backend-behavioral',1,'englishExpression rating outside approved range'],
    ['backend-behavioral',2,'englishExpression rating outside approved range'],
    ['backend-behavioral',3,'englishExpression rating outside approved range'],
    ['embedded-technical-communication',1,'englishExpression rating outside approved range'],
    ['embedded-technical-communication',2,'englishExpression rating outside approved range'],
    ['embedded-technical-communication',3,'englishExpression rating outside approved range']
  ]);
  assert.ok(reviewed.sourceEvidence.changedFiles.includes('src/model-contracts.js'));
  assert.equal(reviewed.labelGate.status,'FAIL');
  assert.equal(reviewed.releaseStatus,'BLOCKED');
});

test('offline review verifies all sixty outputs and clears only the bilingual gate',async()=>{
  const input=await fixtures(),before=structuredClone(input);
  const reviewed=reviewArtifacts(input);
  assert.equal(reviewed.reviewVersion,'1.0.0');
  assert.equal(reviewed.sourceEvidence.rawCodeChecksum,input.source.codeChecksum);
  assert.equal(reviewed.sourceEvidence.capturedModelRunMatchesRaw,true);
  assert.equal(reviewed.sourceEvidence.currentCodeChecksum,input.currentSource.codeChecksum);
  assert.equal(reviewed.sourceEvidence.currentMatchesRaw,false);
  assert.deepEqual(reviewed.sourceEvidence.changedFiles,['evaluation/run.js']);
  assert.equal(reviewed.automaticRevalidation.pass,true);
  assert.equal(reviewed.bilingualGate.status,'PASS');
  assert.equal(reviewed.bilingualGate.reviewedOutputs,60);
  assert.equal(reviewed.humanLabels.pass,false);
  assert.equal(reviewed.creator.pass,false);
  assert.equal(reviewed.releaseStatus,'BLOCKED');
  assert.deepEqual(input,before,'offline review must not mutate raw artifacts');
});

test('missing semantic review remains pending and cannot imply human or creator completion',async()=>{
  const input=await fixtures();input.semanticReviews={schemaVersion:2,contractVersion:MODEL_CONTRACT_VERSION,status:'pending-independent-ai-review',reviewerType:null,reviewer:null,reviewedAt:null,reviews:[]};
  const reviewed=reviewArtifacts(input);
  assert.equal(reviewed.bilingualGate.status,'PENDING');
  assert.equal(reviewed.humanLabels.pass,false);assert.equal(reviewed.creator.pass,false);assert.equal(reviewed.releaseStatus,'BLOCKED');
});

test('a substantive contradictory pair remains a failed semantic gate',async()=>{
  const input=await fixtures(),review=input.semanticReviews.reviews[0];
  review.verdict='inconsistent';review.contradictoryPairs=['question meaning'];review.rationale='The Chinese version changes the meaning of the question.';
  const reviewed=reviewArtifacts(input);
  assert.equal(reviewed.bilingualGate.status,'FAIL');
  assert.equal(reviewed.bilingualGate.pass,false);
  assert.match(reviewed.bilingualGate.errors[0],/inconsistent bilingual meaning/);
  assert.equal(reviewed.releaseStatus,'BLOCKED');
});

test('offline review rejects stale source, frozen analysis, audit or generated-output checksums',async()=>{
  for(const mutate of [
    input=>input.source.codeChecksum='d'.repeat(64),
    input=>input.frozen.entries[0][1].questions[0].text='Changed frozen question',
    input=>input.audit.cases[0].outputChecksum='stale',
    input=>input.reviewPacket[0].question.text='Changed packet question',
    input=>input.reviewPacket[0].inputChecksum='stale',
    input=>input.raw.runnerVersion='2.0.0',
    input=>input.frozen.effort='high',
    input=>input.raw.results[0].feedback.ratings.relevance.reason='Changed after generation',
    input=>{const first=input.raw.results[0],other=input.frozen.entries[0][1].questions.find(question=>question.category===first.question.category&&question.id!==first.question.id);first.question=other;const c=input.manifest.cases.find(item=>item.id===first.caseId),job=input.manifest.jobs.find(item=>item.id===c.jobId);first.inputChecksum=inputChecksum(job,c,other);first.outputChecksum=outputChecksum(first.caseId,first.repeat,other,first.feedback);first.bilingualAudit=checkBilingualConsistency(other,first.feedback);const audited=input.audit.cases.find(item=>item.caseId===first.caseId&&item.repeat===first.repeat);Object.assign(audited,{outputChecksum:first.outputChecksum,...first.bilingualAudit});input.semanticReviews.reviews.find(item=>item.caseId===first.caseId&&item.repeat===first.repeat).outputChecksum=first.outputChecksum;}
  ]){
    const input=await fixtures();mutate(input);assert.throws(()=>reviewArtifacts(input));
  }
});

test('offline review rejects current model-contract code that differs from the captured live run',async()=>{
  const input=await fixtures();input.currentSource.files['src/domain.js']='f'.repeat(64);
  assert.throws(()=>reviewArtifacts(input),/Model-contract source changed after the live run/);
});

test('offline review rejects a paid-provider report disguised as a Codex run and stale Codex metadata',async()=>{
  for(const [mutate,message] of [
    [raw=>raw.provider='OpenAI API',/Codex subscription provider/],
    [raw=>raw.provider='Codex / ChatGPT subscription / another-model / xhigh / fast',/Codex subscription provider/],
    [raw=>raw.configuration.cliVersion='',/Codex CLI version/],
    [raw=>raw.configuration.ephemeral=false,/ephemeral/],
    [raw=>raw.configuration.analysisPolicy='reuse old analyses',/analysis policy/]
  ]){
    const input=await fixtures();mutate(input.raw);
    assert.throws(()=>reviewArtifacts(input),message);
  }
});

test('v3 artifact reader validates saved packet and captures ordered runner source once without model calls',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'coach-v3-review-')),root=join(directory,'evaluation'),codeRoot=join(dirname(fileURLToPath(import.meta.url)),'..');
  try{
    const input=await fixtures();
    const captured=await captureModelRunSource({root,codeRoot});
    input.raw.codeChecksum=captured.source.codeChecksum;
    const runner=await readFile(join(codeRoot,'evaluation','run.js'),'utf8');
    const runnerList=runner.match(/const codeHash=createHash\('sha256'\);for\(const file of (\[[^\]]+\])\)codeHash\.update/);
    assert.ok(runnerList,'runner source hash list must be discoverable');
    const runnerFiles=[...runnerList[1].matchAll(/'([^']+)'/g)].map(([,file])=>join('evaluation',file));
    assert.deepEqual(Object.keys(captured.source.files),runnerFiles);
    const expectedHash=createHash('sha256');
    for(const file of runnerFiles)expectedHash.update(await readFile(join(codeRoot,file)));
    assert.equal(captured.source.codeChecksum,expectedHash.digest('hex'));
    assert.equal(captured.source.files['evaluation/run.js'].length,64);
    assert.equal(captured.source.files['src/model-contracts.js'].length,64);
    await assert.rejects(captureModelRunSource({root,codeRoot}),{code:'EEXIST'});
    const artifacts={
      'results/codex-v3.json':input.raw,'v3/codex-analysis.json':input.frozen,
      'v3/codex-bilingual-audit.json':input.audit,'v3/codex-review-packet.json':input.reviewPacket,
      'v3/semantic-reviews.json':input.semanticReviews,'v1/manifest.json':input.manifest,
      'v3/human-labels.json':input.humanLabels,'v3/creator-validation.json':input.creator
    };
    for(const [path,value] of Object.entries(artifacts)){const target=join(root,path);await mkdir(dirname(target),{recursive:true});await writeFile(target,JSON.stringify(value));}
    const {reviewed,output}=await createReviewedReport({root,codeRoot});
    assert.equal(output,join(root,'results','codex-v3-reviewed.json'));
    assert.equal(reviewed.sourceEvidence.currentMatchesRaw,true);
    assert.equal(reviewed.bilingualGate.status,'PASS');
    assert.equal(JSON.parse(await readFile(output)).artifactChecksums.reviewPacket.length,64);
    input.reviewPacket[0].inputChecksum='stale';
    await writeFile(join(root,'v3','codex-review-packet.json'),JSON.stringify(input.reviewPacket));
    await assert.rejects(createReviewedReport({root,codeRoot}),/Saved Codex review packet differs/);
  }finally{await rm(directory,{recursive:true,force:true});}
});
