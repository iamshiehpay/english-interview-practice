import {createHash} from 'node:crypto';
import {requireValue} from './domain.js';
const normalize = text => text.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}]+/gu,' ').replace(/\s+/g,' ').trim();
export function progressView(data) {
  const groups=new Map();
  for(const r of Object.values(data.records)){
    if(r.status!=='completed'||!r.focusPoint)continue;
    const key=normalize(r.focusPoint);if(!key)continue;
    const id=createHash('sha256').update(key).digest('hex');
    if(!groups.has(id))groups.set(id,{id,focusPoint:r.focusPoint,evidence:[]});
    groups.get(id).evidence.push({recordId:r.id,snapshotId:r.snapshotId,questionId:r.question.id,questionText:r.question.text,completedAt:r.completedAt,category:r.question.category,capabilityIds:r.question.capabilityIds,focusPoint:r.focusPoint,priorityImprovement:r.attempts.at(-1).feedback.priorityImprovement.text,quote:r.attempts.at(-1).feedback.priorityImprovement.quote});
  }
  return [...groups.values()].map(group=>{
    const decision=data.progressDecisions?.[group.id];
    const recurring=!decision?.rejected && (decision?.confirmed===true || group.evidence.length>=2);
    return {...group,recurring,confirmed:decision?.confirmed===true,rejected:decision?.rejected===true,status:recurring?(decision?.status||'active'):null,history:decision?.history||[]};
  });
}
export function cleanDerivedState(data) {
  const valid=new Set(progressView(data).map(p=>p.id));
  for(const id of Object.keys(data.progressDecisions||{}))if(!valid.has(id))delete data.progressDecisions[id];
}
export function decideProgress(data,id,input) {
  const pattern=progressView(data).find(p=>p.id===id);requireValue(pattern,'Focus Point not found',404);
  requireValue(['confirm','reject','status'].includes(input.action),'Choose confirm, reject or status');
  data.progressDecisions??={};const decision=data.progressDecisions[id]??{confirmed:false,rejected:false,status:'active',history:[]};
  if(input.action==='confirm'){decision.confirmed=true;decision.rejected=false;}
  if(input.action==='reject'){decision.confirmed=false;decision.rejected=true;}
  if(input.action==='status'){requireValue(pattern.recurring,'Confirm a one-off Focus Point before changing recurring status',409);requireValue(['active','improving','resolved'].includes(input.status),'Invalid progress status');decision.status=input.status;}
  decision.history.push({action:input.action,status:decision.status,at:new Date().toISOString()});data.progressDecisions[id]=decision;
  return progressView(data).find(p=>p.id===id);
}
export function removeRecord(data,id) {
  requireValue(data.records[id],'Practice Record not found',404);delete data.records[id];
  for(const [claimId,claim]of Object.entries(data.evidenceClaims||{}))if(claim.recordId===id)delete data.evidenceClaims[claimId];
  cleanDerivedState(data);return {deleted:id};
}
export function recommendWithFocus(view,data,snapshotId) {
  const active=progressView(data).filter(p=>!p.rejected && data.progressDecisions?.[p.id]?.status!=='resolved');
  if(!active.length)return view;
  const score=q=>active.filter(p=>p.evidence.some(e=>(e.snapshotId===snapshotId&&e.capabilityIds.some(id=>q.capabilityIds.includes(id)))||e.category===q.category)).length;
  const sorted=[...view.questions].sort((a,b)=>score(b)-score(a)||view.history[a.id].length-view.history[b.id].length);
  if(score(sorted[0])>0)view.recommendation={questionId:sorted[0].id,reason:'Practise a capability or category linked to an unresolved Focus Point; choose any other question if you prefer.', reasonZh:'優先練習與尚未解決的練習重點相關的能力或題型；你也可以選擇其他題目。'};
  return view;
}
