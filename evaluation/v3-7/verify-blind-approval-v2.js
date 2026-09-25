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
const [packet, a, b, approval] = await Promise.all([
  read('pilot-blind-packet-v2.json'), read('label-draft-a-v2.json'), read('label-draft-b-v2.json'), read('pilot-label-approval-v2.json')
]);
assert.equal(hash(packet), '8a6b36a1c469700ce36f88789ddf96cb5d197abbac5cf7d508345d54c4da448f');
assert.equal(hash(a), '98c1655b9a7dfa2186e4a73f414cd76777fae392f3129e34e404afacacf753c5');
assert.equal(hash(b), 'd47e598eeedc9db7436cbbe1760739a21c1b0eb74997daefcac12bd2e3304558');
keys(approval, ['schemaVersion', 'contractVersion', 'packetVersion', 'packetChecksum', 'draftChecksums', 'approvedBy', 'approvedAt', 'blindToModelFeedback', 'approvalRationale', 'labels']);
assert.equal(approval.schemaVersion, 1);
assert.equal(approval.contractVersion, '3.7.0');
assert.equal(approval.packetVersion, 2);
assert.equal(approval.packetChecksum, hash(packet));
assert.deepEqual(approval.draftChecksums, {a: hash(a), b: hash(b)});
assert.equal(approval.approvedBy, 'Independent AI blind Role-persona adjudicator');
assert.ok(Number.isFinite(Date.parse(approval.approvedAt)));
assert.equal(approval.blindToModelFeedback, true);
assert.ok(typeof approval.approvalRationale === 'string' && approval.approvalRationale.trim());
assert.equal(approval.labels.length, packet.length);
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
  }
  assert.ok(typeof label.rationale === 'string' && label.rationale.trim());
  assert.ok(Array.isArray(label.evidenceQuotes) && label.evidenceQuotes.length > 0 && label.evidenceQuotes.every(quote => typeof quote === 'string' && quote.length > 0 && item.transcript.includes(quote)));
  keys(label.structureEvidence, ['spanQuotes', 'advancement', 'boundaryUncertainty']);
  assert.ok(Array.isArray(label.structureEvidence.spanQuotes) && label.structureEvidence.spanQuotes.length > 0 && label.structureEvidence.spanQuotes.every(quote => typeof quote === 'string' && quote.length > 0 && item.transcript.includes(quote)));
  assert.ok(typeof label.structureEvidence.advancement === 'string' && label.structureEvidence.advancement.trim());
  assert.ok(typeof label.structureEvidence.boundaryUncertainty === 'string' && label.structureEvidence.boundaryUncertainty.trim());
  assert.deepEqual(label.requiredFindings, []);
  assert.deepEqual(label.forbiddenFindings, []);
}
console.log(JSON.stringify({approvedCases: approval.labels.length, dimensions: approval.labels.length * dimensions.length, approvalChecksum: hash(approval), c01Support: approval.labels[0].ranges.support}));
