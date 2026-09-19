export const dimensions = ['relevance', 'support', 'structure', 'englishExpression'];
export const categories = ['role-fit', 'experience-depth', 'behavioral', 'technical-communication'];
export class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function requireValue(condition, message, status = 400) {
  if (!condition) throw new AppError(message, status);
}
export function nonempty(value) { return typeof value === 'string' && value.trim().length > 0; }
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

export function validateFollowUp(value) {
  requireValue(fields(value, ['text','meaningZh']) && hasLatin(value.text) && value.text.length <= 1000 && hasHan(value.meaningZh) && value.meaningZh.length <= 1000, 'Invalid provider output: bilingual follow-up schema', 502);
  return {text:value.text, meaningZh:value.meaningZh};
}
