import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CodexLanguageModel} from '../src/codex-language.js';
import {validateAnalysis,validateFeedback,validateCoaching} from '../src/domain.js';
import {MODEL_CONTRACT_VERSION} from '../src/model-contracts.js';
if(!process.argv.includes('--accept-subscription-usage'))throw Error('Requires --accept-subscription-usage (up to 10 synthetic requests).');
const model=new CodexLanguageModel();
const jd='Backend Engineer\nBuild Python REST APIs and PostgreSQL data models.\nInvestigate slow queries and explain engineering trade-offs.\nDeploy services using Kubernetes and collaborate with teammates.';
const scenarios=[{name:'jd-only',snapshot:{text:jd}},{name:'resume-and-jd',snapshot:{text:jd,resume:{text:'Built a Python task manager with PostgreSQL. Implemented REST endpoints and unit tests for a class project.'}}},{name:'resume-gap',snapshot:{text:jd,resume:{text:'Built a Python task manager for a class project. I have not used Kubernetes.'},difficulty:'easier'}}];
const report={contractVersion:MODEL_CONTRACT_VERSION,generatedAt:new Date().toISOString(),synthetic:true,provider:model.name,sourceHashes:{},analyses:[],coaching:[],feedback:[],status:'running'};
for(const name of ['src/model-contracts.js','src/model-schemas.js','src/domain.js','src/codex-language.js'])report.sourceHashes[name]=createHash('sha256').update(await readFile(name)).digest('hex');
const save=async()=>{await mkdir('evaluation/v3',{recursive:true});await writeFile('evaluation/v3/personalized-live.json',JSON.stringify(report,null,2)+'\n');};
try {
 for(const scenario of scenarios){const output=validateAnalysis(await model.analyze(scenario),scenario.snapshot);report.analyses.push({...scenario,output});console.log('PASS analysis:',scenario.name);await save();}
 const question=report.analyses[1].output.questions.find(q=>q.category==='experience-depth');
 const first='I built a Python task manager for a class project. I implemented REST endpoints and wrote unit tests. I would inspect the query plan if an endpoint became slow.';
 for(const [mode,transcript] of [['hint',''],['gap',''],['ideas','我做過 Python 任務管理專案，負責 REST API 與單元測試。沒有用過 Kubernetes。'],['rewrite',first]]){
   const output=validateCoaching(await model.coach({question,transcript,mode}),mode,transcript);report.coaching.push({mode,question,transcript,output});console.log('PASS coaching:',mode);await save();
 }
 const firstFeedback=validateFeedback(await model.feedback({question,transcript:first,approvedEvidence:[]}),first);report.feedback.push({question,transcript:first,output:firstFeedback});await save();console.log('PASS feedback: first');
 const second=first+' My tests covered successful requests and invalid input. I would compare query plans before and after an index change, while considering its write cost.';
 const secondFeedback=validateFeedback(await model.feedback({question,transcript:second,previousAttempt:{transcript:first,feedback:firstFeedback},approvedEvidence:[]}),second);report.feedback.push({question,transcript:second,output:secondFeedback});console.log('PASS feedback: revision');
 report.status='automatic-pass';
}catch(error){report.status='failed';report.error=error.message;process.exitCode=1;console.error(error.message);}finally{await save();}
