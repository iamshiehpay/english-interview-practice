// App-authored practice prompts are served with a Question Set, but never stored
// in its model-generated analysis or sent through the analysis validator.
export const commonQuestions = Object.freeze([
  Object.freeze({
    id: 'self-introduction',
    text: 'Tell me about yourself.',
    meaningZh: '請用一到兩分鐘介紹自己：你的背景、和這個職位相關的經驗，以及為什麼想應徵。',
    rationale: 'Practise a concise introduction that connects your background and relevant experience to this role. This is a common practice question, not a question from the employer.',
    rationaleZh: '練習簡潔地介紹背景，連結與職位相關的經驗和應徵動機。這是常見練習題，不是雇主提供的題目。',
    category: 'role-fit',
    capabilityIds: [],
    source: 'common',
    group: 'self-introduction'
  })
]);

const commonQuestionIds = new Set(commonQuestions.map(question => question.id));

export const hasCommonQuestionIdCollision = analysis =>
  analysis?.questions?.some(question => commonQuestionIds.has(question.id)) ?? false;

export function questionInSet(analysis, questionId) {
  if (!analysis?.questions?.length) return undefined;
  return commonQuestions.find(question => question.id === questionId) ?? analysis.questions.find(question => question.id === questionId);
}
