import {chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {runtimeProfile} from '../src/codex-profile.js';
import {CodexLanguageModel,CODEX_DEFAULT_MODEL,CODEX_DEFAULT_EFFORT,CODEX_DEFAULT_SERVICE_TIER} from '../src/codex-language.js';
const provider=new CodexLanguageModel({profile:process.env.COACH_CODEX_HOME,binary:process.env.COACH_CODEX_BIN||'codex',model:process.env.COACH_CODEX_MODEL||CODEX_DEFAULT_MODEL,effort:process.env.COACH_CODEX_EFFORT||CODEX_DEFAULT_EFFORT,serviceTier:process.env.COACH_CODEX_SERVICE_TIER??CODEX_DEFAULT_SERVICE_TIER});
try{
  if(process.argv.includes('login')){
    const runtime=await runtimeProfile(provider);
    console.log('Opening the official ChatGPT sign-in flow for the dedicated Interview Coach profile. Codex saves credentials in the dedicated private profile.');
    let child,exited;
    try{
      child=spawn(runtime.rawBinary,['-c',`log_dir=${JSON.stringify(join(runtime.directory,'logs'))}`,'login'],{cwd:runtime.cwd,env:runtime.env,stdio:'inherit',shell:false});
      exited=new Promise(resolve=>child.once('close',code=>resolve(code)));child.once('error',()=>{});
      try{await runtime.register(child.pid);}catch(error){child.kill('SIGKILL');await exited;throw error;}
      if(await exited!==0)throw Error('Codex login did not complete');
      await chmod(join(runtime.home,'auth.json'),0o600);
    }finally{if(!child||child.exitCode!==null||child.signalCode!==null)await runtime.cleanup();}

  }
  console.log(JSON.stringify(await provider.status(),null,2));
}catch(error){console.error(error.message);process.exitCode=1;}
