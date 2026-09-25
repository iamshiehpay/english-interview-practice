import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateFeedback} from '../../src/domain.js';
import {readAttemptLedger} from '../checkpoints.js';

const root=dirname(fileURLToPath(import.meta.url));
const at=name=>join(root,name);
const read=async name=>JSON.parse(await readFile(at(name),'utf8'));
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const dims=['relevance','support','structure','englishExpression'];
const [packet,approval,freeze,state]=await Promise.all(['pilot-blind-packet.json','pilot-label-approval.json','pilot-freeze.json','pilot-results.json'].map(read));
assert.equal(freeze.contractVersion,'3.4.0');
assert.equal(freeze.packetChecksum,sha(packet));
assert.equal(freeze.approvalChecksum,sha(approval));
assert.equal(state.freezeChecksum,sha(freeze));
const attempts=await readAttemptLedger(at('pilot-attempts.json'),{identity:freeze});
assert.equal(attempts.length,16,'Pilot must have exactly sixteen durable attempts');
assert.ok(attempts.every(kind=>kind==='feedback'));
const items=[];
for(const row of packet){
  const label=approval.labels.find(item=>item.caseId===row.caseId);
  assert.ok(label&&label.inputChecksum===row.inputChecksum);
  for(const repeat of [1,2]){
    const saved=state.slots[`${row.caseId}:${repeat}`];
    assert.equal(saved?.status,'completed',`${row.caseId}:${repeat} was not completed`);
    assert.equal(saved.inputChecksum,row.inputChecksum);
    assert.deepEqual(validateFeedback(saved.feedback,row.transcript),saved.feedback);
    assert.equal(saved.outputChecksum,sha({contractVersion:'3.4.0',caseId:row.caseId,repeat,question:row.question,feedback:saved.feedback}));
    assert.equal(saved.automaticBilingualPairs.length,6);
    const misses=dims.filter(d=>{const [low,high]=label.ranges[d],level=saved.feedback.ratings[d].level;return level<low||level>high;});
    items.push({caseId:row.caseId,repeat,inputChecksum:row.inputChecksum,outputChecksum:saved.outputChecksum,question:row.question,transcript:row.transcript,approvedRanges:label.ranges,feedback:saved.feedback,automaticBilingualPairs:saved.automaticBilingualPairs,ratingMisses:misses});
  }
}
assert.equal(items.length,16);
assert.equal(Object.keys(state.slots).length,16);
const dimensionMisses=Object.fromEntries(dims.map(d=>[d,items.filter(item=>item.ratingMisses.includes(d)).length]));
const outputLevelPass=items.filter(item=>item.ratingMisses.length===0).length;
const reviewPacket={schemaVersion:1,contractVersion:'3.4.0',freezeChecksum:sha(freeze),approvalChecksum:sha(approval),resultsChecksum:sha(state),attempts:attempts.length,automaticPass:true,outputLevelPass,dimensionMisses,items};
await writeFile(at('pilot-review-packet.json'),JSON.stringify(reviewPacket,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({packet:'evaluation/v3-4/pilot-review-packet.json',outputs:items.length,outputLevelPass,dimensionMisses,reviewPacketChecksum:sha(reviewPacket)},null,2));
