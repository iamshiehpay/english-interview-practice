import {test} from 'node:test';
import assert from 'node:assert/strict';
import {locateQuotes, splitSentences, annotateTranscript, wordDiff, elideUnchanged} from '../public/annotate.js';

const T = 'I would design it in three parts. First, we store the documents. Second, when user ask a question, the system retrieve the top five clauses. Third, we need evaluation';
const joined = runs => runs.map(run => run.text).join('');
const before = runs => joined(runs.filter(run => run.op !== '+'));
const after = runs => joined(runs.filter(run => run.op !== '-'));

test('sentences partition the transcript exactly, including a trailing fragment and line breaks', () => {
  const sentences = splitSentences(T);
  assert.equal(sentences.length, 4);
  assert.equal(sentences.map(s => T.slice(s.start, s.end)).join(''), T);
  assert.equal(T.slice(sentences[3].start, sentences[3].end), 'Third, we need evaluation');
  const lines = '  First line without a stop\nsecond line. Version 3.5 stays whole!  ';
  const split = splitSentences(lines);
  assert.deepEqual(split.map(s => lines.slice(s.start, s.end).trim()), ['First line without a stop', 'second line.', 'Version 3.5 stays whole!']);
  assert.equal(split.map(s => lines.slice(s.start, s.end)).join(''), lines);
  assert.deepEqual(splitSentences('   '), []);
  assert.deepEqual(splitSentences(''), []);
});

test('quotes are found verbatim at their first occurrence; a missing quote is reported, not thrown', () => {
  const text = 'It works. It works. It fails.';
  const {anchors, missing} = locateQuotes(text, [{id: 'a', quote: 'It works.'}, {id: 'b', quote: 'it works.'}, {id: 'c', quote: ''}, {id: 'd', quote: 'It fails.'}]);
  assert.deepEqual(anchors, [{id: 'a', start: 0, end: 9}, {id: 'd', start: 20, end: 29}]);
  assert.deepEqual(missing, ['b', 'c']);
  const annotated = annotateTranscript(text, [{id: 'a', quote: 'It works.'}, {id: 'x', quote: 'never said'}]);
  assert.deepEqual(annotated.missing, ['x']);
  assert.equal(annotated.sentenceOf.a, 1);
  assert.equal(annotated.sentences.flatMap(row => row.segments).map(s => s.text).join(''), text);
});

test('overlapping and partially overlapping quotes split into segments that carry every id', () => {
  const quotes = [
    {id: 'strength', quote: 'we store the documents. Second, when user ask'},
    {id: 'priority', quote: 'when user ask a question'},
    {id: 'relevance', quote: 'when user ask a question'},
    {id: 'fix', quote: 'Second, when user ask a question, the system retrieve the top five clauses.'}
  ];
  const result = annotateTranscript(T, quotes);
  assert.deepEqual(result.missing, []);
  const segments = result.sentences.flatMap(row => row.segments);
  assert.equal(segments.map(s => s.text).join(''), T, 'segments rebuild the transcript');
  const idsOf = text => segments.find(s => s.text === text)?.ids;
  assert.deepEqual(idsOf('we store the documents. '), ['strength']);
  assert.deepEqual(idsOf('Second, '), ['strength', 'fix']);
  assert.deepEqual(idsOf('when user ask'), ['strength', 'priority', 'relevance', 'fix']);
  assert.deepEqual(idsOf(' a question'), ['priority', 'relevance', 'fix']);
  assert.deepEqual(idsOf(', the system retrieve the top five clauses.'), ['fix']);
  // A quote spanning two sentences is cut at the sentence boundary and starts in sentence 2.
  assert.equal(result.sentenceOf.strength, 2);
  assert.equal(result.sentenceOf.priority, 3);
  assert.equal(result.endSentenceOf.fix, 3);
  // Each id's tag goes on its last segment only; identical quotes end together.
  assert.deepEqual(segments.find(s => s.text === 'when user ask').ends, ['strength']);
  assert.deepEqual(segments.find(s => s.text === ' a question').ends, ['priority', 'relevance']);
  assert.equal(segments.filter(s => s.ends.includes('fix')).length, 1);
});

test('adjacent quotes touch without sharing a segment', () => {
  const text = 'Alpha beta gamma.';
  const segments = annotateTranscript(text, [{id: 'a', quote: 'Alpha '}, {id: 'b', quote: 'beta'}]).sentences[0].segments;
  assert.deepEqual(segments.map(s => [s.text, s.ids]), [['Alpha ', ['a']], ['beta', ['b']], [' gamma.', []]]);
});

test('word diff marks only what changed and rebuilds both sentences', () => {
  const original = 'Second, when user ask a question, the system retrieve the top five clauses.';
  const rewrite = 'Second, when a user asks a question, the system retrieves the top five clauses, with citations.';
  const runs = wordDiff(original, rewrite);
  assert.equal(before(runs), original);
  assert.equal(after(runs), rewrite);
  const changes = runs.filter(run => run.op !== '=').map(run => `${run.op}${run.text}`);
  assert.ok(changes.includes('+a '), changes.join('|'));
  assert.ok(changes.includes('-ask') && changes.includes('+asks'), changes.join('|'));
  assert.ok(changes.includes('-retrieve') && changes.includes('+retrieves'), changes.join('|'));
  assert.ok(!runs.some(run => run.op === '-' && run.text.includes('clauses')), 'an added comma does not replace the word before it');
  assert.deepEqual(wordDiff('Same sentence.', 'Same sentence.'), [{op: '=', text: 'Same sentence.'}]);
  assert.deepEqual(wordDiff('', 'New.'), [{op: '+', text: 'New.'}]);
  const replaced = wordDiff('We did some testing and it was quite good.', 'We ran an evaluation and it was quite good.');
  assert.deepEqual(replaced.filter(run => run.op !== '='), [{op: '-', text: 'did some testing'}, {op: '+', text: 'ran an evaluation'}]);
});

test('long unchanged stretches are elided around the changes', () => {
  const words = Array.from({length: 40}, (_, i) => `w${i}`);
  const a = words.join(' '), b = words.map((w, i) => (i === 20 ? 'CHANGED' : w)).join(' ');
  const runs = elideUnchanged(wordDiff(a, b), 3);
  assert.deepEqual(runs.map(run => run.op), ['…', '=', '-', '+', '=', '…']);
  assert.equal(runs[1].text.trim(), 'w17 w18 w19');
  assert.equal(runs[4].text.trim(), 'w21 w22 w23');
  const same = [{op: '=', text: a}];
  assert.deepEqual(elideUnchanged(same, 3), same);
});
