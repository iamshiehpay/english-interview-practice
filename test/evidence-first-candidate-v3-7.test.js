import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {CANDIDATE_CONTRACT_VERSION, candidateFeedbackContract, validateCandidateFeedback} from '../evaluation/v3-7/evidence-first-candidate.js';
import {assertFrozenReviewItems} from '../evaluation/v3-7/review-source.js';
import {orderedPilotSlots, ratingMisses} from '../evaluation/v3-7/pilot-policy.js';

const question = {text: 'Why choose this role, and which tool have you used?', requestedParts: ['Why choose this role', 'which tool have you used']};
const transcript = 'I care about dependable systems. I enjoy collaborating with others.';
const rating = (level, quote) => ({level, quote, reason: 'Grounded in the transcript.', reasonZh: '根據逐字稿。'});
const feedback = () => ({
  decisionEvidence: {
    relevance: {coverage: 'core-only', parts: [{questionPartQuote: question.requestedParts[0], answerQuote: 'I care about dependable systems.'}, {questionPartQuote: question.requestedParts[1], answerQuote: ''}], relatedQuote: 'I enjoy collaborating with others.'},
    support: {basis: 'bare-or-adjacent', pointQuote: 'I care about dependable systems.', supportQuote: '', reasoningLink: ''},
    structure: {organization: 'thin', spanQuotes: ['I care about dependable systems.', 'I enjoy collaborating with others.'], linkType: 'related', advancement: ''},
    englishExpression: {impact: 'none', issueQuote: '', issue: ''}
  },
  ratings: {
    relevance: rating(3, 'I care about dependable systems.'),
    support: rating(2, 'I care about dependable systems.'),
    structure: rating(3, 'I enjoy collaborating with others.'),
    englishExpression: rating(4, 'I care about dependable systems.')
  },
  strength: {text: 'Clear motivation.', textZh: '動機清楚。', quote: 'I care about dependable systems.'},
  priorityImprovement: {text: 'Name a tool used.', textZh: '說明使用過的工具。', quote: 'I enjoy collaborating with others.'}
});

test('prospective 3.7 instructions separate a requested skill from interest and generic support', () => {
  assert.equal(CANDIDATE_CONTRACT_VERSION, '3.7.0');
  assert.match(candidateFeedbackContract, /an interest, intention, topic word, or general team attitude does not fill it/);
  assert.match(candidateFeedbackContract, /A generic importance claim, general preference, or causal word/);
});

test('partial coverage can cite adjacent detail without counting it as an answered part', () => {
  assert.equal(validateCandidateFeedback(feedback(), question, transcript).ratings.relevance.level, 3);
  const wronglyComplete = feedback();
  wronglyComplete.ratings.relevance.level = 4;
  wronglyComplete.decisionEvidence.relevance.coverage = 'all';
  assert.throws(() => validateCandidateFeedback(wronglyComplete, question, transcript), /relevance all coverage/);
});

test('a related quote must be exact and absent when no related material is claimed', () => {
  const invented = feedback();
  invented.decisionEvidence.relevance.relatedQuote = 'I deployed a database.';
  assert.throws(() => validateCandidateFeedback(invented, question, transcript), /relevance related quote/);
  const doubleCounted = feedback();
  doubleCounted.decisionEvidence.relevance.relatedQuote = doubleCounted.decisionEvidence.relevance.parts[0].answerQuote;
  assert.throws(() => validateCandidateFeedback(doubleCounted, question, transcript), /relevance related quote is not an answer quote/);
  const absent = feedback();
  absent.ratings.relevance.level = 1;
  absent.decisionEvidence.relevance = {...absent.decisionEvidence.relevance, coverage: 'none', parts: absent.decisionEvidence.relevance.parts.map(part => ({...part, answerQuote: ''}))};
  assert.throws(() => validateCandidateFeedback(absent, question, transcript), /relevance related quote/);
});

test('pilot feedback requires the frozen requested parts rather than choosing convenient spans', () => {
  const missingParts = {text: question.text};
  assert.throws(() => validateCandidateFeedback(feedback(), missingParts, transcript), /frozen requested parts/);
  const substituted = {...question, requestedParts: ['Why']};
  assert.throws(() => validateCandidateFeedback(feedback(), substituted, transcript), /relevance requested-part coverage/);
});

test('bare support cannot carry a purported supporting quote', () => {
  const contradicted = feedback();
  contradicted.decisionEvidence.support.supportQuote = 'I care about dependable systems.';
  assert.throws(() => validateCandidateFeedback(contradicted, question, transcript), /support absent detail/);
});

test('replacement blind packet binds opaque IDs and frozen requested parts into every input checksum', () => {
  const packet = JSON.parse(readFileSync(new URL('../evaluation/v3-7/pilot-blind-packet-v2.json', import.meta.url), 'utf8'));
  assert.equal(packet.length, 8);
  packet.forEach((item, index) => {
    assert.equal(item.caseId, `c${String(index + 1).padStart(2, '0')}`);
    assert.equal(item.question.id, item.caseId);
    assert.equal(item.packetVersion, 2);
    assert.ok(item.requestedParts.length > 0 && item.requestedParts.every(part => item.question.text.includes(part)));
    const {inputChecksum, caseId, ...source} = item;
    assert.equal(createHash('sha256').update(JSON.stringify(source)).digest('hex'), inputChecksum);
  });
});

test('3.7 pilot is dry by default and rejects execution without the usage flag', () => {
  const runner = fileURLToPath(new URL('../evaluation/v3-7/pilot-run.js', import.meta.url));
  const dry = spawnSync(process.execPath, [runner], {encoding: 'utf8'});
  assert.equal(dry.status, 0, dry.stderr);
  const plan = JSON.parse(dry.stdout);
  assert.equal(plan.feedbackRequestCap, 16);
  assert.equal(plan.firstPassRequests, 8);
  assert.equal(plan.repeatsOnlyIfFirstPassPasses, true);
  assert.equal(plan.stopOnFirstRatingMiss, true);
  const refused = spawnSync(process.execPath, [runner, '--execute'], {encoding: 'utf8'});
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /Explicit subscription usage flag required/);
});

test('cost-limited policy runs distinct first cases before repeats and identifies frozen rating misses', () => {
  const packet = JSON.parse(readFileSync(new URL('../evaluation/v3-7/pilot-blind-packet-v2.json', import.meta.url), 'utf8'));
  const slots = orderedPilotSlots(packet);
  assert.deepEqual(slots.slice(0, 8), packet.map(item => ({caseId: item.caseId, repeat: 1})));
  assert.deepEqual(slots.slice(8), packet.map(item => ({caseId: item.caseId, repeat: 2})));
  const ranges = {relevance: [3, 3], support: [2, 2], structure: [3, 3], englishExpression: [4, 4]};
  assert.deepEqual(ratingMisses(feedback(), ranges), []);
  ranges.support = [3, 3];
  assert.deepEqual(ratingMisses(feedback(), ranges), ['support']);
});

test('semantic review is bound to the v2 question, transcript and requested parts', () => {
  const packet = JSON.parse(readFileSync(new URL('../evaluation/v3-7/pilot-blind-packet-v2.json', import.meta.url), 'utf8'));
  const items = packet.flatMap(source => [1, 2].map(repeat => ({caseId: source.caseId, repeat, inputChecksum: source.inputChecksum, question: source.question, transcript: source.transcript, requestedParts: source.requestedParts})));
  assert.doesNotThrow(() => assertFrozenReviewItems(items, packet));
  const changed = structuredClone(items);
  changed[0].transcript += ' Extra reported success.';
  assert.throws(() => assertFrozenReviewItems(changed, packet));
  changed[0] = {...items[0], requestedParts: ['a different part']};
  assert.throws(() => assertFrozenReviewItems(changed, packet));
});
