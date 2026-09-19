import {readFile,readdir,lstat,writeFile} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {AppError,requireValue} from './domain.js';
export async function isolationFingerprint(){
 const hash=createHash('sha256');for(const name of ['codex-language.js','codex-profile.js','codex-rpc.js','codex-audit.js','codex-sandbox.js','codex-runtime.js'])hash.update(await readFile(fileURLToPath(new URL(name,import.meta.url))));return hash.digest('hex');
}
export async function requireAudit(profile,model){
 let marker;try{marker=JSON.parse(await readFile(join(profile,'isolation-verification.json'),'utf8'));}catch{throw new AppError('Run npm run codex:verify before using subscription coaching',428);}
 requireValue(marker.passed===true&&marker.model===model&&marker.fingerprint===await isolationFingerprint(),'Codex isolation verification is missing or stale; run npm run codex:verify',428);
}
export async function scanCanary(directory,canary){
 let bytes=0;
 async function visit(path){for(const entry of await readdir(path,{withFileTypes:true})){
   // OAuth contents are owned by Codex and must never be inspected by the app.
   if(/auth|credential|login/i.test(entry.name))continue;
   const file=join(path,entry.name);if(entry.isSymbolicLink())continue;if(entry.isDirectory())await visit(file);else if(entry.isFile()){
    const stat=await lstat(file);bytes+=stat.size;requireValue(bytes<=30_000_000,'Codex audit file limit exceeded',503);
    requireValue(!(await readFile(file)).includes(Buffer.from(canary)),`Codex retained the synthetic audit input in ${relative(directory,file)}`,503);
   }
 }}
 await visit(directory);
}
export async function saveAudit(profile,model,expected){const actual=await isolationFingerprint();expected??=actual;requireValue(expected===actual,'Codex source changed during verification; retry the audit',503);await writeFile(join(profile,'isolation-verification.json'),JSON.stringify({passed:true,model,fingerprint:expected,verifiedAt:new Date().toISOString()},null,2)+'\n',{mode:0o600});}
