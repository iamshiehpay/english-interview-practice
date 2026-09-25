import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readAttemptLedger} from '../checkpoints.js';
import {CANDIDATE_CONTRACT_VERSION, validateCandidateFeedback} from './evidence-first-candidate.js';
import {assertFrozenReviewItems} from './review-source.js';

const root = dirname(fileURLToPath(import.meta.url));
const at = name => join(root, name);
const read = async name => JSON.parse(await readFile(at(name), 'utf8'));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const keys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
if (!process.argv.includes('--review')) {
  console.log(JSON.stringify({mode: 'describe', expectedOutputs: 16, requiredGates: ['automatic 16/16', 'all-four-dimension rating matches 16/16', 'independent bilingual semantics 16/16', 'independent decision-evidence faithfulness 16/16'], releaseStatus: 'BLOCKED until separate official evaluation'}));
  process.exit(0);
}
const [freeze, state, packet, approval, semantic, blindPacket] = await Promise.all(['pilot-freeze.json', 'pilot-results.json', 'pilot-review-packet.json', 'pilot-label-approval-v2.json', 'pilot-semantic-review.json', 'pilot-blind-packet-v2.json'].map(read));
assert.equal(freeze.contractVersion, CANDIDATE_CONTRACT_VERSION);
assert.equal(freeze.packetVersion, 2);
assert.equal(freeze.requestCap, 16);
assert.equal(packet.contractVersion, CANDIDATE_CONTRACT_VERSION);
assert.equal(packet.freezeChecksum, hash(freeze));
assert.equal(packet.approvalChecksum, hash(approval));
assert.equal(state.freezeChecksum, hash(freeze));
assert.equal(freeze.packetChecksum, hash(blindPacket));
assertFrozenReviewItems(packet.items, blindPacket);
for (const [name, checksum] of Object.entries(freeze.sourceChecksums)) assert.equal(createHash('sha256').update(await readFile(at(name), 'utf8')).digest('hex'), checksum, `Pilot source changed: ${name}`);
keys(semantic, ['schemaVersion', 'contractVersion', 'packetChecksum', 'reviewerType', 'reviewer', 'reviewedAt', 'reviews']);
assert.equal(semantic.schemaVersion, 1);
assert.equal(semantic.contractVersion, CANDIDATE_CONTRACT_VERSION);
assert.equal(semantic.packetChecksum, hash(packet));
assert.equal(semantic.reviewerType, 'ai');
assert.ok(semantic.reviewer?.trim() && Number.isFinite(Date.parse(semantic.reviewedAt)));
assert.equal(packet.items.length, 16);
assert.equal(semantic.reviews.length, 16);
const attempts = await readAttemptLedger(at('pilot-attempts.json'), {identity: freeze});
assert.equal(attempts.length, 16);
assert.ok(attempts.every(kind => kind === 'feedback'));
const seen = new Set();
const bilingualFailures = [], evidenceFailures = [];
const dimensions = ['relevance', 'support', 'structure', 'englishExpression'];
const pairsFor = feedback => [
  ...dimensions.map(name => ({name: `${name} reason`, en: feedback.ratings[name].reason, zh: feedback.ratings[name].reasonZh})),
  {name: 'strength', en: feedback.strength.text, zh: feedback.strength.textZh},
  {name: 'priority improvement', en: feedback.priorityImprovement.text, zh: feedback.priorityImprovement.textZh}
];
for (const item of packet.items) {
  const key = `${item.caseId}:${item.repeat}`;
  assert.ok(!seen.has(key));
  seen.add(key);
  const saved = state.slots[key];
  assert.equal(saved?.status, 'completed');
  assert.ok(Date.parse(semantic.reviewedAt) >= Date.parse(saved.completedAt));
  const validated = validateCandidateFeedback(saved.rawOutput, {...item.question, requestedParts: item.requestedParts}, item.transcript);
  assert.deepEqual(saved.feedback, validated);
  assert.deepEqual(item.feedback, validated);
  assert.deepEqual(item.bilingualPairs, pairsFor(validated));
  assert.deepEqual(saved.automaticBilingualPairs, item.bilingualPairs);
  assert.ok(item.bilingualPairs.every(({en, zh}) => typeof en === 'string' && /\p{Script=Latin}/u.test(en) && typeof zh === 'string' && /\p{Script=Han}/u.test(zh) && en.normalize('NFKC').trim() !== zh.normalize('NFKC').trim()));
  const label = approval.labels.find(row => row.caseId === item.caseId);
  assert.ok(label && label.inputChecksum === item.inputChecksum);
  assert.deepEqual(item.approvedRanges, label.ranges);
  assert.deepEqual(item.ratingMisses, dimensions.filter(dimension => validated.ratings[dimension].level < label.ranges[dimension][0] || validated.ratings[dimension].level > label.ranges[dimension][1]));
  assert.equal(item.outputChecksum, hash({contractVersion: CANDIDATE_CONTRACT_VERSION, caseId: item.caseId, repeat: item.repeat, question: item.question, feedback: validated}));
  assert.equal(saved.outputChecksum, item.outputChecksum);
  const matches = semantic.reviews.filter(review => review.caseId === item.caseId && review.repeat === item.repeat);
  assert.equal(matches.length, 1);
  const review = matches[0];
  keys(review, ['caseId', 'repeat', 'outputChecksum', 'bilingualVerdict', 'contradictoryPairs', 'evidenceVerdict', 'evidenceIssues', 'rationale']);
  assert.equal(review.outputChecksum, item.outputChecksum);
  assert.ok(review.rationale?.trim());
  assert.ok(['consistent', 'inconsistent'].includes(review.bilingualVerdict));
  assert.ok(['faithful', 'unfaithful'].includes(review.evidenceVerdict));
  assert.ok(Array.isArray(review.contradictoryPairs) && review.contradictoryPairs.every(name => item.bilingualPairs.some(pair => pair.name === name)));
  assert.ok(Array.isArray(review.evidenceIssues) && review.evidenceIssues.every(issue => typeof issue === 'string' && issue.trim()));
  if (review.bilingualVerdict === 'consistent') assert.equal(review.contradictoryPairs.length, 0); else { assert.ok(review.contradictoryPairs.length > 0); bilingualFailures.push(key); }
  if (review.evidenceVerdict === 'faithful') assert.equal(review.evidenceIssues.length, 0); else { assert.ok(review.evidenceIssues.length > 0); evidenceFailures.push(key); }
}
assert.equal(seen.size, 16);
const ratingFailures = packet.items.filter(item => item.ratingMisses.length > 0).map(item => `${item.caseId}:${item.repeat}`);
assert.equal(packet.outputLevelPass, 16 - ratingFailures.length);
const pass = ratingFailures.length === 0 && bilingualFailures.length === 0 && evidenceFailures.length === 0;
const report = {schemaVersion: 1, contractVersion: CANDIDATE_CONTRACT_VERSION, generatedAt: new Date().toISOString(), usage: {subscriptionFeedbackRequests: attempts.length, subscriptionRequestCap: 16, independentSemanticReviewTasks: 1}, artifactChecksums: {freeze: hash(freeze), reviewPacket: hash(packet), approvedLabels: hash(approval), semanticReview: hash(semantic)}, automaticGate: {pass: true, outputs: 16}, ratingGate: {pass: ratingFailures.length === 0, outputLevelPass: packet.outputLevelPass, total: 16, dimensionMisses: packet.dimensionMisses, failures: ratingFailures}, bilingualGate: {pass: bilingualFailures.length === 0, consistentOutputs: 16 - bilingualFailures.length, total: 16, failures: bilingualFailures}, evidenceGate: {pass: evidenceFailures.length === 0, faithfulOutputs: 16 - evidenceFailures.length, total: 16, failures: evidenceFailures}, pilotStatus: pass ? 'GO_FOR_SEPARATE_FULL_EVALUATION_APPROVAL' : 'NO_GO', releaseStatus: 'BLOCKED', note: 'Development-set pilot only. The historical 3.3 outputs, labels and release decision are unchanged; full v1.0.0 approval needs a separate fresh official evaluation.'};
await writeFile(at('pilot-reviewed.json'), JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({pilotStatus: report.pilotStatus, ratingGate: report.ratingGate.pass, bilingualGate: report.bilingualGate.pass, evidenceGate: report.evidenceGate.pass, subscriptionRequests: attempts.length}));
