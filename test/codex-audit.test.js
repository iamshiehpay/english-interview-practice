import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir,homedir} from 'node:os';
import {saveAudit,requireAudit,scanCanary} from '../src/codex-audit.js';
import {sandboxPolicy} from '../src/codex-sandbox.js';
test('audit binds to model/source and rejects retained canary without inspecting credentials',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'coach-audit-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 await assert.rejects(requireAudit(directory,'model'),{status:428});await saveAudit(directory,'model');await requireAudit(directory,'model');await assert.rejects(requireAudit(directory,'different'),{status:428});
 await writeFile(join(directory,'auth.json'),'SYNTHETIC_CANARY');await scanCanary(directory,'SYNTHETIC_CANARY');await writeFile(join(directory,'unexpected-log'),'SYNTHETIC_CANARY');await assert.rejects(scanCanary(directory,'SYNTHETIC_CANARY'),{status:503});
});
test('sandbox grants exact executable content, never its potentially private parent directory',()=>{
 const bin=join(homedir(),'codex');const p=sandboxPolicy({binary:bin,profileDirectory:join(homedir(),'.coach-codex'),runtimeDirectory:'/private/tmp/coach-codex-run-test'});
 assert.ok(p.includes(`(literal ${JSON.stringify(bin)})`));assert.ok(!p.includes(`(subpath ${JSON.stringify(homedir())})`));assert.ok(p.includes('(deny process-fork)'));assert.ok(p.includes('(deny file-read-data'));
 assert.throws(()=>sandboxPolicy({binary:bin,profileDirectory:homedir(),runtimeDirectory:'/private/tmp/coach-codex-run-test'}));
});
