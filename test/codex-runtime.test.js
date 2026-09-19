import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,lstat,rm,chmod,rename,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {createRuntime} from '../src/codex-runtime.js';
test('private runtime scavenges dead owners, preserves live requests, and verifies deletion',async t=>{
 const profile=await mkdtemp(join(tmpdir(),'coach-runtime-test-'));const a=await createRuntime(profile);t.after(async()=>{await rm(dirname(a.directory),{recursive:true,force:true});await rm(profile,{recursive:true,force:true});});
 assert.equal((await lstat(a.directory)).mode&0o077,0);
 await writeFile(join(a.directory,'synthetic-input'),'SYNTHETIC');
 const b=await createRuntime(profile);assert.ok(await lstat(a.directory));await b.cleanup();await assert.rejects(lstat(b.directory),{code:'ENOENT'});
 await writeFile(join(a.directory,'owner.json'),JSON.stringify({parent:2147483647,child:process.pid}));await assert.rejects(createRuntime(profile),{status:503});
 await writeFile(join(a.directory,'owner.json'),JSON.stringify({parent:2147483647,child:2147483646}));const c=await createRuntime(profile);await assert.rejects(lstat(a.directory),{code:'ENOENT'});await c.cleanup();
});

test('unknown orphan identity and unexpected entries fail closed',async t=>{
 const profile=await mkdtemp(join(tmpdir(),'coach-runtime-test-'));const a=await createRuntime(profile);const root=dirname(a.directory);t.after(async()=>{await rm(root,{recursive:true,force:true});await rm(profile,{recursive:true,force:true});});
 await writeFile(join(a.directory,'owner.json'),JSON.stringify({parent:2147483647,child:null}));await assert.rejects(createRuntime(profile),{status:503});assert.ok(await lstat(a.directory));
 await writeFile(join(a.directory,'owner.json'),'malformed');await assert.rejects(createRuntime(profile),/Unverifiable/);assert.ok(await lstat(a.directory));
 await a.cleanup();await writeFile(join(root,'unexpected'),'synthetic');await assert.rejects(createRuntime(profile),{status:503});
});

test('runtime root rejects public permissions and symlink redirection',async t=>{
 const profile=await mkdtemp(join(tmpdir(),'coach-runtime-test-'));const a=await createRuntime(profile);const root=dirname(a.directory),moved=root+'-saved';t.after(async()=>{await rm(root,{recursive:true,force:true});await rm(moved,{recursive:true,force:true});await rm(profile,{recursive:true,force:true});});
 await a.cleanup();await chmod(root,0o755);await assert.rejects(createRuntime(profile),{status:503});await chmod(root,0o700);
 await rename(root,moved);await symlink(moved,root);await assert.rejects(createRuntime(profile),{status:503});assert.ok(await lstat(moved));
});
