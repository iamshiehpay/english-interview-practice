import {practiceResume, extractResume} from './resume.js';
import {Operations} from './operations.js';
import {configuredProviders} from './cloud.js';
import {progressView, decideProgress, cleanDerivedState, removeRecord, recommendWithFocus} from './progress.js';
import {importResume, captureAnswerClaims, decideClaim, evidenceContext} from './evidence.js';
import {FakeJobSource, GreenhouseJobSource, profileFields, validateProfile, matchingJobs, boundedSource} from './jobs.js';
import http from 'node:http';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, join} from 'node:path';
import {FakeSpeechProvider, clearTemporaryAudio, transcribeTemporary} from './speech.js';
import {LocalWorkspace} from './store.js';
import {FakeLanguageModel} from './providers.js';
import {AppError, requireValue, nonempty, validateAnalysis, validateFeedback, validateCoaching, validateFollowUp, dimensions, questionSetView} from './domain.js';

async function body(req, limit = 1000000) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; requireValue(raw.length <= limit, 'Request too large', 413); }
  try { const value=raw?JSON.parse(raw):{};requireValue(value && typeof value==='object' && !Array.isArray(value),'Expected JSON object');return value; } catch { throw new AppError('Invalid JSON object'); }
}
export async function createApplication({directory = '.workspace', languageModel = new FakeLanguageModel(), speechProvider = new FakeSpeechProvider(), jobSource = new FakeJobSource(), sourceTimeoutMs = 10000, operationTimeoutMs = 30000} = {}) {
  requireValue(Number.isFinite(operationTimeoutMs) && operationTimeoutMs >= 10 && operationTimeoutMs <= 120000, 'Operation timeout must be between 10 and 120000 milliseconds');
  const store = await new LocalWorkspace(directory).open();
  const operations = new Operations(store, operationTimeoutMs);
  await operations.recover();
  const audioDirectory = join(directory, 'temporary-audio');
  await clearTemporaryAudio(audioDirectory);
  const item = (collection, id) => { const value = Object.hasOwn(store.data[collection],id) ? store.data[collection][id] : undefined; requireValue(value, 'Not found', 404); return structuredClone(value); };
  async function route(method, path, input, context) {
    const commit = update => store.transact(d => {context?.check(d);const result=update(d);context?.complete(d,result);return result;});
    if (method === 'GET' && path === '/api/health') return {status: 'ok', languageModel: languageModel.name, speechProvider: speechProvider.name, jobSource: jobSource.name};
    if (method === 'GET' && path === '/api/workspace') {const {operations: omitted, operationReceipts: omittedReceipts, ...data} = store.data;return data;}
    if (method === 'GET' && path === '/api/operations') return Object.values(store.data.operations || {});
    const cancel = path.match(/^\/api\/operations\/([^/]+)\/cancel$/);
    if (method === 'POST' && cancel) return operations.cancel(cancel[1]);
    if (method === 'GET' && path === '/api/providers/language-status') return languageModel.status ? languageModel.status() : {provider:languageModel.name,authenticated:null,loginRequired:false};
    if (method === 'GET' && path === '/api/providers') return {languageModel:{name:languageModel.name,subscription:!!languageModel.status,external:!!languageModel.external,outbound:languageModel.external?['JD text and selected resume for analysis','JD, selected resume and existing capability/question set for additions','current question and transcript for feedback or English assistance','primary question, frozen formal answer and completed follow-ups for follow-up generation']:[]},speech:{name:speechProvider.name,external:!!speechProvider.external,outbound:speechProvider.external?['recorded audio only']:[]},jobSource:{name:jobSource.name,external:!!jobSource.external,outbound:!!jobSource.external?['public board token and requested job ID; profile filtering stays local']:[]}};
    if (path === '/api/resume') {
      if (method === 'GET') return store.data.resume || null;
      if (method === 'POST') { const resume=practiceResume(input); return commit(d => (d.resume=resume)); }
      if (method === 'DELETE') return commit(d => {delete d.resume; return {deleted:'current-resume'};});
    }
    if (method === 'POST' && path === '/api/resume/extract') return extractResume(input);
    if (method === 'GET' && path === '/api/progress') return progressView(store.data);
    const progressMatch = path.match(/^\/api\/progress\/([^/]+)$/);
    if (method === 'POST' && progressMatch) return commit(d => decideProgress(d, progressMatch[1], input));
    if (method === 'POST' && path === '/api/workspace/delete') {
      requireValue(input.confirmation === 'DELETE ALL LOCAL DATA', 'Type DELETE ALL LOCAL DATA to confirm');
      await operations.cancelTarget();
      await clearTemporaryAudio(audioDirectory);
      return commit(d => {for (const key of Object.keys(d)) delete d[key]; Object.assign(d, {version:1,snapshots:{},analyses:{},records:{}}); return {deleted:'all'};});
    }
    if (method === 'GET' && path === '/api/evidence') return {sources: store.data.evidenceSources || {}, claims: store.data.evidenceClaims || {}};
    if (method === 'POST' && path === '/api/evidence/import') return commit(d => importResume(d, input.text));
    const claimMatch = path.match(/^\/api\/evidence\/([^/]+)$/);
    if (method === 'POST' && claimMatch) return commit(d => decideClaim(d, claimMatch[1], input));
    if (path === '/api/job-search-profile') {
      if (method === 'GET') return store.data.jobSearchProfile || Object.fromEntries(profileFields.map(k => [k, []]));
      if (method === 'POST') {const profile = validateProfile(input); return commit(d => (d.jobSearchProfile = profile));}
    }
    if (method === 'POST' && path === '/api/discovery') {
      const profile = store.data.jobSearchProfile || Object.fromEntries(profileFields.map(k => [k, []]));
      const results = matchingJobs(await boundedSource(() => jobSource.search({profile: structuredClone(profile), signal: context?.signal}), sourceTimeoutMs), profile);
      const run = {id: randomUUID(), capturedAt: new Date().toISOString(), source: jobSource.name, profile, results};
      return commit(d => {d.discoveryRuns ??= {}; d.discoveryRuns[run.id] = run; for (const id of Object.keys(d.discoveryRuns).slice(0, -3)) delete d.discoveryRuns[id]; return run;});
    }
    let selection = path.match(/^\/api\/discovery\/([^/]+)\/select$/);
    if (method === 'POST' && selection) {
      const run = store.data.discoveryRuns?.[selection[1]];
      const result = run?.results.find(r => r.id === input.resultId);
      requireValue(result, 'Select a result from a saved discovery run', 404);
      return commit(d => {
        const existing = Object.values(d.snapshots).find(s => s.discoveryRunId === run.id && s.resultId === result.id);
        if (existing) return existing;
        const snapshot = {id: randomUUID(), text: result.text, sourceType: 'job-source', sourceUrl: result.sourceUrl, source: result.source, capturedAt: run.capturedAt, selectedAt: new Date().toISOString(), discoveryRunId: run.id, resultId: result.id};
        d.snapshots[snapshot.id] = snapshot; return snapshot;
      });
    }
    if (method === 'POST' && path === '/api/snapshots/from-url') {
      requireValue(typeof jobSource.fetchUrl === 'function', 'This Job Source does not support URL intake; paste the JD.', 400);
      const result = await boundedSource(() => jobSource.fetchUrl(input.url, {signal: context?.signal}), sourceTimeoutMs);
      const [validated] = matchingJobs([result], Object.fromEntries(profileFields.map(k => [k, []])));
      const snapshot = {id: randomUUID(), text: validated.text, sourceType: 'job-source', sourceUrl: validated.sourceUrl, source: validated.source, capturedAt: new Date().toISOString()};
      return commit(d => (d.snapshots[snapshot.id] = snapshot));
    }
    if (method === 'POST' && path === '/api/snapshots') {
      requireValue(nonempty(input.text), 'Paste a job description');
      requireValue(input.text.length <= 100000, '職缺內容過長。');
      requireValue(input.useResume === undefined || typeof input.useResume === 'boolean', 'Invalid resume selection');
      requireValue(['standard','easier','deeper'].includes(input.difficulty || 'standard'), 'Invalid difficulty');
      const snapshot = {id: randomUUID(), text: input.text, sourceType: 'pasted-jd', capturedAt: new Date().toISOString(), practiceVersion:3, difficulty:input.difficulty || 'standard', resume:input.useResume === false ? null : structuredClone(store.data.resume || null)};
      return commit(d => (d.snapshots[snapshot.id] = snapshot));
    }
    let match = path.match(/^\/api\/snapshots\/([^/]+)(\/(?:analysis|questions))?$/);
    if (match) {
      const snapshot = item('snapshots', match[1]);
      if (method === 'GET' && !match[2]) return snapshot;
      if (method === 'DELETE' && !match[2]) {
        await operations.cancelTarget(snapshot.id);
        const recordIds = Object.values(store.data.records).filter(r => r.snapshotId === snapshot.id).map(r => r.id);
        for (const id of recordIds) await operations.cancelTarget(id);
        return commit(d => {for (const r of Object.values(d.records)) if (r.snapshotId===snapshot.id) removeRecord(d,r.id);delete d.snapshots[snapshot.id];delete d.analyses[snapshot.id];for (const c of Object.values(d.evidenceClaims||{})) c.capabilityLinks=c.capabilityLinks.filter(l=>l.snapshotId!==snapshot.id);cleanDerivedState(d);return {deleted:snapshot.id};});
      }
      const current = store.data.analyses[snapshot.id];
      const view = analysis => ({...recommendWithFocus(questionSetView(analysis, Object.values(store.data.records), snapshot.id), store.data, snapshot.id), evidenceContext: evidenceContext(store.data, snapshot.id, analysis.capabilities.map(c => c.id))});
      if (method === 'GET' && match[2] === '/analysis') {
        requireValue(current, 'Generate a Question Set first', 409);
        return view(current);
      }
      if (method === 'POST' && match[2] === '/analysis') {
        if (current?.questions.length >= 8) return view(current);
        const generated = await languageModel.analyze({snapshot: {text:snapshot.text,resume:snapshot.resume,difficulty:snapshot.difficulty}, signal: context?.signal});
        if (current) {
          generated.capabilities = [...current.capabilities, ...generated.capabilities.filter(c => !current.capabilities.some(old => old.id === c.id))];
          generated.questions = [...current.questions, ...generated.questions.filter(q => !current.questions.some(old => old.id === q.id))];
        }
        const analysis = validateAnalysis(generated, snapshot, {legacyQuestions: current?.questions ?? []});
        // Keep legacy question IDs and evidence so practice history remains linked.
        await commit(d => {
          requireValue(JSON.stringify(d.analyses[snapshot.id]) === JSON.stringify(current), 'Question Set changed; reload and retry', 409);
          d.analyses[snapshot.id] = analysis;
        });
        return view(analysis);
      }
      if (method === 'POST' && match[2] === '/questions') {
        requireValue(current?.questions.length >= 8, 'Generate an initial Question Set first', 409);
        requireValue(current.questions.length < 40, 'Question Set limit reached', 409);
        const analysis = validateAnalysis(await languageModel.additionalQuestions({snapshot: {text:snapshot.text,resume:snapshot.resume,difficulty:snapshot.difficulty}, analysis: structuredClone(current), signal: context?.signal}), snapshot, {expanded: true, legacyQuestions: current.questions});
        requireValue(analysis.questions.length > current.questions.length && analysis.questions.length <= 40 && analysis.questions.length <= current.questions.length + 4 && JSON.stringify(analysis.capabilities) === JSON.stringify(current.capabilities) && JSON.stringify(analysis.questions.slice(0, current.questions.length)) === JSON.stringify(current.questions), 'Invalid provider output: additions must preserve existing evidence and questions', 502);
        await commit(d => {
          requireValue(JSON.stringify(d.analyses[snapshot.id]) === JSON.stringify(current), 'Question Set changed; reload and retry', 409);
          d.analyses[snapshot.id] = analysis;
        });
        return view(analysis);
      }
    }
    if (method === 'POST' && path === '/api/records') {
      const snapshot = item('snapshots', input.snapshotId);
      const question = store.data.analyses[snapshot.id]?.questions.find(q => q.id === input.questionId);
      requireValue(question, 'Select a generated question');
      const record = {id: randomUUID(), snapshotId: snapshot.id, question: structuredClone(question), attempts: [], followUps: [], status: 'answer', createdAt: new Date().toISOString(), focusPoint: null};
      return commit(d => {requireValue(d.snapshots[snapshot.id] && d.analyses[snapshot.id]?.questions.some(q=>q.id===question.id),'Job Snapshot changed or was deleted',409);return d.records[record.id]=record;});
    }
    let followUpMatch = path.match(/^\/api\/records\/([^/]+)\/follow-ups(?:\/([^/]+)\/(attempt|feedback))?$/);
    if (followUpMatch) {
      const record = item('records', followUpMatch[1]);
      const followUps = Array.isArray(record.followUps) ? record.followUps : [];
      const followUpId = followUpMatch[2];
      const action = followUpMatch[3];
      if (method === 'POST' && !followUpId) {
        requireValue(record.status !== 'completed', 'Completed practice cannot add a follow-up', 409);
        requireValue(followUps.length < 2, 'This practice already has two follow-ups', 409);
        const latestPrimaryAttempt = record.attempts.at(-1);
        requireValue(latestPrimaryAttempt?.feedback, 'Complete primary answer feedback before asking a follow-up', 409);
        requireValue(followUps.every(node => node.status === 'completed' && node.attempt?.feedback), 'Complete the preceding follow-up feedback first', 409);
        const createdAt = new Date().toISOString();
        const primaryAnswerSnapshot=followUps.length
          ? structuredClone(followUps[0].primaryAnswerSnapshot)
          : {attemptId:latestPrimaryAttempt.id,transcript:latestPrimaryAttempt.transcript,feedback:structuredClone(latestPrimaryAttempt.feedback),capturedAt:createdAt};
        requireValue(nonempty(primaryAnswerSnapshot?.transcript) && primaryAnswerSnapshot?.feedback, 'Saved primary answer context is incomplete', 409);
        const primaryQuestion={text:record.question.text,...(nonempty(record.question.meaningZh)?{meaningZh:record.question.meaningZh}:{})};
        const primaryAnswer = {transcript:primaryAnswerSnapshot.transcript};
        const previousFollowUps = followUps.map(node => ({question:structuredClone(node.question),answer:{transcript:node.attempt.transcript}}));
        const question = validateFollowUp(await languageModel.followUp({primaryQuestion,primaryAnswer,previousFollowUps,signal:context?.signal}));
        const node = {
          id:randomUUID(),
          question,
          primaryAnswerSnapshot,
          previousFollowUpsSnapshot:followUps.map(previous => ({id:previous.id,question:structuredClone(previous.question),attempt:structuredClone(previous.attempt)})),
          attempt:null,
          status:'answer',
          createdAt
        };
        return commit(d => {
          const current=d.records[record.id];
          requireValue(current && current.status !== 'completed', 'Practice was completed or deleted', 409);
          const currentFollowUps=Array.isArray(current.followUps)?current.followUps:[];
          requireValue(current.attempts.at(-1)?.id===latestPrimaryAttempt.id && current.attempts.at(-1)?.feedback && JSON.stringify(currentFollowUps)===JSON.stringify(followUps), 'Practice changed; reload', 409);
          current.followUps??=[];
          requireValue(current.followUps.length<2 && current.followUps.every(previous=>previous.status==='completed'&&previous.attempt?.feedback), 'Follow-up state changed; reload', 409);
          current.followUps.push(node);current.updatedAt=createdAt;return node;
        });
      }
      const node=followUps.find(value=>value.id===followUpId);
      requireValue(node, 'Follow-up not found', 404);
      if (method === 'POST' && action === 'attempt') {
        requireValue(nonempty(input.transcript) && input.transcript.length<=100000, 'Enter a follow-up answer up to 100000 characters');
        if(input.submissionId!==undefined)requireValue(nonempty(input.submissionId)&&input.submissionId.length<=100,'Invalid submission identifier');
        if(node.attempt){
          requireValue(input.submissionId && node.attempt.submissionId===input.submissionId && node.attempt.transcript===input.transcript, 'This follow-up already has an answer',409);
          return node;
        }
        requireValue(record.status!=='completed','Completed practice cannot accept another answer',409);
        requireValue(node.status==='answer' && followUps.at(-1)?.id===node.id,'Follow-up state changed; reload',409);
        if(input.submissionId)requireValue(!followUps.some(value=>value.attempt?.submissionId===input.submissionId),'Submission identifier already used for another answer',409);
        const submittedAt=new Date().toISOString();
        const attempt={id:randomUUID(),transcript:input.transcript,inputMode:'text',submittedAt,...(input.submissionId?{submissionId:input.submissionId}:{}),feedback:null};
        return commit(d=>{
          const current=d.records[record.id];const currentFollowUps=current?.followUps||[];const currentNode=currentFollowUps.find(value=>value.id===node.id);
          requireValue(current && current.status!=='completed' && currentNode && !currentNode.attempt && currentNode.status==='answer' && currentFollowUps.at(-1)?.id===node.id,'Practice changed; reload',409);
          if(input.submissionId)requireValue(!currentFollowUps.some(value=>value.attempt?.submissionId===input.submissionId),'Submission identifier already used for another answer',409);
          currentNode.attempt=attempt;currentNode.status='feedback';currentNode.updatedAt=submittedAt;current.updatedAt=submittedAt;return currentNode;
        });
      }
      if (method === 'POST' && action === 'feedback') {
        requireValue(record.status!=='completed','Completed practice cannot generate feedback',409);
        requireValue(node.attempt,'Submit a follow-up answer first',409);
        if(node.attempt.feedback)return node;
        requireValue(node.status==='feedback','Follow-up state changed; reload',409);
        const feedback=validateFeedback(await languageModel.feedback({question:node.question,transcript:node.attempt.transcript,approvedEvidence:[],signal:context?.signal}),node.attempt.transcript);
        const completedAt=new Date().toISOString();
        return commit(d=>{
          const current=d.records[record.id];const currentNode=current?.followUps?.find(value=>value.id===node.id);
          requireValue(current && current.status!=='completed' && currentNode?.status==='feedback' && currentNode.attempt?.id===node.attempt.id && !currentNode.attempt.feedback,'Practice changed; reload',409);
          currentNode.attempt.feedback=feedback;currentNode.status='completed';currentNode.completedAt=completedAt;currentNode.updatedAt=completedAt;current.updatedAt=completedAt;return currentNode;
        });
      }
    }
    match = path.match(/^\/api\/records\/([^/]+)(?:\/(draft|attempts|feedback|comparison|complete|reference|transcription|evidence-context|coaching))?$/);
    if (match) {
      const record = item('records', match[1]);
      const action = match[2];
      if (method === 'GET' && !action) return record;
      if (method === 'DELETE' && !action) {await operations.cancelTarget(record.id);return commit(d => removeRecord(d, record.id));}
      if (method === 'GET' && action === 'evidence-context') return evidenceContext(store.data, record.snapshotId, record.question.capabilityIds);
      if (method === 'POST' && action === 'coaching') {
        const mode=input.mode;
        requireValue(['hint','gap','rewrite','ideas'].includes(mode),'Invalid coaching mode');
        const attempt=record.attempts.at(-1);
        if(mode==='rewrite')requireValue(attempt?.feedback,'請先回答並取得回饋，再看英文示範。',409);
        const transcript=mode==='rewrite'?attempt.transcript:mode==='ideas'?input.transcript:'';
        requireValue(typeof transcript==='string' && transcript.length<=100000 && (mode!=='ideas'||nonempty(transcript)),'請先寫下想法。');
        const key=createHash('sha256').update(JSON.stringify({mode,transcript})).digest('hex');
        if(record.coaching?.[key])return record.coaching[key];
        const output=validateCoaching(await languageModel.coach({question:record.question,transcript,mode,signal:context?.signal}),mode,transcript);
        return commit(d=>{const r=d.records[record.id];requireValue(r,'Not found',404);r.coaching??={};const result={id:key,mode,...output,createdAt:new Date().toISOString()};r.coaching[key]=result;return result;});
      }
      if (method === 'POST' && action === 'transcription') {
        requireValue(record.status !== 'completed' && record.attempts.length < 2 && record.attempts.every(a => a.feedback), 'Finish feedback before recording a revision', 409);
        const transcript = await transcribeTemporary({directory: audioDirectory, provider: speechProvider, audio: input.audio, mimeType: input.mimeType, signal: context?.signal});
        return commit(d => {
          const r = d.records[record.id];
          requireValue(r.status !== 'completed' && r.attempts.length === record.attempts.length, 'Practice changed; reload', 409);
          r.transcriptDraft = {id: randomUUID(), transcript, inputMode: 'voice'};
          return r.transcriptDraft;
        });
      }
      if (method === 'POST' && action === 'draft') {
        requireValue(typeof input.transcript === 'string' && input.transcript.length <= 100000, 'Enter a text draft up to 100000 characters');
        requireValue(input.ideasText === undefined || (typeof input.ideasText === 'string' && input.ideasText.length <= 50000), '想法內容最多 50,000 字。');
        return commit(d => {
          const r = d.records[record.id];
          requireValue(r && r.status !== 'completed' && r.attempts.length < 2 && r.attempts.every(a => a.feedback) && input.attemptIndex === r.attempts.length, 'Practice changed; reload before editing', 409);
          r.writtenDraft = {transcript: input.transcript, ideasText:input.ideasText ?? (r.writtenDraft?.attemptIndex===input.attemptIndex?r.writtenDraft.ideasText:'') ?? '', attemptIndex: input.attemptIndex, savedAt: new Date().toISOString()};
          r.updatedAt = r.writtenDraft.savedAt;
          return r.writtenDraft;
        });
      }
      if (method === 'POST' && action === 'attempts') {
        requireValue(nonempty(input.transcript), 'Enter an answer');
        if (input.submissionId !== undefined) {
          requireValue(nonempty(input.submissionId) && input.submissionId.length <= 100, 'Invalid submission identifier');
          const existing = record.attempts.find(a => a.submissionId === input.submissionId);
          if (existing) {
            requireValue(existing.transcript === input.transcript && record.attempts.indexOf(existing) === input.attemptIndex, 'Submission identifier already used for another answer', 409);
            return record;
          }
          requireValue(input.attemptIndex === record.attempts.length, 'Practice changed; reload', 409);
        }
        requireValue(record.status !== 'completed' && record.attempts.length < 2 && record.attempts.every(a => a.feedback), 'Finish feedback before revising; at most two attempts', 409);
        const voice = input.transcriptDraftId !== undefined;
        if (voice) requireValue(record.transcriptDraft?.id === input.transcriptDraftId, 'Transcript draft changed; review again', 409);
        const attempt = {id: randomUUID(), transcript: input.transcript, inputMode: voice ? 'voice' : 'text', submittedAt: new Date().toISOString(), ...(input.submissionId ? {submissionId: input.submissionId} : {}), feedback: null};
        return commit(d => {
          const r = d.records[record.id];
          requireValue(r, 'Practice was deleted', 409);
          const existing = input.submissionId && r.attempts.find(a => a.submissionId === input.submissionId);
          if (existing) {
            requireValue(existing.transcript === input.transcript && r.attempts.indexOf(existing) === input.attemptIndex, 'Submission identifier already used for another answer', 409);
            return r;
          }
          requireValue(r.status !== 'completed' && r.attempts.length === record.attempts.length, 'Practice changed; reload', 409);
          if (store.data.snapshots[r.snapshotId]?.practiceVersion !== 3) captureAnswerClaims(d, r, attempt); r.attempts.push(attempt); delete r.transcriptDraft; delete r.writtenDraft; r.updatedAt = attempt.submittedAt; r.status = 'feedback'; return r;
        });
      }
      if (method === 'POST' && action === 'feedback') {
        const attempt = record.attempts.at(-1);
        requireValue(attempt, 'Submit an answer first', 409);
        if (attempt.feedback) return record;
        const feedback = validateFeedback(await languageModel.feedback({question: record.question, transcript: attempt.transcript, previousAttempt: record.attempts.length>1?record.attempts[0]:undefined, approvedEvidence: store.data.snapshots[record.snapshotId]?.practiceVersion === 3 ? [] : evidenceContext(store.data, record.snapshotId, record.question.capabilityIds).approvedEvidence, signal: context?.signal}), attempt.transcript);
        return commit(d => {
          const r = d.records[record.id];
          requireValue(r.attempts.at(-1).id === attempt.id, 'Practice changed; reload', 409);
          r.attempts.at(-1).feedback = feedback; r.updatedAt = new Date().toISOString(); r.status = r.attempts.length === 2 ? 'compare' : 'revise';
          if (r.attempts.length === 2) r.comparison = {attemptIds: r.attempts.map(a => a.id), changes: Object.fromEntries(dimensions.map(d => [d, {before: r.attempts[0].feedback.ratings[d], after: r.attempts[1].feedback.ratings[d]}])), remainingPriority: feedback.priorityImprovement};
          return r;
        });
      }
      if (method === 'GET' && action === 'reference') {
        requireValue(record.attempts.length === 2 && record.attempts.every(a => a.feedback), 'Reference unavailable until revision feedback', 409);
        return {reference: 'State your approach, explain the assumptions, work through an example, then discuss a trade-off. This is an answer outline, not a claim about your experience.'};
      }
      if (method === 'GET' && action === 'comparison') {
        requireValue(record.attempts.length === 2 && record.attempts.every(a => a.feedback), 'Complete both feedback reports first', 409);
        return {...record.comparison, attempts: record.attempts};
      }
      if (method === 'POST' && action === 'complete') {
        requireValue(record.attempts.length >= 1 && record.attempts.every(a => a.feedback), 'Complete feedback first', 409);
        requireValue(!(record.followUps||[]).some(node=>node.attempt&&!node.attempt.feedback), 'Complete follow-up feedback before ending this practice', 409);
        requireValue(nonempty(input.focusPoint) && input.focusPoint.length <= 500 && /[\p{L}\p{N}]/u.test(input.focusPoint), 'Choose one meaningful Focus Point (up to 500 characters)');
        return commit(d => { const r = d.records[record.id]; requireValue(r && r.attempts.length >= 1 && r.attempts.every(a=>a.feedback), 'Complete feedback first', 409); requireValue(!(r.followUps||[]).some(node=>node.attempt&&!node.attempt.feedback), 'Complete follow-up feedback before ending this practice', 409); if (r.status === 'completed') {requireValue(r.focusPoint === input.focusPoint, 'Completed Focus Point is immutable; start a new loop', 409); return r;} r.focusPoint = input.focusPoint; if(r.writtenDraft)r.unsubmittedDraft=r.writtenDraft; delete r.writtenDraft; delete r.transcriptDraft; r.status = 'completed'; r.completedAt ??= new Date().toISOString(); cleanDerivedState(d); return r; });
      }
    }
    throw new AppError('Not found', 404);
  }
  const server = http.createServer(async (req, res) => {
    try {
      requireValue(/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host||''),'Local host required',403);
      const path = new URL(req.url, 'http://localhost').pathname;
      if (path.startsWith('/api/')) {
        if (req.headers.origin) requireValue(req.headers.origin === `http://${req.headers.host}`, 'Cross-origin request rejected', 403);
        const input = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await body(req, (path.endsWith('/transcription') || path === '/api/resume/extract') ? 8_100_000 : 1_000_000) : {};
        let external;
        if(req.method==='POST'){
          const standard=path.match(/^\/api\/(?:snapshots|records)\/([^/]+)\/(analysis|questions|feedback|transcription|coaching)$/);
          const followUpGeneration=path.match(/^\/api\/records\/([^/]+)\/follow-ups$/);
          const followUpFeedback=path.match(/^\/api\/records\/([^/]+)\/follow-ups\/[^/]+\/feedback$/);
          if(standard)external={targetId:standard[1],kind:standard[2]};
          else if(followUpGeneration)external={targetId:followUpGeneration[1],kind:'follow-up'};
          else if(followUpFeedback)external={targetId:followUpFeedback[1],kind:'follow-up-feedback'};
          else if(['/api/discovery','/api/snapshots/from-url'].includes(path))external={targetId:'workspace',kind:path.endsWith('from-url')?'url':'discovery'};
        }
        const replay = async op => {
          if (['analysis','questions'].includes(op.kind)) return route('GET',`/api/snapshots/${op.targetId}/analysis`,{});
          if (op.kind==='coaching') {const r=item('records',op.targetId); requireValue(r.coaching?.[op.resultId],'Assistance no longer available',409);return r.coaching[op.resultId];}
          if (['follow-up','follow-up-feedback'].includes(op.kind)) {const r=item('records',op.targetId);const node=r.followUps?.find(value=>value.id===op.resultId);requireValue(node,'Follow-up no longer available',409);return node;}
          if (op.kind==='feedback') return item('records',op.targetId);
          if (op.kind==='transcription') {const r=item('records',op.targetId);requireValue(r.transcriptDraft?.id===op.resultId,'Transcript already consumed; reopen saved record',409);return r.transcriptDraft;}
          if (op.kind==='url') return item('snapshots',op.resultId);
          const run=store.data.discoveryRuns?.[op.resultId];requireValue(run,'Discovery run expired; start a new request',409);return run;
        };
        const result = external ? await operations.run({kind:external.kind,targetId:external.targetId,requestId:req.headers['x-request-id'],input,execute:context=>route(req.method,path,input,context),replay}) : await route(req.method,path,input);
        res.writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(result));
      } else {
        const name = {'/': 'index.html', '/app.js': 'app.js', '/voice.js': 'voice.js', '/style.css': 'style.css'}[path];
        requireValue(name, 'Not found', 404);
        const content = await readFile(new URL(`../public/${name}`, import.meta.url));
        res.writeHead(200, {'Content-Type': name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html', 'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'"}); res.end(content);
      }
    } catch (error) {
      res.writeHead(error.status || 502, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({error: error.status===504?'Provider operation timed out; retry your original action.':error.status===429?'Provider rate limit reached; retry later.':error instanceof AppError && error.status<500 ? error.message : 'Provider or storage operation failed; your saved work is retained. Retry.', retryable: !error.status || error.status === 429 || error.status >= 500}));
    }
  });
  return {server, store};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const {server} = await createApplication({directory: process.env.WORKSPACE_DIR || '.workspace', ...configuredProviders(), operationTimeoutMs: Number(process.env.COACH_TIMEOUT_MS || (process.env.COACH_LANGUAGE_PROVIDER==='codex'?90000:30000))});
  const port = Number(process.env.PORT || 4310);
  server.once('error', error => {
    if (error.code === 'EADDRINUSE') {
      console.error(`無法啟動：127.0.0.1:${port} 已被其他服務占用。`);
      console.error(`若 Interview Coach 已在執行，請開啟 http://127.0.0.1:${port}；若要切換模型服務，請先在原本的終端機按 Ctrl+C，再重新啟動。`);
    } else {
      console.error(`無法啟動 Interview Coach：${error.code || error.message}`);
    }
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => console.log(`Interview Coach: http://127.0.0.1:${server.address().port}`));
}
