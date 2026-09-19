import {mkdir, readFile, writeFile, rename} from 'node:fs/promises';
import {join} from 'node:path';

export class LocalWorkspace {
  constructor(directory) { this.directory = directory; this.file = join(directory, 'workspace.json'); this.tail = Promise.resolve(); }
  async open() {
    await mkdir(this.directory, {recursive: true, mode: 0o700});
    try { this.data = JSON.parse(await readFile(this.file, 'utf8')); }
    catch (e) { if (e.code !== 'ENOENT') throw e; this.data = {version: 1, snapshots: {}, analyses: {}, records: {}}; }
    return this;
  }
  async transact(update) {
    const work = this.tail.then(async () => {
      const next = structuredClone(this.data);
      const result = update(next);
      await writeFile(this.file + '.tmp', JSON.stringify(next), {mode: 0o600});
      await rename(this.file + '.tmp', this.file);
      this.data = next;
      return structuredClone(result);
    });
    this.tail = work.catch(() => {});
    return work;
  }
}
