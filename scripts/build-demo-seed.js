import assert from 'node:assert/strict';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApplication} from '../src/server.js';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const work=await mkdtemp(join(tmpdir(),'coach-demo-seed-'));
const {server}=await createApplication({directory:work});

async function api(path,data,method=data===undefined?'GET':'POST') {
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{
    method,
    headers:{'Content-Type':'application/json'},
    body:data===undefined?undefined:JSON.stringify(data)
  });
  const result=await response.json();
  assert.equal(response.status,200,`${method} ${path}: ${result.error || response.status}`);
  return result;
}

try {
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const snapshot=await api('/snapshots',{text:`Synthetic Backend Engineer Demo\n\nResponsibilities\n- Build reliable Node.js APIs for a fictional interview practice product.\n- Explain engineering trade-offs and validate changes with automated tests.\n- Collaborate with product and design partners.\n\nRequirements\n- Experience with JavaScript, HTTP APIs, testing, and cloud deployment.\n- Clear written and spoken communication.`,useResume:false,difficulty:'standard'});
  await api(`/snapshots/${snapshot.id}/title`,{title:'Synthetic Backend Engineer'});
  const analysis=await api(`/snapshots/${snapshot.id}/analysis`,{});
  const question=analysis.questions.find(item=>item.source!=='common');
  const record=await api('/records',{snapshotId:snapshot.id,questionId:question.id});
  await api(`/records/${record.id}/attempts`,{transcript:'I would begin by defining the reliability target, add an integration test for the riskiest request path, and deploy a small revision. I would compare errors and latency before expanding traffic.'});
  await api(`/records/${record.id}/feedback`,{});
  await api(`/records/${record.id}/complete`,{focusPoint:'補上一個具體的驗證結果與數字'});
  const workspace=await api('/workspace');
  const output=join(root,'demo','seed','workspace.json');
  await mkdir(dirname(output),{recursive:true});
  await writeFile(output,`${JSON.stringify(workspace,null,2)}\n`,{mode:0o600});
  console.log(`Wrote synthetic public-demo seed to ${output}`);
} finally {
  await new Promise(resolve=>server.close(resolve));
  await rm(work,{recursive:true,force:true});
}
