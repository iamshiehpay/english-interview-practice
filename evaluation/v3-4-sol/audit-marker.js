import assert from 'node:assert/strict';
import {readFile,writeFile,unlink,lstat} from 'node:fs/promises';
import {basename,join,resolve} from 'node:path';
import {isolationFingerprint} from '../../src/codex-audit.js';
import {writeJsonAtomic} from '../checkpoints.js';

const command=process.argv[2];
assert.ok(['status','backup','restore'].includes(command),'Use status, backup or restore');
const profile=resolve(process.env.COACH_CODEX_HOME||'.coach-codex');
assert.equal(basename(profile),'.coach-codex','Only a dedicated coach profile may be used');
assert.equal((await lstat(profile)).isSymbolicLink(),false,'Coach profile may not be a symlink');
const markerPath=join(profile,'isolation-verification.json');
const backupPath=join(profile,'isolation-verification-luna-backup.json');
const fingerprint=await isolationFingerprint();
const read=async path=>JSON.parse(await readFile(path,'utf8'));
const valid=(marker,model)=>marker?.passed===true&&marker.model===model&&marker.fingerprint===fingerprint;
const current=await read(markerPath);
if(command==='status'){
  let backupExists=false;try{await read(backupPath);backupExists=true;}catch(error){if(error.code!=='ENOENT')throw error;}
  console.log(JSON.stringify({currentModel:current.model,currentSourceVerified:current.passed===true&&current.fingerprint===fingerprint,backupExists}));
}else if(command==='backup'){
  assert.ok(valid(current,'gpt-5.6-luna'),'A currently valid Luna marker is required before Sol verification');
  await writeFile(backupPath,JSON.stringify(current,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({backedUp:'gpt-5.6-luna',sourceFingerprintMatches:true}));
}else{
  const backup=await read(backupPath);
  assert.ok(valid(backup,'gpt-5.6-luna'),'Saved Luna marker is not valid for current source');
  assert.ok(valid(current,'gpt-5.6-sol')||valid(current,'gpt-5.6-luna'),'Current audit marker is not a valid Sol or Luna verification');
  await writeJsonAtomic(markerPath,backup);
  await unlink(backupPath);
  console.log(JSON.stringify({restored:'gpt-5.6-luna',sourceFingerprintMatches:true}));
}
