import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './helpers.js';
import {FakeLanguageModel} from '../src/providers.js';
import {profileFields} from '../src/jobs.js';

const legacyProfile = {roles:['engineer'],locations:['Taipei'],seniority:['mid'],workArrangements:['hybrid'],priorities:['Python'],exclusions:['Senior']};

test('a request becomes a proposal with unstated fields left empty, and nothing is saved until confirmed', async t => {
  const model = new FakeLanguageModel();
  const seen = [];
  const original = model.interpretSearch.bind(model);
  model.interpretSearch = async args => { seen.push(args); return original(args); };
  const {api} = await harness(t, model);

  const before = (await api('/job-search-profile')).data;
  assert.deepEqual(Object.keys(before).sort(), [...profileFields].sort());
  assert.ok(profileFields.every(field => before[field].length === 0), 'a fresh profile is empty, never guessed');

  const result = (await api('/discovery/interpret', {request: '根據我的履歷，幫我找台灣適合轉職的 AI 職缺，最好能遠端'})).data;
  assert.equal(seen.length, 1);
  assert.equal(seen[0].request, '根據我的履歷，幫我找台灣適合轉職的 AI 職缺，最好能遠端');
  assert.deepEqual(Object.keys(result.proposal).sort(), [...profileFields].sort());
  assert.ok(result.proposal.roles.length, 'a stated role is extracted');
  assert.ok(result.proposal.locations.length, 'a stated location is extracted');
  assert.ok(result.proposal.workArrangements.length, 'a stated work arrangement is extracted');
  assert.deepEqual(result.proposal.exclusions, [], 'an unstated field stays empty');
  assert.ok(Date.parse(result.interpretedAt));

  // The proposal is shown for confirmation; it is not the saved profile.
  assert.deepEqual((await api('/job-search-profile')).data, before, 'interpreting must not save the profile');

  // Confirming is an ordinary profile write.
  assert.deepEqual((await api('/job-search-profile', result.proposal)).data, result.proposal);
  assert.deepEqual((await api('/job-search-profile')).data, result.proposal);
});

test('a request that states nothing produces an empty proposal rather than invented criteria', async t => {
  const {api} = await harness(t);
  const result = (await api('/discovery/interpret', {request: 'I would like a job that is good.'})).data;
  assert.ok(profileFields.every(field => result.proposal[field].length === 0), `expected everything empty, got ${JSON.stringify(result.proposal)}`);
});

test('an invalid proposal is rejected as provider output and leaves the saved profile untouched', async t => {
  const model = new FakeLanguageModel();
  const {api} = await harness(t, model);
  await api('/job-search-profile', legacyProfile);
  const saved = (await api('/job-search-profile')).data;

  for (const bad of [
    {roles: 'not-a-list'},
    {...Object.fromEntries(profileFields.map(f => [f, []])), extra: []},
    {roles: [], locations: [], seniority: [], workArrangements: [], priorities: [], exclusions: []},
    {...Object.fromEntries(profileFields.map(f => [f, []])), roles: ['']},
    {...Object.fromEntries(profileFields.map(f => [f, []])), roles: Array.from({length: 21}, (_, i) => `role-${i}`)},
    {...Object.fromEntries(profileFields.map(f => [f, []])), roles: ['x'.repeat(101)]},
    null
  ]) {
    model.interpretSearch = async () => bad;
    const refused = await api('/discovery/interpret', {request: 'find me something'});
    assert.equal(refused.status, 502, `expected 502 for ${JSON.stringify(bad)}`);
    assert.deepEqual((await api('/job-search-profile')).data, saved, 'a rejected proposal must not change the saved profile');
  }
});

test('an empty or oversized request is refused before the provider is called', async t => {
  let calls = 0;
  const model = new FakeLanguageModel();
  model.interpretSearch = async () => { calls++; return Object.fromEntries(profileFields.map(f => [f, []])); };
  const {api} = await harness(t, model);
  assert.equal((await api('/discovery/interpret', {request: '   '})).status, 400);
  assert.equal((await api('/discovery/interpret', {request: 'x'.repeat(2001)})).status, 400);
  assert.equal((await api('/discovery/interpret', {})).status, 400);
  assert.equal(calls, 0);
});

test('a legacy six-field profile loads, and searching with the saved profile needs no new request text', async t => {
  const {api} = await harness(t, undefined, {jobSource: {name: 'fixture', async search() { return [{id: 'a', title: 'AI Software Engineer', location: 'Taipei', text: 'AI Software Engineer\nTaipei\nBuild Python services.', sourceUrl: 'https://example.com/a', source: 'fixture'}]; }}});
  assert.deepEqual((await api('/job-search-profile', legacyProfile)).data.salary, [], 'salary defaults empty for a legacy write');
  const withSalary = {...legacyProfile, salary: ['月薪 70k 以上']};
  assert.deepEqual((await api('/job-search-profile', withSalary)).data, withSalary);

  // Searching uses the saved profile; no interpretation is required.
  await api('/job-search-profile', {...Object.fromEntries(profileFields.map(f => [f, []])), roles: ['AI']});
  const run = (await api('/discovery', {})).data;
  assert.equal(run.results.length, 1);
});

test('interpretation is idempotent per request identifier and is cancellable', async t => {
  let calls = 0, release;
  const gate = new Promise(resolve => { release = resolve; });
  const model = new FakeLanguageModel();
  model.interpretSearch = async () => { calls++; await gate; return {...Object.fromEntries(profileFields.map(f => [f, []])), roles: ['AI Engineer']}; };
  const {api, base} = await harness(t, model);
  const send = requestId => fetch(`${base}/api/discovery/interpret`, {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Request-Id': requestId}, body: JSON.stringify({request: 'find me an AI job'})}).then(async r => ({status: r.status, data: await r.json()}));

  const first = send('interpret-request-one');
  while (!calls) await new Promise(r => setTimeout(r, 5));
  release();
  const done = await first;
  assert.equal(done.status, 200);
  assert.deepEqual(done.data.proposal.roles, ['AI Engineer']);

  // The same identifier replays the stored proposal rather than calling again.
  const replay = await send('interpret-request-one');
  assert.equal(replay.status, 200);
  assert.deepEqual(replay.data.proposal, done.data.proposal);
  assert.equal(calls, 1, 'a repeated request identifier must not call the provider twice');

  const operations = (await api('/operations')).data;
  assert.ok(operations.some(operation => operation.kind === 'interpret'), 'interpretation is tracked as an operation');
});

test('deleting all local data removes the saved search profile and the proposal', async t => {
  const {api} = await harness(t);
  await api('/discovery/interpret', {request: '幫我找台灣的 AI 職缺'});
  await api('/job-search-profile', legacyProfile);
  assert.ok((await api('/workspace')).data.jobSearchProposal);

  assert.equal((await api('/workspace/delete', {confirmation: 'DELETE ALL LOCAL DATA'})).status, 200);
  const after = (await api('/workspace')).data;
  assert.equal(after.jobSearchProfile, undefined);
  assert.equal(after.jobSearchProposal, undefined);
  const reset = (await api('/job-search-profile')).data;
  assert.ok(profileFields.every(field => reset[field].length === 0));
});
