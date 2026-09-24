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
  }),
  Object.freeze({
    id: 'common-behavioral-conflict',
    text: 'Tell me about a time you disagreed with a teammate. How did you handle it?',
    meaningZh: '說一次你和隊友意見不同的經驗：你怎麼處理、結果如何？',
    rationale: 'Practise explaining a real disagreement and how you listened and resolved it. STAR: Situation, Task, Action, Result.',
    rationaleZh: '練習說明真實的意見分歧、你如何傾聽與化解。STAR：情境、任務、行動、結果。',
    category: 'behavioral', capabilityIds: [], source: 'common', group: 'behavioral'
  }),
  Object.freeze({
    id: 'common-behavioral-failure',
    text: 'Tell me about a time you made a mistake or failed. What did you learn?',
    meaningZh: '說一次你犯錯或失敗的經驗：你從中學到什麼、之後怎麼改進？',
    rationale: 'Practise owning a real mistake and describing what changed afterward. STAR: Situation, Task, Action, Result.',
    rationaleZh: '練習坦誠說明真實的失誤，以及後來如何改進。STAR：情境、任務、行動、結果。',
    category: 'behavioral', capabilityIds: [], source: 'common', group: 'behavioral'
  }),
  Object.freeze({
    id: 'common-behavioral-deadline',
    text: 'Tell me about a time you had to deliver under a tight deadline. How did you prioritise?',
    meaningZh: '說一次在很緊的期限內交付的經驗：你怎麼排優先順序、取捨了什麼？',
    rationale: 'Practise showing a real prioritisation decision and its trade-offs. STAR: Situation, Task, Action, Result.',
    rationaleZh: '練習說明真實的優先順序決策與取捨。STAR：情境、任務、行動、結果。',
    category: 'behavioral', capabilityIds: [], source: 'common', group: 'behavioral'
  }),
  Object.freeze({
    id: 'common-behavioral-ownership',
    text: 'Tell me about a time you took ownership of a problem that was not assigned to you.',
    meaningZh: '說一次你主動承擔不屬於你分內的問題：你為什麼出手、做了什麼、結果如何？',
    rationale: 'Practise explaining why you stepped in, what you actually did, and the outcome. STAR: Situation, Task, Action, Result.',
    rationaleZh: '練習說明你為何主動承擔、實際做了什麼，以及結果。STAR：情境、任務、行動、結果。',
    category: 'behavioral', capabilityIds: [], source: 'common', group: 'behavioral'
  }),
  Object.freeze({
    id: 'common-behavioral-learning',
    text: 'Tell me about a time you had to learn a new technology quickly. How did you approach it?',
    meaningZh: '說一次你必須快速學會新技術的經驗：你怎麼學、怎麼確認自己真的會用？',
    rationale: 'Practise describing how you learned and validated a new skill in a real situation. STAR: Situation, Task, Action, Result.',
    rationaleZh: '練習說明真實情境中你如何學習新技術並驗證成果。STAR：情境、任務、行動、結果。',
    category: 'behavioral', capabilityIds: [], source: 'common', group: 'behavioral'
  })
]);

const commonQuestionIds = new Set(commonQuestions.map(question => question.id));

export const hasCommonQuestionIdCollision = analysis =>
  analysis?.questions?.some(question => commonQuestionIds.has(question.id)) ?? false;

export function questionInSet(analysis, questionId) {
  if (!analysis?.questions?.length) return undefined;
  return commonQuestions.find(question => question.id === questionId) ?? analysis.questions.find(question => question.id === questionId);
}
