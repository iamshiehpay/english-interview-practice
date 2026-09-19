import {mkdir,mkdtemp,writeFile,readFile,readdir,lstat,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {requireValue} from './domain.js';
const alive=pid=>{if(!Number.isSafeInteger(pid)||pid<=0)return false;try{process.kill(pid,0);return true;}catch(e){return e.code!=='ESRCH';}};
export async function removeRuntime(directory){await rm(directory,{recursive:true,force:true});try{await lstat(directory);}catch(e){if(e.code==='ENOENT')return;throw e;}throw new Error('Codex temporary directory cleanup failed');}
export async function createRuntime(profile){
 const key=createHash('sha256').update(resolve(profile)).digest('hex').slice(0,20);
 const root=join(tmpdir(),'coach-codex-private-'+key);await mkdir(root,{recursive:true,mode:0o700});const stat=await lstat(root);requireValue(stat.isDirectory()&&!stat.isSymbolicLink()&&(stat.mode&0o077)===0,'Codex runtime root must be private',503);
 for(const entry of await readdir(root,{withFileTypes:true})){
  requireValue(entry.isDirectory()&&!entry.isSymbolicLink()&&entry.name.startsWith('coach-codex-run-'),'Unexpected Codex runtime entry',503);
  const path=join(root,entry.name);let owner;try{owner=JSON.parse(await readFile(join(path,'owner.json'),'utf8'));}catch{throw new Error('Unverifiable Codex runtime owner; inspect inactive leftovers before retrying');}
  if(alive(owner.parent))continue;
  requireValue(Number.isSafeInteger(owner.child)&&owner.child>0,'Unknown prior Codex child; inspect inactive leftovers before retrying',503);
  requireValue(!alive(owner.child),'A previous Codex process is still running; close it before retrying',503);await removeRuntime(path);
 }
 const directory=await mkdtemp(join(root,'coach-codex-run-'));
 const register=child=>writeFile(join(directory,'owner.json'),JSON.stringify({parent:process.pid,child:child||null}),{mode:0o600});await register();
 return {directory,register,cleanup:()=>removeRuntime(directory)};
}
