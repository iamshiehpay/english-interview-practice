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
// Taiwan means Taiwan: a local office, a foreign employer's role here, or a remote
// role a person in Taiwan could hold. Each surviving candidate is tagged from its own
// text, never assumed, so the interface can say which of those a result actually is.
const taiwanTerms = ['taiwan', 'taipei', 'new taipei', 'hsinchu', 'taichung', 'tainan', 'kaohsiung', 'taoyuan', '台灣', '臺灣', '台北', '臺北', '新北', '新竹', '台中', '臺中', '台南', '臺南', '高雄', '桃園'];
const remoteTerms = ['remote', 'work from home', 'anywhere', 'distributed', 'telecommute', '遠端', '遠距', '在家工作'];
const hasTerm = (text, terms) => terms.some(term => text.includes(term));
export function locationTag(job) {
  const text = `${job.title}\n${job.location}\n${job.text}`.toLowerCase();
  const taiwan = hasTerm(text, taiwanTerms);
  const remote = hasTerm(text, remoteTerms);
  if (taiwan && remote) return 'taiwan-remote';
  if (taiwan) return 'taiwan';
  if (remote) return 'remote';
  return 'unknown';
}
// A profile term that names a place or a remote arrangement matches the recognised
// vocabulary as well as a literal substring, so "Taiwan" finds a Taipei posting.
const termMatches = (term, source, text) => {
  const needle = term.toLowerCase();
  if (source.includes(needle)) return true;
  if (hasTerm([needle], taiwanTerms)) return hasTerm(text, taiwanTerms);
  if (hasTerm([needle], remoteTerms)) return hasTerm(text, remoteTerms);
  return false;
};

// Two sources can carry the same posting. Collapse on the canonical URL, and on the
// same employer and title, so a shortlist of five is five real jobs.
export function dedupeJobs(jobs) {
  const seen = new Set();
  return jobs.filter(job => {
    const keys = [];
    try { const url = new URL(job.sourceUrl); keys.push(`url:${url.origin}${url.pathname.replace(/\/$/, '')}`); } catch { /* validated later */ }
    keys.push(`title:${String(job.title).trim().toLowerCase()}|${String(job.location).trim().toLowerCase()}`);
    if (keys.some(key => seen.has(key))) return false;
    for (const key of keys) seen.add(key);
    return true;
  });
}

// Which conditions removed the most candidates, computed locally so an empty result
// can name what is blocking the learner instead of showing nothing.
export function blockingConditions(jobs, profile) {
  const counts = [];
  for (const field of ['roles', 'locations', 'seniority', 'workArrangements']) {
    if (!profile[field]?.length) continue;
    const removed = jobs.filter(job => {
      const text = `${job.title}\n${job.location}\n${job.text}`.toLowerCase();
      const source = field === 'roles' ? job.title.toLowerCase() : field === 'locations' ? `${job.location}\n${job.text}`.toLowerCase() : text;
      return !profile[field].some(term => termMatches(term, source, text));
    }).length;
    if (removed) counts.push({field, terms: profile[field], removed});
  }
  if (profile.exclusions?.length) {
    const removed = jobs.filter(job => profile.exclusions.some(term => `${job.title}\n${job.location}\n${job.text}`.toLowerCase().includes(term.toLowerCase()))).length;
    if (removed) counts.push({field: 'exclusions', terms: profile.exclusions, removed});
  }
  return counts.sort((a, b) => b.removed - a.removed);
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
      // Location and work-arrangement terms also match the recognised vocabulary, so a
      // "Taiwan" criterion finds a Taipei posting and "remote" finds "work from home".
      const source=field==='roles'?job.title.toLowerCase():field==='locations'?`${job.location}\n${job.text}`.toLowerCase():text;
      const matches=profile[field].filter(term=>termMatches(term,source,text));
      if(profile[field].length && !matches.length)return [];
      if(matches.length)reasons.push(`${field}: ${matches.join(', ')}`);
    }
    const priorities=profile.priorities.filter(term=>text.includes(term.toLowerCase()));
    if(priorities.length)reasons.push(`priorities: ${priorities.join(', ')}`);
    if(!reasons.length)reasons.push('No restrictive criteria; inspect this posting before selecting it.');
    return [{id:job.id,title:job.title,location:job.location,text:job.text,sourceUrl:job.sourceUrl,source:job.source,reasons,locationTag:locationTag(job),priorityMatches:priorities.length}];
  }).sort((a,b)=>b.priorityMatches-a.priorityMatches).slice(0,30);
}

// Several sources searched together. One source failing must not void the run: its
// failure is reported and the healthy sources' results still come back.
export class MultiJobSource {
  constructor(sources) {
    requireValue(Array.isArray(sources) && sources.length, 'Configure at least one Job Source');
    this.sources = sources;
    this.external = sources.some(source => source.external);
    this.name = sources.map(source => source.name).join(' + ');
  }
  async search({profile, signal} = {}) {
    const settled = await Promise.allSettled(this.sources.map(source => source.search({profile, signal})));
    this.lastSourceStatus = settled.map((result, index) => ({
      source: this.sources[index].name,
      ok: result.status === 'fulfilled',
      ...(result.status === 'rejected' ? {error: result.reason?.status === 429 ? 'rate-limited' : result.reason?.status === 504 ? 'timed-out' : 'unavailable'} : {})
    }));
    requireValue(this.lastSourceStatus.some(status => status.ok), 'Every Job Source failed. Retry later or paste a JD.', 502);
    const merged = settled.flatMap((result, index) => result.status === 'fulfilled' ? result.value.map(job => ({...job, id: `${index}:${job.id}`})) : []);
    return dedupeJobs(merged).slice(0, 100);
  }
  // URL intake belongs to whichever configured source recognises the URL.
  async fetchUrl(url, options) {
    const capable = this.sources.filter(source => typeof source.fetchUrl === 'function');
    requireValue(capable.length, 'No configured Job Source supports URL intake; paste the JD.', 400);
    let last;
    for (const source of capable) {
      try { return await source.fetchUrl(url, options); }
      catch (error) { last = error; }
    }
    throw last;
  }
}

// Curation is the only step that sees the resume, and it may name only postings it
// was given. Numbers must already appear in the posting excerpt or the resume — the
// same evidence-safety rule the Key-Sentence Correction validator applies.
export function validateJobCuration(value, candidates, resumeText = '') {
  const fail = () => requireValue(false, 'Invalid provider output: job curation schema, citation, or invented detail', 502);
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1 || !Array.isArray(value.selections) || value.selections.length > 5) fail();
  const byId = new Map(candidates.map(candidate => [candidate.id, candidate]));
  const lists = ['matched', 'transferable', 'gaps', 'unknown'];
  const names = ['id', 'whyFitZh', ...lists];
  const numbersIn = text => text.match(/\d+(?:[.,]\d+)*/g) || [];
  const seen = new Set();
  const selections = [];
  for (const item of value.selections) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).length !== names.length || !names.every(name => Object.hasOwn(item, name))) fail();
    const candidate = byId.get(item.id);
    if (!candidate || seen.has(item.id)) fail();
    seen.add(item.id);
    if (!nonempty(item.whyFitZh) || !/\p{Script=Han}/u.test(item.whyFitZh) || item.whyFitZh.length > 1000) fail();
    for (const name of lists) {
      const list = item[name];
      if (!Array.isArray(list) || list.length > 6 || !list.every(entry => nonempty(entry) && entry.length <= 200)) fail();
    }
    const allowed = numbersIn(`${candidate.excerpt}\n${resumeText}`);
    const claimed = [item.whyFitZh, ...lists.flatMap(name => item[name])];
    if (claimed.some(text => numbersIn(text).some(number => !allowed.includes(number)))) fail();
    selections.push({id: item.id, whyFitZh: item.whyFitZh, ...Object.fromEntries(lists.map(name => [name, [...item[name]]]))});
  }
  return {selections};
}

export async function boundedSource(operation, timeoutMs = 10000) {
  let timer;
  try {return await Promise.race([operation(), new Promise((_, reject) => {timer=setTimeout(()=>reject(new AppError('Job Source timed out; retry or paste a JD.',504)),timeoutMs);})]);}
  finally {clearTimeout(timer);}
}
