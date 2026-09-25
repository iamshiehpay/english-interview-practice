import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=dirname(fileURLToPath(import.meta.url));
const read=async name=>JSON.parse(await readFile(join(root,name),'utf8'));
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const [packet,a,b,adjudication,approval,raw]=await Promise.all([
  read('structure-boundary-blind-packet.json'),
  read('structure-boundary-rater-a.json'),
  read('structure-boundary-rater-b.json'),
  read('structure-boundary-adjudication-blind.json'),
  read('label-approval.json'),
  JSON.parse(await readFile(join(root,'..','results','codex-v3-3.json'),'utf8'))
]);
assert.equal(adjudication.schemaVersion,1);
assert.equal(adjudication.packetChecksum,sha(packet));
assert.deepEqual(adjudication.draftChecksums,{a:sha(a),b:sha(b)});
assert.equal(adjudication.blindToHistoricalScores,true);
assert.ok(adjudication.adjudicator?.trim()&&Number.isFinite(Date.parse(adjudication.adjudicatedAt)));
assert.equal(adjudication.cases.length,20);
assert.equal(approval.caseDecisions.length,20);
assert.equal(raw.results.length,60);
const labels=new Map(approval.caseDecisions.map(item=>[item.caseId,item]));
const inside=(level,[low,high])=>level>=low&&level<=high;
const cases=[];
for(const [index,source] of packet.cases.entries()){
  const decision=adjudication.cases[index],first=a.cases[index],second=b.cases[index],label=labels.get(source.caseId);
  assert.ok(label&&label.inputChecksum===source.inputChecksum);
  assert.equal(decision.caseId,source.caseId);
  assert.equal(decision.inputChecksum,source.inputChecksum);
  assert.equal(decision.raterALevel,first.level);
  assert.equal(decision.raterBLevel,second.level);
  assert.ok(Number.isInteger(decision.decisionLevel)&&decision.decisionLevel>=1&&decision.decisionLevel<=4);
  assert.ok(typeof decision.quote==='string'&&decision.quote&&source.transcript.includes(decision.quote));
  assert.ok(decision.rationale?.trim());
  assert.equal(typeof decision.disagreementResolved,'boolean');
  const prior=raw.results.filter(item=>item.caseId===source.caseId).sort((x,y)=>x.repeat-y.repeat);
  assert.deepEqual(prior.map(item=>item.repeat),[1,2,3]);
  assert.ok(prior.every(item=>item.inputChecksum===source.inputChecksum));
  const approvedRange=label.approvedRanges.structure;
  const blindLevels=[first.level,second.level,decision.decisionLevel];
  const blindSupportCount=blindLevels.filter(level=>inside(level,approvedRange)).length;
  const repeats=prior.map(item=>({repeat:item.repeat,modelLevel:item.feedback.ratings.structure.level,modelOutsideApproved:!inside(item.feedback.ratings.structure.level,approvedRange),direction:item.feedback.ratings.structure.level<approvedRange[0]?'below':item.feedback.ratings.structure.level>approvedRange[1]?'above':'inside'}));
  cases.push({caseId:source.caseId,inputChecksum:source.inputChecksum,approvedRange,blindLevels,blindSupportCount,raterDisagreement:first.level!==second.level,disagreementResolved:decision.disagreementResolved,repeats});
}
const failedRepeats=cases.flatMap(item=>item.repeats.filter(repeat=>repeat.modelOutsideApproved).map(repeat=>({caseId:item.caseId,repeat:repeat.repeat,direction:repeat.direction,blindSupportCount:item.blindSupportCount})));
assert.equal(failedRepeats.length,27,'Historical structure misses changed');
assert.equal(failedRepeats.filter(item=>item.direction==='below').length,26);
assert.equal(failedRepeats.filter(item=>item.direction==='above').length,1);
const byBlindSupport=Object.fromEntries([0,1,2,3].map(count=>[count,failedRepeats.filter(item=>item.blindSupportCount===count).length]));
const report={schemaVersion:1,generatedAt:new Date().toISOString(),purpose:'Diagnostic comparison after independent blind adjudication; historical labels and outputs unchanged',artifactChecksums:{packet:sha(packet),raterA:sha(a),raterB:sha(b),blindAdjudication:sha(adjudication),historicalLabelApproval:sha(approval),historicalRawReport:sha(raw)},historicalReleaseStatus:'BLOCKED',raterAgreementCases:cases.filter(item=>item.blindLevels[0]===item.blindLevels[1]).length,unresolvedRaterDisagreements:cases.filter(item=>item.raterDisagreement&&!item.disagreementResolved).length,structureMisses:failedRepeats.length,structureMissesByDirection:{below:26,above:1},failedRepeatsByBlindSupportCount:byBlindSupport,cases,failedRepeats};
await writeFile(join(root,'structure-boundary-comparison.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output:'evaluation/v3-3/structure-boundary-comparison.json',raterAgreementCases:report.raterAgreementCases,structureMisses:report.structureMisses,failedRepeatsByBlindSupportCount:byBlindSupport},null,2));
