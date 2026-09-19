import {spawn} from 'node:child_process';
import {StringDecoder} from 'node:string_decoder';
import {AppError} from './domain.js';

// One process/session per operation. Protocol/error bodies are never logged.
export class CodexRPC {
  constructor({binary='codex',args=[],cwd,env,signal,timeoutMs=90000,spawnProcess=spawn}){
    this.pending=new Map();this.nextId=1;this.bytes=0;this.closed=false;this.error=null;this.listeners=new Set();this.messages=[];
    this.child=spawnProcess(binary,args,{cwd,env,stdio:['pipe','pipe','pipe'],shell:false});
    this.child.stdin.on('error',()=>this.fail(new AppError('Codex connection closed',502)));
    const decoder=new StringDecoder('utf8');let buffer='';
    this.child.stdout.on('data',chunk=>{
      this.bytes+=chunk.length;if(this.bytes>2_000_000)return this.fail(new AppError('Codex response exceeded size limit',502));
      buffer+=decoder.write(chunk);
      for(let at;(at=buffer.indexOf('\n'))>=0;){const line=buffer.slice(0,at);buffer=buffer.slice(at+1);if(!line.trim())continue;
        let message;try{message=JSON.parse(line);}catch{return this.fail(new AppError('Invalid Codex protocol output',502));}
        if(message.method&&message.id!==undefined){this.send({id:message.id,error:{code:-32601,message:'Interactive requests and tools are disabled'}});return this.fail(new AppError('Codex requested an unavailable capability',502));}
        if(message.id!==undefined){const p=this.pending.get(message.id);if(!p)continue;this.pending.delete(message.id);if(message.error)p.reject(new AppError('Codex request failed; check login, model access or usage limits',502));else p.resolve(message.result);}
        else if(message.method){
          const item=message.params?.item;
          if(item&&!['userMessage','agentMessage','reasoning'].includes(item.type))return this.fail(new AppError('Codex attempted an unavailable capability',502));
          this.messages.push(message);for(const listener of this.listeners)listener(message);
        }
      }
    });
    // Drain, bound and discard stderr; it may contain provider or local account details.
    let stderrBytes=0;this.child.stderr.on('data',chunk=>{stderrBytes+=chunk.length;if(stderrBytes>2_000_000)this.fail(new AppError('Codex diagnostic limit exceeded',502));});
    this.child.on('error',()=>this.fail(new AppError('Codex CLI could not start; check installation',503)));
    this.exited=new Promise(resolve=>this.child.once('close',()=>{this.closed=true;this.fail(new AppError('Codex session ended before completion',502));resolve();}));
    this.abort=()=>this.fail(new AppError('Codex operation cancelled',409));this.signal=signal;
    signal?.addEventListener('abort',this.abort,{once:true});
    this.timer=setTimeout(()=>this.fail(new AppError('Codex operation timed out',504)),timeoutMs);
    if(signal?.aborted)this.abort();
  }
  send(message){if(!this.closed&&!this.child.stdin.destroyed)this.child.stdin.write(JSON.stringify(message)+'\n');}
  request(method,params={}){
    if(this.error)return Promise.reject(this.error);
    const id=this.nextId++;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.send({id,method,params});});
  }
  waitFor(method,predicate=()=>true){
    const existing=this.messages.find(m=>m.method===method&&predicate(m.params));if(existing)return Promise.resolve(existing.params);
    if(this.error)return Promise.reject(this.error);
    return new Promise((resolve,reject)=>{
      const listener=m=>{if(m.method===method&&predicate(m.params)){this.listeners.delete(listener);this.pending.delete(key);resolve(m.params);}};
      const key=Symbol();this.pending.set(key,{reject});this.listeners.add(listener);
    });
  }
  fail(error){if(this.error)return;this.error=error;if(this.threadId){if(this.turnId)this.send({id:this.nextId++,method:'turn/interrupt',params:{threadId:this.threadId,turnId:this.turnId}});this.send({id:this.nextId++,method:'thread/delete',params:{threadId:this.threadId}});}for(const p of this.pending.values())p.reject(error);this.pending.clear();this.listeners.clear();if(!this.closed)this.stopTimer=setTimeout(()=>this.child.kill('SIGTERM'),100);}
  async close(){
    if(this.threadId&&!this.error)this.send({id:this.nextId++,method:'thread/delete',params:{threadId:this.threadId}});
    clearTimeout(this.timer);if(this.stopTimer){await new Promise(r=>setTimeout(r,100));clearTimeout(this.stopTimer);}this.signal?.removeEventListener('abort',this.abort);
    if(!this.closed){this.child.kill('SIGTERM');let timer;await Promise.race([this.exited,new Promise(resolve=>{timer=setTimeout(()=>{this.child.kill('SIGKILL');resolve();},500);})]);clearTimeout(timer);await Promise.race([this.exited,new Promise(r=>setTimeout(r,500))]);}
    if(!this.closed)throw new AppError('Codex process did not exit; temporary cleanup is pending',503);
  }
}
