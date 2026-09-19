// Optional portfolio artifact capture. Requires agent-browser; no external providers.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApplication} from '../src/server.js';
const exec=promisify(execFile),directory=await mkdtemp(join(tmpdir(),'coach-demo-')),session='coach-demo-'+process.pid;
const output=join(dirname(fileURLToPath(import.meta.url)),'../docs/portfolio/demo.webm');
const browser=(...args)=>exec('agent-browser',['--session',session,...args],{timeout:60000,maxBuffer:2_000_000});
let server,recording=false;
try{
 await exec('ffmpeg',['-version']); // Fail before recording if the encoder is unavailable.
 ({server}=await createApplication({directory}));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${server.address().port}`;await browser('open',url);await browser('record','start',output,url);recording=true;
 const start=Date.now();
 const stage=async(seconds,caption,code='')=>{
  const remaining=start+seconds*1000-Date.now();if(remaining>0)await new Promise(r=>setTimeout(r,remaining));
  await browser('eval',`(async()=>{
   const until=async(fn)=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,25));}throw Error('UI state missing')};
   const click=name=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===name);if(!b)throw Error('Missing '+name);b.click()};
   let banner=document.querySelector('#demo-caption');if(!banner){banner=document.createElement('aside');banner.id='demo-caption';banner.style='position:fixed;bottom:14px;left:5%;width:90%;padding:14px;background:#12273e;color:white;z-index:10000;font:18px/1.4 sans-serif;border-radius:8px;box-shadow:0 3px 20px #0005';document.body.append(banner)}banner.textContent=${JSON.stringify(caption)};
   ${code}
  })()`);console.log(seconds+'s: '+caption);
 };
 await stage(0,'Engineering demo · synthetic answers · fixed demonstration ratings. No claims of learner improvement.',`await until(()=>document.querySelector('#provider-settings').textContent.includes('languageModel'));document.querySelector('#provider-settings').closest('details').open=true;`);
 await stage(20,'1. Save an immutable JD snapshot; source text stays available for review.',`document.querySelector('#jd').value='Build reliable Python APIs.\\nExplain engineering trade-offs.';click('Save Job Snapshot');await until(()=>document.querySelector('#practice').textContent.includes('Review your job evidence'));document.querySelector('#practice').scrollIntoView();`);
 await stage(35,'2. Generate eight grounded practice questions across four categories.',`click('Generate Question Set');await until(()=>document.querySelectorAll('.question').length>=8);document.querySelector('#practice').scrollIntoView();`);
 await stage(50,'Check exact source citations. These are practice questions, not actual employer interview questions.');
 await stage(65,'3. First answer → four separate ratings, one strength, one priority, exact transcript quotes.',`click('Practise this question');await until(()=>document.querySelector('#answer'));document.querySelector('#answer').value='I would build an API.';click('Save answer');await until(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Get feedback / Retry'));click('Get feedback / Retry');await until(()=>document.querySelector('#answer'));document.querySelector('#practice').scrollIntoView();`);
 await stage(90,'4. Revise the same answer and compare. Fixed demo ratings remain2; they do not measure coaching quality.',`document.querySelector('#answer').value='I would validate inputs and test timeout failures because clients need predictable behavior.';click('Save answer');await until(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Get feedback / Retry'));click('Get feedback / Retry');await until(()=>document.querySelector('#focus'));document.querySelector('#practice').scrollIntoView();`);
 await stage(115,'5. Keep one Focus Point and save the Practice Record.',`document.querySelector('#focus').value='Explain one concrete trade-off';click('Save Practice Record');await until(()=>document.querySelector('#practice').textContent.includes('Saved Focus Point:'));`);
 await stage(130,'The saved record persists. Reopen it from practice history.',`const b=[...document.querySelectorAll('#records button')].find(b=>b.textContent.startsWith('completed'));if(!b)throw Error('No completed record');b.click();await until(()=>document.querySelector('#practice').textContent.includes('Saved Focus Point:'));`);
 await stage(140,'Release pending: human labels, live-model quality/stability, and five creator-completed loops. See the published local evaluation summary.');
 await stage(150,'End of synthetic engineering demo.');await browser('record','stop');recording=false;console.log('Saved '+output);
}finally{
 if(recording)await browser('record','stop').catch(()=>{});await browser('close').catch(()=>{});if(server?.listening)await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});
}
