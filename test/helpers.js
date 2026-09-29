import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {createApplication} from '../src/server.js';
import {FakeLanguageModel} from '../src/providers.js';
export async function harness(t, provider = new FakeLanguageModel(), options = {}) {
  const directory=await mkdtemp(join(tmpdir(),'coach-'));
  const {server,store}=await createApplication({directory,languageModel:provider,...options});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(async()=>{await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`;
  const api=async(path,data,method)=>{const res=await fetch(base+'/api'+path,{method:method||(data===undefined?'GET':'POST'),headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});return {status:res.status,data:await res.json()};};
  return {api,directory,server,base,store};
}
export async function setup(api) {
  const created=await api('/snapshots',{text:'Build reliable Python APIs.\nExplain engineering trade-offs.'});
  assert.equal(created.status,200,`snapshot setup failed: ${created.data?.error||JSON.stringify(created.data)}`);
  const snapshot=created.data;
  const analyzed=await api(`/snapshots/${snapshot.id}/analysis`,{});
  assert.equal(analyzed.status,200,`analysis setup failed: ${analyzed.data?.error||JSON.stringify(analyzed.data)}`);
  const analysis=analyzed.data;
  const question=analysis.questions.find(question => question.source !== 'common');
  assert.ok(question,'analysis setup returned no generated question');
  const opened=await api('/records',{snapshotId:snapshot.id,questionId:question.id});
  assert.equal(opened.status,200,`record setup failed: ${opened.data?.error||JSON.stringify(opened.data)}`);
  const record=opened.data;
  return {snapshot,analysis,record};
}
