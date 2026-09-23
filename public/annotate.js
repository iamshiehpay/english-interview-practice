// Pure text helpers for annotated feedback (issue 0024). No DOM access here, so the
// same rules run in the browser and in node tests.
//
// Every feedback quote is validated on the server as an exact excerpt of the
// learner's transcript (ADR 0006/0016); these helpers only find those excerpts
// again and never rewrite, translate or normalise the learner's words.

// Finds each quote as an exact substring. A quote that occurs more than once is
// anchored at its FIRST occurrence (the server only guarantees that it occurs, not
// where), and a quote that cannot be found is reported in `missing` instead of
// throwing, so one bad quote never hides the rest of the transcript.
export function locateQuotes(text, quotes) {
  const source = String(text ?? '');
  const anchors = [], missing = [];
  for (const {id, quote} of quotes) {
    const value = String(quote ?? '');
    const start = value ? source.indexOf(value) : -1;
    if (start < 0) missing.push(id);
    else anchors.push({id, start, end: start + value.length});
  }
  return {anchors, missing};
}

// Splits a transcript into sentences at . ! ? (plus closing quotes/brackets) that
// are followed by whitespace or the end, and at line breaks. The sentences
// partition the text exactly: each one runs from its first character to the start
// of the next (so it keeps its trailing whitespace) and the first also keeps any
// leading whitespace. Text without terminal punctuation is still one sentence;
// empty or whitespace-only text yields none.
export function splitSentences(text) {
  const source = String(text ?? '');
  if (!source.trim()) return [];
  const starts = [];
  const addStart = position => {
    while (position < source.length && /\s/.test(source[position])) position++;
    if (position < source.length && (!starts.length || position > starts.at(-1))) starts.push(position);
  };
  addStart(0);
  const boundary = /[.!?]+["'”’)\]]*(?=\s|$)|\n/g;
  for (let match; (match = boundary.exec(source));) addStart(match.index + match[0].length);
  return starts.map((start, index) => ({start: index ? start : 0, end: index + 1 < starts.length ? starts[index + 1] : source.length}));
}

// Segments the transcript at every quote boundary and every sentence boundary.
// A segment covered by several quotes carries all their ids (in quote order), so
// overlapping and partially overlapping quotes never overwrite each other.
// `ends` lists the ids whose quote finishes at that segment (where its tag goes).
// Returns sentences (1-based `n`) each holding its segments, the sentence number
// where each located quote starts, and the ids that could not be located.
export function annotateTranscript(text, quotes) {
  const source = String(text ?? '');
  const {anchors, missing} = locateQuotes(source, quotes);
  const sentences = splitSentences(source);
  const order = new Map(quotes.map(({id}, index) => [id, index]));
  const sentenceOf = {};
  for (const anchor of anchors) {
    const index = sentences.findIndex(sentence => anchor.start < sentence.end);
    sentenceOf[anchor.id] = index + 1;
  }
  const lastSegment = {};
  const rows = sentences.map((sentence, index) => {
    const points = new Set([sentence.start, sentence.end]);
    for (const anchor of anchors) {
      if (anchor.start > sentence.start && anchor.start < sentence.end) points.add(anchor.start);
      if (anchor.end > sentence.start && anchor.end < sentence.end) points.add(anchor.end);
    }
    const cuts = [...points].sort((a, b) => a - b);
    const segments = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const start = cuts[i], end = cuts[i + 1];
      const ids = anchors.filter(anchor => anchor.start < end && anchor.end > start).map(anchor => anchor.id).sort((a, b) => order.get(a) - order.get(b));
      const segment = {text: source.slice(start, end), start, end, ids, ends: []};
      segments.push(segment);
      for (const id of ids) lastSegment[id] = segment;
    }
    return {n: index + 1, start: sentence.start, end: sentence.end, segments};
  });
  for (const [id, segment] of Object.entries(lastSegment)) segment.ends.push(id);
  for (const row of rows) for (const segment of row.segments) segment.ends.sort((a, b) => order.get(a) - order.get(b));
  // The sentence each located quote ends in (where an inline correction is shown).
  const endSentenceOf = {};
  for (const anchor of anchors) endSentenceOf[anchor.id] = sentences.findIndex(sentence => anchor.end <= sentence.end) + 1;
  return {sentences: rows, sentenceOf, endSentenceOf, missing};
}

// Word-level diff of `before` against `after`. Tokens are words, single
// punctuation marks and whitespace runs, so "clauses" -> "clauses," is one
// inserted comma rather than a replaced word. Returns runs of
// {op:'='|'-'|'+', text}: '=' and '-' runs concatenate back to `before`, '=' and
// '+' runs concatenate back to `after`. Within one change, deletions come first.
export function wordDiff(before, after) {
  const tokenize = value => String(value ?? '').match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*|\s+|[^\s\p{L}\p{N}]/gu) || [];
  const a = tokenize(before), b = tokenize(after);
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const A = a.slice(head, a.length - tail), B = b.slice(head, b.length - tail);
  const ops = a.slice(0, head).map(text => ['=', text]);
  if (A.length * B.length > 250000) {
    // Too long to align word by word: show the changed middle as one replacement.
    ops.push(...A.map(text => ['-', text]), ...B.map(text => ['+', text]));
  } else {
    const width = B.length + 1;
    const table = new Uint16Array((A.length + 1) * width);
    for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) {
      table[i * width + j] = A[i] === B[j] ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
    let i = 0, j = 0;
    while (i < A.length || j < B.length) {
      if (i < A.length && j < B.length && A[i] === B[j]) { ops.push(['=', A[i]]); i++; j++; }
      else if (j >= B.length || (i < A.length && table[(i + 1) * width + j] >= table[i * width + j + 1])) ops.push(['-', A[i++]]);
      else ops.push(['+', B[j++]]);
    }
  }
  ops.push(...a.slice(a.length - tail).map(text => ['=', text]));
  // Group changes; a bare space between two changes joins them, so a phrase reads as
  // one deletion and one insertion instead of alternating fragments.
  const groups = [];
  for (const [op, text] of ops) {
    const last = groups.at(-1);
    if (op === '=') {
      if (last?.op === '=') last.text += text;
      else groups.push({op: '=', text});
    } else {
      if (last?.op !== 'change') groups.push({op: 'change', del: '', ins: ''});
      groups.at(-1)[op === '-' ? 'del' : 'ins'] += text;
    }
  }
  const merged = [];
  for (let k = 0; k < groups.length; k++) {
    const group = groups[k], previous = merged.at(-1), next = groups[k + 1];
    if (group.op === '=' && /^\s+$/.test(group.text) && previous?.op === 'change' && next?.op === 'change') {
      previous.del += group.text + next.del; previous.ins += group.text + next.ins; k++;
    } else if (group.op === 'change' && previous?.op === 'change') {
      previous.del += group.del; previous.ins += group.ins;
    } else merged.push({...group});
  }
  // Whitespace that both sides of a replacement share at its edges is unchanged
  // text, so it moves out of the <del>/<ins> pair.
  const runs = [];
  const plain = text => { if (!text) return; if (runs.at(-1)?.op === '=') runs.at(-1).text += text; else runs.push({op: '=', text}); };
  for (const group of merged) {
    if (group.op === '=') { plain(group.text); continue; }
    let {del, ins} = group, before = '', after = '';
    while (del && ins && del[0] === ins[0] && /\s/.test(del[0])) { before += del[0]; del = del.slice(1); ins = ins.slice(1); }
    while (del && ins && del.at(-1) === ins.at(-1) && /\s/.test(del.at(-1))) { after = del.at(-1) + after; del = del.slice(0, -1); ins = ins.slice(0, -1); }
    plain(before);
    if (del) runs.push({op: '-', text: del});
    if (ins) runs.push({op: '+', text: ins});
    plain(after);
  }
  return runs;
}

// Shortens long unchanged stretches of a diff to `context` words either side of
// each change, marking the cut with an {op:'…'} run. Used for the before/after
// comparison of two whole answers, where only the changes matter.
export function elideUnchanged(runs, context = 8) {
  if (!runs.some(run => run.op !== '=')) return runs;
  return runs.flatMap((run, index) => {
    if (run.op !== '=') return [run];
    const parts = run.text.match(/\s*\S+/g) || [];
    const trailing = run.text.slice(parts.join('').length);
    const keepHead = index === 0 ? 0 : context, keepTail = index === runs.length - 1 ? 0 : context;
    if (parts.length <= keepHead + keepTail + 2) return [run];
    const out = [];
    if (keepHead) out.push({op: '=', text: parts.slice(0, keepHead).join('')});
    out.push({op: '…', text: ''});
    if (keepTail) out.push({op: '=', text: parts.slice(parts.length - keepTail).join('') + trailing});
    return out;
  });
}
