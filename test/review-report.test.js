import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {FakeLanguageModel} from '../src/providers.js';
import {MODEL_CONTRACT_VERSION} from '../src/model-contracts.js';
import {checkBilingualConsistency,compareLabelExpectations,dimensions,inputChecksum,labelStatus,outputChecksum,stability} from '../evaluation/checks.js';
import {captureCurrentSource,captureModelRunSource,createReviewedReport,reviewArtifacts} from '../evaluation/review-report.js';

const manifest=JSON.parse(await readFile(new URL('../evaluation/v1/manifest.json',import.meta.url)));
const checksum=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function freezeFixture(input){
  if(input.raw.contractVersion==='3.3.0')input.labelFreeze={schemaVersion:1,contractVersion:'3.3.0',packetChecksum:checksum(input.blindPacket),labelChecksum:checksum(input.humanLabels)};
}

async function fixtures(contractVersion=MODEL_CONTRACT_VERSION){
  const provider=new FakeLanguageModel(),entries=[],results=[];
  for(const job of manifest.jobs){
    const analysis=await provider.analyze({snapshot:job});entries.push([job.text,analysis]);
    for(const c of manifest.cases.filter(item=>item.jobId===job.id)){
      const question=analysis.questions.find(item=>item.category===c.category);
      for(let repeat=1;repeat<=3;repeat++){
        const feedback=await provider.feedback({transcript:c.transcript});
        results.push({caseId:c.id,repeat,inputChecksum:inputChecksum(job,c,question,contractVersion),outputChecksum:outputChecksum(c.id,repeat,question,feedback,contractVersion),question,feedback,bilingualAudit:checkBilingualConsistency(question,feedback)});
      }
    }
  }
  const stable=stability(results),codeChecksum='a'.repeat(64);
  const raw={suiteVersion:manifest.suiteVersion,runnerVersion:contractVersion,contractVersion,generatedAt:'2026-09-24T00:00:00Z',codeChecksum,provider:'Codex / ChatGPT subscription / gpt-test / xhigh / fast',model:'gpt-test',configuration:{cliVersion:'1.0.0',effort:'xhigh',serviceTier:'priority',ephemeral:true,analysisPolicy:'one live generation per JD, frozen across three feedback repeats'},mode:'live model on synthetic inputs',jobs:5,cases:20,repeats:3,providerCalls:60,analysisCalls:5,...(contractVersion==='3.3.0'?{cumulativeModelRequests:65,cumulativeAnalysisRequests:5,cumulativeFeedbackRequests:60,maxTotalModelRequests:65,reusedResults:0,newResults:60}:{}),automatedPass:true,stability:stable,failures:[],results};
  const frozen={schemaVersion:2,contractVersion,model:'gpt-test',effort:'xhigh',serviceTier:'priority',jdChecksum:(await import('node:crypto')).createHash('sha256').update(JSON.stringify(manifest.jobs)).digest('hex'),entries};
  const audit={schemaVersion:2,contractVersion,status:'pending-independent-ai-review',automaticPass:true,cases:results.map(({caseId,repeat,outputChecksum,bilingualAudit})=>({caseId,repeat,outputChecksum,...bilingualAudit}))};
  const reviewPacket=manifest.cases.map(c=>{const result=results.find(item=>item.caseId===c.id&&item.repeat===1);return {caseId:c.id,inputChecksum:result.inputChecksum,contractVersion,job:manifest.jobs.find(job=>job.id===c.jobId).text,question:result.question,transcript:c.transcript,tags:c.tags,proposedExpectation:c.proposedExpectation,bilingualAudit:result.bilingualAudit,humanLabelTemplate:{caseId:c.id,inputChecksum:result.inputChecksum,status:'pending',reviewer:null,reviewedAt:null,ranges:Object.fromEntries(dimensions.map(d=>[d,null])),rationale:null,evidenceQuotes:[],requiredFindings:[],forbiddenFindings:[],bilingualSemanticConsistency:'pending'}};});
  const semanticReviews={schemaVersion:2,contractVersion,reviewerType:'ai',reviewer:'Independent reviewer',reviewedAt:'2026-09-18T01:00:00Z',reviews:audit.cases.map(item=>({caseId:item.caseId,repeat:item.repeat,outputChecksum:item.outputChecksum,verdict:'consistent',rationale:'The paired coaching preserves the assessment and advice.',contradictoryPairs:[]}))};
  const protectedFiles=['src/model-contracts.js','src/model-schemas.js','src/domain.js','src/providers.js','src/cloud.js','src/codex-language.js'];
  const source={note:'Captured before later guard-only changes.',codeChecksum,files:{'evaluation/run.js':'b'.repeat(64),...Object.fromEntries(protectedFiles.map((file,index)=>[file,String(index+1).repeat(64)]))}};
  const currentSource={codeChecksum:'d'.repeat(64),files:{'evaluation/run.js':'e'.repeat(64),...Object.fromEntries(protectedFiles.map((file,index)=>[file,String(index+1).repeat(64)]))}};
  const blindPacket=reviewPacket.map(({caseId,inputChecksum,contractVersion,job,question,transcript,tags,proposedExpectation})=>({caseId,inputChecksum,contractVersion,job,question,transcript,tags,proposedExpectation}));
  const input={raw,frozen,audit,reviewPacket,semanticReviews,source,currentSource,manifest,humanLabels:{schemaVersion:2,contractVersion,status:'pending-human-review',labels:[]},creator:{schemaVersion:2,contractVersion,creator:null,attestedAt:null,loops:[]},blindPacket};
  freezeFixture(input);
  return input;
}

function approveFixtureLabels(input){
  input.humanLabels={schemaVersion:2,contractVersion:input.raw.contractVersion,labelProvenance:{mode:'persona-drafted-ai-approved',drafter:'Rater persona',approver:'Independent AI reviewer'},labels:input.reviewPacket.map(item=>({caseId:item.caseId,inputChecksum:item.inputChecksum,status:'approved',reviewerType:'ai',reviewer:'Independent AI reviewer',reviewedAt:'2026-09-24T01:00:00Z',rationale:'The quoted answer shows a concrete basis for the ratings.',ranges:Object.fromEntries(dimensions.map(d=>[d,[1,4]])),evidenceQuotes:[item.transcript.slice(0,Math.min(12,item.transcript.length))],requiredFindings:['Demonstration rating only'],forbiddenFindings:['Invented specific metric'],bilingualSemanticConsistency:'approved'}))};
  input.creator={validationMode:'ai-persona',creator:null,attestedBy:'Independent AI verifier',attestedAt:'2026-09-24T01:00:00Z',loops:Array.from({length:5},(_,i)=>({recordId:`record-${i}`,snapshotId:`snapshot-${i%2}`,category:i%2?'behavioral':'role-fit',completedAt:'2026-09-24T00:00:00Z',completed:true,synthetic:true,inputMode:'text',persona:'Test persona',evidence:'docs/verification/test-persona.md',experienceGap:i===0,inducedFailure:i===1?{type:'cancelled and retried',recovered:true}:null}))};
  freezeFixture(input);
}

test('offline review compares all sixty outputs against twenty AI-approved labels before AI validation',async()=>{
  const input=await fixtures();approveFixtureLabels(input);
  const reviewed=reviewArtifacts(input);
  assert.equal(reviewed.artifactChecksums.blindPacket,checksum(input.blindPacket));
  assert.equal(reviewed.artifactChecksums.labelFreeze,checksum(input.labelFreeze));
  assert.equal(reviewed.labelGate.status,'PASS');
  assert.equal(reviewed.labelGate.mode,'ai');
  assert.equal(reviewed.labelGate.approved,20);
  assert.equal(reviewed.labelGate.comparedOutputs,60);
  assert.equal(reviewed.releaseStatus,'AI-validated');
});

test('offline review rejects post-run label edits and blind-packet or freeze changes',async()=>{
  const labels=await fixtures();approveFixtureLabels(labels);
  labels.humanLabels.labels[0].ranges.support=[4,4];
  assert.throws(()=>reviewArtifacts(labels),/Frozen blind packet or approved labels changed/);
  const packet=await fixtures();approveFixtureLabels(packet);
  packet.blindPacket[0].transcript='Changed blind transcript';
  assert.throws(()=>reviewArtifacts(packet),/Saved blind packet differs from frozen analyses/);
  const freeze=await fixtures();approveFixtureLabels(freeze);
  freeze.labelFreeze.packetChecksum='f'.repeat(64);
  assert.throws(()=>reviewArtifacts(freeze),/Frozen blind packet or approved labels changed/);
  const missing=await fixtures();approveFixtureLabels(missing);
  delete missing.labelFreeze;
  assert.throws(()=>reviewArtifacts(missing),/Frozen blind packet or approved labels changed/);
});

test('offline review blocks ranges and required or forbidden literal findings that fail saved feedback',async()=>{
  for(const [change,message] of [
    [label=>{label.ranges.support=[4,4];},/support rating outside approved range/],
    [label=>{label.requiredFindings=['never-written-finding'];},/Required finding missing/],
    [label=>{label.forbiddenFindings=['You supplied an answer to review.'];},/Forbidden finding present/]
  ]){
    const input=await fixtures();approveFixtureLabels(input);change(input.humanLabels.labels[0]);freezeFixture(input);
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
  const paths={raw:'evaluation/results/codex-v3.json',frozen:'evaluation/v3/codex-analysis.json',audit:'evaluation/v3/codex-bilingual-audit.json',reviewPacket:'evaluation/v3/codex-review-packet.json',semanticReviews:'evaluation/v3/semantic-reviews.json',source:'evaluation/provenance/codex-v3-model-run-source.json',manifest:'evaluation/v1/manifest.json',humanLabels:'evaluation/v3/human-labels.json',creator:'evaluation/v3/creator-validation.json'};
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

test('frozen 3.2 approved labels retain the original 35 failures under the current contract',async()=>{
  const root=join(dirname(fileURLToPath(import.meta.url)),'..');
  const [raw,packet,humanLabels]=await Promise.all([
    'evaluation/results/codex-v3-2.json',
    'evaluation/v3-2/codex-review-packet.json',
    'evaluation/v3-2/human-labels.json'
  ].map(async path=>JSON.parse(await readFile(join(root,path),'utf8'))));
  assert.equal(MODEL_CONTRACT_VERSION,'3.3.0');
  assert.equal(raw.contractVersion,'3.2.0');
  const labels=labelStatus(packet,humanLabels,'3.2.0');
  assert.equal(labels.pass,true);
  assert.equal(labels.approved.length,20);
  const compared=compareLabelExpectations(raw.results,labels.approved);
  assert.equal(compared.comparisons.length,60);
  assert.equal(compared.comparisons.filter(item=>item.pass).length,25);
  assert.equal(compared.failures.length,35);
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

test('historical contracts retain their captured model-contract evidence and require matching runner versions',async()=>{
  for(const contractVersion of ['3.0.0','3.2.0']){
    const input=await fixtures(contractVersion);
    input.currentSource.files['src/model-contracts.js']='f'.repeat(64);
    assert.equal(reviewArtifacts(input).contractVersion,contractVersion);
    input.raw.runnerVersion=MODEL_CONTRACT_VERSION;
    if(input.raw.runnerVersion!==contractVersion)assert.throws(()=>reviewArtifacts(input),/Raw report runner changed/);
    input.raw.runnerVersion=contractVersion;
    input.currentSource.files['src/domain.js']='f'.repeat(64);
    assert.throws(()=>reviewArtifacts(input),/Model-contract source changed after the live run/);
  }
});

test('current contract requires exact captured model-contract source and rejects mismatched runner',async()=>{
  const input=await fixtures();
  input.currentSource.files['src/model-contracts.js']='f'.repeat(64);
  assert.throws(()=>reviewArtifacts(input),/Model-contract source changed after the live run/);
  input.currentSource.files['src/model-contracts.js']=input.source.files['src/model-contracts.js'];
  input.raw.runnerVersion='3.0.0';
  assert.throws(()=>reviewArtifacts(input),/Raw report runner changed/);
});

test('current contract accepts staged and resumed runs with durable sixty-five-request evidence',async()=>{
  const staged=await fixtures();
  staged.raw.analysisCalls=0;
  assert.equal(reviewArtifacts(staged).automaticRevalidation.outputs,60);
  const resumed=await fixtures();
  resumed.raw.analysisCalls=0;
  resumed.raw.providerCalls=18;
  resumed.raw.reusedResults=42;
  resumed.raw.newResults=18;
  assert.equal(reviewArtifacts(resumed).automaticRevalidation.outputs,60);
  const retried=await fixtures();
  retried.raw.maxTotalModelRequests=70;
  retried.raw.cumulativeModelRequests=68;
  retried.raw.cumulativeAnalysisRequests=6;
  retried.raw.cumulativeFeedbackRequests=62;
  assert.equal(reviewArtifacts(retried).automaticRevalidation.outputs,60);
  const sameProcessRetry=await fixtures();
  sameProcessRetry.raw.maxTotalModelRequests=70;
  sameProcessRetry.raw.cumulativeModelRequests=67;
  sameProcessRetry.raw.cumulativeAnalysisRequests=6;
  sameProcessRetry.raw.cumulativeFeedbackRequests=61;
  sameProcessRetry.raw.analysisCalls=6;
  sameProcessRetry.raw.providerCalls=61;
  assert.equal(reviewArtifacts(sameProcessRetry).automaticRevalidation.outputs,60);
});

test('current contract rejects missing, inconsistent, or invalid request counts',async()=>{
  for(const [mutate,message] of [
    [raw=>delete raw.cumulativeModelRequests,/model requests exceed the recorded limit/],
    [raw=>raw.cumulativeAnalysisRequests=4,/at least five analysis requests/],
    [raw=>raw.cumulativeFeedbackRequests=59,/at least sixty feedback requests/],
    [raw=>raw.maxTotalModelRequests=64,/Recorded model request limit/],
    [raw=>raw.cumulativeModelRequests=66,/model requests exceed the recorded limit/],
    [raw=>{raw.maxTotalModelRequests=70;raw.cumulativeModelRequests=68;raw.cumulativeAnalysisRequests=6;},/Raw cumulative request counts differ/],
    [raw=>raw.analysisCalls=5.5,/Current-process analysis calls/],
    [raw=>raw.analysisCalls=6,/Current-process analysis calls/],
    [raw=>raw.providerCalls=-1,/Current-process feedback calls/],
    [raw=>raw.providerCalls=61,/Current-process feedback calls/],
    [raw=>raw.providerCalls=59,/cannot be fewer than new results/],
    [raw=>raw.reusedResults=2,/New result count/],
    [raw=>raw.newResults=59,/New result count/]
  ]){
    const input=await fixtures();mutate(input.raw);
    assert.throws(()=>reviewArtifacts(input),message);
  }
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

test('v3-3 artifact reader validates saved packet and captures ordered runner source once without model calls',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'coach-v3-review-')),root=join(directory,'evaluation'),codeRoot=join(dirname(fileURLToPath(import.meta.url)),'..');
  try{
    const input=await fixtures();
    const captured=await captureModelRunSource({root,codeRoot});
    assert.equal(captured.output,join(root,'provenance','codex-v3-3-model-run-source.json'));
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
      'results/codex-v3-3.json':input.raw,'v3-3/codex-analysis.json':input.frozen,
      'v3-3/codex-bilingual-audit.json':input.audit,'v3-3/codex-review-packet.json':input.reviewPacket,
      'v3-3/codex-label-blind-packet.json':input.blindPacket,'v3-3/codex-label-freeze.json':input.labelFreeze,
      'v3-3/semantic-reviews.json':input.semanticReviews,'v1/manifest.json':input.manifest,
      'v3-3/human-labels.json':input.humanLabels,'v3-3/creator-validation.json':input.creator
    };
    for(const [path,value] of Object.entries(artifacts)){const target=join(root,path);await mkdir(dirname(target),{recursive:true});await writeFile(target,JSON.stringify(value));}
    const {reviewed,output}=await createReviewedReport({root,codeRoot});
    assert.equal(output,join(root,'results','codex-v3-3-reviewed.json'));
    assert.equal(reviewed.sourceEvidence.currentMatchesRaw,true);
    assert.equal(reviewed.bilingualGate.status,'PASS');
    assert.equal(JSON.parse(await readFile(output)).artifactChecksums.reviewPacket.length,64);
    const changedLabels=structuredClone(input.humanLabels);
    changedLabels.status='changed-after-feedback';
    await writeFile(join(root,'v3-3','human-labels.json'),JSON.stringify(changedLabels));
    await assert.rejects(createReviewedReport({root,codeRoot}),/Frozen blind packet or approved labels changed/);
    await writeFile(join(root,'v3-3','human-labels.json'),JSON.stringify(input.humanLabels));
    input.reviewPacket[0].inputChecksum='stale';
    await writeFile(join(root,'v3-3','codex-review-packet.json'),JSON.stringify(input.reviewPacket));
    await assert.rejects(createReviewedReport({root,codeRoot}),/Saved Codex review packet differs/);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('explicit v3 artifact reader preserves historical paths and rejects version mixups',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'coach-v3-history-')),root=join(directory,'evaluation'),codeRoot=join(dirname(fileURLToPath(import.meta.url)),'..');
  try{
    const input=await fixtures('3.0.0');
    const captured=await captureModelRunSource({root,codeRoot,version:'v3'});
    assert.equal(captured.output,join(root,'provenance','codex-v3-model-run-source.json'));
    input.raw.codeChecksum=captured.source.codeChecksum;
    const artifacts={
      'results/codex-v3.json':input.raw,'v3/codex-analysis.json':input.frozen,
      'v3/codex-bilingual-audit.json':input.audit,'v3/codex-review-packet.json':input.reviewPacket,
      'v3/semantic-reviews.json':input.semanticReviews,'v1/manifest.json':input.manifest,
      'v3/human-labels.json':input.humanLabels,'v3/creator-validation.json':input.creator
    };
    for(const [path,value] of Object.entries(artifacts)){const target=join(root,path);await mkdir(dirname(target),{recursive:true});await writeFile(target,JSON.stringify(value));}
    const {reviewed,output}=await createReviewedReport({root,codeRoot,version:'v3'});
    assert.equal(output,join(root,'results','codex-v3-reviewed.json'));
    assert.equal(reviewed.contractVersion,'3.0.0');
    await assert.rejects(captureModelRunSource({root,codeRoot,version:'v3'}),{code:'EEXIST'});
    await assert.rejects(createReviewedReport({root,codeRoot}),{code:'ENOENT'});
    await assert.rejects(createReviewedReport({root,codeRoot,version:'v2'}),/Unsupported offline review artifact version/);
  }finally{await rm(directory,{recursive:true,force:true});}
});
