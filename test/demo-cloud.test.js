import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApplication} from '../src/server.js';
import {createDemoApplication} from '../src/demo-server.js';

async function request(base, path, {method = 'GET', data, cookie, origin = 'https://coach.example.com', host = 'coach.example.com', forwardedProto = 'https'} = {}) {
  const url = new URL(path, base);
  const body = data === undefined ? undefined : JSON.stringify(data);
  return new Promise((resolve, reject) => {
    const req = http.request({hostname:url.hostname, port:url.port, path:url.pathname, method, headers:{Host:host, ...(forwardedProto ? {'X-Forwarded-Proto':forwardedProto} : {}), ...(origin ? {Origin:origin} : {}), ...(cookie ? {Cookie:cookie} : {}), ...(body ? {'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)} : {})}}, res => {
      let raw='';res.setEncoding('utf8');res.on('data',chunk=>raw+=chunk);res.on('end',()=>resolve({status:res.statusCode, headers:res.headers, data:raw?JSON.parse(raw):null}));
    });
    req.on('error',reject);if(body)req.write(body);req.end();
  });
}

function cookieOf(response) { return response.headers['set-cookie']?.[0]?.split(';')[0]; }

async function harness(t, options = {}) {
  const directory=await mkdtemp(join(tmpdir(),'coach-demo-test-'));
  const seed=join(directory,'seed');await mkdir(seed);
  await writeFile(join(seed,'workspace.json'),JSON.stringify({version:1,snapshots:{seed:{id:'seed',text:'Synthetic demo job'}},analyses:{},records:{}}));
  const demo=await createDemoApplication({applicationFactory:createApplication,rootDirectory:join(directory,'runtime'),seedDirectory:seed,logger:()=>{},...options});
  await new Promise((resolve,reject)=>{demo.server.once('error',reject);demo.server.listen(0,'127.0.0.1',resolve);});
  t.after(async()=>{await new Promise(resolve=>demo.server.close(resolve));await demo.close();await rm(directory,{recursive:true,force:true});});
  return {...demo,base:`http://127.0.0.1:${demo.server.address().port}`};
}

test('public health is session-free and demo workspaces are isolated by secure cookies', async t => {
  const demo=await harness(t);
  const health=await request(demo.base,'/api/health',{origin:null});
  assert.equal(health.status,200);assert.equal(health.data.mode,'demo');assert.equal(health.headers['set-cookie'],undefined);assert.equal(demo.sessionCount(),0);

  const first=await request(demo.base,'/api/workspace');
  const second=await request(demo.base,'/api/workspace');
  const firstCookie=cookieOf(first), secondCookie=cookieOf(second);
  assert.equal(first.status,200);assert.ok(firstCookie);assert.notEqual(firstCookie,secondCookie);
  assert.match(first.headers['set-cookie'][0],/HttpOnly/);assert.match(first.headers['set-cookie'][0],/Secure/);assert.match(first.headers['set-cookie'][0],/SameSite=Lax/);
  assert.equal(first.data.snapshots.seed.text,'Synthetic demo job');assert.equal(second.data.snapshots.seed.text,'Synthetic demo job');

  assert.equal((await request(demo.base,'/api/resume',{method:'POST',cookie:firstCookie,data:{text:'Synthetic visitor one resume'}})).status,200);
  assert.equal((await request(demo.base,'/api/workspace',{cookie:firstCookie})).data.resume.text,'Synthetic visitor one resume');
  const refreshed=await request(demo.base,'/api/workspace',{cookie:secondCookie});
  assert.equal(refreshed.data.resume,undefined);assert.equal(cookieOf(refreshed),secondCookie);

  const providers=await request(demo.base,'/api/providers',{cookie:firstCookie});
  assert.equal(providers.data.deployment.mode,'demo');assert.equal(providers.data.languageModel.external,false);assert.equal(providers.data.speech.external,false);assert.equal(providers.data.jobSource.external,false);assert.ok(providers.data.speech.recordingMaxBytes<2_000_000);
});

test('public mode accepts its HTTPS origin and rejects a different origin', async t => {
  const demo=await harness(t);
  assert.equal((await request(demo.base,'/api/workspace')).status,200);
  const rejected=await request(demo.base,'/api/workspace',{origin:'https://evil.example'});
  assert.equal(rejected.status,403);assert.equal(rejected.data.error,'Cross-origin request rejected');
});

test('public mode accepts a direct loopback HTTP origin for local container review', async t => {
  const demo=await harness(t), host=new URL(demo.base).host;
  const response=await request(demo.base,'/api/workspace',{host,origin:`http://${host}`,forwardedProto:null});
  assert.equal(response.status,200);assert.equal(response.data.snapshots.seed.text,'Synthetic demo job');
});

test('idle and oldest inactive demo workspaces are evicted without sharing state', async t => {
  let now=1_000;
  const demo=await harness(t,{now:()=>now,idleMs:1_000,maxSessions:1});
  const first=await request(demo.base,'/api/workspace');const firstCookie=cookieOf(first);
  const replacement=await request(demo.base,'/api/workspace');const replacementCookie=cookieOf(replacement);
  assert.notEqual(firstCookie,replacementCookie);assert.equal(demo.sessionCount(),1);

  now+=1_001;
  const expired=await request(demo.base,'/api/workspace',{cookie:replacementCookie});
  assert.notEqual(cookieOf(expired),replacementCookie);assert.equal(demo.sessionCount(),1);
});

test('parallel visitors never exceed the configured session cap', async t => {
  const demo=await harness(t,{maxSessions:3});
  const responses=await Promise.all(Array.from({length:12},()=>request(demo.base,'/api/workspace')));
  assert.ok(responses.every(response=>response.status===200));
  assert.equal(demo.sessionCount(),3);
  assert.equal(new Set(responses.map(cookieOf)).size,12);
});

test('a demo process restart discards every visitor workspace', async t => {
  const directory=await mkdtemp(join(tmpdir(),'coach-demo-restart-'));
  const seed=join(directory,'seed');await mkdir(seed);
  await writeFile(join(seed,'workspace.json'),JSON.stringify({version:1,snapshots:{seed:{id:'seed',text:'Synthetic demo job'}},analyses:{},records:{}}));
  const root=join(directory,'runtime');
  const first=await createDemoApplication({applicationFactory:createApplication,rootDirectory:root,seedDirectory:seed,logger:()=>{}});
  await new Promise(resolve=>first.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${first.server.address().port}`;
  const opened=await request(base,'/api/workspace');const cookie=cookieOf(opened);
  await request(base,'/api/resume',{method:'POST',cookie,data:{text:'Synthetic state that must disappear'}});
  await new Promise(resolve=>first.server.close(resolve));await first.close();

  const second=await createDemoApplication({applicationFactory:createApplication,rootDirectory:root,seedDirectory:seed,logger:()=>{}});
  await new Promise(resolve=>second.server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>second.server.close(resolve));await second.close();await rm(directory,{recursive:true,force:true});});
  const restarted=await request(`http://127.0.0.1:${second.server.address().port}`,'/api/workspace',{cookie});
  assert.equal(restarted.data.resume,undefined);assert.notEqual(cookieOf(restarted),cookie);
});

test('demo workspace quota rejects growth without corrupting the seed', async t => {
  const demo=await harness(t,{maxWorkspaceBytes:240});
  const opened=await request(demo.base,'/api/workspace');const cookie=cookieOf(opened);
  const rejected=await request(demo.base,'/api/resume',{method:'POST',cookie,data:{text:'x'.repeat(500)}});
  assert.equal(rejected.status,413);assert.match(rejected.data.error,/Demo workspace limit/);
  const workspace=await request(demo.base,'/api/workspace',{cookie});
  assert.equal(workspace.data.resume,undefined);assert.equal(workspace.data.snapshots.seed.text,'Synthetic demo job');
});

test('local mode still rejects a public host', async t => {
  const directory=await mkdtemp(join(tmpdir(),'coach-local-policy-'));
  const {server}=await createApplication({directory});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`;
  const response=await request(base,'/api/health',{origin:null});
  assert.equal(response.status,403);assert.equal(response.data.error,'Local host required');
});
