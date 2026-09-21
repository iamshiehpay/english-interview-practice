import {practiceResume, extractResume} from './resume.js';
import {Operations} from './operations.js';
import {configuredProviders} from './cloud.js';
import {progressView, decideProgress, cleanDerivedState, removeRecord, recommendWithFocus} from './progress.js';
import {importResume, captureAnswerClaims, decideClaim, evidenceContext} from './evidence.js';
import {FakeJobSource, GreenhouseJobSource, profileFields, emptyProfile, validateProfile, validateProfileProposal, matchingJobs, boundedSource} from './jobs.js';
import http from 'node:http';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, join} from 'node:path';
import {FakeSpeechProvider, clearTemporaryAudio, readAloud, canSpeak, RECORDING_LIMIT_SECONDS, RECORDING_WARNING_SECONDS, RECORDING_MAX_BYTES, RECORDING_MAX_REQUEST_BYTES} from './speech.js';
import {RecordingStore, captureRecording, transcribeRecording, recordingsFor} from './recordings.js';
import {createSession, sessionsFor, sessionView, currentEntry, requireCurrentEntry, sessionTranscripts, sessionFinished, assertCoachingAllowed} from './mock-sessions.js';
import {LocalWorkspace} from './store.js';
import {FakeLanguageModel} from './providers.js';
import {AppError, requireValue, nonempty, validateAnalysis, validateFeedback, validateCoaching, validateFollowUp, validateCorrections, validateMockSummary, dimensions, questionSetView} from './domain.js';

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
  // Recording recovery. A recording that was captured but never submitted is
  // temporary, so it goes; a retained Answer Recording survives a restart, and any
  // file with no reference left behind by a crash is swept.
  const recordings = await new RecordingStore(directory).open();
  if (recordingsFor(store.data, entry => entry.state !== 'retained').length) {
    await store.transact(d => { for (const entry of Object.values(d.recordings || {})) if (entry.state !== 'retained') delete d.recordings[entry.id]; });
  }
  await recordings.sweep(new Set(Object.keys(store.data.recordings || {})));
  // Removing files only after the transaction that dropped their references commits
  // means a crash can leave an unreferenced file (swept above), never a dead reference.
  const commitThenDelete = async (doomed, update) => { const result = await update(); await recordings.remove(doomed); return result; };
  const item = (collection, id) => { const held = store.data[collection] || {}; const value = typeof id === 'string' && Object.hasOwn(held,id) ? held[id] : undefined; requireValue(value, 'Not found', 404); return structuredClone(value); };
  // Read-aloud resolves English text from stored content; the browser may only send a
  // reference. Chinese-by-contract fields (meaningZh, reasonZh, explanationZh…) are not
  // addressable at all, which is what keeps them from ever being spoken.
  function readAloudText(input) {
    requireValue(input.text === undefined, 'Read aloud takes a reference to saved practice text, not text');
    if (input.snapshotId !== undefined) {
      const analysis = store.data.analyses[input.snapshotId];
      requireValue(analysis, 'Generate a Question Set first', 409);
      const question = analysis.questions.find(q => q.id === input.questionId);
      requireValue(question, 'Not found', 404);
      return question.text;
    }
    const record = item('records', input.recordId);
    if (input.followUpId !== undefined) {
      const node = (record.followUps || []).find(n => n.id === input.followUpId);
      requireValue(node, 'Follow-up not found', 404);
      return node.question.text;
    }
    if (input.coachingId !== undefined) {
      const coaching = record.coaching?.[input.coachingId];
      requireValue(coaching && coaching.mode === 'illustrative', 'Only an Illustrative Answer can be read aloud', 404);
      return coaching.text;
    }
    if (input.attemptId !== undefined) {
      const saved = record.corrections?.[input.attemptId];
      requireValue(saved && Number.isInteger(input.correctionIndex) && saved.corrections[input.correctionIndex], 'Not found', 404);
      return saved.corrections[input.correctionIndex].rewrite;
    }
    return record.question.text;
  }
  let readAloudActive = 0;
  async function route(method, path, input, context) {
    const commit = update => store.transact(d => {context?.check(d);const result=update(d);context?.complete(d,result);return result;});
    if (method === 'GET' && path === '/api/health') return {status: 'ok', languageModel: languageModel.name, speechProvider: speechProvider.name, jobSource: jobSource.name};
    if (method === 'GET' && path === '/api/workspace') {const {operations: omitted, operationReceipts: omittedReceipts, ...data} = store.data;return data;}
    if (method === 'GET' && path === '/api/operations') return Object.values(store.data.operations || {});
    const cancel = path.match(/^\/api\/operations\/([^/]+)\/cancel$/);
    if (method === 'POST' && cancel) return operations.cancel(cancel[1]);
    const dismissOp = path.match(/^\/api\/operations\/([^/]+)$/);
    if (method === 'DELETE' && dismissOp) return operations.dismiss(dismissOp[1]);
    if (method === 'GET' && path === '/api/providers/language-status') return languageModel.status ? languageModel.status() : {provider:languageModel.name,authenticated:null,loginRequired:false};
    if (method === 'GET' && path === '/api/providers') return {languageModel:{name:languageModel.name,subscription:!!languageModel.status,external:!!languageModel.external,outbound:languageModel.external?['JD text and selected resume for analysis','JD, selected resume and existing capability/question set for additions','current question and transcript for feedback or English assistance','primary question, frozen formal answer and completed follow-ups for follow-up generation','a question and one formal answer transcript for evidence-safe key-sentence corrections']:[]},speech:{name:speechProvider.name,external:!!speechProvider.external,canSpeak:canSpeak(speechProvider),demonstrationSpeech:!!speechProvider.demonstrationSpeech,recordingLimitSeconds:RECORDING_LIMIT_SECONDS,recordingWarningSeconds:RECORDING_WARNING_SECONDS,recordingMaxBytes:RECORDING_MAX_BYTES,outbound:speechProvider.external?['recorded audio only',...(canSpeak(speechProvider)?['English practice text for reading aloud']:[])]:[]},jobSource:{name:jobSource.name,external:!!jobSource.external,outbound:!!jobSource.external?['public board token and requested job ID; profile filtering stays local']:[]}};
    if (method === 'POST' && path === '/api/speech') {
      // Learner-initiated, nothing saved: deliberately outside the operations tracker,
      // but bounded so a held request cannot open unlimited provider calls.
      requireValue(readAloudActive < 2, 'Two readings are already in progress; wait for one to finish', 429);
      const text = readAloudText(input);
      readAloudActive += 1;
      try { return await readAloud({provider: speechProvider, text, speed: input.speed ?? 'normal'}); }
      finally { readAloudActive -= 1; }
    }
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
      const everything = recordingsFor(store.data, () => true);
      return commitThenDelete(everything, () => commit(d => {for (const key of Object.keys(d)) delete d[key]; Object.assign(d, {version:1,snapshots:{},analyses:{},records:{}}); return {deleted:'all'};}));
    }
    if (method === 'GET' && path === '/api/evidence') return {sources: store.data.evidenceSources || {}, claims: store.data.evidenceClaims || {}};
    if (method === 'POST' && path === '/api/evidence/import') return commit(d => importResume(d, input.text));
    const claimMatch = path.match(/^\/api\/evidence\/([^/]+)$/);
    if (method === 'POST' && claimMatch) return commit(d => decideClaim(d, claimMatch[1], input));
    if (path === '/api/job-search-profile') {
      if (method === 'GET') return {...emptyProfile(), ...(store.data.jobSearchProfile || {})};
      if (method === 'POST') {const profile = validateProfile(input); return commit(d => (d.jobSearchProfile = profile));}
    }
    if (method === 'POST' && path === '/api/discovery') {
      const profile = {...emptyProfile(), ...(store.data.jobSearchProfile || {})};
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
      const [validated] = matchingJobs([result], emptyProfile());
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
    const renameMatch = path.match(/^\/api\/snapshots\/([^/]+)\/title$/);
    if (method === 'POST' && renameMatch) {
      const snapshot = item('snapshots', renameMatch[1]);
      requireValue(typeof input.title === 'string' && input.title.length <= 120, 'Enter a job name up to 120 characters');
      const title = input.title.trim();
      return commit(d => { const s = d.snapshots[snapshot.id]; requireValue(s, 'Not found', 404); if (title) s.title = title; else delete s.title; return s; });
    }
    let match = path.match(/^\/api\/snapshots\/([^/]+)(\/(?:analysis|questions))?$/);
    if (match) {
      const snapshot = item('snapshots', match[1]);
      if (method === 'GET' && !match[2]) return snapshot;
      if (method === 'DELETE' && !match[2]) {
        await operations.cancelTarget(snapshot.id);
        const recordIds = Object.values(store.data.records).filter(r => r.snapshotId === snapshot.id).map(r => r.id);
        for (const id of recordIds) await operations.cancelTarget(id);
        const sessionIds = sessionsFor(store.data, s => s.snapshotId === snapshot.id).map(s => s.id);
        for (const id of sessionIds) await operations.cancelTarget(id);
        const owned = recordingsFor(store.data, entry => recordIds.includes(entry.recordId) || sessionIds.includes(entry.sessionId));
        return commitThenDelete(owned, () => commit(d => {for (const r of Object.values(d.records)) if (r.snapshotId===snapshot.id) removeRecord(d,r.id);for (const id of sessionIds){delete d.mockSessions?.[id];}for (const entry of owned) delete d.recordings?.[entry.id];delete d.snapshots[snapshot.id];delete d.analyses[snapshot.id];for (const c of Object.values(d.evidenceClaims||{})) c.capabilityLinks=c.capabilityLinks.filter(l=>l.snapshotId!==snapshot.id);cleanDerivedState(d);return {deleted:snapshot.id};}));
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
    // Short Mock Session: three questions in a row, no feedback or coaching between
    // them, assessed once at the end. Stored apart from Practice Records so neither
    // has to bend its rules; a session never creates, completes or edits a record.
    if (method === 'GET' && path === '/api/mock-sessions') return sessionsFor(store.data, () => true).map(sessionView);
    if (method === 'POST' && path === '/api/mock-sessions') {
      const snapshot = item('snapshots', input.snapshotId);
      const session = createSession(store.data, snapshot);
      return commit(d => {
        requireValue(d.snapshots[snapshot.id] && d.analyses[snapshot.id], 'Job Snapshot changed or was deleted', 409);
        requireValue(!sessionsFor(d, s => s.snapshotId === snapshot.id && s.status === 'in-progress').length, 'Finish or leave the mock session you already have for this job', 409);
        d.mockSessions ??= {};
        return sessionView(d.mockSessions[session.id] = session);
      });
    }
    const sessionEntryMatch = path.match(/^\/api\/mock-sessions\/([^/]+)\/entries\/([^/]+)\/(feedback|transcription|corrections|coaching)$/);
    if (method === 'POST' && sessionEntryMatch) {
      const session = item('mockSessions', sessionEntryMatch[1]);
      const entry = session.entries.find(e => e.id === sessionEntryMatch[2]);
      requireValue(entry, 'Not found', 404);
      const entryAction = sessionEntryMatch[3];
      if (entryAction === 'transcription') {
        requireCurrentEntry(session, entry.id);
        const captured = await captureRecording({store: recordings, audio: input.audio, mimeType: input.mimeType});
        let transcript;
        try { transcript = await transcribeRecording({store: recordings, provider: speechProvider, entry: captured, signal: context?.signal}); }
        catch (error) { await recordings.remove([captured]); throw error; }
        const superseded = recordingsFor(store.data, e => e.state === 'pending' && e.sessionId === session.id);
        try {
          return await commitThenDelete(superseded, () => commit(d => {
            const current = d.mockSessions[session.id];
            requireCurrentEntry(current, entry.id);
            d.recordings ??= {};
            for (const e of superseded) delete d.recordings[e.id];
            d.recordings[captured.id] = {...captured, sessionId: session.id, state: 'pending'};
            current.transcriptDraft = {id: randomUUID(), transcript, inputMode: 'voice', recordingId: captured.id, entryId: entry.id};
            return current.transcriptDraft;
          }));
        } catch (error) { await recordings.remove([captured]); throw error; }
      }
      // Everything below is coaching on a finished session; during a run it is refused.
      requireValue(session.status === 'completed', 'Feedback and assistance are available after the mock session ends', 409);
      requireValue(entry.answer, 'A skipped question has no answer to assess', 409);
      if (entryAction === 'feedback') {
        if (entry.feedback) return entry;
        const feedback = validateFeedback(await languageModel.feedback({question: entry.question, transcript: entry.answer.transcript, approvedEvidence: [], signal: context?.signal}), entry.answer.transcript);
        return commit(d => {
          const target = d.mockSessions[session.id]?.entries.find(e => e.id === entry.id);
          requireValue(target?.answer?.id === entry.answer.id, 'Session changed; reload', 409);
          target.feedback = feedback;
          return target;
        });
      }
      if (entryAction === 'corrections') {
        if (entry.corrections) return entry.corrections;
        const output = validateCorrections(await languageModel.corrections({question: entry.question, transcript: entry.answer.transcript, signal: context?.signal}), entry.answer.transcript);
        return commit(d => {
          const target = d.mockSessions[session.id]?.entries.find(e => e.id === entry.id);
          requireValue(target?.answer?.id === entry.answer.id, 'Session changed; reload', 409);
          return target.corrections = {id: entry.answer.id, corrections: output.corrections, createdAt: new Date().toISOString()};
        });
      }
      // English Assistance on a finished session answer: rewrite only, same contract.
      requireValue(input.mode === 'rewrite', 'Only an English rewrite is available for a session answer');
      const key = createHash('sha256').update(JSON.stringify({mode: 'rewrite', transcript: entry.answer.transcript})).digest('hex');
      if (entry.coaching?.[key]) return entry.coaching[key];
      const output = validateCoaching(await languageModel.coach({question: entry.question, transcript: entry.answer.transcript, mode: 'rewrite', signal: context?.signal}), 'rewrite', entry.answer.transcript);
      return commit(d => {
        const target = d.mockSessions[session.id]?.entries.find(e => e.id === entry.id);
        requireValue(target?.answer?.id === entry.answer.id, 'Session changed; reload', 409);
        target.coaching ??= {};
        return target.coaching[key] = {id: key, mode: 'rewrite', ...output, createdAt: new Date().toISOString()};
      });
    }
    const sessionMatch = path.match(/^\/api\/mock-sessions\/([^/]+)(?:\/(answer|skip|summary))?$/);
    if (sessionMatch) {
      const session = item('mockSessions', sessionMatch[1]);
      const action = sessionMatch[2];
      if (method === 'GET' && !action) return sessionView(session);
      if (method === 'DELETE' && !action) {
        await operations.cancelTarget(session.id);
        const owned = recordingsFor(store.data, entry => entry.sessionId === session.id);
        return commitThenDelete(owned, () => commit(d => {
          requireValue(d.mockSessions?.[session.id], 'Not found', 404);
          for (const entry of owned) delete d.recordings[entry.id];
          delete d.mockSessions[session.id];
          return {deleted: session.id};
        }));
      }
      if (method === 'POST' && (action === 'answer' || action === 'skip')) {
        // An idempotent resubmit is answered before the ordering guard: the learner has
        // already moved on, so "answer in order" would wrongly reject their own retry.
        const replayed = action === 'answer' && nonempty(input.submissionId) && session.entries.find(e => e.answer?.submissionId === input.submissionId);
        if (replayed) { requireValue(replayed.answer.transcript === input.transcript && replayed.id === input.entryId, 'Submission identifier already used for another answer', 409); return sessionView(session); }
        const entry = requireCurrentEntry(session, input.entryId);
        if (action === 'skip') {
          const stranded = recordingsFor(store.data, e => e.state === 'pending' && e.sessionId === session.id);
          return commitThenDelete(stranded, () => commit(d => {
            const current = d.mockSessions[session.id];
            const target = requireCurrentEntry(current, input.entryId);
            for (const e of stranded) delete d.recordings[e.id];
            delete current.transcriptDraft;
            target.skipped = true; target.skippedAt = new Date().toISOString(); current.updatedAt = target.skippedAt;
            if (sessionFinished(current)) current.status = 'awaiting-summary';
            return sessionView(current);
          }));
        }
        requireValue(nonempty(input.transcript) && input.transcript.length <= 100000, 'Enter an answer up to 100000 characters');
        if (input.submissionId !== undefined) requireValue(nonempty(input.submissionId) && input.submissionId.length <= 100, 'Invalid submission identifier');
        const voice = input.transcriptDraftId !== undefined;
        if (voice) requireValue(session.transcriptDraft?.id === input.transcriptDraftId && session.transcriptDraft.entryId === entry.id, 'Transcript draft changed; review again', 409);
        const promotedId = voice ? session.transcriptDraft.recordingId : undefined;
        const abandoned = recordingsFor(store.data, e => e.state === 'pending' && e.sessionId === session.id && e.id !== promotedId);
        const answer = {id: randomUUID(), transcript: input.transcript, inputMode: voice ? 'voice' : 'text', submittedAt: new Date().toISOString(), ...(input.submissionId ? {submissionId: input.submissionId} : {}),
          ...(promotedId ? {recordingId: promotedId, transcriptEdited: session.transcriptDraft.transcript !== input.transcript} : {})};
        return commitThenDelete(abandoned, () => commit(d => {
          const current = d.mockSessions[session.id];
          const target = requireCurrentEntry(current, input.entryId);
          if (input.submissionId) requireValue(!current.entries.some(e => e.answer?.submissionId === input.submissionId), 'Submission identifier already used for another answer', 409);
          for (const e of abandoned) delete d.recordings[e.id];
          if (promotedId) { const kept = d.recordings?.[promotedId]; requireValue(kept, 'Recording is no longer available; record again', 409); kept.state = 'retained'; kept.attemptId = answer.id; }
          delete current.transcriptDraft;
          target.answer = answer; current.updatedAt = answer.submittedAt;
          if (sessionFinished(current)) current.status = 'awaiting-summary';
          return sessionView(current);
        }));
      }
      if (method === 'POST' && action === 'summary') {
        requireValue(sessionFinished(session), 'Answer or skip every question before ending the session', 409);
        if (session.summary || session.status === 'completed') return sessionView(session);
        const answered = session.entries.filter(entry => entry.answer);
        const completedAt = new Date().toISOString();
        // Every question skipped: no provider call, and no invented assessment.
        if (!answered.length) {
          return commit(d => { const current = d.mockSessions[session.id]; requireValue(sessionFinished(current), 'Session changed; reload', 409); current.status = 'completed'; current.completedAt ??= completedAt; current.summary = {nothingToAssess: true}; return sessionView(current); });
        }
        const summary = validateMockSummary(await languageModel.mockSummary({answers: answered.map(entry => ({question: entry.question, transcript: entry.answer.transcript})), signal: context?.signal}), answered.map(entry => entry.answer.transcript));
        return commit(d => {
          const current = d.mockSessions[session.id];
          requireValue(current && sessionFinished(current) && JSON.stringify(current.entries.map(e => e.answer?.id ?? null)) === JSON.stringify(session.entries.map(e => e.answer?.id ?? null)), 'Session changed; reload', 409);
          current.summary = summary; current.status = 'completed'; current.completedAt ??= completedAt;
          return sessionView(current);
        });
      }
    }
    if (method === 'POST' && path === '/api/records') {
      const snapshot = item('snapshots', input.snapshotId);
      const question = store.data.analyses[snapshot.id]?.questions.find(q => q.id === input.questionId);
      requireValue(question, 'Select a generated question');
      const record = {id: randomUUID(), snapshotId: snapshot.id, question: structuredClone(question), attempts: [], followUps: [], status: 'answer', createdAt: new Date().toISOString(), focusPoint: null};
      return commit(d => {requireValue(d.snapshots[snapshot.id] && d.analyses[snapshot.id]?.questions.some(q=>q.id===question.id),'Job Snapshot changed or was deleted',409);return d.records[record.id]=record;});
    }
    if (method === 'POST' && path === '/api/records/from-focus') {
      const source = item('records', input.recordId);
      requireValue(source.status === 'completed' && nonempty(source.focusPoint), 'Complete a practice and choose a Focus Point before continuing it', 409);
      const snapshot = item('snapshots', source.snapshotId);
      const analysis = store.data.analyses[snapshot.id];
      requireValue(analysis?.questions?.length, 'Generate a Question Set first', 409);
      // Same-JD scenario: prefer an unpractised question in the source category, so
      // the learner works the same focus in a fresh situation without new generation.
      const snapRecords = Object.values(store.data.records).filter(r => r.snapshotId === snapshot.id);
      const used = id => snapRecords.some(r => r.question.id === id);
      const sameCategory = analysis.questions.filter(q => q.category === source.question.category && q.id !== source.question.id);
      const question = sameCategory.find(q => !used(q.id)) || sameCategory[0] || analysis.questions.find(q => q.id !== source.question.id) || analysis.questions[0];
      const record = {id: randomUUID(), snapshotId: snapshot.id, question: structuredClone(question), attempts: [], followUps: [], status: 'answer', createdAt: new Date().toISOString(), focusPoint: null, focusOrigin: {recordId: source.id, questionId: source.question.id, questionText: source.question.text, focusPoint: source.focusPoint}};
      return commit(d => {
        requireValue(d.records[source.id]?.status === 'completed' && d.snapshots[snapshot.id] && d.analyses[snapshot.id]?.questions.some(q => q.id === question.id), 'Practice changed; reload', 409);
        return d.records[record.id] = record;
      });
    }
    let followUpMatch = path.match(/^\/api\/records\/([^/]+)\/follow-ups(?:\/([^/]+)\/(attempt|feedback|transcription))?$/);
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
      // A follow-up records against its own node: the transcript draft and the Answer
      // Recording belong to this follow-up, never to the primary attempt.
      if (method === 'POST' && action === 'transcription') {
        requireValue(record.status!=='completed','Completed practice cannot accept another answer',409);
        requireValue(!node.attempt && node.status==='answer' && followUps.at(-1)?.id===node.id,'This follow-up already has an answer',409);
        const captured = await captureRecording({store: recordings, audio: input.audio, mimeType: input.mimeType});
        let transcript;
        try { transcript = await transcribeRecording({store: recordings, provider: speechProvider, entry: captured, signal: context?.signal}); }
        catch (error) { await recordings.remove([captured]); throw error; }
        const superseded = recordingsFor(store.data, entry => entry.state === 'pending' && entry.followUpId === node.id);
        try {
          return await commitThenDelete(superseded, () => commit(d => {
            const current=d.records[record.id];const currentNode=current?.followUps?.find(value=>value.id===node.id);
            requireValue(current && current.status!=='completed' && currentNode && !currentNode.attempt && currentNode.status==='answer','Practice changed; reload',409);
            d.recordings ??= {};
            for (const entry of superseded) delete d.recordings[entry.id];
            d.recordings[captured.id] = {...captured, recordId: record.id, followUpId: node.id, state: 'pending'};
            currentNode.transcriptDraft = {id: randomUUID(), transcript, inputMode: 'voice', recordingId: captured.id};
            return currentNode.transcriptDraft;
          }));
        } catch (error) { await recordings.remove([captured]); throw error; }
      }
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
        const voice = input.transcriptDraftId !== undefined;
        if (voice) requireValue(node.transcriptDraft?.id === input.transcriptDraftId, 'Transcript draft changed; review again', 409);
        const promotedId = voice ? node.transcriptDraft.recordingId : undefined;
        const abandoned = recordingsFor(store.data, entry => entry.state === 'pending' && entry.followUpId === node.id && entry.id !== promotedId);
        const submittedAt=new Date().toISOString();
        const attempt={id:randomUUID(),transcript:input.transcript,inputMode:voice?'voice':'text',submittedAt,...(input.submissionId?{submissionId:input.submissionId}:{}),
          ...(promotedId?{recordingId:promotedId,transcriptEdited:node.transcriptDraft.transcript!==input.transcript}:{}),feedback:null};
        return commitThenDelete(abandoned, () => commit(d=>{
          const current=d.records[record.id];const currentFollowUps=current?.followUps||[];const currentNode=currentFollowUps.find(value=>value.id===node.id);
          requireValue(current && current.status!=='completed' && currentNode && !currentNode.attempt && currentNode.status==='answer' && currentFollowUps.at(-1)?.id===node.id,'Practice changed; reload',409);
          if(input.submissionId)requireValue(!currentFollowUps.some(value=>value.attempt?.submissionId===input.submissionId),'Submission identifier already used for another answer',409);
          for (const entry of abandoned) delete d.recordings[entry.id];
          if (promotedId) { const kept = d.recordings?.[promotedId]; requireValue(kept, 'Recording is no longer available; record again', 409); kept.state='retained'; kept.attemptId=attempt.id; }
          currentNode.attempt=attempt;currentNode.status='feedback';delete currentNode.transcriptDraft;currentNode.updatedAt=submittedAt;current.updatedAt=submittedAt;return currentNode;
        }));
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
    match = path.match(/^\/api\/records\/([^/]+)(?:\/(draft|attempts|feedback|comparison|complete|reference|transcription|evidence-context|coaching|corrections))?$/);
    if (match) {
      const record = item('records', match[1]);
      const action = match[2];
      if (method === 'GET' && !action) return record;
      if (method === 'POST' && action === 'corrections') {
        requireValue(nonempty(input.attemptId), 'Select an answered attempt');
        const primary = record.attempts.find(a => a.id === input.attemptId);
        const followUpNode = (record.followUps || []).find(node => node.attempt?.id === input.attemptId);
        const attempt = primary || followUpNode?.attempt;
        requireValue(attempt, 'Answer attempt not found', 404);
        requireValue(attempt.feedback, 'Complete feedback before requesting corrections', 409);
        if (record.corrections?.[input.attemptId]) return record.corrections[input.attemptId];
        const question = primary ? record.question : followUpNode.question;
        const output = validateCorrections(await languageModel.corrections({question, transcript: attempt.transcript, signal: context?.signal}), attempt.transcript);
        return commit(d => {
          const r = d.records[record.id];
          requireValue(r, 'Not found', 404);
          const target = r.attempts.find(a => a.id === input.attemptId) || (r.followUps || []).find(node => node.attempt?.id === input.attemptId)?.attempt;
          requireValue(target?.feedback, 'Practice changed; reload', 409);
          r.corrections ??= {};
          const result = {id: input.attemptId, corrections: output.corrections, createdAt: new Date().toISOString()};
          r.corrections[input.attemptId] = result;
          return result;
        });
      }
      if (method === 'DELETE' && !action) {
        await operations.cancelTarget(record.id);
        const owned = recordingsFor(store.data, entry => entry.recordId === record.id);
        return commitThenDelete(owned, () => commit(d => removeRecord(d, record.id)));
      }
      if (method === 'GET' && action === 'evidence-context') return evidenceContext(store.data, record.snapshotId, record.question.capabilityIds);
      if (method === 'POST' && action === 'coaching') {
        const mode=input.mode;
        requireValue(['hint','gap','rewrite','ideas','illustrative'].includes(mode),'Invalid coaching mode');
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
        const captured = await captureRecording({store: recordings, audio: input.audio, mimeType: input.mimeType});
        let transcript;
        try { transcript = await transcribeRecording({store: recordings, provider: speechProvider, entry: captured, signal: context?.signal}); }
        catch (error) { await recordings.remove([captured]); throw error; }
        // A new recording for this practice supersedes an earlier unsubmitted one.
        const superseded = recordingsFor(store.data, entry => entry.state === 'pending' && entry.recordId === record.id);
        try {
          return await commitThenDelete(superseded, () => commit(d => {
            const r = d.records[record.id];
            requireValue(r.status !== 'completed' && r.attempts.length === record.attempts.length, 'Practice changed; reload', 409);
            d.recordings ??= {};
            for (const entry of superseded) delete d.recordings[entry.id];
            d.recordings[captured.id] = {...captured, recordId: record.id, state: 'pending'};
            r.transcriptDraft = {id: randomUUID(), transcript, inputMode: 'voice', recordingId: captured.id};
            return r.transcriptDraft;
          }));
        } catch (error) { await recordings.remove([captured]); throw error; }
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
        // Promote this answer's recording; drop any other unsubmitted one for this practice.
        const promotedId = voice ? record.transcriptDraft.recordingId : undefined;
        const abandoned = recordingsFor(store.data, entry => entry.state === 'pending' && entry.recordId === record.id && entry.id !== promotedId);
        const attempt = {id: randomUUID(), transcript: input.transcript, inputMode: voice ? 'voice' : 'text', submittedAt: new Date().toISOString(), ...(input.submissionId ? {submissionId: input.submissionId} : {}),
          // The recording is evidence of what was said; an edited transcript is labelled,
          // never re-cut, so the audio is not presented as matching the edited text.
          ...(promotedId ? {recordingId: promotedId, transcriptEdited: record.transcriptDraft.transcript !== input.transcript} : {}), feedback: null};
        return commitThenDelete(abandoned, () => commit(d => {
          const r = d.records[record.id];
          requireValue(r, 'Practice was deleted', 409);
          const existing = input.submissionId && r.attempts.find(a => a.submissionId === input.submissionId);
          if (existing) {
            requireValue(existing.transcript === input.transcript && r.attempts.indexOf(existing) === input.attemptIndex, 'Submission identifier already used for another answer', 409);
            return r;
          }
          requireValue(r.status !== 'completed' && r.attempts.length === record.attempts.length, 'Practice changed; reload', 409);
          for (const entry of abandoned) delete d.recordings[entry.id];
          if (promotedId) { const kept = d.recordings?.[promotedId]; requireValue(kept, 'Recording is no longer available; record again', 409); kept.state = 'retained'; kept.attemptId = attempt.id; }
          if (store.data.snapshots[r.snapshotId]?.practiceVersion !== 3) captureAnswerClaims(d, r, attempt); r.attempts.push(attempt); delete r.transcriptDraft; delete r.writtenDraft; r.updatedAt = attempt.submittedAt; r.status = 'feedback'; return r;
        }));
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
        // Completing discards the transcript draft, so its unsubmitted recording goes too.
        const stranded = recordingsFor(store.data, entry => entry.state === 'pending' && entry.recordId === record.id);
        return commitThenDelete(stranded, () => commit(d => { const r = d.records[record.id]; requireValue(r && r.attempts.length >= 1 && r.attempts.every(a=>a.feedback), 'Complete feedback first', 409); requireValue(!(r.followUps||[]).some(node=>node.attempt&&!node.attempt.feedback), 'Complete follow-up feedback before ending this practice', 409); if (r.status === 'completed') {requireValue(r.focusPoint === input.focusPoint, 'Completed Focus Point is immutable; start a new loop', 409); return r;} r.focusPoint = input.focusPoint; if(r.writtenDraft)r.unsubmittedDraft=r.writtenDraft; delete r.writtenDraft; delete r.transcriptDraft; for (const node of r.followUps || []) delete node.transcriptDraft; for (const entry of stranded) delete d.recordings[entry.id]; r.status = 'completed'; r.completedAt ??= new Date().toISOString(); cleanDerivedState(d); return r; }));
      }
    }
    throw new AppError('Not found', 404);
  }
  const server = http.createServer(async (req, res) => {
    try {
      requireValue(/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host||''),'Local host required',403);
      const path = new URL(req.url, 'http://localhost').pathname;
      // Playback of one retained Answer Recording. Binary, local-only, never cached.
      const playback = path.match(/^\/api\/recordings\/([^/]+)$/);
      if (req.method === 'GET' && playback) {
        if (req.headers.origin) requireValue(req.headers.origin === `http://${req.headers.host}`, 'Cross-origin request rejected', 403);
        const entry = store.data.recordings?.[playback[1]];
        requireValue(entry && entry.state === 'retained', 'Recording is no longer available', 404);
        let content;
        try { content = await recordings.read(entry); }
        catch (error) { requireValue(error.code !== 'ENOENT', 'Recording is no longer available', 404); throw error; }
        res.writeHead(200, {'Content-Type': entry.mimeType, 'Content-Length': content.length, 'Cache-Control': 'no-store', 'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff'});
        res.end(content);
        return;
      }
      if (path.startsWith('/api/')) {
        if (req.headers.origin) requireValue(req.headers.origin === `http://${req.headers.host}`, 'Cross-origin request rejected', 403);
        const input = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await body(req, path.endsWith('/transcription') ? RECORDING_MAX_REQUEST_BYTES : path === '/api/resume/extract' ? 8_100_000 : 1_000_000) : {};
        let external;
        if(req.method==='POST'){
          const standard=path.match(/^\/api\/(?:snapshots|records)\/([^/]+)\/(analysis|questions|feedback|transcription|coaching|corrections)$/);
          const followUpGeneration=path.match(/^\/api\/records\/([^/]+)\/follow-ups$/);
          const followUpFeedback=path.match(/^\/api\/records\/([^/]+)\/follow-ups\/[^/]+\/feedback$/);
          const followUpTranscription=path.match(/^\/api\/records\/([^/]+)\/follow-ups\/([^/]+)\/transcription$/);
          const sessionSummary=path.match(/^\/api\/mock-sessions\/([^/]+)\/summary$/);
          const sessionEntry=path.match(/^\/api\/mock-sessions\/([^/]+)\/entries\/[^/]+\/(feedback|transcription|corrections|coaching)$/);
          if(sessionSummary)external={targetId:sessionSummary[1],kind:'session-summary'};
          else if(sessionEntry)external={targetId:sessionEntry[1],kind:`session-${sessionEntry[2]}`};
          else if(standard)external={targetId:standard[1],kind:standard[2]};
          else if(followUpGeneration)external={targetId:followUpGeneration[1],kind:'follow-up'};
          else if(followUpFeedback)external={targetId:followUpFeedback[1],kind:'follow-up-feedback'};
          else if(followUpTranscription)external={targetId:followUpTranscription[1],kind:'follow-up-transcription'};
          else if(['/api/discovery','/api/snapshots/from-url'].includes(path))external={targetId:'workspace',kind:path.endsWith('from-url')?'url':'discovery'};
        }
        const replay = async op => {
          if (['analysis','questions'].includes(op.kind)) return route('GET',`/api/snapshots/${op.targetId}/analysis`,{});
          if (op.kind==='coaching') {const r=item('records',op.targetId); requireValue(r.coaching?.[op.resultId],'Assistance no longer available',409);return r.coaching[op.resultId];}
          if (op.kind==='corrections') {const r=item('records',op.targetId); requireValue(r.corrections?.[op.resultId],'Corrections no longer available',409);return r.corrections[op.resultId];}
          if (['follow-up','follow-up-feedback'].includes(op.kind)) {const r=item('records',op.targetId);const node=r.followUps?.find(value=>value.id===op.resultId);requireValue(node,'Follow-up no longer available',409);return node;}
          if (op.kind==='feedback') return item('records',op.targetId);
          if (op.kind==='transcription') {const r=item('records',op.targetId);requireValue(r.transcriptDraft?.id===op.resultId,'Transcript already consumed; reopen saved record',409);return r.transcriptDraft;}
          if (op.kind==='follow-up-transcription') {const r=item('records',op.targetId);const draft=(r.followUps||[]).map(n=>n.transcriptDraft).find(d=>d?.id===op.resultId);requireValue(draft,'Transcript already consumed; reopen saved record',409);return draft;}
          if (op.kind==='session-summary') return sessionView(item('mockSessions',op.targetId));
          if (op.kind==='session-transcription') {const s=item('mockSessions',op.targetId);requireValue(s.transcriptDraft?.id===op.resultId,'Transcript already consumed; reopen the session',409);return s.transcriptDraft;}
          if (op.kind==='session-feedback') {const s=item('mockSessions',op.targetId);const entry=s.entries.find(e=>e.id===op.resultId);requireValue(entry,'Session answer no longer available',409);return entry;}
          if (op.kind==='session-corrections') {const s=item('mockSessions',op.targetId);const saved=s.entries.map(e=>e.corrections).find(c=>c?.id===op.resultId);requireValue(saved,'Corrections no longer available',409);return saved;}
          if (op.kind==='session-coaching') {const s=item('mockSessions',op.targetId);const saved=s.entries.flatMap(e=>Object.values(e.coaching||{})).find(c=>c.id===op.resultId);requireValue(saved,'Assistance no longer available',409);return saved;}
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
  const {server} = await createApplication({directory: process.env.WORKSPACE_DIR || '.workspace', ...configuredProviders(), operationTimeoutMs: Number(process.env.COACH_TIMEOUT_MS || (['codex','claude'].includes(process.env.COACH_LANGUAGE_PROVIDER)?90000:30000))});
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
