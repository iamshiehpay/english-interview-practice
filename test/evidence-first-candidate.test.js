import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateFeedbackContract, candidateFeedbackSchema, validateCandidateFeedback} from '../evaluation/v3-6/evidence-first-candidate.js';

const question = {text: 'How would you investigate a slow search and explain the trade-off?'};
const transcript = 'I would measure slow queries, then inspect false matches before changing the index. I would check latency again, but I cannot claim a production result.';
const rating = (level, quote) => ({level, quote, reason: 'Grounded in the answer.', reasonZh: '根據回答中的證據。'});
const valid = () => ({
  decisionEvidence: {
    relevance: {coverage: 'core-only', questionPartQuotes: ['investigate a slow search', 'explain the trade-off'], answerQuotes: ['measure slow queries'], missingPartQuotes: ['explain the trade-off']},
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
  inventedPart.decisionEvidence.relevance.missingPartQuotes = ['report the revenue'];
  assert.throws(() => validateCandidateFeedback(inventedPart, question, transcript), /relevance answer or missing quotes/);
  const inventedSpan = valid();
  inventedSpan.decisionEvidence.structure.spanQuotes[1] = 'deployed to production';
  assert.throws(() => validateCandidateFeedback(inventedSpan, question, transcript), /structure spans/);
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
