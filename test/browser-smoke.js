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
 // Listening mode: off by default, hides the question on play, reveals in one click.
 const qText=()=>el('#recommended-question .question-text');
 const qMeaning=()=>el('#recommended-question details');
 if(!el('.listening-mode'))throw Error('Listening-mode toggle missing beside the question');
 if(el('.listening-mode').checked)throw Error('Listening mode must be off by default');
 if(qText().hidden)throw Error('Question hidden while listening mode is off');
 el('.listening-mode').checked=true;el('.listening-mode').dispatchEvent(new Event('change',{bubbles:true}));
 const playedBefore=window.__played.length;
 click('#question-read-aloud .read-aloud-play');
 await wait(()=>qText().hidden,'question hidden on play');
 if(!qMeaning().hidden)throw Error('Chinese meaning stayed visible in listening mode');
 if(el('.read-aloud-reveal').hidden)throw Error('No reveal control while the question is hidden');
 await wait(()=>window.__played.length>playedBefore,'audio played in listening mode');
 await new Promise(r=>setTimeout(r,300));
 if(!qText().hidden)throw Error('Question reappeared by itself when the audio ended');
 click('.read-aloud-reveal');
 await wait(()=>!qText().hidden,'one-click reveal');
 if(qMeaning().hidden)throw Error('Chinese meaning not revealed');
 if(!el('.read-aloud-reveal').hidden)throw Error('Reveal control still shown after revealing');
 // A read-aloud failure must reveal the question rather than leave nothing.
 const realSpeech=window.fetch.bind(window);
 window.fetch=async(...a)=>{if(a[1]?.method==='POST'&&String(a[0]).endsWith('/api/speech'))return new Response(JSON.stringify({error:'synthetic failure'}),{status:503,headers:{'Content-Type':'application/json'}});return realSpeech(...a);};
 // Pick a speed whose audio is not already cached, so the request really is made.
 el('#question-read-aloud .read-aloud-speed').value='fast';el('#question-read-aloud .read-aloud-speed').dispatchEvent(new Event('change',{bubbles:true}));
 click('#question-read-aloud .read-aloud-play');
 await wait(()=>el('#question-read-aloud .read-aloud-status').textContent.includes('已顯示題目'),'failure reveals the question');
 if(qText().hidden)throw Error('Question stayed hidden after a read-aloud failure');
 window.fetch=realSpeech;
 el('.listening-mode').checked=false;el('.listening-mode').dispatchEvent(new Event('change',{bubbles:true}));
 if(qText().hidden)throw Error('Turning listening mode off did not reveal the question');
 sessionStorage.setItem('listening-checked','1');

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
 // Microphone evidence is local: which input is live and how loud it is, so a silent
 // recording can be spotted here instead of only after a failed transcription.
 if(el('.voice-level-box').hidden)throw Error('No input-level meter while recording');
 if(!el('.voice-input-label').textContent.includes('麥克風：'))throw Error('Selected microphone not named while recording');
 // Force the near-limit state without waiting three real minutes.
 const rec=window.__recorders.at(-1);
 click(btn('停止並轉成文字'));await wait(()=>el('#answer').value.includes('demonstration transcript'),'transcript lands in the answer box');
 if(el('#voice-choice'))throw Error('An empty answer box must not ask replace-or-append');
 await wait(()=>el('#draft-status').textContent.includes('草稿'),'transcript saved as a local draft');
 if(!el('.voice-preview audio'))throw Error('No local playback of the recording just transcribed');
 if(el('.voice-recording-summary').hidden)throw Error('No length/size/level summary after transcription');
 if(el('.voice-level-box').hidden===false)throw Error('Live level meter still running after recording stopped');
 // With different text already present the learner chooses; nothing is overwritten silently.
 const typed='I typed this sentence myself before recording.';
 fill('#answer',typed);await wait(()=>el('#draft-status').textContent.includes('已儲存'),'typed draft saved');
 // A transcribed recording is retained on the server, so starting a new one must not
 // claim an unsubmitted take is about to be lost. A blocking confirm() here also froze
 // this page entirely, so the count is asserted rather than left to a timeout.
 let confirms=0;const realConfirm=window.confirm;window.confirm=()=>{confirms++;return true;};
 click(btn('開始錄音'));await wait(()=>!el('.recording-clock').hidden,'second recording started');
 window.confirm=realConfirm;
 if(confirms)throw Error('Re-recording warned about losing an already-transcribed recording');
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
 // A follow-up is answerable by voice, and its recording belongs to the follow-up.
 fakeMicrophone();
 if(!el('#follow-up-voice-entry .voice-panel'))throw Error('No recording panel on the follow-up answer');
 click(btn('開始錄音'));await wait(()=>!el('.recording-clock').hidden,'follow-up recording started');
 click(btn('停止並轉成文字'));await wait(()=>el('#follow-up-answer').value.includes('demonstration transcript'),'follow-up transcript lands in its own box');
 const midFollowUp=(await ws()).records[fresh.id];
 if(midFollowUp.transcriptDraft)throw Error('Follow-up recording created a primary transcript draft');
 if(!midFollowUp.followUps[0].transcriptDraft)throw Error('Follow-up transcript draft was not saved on the follow-up');
 fill('#follow-up-answer','I would begin with the highest-risk failure mode and validate it with a small test.');click('#submit-follow-up');await wait(()=>btn('繼續追問'),'first follow-up feedback');
 const spokenFollowUp=(await ws()).records[fresh.id].followUps[0].attempt;
 if(spokenFollowUp.inputMode!=='voice'||!spokenFollowUp.recordingId)throw Error('Follow-up answer did not keep its recording');
 if(spokenFollowUp.transcriptEdited!==true)throw Error('Edited follow-up transcript is not labelled');
 if((await ws()).records[fresh.id].attempts[0].recordingId===spokenFollowUp.recordingId)throw Error('Follow-up recording landed on the primary attempt');
 if(!el('.follow-up-feedback')?.closest('section')?.querySelector('.answer-recording audio')&&!el('.answer-recording audio'))throw Error('No player for the spoken follow-up answer');
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
 // Natural-language search criteria: describe it, confirm what was understood.
 await run(`
 click('nav [data-view="discovery"]');await wait(()=>el('#search-request'),'job search view');
 if(!el('#interpret-disclosure').textContent.trim())throw Error('Outbound disclosure missing for the request text');
 const before=await fetch('/api/job-search-profile').then(r=>r.json());
 fill('#search-request','根據我的履歷，幫我找台灣適合轉職的 AI 職缺，最好能遠端');
 click('#interpret-request');await wait(()=>el('.interpreted-list'),'criteria proposed');
 const shown=el('.interpreted-list').textContent;
 if(!shown.includes('AI'))throw Error('Stated role not understood: '+shown);
 if(shown.includes('排除條件'))throw Error('An unstated field was guessed: '+shown);
 if(JSON.stringify(await fetch('/api/job-search-profile').then(r=>r.json()))!==JSON.stringify(before))throw Error('Interpreting saved the profile before the learner confirmed');
 click('#apply-interpreted');await wait(()=>el('#notice').textContent.includes('搜尋條件已更新'),'criteria applied on confirmation');
 if(!el('#profile-roles').value.includes('AI'))throw Error('Confirmed criteria did not reach the editable fields');
 // Every field stays editable before searching.
 fill('#profile-exclusions','Manager');
 click(btn('儲存搜尋條件'));await new Promise(r=>setTimeout(r,200));
 const saved=await fetch('/api/job-search-profile').then(r=>r.json());
 if(!saved.exclusions.includes('Manager'))throw Error('Edited criteria were not saved');
 if(document.documentElement.scrollWidth>innerWidth)throw Error('Mobile overflow on the job search view');
 // No qualifying result: name the blocking condition and offer a one-click relaxation.
 fill('#profile-roles','Nothing Matches This');fill('#profile-exclusions','');
 click(btn('搜尋公開職缺'));await wait(()=>el('#discovery-results .provider-warning'),'no-results guidance');
 if(!document.body.innerText.includes('沒有符合的職缺'))throw Error('Empty result is not explained');
 if(!btn('放寬「想找的職務」'))throw Error('No one-click relaxation offered');
 click(btn('放寬「想找的職務」'));await wait(()=>el('#profile-roles').value==='','relaxation applied');
 // A curated shortlist: at most five, with all four Fit Breakdown parts and a source link.
 fill('#profile-roles','Engineer');fill('#profile-locations','Taiwan');fill('#profile-workArrangements','');fill('#profile-seniority','');fill('#profile-salary','');fill('#profile-priorities','');
 click(btn('搜尋公開職缺'));await wait(()=>el('.shortlist-card'),'curated shortlist');
 const cards=[...document.querySelectorAll('.shortlist-card')];
 if(cards.length>5)throw Error('More than five curated results: '+cards.length);
 if(!document.body.innerText.includes('查詢時間'))throw Error('Retrieval time not shown');
 if(!document.body.innerText.includes('不是雇主的評估'))throw Error('Shortlist does not disclaim an employer assessment');
 for(const card of cards){
   const parts=[...card.querySelectorAll('.fit-part h4')].map(n=>n.textContent);
   for(const label of ['已符合','可轉移','需補足','職缺未說明'])if(!parts.includes(label))throw Error('Missing Fit Breakdown part: '+label);
   if(!card.querySelector('.why-fit').textContent.trim())throw Error('No fit rationale');
   if(!card.querySelector('.location-tag').textContent.trim())throw Error('No location tag');
   const link=card.querySelector('a[href]');if(!link||!/^https?:/.test(link.getAttribute('href')))throw Error('No link to the original posting');
   if(!card.querySelector('details'))throw Error('Retrieved job description not available in place');
 }
 if(document.documentElement.scrollWidth>innerWidth)throw Error('Mobile overflow on the shortlist');
 // Saving a result carries the resume choice and depth into practice.
 cards[0].querySelector('.shortlist-depth').value='deeper';
 click(cards[0].querySelector('.button-row button'));await wait(()=>el('#recommended-question'),'practising a discovered job');
 const discovered=Object.values((await ws()).snapshots).find(s=>s.sourceType==='job-source');
 if(!discovered)throw Error('Discovered job was not saved as a Job Snapshot');
 if(discovered.difficulty!=='deeper')throw Error('Question depth was not carried into the snapshot');
 if(!discovered.resume)throw Error('Resume choice was not carried into the snapshot');
 if(!discovered.sourceUrl)throw Error('Snapshot lost its source link');
 `);
 // Short Mock Session: three questions in a row, no coaching during, summary at the end.
 await run(`
 click('[data-view="history"]');await wait(()=>el('#job-search'),'history for the mock session');
 fill('#job-search','');await wait(()=>el('[data-job-id]'),'job list restored after clearing the search');
 const jobId=el('[data-job-id]').dataset.jobId;
 click('[data-job-id="'+jobId+'"] #mock-'+jobId);await wait(()=>el('#mock-answer'),'mock session started');
 if(!el('.mock-progress').textContent.includes('第 1 / 3 題'))throw Error('Session progress not shown: '+el('.mock-progress').textContent);
 const mockBtn=t=>[...document.querySelectorAll('#mock-view button')].find(b=>b.textContent.trim()===t);
 if(mockBtn('看一個示範回答')||mockBtn('給我一個提示')||mockBtn('幫我整理成英文')||mockBtn('幫我講得更自然'))throw Error('Assistance offered during a mock session');
 if(!document.body.innerText.includes('整場結束後才會給回饋'))throw Error('Session does not explain that feedback comes at the end');
 const sess=()=>fetch('/api/mock-sessions').then(r=>r.json()).then(list=>list[0]);
 let s=await sess();
 if(s.entries.length!==3)throw Error('Session does not have three questions');
 if(new Set(s.entries.map(e=>e.question.category)).size!==3)throw Error('Session questions do not span three categories');
 fill('#mock-answer','I would restate the problem, then name the assumption I am least sure about.');
 click('#mock-submit');await wait(()=>el('.mock-progress').textContent.includes('第 2 / 3 題'),'advanced to the second question');
 if(document.body.innerText.includes('本次做得好的地方'))throw Error('A Feedback Report appeared between questions');
 // Voice works inside a session too.
 fakeMicrophone();
 click(mockBtn('開始錄音'));await wait(()=>el('#mock-view .recording-clock')&&!el('#mock-view .recording-clock').hidden,'session recording started');
 click(mockBtn('停止並轉成文字'));await wait(()=>el('#mock-answer').value.includes('demonstration transcript'),'session transcript lands in the answer box');
 click('#mock-submit');await wait(()=>el('.mock-progress').textContent.includes('第 3 / 3 題'),'advanced to the third question');
 // Skipping is honest: recorded as skipped, never assessed.
 window.confirm=()=>true;
 click('#mock-skip');await wait(()=>el('#mock-summary-heading'),'session summary');
 s=await sess();
 if(s.status!=='completed')throw Error('Session did not complete');
 if(s.entries[1].answer.inputMode!=='voice'||!s.entries[1].answer.recordingId)throw Error('Session answer kept no recording');
 if(!s.entries[2].skipped||s.entries[2].feedback)throw Error('Skipped question was assessed');
 if(s.entries.some(e=>e.feedback))throw Error('Per-question feedback was generated without being opened');
 const strengths=document.querySelectorAll('#mock-summary-heading ~ .feedback-feature .feedback-card');
 if(strengths.length!==2)throw Error('Expected exactly one strength and one priority, got '+strengths.length);
 if(!document.body.innerText.includes('不是分數'))throw Error('Summary does not disclaim a score');
 if(!document.body.innerText.includes('已跳過'))throw Error('Skipped question is not shown as skipped');
 const answered=[...document.querySelectorAll('.mock-entry[data-entry-id]')];
 if(answered.length!==2)throw Error('Expected two answered questions in the per-question list');
 // The summary must quote one of the learner's own session answers.
 const transcripts=s.entries.filter(e=>e.answer).map(e=>e.answer.transcript);
 for(const f of [s.summary.strength,s.summary.priorityImprovement])if(!transcripts.some(t=>t.includes(f.quote)))throw Error('Session Summary quoted something the learner never said');
 // Per-question feedback and assistance become available only now.
 click(answered[0].querySelector('button'));await wait(()=>answered[0].querySelector('.feedback-feature'),'per-question feedback on demand');
 if((await sess()).entries.filter(e=>e.feedback).length!==1)throw Error('Opening one question generated feedback for others');
 if(document.documentElement.scrollWidth>innerWidth)throw Error('Mobile overflow on the mock summary');
 // A completed session is listed under its job and never became a Practice Record.
 const wsNow=await ws();
 const sessionTexts=new Set(s.entries.filter(e=>e.answer).map(e=>e.answer.transcript));
 if(Object.values(wsNow.records).some(r=>(r.attempts||[]).some(a=>sessionTexts.has(a.transcript))))throw Error('Session answer leaked into a Practice Record');
 if(Object.values(wsNow.records).some(r=>r.focusPoint&&sessionTexts.has(r.focusPoint)))throw Error('Session produced a Focus Point');
 click('[data-view="history"]');await wait(()=>el('[data-job-id]'),'history after the session');
 const jobToggle=el('[data-job-id="'+jobId+'"] [aria-expanded]');
 if(!jobToggle)throw Error('Job has no practice to expand after the session');
 if(jobToggle.getAttribute('aria-expanded')!=='true')jobToggle.click();
 await wait(()=>el('[data-session-id]'),'session listed under its job');
 if(!el('[data-session-id]').textContent.includes('三題短場模擬'))throw Error('Session is not distinguishable from a Practice Record');
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
 console.log('Browser smoke PASS: resume default/opt-out, read-aloud (no autoplay, replay, speed, no overlap), three-minute recording with a visible clock, transcript replace/append handoff, retained Answer Recordings with playback and deletion, a full three-question Short Mock Session (no coaching during, skip, summary quoting the learner, per-question feedback on demand), draft failure/reload recovery, feedback retry, key-sentence corrections (normal/retry/no-change/evidence-safe), Focus-Point same-job practice, job-centred Records navigation, optional revision, separate AI assistance, one-answer completion and mobile layout.');
}finally{await browser('close').catch(()=>{});if(server)await new Promise(r=>server.close(r));await rm(directory,{recursive:true,force:true});}
