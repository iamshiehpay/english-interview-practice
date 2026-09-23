import {test} from 'node:test';
import assert from 'node:assert/strict';
import {harness,setup} from './helpers.js';
import {FakeLanguageModel} from '../src/providers.js';
import {validateCoaching} from '../src/domain.js';
import {extractResume} from '../src/resume.js';

test('selected resume is frozen per JD; opt-out and replacement do not change existing questions',async t=>{
  const seen=[];const model=new FakeLanguageModel();const analyze=model.analyze.bind(model);model.analyze=async input=>{seen.push(input.snapshot);return analyze(input);};
  const {api}=await harness(t,model);
  await api('/resume',{name:'one.txt',text:'Built a Python task manager.'});
  const {snapshot,analysis}=await setup(api);
  assert.equal(snapshot.resume.name,'one.txt');assert.match(analysis.questions[1].text,/Python task manager/);
  await api('/resume',{name:'two.txt',text:'Designed hardware.'});
  assert.equal((await api(`/snapshots/${snapshot.id}`)).data.resume.name,'one.txt');
  const only=(await api('/snapshots',{text:'Build Kubernetes platforms.',useResume:false,difficulty:'deeper'})).data;
  await api(`/snapshots/${only.id}/analysis`,{});
  assert.equal(seen[1].resume,null);assert.equal(seen[1].difficulty,'deeper');
  assert.equal((await api('/resume',undefined,'DELETE')).status,200);
  assert.equal((await api(`/snapshots/${snapshot.id}`)).data.resume.name,'one.txt');
  await api('/workspace/delete',{confirmation:'DELETE ALL LOCAL DATA'});
  assert.equal((await api('/resume')).data,null);assert.deepEqual((await api('/workspace')).data.snapshots,{});
});

test('one real answer can finish; assistance is separate, cached, and never becomes an attempt',async t=>{
  const {api}=await harness(t);const {record}=await setup(api);const path=`/records/${record.id}`;
  assert.equal((await api(path+'/complete',{focusPoint:'說明取捨'})).status,409);
  assert.equal((await api(path+'/coaching',{mode:'rewrite'})).status,409);
  const ideas=await api(path+'/coaching',{mode:'ideas',transcript:'I would measure first.'});
  assert.equal(ideas.status,200);assert.equal((await api(path)).data.attempts.length,0);
  assert.deepEqual((await api(path+'/coaching',{mode:'ideas',transcript:'I would measure first.'})).data,ideas.data);
  await api(path+'/attempts',{transcript:'I would measure first.'});await api(path+'/feedback',{});
  assert.equal((await api(path+'/coaching',{mode:'rewrite'})).status,200);
  await api(path+'/draft',{transcript:'Unsubmitted revision',ideasText:'我想補充量測方式',attemptIndex:1});
  assert.equal((await api(path)).data.writtenDraft.ideasText,'我想補充量測方式');
  assert.equal((await api(path+'/complete',{focusPoint:'說明取捨'})).status,200);
  const saved=(await api(path)).data;assert.equal(saved.attempts.length,1);assert.equal(saved.writtenDraft,undefined);
  assert.equal((await api(path+'/draft',{transcript:'late edit',attemptIndex:1})).status,409);
  assert.equal((await api(path+'/attempts',{transcript:'late edit'})).status,409);
  assert.equal((await api('/progress')).data.length,1);
});

test('coaching validates language and rejects invented numeric metrics',()=>{
  assert.throws(()=>validateCoaching({text:'I improved it by 90 percent.',explanationZh:'更自然。'},'rewrite','I improved it.'),/invented/);
  assert.throws(()=>validateCoaching({text:'English hint',explanationZh:'提示'},'hint'),/coaching text has no Han characters/);
  assert.equal(validateCoaching({text:'I tested 10 cases.',explanationZh:'保留事實。'},'rewrite','I tested 10 cases.').text,'I tested 10 cases.');
});

test('illustrative coaching returns explicitly hypothetical English before answering, never an attempt',async t=>{
  const {api}=await harness(t);const {record}=await setup(api);const path=`/records/${record.id}`;
  const shown=await api(path+'/coaching',{mode:'illustrative'});
  assert.equal(shown.status,200);
  assert.equal(shown.data.mode,'illustrative');
  assert.match(shown.data.text,/[A-Za-z]/);
  assert.ok(shown.data.explanationZh);
  assert.equal((await api(path)).data.attempts.length,0);
  assert.equal((await api(path+'/coaching',{mode:'nonsense'})).status,400);
});

test('resume extraction accepts text and rejects wrong formats without persisting uploads',async()=>{
  assert.equal((await extractResume({name:'resume.txt',base64:Buffer.from('Python developer').toString('base64')})).text,'Python developer');
  await assert.rejects(extractResume({name:'fake.pdf',base64:Buffer.from('not a PDF').toString('base64')}),/有效/);
  await assert.rejects(extractResume({name:'script.js',base64:'YWJj'}),/PDF/);
});

test('cancelled coaching and deleted records cannot be revived by a late model response',async t=>{
  let release,started;const entered=new Promise(r=>started=r);const model=new FakeLanguageModel();
  model.coach=async()=>{started();return new Promise(r=>release=r);};
  const {api}=await harness(t,model);const {record}=await setup(api);
  const pending=api(`/records/${record.id}/coaching`,{mode:'hint'});await entered;
  await api(`/records/${record.id}`,undefined,'DELETE');
  release({text:'先說明做法。',explanationZh:'從具體問題開始。'});
  assert.equal((await pending).status,409);
  assert.equal((await api(`/records/${record.id}`)).status,404);
});

test('real local PDF and DOCX extractors return readable text',async t=>{
  const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');const run=promisify(execFile);
  const {mkdtemp,writeFile,readFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
  const dir=await mkdtemp(join(tmpdir(),'coach-doc-fixture-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  await writeFile(join(dir,'resume.txt'),'Python developer with PostgreSQL experience.');
  await run('/usr/bin/textutil',['-convert','docx',join(dir,'resume.txt'),'-output',join(dir,'resume.docx')]);
  const docx=await extractResume({name:'resume.docx',base64:(await readFile(join(dir,'resume.docx'))).toString('base64')});assert.match(docx.text,/PostgreSQL/);
  const stream='BT /F1 12 Tf 50 750 Td (Python developer with PostgreSQL experience.) Tj ET';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf='%PDF-1.4\n';const offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});const offset=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`;
  assert.match((await extractResume({name:'resume.pdf',base64:Buffer.from(pdf).toString('base64')})).text,/PostgreSQL/);
});
