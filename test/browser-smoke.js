import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createApplication} from '../src/server.js';
const exec=promisify(execFile),directory=await mkdtemp(join(tmpdir(),'coach-browser-')),session=`coach-v3-${process.pid}`;
const browser=(...args)=>exec('agent-browser',['--session',session,...args],{timeout:60000,maxBuffer:2000000});
let server;
const helpers=`
const el=s=>document.querySelector(s), btn=t=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===t);
const wait=async(p,label)=>{for(let i=0;i<300;i++){if(p())return;await new Promise(r=>setTimeout(r,25));}throw Error(label+' / '+el('#error')?.textContent);};
const click=n=>{if(typeof n==='string')n=el(n);if(!n)throw Error('Missing button');n.click();};
const fill=(s,v)=>{const n=el(s);if(!n)throw Error('Missing '+s);n.value=v;n.dispatchEvent(new InputEvent('input',{bubbles:true}));};
const ws=()=>fetch('/api/workspace').then(r=>r.json());
// Synthetic microphone: no hardware, no recognition. Proves the recording workflow only.
const fakeMicrophone=()=>{
  window.__recorders=[];
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>({getTracks:()=>[{stop(){}}]})}});
  window.MediaRecorder=class{
    static isTypeSupported(type){return type==='audio/webm';}
    constructor(stream,options){this.stream=stream;this.mimeType=options?.mimeType||'audio/webm';this.state='inactive';window.__recorders.push(this);}
    start(){this.state='recording';}
    stop(){this.state='inactive';this.ondataavailable?.({data:new Blob([new Uint8Array(2048)],{type:this.mimeType})});this.onstop?.();}
  };
};
`;
const run=code=>browser('eval',`(async()=>{${helpers}${code}})()`);
try {
 ({server}=await createApplication({directory}));await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}`;
 await browser('set','viewport','1440','900');await browser('open',url);
 await mkdir('docs/verification/learner-flow',{recursive:true});
 await run(`await wait(()=>!el('#capture').disabled,'ready');el('nav [data-view="evidence"]').focus();`);
 await browser('press','Enter');await run(`await wait(()=>el('#resume-text'),'keyboard resume navigation');el('nav [data-view="home"]').focus();`);await browser('press','Enter');
 await browser('screenshot',resolve('docs/verification/learner-flow/home.png'));
 await run(`
 click('[data-view="evidence"]');await wait(()=>el('#evidence-view').classList.contains('active')&&el('#resume-text'),'resume form');
 const originalExtractFetch=window.fetch.bind(window);
 window.fetch=async(...a)=>{if(String(a[0]).endsWith('/resume/extract')){const data=JSON.parse(a[1].body);await new Promise(r=>setTimeout(r,data.name==='A.txt'?500:30));return new Response(JSON.stringify({name:data.name,text:data.name+' Python developer'}),{headers:{'Content-Type':'application/json'}});}return originalExtractFetch(...a);};
 const pick=name=>{const dt=new DataTransfer();dt.items.add(new File(['Python developer'],name,{type:'text/plain'}));el('#resume-file').files=dt.files;el('#resume-file').dispatchEvent(new Event('change',{bubbles:true}));};
 pick('A.txt');pick('B.txt');await wait(()=>el('#resume-name').value==='B.txt','latest extraction');await new Promise(r=>setTimeout(r,650));if(el('#resume-name').value!=='B.txt')throw Error('Old extraction overwrote latest upload');
 pick('A.txt');const oversized=new DataTransfer();oversized.items.add(new File([new Uint8Array(5000001)],'large.txt'));el('#resume-file').files=oversized.files;el('#resume-file').dispatchEvent(new Event('change',{bubbles:true}));await wait(()=>!el('#save-resume').disabled,'oversize does not strand earlier extraction');if(el('#resume-name').value!=='A.txt')throw Error('Earlier valid extraction was stranded');window.fetch=originalExtractFetch;
 
 fill('#resume-name','Practice resume');fill('#resume-text','Built a Python task manager with PostgreSQL.');click('#save-resume');await wait(()=>el('#notice').textContent.includes('履歷已儲存'),'resume saved');
 click('nav [data-view="home"]');await wait(()=>el('#use-resume')?.checked,'default resume');
 fill('#jd','Build reliable Python APIs.\\nOperate Kubernetes services.');click('#capture');await wait(()=>el('#recommended-question'),'question');
 if(document.body.innerText.includes('查看出題依據'))throw Error('Redundant evidence shown');
 const data=await ws();if(!Object.values(data.snapshots)[0].resume)throw Error('Resume not selected');
 if(!el('#question-read-aloud .read-aloud-play'))throw Error('Read-aloud control missing on the question screen');
 if(document.querySelector('audio'))throw Error('Audio element created before any learner action');
 window.__played=[];HTMLMediaElement.prototype.play=function(){window.__played.push(this.src);this.dispatchEvent(new Event('ended'));return Promise.resolve();};
 click('#question-read-aloud .read-aloud-play');await wait(()=>window.__played.length===1,'read aloud plays on click');
 el('#question-read-aloud .read-aloud-speed').value='slow';el('#question-read-aloud .read-aloud-speed').dispatchEvent(new Event('change',{bubbles:true}));
 click('#question-read-aloud .read-aloud-replay');await wait(()=>window.__played.length===2,'read aloud replays at the chosen speed');
 if(window.__played[0]===window.__played[1])throw Error('Speed change did not request different audio');
 // Rapid repeat clicks must never start two overlapping readings.
 const beforeBurst=window.__played.length;
 for(let i=0;i<4;i++){el('#question-read-aloud .read-aloud-replay').click();el('#question-read-aloud .read-aloud-play').click();}
 await new Promise(r=>setTimeout(r,600));
 if(window.__played.length>beforeBurst+1)throw Error('Overlapping readings started: '+(window.__played.length-beforeBurst));
 click('#question-actions button');await wait(()=>el('#answer'),'editor');
 if(!el('#retry-draft').hidden)throw Error('Retry visible before failure');

 // Voice: three-minute budget, visible clock, and a transcript that lands in the answer box.
 fakeMicrophone();
 if(!el('.voice-panel'))throw Error('Voice panel missing');
 const limits=await fetch('/api/providers').then(r=>r.json()).then(p=>p.speech);
 if(limits.recordingLimitSeconds!==180)throw Error('Recording limit is not three minutes: '+limits.recordingLimitSeconds);
 if(!el('.voice-panel').textContent.includes('3 分鐘'))throw Error('Panel does not state the three-minute limit');
 if(!el('.voice-panel').textContent.includes('不評發音'))throw Error('Panel does not say pronunciation is not assessed');
 if(!el('.voice-panel').textContent.includes('重新整理會失去'))throw Error('Panel does not warn that a reload loses an unsubmitted recording');
 if(el('.voice-panel').textContent.includes('90 秒')||el('.voice-panel').textContent.includes('6 MB'))throw Error('Stale 90-second / 6 MB wording still shown');
 click(btn('開始錄音'));await wait(()=>el('.recording-clock')&&!el('.recording-clock').hidden,'recording clock visible');
 if(!/已錄 \\d:\\d\\d \\/ 3:00/.test(el('.recording-clock').textContent))throw Error('Elapsed time not shown: '+el('.recording-clock').textContent);
 // Force the near-limit state without waiting three real minutes.
 const rec=window.__recorders.at(-1);
 click(btn('停止並轉成文字'));await wait(()=>el('#answer').value.includes('demonstration transcript'),'transcript lands in the answer box');
 if(el('#voice-choice'))throw Error('An empty answer box must not ask replace-or-append');
 await wait(()=>el('#draft-status').textContent.includes('草稿'),'transcript saved as a local draft');
 // With different text already present the learner chooses; nothing is overwritten silently.
 const typed='I typed this sentence myself before recording.';
 fill('#answer',typed);await wait(()=>el('#draft-status').textContent.includes('已儲存'),'typed draft saved');
 click(btn('開始錄音'));await wait(()=>!el('.recording-clock').hidden,'second recording started');
 click(btn('停止並轉成文字'));await wait(()=>el('#voice-choice'),'replace-or-append offered when text exists');
 if(el('#answer').value!==typed)throw Error('Existing text changed before the learner chose');
 if(el('#submit-answer').disabled)throw Error('Submitting the existing text must stay available while choosing');
 click(btn('接在後面'));await wait(()=>el('#answer').value.length>typed.length,'append keeps the existing text');
 if(!el('#answer').value.startsWith(typed))throw Error('Append lost the existing text');
 if(!el('#answer').value.includes('demonstration transcript'))throw Error('Append did not add the transcript');
 el('#answer').value='';el('#answer').dispatchEvent(new InputEvent('input',{bubbles:true}));
 await wait(()=>el('#draft-status').textContent.includes('已儲存'),'cleared draft settles; status='+el('#draft-status').textContent);
 // An unsubmitted recording is pending, not retained, and holds no answer.
 const pending=Object.values((await ws()).recordings||{});
 if(pending.length!==1||pending[0].state!=='pending')throw Error('Expected exactly one pending recording, got '+JSON.stringify(pending));
 const originalFetch=window.fetch.bind(window);let failDraft=true,failFeedback=true;
 window.fetch=async(...a)=>{const path=String(a[0]);if(a[1]?.method==='POST'&&((path.endsWith('/draft')&&failDraft)||(path.endsWith('/feedback')&&failFeedback))){if(path.endsWith('/draft'))failDraft=false;else failFeedback=false;return new Response(JSON.stringify({error:'synthetic failure'}),{status:503,headers:{'Content-Type':'application/json'}});}return originalFetch(...a);};
 fill('#answer','I would measure query latency and compare the execution plans.');await wait(()=>!el('#retry-draft').hidden,'draft failure');
 click('#retry-draft');await wait(()=>el('#draft-status').textContent.includes('已儲存'),'draft retry');
 click('#next-question');await wait(()=>el('#recommended-question'),'switch');click('#question-actions button');await wait(()=>el('#answer'),'new editor');
 click('[data-view="history"]');await wait(()=>el('[data-job-id]'),'job-centred history');
 const first=Object.values((await ws()).records).find(r=>r.writtenDraft);
 click('[data-job-id="'+first.snapshotId+'"] [aria-expanded]');await wait(()=>el('[data-record-id="'+first.id+'"]'),'job detail');
 click('[data-record-id="'+first.id+'"] button');await wait(()=>el('#answer')?.value.includes('measure'),'restored draft');
 sessionStorage.setItem('record',first.id);
 `);
 await browser('open',url);
 await run(`
 await wait(()=>el('[data-view="history"]'),'load');click('[data-view="history"]');await wait(()=>el('[data-job-id]'),'job-centred history');
 const savedId=sessionStorage.getItem('record');const savedRec=(await ws()).records[savedId];
 click('[data-job-id="'+savedRec.snapshotId+'"] [aria-expanded]');await wait(()=>el('[data-record-id="'+savedId+'"]'),'job detail reload');
 click('[data-record-id="'+savedId+'"] button');await wait(()=>el('#answer')?.value.includes('measure'),'reload draft');
 const real=window.fetch.bind(window);let failed=false;window.fetch=async(...a)=>{if(!failed&&a[1]?.method==='POST'&&String(a[0]).endsWith('/feedback')){failed=true;return new Response(JSON.stringify({error:'synthetic failure'}),{status:503,headers:{'Content-Type':'application/json'}});}return real(...a);};
 click('#submit-answer');await wait(()=>btn('重試取得回饋'),'feedback failure');click(btn('重試取得回饋'));await wait(()=>el('#complete-practice'),'feedback retry');
 await wait(()=>el('#corrections .correction-card')||el('#corrections .corrections-none'),'key-sentence corrections surface after feedback');
 if(el('#corrections .correction-card')){const q=el('#corrections .correction-card blockquote[lang="en"]').textContent;if(!(await ws()).records[sessionStorage.getItem('record')].attempts.at(-1).transcript.includes(q))throw Error('Correction original is not a verbatim substring of the learner answer');}
 if((await ws()).records[sessionStorage.getItem('record')].attempts.length!==1)throw Error('Corrections became an Answer Attempt');
 if((await ws()).records[sessionStorage.getItem('record')].attempts[0].corrections)throw Error('Corrections must be stored separately from Answer Attempts');
 if(el('#answer'))throw Error('Revision is forced');
 click(btn('幫我講得更自然'));await wait(()=>el('#rewrite-result .coaching-text'),'rewrite');
 if((await ws()).records[sessionStorage.getItem('record')].attempts.length!==1)throw Error('AI assistance became attempt');
 click(btn('自己再試一次'));await wait(()=>el('#answer'),'optional revision');
 fill('#answer','I would inspect the execution plan, measure latency, then check the cost of adding an index.');
 click('#submit-answer');await wait(()=>el('#complete-practice'),'revision feedback');
 if(!document.body.innerText.includes('關鍵句前後對照'))throw Error('Missing concise comparison');
 if([...document.querySelectorAll('summary')].some(n=>n.textContent==='英文說明'))throw Error('English feedback explanations still displayed');
 el('#attempt-history').open=true;
 el('#attempt-version').value='0';el('#attempt-version').dispatchEvent(new Event('change',{bubbles:true}));
 if(el('#attempt-detail').querySelector('blockquote').textContent!=='I would measure query latency and compare the execution plans.')throw Error('History did not select first answer');
 el('#attempt-version').value='1';el('#attempt-version').dispatchEvent(new Event('change',{bubbles:true}));
 if(el('#attempt-detail').querySelectorAll('h3').length!==1||el('#attempt-detail').textContent.includes('I would measure query latency'))throw Error('History stacked multiple versions');
 el('#attempt-history').open=false;

 `);
 await browser('screenshot',resolve('docs/verification/learner-flow/feedback.png'),'--full');
 await run(`
 click('#complete-practice');await wait(()=>el('#practice-complete'),'saved');
 const completedId=sessionStorage.getItem('record');const completedSnapshot=(await ws()).records[completedId].snapshotId;
 click(btn('針對這個重點再練一次'));await wait(()=>el('.focus-origin-banner'),'focus-point practice started');
 const focusRec=Object.values((await ws()).records).find(r=>r.focusOrigin&&r.focusOrigin.recordId===completedId);
 if(!focusRec)throw Error('Focus-point practice did not create a new record');
 if(focusRec.snapshotId!==completedSnapshot)throw Error('Focus-point practice left the same job');
 const src=(await ws()).records[completedId];if(src.status!=='completed'||src.attempts.length!==2)throw Error('Focus-point practice overwrote the source record');
 await wait(()=>el('#answer'),'focus practice editor');
 fill('#answer','This time I add a concrete indexing example with its trade-offs to support the plan.');click('#submit-answer');await wait(()=>el('#complete-practice'),'focus practice feedback');
 click('#complete-practice');await wait(()=>el('.focus-progress'),'focus progress shown');
 if(!el('.focus-progress').textContent.includes('系統不會替你宣稱進步'))throw Error('Focus progress must not fabricate improvement');
 `);
 await browser('set','viewport','390','844');
 await run(`if(document.documentElement.scrollWidth>innerWidth)throw Error('Mobile overflow');if(btn('查看參考表達'))throw Error('Old reference outline shown');click('nav [data-view="home"]');await wait(()=>el('#use-resume'),'home');el('#use-resume').checked=false;fill('#jd','Build services and discuss engineering trade-offs.');click('#capture');await wait(()=>el('#recommended-question'),'JD only');click('#question-actions button');await wait(()=>el('#answer'),'editor');`);
 await browser('screenshot',resolve('docs/verification/learner-flow/mobile.png'),'--full');
 await run(`
 click(btn('看一個示範回答'));await wait(()=>el('#hint-result .coaching-text'),'illustrative');
 if(!el('#hint-result .coaching-caveat')||!el('#hint-result .coaching-caveat').textContent.includes('這是假設示範，請替換成你自己的經驗'))throw Error('Illustrative caveat missing');
 if(!el('#illustrative-read-aloud .read-aloud-play'))throw Error('Illustrative Answer cannot be read aloud');
 fill('#ideas','I would compare two approaches.');click(btn('幫我整理成英文'));await wait(()=>el('#ideas-result .coaching-text'),'ideas');
 const before=await ws();const fresh=Object.values(before.records).find(r=>r.attempts.length===0&&before.snapshots[r.snapshotId].resume===null);if(!fresh)throw Error('JD-only record missing');
 if(fresh.attempts.length)throw Error('Ideas counted as answer');
 const realCorr=window.fetch.bind(window);let corrFail=true,corrEmpty=true;
 window.fetch=async(...a)=>{const p=String(a[0]);if(a[1]?.method==='POST'&&p.endsWith('/corrections')){if(corrFail){corrFail=false;return new Response(JSON.stringify({error:'synthetic failure',retryable:true}),{status:503,headers:{'Content-Type':'application/json'}});}if(corrEmpty){corrEmpty=false;return new Response(JSON.stringify({id:'x',corrections:[],createdAt:new Date().toISOString()}),{headers:{'Content-Type':'application/json'}});}}return realCorr(...a);};
 fill('#answer','I would compare the cost and failure modes of both approaches.');click('#submit-answer');await wait(()=>btn('讓面試官追問'),'primary feedback');
 await wait(()=>document.activeElement&&document.activeElement.id==='feedback-heading','feedback heading focused after submit');
 await wait(()=>btn('重試取得關鍵句修正'),'corrections retry offered after failure');click(btn('重試取得關鍵句修正'));await wait(()=>el('#corrections .corrections-none'),'corrections no-change path');
 window.fetch=realCorr;
 if(btn('直接結束並保存'))throw Error('Duplicate end button still present after primary feedback');
 const endButtons=[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='結束並保存');
 if(endButtons.length!==1||!el('#complete-practice'))throw Error('Expected exactly one completion button before follow-up, got '+endButtons.length);
 const ratingQuoteCount=document.querySelectorAll('.ratings blockquote').length,dimCount=document.querySelectorAll('.ratings .rating').length;
 if(dimCount!==4)throw Error('Expected four assessment dimensions, got '+dimCount);
 if(ratingQuoteCount>=dimCount)throw Error('Rating citations were not deduplicated: '+ratingQuoteCount+' of '+dimCount);
 if((await ws()).records[fresh.id].attempts.length!==1)throw Error('Primary feedback changed formal-answer count');
 click(btn('讓面試官追問'));await wait(()=>el('#follow-up-answer'),'first optional follow-up');
 if((await ws()).records[fresh.id].attempts.length!==1)throw Error('Follow-up generation became a primary answer');
 fill('#follow-up-answer','I would begin with the highest-risk failure mode and validate it with a small test.');click('#submit-follow-up');await wait(()=>btn('繼續追問'),'first follow-up feedback');
 const afterFirstFollowUp=(await ws()).records[fresh.id];if(afterFirstFollowUp.attempts.length!==1||afterFirstFollowUp.followUps?.length!==1||!afterFirstFollowUp.followUps[0].attempt?.feedback)throw Error('First follow-up was not saved with Chinese feedback');
 if(![...el('#follow-up-actions').querySelectorAll('button')].some(button=>button.textContent.trim()==='結束並保存'))throw Error('Early finish was unavailable after first follow-up feedback');
 click(btn('繼續追問'));await wait(()=>el('#follow-up-answer'),'second optional follow-up');
 const realFollowUpFetch=window.fetch.bind(window);let followUpFeedbackStarted=false,releaseFollowUpFeedback;
 window.fetch=async(...a)=>{if(a[1]?.method==='POST'&&/\\/follow-ups\\/[^/]+\\/feedback$/.test(String(a[0]))){followUpFeedbackStarted=true;await new Promise(resolve=>{releaseFollowUpFeedback=resolve;});}return realFollowUpFetch(...a);};
 fill('#follow-up-answer','I would document the decision and monitor the result after release.');click('#submit-follow-up');await wait(()=>followUpFeedbackStarted,'pending second follow-up feedback');
 if([...el('#follow-up-actions').querySelectorAll('button')].some(button=>button.textContent.trim()==='結束並保存'))throw Error('Follow-up can be ended while its Chinese feedback is pending');if(el('#complete-practice')&&!el('#complete-practice').disabled)throw Error('Practice can be ended while follow-up Chinese feedback is pending');releaseFollowUpFeedback();await wait(()=>el('#follow-up-feedback-title'),'second follow-up feedback');window.fetch=realFollowUpFetch;
 const afterSecondFollowUp=(await ws()).records[fresh.id];if(afterSecondFollowUp.attempts.length!==1||afterSecondFollowUp.followUps?.length!==2||!afterSecondFollowUp.followUps.every(node=>node.attempt?.feedback))throw Error('Second follow-up was not saved with Chinese feedback');
 if(btn('繼續追問'))throw Error('A third follow-up was offered');click(btn('結束並保存'));await wait(()=>el('#practice-complete'),'follow-up completion');
 const final=(await ws()).records[fresh.id];if(final.attempts.length!==1||final.status!=='completed')throw Error('Follow-up completion changed primary answer or did not save');
 if(document.documentElement.scrollWidth>innerWidth)throw Error('Mobile overflow');
 return 'pass';`);
 await run(`
 click(btn('再練一題'));await wait(()=>el('#recommended-question'),'early-end question');click('#question-actions button');await wait(()=>el('#answer'),'early-end editor');
 fill('#answer','I would identify the riskiest assumption and test it first.');click('#submit-answer');await wait(()=>btn('讓面試官追問'),'early-end primary feedback');click(btn('讓面試官追問'));await wait(()=>el('#follow-up-answer'),'early-end follow-up');
 fill('#follow-up-answer','I would measure the outcome and adjust the plan.');click('#submit-follow-up');await wait(()=>btn('繼續追問'),'early-end follow-up feedback');click(btn('結束並保存'));await wait(()=>el('#practice-complete'),'early-end completion');
 const earlyEnded=Object.values((await ws()).records).find(r=>r.attempts[0]?.transcript==='I would identify the riskiest assumption and test it first.');if(earlyEnded?.status!=='completed'||earlyEnded.followUps?.length!==1||!earlyEnded.followUps[0].attempt?.feedback)throw Error('Early end after first follow-up feedback did not preserve the completed follow-up');
 `);
 await run(`
 click(btn('再練一題'));await wait(()=>el('#recommended-question'),'another question');click('#question-actions button');await wait(()=>el('#answer'),'another editor');
 const realFetch=window.fetch.bind(window);let started=false;
 window.fetch=async(...a)=>{if(a[1]?.method==='POST'&&String(a[0]).endsWith('/feedback')){started=true;await new Promise(r=>setTimeout(r,800));return new Response(JSON.stringify({error:'synthetic delayed failure'}),{status:503,headers:{'Content-Type':'application/json'}});}return realFetch(...a);};
 fill('#answer','I would start by checking the logs.');click('#submit-answer');await wait(()=>started,'background feedback');click('#next-question');await wait(()=>el('#recommended-question'),'background switch');click('#question-actions button');await wait(()=>el('#answer'),'background new editor');fill('#answer','This new draft must survive the previous feedback failure.');await wait(()=>el('#draft-status').textContent.includes('已儲存'),'background draft save');await new Promise(r=>setTimeout(r,1000));
 const records=Object.values((await ws()).records);if(!records.some(r=>r.writtenDraft?.transcript==='This new draft must survive the previous feedback failure.'))throw Error('Background feedback destroyed new draft');window.fetch=realFetch;
 `);
 await run(`
 click('[data-view="history"]');await wait(()=>el('[data-job-id]'),'mobile job-centred history');
 if(document.documentElement.scrollWidth>innerWidth)throw Error('Mobile overflow on job list');
 const toggle=el('[data-job-id] [aria-expanded]');if(!toggle)throw Error('No job with practice records to expand');
 toggle.click();await wait(()=>el('.job-detail .record-card'),'mobile job detail');
 if(document.documentElement.scrollWidth>innerWidth)throw Error('Mobile overflow on job detail');
 fill('#job-search','zzz-no-match');await wait(()=>el('.job-list .empty'),'search filters job list');
 if(document.documentElement.scrollWidth>innerWidth)throw Error('Mobile overflow on filtered job list');
 `);
 // Answer Recordings: submit a spoken answer, replay it, then delete the practice.
 await run(`
 fakeMicrophone();
 click('nav [data-view="home"]');await wait(()=>el('#jd'),'home for a recorded answer');
 fill('#jd','Investigate incidents and explain the root cause to stakeholders.');click('#capture');await wait(()=>el('#recommended-question'),'recording job question');
 click('#question-actions button');await wait(()=>el('#answer'),'recording editor');
 click(btn('開始錄音'));await wait(()=>!el('.recording-clock').hidden,'recording for retention');
 click(btn('停止並轉成文字'));await wait(()=>el('#answer').value.includes('demonstration transcript'),'transcript for retention');
 click('#submit-answer');await wait(()=>el('#feedback-heading'),'recorded answer feedback');
 const spoken=Object.values((await ws()).records).find(r=>r.attempts[0]?.inputMode==='voice');
 if(!spoken)throw Error('Spoken answer was not stored as a voice attempt');
 const rid=spoken.attempts[0].recordingId;
 if(!rid)throw Error('Submitted spoken answer kept no recording');
 if(spoken.attempts[0].transcriptEdited!==false)throw Error('Unedited transcript must not be marked edited');
 if((await ws()).recordings[rid].state!=='retained')throw Error('Recording was not promoted to retained');
 if(!el('.answer-recording audio'))throw Error('No player beside a submitted spoken answer');
 const played=await fetch(el('.answer-recording audio').getAttribute('src'));
 if(!played.ok||!played.headers.get('content-type').startsWith('audio/'))throw Error('Recording playback failed: '+played.status);
 if(played.headers.get('cache-control')!=='no-store')throw Error('Recording playback is cacheable');
 el('#attempt-history').open=true;
 if(!el('#attempt-detail .answer-recording audio'))throw Error('No player in the answer-version history');
 if(document.documentElement.scrollWidth>innerWidth)throw Error('Mobile overflow with a player');
 click('nav [data-view="settings"]');await wait(()=>el('#recording-storage'),'settings shows local recording size');
 if(!el('#recording-storage').textContent.includes('段回答錄音'))throw Error('Local recording size not disclosed: '+el('#recording-storage').textContent);
 await fetch('/api/records/'+spoken.id,{method:'DELETE'});
 if((await ws()).recordings[rid])throw Error('Deleting the practice left the recording behind');
 if((await fetch('/api/recordings/'+rid)).status!==404)throw Error('A deleted recording is still playable');
 `);
 console.log('Browser smoke PASS: resume default/opt-out, read-aloud (no autoplay, replay, speed, no overlap), three-minute recording with a visible clock, transcript replace/append handoff, retained Answer Recordings with playback and deletion, draft failure/reload recovery, feedback retry, key-sentence corrections (normal/retry/no-change/evidence-safe), Focus-Point same-job practice, job-centred Records navigation, optional revision, separate AI assistance, one-answer completion and mobile layout.');
}finally{await browser('close').catch(()=>{});if(server)await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});}
