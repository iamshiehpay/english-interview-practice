import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
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
  const snapshot=(await api('/snapshots',{text:'Build reliable Python APIs.\nExplain engineering trade-offs.'})).data;
  const analysis=(await api(`/snapshots/${snapshot.id}/analysis`,{})).data;
  const record=(await api('/records',{snapshotId:snapshot.id,questionId:analysis.questions[0].id})).data;
  return {snapshot,analysis,record};
}
