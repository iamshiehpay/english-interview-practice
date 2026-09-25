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
const packet = await read('pilot-blind-packet.json');
const [a, b, erratum] = await Promise.all([read('label-draft-a.json'), read('label-draft-b.json'), read('draft-metadata-erratum.json')]);
assert.deepEqual(erratum, {
  schemaVersion: 1,
  affectedDraft: 'label-draft-b.json',
  draftChecksum: hash(b),
  reportedPacketChecksum: b.packetChecksum,
  actualPacketChecksum: hash(packet),
  cause: 'The parent task prompt supplied a truncated packet checksum to rater B. The saved draft is retained verbatim; no rating or quote has been edited.',
  verification: 'Require all eight case IDs, individual input checksums, order and exact transcript quotes to match the frozen packet before adjudication.'
});
assert.notEqual(erratum.reportedPacketChecksum, erratum.actualPacketChecksum);
for (const [name, draft] of [['a', a], ['b', b]]) {
  keys(draft, ['schemaVersion', 'contractVersion', 'role', 'packetChecksum', 'draftedAt', 'blindToModelFeedback', 'labels']);
  assert.equal(draft.schemaVersion, 1);
  assert.equal(draft.contractVersion, '3.6.0');
  assert.equal(draft.packetChecksum, name === 'b' ? erratum.reportedPacketChecksum : hash(packet));
  assert.equal(draft.blindToModelFeedback, true);
  assert.ok(draft.role.includes(`draft ${name.toUpperCase()}`));
  assert.ok(Number.isFinite(Date.parse(draft.draftedAt)));
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
console.log(JSON.stringify({cases: packet.length,dimensions: packet.length * dimensions.length,agreement: packet.length * dimensions.length - disagreements.length,disagreements,draftChecksums: {a: hash(a), b: hash(b)}}, null, 2));
