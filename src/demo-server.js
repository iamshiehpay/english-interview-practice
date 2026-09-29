import http from 'node:http';
import {cp, mkdir, mkdtemp, readdir, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {AppError, requireValue} from './domain.js';
import {FakeLanguageModel} from './providers.js';
import {FakeSpeechProvider} from './speech.js';
import {FakeJobSource} from './jobs.js';
import {publicSameOriginPolicy} from './request-policy.js';
import {WorkspaceQuota} from './workspace-quota.js';

export const DEMO_COOKIE='coach_demo_session';
export const DEMO_IDLE_MS=60*60*1000;
export const DEMO_MAX_SESSIONS=50;
export const DEMO_MAX_WORKSPACE_BYTES=2_000_000;

function cookie(req) {
  const held=String(req.headers.cookie || '').split(';').map(value=>value.trim()).find(value=>value.startsWith(`${DEMO_COOKIE}=`));
  const value=held?.slice(DEMO_COOKIE.length+1);
  return /^[0-9a-f-]{36}$/.test(value || '') ? value : null;
}

function sessionCookie(id,idleMs) {
  return `${DEMO_COOKIE}=${id}; Path=/; Max-Age=${Math.floor(idleMs/1000)}; HttpOnly; Secure; SameSite=Lax`;
}

function json(res,status,value) {
  res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));
}

export async function createDemoApplication({applicationFactory, rootDirectory, seedDirectory, idleMs=DEMO_IDLE_MS, maxSessions=DEMO_MAX_SESSIONS, maxWorkspaceBytes=DEMO_MAX_WORKSPACE_BYTES, now=()=>Date.now(), logger=line=>console.log(line)} = {}) {
  requireValue(typeof applicationFactory === 'function','Demo application factory is required',500);
  requireValue(rootDirectory && seedDirectory,'Demo workspace and seed directories are required',500);
  requireValue(Number.isInteger(idleMs)&&idleMs>0&&Number.isInteger(maxSessions)&&maxSessions>0,'Invalid demo session limits',500);
  await mkdir(rootDirectory,{recursive:true,mode:0o700});
  for(const name of await readdir(rootDirectory))if(name.startsWith('process-'))await rm(join(rootDirectory,name),{recursive:true,force:true});
  const processDirectory=await mkdtemp(join(rootDirectory,'process-'));
  const sessions=new Map();
  let lifecycle=Promise.resolve();
  const serialize=work=>{const pending=lifecycle.then(work);lifecycle=pending.catch(()=>{});return pending;};
  const log=(event,extra={})=>logger(JSON.stringify({severity:'INFO',event,...extra,sessionCount:sessions.size}));

  async function remove(entry,reason) {
    if(!entry||!sessions.delete(entry.id))return;
    await rm(entry.directory,{recursive:true,force:true});log('demo_session_removed',{reason});
  }
  async function expire() {
    for(const entry of [...sessions.values()])if(entry.active===0&&now()-entry.lastSeen>idleMs)await remove(entry,'idle');
  }
  async function create() {
    await expire();
    if(sessions.size>=maxSessions){
      const oldest=[...sessions.values()].filter(entry=>entry.active===0).sort((a,b)=>a.lastSeen-b.lastSeen)[0];
      if(!oldest)throw new AppError('Demo is currently full; retry after another visitor finishes',503);
      await remove(oldest,'capacity');
    }
    const id=randomUUID(),directory=join(processDirectory,id);
    await cp(seedDirectory,directory,{recursive:true,errorOnExist:true});
    const quota=new WorkspaceQuota(directory,maxWorkspaceBytes);
    if(await quota.usage()>maxWorkspaceBytes){await rm(directory,{recursive:true,force:true});throw new AppError('Demo seed exceeds the workspace limit',500);}
    const app=await applicationFactory({directory,languageModel:new FakeLanguageModel(),speechProvider:new FakeSpeechProvider(),jobSource:new FakeJobSource(),requestPolicy:publicSameOriginPolicy,maxWorkspaceBytes,deployment:{mode:'demo',temporary:true,expiresAfterSeconds:Math.floor(idleMs/1000),noticeZh:'這是公開的合成資料示範；請勿輸入真實個人資料。'}});
    const entry={id,directory,handler:app.handler,active:0,lastSeen:now()};sessions.set(id,entry);log('demo_session_created');return entry;
  }
  async function acquire(req) {
    return serialize(async()=>{
      await expire();
      let entry=sessions.get(cookie(req)),created=false;
      if(!entry){entry=await create();created=true;}
      entry.active+=1;entry.lastSeen=now();return {entry,created};
    });
  }
  function release(entry){entry.active=Math.max(0,entry.active-1);entry.lastSeen=now();}

  const timer=setInterval(()=>serialize(expire).catch(error=>log('demo_cleanup_failed',{error:error.code||'unknown'})),Math.min(idleMs,60_000));timer.unref();
  const server=http.createServer(async(req,res)=>{
    let acquired,released=false;
    const releaseOnce=()=>{if(released||!acquired)return;released=true;release(acquired.entry);};
    try{
      publicSameOriginPolicy(req);
      const path=new URL(req.url,'https://demo.invalid').pathname;
      if(req.method==='GET'&&path==='/api/health')return json(res,200,{status:'ok',mode:'demo'});
      acquired=await acquire(req);
      res.setHeader('Set-Cookie',sessionCookie(acquired.entry.id,idleMs));
      res.once('finish',releaseOnce);res.once('close',releaseOnce);
      await acquired.entry.handler(req,res);
    }catch(error){
      releaseOnce();
      log('demo_request_failed',{error:error.code||error.name||'unknown',status:error.status||500});
      if(!res.headersSent)json(res,error.status||500,{error:error instanceof AppError?error.reason:'Demo workspace failed; retry later.',retryable:!error.status||error.status>=500});
      else res.end();
    }
  });
  return {server,sessionCount:()=>sessions.size,async close(){clearInterval(timer);await serialize(async()=>{await Promise.all([...sessions.values()].map(entry=>remove(entry,'shutdown')));});await rm(processDirectory,{recursive:true,force:true});}};
}
