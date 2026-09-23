import {test} from 'node:test';
import assert from 'node:assert/strict';
import {locateQuotes, splitSentences, annotateTranscript, tagPosition, collapseTags, wordDiff, elideUnchanged} from '../public/annotate.js';

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
  assert.deepEqual(idsOf(','), ['fix'], 'the comma after a tagged segment is split off to stay with the tag');
  assert.deepEqual(idsOf(' the system retrieve the top five clauses.'), ['fix']);
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

test('punctuation right after a tagged quote is glued to it without changing the text', () => {
  const text = 'I fixed the cache. Then we shipped, and users noticed?! Later it broke .';
  const quotes = [{id: 'a', quote: 'fixed the cache'}, {id: 'b', quote: 'we shipped'}, {id: 'c', quote: 'users noticed'}, {id: 'd', quote: 'it broke '}, {id: 'e', quote: 'Then'}];
  const result = annotateTranscript(text, quotes);
  const segments = result.sentences.flatMap(row => row.segments);
  assert.equal(segments.map(s => s.text).join(''), text, 'segments still rebuild the transcript');
  for (const segment of segments) assert.equal(text.slice(segment.start, segment.end), segment.text);
  const glued = segments.filter(s => s.glue).map(s => s.text);
  assert.deepEqual(glued, ['.', ',', '?!'], 'a stop, a comma and a run of marks each follow their tag');
  // The glued piece is plain text (no quote covers it), and each quote still ends once.
  assert.ok(segments.filter(s => s.glue).every(s => s.ids.length === 0 && s.ends.length === 0));
  for (const id of ['a', 'b', 'c', 'd', 'e']) assert.equal(segments.filter(s => s.ends.includes(id)).length, 1, id);
  // No glue after a space ("broke ." keeps its gap) or after a segment where no quote ends.
  assert.equal(segments.find(s => s.start === text.lastIndexOf('.')).glue, undefined);
  // A punctuation segment that is itself inside another quote keeps that quote's ids.
  const inner = annotateTranscript('Alpha beta.', [{id: 'x', quote: 'beta'}, {id: 'y', quote: 'beta.'}]).sentences[0].segments;
  assert.deepEqual(inner.map(s => [s.text, s.ids, s.ends, Boolean(s.glue)]), [['Alpha ', [], [], false], ['beta', ['x', 'y'], ['x'], false], ['.', ['y'], ['y'], true]]);
});

test('a quote ending inside a word keeps its exact highlight but tags after the whole word', () => {
  const text = 'I enjoy APIs. I would aim to learn how the team runs Kubernetes at scale.';
  const quote = 'I would aim to l';
  const result = annotateTranscript(text, [{id: 'a', quote}]);
  const segments = result.sentences.flatMap(row => row.segments);
  assert.equal(segments.map(s => s.text).join(''), text, 'segments still rebuild the transcript');
  for (const segment of segments) assert.equal(text.slice(segment.start, segment.end), segment.text);
  // The mark covers exactly the quote's characters, not the rest of the word.
  assert.equal(segments.filter(s => s.ids.includes('a')).map(s => s.text).join(''), quote);
  // The tag goes after "learn", on the unmarked rest of the word.
  const tagged = segments.find(s => s.ends.includes('a'));
  assert.deepEqual([tagged.text, tagged.ids], ['earn', []]);
  assert.equal(tagged.end, text.indexOf('learn') + 'learn'.length);
  assert.equal(tagPosition(text, text.indexOf(quote) + quote.length), text.indexOf(' how'));
  // An apostrophe between letters is part of the word; a hyphen or a space ends it.
  assert.equal(tagPosition("we don't stop", 5), 8);
  assert.equal(tagPosition('state-of-the-art', 3), 5);
  assert.equal(tagPosition('two words', 3), 3, 'a quote ending at a word boundary keeps its position');
  // Punctuation after the moved tag is glued to it, as after any tag.
  const stop = annotateTranscript('We shipped it.', [{id: 'b', quote: 'We shipped i'}]).sentences[0].segments;
  assert.deepEqual(stop.map(s => [s.text, s.ids, s.ends, Boolean(s.glue)]), [['We shipped i', ['b'], [], false], ['t', [], ['b'], false], ['.', [], [], true]]);
  // Han characters are not space-separated words, so the tag is not pushed along.
  assert.equal(tagPosition('我覺得很好', 2), 2);
});

test('many tags landing on one spot all end on that segment and collapse to two plus a count', () => {
  const text = 'I enjoy APIs. I would aim to learn how the team works.';
  const ids = ['strength', 'priority', 'relevance', 'support', 'structure', 'englishExpression', 'summary-strength', 'summary-priority'];
  const quotes = ids.map((id, index) => ({id, quote: index % 2 ? 'I would aim to l' : 'aim to learn'}));
  const segments = annotateTranscript(text, quotes).sentences.flatMap(row => row.segments);
  assert.equal(segments.map(s => s.text).join(''), text);
  const spots = segments.filter(s => s.ends.length);
  assert.equal(spots.length, 1, 'quotes ending at the end of a word and inside it share one tag spot');
  assert.deepEqual(spots[0].ends, ids, 'tags keep the quote order');
  assert.equal(spots[0].text, 'earn');
  assert.deepEqual(collapseTags(['a', 'b', 'c']), {shown: ['a', 'b', 'c'], more: 0}, 'three tags are shown as they are');
  assert.deepEqual(collapseTags(['a', 'b', 'c', 'd']), {shown: ['a', 'b'], more: 2});
  assert.deepEqual(collapseTags(ids), {shown: ['strength', 'priority'], more: 6});
  assert.deepEqual(collapseTags([]), {shown: [], more: 0});
});

test('a quote ending at punctuation or at the very end of the transcript keeps its tag in place', () => {
  const text = 'We cut costs, then we scaled';
  const result = annotateTranscript(text, [{id: 'comma', quote: 'We cut costs,'}, {id: 'end', quote: 'we scaled'}, {id: 'tail', quote: 'then we sca'}]);
  const segments = result.sentences.flatMap(row => row.segments);
  assert.equal(segments.map(s => s.text).join(''), text);
  // A quote that includes its punctuation is tagged right after that punctuation.
  assert.equal(segments.find(s => s.ends.includes('comma')).end, text.indexOf(',') + 1);
  // A quote ending at the last character, and one stopping inside the last word,
  // both tag at the end of the transcript without overrunning it.
  const last = segments.at(-1);
  assert.equal(last.end, text.length);
  assert.deepEqual(last.ends, ['end', 'tail']);
  assert.equal(tagPosition(text, text.length), text.length);
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
