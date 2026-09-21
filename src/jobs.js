import {AppError, requireValue, nonempty} from './domain.js';
export const profileFields = ['roles', 'locations', 'seniority', 'workArrangements', 'priorities', 'exclusions', 'salary'];
// `salary` was added after the first release. A profile saved without it still loads
// and still validates; only the six original fields are required on a write.
const requiredProfileFields = profileFields.filter(key => key !== 'salary');
export const emptyProfile = () => Object.fromEntries(profileFields.map(key => [key, []]));
export function validateProfile(input) {
  requireValue(input && typeof input === 'object' && !Array.isArray(input), 'Provide the job search criteria as lists');
  const keys = Object.keys(input);
  requireValue(requiredProfileFields.every(key => keys.includes(key)) && keys.every(key => profileFields.includes(key)), 'Provide all job search criteria as lists (up to 20 terms each)');
  requireValue(profileFields.every(key => input[key] === undefined || (Array.isArray(input[key]) && input[key].length <= 20 && input[key].every(v => nonempty(v) && v.length <= 100))), 'Provide all job search criteria as lists (up to 20 terms each)');
  return Object.fromEntries(profileFields.map(key => [key, [...new Set((input[key] ?? []).map(s => s.trim()))]]));
}
// A proposal comes from a model, so a malformed one is invalid provider output (502),
// not a learner mistake (400); it is shown for confirmation and never saved directly.
export function validateProfileProposal(value) {
  requireValue(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === profileFields.length && profileFields.every(key => Object.hasOwn(value, key)), 'Invalid provider output: search profile schema', 502);
  try { return validateProfile(value); }
  catch { return requireValue(false, 'Invalid provider output: search profile schema', 502); }
}
export class FakeJobSource {
  name = 'Synthetic demonstration jobs';
  async search() {
    return [
      {id:'demo-ai',title:'AI Software Engineer',location:'Taipei',text:'AI Software Engineer\nTaipei · Mid-level · Hybrid\nBuild reliable Python APIs and evaluate language models. Communicate trade-offs.',sourceUrl:'https://example.com/demo-ai',source:this.name},
      {id:'demo-backend',title:'Senior Backend Engineer',location:'Hsinchu',text:'Senior Backend Engineer\nHsinchu · Onsite\nDesign reliable services and mentor engineers.',sourceUrl:'https://example.com/demo-backend',source:this.name}
    ];
  }
}
function plainText(html) {
  let text = String(html);
  for (let i=0;i<2;i++) text=text.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/&amp;/g,'&');
  return text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,'\n').replace(/\n\s*\n/g,'\n').trim();
}
export class GreenhouseJobSource {
  constructor(board, fetcher = fetch) {requireValue(/^[a-zA-Z0-9_-]{1,80}$/.test(board),'Invalid Greenhouse board token');this.board=board;this.fetcher=fetcher;this.external=true;this.name=`Greenhouse / ${board}`;}
  async request(suffix, signal) {
    const response=await this.fetcher(`https://boards-api.greenhouse.io/v1/boards/${this.board}/jobs${suffix}`,{method:'GET',redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)});
    if(response.status===429)throw new AppError('Job Source rate limit reached. Retry later or paste a JD.',429);
    requireValue(response.ok,'Job Source unavailable. Retry later or paste a JD.',502);
    let bytes=0;const chunks=[];
    for await(const chunk of response.body){bytes+=chunk.length;requireValue(bytes<=4_000_000,'Job Source response exceeds limit; paste a JD.',502);chunks.push(chunk);}
    try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AppError('Malformed Job Source response; paste a JD.',502);}
  }
  convert(job) {
    requireValue(job && nonempty(job.title) && nonempty(job.content) && nonempty(job.absolute_url),'Job Source returned an incomplete posting',502);
    return {id:String(job.id),title:job.title,location:job.location?.name||'Not stated',text:`${job.title}\n${job.location?.name||'Location not stated'}\n${plainText(job.content)}`,sourceUrl:job.absolute_url,source:this.name};
  }
  async search({signal}={}) {const result=await this.request('?content=true',signal);requireValue(Array.isArray(result.jobs),'Malformed Job Source list',502);return result.jobs.slice(0,100).map(job=>this.convert(job));}
  async fetchUrl(url,{signal}={}) {
    let parsed;try{parsed=new URL(url);}catch{throw new AppError('Enter a supported Greenhouse job URL or paste the JD.');}
    const match=parsed.pathname.match(/^\/([^/]+)\/jobs\/(\d+)\/?$/);
    requireValue(parsed.protocol==='https:' && ['boards.greenhouse.io','job-boards.greenhouse.io'].includes(parsed.hostname) && !parsed.username && !parsed.password && !parsed.port && match && match[1]===this.board,'URL must belong to the configured Greenhouse board; otherwise paste the JD.');
    return this.convert(await this.request('/'+match[2],signal));
  }
}
export function matchingJobs(jobs, profile) {
  requireValue(Array.isArray(jobs) && jobs.length <= 100,'Job Source exceeded result limit',502);
  requireValue(new Set(jobs.map(job=>job?.id)).size === jobs.length,'Duplicate Job Source identifiers',502);
  return jobs.flatMap(job=>{
    requireValue(job && ['id','title','location','text','sourceUrl','source'].every(k=>nonempty(job[k])) && job.text.length<=200000 && job.id.length<=200 && job.title.length<=300 && job.location.length<=200 && job.source.length<=200 && job.sourceUrl.length<=2000,'Invalid Job Source result',502);
    let url;try{url=new URL(job.sourceUrl);}catch{throw new AppError('Invalid Job Source URL',502);}
    requireValue(['http:','https:'].includes(url.protocol) && !url.username && !url.password,'Invalid Job Source URL',502);
    const text=`${job.title}\n${job.location}\n${job.text}`.toLowerCase();
    if(profile.exclusions.some(term=>text.includes(term.toLowerCase())))return [];
    const reasons=[];
    for(const field of ['roles','locations','seniority','workArrangements']){
      const source=field==='roles'?job.title.toLowerCase():field==='locations'?job.location.toLowerCase():text;
      const matches=profile[field].filter(term=>source.includes(term.toLowerCase()));
      if(profile[field].length && !matches.length)return [];
      if(matches.length)reasons.push(`${field}: ${matches.join(', ')}`);
    }
    const priorities=profile.priorities.filter(term=>text.includes(term.toLowerCase()));
    if(priorities.length)reasons.push(`priorities: ${priorities.join(', ')}`);
    if(!reasons.length)reasons.push('No restrictive criteria; inspect this posting before selecting it.');
    return [{id:job.id,title:job.title,location:job.location,text:job.text,sourceUrl:job.sourceUrl,source:job.source,reasons,priorityMatches:priorities.length}];
  }).sort((a,b)=>b.priorityMatches-a.priorityMatches).slice(0,30);
}

export async function boundedSource(operation, timeoutMs = 10000) {
  let timer;
  try {return await Promise.race([operation(), new Promise((_, reject) => {timer=setTimeout(()=>reject(new AppError('Job Source timed out; retry or paste a JD.',504)),timeoutMs);})]);}
  finally {clearTimeout(timer);}
}
