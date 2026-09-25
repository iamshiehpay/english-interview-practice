import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {open,readFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {isolationFingerprint} from '../../src/codex-audit.js';
import {verifiedBinary} from '../../src/codex-sandbox.js';
import {writeJsonAtomic} from '../checkpoints.js';

assert.ok(process.argv.includes('--accept-subscription-usage'),'Explicit subscription-usage approval flag required');
const root=dirname(fileURLToPath(import.meta.url));
const path=join(root,'verification-attempt.json');
const profile=resolve(process.env.COACH_CODEX_HOME||'.coach-codex');
const binary=await verifiedBinary(process.env.COACH_CODEX_BIN||'codex');
const fingerprint=await isolationFingerprint();
const markerPath=join(profile,'isolation-verification.json');
const backupPath=join(profile,'isolation-verification-luna-backup.json');
const marker=JSON.parse(await readFile(markerPath,'utf8'));
const backup=JSON.parse(await readFile(backupPath,'utf8'));
assert.equal(marker.passed,true);
assert.equal(marker.model,'gpt-5.6-luna');
assert.equal(marker.fingerprint,fingerprint);
assert.deepEqual(backup,marker,'Backed-up Luna marker must match the current valid marker');
const record={schemaVersion:1,model:'gpt-5.6-sol',effort:'xhigh',serviceTier:'priority',sourceFingerprint:fingerprint,binarySha256:createHash('sha256').update(await readFile(binary)).digest('hex'),requestCap:1,status:'reserved',reservedAt:new Date().toISOString()};
// Exclusive create makes an interrupted or failed verification consume this slot forever.
const file=await open(path,'wx',0o600);
try{await file.writeFile(JSON.stringify(record,null,2)+'\n');await file.sync();}finally{await file.close();}
try{
  const {stdout}=await promisify(execFile)('npm',['run','codex:verify'],{cwd:join(root,'..','..'),env:{...process.env,COACH_CODEX_HOME:profile,COACH_CODEX_BIN:binary,COACH_CODEX_MODEL:'gpt-5.6-sol',COACH_CODEX_EFFORT:'xhigh',COACH_CODEX_SERVICE_TIER:'priority'},timeout:240000,maxBuffer:20000});
  assert.match(stdout,/PASS: one synthetic subscription response/,'Sol isolation verification did not confirm a successful response');
  const verified=JSON.parse(await readFile(markerPath,'utf8'));
  assert.equal(verified.passed,true);
  assert.equal(verified.model,'gpt-5.6-sol');
  assert.equal(verified.fingerprint,fingerprint);
  await writeJsonAtomic(path,{...record,status:'completed',completedAt:new Date().toISOString(),markerVerifiedAt:verified.verifiedAt});
  console.log('Sol isolation verification passed; 1/17 subscription requests consumed.');
}catch(error){
  await writeJsonAtomic(path,{...record,status:'failed',failedAt:new Date().toISOString(),error:error.message});
  throw Error('Sol isolation verification failed; its one-request slot is consumed, and no retry is authorized');
}
