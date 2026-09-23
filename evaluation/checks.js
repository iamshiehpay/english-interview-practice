import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {MODEL_CONTRACT_VERSION} from '../src/model-contracts.js';
export const dimensions=['relevance','support','structure','englishExpression'];
export const categories=['role-fit','experience-depth','behavioral','technical-communication'];
const keys=(v,n)=>assert.deepEqual(Object.keys(v).sort(),[...n].sort());
export function inputChecksum(job,c,question){return createHash('sha256').update(JSON.stringify({contractVersion:MODEL_CONTRACT_VERSION,job:job.text,category:c.category,transcript:c.transcript,question})).digest('hex');}
export function outputChecksum(caseId,repeat,question,feedback){return createHash('sha256').update(JSON.stringify({contractVersion:MODEL_CONTRACT_VERSION,caseId,repeat,question,feedback})).digest('hex');}
const han=/\p{Script=Han}/u;
export function checkBilingualConsistency(question,feedback){
  const pairs=[['question meaning',question?.text,question?.meaningZh],['question rationale',question?.rationale,question?.rationaleZh],...dimensions.map(d=>[`${d} reason`,feedback?.ratings?.[d]?.reason,feedback?.ratings?.[d]?.reasonZh]),['strength',feedback?.strength?.text,feedback?.strength?.textZh],['priority improvement',feedback?.priorityImprovement?.text,feedback?.priorityImprovement?.textZh]];
  const errors=[];
  for(const [name,en,zh] of pairs){if(typeof en!=='string'||!en.trim()||typeof zh!=='string'||!zh.trim()||!han.test(zh))errors.push(`${name}: missing English or Traditional Chinese counterpart`);else if(en.normalize('NFKC').trim()===zh.normalize('NFKC').trim())errors.push(`${name}: untranslated duplicate`);}
  return {pass:errors.length===0,automaticChecks:['both counterparts are nonempty','Chinese counterpart contains Han script','counterparts are not identical'],semanticReviewRequired:true,semanticStatus:'pending-human-review',pairs:pairs.map(([name,en,zh])=>({name,en,zh})),errors};
}
export function validateManifest(m){
  assert.equal(m.suiteVersion,'1.0.0');assert.equal(m.jobs.length,5);assert.equal(m.cases.length,20);
  assert.equal(new Set(m.jobs.map(j=>j.id)).size,5);assert.equal(new Set(m.cases.map(c=>c.id)).size,20);
  for(const j of m.jobs){assert.ok(j.text?.trim());assert.ok(Array.isArray(j.absentRequirements));for(const phrase of j.absentRequirements)assert.ok(!j.text.includes(phrase));}
  for(const c of m.cases){assert.ok(m.jobs.some(j=>j.id===c.jobId));assert.ok(categories.includes(c.category));assert.ok(c.transcript?.trim());assert.ok(Array.isArray(c.forbiddenGeneratedPhrases));}
  for(const category of categories)assert.equal(m.cases.filter(c=>c.category===category).length,5);
  for(const job of m.jobs)assert.deepEqual(m.cases.filter(c=>c.jobId===job.id).map(c=>c.category).sort(),[...categories].sort());
  for(const tag of ['irrelevant','unsupported-claim','mixed-language','transcription-noise','experience-gap','absent-JD-requirement'])assert.ok(m.cases.some(c=>c.tags.includes(tag)),tag);
}
export function checkFrozenAnalysis(frozen,expected){
  assert.equal(frozen.schemaVersion,2,'Frozen analysis schema changed; use --refresh-analysis and re-review');assert.equal(frozen.contractVersion,expected.contractVersion,'Frozen model contract changed; use --refresh-analysis and re-review');
  for(const key of ['model','effort','serviceTier'])assert.ok(Object.hasOwn(frozen,key)&&frozen[key]===expected[key],`Frozen ${key} changed or missing; use --refresh-analysis and re-review labels`);
  assert.equal(frozen.jdChecksum,expected.jdChecksum,'JD fixtures changed; refresh and review');
}
export function checkAnalysis(a,job){
  assert.ok(a.capabilities.length>0);assert.ok(a.questions.length>=8&&a.questions.length<=12);
  assert.equal(new Set(a.capabilities.map(c=>c.id)).size,a.capabilities.length);assert.equal(new Set(a.questions.map(q=>q.id)).size,a.questions.length);
  for(const c of a.capabilities){keys(c,['id','description','evidence','kind']);assert.ok(c.evidence&&job.text.includes(c.evidence));assert.ok(['fact','inference'].includes(c.kind));if(c.kind==='fact')assert.ok(c.evidence.includes(c.description));}
  for(const q of a.questions){keys(q,['id','text','meaningZh','rationale','rationaleZh','category','capabilityIds','evidence']);assert.ok(categories.includes(q.category));assert.ok(q.capabilityIds.length);assert.ok(q.capabilityIds.every(id=>a.capabilities.some(c=>c.id===id)));assert.ok(a.capabilities.some(c=>q.capabilityIds.includes(c.id)&&c.evidence===q.evidence));const audit=checkBilingualConsistency(q);assert.equal(audit.errors.filter(e=>e.startsWith('question')).length,0);}
  assert.ok(categories.every(cat=>a.questions.some(q=>q.category===cat)));
  const generated=JSON.stringify({capabilities:a.capabilities.map(c=>c.description),questions:a.questions.map(q=>[q.text,q.rationale])}).toLowerCase();
  for(const absent of job.absentRequirements)assert.ok(!generated.includes(absent.toLowerCase()),`absent JD requirement: ${absent}`);
}
export function checkFeedback(f,c){
  keys(f,['ratings','strength','priorityImprovement']);keys(f.ratings,dimensions);
  for(const d of dimensions){const r=f.ratings[d];keys(r,['level','quote','reason','reasonZh']);assert.ok(Number.isInteger(r.level)&&r.level>=1&&r.level<=4);assert.ok(r.quote&&c.transcript.includes(r.quote));assert.ok(r.reason?.trim());assert.match(r.reasonZh,han);}
  for(const k of ['strength','priorityImprovement']){keys(f[k],['text','textZh','quote']);assert.ok(f[k].quote&&c.transcript.includes(f[k].quote));assert.ok(f[k].text?.trim());assert.match(f[k].textZh,han);}
  // Exclude verbatim evidence quotes: quoting an unsupported claim is not endorsing it.
  const generated=[...dimensions.flatMap(d=>[f.ratings[d].reason,f.ratings[d].reasonZh]),f.strength.text,f.strength.textZh,f.priorityImprovement.text,f.priorityImprovement.textZh].join('\n').toLowerCase();
  for(const phrase of c.forbiddenGeneratedPhrases)assert.ok(!generated.includes(phrase.toLowerCase()),`prohibited generated assertion: ${phrase}`);
}
export function stability(results){
  const ids=[...new Set(results.map(r=>r.caseId))];let stable=0,total=ids.length*4;
  for(const id of ids){const runs=results.filter(r=>r.caseId===id);assert.equal(runs.length,3);assert.deepEqual(runs.map(r=>r.repeat).sort(),[1,2,3]);for(const d of dimensions){const levels=runs.map(r=>r.feedback.ratings[d].level);if(Math.max(...levels)-Math.min(...levels)<=1)stable++;}}
  return {stable,total,ratio:total?stable/total:0,pass:total===80&&stable/total>=0.9};
}
export function labelStatus(packet,labels){
  const errors=[];const approved=[];
  const current=packet.some(item=>item.contractVersion);
  if(labels.schemaVersion!==(current?2:1))errors.push('Unsupported label schema');
  if(current&&labels.contractVersion!==MODEL_CONTRACT_VERSION)errors.push('Stale model contract version');
  for(const item of packet){const matches=labels.labels.filter(l=>l.caseId===item.caseId);const l=matches[0];try{
    assert.equal(matches.length,1);assert.equal(l.inputChecksum,item.inputChecksum);assert.equal(l.status,'approved');assert.ok(l.reviewer?.trim());assert.ok(Number.isFinite(Date.parse(l.reviewedAt)));assert.ok(l.rationale?.trim());
    keys(l.ranges,dimensions);for(const d of dimensions){assert.equal(l.ranges[d].length,2);const [min,max]=l.ranges[d];assert.ok(Number.isInteger(min)&&Number.isInteger(max)&&min>=1&&max<=4&&min<=max);}
    assert.ok(l.evidenceQuotes.length>0&&l.evidenceQuotes.every(q=>q&&item.transcript.includes(q)));assert.ok(Array.isArray(l.requiredFindings)&&Array.isArray(l.forbiddenFindings));assert.ok([...l.requiredFindings,...l.forbiddenFindings].every(f=>typeof f==='string'&&f.trim()));if(current)assert.equal(l.bilingualSemanticConsistency,'approved');approved.push(l);
  }catch{errors.push(`${item.caseId}: missing, stale or invalid human approval`);}}
  return {pass:errors.length===0&&packet.length===20,approved,errors};
}
export function semanticReviewStatus(audits,artifact){
  const errors=[];const reviewed=[];
  if(artifact.schemaVersion!==2||artifact.contractVersion!==MODEL_CONTRACT_VERSION)errors.push('Unsupported or stale semantic review schema');
  if(artifact.reviewerType!=='ai'||!artifact.reviewer?.trim()||!Number.isFinite(Date.parse(artifact.reviewedAt)))errors.push('Independent AI reviewer identity and review time are required');
  for(const item of audits){const matches=(artifact.reviews||[]).filter(review=>review.caseId===item.caseId&&review.repeat===item.repeat);const review=matches[0];try{
    assert.equal(matches.length,1);assert.equal(review.outputChecksum,item.outputChecksum);assert.ok(['consistent','inconsistent'].includes(review.verdict));assert.ok(review.rationale?.trim());assert.ok(Array.isArray(review.contradictoryPairs));
    const names=new Set(item.bilingualAudit.pairs.map(pair=>pair.name));assert.ok(review.contradictoryPairs.every(name=>names.has(name)));if(review.verdict==='consistent')assert.equal(review.contradictoryPairs.length,0);else assert.ok(review.contradictoryPairs.length>0);
    reviewed.push(review);if(review.verdict!=='consistent')errors.push(`${item.caseId}: reviewer found inconsistent bilingual meaning`);
  }catch{errors.push(`${item.caseId}: missing, stale or invalid semantic review`);}}
  return {pass:errors.length===0&&audits.length===60,reviewed,errors};
}
export function creatorStatus(ledger){
  const loops=ledger.loops||[];return {pass:!!ledger.creator?.trim()&&Number.isFinite(Date.parse(ledger.attestedAt))&&loops.length>=5&&new Set(loops.map(l=>l.recordId)).size===loops.length&&loops.every(l=>l.recordId&&l.snapshotId&&categories.includes(l.category)&&Number.isFinite(Date.parse(l.completedAt))&&l.completed===true&&l.synthetic===false&&['text','voice'].includes(l.inputMode))&&new Set(loops.map(l=>l.snapshotId)).size>=2&&new Set(loops.map(l=>l.category)).size>=2&&loops.some(l=>l.experienceGap===true)&&loops.some(l=>l.inducedFailure?.type&&l.inducedFailure?.recovered===true),count:loops.length};
}
