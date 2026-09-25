// Isolated browser target for AI-persona acceptance. A reservation is durably
// written before every Codex json request, including validator retries.
import {randomUUID} from 'node:crypto';
import {mkdir, mkdtemp, open, readFile, readdir, realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {writeJsonAtomic} from '../evaluation/checkpoints.js';
import {configuredProviders} from '../src/cloud.js';
import {createApplication, operationBudgets} from '../src/server.js';

export async function meterCodexJson(provider, {directory, cap}) {
  if (!Number.isSafeInteger(cap) || cap < 1) throw Error('A positive integer request cap is required');
  if (typeof provider.json !== 'function') throw Error('Codex JSON provider required');
  const path = join(directory, 'persona-model-attempts');
  const budgetPath = join(directory, 'persona-model-budget.json');
  await mkdir(directory, {recursive: true, mode: 0o700});
  const budget = {schemaVersion: 1, cap, provider: provider.name};
  let first;
  try { first = await open(budgetPath, 'wx', 0o600); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  if (first) {
    try { await first.writeFile(JSON.stringify(budget) + '\n'); await first.sync(); }
    finally { await first.close(); }
  } else {
    let previous;
    for (let attempt = 0; attempt < 20; attempt++) {
      try { previous = JSON.parse(await readFile(budgetPath, 'utf8')); break; }
      catch (error) { if (attempt === 19 || error.code !== undefined && error.code !== 'ENOENT') throw error; await new Promise(done => setTimeout(done, 10)); }
    }
    if (JSON.stringify(previous) !== JSON.stringify(budget)) throw Error('Invalid or changed persona request budget');
  }
  await mkdir(path, {recursive: true, mode: 0o700});
  const original = provider.json.bind(provider);
  provider.json = async (...args) => {
    let slot;
    for (let index = 1; index <= cap; index++) {
      const candidate = join(path, String(index).padStart(4, '0'));
      try { await mkdir(candidate); slot = candidate; break; }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    if (!slot) throw Error(`Persona model request cap exhausted (${cap}/${cap})`);
    const parent = await open(path, 'r');
    try { await parent.sync(); } finally { await parent.close(); }
    const id = randomUUID();
    await writeJsonAtomic(join(slot, 'reservation.json'), {id, reservedAt: new Date().toISOString()});
    try {
      const value = await original(...args);
      await writeJsonAtomic(join(slot, 'result.json'), {state: 'completed', finishedAt: new Date().toISOString()});
      return value;
    } catch (error) {
      await writeJsonAtomic(join(slot, 'result.json'), {state: 'failed', finishedAt: new Date().toISOString()});
      throw error;
    }
  };
  return path;
}

export async function readPersonaAttempts(path) {
  const slots = (await readdir(path)).filter(name => /^\d{4}$/.test(name)).sort();
  return Promise.all(slots.map(async name => {
    const slot = join(path, name);
    let reservation = null, result = null;
    try { reservation = JSON.parse(await readFile(join(slot, 'reservation.json'), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    try { result = JSON.parse(await readFile(join(slot, 'result.json'), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    return {slot: Number(name), ...reservation, state: result?.state || 'reserved', ...(result?.finishedAt ? {finishedAt: result.finishedAt} : {})};
  }));
}

async function isolatedDirectory(candidate) {
  const root = await realpath(tmpdir());
  const directory = candidate ? resolve(candidate) : await mkdtemp(join(root, 'coach-v33-persona-'));
  await mkdir(directory, {recursive: true, mode: 0o700});
  const actual = await realpath(directory);
  if (!actual.startsWith(root + sep)) throw Error('Persona workspace must be inside the system temporary directory');
  return actual;
}

async function main() {
  const providerName = process.env.COACH_LANGUAGE_PROVIDER || 'fake';
  if (!['fake', 'codex'].includes(providerName)) throw Error('Persona harness allows only fake rehearsal or approved Codex use');
  if (process.env.COACH_SPEECH_PROVIDER && process.env.COACH_SPEECH_PROVIDER !== 'fake') throw Error('Persona harness requires fake speech');
  if (providerName === 'codex' && !process.argv.includes('--accept-subscription-usage')) throw Error('Explicit subscription-usage flag required');
  if (providerName === 'codex' && !process.env.COACH_CODEX_BIN) throw Error('Select the reviewed Codex binary with COACH_CODEX_BIN');
  if (providerName === 'codex' && !process.env.PERSONA_WORKSPACE_DIR) throw Error('Set one stable PERSONA_WORKSPACE_DIR for this approved Codex run and all restarts');
  const directory = await isolatedDirectory(process.env.PERSONA_WORKSPACE_DIR);
  const {languageModel, speechProvider} = configuredProviders({...process.env, COACH_LANGUAGE_PROVIDER: providerName, COACH_SPEECH_PROVIDER: 'fake', GREENHOUSE_BOARD: '', GREENHOUSE_BOARDS: ''});
  const cap = Number(process.env.PERSONA_MODEL_REQUEST_CAP);
  const ledger = providerName === 'codex' ? await meterCodexJson(languageModel, {directory, cap}) : null;
  const {server} = await createApplication({directory, languageModel, speechProvider, ...operationBudgets({...process.env, COACH_LANGUAGE_PROVIDER: providerName})});
  await new Promise((resolveListen, rejectListen) => { server.once('error', rejectListen); server.listen(0, '127.0.0.1', resolveListen); });
  const port = server.address().port;
  if (port === 4310) { await new Promise(done => server.close(done)); throw Error('Refusing port 4310'); }
  console.log(JSON.stringify({url: `http://127.0.0.1:${port}`, directory, provider: languageModel.name, cap: ledger ? cap : 0, ledger}));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
