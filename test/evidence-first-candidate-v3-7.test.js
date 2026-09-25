import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {CANDIDATE_CONTRACT_VERSION, candidateFeedbackContract, validateCandidateFeedback} from '../evaluation/v3-7/evidence-first-candidate.js';

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
