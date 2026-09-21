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
  for (const c of value.capabilities) {
    if (!fields(c, ['id', 'description', 'evidence', 'kind']) || !nonempty(c.id) || !nonempty(c.description) || !nonempty(c.evidence) || !snapshot.text.includes(c.evidence) || !['fact', 'inference'].includes(c.kind)) fail('capability citation or schema');
    if (c.kind === 'fact' && !c.evidence.includes(c.description)) fail('unsupported posting fact; label interpretation as inference');
  }
  const legacyNames=['id', 'text', 'rationale', 'category', 'capabilityIds', 'evidence'];
  const legacy = q => fields(q,legacyNames) && legacyQuestions.some(old => JSON.stringify(old) === JSON.stringify(q));
  for (const q of value.questions) {
    const names=legacy(q)?legacyNames:['id', 'text', 'meaningZh', 'rationale', 'rationaleZh', 'category', 'capabilityIds', 'evidence'];
    if (!fields(q, names) || !nonempty(q.id) || !nonempty(q.text) || (!legacy(q) && (!hasLatin(q.text) || !hasHan(q.meaningZh))) || !nonempty(q.rationale) || (!legacy(q) && (!hasLatin(q.rationale) || !hasHan(q.rationaleZh))) || !categories.includes(q.category) || !Array.isArray(q.capabilityIds) || !q.capabilityIds.length || q.capabilityIds.some(id => !value.capabilities.some(c => c.id === id)) || !nonempty(q.evidence) || !snapshot.text.includes(q.evidence)) fail('question grounding or bilingual schema');
    if (!value.capabilities.some(c => q.capabilityIds.includes(c.id) && q.evidence === c.evidence)) fail('question evidence does not support linked capability');
  }
  return {capabilities: value.capabilities.map(({id, description, evidence, kind}) => ({id, description, evidence, kind})), questions: value.questions.map(q => legacy(q)?{id:q.id,text:q.text,rationale:q.rationale,category:q.category,capabilityIds:q.capabilityIds,evidence:q.evidence}:{id:q.id,text:q.text,meaningZh:q.meaningZh,rationale:q.rationale,rationaleZh:q.rationaleZh,category:q.category,capabilityIds:q.capabilityIds,evidence:q.evidence})};
}
export function validateFeedback(value, transcript) {
  const valid = v => fields(v, ['text', 'textZh', 'quote']) && hasLatin(v.text) && hasHan(v.textZh) && nonempty(v.quote) && transcript.includes(v.quote);
  requireValue(fields(value, ['ratings', 'strength', 'priorityImprovement']) && fields(value.ratings, dimensions) && dimensions.every(d => fields(value.ratings[d], ['level', 'quote', 'reason', 'reasonZh']) && Number.isInteger(value.ratings[d]?.level) && value.ratings[d].level >= 1 && value.ratings[d].level <= 4 && nonempty(value.ratings[d].quote) && transcript.includes(value.ratings[d].quote) && hasLatin(value.ratings[d].reason) && hasHan(value.ratings[d].reasonZh)) && valid(value.strength) && valid(value.priorityImprovement), 'Invalid provider output: bilingual feedback schema or transcript citation', 502);
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
  requireValue(fields(value, ['text','explanationZh']) && nonempty(value.text) && value.text.length <= 12000 && hasHan(value.explanationZh) && value.explanationZh.length <= 4000 && (['hint','gap'].includes(mode) ? hasHan(value.text) : hasLatin(value.text)), 'Invalid provider output: coaching schema', 502);
  if (['rewrite','ideas'].includes(mode)) {
    const numbers = transcript.match(/\d+(?:[.,]\d+)*/g) || [];
    requireValue((value.text.match(/\d+(?:[.,]\d+)*/g)||[]).every(n => numbers.includes(n)), 'Invalid provider output: invented numeric detail', 502);
  }
  return {text:value.text, explanationZh:value.explanationZh};
}

// A Session Summary assesses one Short Mock Session as a whole. Both findings must
// quote one of the learner's own session answers verbatim, so the summary is evidence
// rather than flattery; skipped questions supply no transcript and are never assessed.
export function validateMockSummary(value, transcripts) {
  const valid = v => fields(v, ['text','textZh','quote']) && hasLatin(v.text) && v.text.length <= 2000 && hasHan(v.textZh) && v.textZh.length <= 2000 && nonempty(v.quote) && transcripts.some(transcript => transcript.includes(v.quote));
  requireValue(Array.isArray(transcripts) && transcripts.length > 0, 'A session with no answers has nothing to assess', 409);
  requireValue(fields(value, ['strength','priorityImprovement']) && valid(value.strength) && valid(value.priorityImprovement), 'Invalid provider output: session summary schema or answer citation', 502);
  const finding = v => ({text: v.text, textZh: v.textZh, quote: v.quote});
  return {strength: finding(value.strength), priorityImprovement: finding(value.priorityImprovement)};
}

export function validateFollowUp(value) {
  requireValue(fields(value, ['text','meaningZh']) && hasLatin(value.text) && value.text.length <= 1000 && hasHan(value.meaningZh) && value.meaningZh.length <= 1000, 'Invalid provider output: bilingual follow-up schema', 502);
  return {text:value.text, meaningZh:value.meaningZh};
}

export function validateCorrections(value, transcript) {
  const fail = () => requireValue(false, 'Invalid provider output: key-sentence correction schema, citation, or invented detail', 502);
  if (!fields(value, ['corrections']) || !Array.isArray(value.corrections) || value.corrections.length > 2) fail();
  const numbersIn = text => text.match(/\d+(?:[.,]\d+)*/g) || [];
  for (const item of value.corrections) {
    if (!fields(item, ['original','rewrite','reasonZh']) || !nonempty(item.original) || !transcript.includes(item.original) || !hasLatin(item.rewrite) || item.rewrite.length > 2000 || !hasHan(item.reasonZh) || item.reasonZh.length > 2000) fail();
    // Evidence safety: a correction may only reuse numbers the learner already stated.
    const allowed = numbersIn(item.original);
    if (!numbersIn(item.rewrite).every(number => allowed.includes(number))) fail();
  }
  return {corrections: value.corrections.map(({original, rewrite, reasonZh}) => ({original, rewrite, reasonZh}))};
}
