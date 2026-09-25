import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {open, readFile, unlink, writeFile} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CodexLanguageModel} from '../../src/codex-language.js';
import {requireAudit} from '../../src/codex-audit.js';
import {verifiedBinary} from '../../src/codex-sandbox.js';
import {readAttemptLedger, reserveModelAttempt, writeAttemptLedger, writeJsonAtomic} from '../checkpoints.js';
import {candidateFeedbackContract, candidateFeedbackSchema, CANDIDATE_CONTRACT_VERSION, validateCandidateFeedback} from './evidence-first-candidate.js';

const root = dirname(fileURLToPath(import.meta.url));
const at = name => join(root, name);
const read = async name => JSON.parse(await readFile(at(name), 'utf8'));
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const [packet, approval, draftA, draftB] = await Promise.all([
  'pilot-blind-packet-v2.json', 'pilot-label-approval-v2.json',
  'label-draft-a-v2.json', 'label-draft-b-v2.json'
].map(read));
await Promise.all(['build-blind-packet-v2.js', 'verify-blind-drafts-v2.js', 'verify-blind-approval-v2.js'].map(script => promisify(execFile)(process.execPath, [at(script)], {timeout: 10000, maxBuffer: 20000})));
assert.equal(packet.length, 8);
for (const [index, item] of packet.entries()) {
  assert.equal(item.caseId, `c${String(index + 1).padStart(2, '0')}`);
  assert.equal(item.question.id, item.caseId);
  assert.equal(item.packetVersion, 2);
  assert.equal(item.contractVersion, CANDIDATE_CONTRACT_VERSION);
  assert.ok(Array.isArray(item.requestedParts) && item.requestedParts.length > 0 && item.requestedParts.every(part => item.question.text.includes(part)));
  assert.equal(item.inputChecksum, hash({packetVersion: 2, contractVersion: CANDIDATE_CONTRACT_VERSION, question: item.question, transcript: item.transcript, requestedParts: item.requestedParts}));
}
assert.equal(approval.schemaVersion, 1);
assert.equal(approval.contractVersion, CANDIDATE_CONTRACT_VERSION);
assert.equal(approval.packetVersion, 2);
assert.equal(approval.packetChecksum, hash(packet));
assert.deepEqual(approval.draftChecksums, {a: hash(draftA), b: hash(draftB)});
assert.equal(approval.blindToModelFeedback, true);
assert.ok(Number.isFinite(Date.parse(approval.approvedAt)) && approval.approvedBy?.trim());
assert.equal(approval.labels.length, packet.length);
for (const [index, label] of approval.labels.entries()) {
  assert.equal(label.caseId, packet[index].caseId);
  assert.equal(label.inputChecksum, packet[index].inputChecksum);
  assert.deepEqual(Object.keys(label.ranges).sort(), ['englishExpression', 'relevance', 'structure', 'support']);
  for (const range of Object.values(label.ranges)) assert.ok(Array.isArray(range) && range.length === 2 && range.every(level => Number.isInteger(level) && level >= 1 && level <= 4) && range[0] <= range[1] && range[1] - range[0] <= 1);
}
const slots = packet.flatMap(item => [1, 2].map(repeat => ({caseId: item.caseId, repeat})));
assert.equal(slots.length, 16);
const execute = process.argv.includes('--execute');
const preflight = process.argv.includes('--preflight');
assert.ok(!(execute && preflight), 'Choose execute or preflight');
if (!execute && !preflight) {
  console.log(JSON.stringify({mode: 'dry-run', contractVersion: CANDIDATE_CONTRACT_VERSION, packetVersion: 2, cases: packet.length, feedbackRequestCap: slots.length, independentSemanticReviewRequired: true, packetChecksum: hash(packet), approvalChecksum: hash(approval), promptChecksum: hash(candidateFeedbackContract), requires: 'separate user approval for subscription feedback; --execute --accept-subscription-usage'}, null, 2));
  process.exit(0);
}
if (execute) assert.ok(process.argv.includes('--accept-subscription-usage'), 'Explicit subscription usage flag required');
const binary = await verifiedBinary(process.env.COACH_CODEX_BIN || 'codex');
const model = new CodexLanguageModel({profile: process.env.COACH_CODEX_HOME, binary, model: 'gpt-5.6-luna', effort: 'xhigh', serviceTier: 'priority'});
const {stdout} = await promisify(execFile)(binary, ['--version'], {timeout: 5000, maxBuffer: 10000});
const sourceFiles = [
  'pilot-run.js', 'evidence-first-candidate.js', 'pilot-inputs.json', 'pilot-blind-packet.json',
  'pilot-question-parts.json', 'build-blind-packet-v2.js', 'pilot-blind-packet-v2.json',
  'pilot-blind-rater-guide-v2.md', 'label-draft-a-v2.json', 'label-draft-b-v2.json',
  'pilot-label-approval-v2.json', 'verify-blind-drafts-v2.js', 'verify-blind-approval-v2.js', 'build-pilot-review-packet.js',
  'review-pilot.js', 'review-stopped-pilot.js', 'review-source.js', 'pilot-semantic-review-guide.md', '../checkpoints.js',
  '../../src/model-contracts.js', '../../src/codex-language.js', '../../src/model-schemas.js',
  '../../src/domain.js', '../../src/codex-rpc.js', '../../src/codex-profile.js',
  '../../src/codex-audit.js', '../../src/codex-sandbox.js', '../../src/codex-runtime.js'
];
const sourceChecksums = Object.fromEntries(await Promise.all(sourceFiles.map(async name => [name, hash(await readFile(at(name), 'utf8'))])));
const freeze = {schemaVersion: 1, contractVersion: CANDIDATE_CONTRACT_VERSION, packetVersion: 2, requestCap: 16, packetChecksum: hash(packet), approvalChecksum: hash(approval), promptChecksum: hash(candidateFeedbackContract), sourceChecksums, model: model.model, effort: model.effort, serviceTier: model.serviceTier, cliVersion: stdout.trim(), binaryChecksum: createHash('sha256').update(await readFile(binary)).digest('hex')};
if (preflight) {
  await requireAudit(model.profile, model.model);
  console.log(JSON.stringify({mode: 'preflight', freeze, feedbackRequestCap: 16}, null, 2));
  process.exit(0);
}
await requireAudit(model.profile, model.model);
const freezePath = at('pilot-freeze.json'), statePath = at('pilot-results.json'), ledgerPath = at('pilot-attempts.json'), lockPath = at('pilot-run.lock');
let lock;
try { lock = await open(lockPath, 'wx', 0o600); } catch (error) { if (error.code === 'EEXIST') throw Error('Pilot lock exists; inspect before resuming'); throw error; }
try {
  let savedFreeze, state;
  try {
    savedFreeze = await read('pilot-freeze.json');
    assert.deepEqual(savedFreeze, freeze, 'Pilot source or configuration changed after freeze');
    state = await read('pilot-results.json');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeFile(freezePath, JSON.stringify(freeze, null, 2) + '\n', {flag: 'wx'});
    state = {schemaVersion: 1, freezeChecksum: hash(freeze), slots: {}};
    await writeJsonAtomic(statePath, state);
    await writeAttemptLedger(ledgerPath, {identity: freeze, attempts: []});
  }
  assert.equal(state.schemaVersion, 1);
  assert.equal(state.freezeChecksum, hash(freeze));
  assert.ok(state.slots && typeof state.slots === 'object' && !Array.isArray(state.slots));
  const recorded = await readAttemptLedger(ledgerPath, {identity: freeze});
  assert.ok(recorded.length <= 16 && recorded.every(kind => kind === 'feedback'));
  assert.equal(Object.keys(state.slots).length, recorded.length, 'State/attempt count differs; inspect manually');
  const pairList = feedback => [
    ...['relevance', 'support', 'structure', 'englishExpression'].map(name => [`${name} reason`, feedback.ratings[name].reason, feedback.ratings[name].reasonZh]),
    ['strength', feedback.strength.text, feedback.strength.textZh],
    ['priority improvement', feedback.priorityImprovement.text, feedback.priorityImprovement.textZh]
  ];
  const automaticPairs = feedback => pairList(feedback).map(([name, en, zh]) => ({name, en, zh}));
  const bilingualPass = pairs => pairs.length === 6 && pairs.every(({en, zh}) => typeof en === 'string' && /\p{Script=Latin}/u.test(en) && typeof zh === 'string' && /\p{Script=Han}/u.test(zh) && en.normalize('NFKC').trim() !== zh.normalize('NFKC').trim());
  const allowedKeys = new Set(slots.map(({caseId, repeat}) => `${caseId}:${repeat}`));
  for (const [key, saved] of Object.entries(state.slots)) {
    assert.ok(allowedKeys.has(key));
    assert.equal(saved.status, 'completed', 'Failed or interrupted pilot slot must not be retried');
    const item = packet.find(row => row.caseId === saved.caseId);
    assert.ok(item && key === `${saved.caseId}:${saved.repeat}`);
    assert.equal(saved.inputChecksum, item.inputChecksum);
    assert.deepEqual(saved.feedback, validateCandidateFeedback(saved.rawOutput, {...item.question, requestedParts: item.requestedParts}, item.transcript));
    assert.equal(saved.outputChecksum, hash({contractVersion: CANDIDATE_CONTRACT_VERSION, caseId: saved.caseId, repeat: saved.repeat, question: item.question, feedback: saved.feedback}));
    assert.deepEqual(saved.automaticBilingualPairs, automaticPairs(saved.feedback));
    assert.ok(bilingualPass(saved.automaticBilingualPairs));
  }
  const attempts = [];
  for (const slot of slots) {
    const key = `${slot.caseId}:${slot.repeat}`;
    if (state.slots[key]) continue;
    state.slots[key] = {status: 'reserved', reservedAt: new Date().toISOString()};
    await writeJsonAtomic(statePath, state);
    await reserveModelAttempt(ledgerPath, {identity: freeze, attempts, kind: 'feedback', limit: 16});
    const item = packet.find(row => row.caseId === slot.caseId);
    let rawOutput;
    try {
      const question = {...item.question, requestedParts: item.requestedParts};
      rawOutput = await model.json(candidateFeedbackContract, {question, transcript: item.transcript, approvedEvidence: []}, candidateFeedbackSchema);
      const feedback = validateCandidateFeedback(rawOutput, question, item.transcript);
      const pairs = automaticPairs(feedback);
      assert.ok(bilingualPass(pairs), 'Automatic bilingual check failed');
      state.slots[key] = {status: 'completed', reservedAt: state.slots[key].reservedAt, completedAt: new Date().toISOString(), caseId: item.caseId, repeat: slot.repeat, inputChecksum: item.inputChecksum, outputChecksum: hash({contractVersion: CANDIDATE_CONTRACT_VERSION, caseId: item.caseId, repeat: slot.repeat, question: item.question, feedback}), rawOutput, feedback, automaticBilingualPairs: pairs};
      await writeJsonAtomic(statePath, state);
      console.log(`${key}: saved`);
    } catch (error) {
      state.slots[key] = {status: 'failed', reservedAt: state.slots[key].reservedAt, failedAt: new Date().toISOString(), caseId: item.caseId, repeat: slot.repeat, error: error.message, ...(rawOutput ? {rawOutput} : {})};
      await writeJsonAtomic(statePath, state);
      throw Error(`${key}: ${error.message}; no retry attempted`);
    }
  }
  console.log(JSON.stringify({saved: Object.values(state.slots).filter(slot => slot.status === 'completed').length, requestCap: 16, attempts: (await readAttemptLedger(ledgerPath, {identity: freeze})).length, output: statePath}, null, 2));
} finally {
  await lock.close();
  await unlink(lockPath);
}
