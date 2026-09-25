import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {candidateFeedbackContract, candidateFeedbackSchema, validateCandidateFeedback} from '../evaluation/v3-6/evidence-first-candidate.js';
import {assertFrozenReviewItems} from '../evaluation/v3-6/review-source.js';

const question = {text: 'How would you investigate a slow search and explain the trade-off?', requestedParts: ['How would you investigate a slow search', 'explain the trade-off']};
const transcript = 'I would measure slow queries, then inspect false matches before changing the index. I would check latency again, but I cannot claim a production result.';
const rating = (level, quote) => ({level, quote, reason: 'Grounded in the answer.', reasonZh: '根據回答中的證據。'});
const valid = () => ({
  decisionEvidence: {
    relevance: {coverage: 'core-only', parts: [{questionPartQuote: question.requestedParts[0], answerQuote: 'measure slow queries'}, {questionPartQuote: question.requestedParts[1], answerQuote: ''}], relatedQuote: ''},
    support: {basis: 'reasoned', pointQuote: 'measure slow queries', supportQuote: 'check latency again', reasoningLink: 'The second measurement checks whether the index change helped.'},
    structure: {organization: 'developed', spanQuotes: ['measure slow queries', 'inspect false matches', 'check latency again'], linkType: 'stepwise', advancement: 'Measurement leads to diagnosis and then validation.'},
    englishExpression: {impact: 'none', issueQuote: '', issue: ''}
  },
  ratings: {
    relevance: rating(3, 'measure slow queries'),
    support: rating(4, 'check latency again'),
    structure: rating(4, 'then inspect false matches before changing the index'),
    englishExpression: rating(4, 'I would check latency again')
  },
  strength: {text: 'Specific steps.', textZh: '具體的步驟。', quote: 'measure slow queries'},
  priorityImprovement: {text: 'Explain the trade-off.', textZh: '說明取捨。', quote: 'changing the index'}
});

test('evidence-first candidate preserves the four existing ratings and checks independent source spans', () => {
  const result = validateCandidateFeedback(valid(), question, transcript);
  assert.deepEqual(Object.keys(result).sort(), ['decisionEvidence', 'priorityImprovement', 'ratings', 'strength']);
  assert.equal(result.ratings.structure.level, 4);
  assert.match(candidateFeedbackContract, /without changing actor, action, certainty, completed-versus-planned timing/);
  assert.equal(candidateFeedbackSchema.additionalProperties, false);
});

test('candidate rejects an unsupported structure 4 even when the rating quote is exact', () => {
  const feedback = valid();
  feedback.decisionEvidence.structure = {organization: 'developed', spanQuotes: ['measure slow queries'], linkType: 'related', advancement: 'This is a clear idea.'};
  assert.throws(() => validateCandidateFeedback(feedback, question, transcript), /structure developed link/);
});

test('candidate rejects evidence/rating disagreement and invented question or transcript evidence', () => {
  const mismatch = valid();
  mismatch.ratings.support.level = 3;
  assert.throws(() => validateCandidateFeedback(mismatch, question, transcript), /support level/);
  const inventedPart = valid();
  inventedPart.decisionEvidence.relevance.parts[1].questionPartQuote = 'report the revenue';
  assert.throws(() => validateCandidateFeedback(inventedPart, question, transcript), /relevance part quotes/);
  const inventedSpan = valid();
  inventedSpan.decisionEvidence.structure.spanQuotes[1] = 'deployed to production';
  assert.throws(() => validateCandidateFeedback(inventedSpan, question, transcript), /structure spans/);
});

test('a compound question cannot receive relevance 4 by silently omitting a frozen requested part', () => {
  const feedback = valid();
  feedback.ratings.relevance.level = 4;
  feedback.decisionEvidence.relevance.coverage = 'all';
  feedback.decisionEvidence.relevance.parts.pop();
  assert.throws(() => validateCandidateFeedback(feedback, question, transcript), /relevance requested-part coverage/);
});

test('support level 1 can truthfully record no question-related point', () => {
  const feedback = valid();
  feedback.ratings.support.level = 1;
  feedback.decisionEvidence.support = {basis: 'none', pointQuote: '', supportQuote: '', reasoningLink: ''};
  assert.equal(validateCandidateFeedback(feedback, question, transcript).ratings.support.level, 1);
});

test('candidate keeps language judgment separate and requires a quoted wording problem below 4', () => {
  const feedback = valid();
  feedback.ratings.englishExpression.level = 3;
  feedback.decisionEvidence.englishExpression.impact = 'noticeable-no-barrier';
  assert.throws(() => validateCandidateFeedback(feedback, question, transcript), /English expression issue/);
  feedback.decisionEvidence.englishExpression.issueQuote = 'I would check latency again';
  feedback.decisionEvidence.englishExpression.issue = 'Claimed wording issue';
  assert.equal(validateCandidateFeedback(feedback, question, transcript).ratings.englishExpression.level, 3);
});

test('pilot runner is dry by default and refuses execution without explicit usage flag', () => {
  const runner = fileURLToPath(new URL('../evaluation/v3-6/pilot-run.js', import.meta.url));
  const dry = spawnSync(process.execPath, [runner], {encoding: 'utf8'});
  assert.equal(dry.status, 0, dry.stderr);
  assert.equal(JSON.parse(dry.stdout).feedbackRequestCap, 16);
  const refused = spawnSync(process.execPath, [runner, '--execute'], {encoding: 'utf8'});
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /Explicit subscription usage flag required/);
});

test('semantic review cannot use a transcript with added context outside the frozen blind packet', () => {
  const directory = new URL('../evaluation/v3-6/', import.meta.url);
  const packet = JSON.parse(readFileSync(new URL('pilot-blind-packet.json', directory), 'utf8'));
  const parts = JSON.parse(readFileSync(new URL('pilot-question-parts.json', directory), 'utf8'));
  const items = packet.flatMap(source => [1, 2].map(repeat => ({caseId: source.caseId, repeat, inputChecksum: source.inputChecksum, question: source.question, transcript: source.transcript, requestedParts: parts[source.caseId]})));
  assert.doesNotThrow(() => assertFrozenReviewItems(items, packet, parts));
  const tampered = structuredClone(items);
  tampered[0].transcript += ' I completed a successful production rollout.';
  assert.throws(() => assertFrozenReviewItems(tampered, packet, parts));
  tampered[0] = {...items[0], requestedParts: ['a different requirement']};
  assert.throws(() => assertFrozenReviewItems(tampered, packet, parts));
});
