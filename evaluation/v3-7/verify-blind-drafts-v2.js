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
const packet = await read('pilot-blind-packet-v2.json');
assert.equal(hash(packet), '8a6b36a1c469700ce36f88789ddf96cb5d197abbac5cf7d508345d54c4da448f', 'Blind packet changed');
const [a, b] = await Promise.all([read('label-draft-a-v2.json'), read('label-draft-b-v2.json')]);
for (const [name, draft] of [['a', a], ['b', b]]) {
  keys(draft, ['schemaVersion', 'contractVersion', 'packetVersion', 'role', 'packetChecksum', 'draftedAt', 'blindToModelFeedback', 'labels']);
  assert.equal(draft.schemaVersion, 1);
  assert.equal(draft.contractVersion, '3.7.0');
  assert.equal(draft.packetVersion, 2);
  assert.equal(draft.role, `Independent AI Role persona draft ${name.toUpperCase()}`);
  assert.equal(draft.packetChecksum, hash(packet));
  assert.ok(Number.isFinite(Date.parse(draft.draftedAt)));
  assert.equal(draft.blindToModelFeedback, true);
  assert.equal(draft.labels.length, packet.length);
  for (const [index, label] of draft.labels.entries()) {
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
}
const disagreements = packet.flatMap((item, index) => dimensions.filter(dimension => JSON.stringify(a.labels[index].ranges[dimension]) !== JSON.stringify(b.labels[index].ranges[dimension])).map(dimension => ({caseId: item.caseId, dimension, a: a.labels[index].ranges[dimension], b: b.labels[index].ranges[dimension]})));
console.log(JSON.stringify({packetChecksum: hash(packet), cases: packet.length, dimensions: packet.length * dimensions.length, agreement: packet.length * dimensions.length - disagreements.length, disagreements, draftChecksums: {a: hash(a), b: hash(b)}}, null, 2));
