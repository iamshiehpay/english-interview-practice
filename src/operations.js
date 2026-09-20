import {randomUUID, createHash} from 'node:crypto';
import {AppError, requireValue} from './domain.js';
export class Operations {
  constructor(store, timeoutMs=30000){this.store=store;this.timeoutMs=timeoutMs;this.controllers=new Map();}
  async recover(){
    if(!Object.values(this.store.data.operations||{}).some(o=>o.state==='pending'))return;
    await this.store.transact(d=>{for(const o of Object.values(d.operations||{}))if(o.state==='pending'){o.state='failed';o.retryable=true;o.errorCode='INTERRUPTED';} });
  }
  async cancel(id){
    requireValue(Object.hasOwn(this.store.data.operations||{},id),'Operation not found',404);
    if(this.store.data.operations[id].state!=='pending')return this.store.data.operations[id];
    this.controllers.get(id)?.abort(new AppError('Operation cancelled',409));
    return this.store.transact(d=>{const o=d.operations?.[id];requireValue(o,'Operation not found',404);if(o.state==='pending'){o.state='cancelled';o.retryable=true;o.errorCode='CANCELLED';}return o;});
  }
  async cancelTarget(target){for(const [id,controller]of this.controllers){const o=this.store.data.operations?.[id];if(!target||o?.targetId===target)await this.cancel(id);}}
  async dismiss(id){
    requireValue(Object.hasOwn(this.store.data.operations||{},id),'Operation not found',404);
    return this.store.transact(d=>{const o=d.operations?.[id];requireValue(o,'Operation not found',404);requireValue(o.state!=='pending','Cancel a pending operation before dismissing it',409);delete d.operations[id];return {dismissed:id};});
  }
  async run({kind,targetId,requestId,input,execute,replay}){
    const id=requestId||randomUUID();requireValue(/^[a-zA-Z0-9_-]{8,100}$/.test(id) && !['__proto__','prototype','constructor'].includes(id),'Invalid request identifier');
    const fingerprint=createHash('sha256').update(JSON.stringify({kind,targetId,input})).digest('hex');
    // A storage failure can prevent recording failure after the controller exits.
    // Recover only operations with no live owner; active calls remain protected.
    if (this.store.data.operations?.[id]?.state === 'pending' && !this.controllers.has(id)) {
      await this.store.transact(d => {
        const operation = d.operations?.[id];
        if (operation?.state === 'pending' && !this.controllers.has(id)) {
          Object.assign(operation, {state: 'failed', retryable: true, errorCode: 'INTERRUPTED'});
        }
      });
    }
    const previous=this.store.data.operations?.[id]||this.store.data.operationReceipts?.[id];
    if(previous){requireValue(previous.fingerprint===fingerprint,'Request identifier belongs to different input',409);requireValue(previous.state!=='pending','Operation already pending',409);if(previous.state==='succeeded')return replay(previous);}
    requireValue(!this.controllers.has(id),'Operation already pending',409);
    requireValue(this.controllers.size<4,'Four operations are already pending; wait or cancel one',429);
    const attempt=(previous?.attempt||0)+1,controller=new AbortController();this.controllers.set(id,controller);
    const epoch=this.store.data.epoch||0;
    try {
      await this.store.transact(d => {
        d.operations ??= {};
        for (const operation of Object.values(d.operations)) {
          if (operation.state === 'pending' && !this.controllers.has(operation.id)) {
            Object.assign(operation, {state: 'failed', retryable: true, errorCode: 'INTERRUPTED'});
          }
        }
        requireValue(!Object.values(d.operations).some(operation => operation.state === 'pending' && operation.kind === kind && operation.targetId === targetId), 'Operation already pending for this practice; wait or cancel it', 409);
        d.operations[id] = {id,kind,targetId,fingerprint,attempt,state:'pending',retryable:false,startedAt:new Date().toISOString()};
        const old = Object.values(d.operations).filter(operation => operation.state !== 'pending');
        for (const operation of old.slice(0, Math.max(0, Object.keys(d.operations).length - 100))) delete d.operations[operation.id];
      });
    } catch (error) {
      this.controllers.delete(id);
      throw error;
    }
    const check=d=>requireValue(!controller.signal.aborted && (d.epoch||0)===epoch && d.operations?.[id]?.state==='pending' && d.operations[id].attempt===attempt,'Operation cancelled or superseded',409);
    let timer;
    try{
      const aborted=new Promise((_,reject)=>{controller.signal.addEventListener('abort',()=>reject(controller.signal.reason||new AppError('Operation cancelled',409)),{once:true});timer=setTimeout(()=>controller.abort(new AppError('Provider operation timed out; retry your original action',504)),this.timeoutMs);});
      const complete=(d,result)=>{check(d);Object.assign(d.operations[id],{state:'succeeded',retryable:false,resultId:result?.id||null,finishedAt:new Date().toISOString()});d.operationReceipts??={};d.operationReceipts[id]={id,kind,targetId,fingerprint,attempt,state:'succeeded',resultId:result?.id||null};};
      const result=await Promise.race([execute({signal:controller.signal,check,complete}),aborted]);
      await this.store.transact(d=>{if(d.operations?.[id]?.state==='succeeded'&&d.operations[id].attempt===attempt)return;complete(d,result);});
      return result;
    }catch(error){
      if(this.store.data.operations?.[id]?.state==='succeeded'&&this.store.data.operations[id].attempt===attempt)return replay(this.store.data.operations[id]);
      if(!controller.signal.aborted)controller.abort(error);
      await this.store.transact(d=>{const o=d.operations?.[id];if(o&&o.attempt===attempt&&o.state==='pending')Object.assign(o,{state:controller.signal.aborted&&controller.signal.reason?.status===409?'cancelled':'failed',retryable:true,errorCode:error.status===504?'TIMEOUT':error.status===429?'RATE_LIMIT':'OPERATION_FAILED',finishedAt:new Date().toISOString()});});
      throw error;
    }finally{clearTimeout(timer);if(this.controllers.get(id)===controller)this.controllers.delete(id);}
  }
}
