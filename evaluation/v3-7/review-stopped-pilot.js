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
const verify = process.argv.includes('--verify');
if (!process.argv.includes('--review') && !verify) {
  console.log(JSON.stringify({mode: 'describe', modelRequests: 0, purpose: 'Verify and preserve a stopped pilot without retrying or changing outputs'}));
  process.exit(0);
}
const [freeze, state, packet, approval] = await Promise.all(['pilot-freeze.json', 'pilot-results.json', 'pilot-blind-packet-v2.json', 'pilot-label-approval-v2.json'].map(read));
assert.equal(freeze.contractVersion, CANDIDATE_CONTRACT_VERSION);
assert.equal(freeze.packetVersion, 2);
assert.equal(freeze.requestCap, 16);
assert.equal(freeze.packetChecksum, hash(packet));
assert.equal(freeze.approvalChecksum, hash(approval));
assert.equal(state.freezeChecksum, hash(freeze));
for (const [name, checksum] of Object.entries(freeze.sourceChecksums)) assert.equal(hash(await readFile(at(name), 'utf8')), checksum, `Pilot source changed: ${name}`);
const attempts = await readAttemptLedger(at('pilot-attempts.json'), {identity: freeze});
assert.ok(attempts.length > 0 && attempts.length <= 16 && attempts.every(kind => kind === 'feedback'));
const expectedOrder = packet.flatMap(item => [1, 2].map(repeat => `${item.caseId}:${repeat}`));
const keys = Object.keys(state.slots);
assert.deepEqual(keys, expectedOrder.slice(0, attempts.length));
const dimensions = ['relevance', 'support', 'structure', 'englishExpression'];
const entries = [];
for (const key of keys) {
  const slot = state.slots[key];
  const [caseId, repeatText] = key.split(':');
  const repeat = Number(repeatText);
  const item = packet.find(row => row.caseId === caseId);
  const label = approval.labels.find(row => row.caseId === caseId);
  assert.ok(item && label && label.inputChecksum === item.inputChecksum);
  assert.equal(slot.caseId, caseId);
  assert.equal(slot.repeat, repeat);
  if (slot.status === 'completed') {
    assert.equal(slot.inputChecksum, item.inputChecksum);
    const feedback = validateCandidateFeedback(slot.rawOutput, {...item.question, requestedParts: item.requestedParts}, item.transcript);
    assert.deepEqual(slot.feedback, feedback);
    assert.equal(slot.outputChecksum, hash({contractVersion: CANDIDATE_CONTRACT_VERSION, caseId, repeat, question: item.question, feedback}));
    const ratingMisses = dimensions.filter(dimension => feedback.ratings[dimension].level < label.ranges[dimension][0] || feedback.ratings[dimension].level > label.ranges[dimension][1]);
    entries.push({caseId, repeat, status: 'completed', inputChecksum: slot.inputChecksum, outputChecksum: slot.outputChecksum, ratingMisses});
  } else {
    assert.ok(['failed', 'reserved'].includes(slot.status));
    if (slot.status === 'failed') assert.ok(slot.error?.trim());
    if (slot.rawOutput && slot.error?.startsWith('Invalid candidate')) {
      assert.throws(() => validateCandidateFeedback(slot.rawOutput, {...item.question, requestedParts: item.requestedParts}, item.transcript), error => error.message === slot.error);
    }
    entries.push({caseId, repeat, status: slot.status === 'reserved' ? 'interrupted' : 'failed', ...(slot.rawOutput ? {rawOutputChecksum: hash(slot.rawOutput)} : {}), ...(slot.error ? {error: slot.error} : {})});
  }
}
assert.ok(entries.some(entry => entry.status !== 'completed'), 'This report is only for a stopped run');
const completed = entries.filter(entry => entry.status === 'completed');
const failed = entries.filter(entry => entry.status === 'failed');
const interrupted = entries.filter(entry => entry.status === 'interrupted');
const ratingMatches = completed.filter(entry => entry.ratingMisses.length === 0).length;
const report = {schemaVersion: 1, contractVersion: CANDIDATE_CONTRACT_VERSION, generatedAt: new Date().toISOString(), artifactChecksums: {freeze: hash(freeze), state: hash(state), packet: hash(packet), approval: hash(approval)}, usage: {subscriptionFeedbackRequests: attempts.length, approvedRequestCap: 16, completedOutputs: completed.length, failedSlots: failed.length, interruptedSlots: interrupted.length, unusedAuthorizedSlots: 16 - attempts.length}, entries, automaticGate: {pass: false, reason: 'Fewer than sixteen valid outputs; a failed or interrupted slot stopped the pilot without retry'}, ratingGate: {pass: false, validOutputMatches: ratingMatches, validOutputs: completed.length, completeSetRequired: 16}, bilingualSemanticGate: {status: 'NOT_REVIEWED', reason: 'The predeclared sixteen-output gate already failed; the reserved post-run AI review task was not used'}, evidenceSemanticGate: {status: 'NOT_REVIEWED'}, pilotStatus: 'NO_GO', releaseStatus: 'BLOCKED', note: 'Partial fixed-input diagnostic only. Saved raw output and feedback remain unmodified; historical 3.3 outputs, labels and release gates remain unchanged.'};
if (verify) {
  const saved = await read('pilot-stopped-reviewed.json');
  assert.ok(saved.generatedAt);
  report.generatedAt = saved.generatedAt;
  assert.deepEqual(saved, report, 'Stopped-pilot report differs from frozen source or saved outputs');
} else {
  await writeFile(at('pilot-stopped-reviewed.json'), JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
}
console.log(JSON.stringify({verified: verify, pilotStatus: report.pilotStatus, requests: attempts.length, completed: completed.length, failed: failed.length, interrupted: interrupted.length, validOutputRatingMatches: ratingMatches}));
