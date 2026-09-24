// The application serves app-authored Common Questions beside model output.
// Evaluation checks only the model-generated analysis that the suite was built for.
export function jobGroundedAnalysis(served) {
  return {
    capabilities: served.capabilities,
    questions: served.questions.filter(question => question.source !== 'common')
  };
}
