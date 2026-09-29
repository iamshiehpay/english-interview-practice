import {lstat, readdir, rename, writeFile} from 'node:fs/promises';
import {relative, resolve} from 'node:path';
import {requireValue} from './domain.js';

async function fileSize(path) {
  try { const stat=await lstat(path);return stat.isFile() ? stat.size : 0; }
  catch (error) { if (error.code === 'ENOENT') return 0; throw error; }
}

export class WorkspaceQuota {
  constructor(root, maxBytes = Infinity) {
    requireValue(maxBytes === Infinity || Number.isInteger(maxBytes) && maxBytes > 0, 'Workspace limit must be a positive number');
    this.root=resolve(root);this.maxBytes=maxBytes;this.tail=Promise.resolve();
  }
  path(path) {
    const target=resolve(path), rel=relative(this.root,target);
    requireValue(rel && !rel.startsWith('..') && !rel.includes(`..${process.platform === 'win32' ? '\\' : '/'}`), 'Workspace path escaped its root', 500);
    return target;
  }
  async usage(directory = this.root) {
    let total=0;
    try {
      for (const entry of await readdir(directory,{withFileTypes:true})) {
        const path=resolve(directory,entry.name);
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) total+=await this.usage(path);
        else if (entry.isFile()) total+=(await lstat(path)).size;
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    return total;
  }
  run(work) { const pending=this.tail.then(work);this.tail=pending.catch(()=>{});return pending; }
  async assert(nextBytes, replacedBytes = 0) {
    if (this.maxBytes === Infinity) return;
    requireValue(await this.usage() - replacedBytes + nextBytes <= this.maxBytes, `Demo workspace limit of ${this.maxBytes} bytes reached`, 413);
  }
  write(path, contents, options) {
    path=this.path(path);
    return this.run(async()=>{await this.assert(Buffer.byteLength(contents),await fileSize(path));await writeFile(path,contents,options);});
  }
  replaceAtomic(path, contents, options) {
    path=this.path(path);const temporary=`${path}.tmp`;this.path(temporary);
    return this.run(async()=>{
      await this.assert(Buffer.byteLength(contents),await fileSize(path)+await fileSize(temporary));
      await writeFile(temporary,contents,options);await rename(temporary,path);
    });
  }
}
