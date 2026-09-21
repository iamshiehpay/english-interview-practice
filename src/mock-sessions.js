import {randomUUID} from 'node:crypto';
import {requireValue, categories} from './domain.js';

// A Short Mock Session is stored apart from Practice Records on purpose. The Practice
// Loop's invariants — feedback after every attempt, completion requires a Focus Point,
// at most two attempts, optional follow-ups — are right for the Practice Loop and wrong
// for a run of three questions. Keeping sessions separate means neither has to bend, and
// existing Practice Records are never touched.
export const SESSION_QUESTIONS = 3;

export function sessionsFor(data, predicate) {
  return Object.values(data.mockSessions || {}).filter(predicate);
}

// Three questions from three different Question Categories, preferring ones the learner
// has not practised in a Practice Record or an earlier session. No model call is made.
export function chooseSessionQuestions(data, snapshotId) {
  const analysis = data.analyses?.[snapshotId];
  requireValue(analysis?.questions?.length, 'Generate a Question Set for this job first', 409);
  const practised = new Set([
    ...Object.values(data.records || {}).filter(r => r.snapshotId === snapshotId).map(r => r.question.id),
    ...sessionsFor(data, session => session.snapshotId === snapshotId).flatMap(session => session.entries.map(entry => entry.question.id))
  ]);
  const chosen = [];
  for (const category of categories) {
    if (chosen.length === SESSION_QUESTIONS) break;
    const inCategory = analysis.questions.filter(question => question.category === category);
    if (!inCategory.length) continue;
    chosen.push(inCategory.find(question => !practised.has(question.id)) || inCategory[0]);
  }
  requireValue(chosen.length === SESSION_QUESTIONS, 'This job needs questions in at least three categories before a mock session; add more questions first', 409);
  return chosen.map(question => structuredClone(question));
}

export function createSession(data, snapshot) {
  requireValue(!sessionsFor(data, session => session.snapshotId === snapshot.id && session.status === 'in-progress').length, 'Finish or leave the mock session you already have for this job', 409);
  const questions = chooseSessionQuestions(data, snapshot.id);
  return {
    id: randomUUID(),
    snapshotId: snapshot.id,
    // Frozen exactly as a Practice Record freezes its question and resume version.
    resume: structuredClone(snapshot.resume ?? null),
    entries: questions.map(question => ({id: randomUUID(), question, answer: null, skipped: false, feedback: null})),
    status: 'in-progress',
    summary: null,
    createdAt: new Date().toISOString(),
    completedAt: null
  };
}

// The current question is the first entry with neither an answer nor a skip.
export const currentEntry = session => session.entries.find(entry => !entry.answer && !entry.skipped);
export const sessionFinished = session => session.entries.every(entry => entry.answer || entry.skipped);

export function requireCurrentEntry(session, entryId) {
  // The session can be deleted by a concurrent request between the read and the commit.
  requireValue(session, 'This mock session was deleted', 409);
  const entry = currentEntry(session);
  requireValue(session.status === 'in-progress', 'This mock session is already finished', 409);
  requireValue(entry, 'Every question in this session is already answered or skipped', 409);
  requireValue(entry.id === entryId, 'Answer the session questions in order', 409);
  return entry;
}

// Assistance is deliberately unavailable while a session runs: the session measures what
// the learner can produce unaided. The gate lives on the session entry routes, which
// require `status === 'completed'` before any feedback, correction or rewrite.
export function sessionView(session) {
  const current = currentEntry(session);
  return {
    ...session,
    questionCount: session.entries.length,
    answeredCount: session.entries.filter(entry => entry.answer).length,
    skippedCount: session.entries.filter(entry => entry.skipped).length,
    currentEntryId: current?.id ?? null,
    currentPosition: current ? session.entries.indexOf(current) + 1 : null
  };
}
