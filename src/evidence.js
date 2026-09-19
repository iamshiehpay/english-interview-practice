import {randomUUID} from 'node:crypto';
import {requireValue, nonempty, gapGuidance} from './domain.js';
export function importResume(data, text) {
  requireValue(nonempty(text) && text.length <= 100000,'Paste plain-text resume content (up to 100,000 characters)');
  const excerpts=[...new Set(text.split(/\n/).map(s=>s.trim()).filter(Boolean))];
  requireValue(excerpts.length<=100 && excerpts.every(s=>s.length<=2000),'Import up to 100 lines, each at most 2,000 characters');
  requireValue(Object.keys(data.evidenceSources||{}).length<20 && Object.keys(data.evidenceClaims||{}).length+excerpts.length<=1000,'Evidence capacity reached; remove local data before importing more');
  data.evidenceSources ??= {};data.evidenceClaims ??= {};
  const source={id:randomUUID(),type:'resume-text',text,importedAt:new Date().toISOString()};data.evidenceSources[source.id]=source;
  const claims=excerpts.map(excerpt=>({id:randomUUID(),sourceId:source.id,sourceType:'resume-text',excerpt,status:'unverified',capabilityLinks:[]}));
  for(const claim of claims)data.evidenceClaims[claim.id]=claim;
  return {source,claims};
}
export function captureAnswerClaims(data, record, attempt) {
  data.evidenceClaims ??= {};
  const candidates=attempt.transcript.split(/(?<=[.!?])\s+|\n/).map(s=>s.trim()).filter(s=>s && /\b(?:I|my|we|our)\b|我/i.test(s) && !/\b(?:would|could|might|will|hypothetically)\b/i.test(s)).slice(0,20);
  const claims=[];
  for(const excerpt of candidates){
    if(excerpt.length>2000 || Object.keys(data.evidenceClaims).length>=1000)continue;
    if(Object.values(data.evidenceClaims).some(c=>c.excerpt===excerpt && c.status==='approved'))continue;
    const claim={id:randomUUID(),sourceId:attempt.id,sourceType:'answer-attempt',recordId:record.id,excerpt,status:'unverified',capabilityLinks:[]};
    data.evidenceClaims[claim.id]=claim;claims.push(claim.id);
  }
  attempt.unverifiedClaimIds=claims;
}
export function decideClaim(data, id, input) {
  const claim=Object.hasOwn(data.evidenceClaims||{},id)?data.evidenceClaims[id]:undefined;requireValue(claim,'Claim not found',404);
  requireValue(['approved','rejected'].includes(input.status),'Explicitly approve or reject this statement');
  const links=input.capabilityLinks||[];requireValue(Array.isArray(links)&&links.length<=20,'Select valid capability links');
  for(const link of links)requireValue(link && typeof link.snapshotId==='string' && data.analyses[link.snapshotId]?.capabilities.some(c=>c.id===link.capabilityId),'Unknown capability link');
  claim.status=input.status;claim.capabilityLinks=input.status==='approved'?links.map(({snapshotId,capabilityId})=>({snapshotId,capabilityId})):[];claim.reviewedAt=new Date().toISOString();
  return claim;
}
export function evidenceContext(data, snapshotId, capabilityIds) {
  const approved=Object.values(data.evidenceClaims||{}).filter(c=>c.status==='approved'&&c.capabilityLinks.some(l=>l.snapshotId===snapshotId&&capabilityIds.includes(l.capabilityId)));
  const gaps=capabilityIds.filter(id=>!approved.some(c=>c.capabilityLinks.some(l=>l.snapshotId===snapshotId&&l.capabilityId===id)));
  return {approvedEvidence:approved.slice(0,10).map(c=>({id:c.id,excerpt:c.excerpt,sourceId:c.sourceId,sourceType:c.sourceType})),experienceGaps:gaps,gapGuidance,notice:'A gap means no approved evidence is linked here, not that you lack the ability. Every question remains available. Unverified statements are not treated as false.'};
}
