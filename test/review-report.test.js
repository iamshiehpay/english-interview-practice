import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {FakeLanguageModel} from '../src/providers.js';
import {MODEL_CONTRACT_VERSION} from '../src/model-contracts.js';
import {checkBilingualConsistency,inputChecksum,outputChecksum,stability} from '../evaluation/checks.js';
import {reviewArtifacts} from '../evaluation/review-report.js';

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
  const raw={suiteVersion:manifest.suiteVersion,runnerVersion:'2.0.0',contractVersion:MODEL_CONTRACT_VERSION,generatedAt:'2026-09-18T00:00:00Z',codeChecksum,provider:'Codex / test',model:'gpt-test',mode:'live model on synthetic inputs',jobs:5,cases:20,repeats:3,providerCalls:60,analysisCalls:5,automatedPass:true,stability:stable,failures:[],results};
  const frozen={schemaVersion:2,contractVersion:MODEL_CONTRACT_VERSION,model:'gpt-test',jdChecksum:(await import('node:crypto')).createHash('sha256').update(JSON.stringify(manifest.jobs)).digest('hex'),entries};
  const audit={schemaVersion:2,contractVersion:MODEL_CONTRACT_VERSION,status:'pending-independent-ai-review',automaticPass:true,cases:results.map(({caseId,repeat,outputChecksum,bilingualAudit})=>({caseId,repeat,outputChecksum,...bilingualAudit}))};
  const semanticReviews={schemaVersion:2,contractVersion:MODEL_CONTRACT_VERSION,reviewerType:'ai',reviewer:'Independent reviewer',reviewedAt:'2026-09-18T01:00:00Z',reviews:audit.cases.map(item=>({caseId:item.caseId,repeat:item.repeat,outputChecksum:item.outputChecksum,verdict:'consistent',rationale:'The paired coaching preserves the assessment and advice.',contradictoryPairs:[]}))};
  const protectedFiles=['src/model-contracts.js','src/model-schemas.js','src/domain.js','src/providers.js','src/cloud.js','src/codex-language.js'];
  const source={note:'Captured before later guard-only changes.',codeChecksum,files:{'evaluation/run.js':'b'.repeat(64),...Object.fromEntries(protectedFiles.map((file,index)=>[file,String(index+1).repeat(64)]))}};
  const currentSource={codeChecksum:'d'.repeat(64),files:{'evaluation/run.js':'e'.repeat(64),...Object.fromEntries(protectedFiles.map((file,index)=>[file,String(index+1).repeat(64)]))}};
  return {raw,frozen,audit,semanticReviews,source,currentSource,manifest,humanLabels:{schemaVersion:2,contractVersion:MODEL_CONTRACT_VERSION,status:'pending-human-review',labels:[]},creator:{schemaVersion:2,contractVersion:MODEL_CONTRACT_VERSION,creator:null,attestedAt:null,loops:[]}};
}

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

test('offline review rejects stale source, frozen analysis, audit or generated-output checksums',async()=>{
  for(const mutate of [
    input=>input.source.codeChecksum='d'.repeat(64),
    input=>input.frozen.entries[0][1].questions[0].text='Changed frozen question',
    input=>input.audit.cases[0].outputChecksum='stale',
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
