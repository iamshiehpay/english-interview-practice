import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const read = async name => JSON.parse(await readFile(join(root, name), 'utf8'));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const keys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
const dimensions = ['relevance', 'support', 'structure', 'englishExpression'];
const [packet, a, b, approval] = await Promise.all(['pilot-blind-packet.json', 'label-draft-a.json', 'label-draft-b.json', 'pilot-label-approval.json'].map(read));
keys(approval, ['schemaVersion', 'contractVersion', 'packetChecksum', 'draftChecksums', 'approvedBy', 'approvedAt', 'blindToModelFeedback', 'approvalRationale', 'labels']);
assert.equal(approval.schemaVersion, 1);
assert.equal(approval.contractVersion, '3.6.0');
assert.equal(approval.packetChecksum, hash(packet));
assert.deepEqual(approval.draftChecksums, {a: hash(a), b: hash(b)});
assert.ok(approval.approvedBy?.trim() && approval.approvalRationale?.trim());
assert.equal(approval.blindToModelFeedback, true);
assert.ok(Number.isFinite(Date.parse(approval.approvedAt)));
assert.ok(Date.parse(approval.approvedAt) >= Math.max(Date.parse(a.draftedAt), Date.parse(b.draftedAt)));
assert.equal(approval.labels.length, packet.length);
const departures = [];
for (const [index, label] of approval.labels.entries()) {
  const item = packet[index];
  keys(label, ['caseId', 'inputChecksum', 'ranges', 'rationale', 'evidenceQuotes', 'structureEvidence', 'requiredFindings', 'forbiddenFindings']);
  assert.equal(label.caseId, item.caseId);
  assert.equal(label.inputChecksum, item.inputChecksum);
  keys(label.ranges, dimensions);
  for (const dimension of dimensions) {
    const range = label.ranges[dimension];
    assert.ok(Array.isArray(range) && range.length === 2 && range.every(level => Number.isInteger(level) && level >= 1 && level <= 4));
    assert.ok(range[0] <= range[1] && range[1] - range[0] <= 1);
    if (JSON.stringify(range) !== JSON.stringify(a.labels[index].ranges[dimension]) || JSON.stringify(range) !== JSON.stringify(b.labels[index].ranges[dimension])) departures.push({caseId: item.caseId, dimension});
  }
  assert.ok(typeof label.rationale === 'string' && label.rationale.trim());
  assert.ok(Array.isArray(label.evidenceQuotes) && label.evidenceQuotes.length > 0 && label.evidenceQuotes.every(quote => typeof quote === 'string' && quote.length > 0 && item.transcript.includes(quote)));
  keys(label.structureEvidence, ['spanQuotes', 'advancement', 'boundaryUncertainty']);
  assert.ok(Array.isArray(label.structureEvidence.spanQuotes) && label.structureEvidence.spanQuotes.length > 0 && label.structureEvidence.spanQuotes.every(quote => typeof quote === 'string' && quote.length > 0 && item.transcript.includes(quote)));
  assert.ok(label.structureEvidence.advancement?.trim() && label.structureEvidence.boundaryUncertainty?.trim());
  assert.deepEqual(label.requiredFindings, []);
  assert.deepEqual(label.forbiddenFindings, []);
}
console.log(JSON.stringify({cases: packet.length, approvedDimensions: packet.length * dimensions.length, departures, packetChecksum: hash(packet), approvalChecksum: hash(approval)}));
