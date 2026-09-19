import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './helpers.js';
import {FakeJobSource,GreenhouseJobSource} from '../src/jobs.js';
import {AppError} from '../src/domain.js';
const profile={roles:['engineer'],locations:['Taipei'],seniority:['mid'],workArrangements:['hybrid'],priorities:['Python'],exclusions:['Senior']};
test('editable profile filters with explanations; immutable selection uses captured server result',async t=>{
 const source=new FakeJobSource();let calls=0;const original=source.search.bind(source);source.search=async()=>{calls++;return original();};const {api}=await harness(t,undefined,{jobSource:source});
 assert.deepEqual((await api('/job-search-profile',profile)).data,profile);assert.deepEqual((await api('/job-search-profile')).data,profile);
 const run=(await api('/discovery',{})).data;assert.equal(run.results.length,1);assert.ok(run.results[0].reasons.some(r=>r.includes('Python')));assert.equal(calls,1);
 const s=(await api(`/discovery/${run.id}/select`,{resultId:run.results[0].id,text:'tampered'})).data;assert.equal(s.text,run.results[0].text);assert.equal(s.sourceUrl,run.results[0].sourceUrl);assert.ok(Date.parse(s.capturedAt));assert.equal(calls,1);
 assert.deepEqual((await api(`/discovery/${run.id}/select`,{resultId:run.results[0].id})).data,s);
 source.search=async()=>{throw Error('offline');};assert.equal((await api('/discovery',{})).status,502);assert.deepEqual((await api(`/snapshots/${s.id}`)).data,s);assert.equal((await api(`/snapshots/${s.id}/analysis`,{})).status,200);
 assert.equal((await api('/snapshots',{text:'Paste fallback'})).status,200);
});
test('exclusions, empty results and malformed profile preserve existing state',async t=>{
 const {api}=await harness(t);await api('/job-search-profile',{...profile,exclusions:['PYTHON']});assert.equal((await api('/discovery',{})).data.results.length,0);
 const before=(await api('/job-search-profile')).data;assert.equal((await api('/job-search-profile',{roles:'bad'})).status,400);assert.deepEqual((await api('/job-search-profile')).data,before);
 assert.equal((await api('/snapshots/from-url',{url:'http://127.0.0.1/'})).status,400);assert.equal((await api('/snapshots',{text:'Fallback'})).status,200);
});
test('source rate limit, timeout and oversized results fail once without partial writes',async t=>{
 let mode='rate',calls=0;const source={name:'fixture',async search(){calls++;if(mode==='rate')throw new AppError('Rate limit; retry later',429);if(mode==='timeout')return new Promise(()=>{});return Array(101).fill({});}};
 const {api}=await harness(t,undefined,{jobSource:source,sourceTimeoutMs:20});
 for(const [m,status] of [['rate',429],['timeout',504],['large',502]]){mode=m;const before=(await api('/workspace')).data;assert.equal((await api('/discovery',{})).status,status);assert.deepEqual((await api('/workspace')).data,before);}assert.equal(calls,3);
});
test('configured Greenhouse adapter uses bounded GET-only canonical URLs',async t=>{
 const requests=[];const job={id:123,title:'Software Engineer',location:{name:'Taipei'},content:'&lt;p&gt;Build Python APIs&lt;/p&gt;',absolute_url:'https://job-boards.greenhouse.io/testboard/jobs/123'};
 const source=new GreenhouseJobSource('testboard',async(url,options)=>{requests.push({url,options});return new Response(JSON.stringify(url.includes('?')?{jobs:[job]}:job));});
 const {api}=await harness(t,undefined,{jobSource:source});assert.equal((await api('/discovery',{})).data.results.length,1);
 const s=(await api('/snapshots/from-url',{url:job.absolute_url})).data;assert.ok(s.text.includes('Build Python APIs'));assert.ok(!s.text.includes('<p>'));
 for(const url of ['file:///etc/passwd','http://127.0.0.1/','https://evil.example/jobs/123','https://job-boards.greenhouse.io/other/jobs/123','https://user:pass@job-boards.greenhouse.io/testboard/jobs/123'])assert.equal((await api('/snapshots/from-url',{url})).status,400);
 assert.equal(requests.length,2);assert.ok(requests.every(r=>r.options.method==='GET'&&r.options.redirect==='error'&&r.options.signal));
});
test('duplicate source IDs reject and discovery retention never deletes selected snapshots',async t=>{
 const source=new FakeJobSource(),original=source.search.bind(source);const {api}=await harness(t,undefined,{jobSource:source});
 source.search=async()=>{const jobs=await original();return [jobs[0],jobs[0]];};assert.equal((await api('/discovery',{})).status,502);
 source.search=original;const first=(await api('/discovery',{})).data;const s=(await api(`/discovery/${first.id}/select`,{resultId:first.results[0].id})).data;
 for(let i=0;i<3;i++)assert.equal((await api('/discovery',{})).status,200);
 assert.equal(Object.keys((await api('/workspace')).data.discoveryRuns).length,3);assert.deepEqual((await api(`/snapshots/${s.id}`)).data,s);
});
