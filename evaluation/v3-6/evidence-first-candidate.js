import {feedbackContract, MODEL_CONTRACT_VERSION} from '../../src/model-contracts.js';
import {validateFeedback} from '../../src/domain.js';

if (MODEL_CONTRACT_VERSION !== '3.3.0') throw Error('Rebase the evidence-first candidate on the reviewed feedback contract');
const oldHeader = 'Contract version 3.3.0. Return JSON exactly {ratings,strength,priorityImprovement}.';
if (!feedbackContract.startsWith(oldHeader)) throw Error('The reviewed feedback contract shape changed');

export const CANDIDATE_CONTRACT_VERSION = '3.6.0';
export const candidateFeedbackContract = `Contract version ${CANDIDATE_CONTRACT_VERSION}. Return JSON exactly {decisionEvidence,ratings,strength,priorityImprovement}.` + feedbackContract.slice(oldHeader.length) + ` Before assigning each rating, fill decisionEvidence from the question and transcript. It has exactly relevance, support, structure, englishExpression, and every field must reflect the actual cited text, not an invented inference. Relevance has exactly {coverage,questionPartQuotes,answerQuotes,missingPartQuotes}: coverage is all, core-only, related-only, or none, mapping to levels 4, 3, 2, 1 respectively; questionPartQuotes and missingPartQuotes are arrays of exact contiguous question-text spans, and answerQuotes is an array of exact contiguous transcript spans. A promised future explanation is not an explanation already given. Level 4 has no missing requested part; level 3 has at least one answered and one missing part; level 1 has no answering span. Support has exactly {basis,pointQuote,supportQuote,reasoningLink}: basis is reasoned, concrete, bare-or-adjacent, or none, mapping to levels 4, 3, 2, 1; pointQuote is an exact transcript span, supportQuote is an exact supporting transcript span or empty, and reasoningLink says how the evidence supports a question-related point or is empty. Level 4 requires defensible reasoning, evidence or trade-off, not complete task coverage; level 3 requires a concrete question-related action or example. Structure has exactly {organization,spanQuotes,linkType,advancement}: organization is developed, thin, weak, or none, mapping to levels 4, 3, 2, 1; spanQuotes are one to three exact transcript spans; linkType is causal, contrastive, stepwise, simple-reason, related, weak, or none; advancement states how a later move tests, narrows, qualifies or acts on an earlier move, or is empty. Level 4 requires at least two linked spans, a causal/contrastive/stepwise relation, and a substantive advancement. A simple claim plus reason or two related safeguards with only a local reason is level 3. Missing requested content, outcome, factual credibility and language polish never lower structure. English expression has exactly {impact,issueQuote,issue}: impact is none, noticeable-no-barrier, key-meaning-barrier, or largely-unintelligible, mapping to levels 4, 3, 2, 1; issueQuote is an exact transcript span when impact is not none and otherwise empty; issue names the wording problem or is empty. Unsupported content and task fit are never English issues. Each rating's level must equal its decisionEvidence category. A decisionEvidence quote supplements, but never replaces, the rating's original exact quote. Write one assessment, then render English and Traditional-Chinese coaching from it without changing actor, action, certainty, completed-versus-planned timing, limitation or advice.`;

const text = {type: 'string', minLength: 1};
const string = {type: 'string'};
const object = properties => ({type: 'object', properties, required: Object.keys(properties), additionalProperties: false});
const list = (items, minItems = 0, maxItems) => ({type: 'array', items, minItems, ...(maxItems ? {maxItems} : {})});
const choice = values => ({type: 'string', enum: values});
const rating = object({level: {type: 'integer', minimum: 1, maximum: 4}, quote: text, reason: text, reasonZh: text});
const finding = object({text, textZh: text, quote: text});

export const candidateFeedbackSchema = object({
  decisionEvidence: object({
    relevance: object({coverage: choice(['all', 'core-only', 'related-only', 'none']), questionPartQuotes: list(text, 1), answerQuotes: list(text), missingPartQuotes: list(text)}),
    support: object({basis: choice(['reasoned', 'concrete', 'bare-or-adjacent', 'none']), pointQuote: text, supportQuote: string, reasoningLink: string}),
    structure: object({organization: choice(['developed', 'thin', 'weak', 'none']), spanQuotes: list(text, 1, 3), linkType: choice(['causal', 'contrastive', 'stepwise', 'simple-reason', 'related', 'weak', 'none']), advancement: string}),
    englishExpression: object({impact: choice(['none', 'noticeable-no-barrier', 'key-meaning-barrier', 'largely-unintelligible']), issueQuote: string, issue: string})
  }),
  ratings: object({relevance: rating, support: rating, structure: rating, englishExpression: rating}),
  strength: finding,
  priorityImprovement: finding
});

const levels = {
  relevance: {'all': 4, 'core-only': 3, 'related-only': 2, 'none': 1},
  support: {'reasoned': 4, 'concrete': 3, 'bare-or-adjacent': 2, 'none': 1},
  structure: {'developed': 4, 'thin': 3, 'weak': 2, 'none': 1},
  englishExpression: {'none': 4, 'noticeable-no-barrier': 3, 'key-meaning-barrier': 2, 'largely-unintelligible': 1}
};
const exact = (source, quote) => typeof quote === 'string' && quote.length > 0 && source.includes(quote);
const quotes = (source, values) => Array.isArray(values) && values.every(value => exact(source, value));
const fields = (value, names) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
const requireEvidence = (condition, path) => { if (!condition) throw Error(`Invalid candidate decision evidence: ${path}`); };

export function validateCandidateFeedback(value, question, transcript) {
  requireEvidence(fields(value, ['decisionEvidence', 'ratings', 'strength', 'priorityImprovement']), 'feedback shape');
  const feedback = validateFeedback({ratings: value.ratings, strength: value.strength, priorityImprovement: value.priorityImprovement}, transcript);
  const evidence = value.decisionEvidence;
  requireEvidence(fields(evidence, ['relevance', 'support', 'structure', 'englishExpression']), 'dimensions');
  const questionText = typeof question === 'string' ? question : question?.text;
  requireEvidence(typeof questionText === 'string' && questionText.length > 0, 'question');
  const relevance = evidence.relevance;
  requireEvidence(fields(relevance, ['coverage', 'questionPartQuotes', 'answerQuotes', 'missingPartQuotes']), 'relevance shape');
  requireEvidence(Object.hasOwn(levels.relevance, relevance.coverage) && feedback.ratings.relevance.level === levels.relevance[relevance.coverage], 'relevance level');
  requireEvidence(Array.isArray(relevance.questionPartQuotes) && relevance.questionPartQuotes.length > 0 && quotes(questionText, relevance.questionPartQuotes), 'relevance question quotes');
  requireEvidence(quotes(transcript, relevance.answerQuotes) && quotes(questionText, relevance.missingPartQuotes), 'relevance answer or missing quotes');
  requireEvidence(relevance.coverage !== 'all' || relevance.missingPartQuotes.length === 0, 'relevance all coverage');
  requireEvidence(relevance.coverage !== 'core-only' || relevance.answerQuotes.length > 0 && relevance.missingPartQuotes.length > 0, 'relevance partial coverage');
  requireEvidence(relevance.coverage === 'none' || relevance.answerQuotes.length > 0, 'relevance stated answer');
  requireEvidence(relevance.coverage !== 'none' || relevance.answerQuotes.length === 0, 'relevance absent answer');
  const support = evidence.support;
  requireEvidence(fields(support, ['basis', 'pointQuote', 'supportQuote', 'reasoningLink']), 'support shape');
  requireEvidence(Object.hasOwn(levels.support, support.basis) && feedback.ratings.support.level === levels.support[support.basis], 'support level');
  requireEvidence(exact(transcript, support.pointQuote), 'support point quote');
  requireEvidence(support.supportQuote === '' || exact(transcript, support.supportQuote), 'support detail quote');
  requireEvidence(typeof support.reasoningLink === 'string', 'support reasoning');
  requireEvidence(!['reasoned', 'concrete'].includes(support.basis) || support.supportQuote !== '', 'support concrete evidence');
  requireEvidence(support.basis !== 'reasoned' || support.reasoningLink.trim() !== '', 'support reasoned link');
  const structure = evidence.structure;
  requireEvidence(fields(structure, ['organization', 'spanQuotes', 'linkType', 'advancement']), 'structure shape');
  requireEvidence(Object.hasOwn(levels.structure, structure.organization) && feedback.ratings.structure.level === levels.structure[structure.organization], 'structure level');
  requireEvidence(Array.isArray(structure.spanQuotes) && structure.spanQuotes.length >= 1 && structure.spanQuotes.length <= 3 && quotes(transcript, structure.spanQuotes), 'structure spans');
  requireEvidence(['causal', 'contrastive', 'stepwise', 'simple-reason', 'related', 'weak', 'none'].includes(structure.linkType) && typeof structure.advancement === 'string', 'structure relationship');
  requireEvidence(structure.organization !== 'developed' || new Set(structure.spanQuotes).size >= 2 && ['causal', 'contrastive', 'stepwise'].includes(structure.linkType) && structure.advancement.trim() !== '', 'structure developed link');
  requireEvidence(structure.organization !== 'thin' || ['simple-reason', 'related'].includes(structure.linkType), 'structure thin link');
  requireEvidence(structure.organization !== 'weak' || structure.linkType === 'weak', 'structure weak link');
  requireEvidence(structure.organization !== 'none' || structure.linkType === 'none', 'structure absent link');
  const expression = evidence.englishExpression;
  requireEvidence(fields(expression, ['impact', 'issueQuote', 'issue']), 'English expression shape');
  requireEvidence(Object.hasOwn(levels.englishExpression, expression.impact) && feedback.ratings.englishExpression.level === levels.englishExpression[expression.impact], 'English expression level');
  requireEvidence(expression.impact === 'none' ? expression.issueQuote === '' && expression.issue === '' : exact(transcript, expression.issueQuote) && typeof expression.issue === 'string' && expression.issue.trim() !== '', 'English expression issue');
  return {decisionEvidence: evidence, ...feedback};
}
