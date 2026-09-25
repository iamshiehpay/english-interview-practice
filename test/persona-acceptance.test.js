import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {meterCodexJson, readPersonaAttempts} from '../scripts/persona-acceptance.js';

test('persona model cap reserves every request, including failed calls, and survives restart', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'coach-persona-meter-test-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  let calls = 0;
  const provider = {name: 'Codex test', async json() { calls++; if (calls === 1) throw Error('failed provider call'); return {ok: true}; }};
  const path = await meterCodexJson(provider, {directory, cap: 2});
  await assert.rejects(provider.json(), /failed provider call/);
  assert.deepEqual(await provider.json(), {ok: true});
  await assert.rejects(provider.json(), /cap exhausted/);
  assert.equal(calls, 2);
  const attempts = await readPersonaAttempts(path);
  assert.deepEqual(attempts.map(attempt => attempt.state), ['failed', 'completed']);
  const restarted = {name: 'Codex test', async json() { calls++; }};
  await meterCodexJson(restarted, {directory, cap: 2});
  await assert.rejects(restarted.json(), /cap exhausted/);
  assert.equal(calls, 2);
});

test('two independent metered providers cannot both spend the last slot', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'coach-persona-meter-race-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  let calls = 0;
  const first = {name: 'Codex test', async json() { calls++; return 'one'; }};
  const second = {name: 'Codex test', async json() { calls++; return 'two'; }};
  const [path] = await Promise.all([meterCodexJson(first, {directory, cap: 1}), meterCodexJson(second, {directory, cap: 1})]);
  const outcomes = await Promise.allSettled([first.json(), second.json()]);
  assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(outcome => outcome.status === 'rejected').length, 1);
  assert.equal(calls, 1);
  assert.equal((await readPersonaAttempts(path)).length, 1);
});

test('Codex launcher requires the same explicit temporary workspace on every start', () => {
  const {PERSONA_WORKSPACE_DIR: omitted, ...env} = process.env;
  const run = spawnSync(process.execPath, ['scripts/persona-acceptance.js', '--accept-subscription-usage'], {env: {...env, COACH_LANGUAGE_PROVIDER: 'codex', COACH_CODEX_BIN: '/unused/reviewed/codex', PERSONA_MODEL_REQUEST_CAP: '28'}, encoding: 'utf8'});
  assert.equal(run.status, 1);
  assert.match(run.stderr, /stable PERSONA_WORKSPACE_DIR/);
});
