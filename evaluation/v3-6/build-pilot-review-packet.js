import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readAttemptLedger} from '../checkpoints.js';
import {CANDIDATE_CONTRACT_VERSION, validateCandidateFeedback} from './evidence-first-candidate.js';

const root = dirname(fileURLToPath(import.meta.url));
const at = name => join(root, name);
const read = async name => JSON.parse(await readFile(at(name), 'utf8'));
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const dimensions = ['relevance', 'support', 'structure', 'englishExpression'];
if (!process.argv.includes('--build')) {
  console.log(JSON.stringify({mode: 'describe', contractVersion: CANDIDATE_CONTRACT_VERSION, expectedOutputs: 16, gates: ['16 valid evidence-first outputs', 'all 16 match the frozen four-dimensional label ranges', 'independent bilingual and evidence-faithfulness review of all 16 outputs'], modelRequests: 0}));
  process.exit(0);
}
const [freeze, state, packet, parts, approval] = await Promise.all(['pilot-freeze.json', 'pilot-results.json', 'pilot-blind-packet.json', 'pilot-question-parts.json', 'pilot-label-approval.json'].map(read));
assert.equal(freeze.contractVersion, CANDIDATE_CONTRACT_VERSION);
assert.equal(freeze.requestCap, 16);
assert.equal(freeze.packetChecksum, hash(packet));
assert.equal(freeze.requestedPartsChecksum, hash(parts));
assert.equal(freeze.approvalChecksum, hash(approval));
assert.equal(state.freezeChecksum, hash(freeze));
for (const [name, checksum] of Object.entries(freeze.sourceChecksums)) assert.equal(hash(await readFile(at(name), 'utf8')), checksum, `Pilot source changed: ${name}`);
const ledger = await readAttemptLedger(at('pilot-attempts.json'), {identity: freeze});
assert.equal(ledger.length, 16);
assert.ok(ledger.every(kind => kind === 'feedback'));
assert.equal(Object.keys(state.slots).length, 16);
const items = [];
for (const item of packet) for (const repeat of [1, 2]) {
  const saved = state.slots[`${item.caseId}:${repeat}`];
  assert.equal(saved?.status, 'completed');
  assert.equal(saved.caseId, item.caseId);
  assert.equal(saved.repeat, repeat);
  assert.equal(saved.inputChecksum, item.inputChecksum);
  const feedback = validateCandidateFeedback(saved.rawOutput, {...item.question, requestedParts: parts[item.caseId]}, item.transcript);
  assert.deepEqual(saved.feedback, feedback);
  assert.equal(saved.outputChecksum, hash({contractVersion: CANDIDATE_CONTRACT_VERSION, caseId: item.caseId, repeat, question: item.question, feedback}));
  const label = approval.labels.find(row => row.caseId === item.caseId);
  assert.ok(label && label.inputChecksum === item.inputChecksum);
  const ratingMisses = dimensions.filter(dimension => feedback.ratings[dimension].level < label.ranges[dimension][0] || feedback.ratings[dimension].level > label.ranges[dimension][1]);
  assert.equal(saved.automaticBilingualPairs.length, 6);
  items.push({caseId: item.caseId, repeat, inputChecksum: item.inputChecksum, outputChecksum: saved.outputChecksum, question: item.question, transcript: item.transcript, requestedParts: parts[item.caseId], approvedRanges: label.ranges, ratingMisses, feedback, bilingualPairs: saved.automaticBilingualPairs});
}
const reviewPacket = {schemaVersion: 1, contractVersion: CANDIDATE_CONTRACT_VERSION, freezeChecksum: hash(freeze), approvalChecksum: hash(approval), items, outputLevelPass: items.filter(item => item.ratingMisses.length === 0).length, dimensionMisses: Object.fromEntries(dimensions.map(dimension => [dimension, items.filter(item => item.ratingMisses.includes(dimension)).length]))};
await writeFile(at('pilot-review-packet.json'), JSON.stringify(reviewPacket, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({outputs: items.length, outputLevelPass: reviewPacket.outputLevelPass, dimensionMisses: reviewPacket.dimensionMisses, reviewPacketChecksum: hash(reviewPacket)}));
