import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness,setup} from './helpers.js';
import {FakeLanguageModel} from '../src/providers.js';
test('legacy resume claims stay source-linked and unverified until explicit approval; rejected claims never personalize',async t=>{
 const provider=new FakeLanguageModel(),feedback=provider.feedback.bind(provider);let sent;
 provider.feedback=async args=>{sent=args.approvedEvidence;return feedback(args);};const {api,store}=await harness(t,provider);const {snapshot,analysis,record}=await setup(api);delete store.data.snapshots[snapshot.id].practiceVersion;
 const imported=(await api('/evidence/import',{text:'Built a Python API for a class project.\nCollaborated on API tests.'})).data;
 assert.ok(imported.claims.every(c=>c.status==='unverified'&&imported.source.text.includes(c.excerpt)));
 assert.equal((await api(`/records/${record.id}/evidence-context`)).data.approvedEvidence.length,0);
 const first=imported.claims[0];await api(`/evidence/${first.id}`,{status:'approved',capabilityLinks:[{snapshotId:snapshot.id,capabilityId:analysis.capabilities[0].id}]});await api(`/evidence/${imported.claims[1].id}`,{status:'rejected'});
 const context=(await api(`/records/${record.id}/evidence-context`)).data;assert.equal(context.approvedEvidence.length,1);assert.equal(context.approvedEvidence[0].excerpt,first.excerpt);
 await api(`/records/${record.id}/attempts`,{transcript:'I built a different service last year.'});const r=(await api(`/records/${record.id}/feedback`,{})).data;
 assert.equal(sent.length,1);assert.equal(sent[0].excerpt,first.excerpt);assert.ok(r.attempts[0].feedback.priorityImprovement.text.includes('approved experience'));
 const claimId=r.attempts[0].unverifiedClaimIds[0];assert.equal((await api('/evidence')).data.claims[claimId].status,'unverified');
 await api(`/evidence/${claimId}`,{status:'approved',capabilityLinks:[]});assert.equal((await api('/evidence')).data.claims[claimId].status,'approved');
 assert.equal((await api(`/snapshots/${snapshot.id}/analysis`)).data.questions.length,9);
});
test('legacy absent profile and rejected statements leave every gap question practiceable',async t=>{
 const {api,store}=await harness(t);const {snapshot,record}=await setup(api);delete store.data.snapshots[snapshot.id].practiceVersion;const context=(await api(`/records/${record.id}/evidence-context`)).data;assert.equal(context.approvedEvidence.length,0);assert.ok(context.experienceGaps.length);assert.equal(context.gapGuidance.length,4);
 await api(`/records/${record.id}/attempts`,{transcript:'I built a prototype.'});const r=(await api(`/records/${record.id}/feedback`,{})).data;assert.equal(r.attempts[0].feedback.ratings.support.level,2);
 const id=r.attempts[0].unverifiedClaimIds[0];await api(`/evidence/${id}`,{status:'rejected'});assert.equal((await api('/evidence')).data.claims[id].status,'rejected');
 assert.equal((await api(`/snapshots/${snapshot.id}/analysis`)).data.questions.length,9);
});
test('approval requires valid capability links and never rewrites source claims',async t=>{
 const {api,store}=await harness(t);const imported=(await api('/evidence/import',{text:'Developed a prototype.'})).data;const claim=imported.claims[0];
 assert.equal((await api(`/evidence/${claim.id}`,{status:'approved',capabilityLinks:[{snapshotId:'missing',capabilityId:'c1'}]})).status,400);
 assert.equal((await api('/evidence')).data.claims[claim.id].status,'unverified');
 await api(`/evidence/${claim.id}`,{status:'approved',excerpt:'Invented metrics'});assert.equal((await api('/evidence')).data.claims[claim.id].excerpt,'Developed a prototype.');
});
test('same capability IDs across jobs cannot leak approval and hypothetical statements are not personal history',async t=>{
 const {api,store}=await harness(t);const first=await setup(api),second=await setup(api);delete store.data.snapshots[first.snapshot.id].practiceVersion;delete store.data.snapshots[second.snapshot.id].practiceVersion;
 const claim=(await api('/evidence/import',{text:'Built a Python API.'})).data.claims[0];
 await api(`/evidence/${claim.id}`,{status:'approved',capabilityLinks:[{snapshotId:first.snapshot.id,capabilityId:'c1'}]});
 assert.equal((await api(`/records/${first.record.id}/evidence-context`)).data.approvedEvidence.length,1);
 assert.equal((await api(`/records/${second.record.id}/evidence-context`)).data.approvedEvidence.length,0);
 const r=(await api(`/records/${second.record.id}/attempts`,{transcript:'I would test the API. We might compare options.'})).data;assert.deepEqual(r.attempts[0].unverifiedClaimIds,[]);
});
