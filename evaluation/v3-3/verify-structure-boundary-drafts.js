import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=dirname(fileURLToPath(import.meta.url));
const read=async name=>JSON.parse(await readFile(join(root,name),'utf8'));
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const packet=await read('structure-boundary-blind-packet.json');
const drafts=await Promise.all(['a','b'].map(letter=>read(`structure-boundary-rater-${letter}.json`)));
assert.equal(packet.schemaVersion,1);
assert.equal(packet.cases.length,20);
assert.equal(new Set(packet.cases.map(item=>item.caseId)).size,20);
assert.notEqual(drafts[0].rater,drafts[1].rater,'Independent drafts must name different raters');
for(const [index,draft] of drafts.entries()){
  assert.equal(draft.schemaVersion,1);
  assert.equal(draft.packetChecksum,sha(packet),'Draft is not bound to the frozen blind packet');
  assert.equal(draft.blindToPriorScores,true,'Draft does not attest blindness');
  assert.ok(draft.rater?.trim()&&Number.isFinite(Date.parse(draft.ratedAt)));
  assert.equal(draft.cases.length,20);
  for(const [caseIndex,decision] of draft.cases.entries()){
    const source=packet.cases[caseIndex];
    assert.equal(decision.caseId,source.caseId);
    assert.equal(decision.inputChecksum,source.inputChecksum);
    assert.ok(Number.isInteger(decision.level)&&decision.level>=1&&decision.level<=4);
    assert.ok(typeof decision.quote==='string'&&decision.quote&&source.transcript.includes(decision.quote),'Structure evidence must quote transcript exactly');
    assert.ok(decision.organizationalLink?.trim()&&decision.rationale?.trim());
    assert.equal(decision.missingContentExcluded,true);
  }
  console.log(`rater ${index===0?'A':'B'}: 20/20 valid; canonical SHA-256 ${sha(draft)}`);
}
const disagreements=packet.cases.flatMap((item,index)=>drafts[0].cases[index].level===drafts[1].cases[index].level?[]:[{caseId:item.caseId,a:drafts[0].cases[index].level,b:drafts[1].cases[index].level}]);
console.log(JSON.stringify({packetChecksum:sha(packet),agreements:20-disagreements.length,disagreements},null,2));
