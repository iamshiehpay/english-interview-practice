export const dimensions = ['relevance', 'support', 'structure', 'englishExpression'];
export const categories = ['role-fit', 'experience-depth', 'behavioral', 'technical-communication'];
export class AppError extends Error {
  // `message` may quote an external service back to whoever is running the server.
  // `reason` is the part we are willing to persist in the workspace and show in the
  // page, so it is our own wording only: a provider body can echo anything it was
  // sent, including a credential, and must never be written to disk.
  constructor(message, status = 400, reason = message) { super(message); this.status = status; this.reason = reason; }
}
export function requireValue(condition, message, status = 400) {
  if (!condition) throw new AppError(message, status);
}
export function nonempty(value) { return typeof value === 'string' && value.trim().length > 0; }
// Any failure text that may be logged, stored in the workspace or shown in the page
// passes through here first. Provider messages are not supposed to contain the API
// key, so this is a guard against that ever changing: a key must never reach the
// workspace file, a test artefact, Git or a log.
export const redactSecrets = (text, limit = 400) =>
  String(text ?? '').replace(/\b(?:sk|rk)-[A-Za-z0-9_-]{8,}/g, '<redacted>').slice(0, limit);
const hasHan=value=>nonempty(value)&&/\p{Script=Han}/u.test(value);
const hasLatin=value=>nonempty(value)&&/\p{Script=Latin}/u.test(value);
// A rejected model output names only the first failing field path and check. The
// message is kept on the operation and shown in the page, so it carries our own field
// names and check names only, never transcript, quote or answer text.
const invalid = (subject, check) => requireValue(false, `Invalid provider output: ${subject} ${check}`, 502);
const LATIN = 'has no Latin characters', HAN = 'has no Han characters', SHAPE = 'missing or extra fields';
// Checks a bilingual finding {text, textZh, quote}, returning the first failing check.
const findingFailure = (v, cited, {limit = Infinity, where = 'not in transcript'} = {}) =>
  !fields(v, ['text', 'textZh', 'quote']) ? ['', SHAPE] : !hasLatin(v.text) ? ['.text', LATIN] : v.text.length > limit ? ['.text', 'too long'] : !hasHan(v.textZh) ? ['.textZh', HAN] : v.textZh.length > limit ? ['.textZh', 'too long'] : !nonempty(v.quote) ? ['.quote', 'empty'] : !cited(v.quote) ? ['.quote', where] : null;
function fields(value, names) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
}
export function validateAnalysis(value, snapshot, {expanded = false, legacyQuestions = []} = {}) {
  const fail = message => requireValue(false, `Invalid provider output: ${message}`, 502);
  if (!fields(value, ['capabilities', 'questions']) || !Array.isArray(value.capabilities) || value.capabilities.length < 1 || !Array.isArray(value.questions) || value.questions.length < 8 || (!expanded && value.questions.length > 12)) fail('expected capabilities and 8–12 initial questions');
  if (new Set(value.capabilities.map(c => c?.id)).size !== value.capabilities.length || new Set(value.questions.map(q => q?.id)).size !== value.questions.length) fail('duplicate identifiers');
  if (!categories.every(category => value.questions.some(q => q?.category === category))) fail('missing question category');
  const normalized = value.questions.map(q => typeof q?.text === 'string' ? q.text.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}]/gu, '').replace(/\s+/g, ' ').trim() : '');
  if (new Set(normalized).size !== normalized.length) fail('duplicate questions');
  for (const [i, c] of value.capabilities.entries()) {
    const at = `capabilities[${i}]`;
    if (!fields(c, ['id', 'description', 'evidence', 'kind'])) invalid(`analysis ${at}`, SHAPE);
    if (!nonempty(c.id) || !nonempty(c.description)) invalid(`analysis ${at}`, 'empty id or description');
    if (!nonempty(c.evidence)) invalid(`analysis ${at}.evidence`, 'empty');
    if (!snapshot.text.includes(c.evidence)) invalid(`analysis ${at}.evidence`, 'not in job snapshot');
    if (!['fact', 'inference'].includes(c.kind)) invalid(`analysis ${at}.kind`, 'not fact or inference');
    if (c.kind === 'fact' && !c.evidence.includes(c.description)) fail(`unsupported posting fact at ${at}; label interpretation as inference`);
  }
  const legacyNames=['id', 'text', 'rationale', 'category', 'capabilityIds', 'evidence'];
  const legacy = q => fields(q,legacyNames) && legacyQuestions.some(old => JSON.stringify(old) === JSON.stringify(q));
  for (const [i, q] of value.questions.entries()) {
    const names=legacy(q)?legacyNames:['id', 'text', 'meaningZh', 'rationale', 'rationaleZh', 'category', 'capabilityIds', 'evidence'], at = `analysis questions[${i}]`;
    if (!fields(q, names)) invalid(at, SHAPE);
    if (!nonempty(q.id)) invalid(`${at}.id`, 'empty');
    if (!nonempty(q.text)) invalid(`${at}.text`, 'empty');
    if (!legacy(q) && !hasLatin(q.text)) invalid(`${at}.text`, LATIN);
    if (!legacy(q) && !hasHan(q.meaningZh)) invalid(`${at}.meaningZh`, HAN);
    if (!nonempty(q.rationale)) invalid(`${at}.rationale`, 'empty');
    if (!legacy(q) && !hasLatin(q.rationale)) invalid(`${at}.rationale`, LATIN);
    if (!legacy(q) && !hasHan(q.rationaleZh)) invalid(`${at}.rationaleZh`, HAN);
    if (!categories.includes(q.category)) invalid(`${at}.category`, 'unknown category');
    if (!Array.isArray(q.capabilityIds) || !q.capabilityIds.length || q.capabilityIds.some(id => !value.capabilities.some(c => c.id === id))) invalid(`${at}.capabilityIds`, 'empty or unknown capability');
    if (!nonempty(q.evidence)) invalid(`${at}.evidence`, 'empty');
    if (!snapshot.text.includes(q.evidence)) invalid(`${at}.evidence`, 'not in job snapshot');
    if (!value.capabilities.some(c => q.capabilityIds.includes(c.id) && q.evidence === c.evidence)) fail(`question evidence does not support linked capability at questions[${i}]`);
  }
  return {capabilities: value.capabilities.map(({id, description, evidence, kind}) => ({id, description, evidence, kind})), questions: value.questions.map(q => legacy(q)?{id:q.id,text:q.text,rationale:q.rationale,category:q.category,capabilityIds:q.capabilityIds,evidence:q.evidence}:{id:q.id,text:q.text,meaningZh:q.meaningZh,rationale:q.rationale,rationaleZh:q.rationaleZh,category:q.category,capabilityIds:q.capabilityIds,evidence:q.evidence})};
}
export function validateFeedback(value, transcript) {
  // Same acceptance rules as ever; only the rejection now says which check failed.
  if (!fields(value, ['ratings', 'strength', 'priorityImprovement'])) invalid('feedback', SHAPE);
  if (!fields(value.ratings, dimensions)) invalid('feedback ratings', SHAPE);
  for (const d of dimensions) {
    const r = value.ratings[d], at = `feedback ratings.${d}`;
    if (!fields(r, ['level', 'quote', 'reason', 'reasonZh'])) invalid(at, SHAPE);
    if (!Number.isInteger(r.level) || r.level < 1 || r.level > 4) invalid(`${at}.level`, 'out of range');
    if (!nonempty(r.quote)) invalid(`${at}.quote`, 'empty');
    if (!transcript.includes(r.quote)) invalid(`${at}.quote`, 'not in transcript');
    if (!hasLatin(r.reason)) invalid(`${at}.reason`, LATIN);
    if (!hasHan(r.reasonZh)) invalid(`${at}.reasonZh`, HAN);
  }
  for (const name of ['strength', 'priorityImprovement']) { const failure = findingFailure(value[name], quote => transcript.includes(quote)); if (failure) invalid(`feedback ${name}${failure[0]}`, failure[1]); }
  return {ratings: Object.fromEntries(dimensions.map(d => [d, {level: value.ratings[d].level, quote: value.ratings[d].quote, reason: value.ratings[d].reason, reasonZh:value.ratings[d].reasonZh}])), strength: {text: value.strength.text, textZh:value.strength.textZh, quote: value.strength.quote}, priorityImprovement: {text: value.priorityImprovement.text, textZh:value.priorityImprovement.textZh, quote: value.priorityImprovement.quote}};
}

export const gapGuidance = [
  {frame: 'conceptual', guidance: 'Explain the concept and give a reasoned example.'},
  {frame: 'hypothetical', guidance: 'Describe what you would do, with assumptions and trade-offs.'},
  {frame: 'transferable', guidance: 'Use a true adjacent experience and explain its limits.'},
  {frame: 'honest-learning-plan', guidance: 'State what you have not done and how you would learn or validate it.'}
];
export function questionSetView(analysis, records, snapshotId) {
  const history = Object.fromEntries(analysis.questions.map(q => [q.id, records.filter(r => r.snapshotId === snapshotId && r.question.id === q.id).map(r => ({recordId: r.id, status: r.status}))]));
  const categoryCount = category => analysis.questions.filter(q => q.category === category).reduce((n, q) => n + history[q.id].length, 0);
  const ranked = [...analysis.questions].sort((a, b) => categoryCount(a.category) - categoryCount(b.category) || history[a.id].length - history[b.id].length);
  return {...analysis, history, recommendation: {questionId: ranked[0].id, reason: 'Broaden category coverage, then practise the least-used question.', reasonZh:'先擴充題型覆蓋，再練習次數最少的題目。'}, gapGuidance,
    review: {required: true, reason: 'Generated questions and inferences need your review. Exact citations do not prove semantic support or rule out similar questions. Compare each question with its quoted evidence; these are not actual employer questions.'}};
}

export function validateCoaching(value, mode, transcript = '') {
  if (!fields(value, ['text','explanationZh'])) invalid('coaching', SHAPE);
  if (!nonempty(value.text)) invalid('coaching text', 'empty');
  if (value.text.length > 12000) invalid('coaching text', 'too long');
  if (!hasHan(value.explanationZh)) invalid('coaching explanationZh', HAN);
  if (value.explanationZh.length > 4000) invalid('coaching explanationZh', 'too long');
  if (['hint','gap'].includes(mode) ? !hasHan(value.text) : !hasLatin(value.text)) invalid('coaching text', ['hint','gap'].includes(mode) ? HAN : LATIN);
  if (['rewrite','ideas'].includes(mode)) {
    const numbers = transcript.match(/\d+(?:[.,]\d+)*/g) || [];
    if (!(value.text.match(/\d+(?:[.,]\d+)*/g)||[]).every(n => numbers.includes(n))) invalid('coaching text', 'has an invented number');
  }
  return {text:value.text, explanationZh:value.explanationZh};
}

// A Session Summary assesses one Short Mock Session as a whole. Both findings must
// quote one of the learner's own session answers verbatim, so the summary is evidence
// rather than flattery; skipped questions supply no transcript and are never assessed.
export function validateMockSummary(value, transcripts) {
  requireValue(Array.isArray(transcripts) && transcripts.length > 0, 'A session with no answers has nothing to assess', 409);
  if (!fields(value, ['strength','priorityImprovement'])) invalid('session summary', SHAPE);
  for (const name of ['strength', 'priorityImprovement']) { const failure = findingFailure(value[name], quote => transcripts.some(transcript => transcript.includes(quote)), {limit: 2000, where: 'not in any answer'}); if (failure) invalid(`session summary ${name}${failure[0]}`, failure[1]); }
  const finding = v => ({text: v.text, textZh: v.textZh, quote: v.quote});
  return {strength: finding(value.strength), priorityImprovement: finding(value.priorityImprovement)};
}

export function validateFollowUp(value) {
  if (!fields(value, ['text','meaningZh'])) invalid('follow-up', SHAPE);
  if (!hasLatin(value.text)) invalid('follow-up text', LATIN);
  if (value.text.length > 1000) invalid('follow-up text', 'too long');
  if (!hasHan(value.meaningZh)) invalid('follow-up meaningZh', HAN);
  if (value.meaningZh.length > 1000) invalid('follow-up meaningZh', 'too long');
  return {text:value.text, meaningZh:value.meaningZh};
}

export function validateCorrections(value, transcript) {
  if (!fields(value, ['corrections']) || !Array.isArray(value.corrections)) invalid('corrections', SHAPE);
  if (value.corrections.length > 2) invalid('corrections', 'more than two');
  const numbersIn = text => text.match(/\d+(?:[.,]\d+)*/g) || [];
  for (const [i, item] of value.corrections.entries()) {
    const at = `corrections[${i}]`;
    if (!fields(item, ['original','rewrite','reasonZh'])) invalid(at, SHAPE);
    if (!nonempty(item.original)) invalid(`${at}.original`, 'empty');
    if (!transcript.includes(item.original)) invalid(`${at}.original`, 'not in transcript');
    if (!hasLatin(item.rewrite)) invalid(`${at}.rewrite`, LATIN);
    if (item.rewrite.length > 2000) invalid(`${at}.rewrite`, 'too long');
    if (!hasHan(item.reasonZh)) invalid(`${at}.reasonZh`, HAN);
    if (item.reasonZh.length > 2000) invalid(`${at}.reasonZh`, 'too long');
    // Evidence safety: a correction may only reuse numbers the learner already stated.
    const allowed = numbersIn(item.original);
    if (!numbersIn(item.rewrite).every(number => allowed.includes(number))) invalid(`${at}.rewrite`, 'has an invented number');
  }
  return {corrections: value.corrections.map(({original, rewrite, reasonZh}) => ({original, rewrite, reasonZh}))};
}
