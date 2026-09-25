export const ratingDimensions = ['relevance', 'support', 'structure', 'englishExpression'];

export function orderedPilotSlots(packet) {
  return [1, 2].flatMap(repeat => packet.map(item => ({caseId: item.caseId, repeat})));
}

export function ratingMisses(feedback, ranges) {
  return ratingDimensions.filter(dimension => {
    const level = feedback.ratings[dimension].level;
    return level < ranges[dimension][0] || level > ranges[dimension][1];
  });
}
