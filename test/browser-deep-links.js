import {strict as assert} from 'node:assert';
import {execFile} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {promisify} from 'node:util';
import {FakeLanguageModel} from '../src/providers.js';
import {createApplication} from '../src/server.js';

const exec = promisify(execFile);
const directory = await mkdtemp(join(tmpdir(), 'coach-deep-link-'));
const session = `coach-deep-link-${process.pid}`;
const browser = (...args) => exec('agent-browser', ['--session', session, ...args], {timeout:60000, maxBuffer:2000000});
const open = async url => { await browser('open', url); await browser('reload'); };
const run = code => browser('eval', `(async()=>{const wait=async(test,label)=>{for(let i=0;i<200;i++){if(test())return;await new Promise(resolve=>setTimeout(resolve,25));}throw Error(label+' / '+location.href+' / '+document.querySelector('#error')?.textContent+' / '+document.querySelector('.view.active')?.id+' / '+document.querySelector('#practice')?.innerText.slice(0,300));};${code}})()`);
let server;
try {
  const provider = new FakeLanguageModel();
  let analyses = 0;
  const analyze = provider.analyze.bind(provider);
  provider.analyze = (...args) => { analyses += 1; return analyze(...args); };
  ({server} = await createApplication({directory, languageModel:provider}));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const api = async (path, data, method) => {
    const response = await fetch(`${base}/api${path}`, {method:method || (data === undefined ? 'GET' : 'POST'), headers:{'Content-Type':'application/json'}, body:data === undefined ? undefined : JSON.stringify(data)});
    return {status:response.status, data:await response.json()};
  };
  const analyzed = (await api('/snapshots', {text:'Design reliable Python APIs.\nExplain engineering trade-offs.'})).data;
  const unopened = (await api('/snapshots', {text:'Maintain production Kubernetes services.'})).data;
  assert.equal((await api(`/snapshots/${analyzed.id}/analysis`, {})).status, 200);
  assert.equal(analyses, 1);

  await open(`${base}/#/snapshots/${analyzed.id}`);
  await run(`await wait(()=>document.querySelector('#recommended-question'),'analyzed direct link');if(!document.querySelector('#practice-view.active')||!document.body.innerText.includes('Design reliable Python APIs.'))throw Error('Direct link opened the wrong job');`);
  assert.deepEqual(Object.keys((await api('/workspace')).data.records), []);
  assert.equal(analyses, 1);
  await run(`document.querySelector('[data-view="home"]').click();await wait(()=>document.querySelector('#home-view.active')&&!location.hash,'home navigation clears link');`);
  await open(base);
  await run(`await wait(()=>document.querySelector('#home-view.active'),'normal home after reload');if(document.querySelector('#practice-view.active'))throw Error('Practice reopened after leaving its link');`);

  await open(`${base}/#/snapshots/${unopened.id}`);
  await run(`await wait(()=>document.querySelector('#analysis-retry button'),'unanalysed direct link');if(!document.querySelector('#practice-view.active')||document.querySelector('#analysis-retry button').textContent!=='產生題目')throw Error('Unanalysed link did not offer deliberate generation');`);
  assert.equal(analyses, 1, 'Opening a link must not call the model');
  assert.deepEqual(Object.keys((await api('/workspace')).data.records), []);

  await open(`${base}/#/snapshots/${randomUUID()}`);
  await run(`await wait(()=>document.querySelector('#history-view.active')&&document.querySelector('#error').textContent.includes('連結找不到'),'unknown snapshot');if(location.hash)throw Error('Invalid link was retained');`);
  await open(`${base}/#/snapshots/not-a-uuid`);
  await run(`await wait(()=>document.querySelector('#history-view.active')&&document.querySelector('#error').textContent.includes('連結找不到'),'malformed snapshot');`);

  assert.equal((await api(`/snapshots/${unopened.id}`, undefined, 'DELETE')).status, 200);
  await open(`${base}/#/snapshots/${unopened.id}`);
  await run(`await wait(()=>document.querySelector('#history-view.active')&&document.querySelector('#error').textContent.includes('已刪除'),'deleted snapshot');`);
  assert.equal(analyses, 1);
  console.log('Browser deep links PASS: analyzed, unanalysed, unknown, malformed, deleted, and normal navigation.');
} finally {
  await browser('close').catch(() => {});
  if (server) await new Promise(resolve => server.close(resolve));
  await rm(directory, {recursive:true, force:true});
}
