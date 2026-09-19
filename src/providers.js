import {dimensions, categories} from './domain.js';
import {MODEL_CONTRACT_VERSION} from './model-contracts.js';

// Shorten a posting line into a realistic citation: a single sentence or the
// first ~90 characters ending on a word boundary. The result stays a verbatim
// prefix of the trimmed line, so it remains a substring of the Job Snapshot
// text (grounding/citation validation) and is non-empty.
function citation(line) {
  const text = String(line).trim();
  const sentence = text.match(/^.{1,90}?[.!?。！？]/su);
  let excerpt = sentence ? sentence[0] : text;
  if (excerpt.length > 90) {
    const clipped = excerpt.slice(0, 90);
    const boundary = clipped.lastIndexOf(' ');
    excerpt = (boundary > 40 ? clipped.slice(0, boundary) : clipped).trim();
  }
  return excerpt || text;
}

// Providers implement analyze({snapshot}) and feedback({question, transcript}).
// Pre-revision analyze/feedback must contain only questions, evidence and coaching,
// never a full sample/model/reference answer (including within free-text fields).
// Personalization must use only supplied approved excerpts. Never invent metrics,
// employers, ownership or outcomes; unlisted candidate statements remain unverified.
// The fake is deliberately labelled: it tests workflow, not model quality.
export class FakeLanguageModel {
  name = 'Deterministic demonstration provider';
  contractVersion = MODEL_CONTRACT_VERSION;
  async analyze({snapshot}) {
    const lines = snapshot.text.split(/\n/).filter(s => s.trim()).slice(0, 4);
    const capabilities = lines.map((line, i) => {const evidence = citation(line); return {id: `c${i + 1}`, description: evidence, evidence, kind: 'fact'};});
    const questions = this.makeQuestions(capabilities, 0, 8);
    if (snapshot.resume?.text) {
      const excerpt = snapshot.resume.text.split('\n').find(s => s.trim()).slice(0, 160);
      questions[1].text = `Your resume mentions “${excerpt}”. How would you connect that background to this role?`;
      questions[1].meaningZh = `你的履歷提到「${excerpt}」，你會如何將這段背景連結到這個職位？`;
    }
    return {capabilities, questions};
  }
  makeQuestions(capabilities, offset, count) {
    const prompts = [
      'Why does this responsibility interest you, and what would you aim to learn?',
      'Describe a relevant project or an honest hypothetical approach.',
      'How would you handle disagreement with a teammate about this work?',
      'Explain an approach and its trade-offs to a non-specialist.',
      'How does this responsibility connect to your career direction?',
      'Walk through a difficult decision in a related project, or a hypothetical example.',
      'How would you prioritize this work under a tight deadline?',
      'What assumptions and failure cases would you test for this responsibility?',
      'What would you ask the team before deciding whether this role fits?',
      'How would you validate the outcome of related work without overstating your contribution?',
      'How would you respond if a colleague found an error in your approach?',
      'Compare two possible approaches and explain when you would choose each.'
    ];
    const meaningsZh = [
      '這項職責為什麼吸引你？你希望從中學到什麼？',
      '請描述一個相關專案，或誠實說明你會採取的假設性做法。',
      '如果你和團隊成員對這項工作有不同意見，你會如何處理？',
      '請向非專業人士說明一種做法及其取捨。',
      '這項職責如何連結你的職涯方向？',
      '請說明相關專案中的一項艱難決策，或提供一個假設性例子。',
      '在期限緊迫時，你會如何安排這項工作的優先順序？',
      '針對這項職責，你會檢驗哪些假設與失敗情境？',
      '在判斷這個職位是否適合前，你會向團隊詢問什麼？',
      '你會如何驗證相關工作的成果，同時不誇大自己的貢獻？',
      '如果同事發現你的做法有錯誤，你會如何回應？',
      '請比較兩種可能的做法，並說明各自適用的時機。'
    ];
    return Array.from({length: count}, (_, i) => {
      const n = offset + i, c = capabilities[n % capabilities.length];
      return {id: `q${n + 1}`, text: `${prompts[n % prompts.length]} Focus: ${c.evidence}${n >= prompts.length ? ` Consider scenario ${Math.floor(n / prompts.length) + 1}: limited time and incomplete information.` : ''}`, meaningZh:`${meaningsZh[n % meaningsZh.length]} 重點：${c.evidence}${n >= prompts.length ? ` 情境 ${Math.floor(n / prompts.length) + 1}：時間有限且資訊不完整。` : ''}`, category: categories[n % 4], capabilityIds: [c.id], evidence: c.evidence, rationale: 'Coach-generated practice linked to the quoted posting responsibility; review its relevance before practising.', rationaleZh:'這是教練根據引述的職缺職責產生的練習題；請在練習前確認其相關性。'};
    });
  }
  async additionalQuestions({analysis}) {
    return {capabilities: analysis.capabilities, questions: [...analysis.questions, ...this.makeQuestions(analysis.capabilities, analysis.questions.length, 4)]};
  }
  async coach({question,transcript,mode}) {
    if (['hint','gap'].includes(mode)) return {text:`針對「${question.meaningZh || question.text}」，${mode === 'gap' ? '用「如果遇到這個情境，我會…」開始，說明第一步與理由。' : '先選一個具體情境，說出你的第一個決定與理由。'}`,explanationZh:'這是本機示範提示；實質建議需要設定模型服務。'};
    return {text: /[A-Za-z]/.test(transcript || '') ? transcript : 'Demonstration only: configure a model provider for English assistance.', explanationZh:'本機示範不會實際翻譯或改寫，請設定模型服务。'};
  }
  async followUp({primaryAnswer, previousFollowUps = []}) {
    if (previousFollowUps.length) return {text:'What trade-off would you revisit after seeing the result of that decision?',meaningZh:'看到那項決定的結果後，你會重新考量哪個取捨？'};
    const mentionedTesting=/test|validat/i.test(primaryAnswer.transcript);
    return mentionedTesting
      ? {text:'Which failure case would you test first, and why?',meaningZh:'你會先測試哪一種失敗情境？為什麼？'}
      : {text:'What is the most important assumption behind that approach?',meaningZh:'這個做法背後最重要的假設是什麼？'};
  }
  async feedback({transcript, approvedEvidence = []}) {
    const quote = transcript.slice(0, 160);
    return {ratings: Object.fromEntries(dimensions.map(d => [d, {level: 2, quote, reason: 'Demonstration rating only; configure a model provider for substantive coaching.', reasonZh:'這只是示範評分；請設定模型供應商以取得實質回饋。'}])), strength: {text: 'You supplied an answer to review.', textZh:'你提供了一段可供檢視的回答。', quote}, priorityImprovement: {text: approvedEvidence.length ? 'If relevant, connect your reasoning to the approved experience shown beside this question. Use only details you can defend.' : 'Explain one concrete example or trade-off supporting your approach.', textZh:approvedEvidence.length?'若相關，請把你的推理連結到此題旁已核准的經驗，且只使用你能在面試中證明的細節。':'請說明一個支持你做法的具體例子或取捨。', quote}};
  }
}
