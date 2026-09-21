import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './helpers.js';
import {FakeLanguageModel} from '../src/providers.js';
import {MultiJobSource, profileFields, locationTag, dedupeJobs} from '../src/jobs.js';
import {AppError} from '../src/domain.js';

const emptyProfile = () => Object.fromEntries(profileFields.map(field => [field, []]));
const posting = (id, overrides = {}) => ({id, title: `AI Engineer ${id}`, location: 'Taipei, Taiwan', text: `AI Engineer ${id}\nTaipei, Taiwan\nBuild Python inference services and evaluate models.`, sourceUrl: `https://example.com/${id}`, source: 'fixture board', ...overrides});
const sourceOf = jobs => ({name: 'fixture board', async search() { return jobs; }});

function curating(handler) {
  const model = new FakeLanguageModel();
  const seen = [];
  model.curateJobs = async args => { seen.push(args); return handler(args); };
  return {model, seen};
}
const pick = (candidates, count = 5) => ({selections: candidates.slice(0, count).map(candidate => ({id: candidate.id, whyFitZh: `這個職缺與你的背景相關：${candidate.title}。`, matched: ['Python'], transferable: [], gaps: ['模型評估經驗'], unknown: ['薪資未載明']}))});

test('at most five curated results, fewer accepted, each with the four Fit Breakdown parts', async t => {
  const jobs = Array.from({length: 9}, (_, i) => posting(`job-${i}`));
  const {model, seen} = curating(({candidates}) => pick(candidates));
  const {api} = await harness(t, model, {jobSource: sourceOf(jobs)});
  await api('/job-search-profile', {...emptyProfile(), roles: ['AI']});

  const run = (await api('/discovery', {})).data;
  assert.equal(run.shortlist.length, 5);
  assert.ok(seen[0].candidates.length <= 12, 'only a bounded number of candidates is sent');
  for (const entry of run.shortlist) {
    for (const part of ['matched', 'transferable', 'gaps', 'unknown']) assert.ok(Array.isArray(entry[part]), `${part} must be present`);
    assert.match(entry.whyFitZh, /\p{Script=Han}/u);
    assert.ok(entry.sourceUrl && entry.title && entry.locationTag);
    assert.equal(entry.score, undefined, 'no single fit score is produced');
  }
  assert.ok(Date.parse(run.capturedAt));

  // Fewer than five is correct, not an error.
  model.curateJobs = async ({candidates}) => pick(candidates, 2);
  assert.equal((await api('/discovery', {})).data.shortlist.length, 2);
  model.curateJobs = async () => ({selections: []});
  assert.deepEqual((await api('/discovery', {})).data.shortlist, []);
});

test('the Practice Resume never reaches the job source but does reach curation', async t => {
  const received = [];
  const source = {name: 'recording board', async search(args) { received.push(args); return [posting('a')]; }};
  const {model, seen} = curating(({candidates}) => pick(candidates, 1));
  const {api} = await harness(t, model, {jobSource: source});
  await api('/resume', {name: 'Practice resume', text: 'Built a Python task manager with PostgreSQL for 3 years.'});
  await api('/job-search-profile', {...emptyProfile(), roles: ['AI']});
  await api('/discovery', {});

  const sentToBoard = JSON.stringify(received);
  assert.ok(!sentToBoard.includes('PostgreSQL'), 'the resume must never reach a job board');
  assert.ok(!sentToBoard.includes('Practice resume'));
  assert.ok(seen[0].resume.includes('PostgreSQL'), 'curation receives the resume to explain the fit');
  assert.ok(seen[0].candidates.every(candidate => candidate.excerpt.length <= 4000), 'posting excerpts are bounded');
});

test('curation output that names an unsupplied posting, pads, or invents a number is rejected', async t => {
  const {model} = curating(({candidates}) => pick(candidates, 1));
  const {api} = await harness(t, model, {jobSource: sourceOf([posting('a'), posting('b')])});
  await api('/resume', {name: 'r', text: 'Built services for 3 years.'});
  await api('/job-search-profile', {...emptyProfile(), roles: ['AI']});
  const before = (await api('/workspace')).data;

  const base = id => ({id, whyFitZh: '相關。', matched: [], transferable: [], gaps: [], unknown: []});
  for (const [label, selections] of [
    ['unsupplied id', [base('not-a-candidate')]],
    ['duplicate id', [base('0:a'), base('0:a')]],
    ['six entries', Array.from({length: 6}, (_, i) => base(`0:${i}`))],
    ['invented number', [{...base('0:a'), whyFitZh: '這個職缺需要 7 年經驗。'}]],
    ['invented number in a list', [{...base('0:a'), gaps: ['缺少 12 個月的經驗']}]],
    ['missing part', [{id: '0:a', whyFitZh: '相關。', matched: [], transferable: [], gaps: []}]],
    ['non-Chinese rationale', [{...base('0:a'), whyFitZh: 'Relevant to your background.'}]],
    ['over-long list', [{...base('0:a'), matched: Array.from({length: 7}, (_, i) => `item ${i}`)}]]
  ]) {
    model.curateJobs = async () => ({selections});
    const refused = await api('/discovery', {});
    assert.equal(refused.status, 502, `expected 502 for ${label}`);
  }
  // A number the learner's resume already states is allowed.
  model.curateJobs = async ({candidates}) => ({selections: [{...base(candidates[0].id), whyFitZh: '你的履歷提到 3 年經驗，與這個職缺相關。'}]});
  assert.equal((await api('/discovery', {})).status, 200);
  assert.deepEqual(Object.keys((await api('/workspace')).data.snapshots), Object.keys(before.snapshots), 'a rejected run creates no snapshots');
});

test('results are tagged Taiwan, remote or unknown from their own text', async t => {
  assert.equal(locationTag(posting('a')), 'taiwan');
  assert.equal(locationTag(posting('b', {location: 'Remote', text: 'Backend Engineer\nRemote\nWork from home anywhere.'})), 'remote');
  assert.equal(locationTag(posting('c', {location: 'Taipei', text: 'Engineer\nTaipei\nRemote friendly team in Taiwan.'})), 'taiwan-remote');
  assert.equal(locationTag(posting('d', {location: 'Berlin', text: 'Engineer\nBerlin\nOnsite role.'})), 'unknown');

  const {model} = curating(({candidates}) => pick(candidates, 3));
  const {api} = await harness(t, model, {jobSource: sourceOf([
    posting('local'),
    posting('remote', {location: 'Remote', text: 'AI Engineer remote\nRemote\nWork from home anywhere in the world.'}),
    posting('berlin', {location: 'Berlin', text: 'AI Engineer\nBerlin\nOnsite only.'})
  ])});
  // A "Taiwan" criterion finds a Taipei posting; "remote" finds "work from home".
  await api('/job-search-profile', {...emptyProfile(), locations: ['Taiwan']});
  const taiwanOnly = (await api('/discovery', {})).data;
  assert.deepEqual(taiwanOnly.results.map(r => r.locationTag).sort(), ['taiwan']);
  await api('/job-search-profile', {...emptyProfile(), workArrangements: ['remote']});
  const remoteOnly = (await api('/discovery', {})).data;
  assert.deepEqual(remoteOnly.results.map(r => r.locationTag), ['remote']);
});

test('exclusions are honoured and no qualifying result names the blocking conditions', async t => {
  let called = 0;
  const model = new FakeLanguageModel();
  model.curateJobs = async args => { called++; return pick(args.candidates); };
  const {api} = await harness(t, model, {jobSource: sourceOf([posting('a', {title: 'Senior AI Engineer'}), posting('b', {title: 'Staff AI Engineer'})])});
  await api('/job-search-profile', {...emptyProfile(), exclusions: ['Senior', 'Staff']});

  const run = (await api('/discovery', {})).data;
  assert.deepEqual(run.shortlist, []);
  assert.equal(called, 0, 'an empty result makes no model call');
  assert.ok(run.blocking.length, 'blocking conditions are named');
  assert.equal(run.blocking[0].field, 'exclusions');
  assert.equal(run.blocking[0].removed, 2);
});

test('duplicates across sources appear once and a failing source does not void the run', async t => {
  const shared = posting('shared', {sourceUrl: 'https://example.com/shared'});
  const healthy = {name: 'healthy board', external: true, async search() { return [shared, posting('only-here')]; }};
  const broken = {name: 'broken board', external: true, async search() { throw new AppError('Job Source rate limit reached.', 429); }};
  const duplicate = {name: 'duplicate board', external: true, async search() { return [{...shared, id: 'different-id'}]; }};

  const {model} = curating(({candidates}) => pick(candidates));
  const {api} = await harness(t, model, {jobSource: new MultiJobSource([healthy, broken, duplicate])});
  await api('/job-search-profile', {...emptyProfile(), roles: ['AI']});

  const run = (await api('/discovery', {})).data;
  assert.equal(run.results.length, 2, 'the duplicate posting is collapsed');
  assert.ok(run.sourceStatus.some(status => status.source === 'broken board' && status.ok === false && status.error === 'rate-limited'));
  assert.ok(run.sourceStatus.some(status => status.source === 'healthy board' && status.ok === true));
  assert.equal(run.shortlist.length, 2, 'the healthy source results still come back');

  // Every source failing is an error, not a silent empty result.
  const {api: allBroken} = await harness(t, model, {jobSource: new MultiJobSource([broken])});
  assert.equal((await allBroken('/discovery', {})).status, 502);
});

test('dedupe collapses a shared canonical URL and a repeated employer and title', () => {
  const kept = dedupeJobs([
    posting('a', {sourceUrl: 'https://example.com/jobs/1'}),
    // Same canonical URL, only a trailing slash apart.
    posting('b', {sourceUrl: 'https://example.com/jobs/1/'}),
    // Different URL, but the same title and location: the same job on another board.
    posting('c', {title: 'AI Engineer a', sourceUrl: 'https://other.example/x'}),
    // A genuinely different posting survives.
    posting('d', {title: 'Different Role', sourceUrl: 'https://other.example/y'})
  ]);
  assert.deepEqual(kept.map(job => job.id), ['a', 'd']);
});

test('selecting a result honours the resume choice and depth, reuses the snapshot, and reaches a Question Set', async t => {
  const {model} = curating(({candidates}) => pick(candidates, 1));
  const {api} = await harness(t, model, {jobSource: sourceOf([posting('a')])});
  await api('/resume', {name: 'Practice resume', text: 'Built Python services.'});
  await api('/job-search-profile', {...emptyProfile(), roles: ['AI']});
  const run = (await api('/discovery', {})).data;
  const resultId = run.shortlist[0].id;

  const snapshot = (await api(`/discovery/${run.id}/select`, {resultId, useResume: true, difficulty: 'deeper'})).data;
  assert.equal(snapshot.difficulty, 'deeper');
  assert.equal(snapshot.resume.text, 'Built Python services.');
  assert.equal(snapshot.practiceVersion, 3);
  assert.equal(snapshot.sourceUrl, run.shortlist[0].sourceUrl);
  assert.equal(snapshot.capturedAt, run.capturedAt);
  assert.deepEqual((await api(`/discovery/${run.id}/select`, {resultId})).data, snapshot, 'selecting twice reuses the snapshot');

  const analysis = (await api(`/snapshots/${snapshot.id}/analysis`, {})).data;
  assert.ok(analysis.questions.length >= 8);
  assert.equal((await api(`/discovery/${run.id}/select`, {resultId, difficulty: 'nonsense'})).status, 400);
});

test('a search leaves existing practice data untouched and prunes old runs', async t => {
  const {model} = curating(({candidates}) => pick(candidates, 1));
  const {api} = await harness(t, model, {jobSource: sourceOf([posting('a')])});
  await api('/job-search-profile', {...emptyProfile(), roles: ['AI']});
  const first = (await api('/discovery', {})).data;
  const snapshot = (await api(`/discovery/${first.id}/select`, {resultId: first.shortlist[0].id})).data;
  await api(`/snapshots/${snapshot.id}/analysis`, {});
  const before = (await api('/workspace')).data;

  for (let i = 0; i < 4; i++) await api('/discovery', {});
  const after = (await api('/workspace')).data;
  assert.equal(Object.keys(after.discoveryRuns).length, 3, 'old runs are pruned');
  assert.deepEqual(after.records, before.records);
  assert.deepEqual(after.snapshots, before.snapshots, 'a search never touches saved Job Snapshots');
  assert.deepEqual(after.analyses, before.analyses);
});
