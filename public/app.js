import {mountVoice, mountReadAloud, resetReadAloud, hasPendingRecording} from './voice.js';
import {annotateTranscript, collapseTags, wordDiff, elideUnchanged} from './annotate.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const categories = {
  'role-fit': '職務動機與適配',
  'experience-depth': '經驗與專案深度',
  behavioral: '行為與情境判斷',
  'technical-communication': '技術說明'
};
const dimensions = {
  relevance: '切題程度',
  support: '論據與例子',
  structure: '回答結構',
  englishExpression: '英文表達'
};
const recordStates = {answer:'準備初答',feedback:'等待回饋',revise:'等待修改回答',compare:'等待比較與保存',completed:'已完成'};
const operationNames = {analysis:'產生題目',questions:'新增題目',feedback:'取得回饋','follow-up':'產生追問題目','follow-up-feedback':'取得追問回饋','follow-up-transcription':'追問語音轉成文字','session-summary':'整理整場回饋','session-feedback':'取得逐題回饋','session-transcription':'模擬語音轉成文字','session-corrections':'整理關鍵句修正','session-coaching':'準備英文示範',followUp:'產生追問題目',coaching:'準備練習建議',corrections:'整理關鍵句修正',transcription:'語音轉成文字',discovery:'搜尋職缺',interpret:'整理搜尋條件',url:'取得職缺'};

let workspace = {snapshots:{}, analyses:{}, records:{}};
let providerInfo;
let languageStatus = {ready:true};
let currentView = 'home';
let currentRecordId = null;
let currentSnapshotId = null;
let viewToken = 0;
let disposeVoice = () => {};
let draftSession = null;
let operationsSignature = '';
let captureBusy = false;
const historyState = {query:'', filter:'all', page:0, openJob:null, renaming:null};
const JOBS_PER_PAGE = 6;
const requestKeys = new Map();

class ApiError extends Error {
  constructor(message, status, retryable) { super(message); this.status = status; this.retryable = retryable; }
}

function localizeError(message, status, unrecognised) {
  const rules = [
    [/Paste a job description/i, '請先貼上職缺描述。'],
    [/Operation cancelled|cancelled or superseded/i, '操作已取消；先前保存的內容仍在本機。'],
    [/Operation already pending for this practice/i, '這筆練習的操作仍在進行，請等待或取消後再試。'],
    [/timed out/i, '服務等待逾時。已保存的內容不受影響，請重試原操作。'],
    [/No speech was detected/i, '這段錄音沒有辨識到內容。可能是講話太小聲、麥克風選錯輸入來源，或這段其實沒有錄到聲音。建議重新錄一次，或改用文字。'],
    [/Unsupported audio format/i, '這個瀏覽器錄出來的音訊格式不支援。請改用 Chrome 或 Safari，或改用文字回答。'],
    [/Audio must be valid base64/i, '錄音檔太大或已損毀。請縮短回答後重錄，或改用文字。'],
    [/External provider request failed.*HTTP (4|5)\d\d/i, '語音服務回報這段音訊有問題。請看終端機的 [provider] 訊息了解原因，或重新錄一次。'],
    [/readings are already in progress/i, '同時朗讀的數量已達上限，請等前一段朗讀結束再試。'],
    [/cannot read text aloud|read aloud takes a reference|Only an Illustrative Answer can be read aloud|Only English practice text is read aloud|supported reading speed|Nothing to read aloud/i, '這段內容目前無法朗讀；英文題目、示範回答與關鍵句修正才支援朗讀。'],
    [/rate limit/i, '服務目前請求過多，請稍後重試。'],
    [/Invalid provider output|schema|citation/i, '服務回傳的內容格式無法使用，未寫入練習紀錄。請重試。'],
    [/Provider or storage operation failed/i, '服務或本機儲存操作失敗；已成功保存的內容仍在，請重試。'],
    [/Generate a Question Set first/i, '請先為這份職缺產生題目。'],
    [/Question Set changed/i, '題組已更新，請重新載入後再試。'],
    [/Enter a text draft/i, '草稿內容過長，請縮短後再儲存。'],
    [/Practice changed|Transcript draft changed/i, '練習內容已在其他地方更新，請重新開啟後再試。'],
    [/Enter an answer|Enter a follow-up answer/i, '請先寫下你的英文回答。'],
    [/Finish feedback before/i, '請先完成目前回答的回饋，再進入下一步。'],
    [/at most two follow-ups|follow-up limit|already has two follow-ups/i, '每道主問最多兩次追問，現在可以結束並保存。'],
    [/previous follow-up|preceding follow-up|Complete follow-up feedback/i, '請先完成這次追問的回饋，再繼續追問。'],
    [/Reference unavailable/i, '完成修改回答與第二次回饋後，才能查看參考表達。'],
    [/Complete both/i, '請先完成兩次回答與回饋。'],
    [/meaningful Focus Point|up to 500 characters/i, '請填寫一項有意義的下次練習重點（最多 500 字）。'],
    [/Not found/i, '找不到這筆資料，可能已被刪除。'],
    [/Codex subscription login required/i, '請先到設定完成 Codex 登入與驗證。'],
    [/codex:verify|isolation verification/i, 'Codex 需要重新完成本機隔離驗證：請在專案終端執行 npm run codex:verify，完成後再重試（例如更新過程式或重啟服務後可能需要）。'],
    [/Type DELETE ALL LOCAL DATA/i, '請輸入 DELETE ALL LOCAL DATA 以確認刪除。']
  ];
  const match = rules.find(([pattern]) => pattern.test(message || ''));
  if (match) return match[1];
  if (status >= 500) return '服務暫時無法完成操作；已成功保存的內容仍在，請重試。';
  if (/[\u3400-\u9fff]/u.test(message || '')) return message;
  // Callers reporting a recorded failure pass the original text as `unrecognised`:
  // a generic sentence there would hide the very reason being reported.
  return unrecognised ?? '目前的輸入或操作狀態無法接受，請檢查畫面提示後重試。';
}

async function api(path, data, method) {
  const followUpExternal = /\/records\/[^/]+\/follow-ups(?:\/[^/]+\/feedback)?$/.test(path);
  const external = data !== undefined && (/\/(analysis|questions|feedback|transcription|coaching|corrections)$/.test(path) || followUpExternal || path === '/discovery' || path === '/snapshots/from-url');
  const payload = data === undefined ? '' : JSON.stringify(data);
  const digest = external ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload)))).map(n => n.toString(16).padStart(2, '0')).join('') : '';
  const key = external ? `${path}|${digest}` : null;
  if (external && !requestKeys.has(key)) requestKeys.set(key, crypto.randomUUID());
  const options = {method: method || (data === undefined ? 'GET' : 'POST')};
  if (data !== undefined) {
    options.headers = {'Content-Type':'application/json', ...(external ? {'X-Request-Id':requestKeys.get(key)} : {})};
    options.body = payload;
  }
  const response = await fetch(`/api${path}`, options);
  const result = await response.json();
  if (!response.ok) throw new ApiError(localizeError(result.error, response.status), response.status, result.retryable);
  if (external) requestKeys.delete(key);
  return result;
}

function setError(message = '') { $('#error').textContent = message; }
function setNotice(message = '') {
  $('#notice').textContent = message;
  if (message) setTimeout(() => { if ($('#notice').textContent === message) $('#notice').textContent = ''; }, 4500);
}
function button(text, handler, parent, {kind='primary', id, attributes={}} = {}) {
  const control = document.createElement('button');
  control.type = 'button';
  control.textContent = text;
  control.className = kind;
  if (id) control.id = id;
  for (const [name, value] of Object.entries(attributes)) control.setAttribute(name, value);
  control.addEventListener('click', async () => {
    setError();
    control.disabled = true;
    try { await handler(); }
    catch (error) { setError(error.message); }
    finally { if (control.isConnected) control.disabled = false; }
  });
  parent.append(control);
  return control;
}
function firstLine(text) { return String(text || '').split('\n').map(line => line.trim()).find(Boolean) || '未命名職缺'; }
function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : new Intl.DateTimeFormat('zh-TW', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}).format(date);
}
function sortRecent(records) { return [...records].sort((a,b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)); }
function modelReady() { return !providerInfo?.languageModel?.subscription || languageStatus?.ready === true; }
function providerName(info) { return info?.external ? info.name : '本機示範服務'; }
function outboundLabel(value) {
  const rules = [
    [/JD text.*analysis/i, '產生題目時傳送職缺與你選用的履歷'],
    [/JD.*question set/i, '新增題目時傳送職缺、選用履歷與現有題組'],
    [/current question and transcript/i, '回饋或英文協助時傳送目前題目與你的回答／想法'],
    [/recorded audio only/i, '語音轉錄時只傳送錄音'],
    [/English practice text for reading aloud/i, '朗讀時只傳送畫面上的英文練習內容，中文說明不會傳送'],
    [/public board token/i, '取得公開職缺時傳送職缺板識別與職缺編號；搜尋條件留在本機']
  ];
  return rules.find(([pattern]) => pattern.test(value))?.[1] || '依這項服務的用途傳送必要資料';
}

// Read-aloud is reference-addressed: the server resolves the English text from its
// own stored data, so nothing on this page decides what gets spoken.
function readAloud(parent, reference, label, hideable) {
  // An ApiError message is already localized; a browser playback failure is raw English,
  // so it is replaced rather than shown to the learner. `hideable` is the question text
  // that listening mode hides; omit it where there is no question to hide.
  return mountReadAloud(parent, reference, {api, provider:providerInfo?.speech, label, hideable,
    onError:error => setError(error instanceof ApiError ? error.message : '這個瀏覽器無法播放這段朗讀音訊。你可以再試一次，或直接閱讀畫面上的英文。')});
}
// The question text and its Chinese meaning sit either side of the read-aloud control.
const questionText = scope => [scope?.querySelector('.question-text, .follow-up-question'), scope?.querySelector('details')].filter(Boolean);
// An Answer Recording is evidence of what the learner said. It is served from this
// machine, never cached, and an edited transcript is labelled rather than the audio
// being presented as matching the edited text.
function playerHtml(attempt, {label = '回聽這次的錄音'} = {}) {
  if (!attempt?.recordingId) return '';
  const entry = workspace.recordings?.[attempt.recordingId];
  if (entry && entry.state !== 'retained') return '';
  const edited = attempt.transcriptEdited ? '<p class="meta">錄音保留你當時說的原音；上面的文字是你之後修改過的版本。</p>' : '';
  return `<div class="answer-recording"><p class="meta">${escape(label)}</p><audio controls preload="none" src="/api/recordings/${escape(attempt.recordingId)}"></audio>${edited}</div>`;
}
function recordingBytesLabel() {
  const total = Object.values(workspace.recordings || {}).filter(entry => entry.state === 'retained').reduce((sum, entry) => sum + (entry.bytes || 0), 0);
  const count = Object.values(workspace.recordings || {}).filter(entry => entry.state === 'retained').length;
  if (!count) return '目前沒有保存任何回答錄音。';
  return `目前保存 ${count} 段回答錄音，約 ${total < 1_000_000 ? Math.max(1, Math.round(total / 1000)) + ' KB' : (total / 1_000_000).toFixed(1) + ' MB'}，全部只存在這台裝置。刪除練習或職缺時會一併刪除。`;
}

function clearDraftSession() {
  if (draftSession?.timer) clearTimeout(draftSession.timer);
  draftSession = null;
}
async function saveDraft(session = draftSession, force = false) {
  if (!session || session !== draftSession) return true;
  if (session.timer) clearTimeout(session.timer);
  const requestedValue = session.textarea.value;
  if (!force && !session.dirty && requestedValue === session.savedValue && (session.ideas?.value || '') === session.savedIdeas) return true;
  const run = session.queue.catch(() => {}).then(async () => {
    if (session !== draftSession) return true;
    const value = session.textarea.value;
    const ideasText = session.ideas?.value || '';
    if (!force && value === session.savedValue && ideasText === session.savedIdeas) { session.dirty = false; return true; }
    session.status.textContent = '正在儲存草稿…';
    session.status.classList.remove('error');
    if ($('#retry-draft')) $('#retry-draft').hidden = true;
    try {
      const saved = await api(`/records/${session.recordId}/draft`, {transcript:value, ideasText, attemptIndex:session.attemptIndex});
      session.savedValue = value; session.savedIdeas = ideasText;
      if (session !== draftSession) return true;
      if (session.textarea.value === value && (session.ideas?.value || '') === ideasText) {
        session.dirty = false;
        session.status.textContent = `已儲存草稿 · ${dateLabel(saved.savedAt)}`;
      } else {
        session.dirty = true;
        scheduleDraftSave(session);
      }
      return true;
    } catch (error) {
      if (session === draftSession) {
        session.dirty = true;
        session.status.textContent = '草稿儲存失敗。請重試後再離開這一頁。';
        session.status.classList.add('error');
        if ($('#retry-draft')) $('#retry-draft').hidden = false;
      }
      throw error;
    }
  });
  session.queue = run;
  return run;
}
function scheduleDraftSave(session) {
  if (session.timer) clearTimeout(session.timer);
  session.status.textContent = '尚未儲存…';
  session.status.classList.remove('error');
  session.timer = setTimeout(() => saveDraft(session).catch(() => setError('草稿尚未成功儲存；請按「重試儲存草稿」。')), 550);
}
async function leaveEditor() {
  if (!draftSession?.dirty) return true;
  try { await saveDraft(draftSession, true); return true; }
  catch { setError('草稿儲存失敗，已留在目前頁面。請重試儲存後再切換。'); return false; }
}

// App shell: the rail marks where you are, the topbar breadcrumb names the view and,
// inside a job, the job it belongs to. Practice and the mock session live under 開始練習.
const viewLabels = {home:'開始練習', practice:'開始練習', mock:'三題短場模擬', discovery:'找職缺', history:'練習紀錄', progress:'我的進步', evidence:'我的履歷', settings:'設定'};
const railViews = {practice:'home', mock:'home'};
function setJobContext(title) {
  const full = String(title || '').replace(/\s+/g, ' ').trim();
  $('#crumb-job-title').textContent = truncate(full);
  $('#crumb-job-title').title = full;
  $('#crumb-job').hidden = !full;
  $('.crumb').classList.toggle('has-job', Boolean(full));
}
// The practice step indicator in the topbar: 題目／作答／回饋／追問（可選）.
// `current` 0-3 marks the step in progress; 4 means the Practice Loop is completed.
const practiceSteps = ['題目', '作答', '回饋', '追問（可選）'];
const checkIcon = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m5 12 5 5 9-10"/></svg>';
function setSteps(current) {
  const list = $('#crumb-steps');
  list.hidden = current === undefined;
  if (current === undefined) { list.replaceChildren(); return; }
  list.setAttribute('aria-label', current > 3 ? '練習進度：已完成' : `練習進度：${practiceSteps[current]}（第 ${current + 1} 步，共 4 步）`);
  list.innerHTML = practiceSteps.map((label, index) => {
    const state = index < current ? 'done' : index === current ? 'now' : '';
    return `${index ? '<li class="step-line" aria-hidden="true"></li>' : ''}<li class="step ${state}" title="${escape(label)}"${state === 'now' ? ' aria-current="step"' : ''}><i aria-hidden="true">${state === 'done' ? checkIcon : index + 1}</i><span>${escape(label)}</span></li>`;
  }).join('');
}
// Sticky offsets depend on the topbar (which wraps on phones) and on the practice
// footer (which wraps when it holds several actions), so both are measured.
const layoutObserver = new ResizeObserver(() => syncLayoutMetrics());
let observedFoot = null;
function syncLayoutMetrics() {
  const root = document.documentElement.style;
  root.setProperty('--topbar-offset', `${$('.topbar').offsetHeight}px`);
  const foot = $('#practice .fb-foot');
  if (foot !== observedFoot) {
    if (observedFoot) layoutObserver.unobserve(observedFoot);
    if (foot) layoutObserver.observe(foot);
    observedFoot = foot;
  }
  root.setProperty('--foot-h', `${foot?.offsetHeight || 0}px`);
}
layoutObserver.observe($('.topbar'));
function setMenuOpen(open, {restoreFocus = false} = {}) {
  const toggle = $('#menu-toggle');
  document.body.classList.toggle('menu-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? '關閉選單' : '開啟選單');
  $('.rail-scrim').hidden = !open;
  if (open) $('#primary-nav [data-view]')?.focus();
  else if (restoreFocus) toggle.focus();
}
$('#menu-toggle').addEventListener('click', () => setMenuOpen(!document.body.classList.contains('menu-open')));
$('.rail-scrim').addEventListener('click', () => setMenuOpen(false, {restoreFocus:true}));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && document.body.classList.contains('menu-open')) setMenuOpen(false, {restoreFocus:true}); });

// theme-color values: the light --canvas (as shipped in index.html) and the room's --m-bg.
const lightThemeColor = $('meta[name="theme-color"]')?.getAttribute('content') || '#FAFAFA';
const roomThemeColor = '#0B0B0E';
function markView(name) {
  viewToken += 1;
  currentView = name;
  document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === `${name}-view`));
  const railView = railViews[name] || name;
  document.querySelectorAll('#primary-nav [data-view]').forEach(control => {
    if (control.dataset.view === railView) control.setAttribute('aria-current', 'page');
    else control.removeAttribute('aria-current');
  });
  $('#crumb-view').textContent = viewLabels[name] || '';
  setJobContext('');
  setSteps();
  document.body.classList.remove('workbench-mode');
  // The Short Mock Session is the one dark screen: the browser chrome follows it
  // there and returns to the light canvas everywhere else.
  document.body.classList.toggle('room-mode', name === 'mock');
  $('meta[name="theme-color"]')?.setAttribute('content', name === 'mock' ? roomThemeColor : lightThemeColor);
  setMenuOpen(false);
  window.scrollTo({top:0, behavior:'smooth'});
}
async function navigate(name) {
  if (!(await leaveEditor())) return;
  clearDraftSession();
  disposeVoice(); followUpVoice.dispose(); followUpVoice.dispose = () => {}; followUpVoice.draftId = null; resetReadAloud();
  disposeVoice = () => {};
  if (name !== 'practice') currentRecordId = null;
  disposeMockVoice();
  markView(name);
  if (name === 'home') renderHome();
  if (name === 'history') renderHistory();
  if (name === 'progress') await renderProgress();
  if (name === 'evidence') await renderEvidence();
  if (name === 'discovery') await renderDiscovery();
  if (name === 'settings') renderSettings();
}
document.querySelectorAll('[data-view]').forEach(control => control.addEventListener('click', () => navigate(control.dataset.view).catch(error => setError(error.message))));

async function refreshWorkspace() { workspace = await api('/workspace'); return workspace; }

function truncate(text, max = 60) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim();
  return value.length > max ? value.slice(0, max).trimEnd() + '…' : value;
}
// The job and the step now live in the topbar breadcrumb; the page body keeps only
// the practice content.
function practiceFrame({step=0, snapshot, content}) {
  setJobContext(snapshot ? jobTitle(snapshot) : '');
  setSteps(step);
  return `<article class="practice-shell"><div class="practice-body">${content}</div></article>`;
}

// Home feedback preview (issue 0025): a fixed, fictional sample — never the
// learner's data and never fetched — rendered once through the same
// annotatedTranscriptHtml/feedbackHtml the practice screen uses, so it cannot
// drift from the real feedback layout. The panel is inert: a picture of the
// feedback, not a control, so it never takes keyboard focus from the JD form.
const homePreviewSample = {
  question: {text:'Tell me about a time you made an API more reliable.', meaningZh:'請分享一次你讓 API 變得更穩定可靠的經驗。'},
  transcript: 'Our order API timed out almost every night, so I added retries with backoff and a circuit breaker to the payment calls. After that, the error rate drop a lot, and customers stopped complaining. I also wrote a runbook so the on-call team know what to check first.',
  feedback: {
    strength: {textZh:'你直接說出做了哪兩個具體機制，而不是只說「優化了系統」，面試官能立刻聽懂你的做法。', quote:'I added retries with backoff and a circuit breaker'},
    priorityImprovement: {textZh:'把成果講成數字：錯誤率從多少降到多少、多久內做到。沒有數字，「降很多」很難讓人相信。', quote:'the error rate drop a lot'},
    ratings: {
      relevance: {level:4, quote:'I added retries with backoff and a circuit breaker', reasonZh:'緊扣「讓 API 更可靠」，每一句都在回答題目。'},
      support: {level:2, quote:'the error rate drop a lot', reasonZh:'有做法，但成果沒有數字或比較基準，說服力不足。'},
      structure: {level:3, quote:'Our order API timed out almost every night', reasonZh:'先交代問題再說做法，順序清楚；結尾可以補一句學到什麼。'},
      englishExpression: {level:2, quote:'the on-call team know what to check first', reasonZh:'意思清楚，但動詞時態與單複數要注意：drop → dropped、know → knows。'}
    }
  }
};
function renderHomePreview() {
  const holder = $('#home-preview');
  if (!holder || holder.childElementCount) return;
  const {question, transcript, feedback} = homePreviewSample;
  const key = registerAnnotation('home-sample', {transcript, feedback});
  holder.innerHTML = `<p class="preview-q" lang="en">${escape(question.text)}</p><p class="preview-zh">${escape(question.meaningZh)}</p>
    <p class="fb-label">範例回答</p>${annotatedTranscriptHtml(key, {legend:true})}${feedbackHtml(feedback, key)}`;
  const opened = holder.querySelector(`[data-note-id="${key}-support"]`);
  if (opened) opened.open = true;
  $('#preview-summary').textContent = `範例題目：${question.text}（${question.meaningZh}）範例回答中標出一句做得好（優）與一句優先改進（改），並附中文說明，以及切題程度、論據與例子、回答結構、英文表達四項 1 到 4 分評分。`;
}

function renderHome() {
  markView('home');
  const parent = $('#resume-practice');
  parent.replaceChildren();
  const unfinished = sortRecent(Object.values(workspace.records || {}).filter(record => record.status !== 'completed'))[0];
  if (unfinished) {
    const snapshot = workspace.snapshots[unfinished.snapshotId];
    const card = document.createElement('section');
    card.className = 'resume-card';
    card.innerHTML = `<p class="eyebrow">繼續上次練習</p><h2 title="${escape(jobTitle(snapshot))}">${escape(truncate(jobTitle(snapshot)))}</h2><p>${escape(recordStates[unfinished.status] || unfinished.status)} · ${escape(unfinished.question.text)}</p><div class="actions"></div>`;
    button('繼續練習', () => showRecord(unfinished.id), card.querySelector('.actions'));
    parent.append(card);
  }
  const resumeChoice = $('#resume-choice');
  resumeChoice.innerHTML = workspace.resume ? `<label class="check-label"><input id="use-resume" type="checkbox" checked>搭配履歷：${escape(workspace.resume.name)}</label><p class="meta">取消勾選即可只用 JD 出題。</p>` : '<p class="meta">還沒有履歷？可以直接開始，或到「我的履歷」上傳。</p>';
  const recent = sortRecent(Object.values(workspace.records || {}).filter(r=>r.status==='completed')).slice(0,3);
  $('#home-progress').innerHTML = recent.length ? `<h2>下次，接著練這裡</h2>${recent.map(r=>`<article class="list-card"><p>${escape(r.focusPoint)}</p><button class="ghost" data-resume-record="${escape(r.id)}">回顧練習</button></article>`).join('')}` : '';
  document.querySelectorAll('[data-resume-record]').forEach(b=>b.addEventListener('click',()=>showRecord(b.dataset.resumeRecord)));
  const gate = $('#provider-gate');
  gate.replaceChildren();
  const capture = $('#capture');
  if (!modelReady()) {
    const warning = document.createElement('div');
    warning.className = 'provider-warning';
    warning.innerHTML = '<strong>產生題目前需要完成 Codex 登入與驗證。</strong><p>先到設定確認狀態，避免貼完內容後才發現無法送出。</p>';
    button('前往設定', () => navigate('settings'), warning, {kind:'secondary'});
    gate.append(warning);
    capture.disabled = true;
  } else capture.disabled = captureBusy;
  if (captureBusy) capture.textContent = '正在保存職缺並產生題目…';
  else capture.textContent = '儲存職缺並產生題目';
  const outbound = providerInfo?.languageModel?.external;
  $('#generation-disclosure').textContent = outbound ? `將把職缺與勾選的履歷內容傳送給 ${providerInfo.languageModel.name} 產生題目。職缺原文仍保存在本機工作區。` : '目前使用本機示範服務，不會把職缺內容傳送到外部。';
}

$('#capture').addEventListener('click', async event => {
  const control = event.currentTarget;
  setError();
  if (captureBusy) { setError('這份職缺仍在處理中，請等待或取消後再試。'); return; }
  const text = $('#jd').value;
  if (!text.trim()) { setError('請先貼上職缺描述。'); $('#jd').focus(); return; }
  if (!modelReady()) { await navigate('settings'); return; }
  const originToken = viewToken;
  captureBusy = true;
  control.disabled = true;
  control.textContent = '正在保存職缺…';
  let snapshot;
  try {
    snapshot = await api('/snapshots', {text,useResume:$('#use-resume')?.checked ?? false,difficulty:$('#difficulty').value});
    await refreshWorkspace();
    control.textContent = '正在產生練習題…';
    await api(`/snapshots/${snapshot.id}/analysis`, {});
    await refreshWorkspace();
    $('#jd').value = '';
    if (currentView === 'home' && viewToken === originToken) await showRecommended(snapshot.id);
    else setNotice('練習題已產生，可從練習紀錄開啟。');
  } catch (error) {
    setError(error.message);
    if (snapshot && currentView === 'home' && viewToken === originToken) await showAnalysisFailure(snapshot.id, error);
    else if (snapshot) setNotice('職缺已保存，但題目尚未產生；可從練習紀錄重試。');
  } finally {
    captureBusy = false;
    control.disabled = !modelReady();
    control.textContent = '儲存職缺並產生題目';
  }
});

async function showAnalysisFailure(snapshotId, error) {
  clearDraftSession(); disposeVoice(); followUpVoice.dispose(); followUpVoice.dispose = () => {}; followUpVoice.draftId = null; resetReadAloud(); markView('practice'); currentSnapshotId = snapshotId;
  const snapshot = workspace.snapshots[snapshotId] || await api(`/snapshots/${snapshotId}`);
  $('#practice').innerHTML = practiceFrame({snapshot, content:`<div class="provider-warning"><h2>職缺已保存，題目尚未產生</h2><p>${escape(error.message)}</p><p>你不需要重新貼上職缺。可以直接重試這一步。</p><div id="analysis-retry"></div></div>`});
  button('重試產生題目', async () => {
    await api(`/snapshots/${snapshotId}/analysis`, {});
    await refreshWorkspace();
    await showRecommended(snapshotId);
  }, $('#analysis-retry'));
  button('回到首頁', () => navigate('home'), $('#analysis-retry'), {kind:'ghost'});
}

async function analysisView(snapshotId) {
  try { return await api(`/snapshots/${snapshotId}/analysis`); }
  catch (error) { if (error.status === 409) return null; throw error; }
}
async function showRecommended(snapshotId) {
  if (!(await leaveEditor())) return;
  clearDraftSession(); disposeVoice(); followUpVoice.dispose(); followUpVoice.dispose = () => {}; followUpVoice.draftId = null; resetReadAloud(); markView('practice'); currentSnapshotId = snapshotId;
  const analysis = await analysisView(snapshotId);
  if (!analysis) return showAnalysisFailure(snapshotId, new Error('這份職缺還沒有題目。'));
  return showQuestion(snapshotId, analysis.recommendation.questionId, analysis);
}

function incompleteForQuestion(snapshotId, questionId) {
  return sortRecent(Object.values(workspace.records || {}).filter(record => record.snapshotId === snapshotId && record.question.id === questionId && record.status !== 'completed'))[0];
}
async function showQuestion(snapshotId, questionId, suppliedAnalysis) {
  if (!(await leaveEditor())) return;
  clearDraftSession(); disposeVoice(); followUpVoice.dispose(); followUpVoice.dispose = () => {}; followUpVoice.draftId = null; resetReadAloud(); markView('practice'); currentSnapshotId = snapshotId; currentRecordId = null;
  const snapshot = workspace.snapshots[snapshotId] || await api(`/snapshots/${snapshotId}`);
  const analysis = suppliedAnalysis || await analysisView(snapshotId);
  if (!analysis) return showAnalysisFailure(snapshotId, new Error('這份職缺還沒有題目。'));
  const question = analysis.questions.find(item => item.id === questionId) || analysis.questions[0];
  const recommended = question.id === analysis.recommendation.questionId;
  const meaning = question.meaningZh || '這是舊版題目，目前沒有保存中文題意；英文原題完整保留。';
  const previous = incompleteForQuestion(snapshotId, question.id);
  const providerGate = modelReady() ? '' : `<div class="provider-warning"><strong>目前還不能取得模型回饋。</strong><p>請先到設定完成 Codex 登入與驗證；若要先整理想法，文字草稿仍會保存在本機。</p><div id="question-provider-gate"></div></div>`;
  const content = `<div id="recommended-question" class="question-phase"><div class="q-head"><span class="chip${recommended ? ' chip-accent' : ''}">${recommended ? '建議先練' : '目前選擇'}｜${escape(categories[question.category] || question.category)}</span></div><h1 class="question-text" lang="en">${escape(question.text)}</h1><div id="question-read-aloud"></div><details open><summary>查看中文題意</summary><div class="detail-panel"><p>${escape(meaning)}</p></div></details>${providerGate}<div class="button-row" id="question-actions"></div></div>`;
  $('#practice').innerHTML = practiceFrame({snapshot, content});
  readAloud($('#question-read-aloud'), {snapshotId, questionId:question.id}, '朗讀題目', questionText($('#recommended-question')));
  const actions = $('#question-actions');
  const begin = async () => {
    const existing = incompleteForQuestion(snapshotId, question.id);
    const record = existing || await api('/records', {snapshotId, questionId:question.id});
    await refreshWorkspace();
    await showRecord(record.id);
  };
  if (!modelReady()) {
    button('前往設定完成登入', () => navigate('settings'), $('#question-provider-gate'));
    button(previous ? '繼續本機草稿' : '先寫本機草稿', begin, actions, {kind:'secondary'});
  } else button(previous ? '繼續回答' : '開始回答', begin, actions);
  const index = analysis.questions.findIndex(item => item.id === question.id);
  button('換一題', () => showQuestion(snapshotId, analysis.questions[(index + 1) % analysis.questions.length].id, analysis), actions, {kind:'secondary', id:'next-question'});
  button(`查看全部（${analysis.questions.length}）`, () => showQuestionList(snapshotId, analysis), actions, {kind:'ghost', id:'view-all-questions'});
}

async function showQuestionList(snapshotId, suppliedAnalysis) {
  if (!(await leaveEditor())) return;
  clearDraftSession(); disposeVoice(); followUpVoice.dispose(); followUpVoice.dispose = () => {}; followUpVoice.draftId = null; resetReadAloud(); markView('practice'); currentSnapshotId = snapshotId;
  const snapshot = workspace.snapshots[snapshotId];
  const analysis = suppliedAnalysis || await analysisView(snapshotId);
  // One row per question: a state glyph (answered ✓ / draft / not yet) that repeats
  // the row's own text, so the state never depends on colour alone.
  let practisedTotal = 0;
  const groups = Object.entries(categories).map(([category,label]) => {
    const questions = analysis.questions.filter(question => question.category === category);
    let practised = 0;
    const rows = questions.map(question => {
      const records = (analysis.history?.[question.id] || []).map(item => workspace.records?.[item.recordId]).filter(Boolean);
      const answered = records.filter(record => record.attempts?.length > 0).length;
      const hasDraft = records.some(record => record.attempts?.length === 0 && record.writtenDraft);
      if (answered) practised += 1;
      const progress = answered ? `已作答 ${answered} 次${hasDraft ? ' · 另有未送出草稿' : ''}` : hasDraft ? '有未送出草稿' : '尚未作答';
      const state = answered ? 'answered' : hasDraft ? 'draft' : 'new';
      const recommended = question.id === analysis.recommendation.questionId;
      return `<article class="question-card q-${state}${answered || hasDraft ? ' practised' : ''}${recommended ? ' recommended' : ''}" data-question-id="${escape(question.id)}"><span class="q-state" aria-hidden="true">${state === 'answered' ? checkIcon : ''}</span><div class="q-main"><p class="english" lang="en">${escape(question.text)}</p><p class="meta"><span>${progress}</span>${recommended ? '<span class="chip chip-accent">本次推薦</span>' : ''}</p></div><button type="button" class="secondary">選這一題</button></article>`;
    }).join('');
    practisedTotal += practised;
    return `<section class="category-group" aria-labelledby="group-${category}"><header class="group-head"><h2 id="group-${category}">${escape(label)}</h2><span class="meta">${questions.length} 題 · 已作答 ${practised} 題</span></header>${rows || '<p class="meta group-empty">這一類目前沒有題目。</p>'}</section>`;
  }).join('');
  const content = `<p class="eyebrow">完整題組</p><h1>選一題來練習</h1><p>題目依類型整理；切換題目不會重新呼叫模型。</p><p class="meta list-summary">共 ${analysis.questions.length} 題 · 已作答 ${practisedTotal} 題</p><div class="button-row" id="question-list-actions"></div><div id="question-list" class="question-list">${groups}</div>`;
  $('#practice').innerHTML = practiceFrame({snapshot, content});
  button('回到推薦題', () => showRecommended(snapshotId), $('#question-list-actions'), {kind:'ghost'});
  if (analysis.questions.length < 40) button('另外新增四題', async () => {
    await api(`/snapshots/${snapshotId}/questions`, {});
    await refreshWorkspace();
    await showQuestionList(snapshotId);
  }, $('#question-list-actions'), {kind:'ghost'});
  document.querySelectorAll('[data-question-id] button').forEach(control => control.addEventListener('click', () => showQuestion(snapshotId, control.closest('[data-question-id]').dataset.questionId, analysis)));
}

// Annotated feedback (issue 0024). The learner's answer is rendered once, as
// numbered sentences, and every feedback item is a note that points into it: the
// strength (優, solid underline), the priority improvement (改, wavy), each rating's
// evidence (切／據／構／英, dotted) and each Key-Sentence Correction (±, shown as an
// inline diff under its sentence). Quotes are the server-validated exact excerpts
// (ADR 0006/0016), located again with public/annotate.js; one that cannot be found
// keeps its note, shows the quote as plain text and logs a warning.
// Issue 0025's home preview should render through these same helpers.
const dimensionTags = {relevance:'切', support:'據', structure:'構', englishExpression:'英'};
const levelLabels = {1:'尚未做到', 2:'部分做到', 3:'大致做到', 4:'充分做到'};
const annotations = new Map();
const annotationKey = value => String(value || 'answer').replace(/[^\w-]/g, '_');
const noteDomId = id => `note-${id}`;
// Registers one answer (its transcript, feedback and any loaded corrections) so its
// transcript and its notes can be rendered in different panes and still link.
// `extraNotes` are notes that quote this answer from elsewhere (a Session Summary
// finding quoting one session answer), marked and linked like the answer's own.
function registerAnnotation(key, {transcript, feedback, corrections, recordId, attemptId, extraNotes} = {}) {
  annotations.set(key, {transcript: String(transcript || ''), feedback, corrections: corrections || null, recordId, attemptId, extraNotes: extraNotes || []});
  return key;
}
function registerAttempt(record, attempt) {
  if (!attempt) return null;
  return registerAnnotation(annotationKey(attempt.id), {transcript: attempt.transcript, feedback: attempt.feedback, corrections: record?.corrections?.[attempt.id]?.corrections, recordId: record?.id, attemptId: attempt.id});
}
function annotationNotes(key, feedback = annotations.get(key)?.feedback, corrections = annotations.get(key)?.corrections) {
  const notes = [];
  if (feedback?.strength) notes.push({id:`${key}-strength`, kind:'ok', tag:'優', title:'本次做得好的地方', quote:feedback.strength.quote});
  if (feedback?.priorityImprovement) notes.push({id:`${key}-priority`, kind:'warn', tag:'改', title:'這次優先改進', quote:feedback.priorityImprovement.quote});
  for (const [dimension, rating] of Object.entries(feedback?.ratings || {})) notes.push({id:`${key}-${dimension}`, kind:'rate', tag:dimensionTags[dimension] || '評', title:dimensions[dimension] || dimension, quote:rating.quote});
  (corrections || []).forEach((item, index) => notes.push({id:`${key}-fix${index}`, kind:'fix', tag:'±', title:`關鍵句修正 ${index + 1}`, quote:item.original, correction:item, index}));
  notes.push(...(annotations.get(key)?.extraNotes || []));
  return notes;
}
const warnedQuotes = new Set();
function annotationModel(key) {
  const entry = annotations.get(key);
  const notes = annotationNotes(key);
  const model = annotateTranscript(entry?.transcript || '', notes);
  for (const id of model.missing) {
    if (warnedQuotes.has(id)) continue;
    warnedQuotes.add(id);
    console.warn(`Feedback quote ${id} was not found verbatim in the transcript; showing it without a transcript link.`);
  }
  return {...model, notes, byId: new Map(notes.map(note => [note.id, note]))};
}
const tagHtml = note => `<span class="tag tag-${note.kind}" data-tag="${escape(note.tag)}" aria-hidden="true"></span>`;
// The tags drawn at one spot in the transcript. More than three at the same spot
// (every rating quoting the same sentence, plus a Session Summary finding) would
// push the line apart, so they collapse to the first two and a "+N" chip; the
// group's accessible name and tooltip then list every note it stands for.
function tagGroupHtml(notes) {
  const ids = notes.map(note => note.id).join(' ');
  const {shown, more} = collapseTags(notes);
  if (!more) return `<span class="tags" data-tags="${escape(ids)}">${shown.map(tagHtml).join('')}</span>`;
  const label = `${notes.length} 則回饋：${notes.map(note => `${note.tag} ${note.title}`).join('、')}`;
  return `<span class="tags tags-many" data-tags="${escape(ids)}" role="img" aria-label="${escape(label)}" title="${escape(label)}">${shown.map(tagHtml).join('')}<span class="tag tag-more" data-tag="+${more}" aria-hidden="true"></span></span>`;
}
function diffRunsHtml(runs, {announce = false} = {}) {
  const hidden = text => announce ? `<span class="visually-hidden">${text}</span>` : '';
  return runs.map(run => run.op === '=' ? escape(run.text)
    : run.op === '-' ? `<del>${hidden('［刪除］')}${escape(run.text)}</del>`
    : run.op === '+' ? `<ins>${hidden('［加入］')}${escape(run.text)}</ins>`
    : '<span class="elide" aria-hidden="true">…</span>').join('');
}
// A Key-Sentence Correction as the learner's sentence with the rewrite's word
// changes marked inline (strikethrough + colour for removed words, underline +
// colour for added ones). Screen readers get the rewrite as one sentence instead.
function correctionDiffHtml(note, entry, n) {
  const {original, rewrite, reasonZh} = note.correction;
  const runs = wordDiff(original, rewrite);
  const changed = runs.some(run => run.op !== '=');
  const slot = entry?.recordId && entry?.attemptId ? `<div class="correction-read-aloud" data-correction-slot data-record-id="${escape(entry.recordId)}" data-attempt-id="${escape(entry.attemptId)}" data-correction-index="${note.index}"></div>` : '';
  return `<div class="diff" role="group" aria-label="${n ? `第 ${n} 句的` : ''}${escape(note.title)}" data-fix="${escape(note.id)}">
    <div class="diff-head">${tagHtml(note)}<span>${escape(note.title)}</span><span class="meta">${changed ? '刪除線：建議拿掉　底線：建議加入' : '建議表達與原句相同'}</span></div>
    ${changed ? `<p class="diff-body" lang="en" aria-hidden="true">${diffRunsHtml(runs)}</p><p class="visually-hidden" lang="en">建議的英文表達：${escape(rewrite)}</p>` : ''}
    ${slot}<p class="diff-why" id="${noteDomId(note.id)}-d">${escape(reasonZh)}</p>
  </div>`;
}
// The learner's answer, once, as numbered sentences with every feedback quote
// marked. Overlapping quotes are split into segments; a segment carries every id
// whose quote covers it, the union of their line styles, and each quote's tag on
// its last segment. Tags, sentence numbers and diffs are drawn so that the
// transcript's own text (copy, textContent) stays exactly what the learner said.
function annotatedTranscriptHtml(key, {tag = 'div', corrections = true, legend = false} = {}) {
  const entry = annotations.get(key);
  const model = annotationModel(key);
  const fixes = new Map();
  if (corrections) for (const note of model.notes) {
    const n = note.kind === 'fix' && model.endSentenceOf[note.id];
    if (n) fixes.set(n, [...(fixes.get(n) || []), note]);
  }
  const rows = model.sentences.map(row => {
    const kinds = new Set();
    const shown = id => corrections || model.byId.get(id).kind !== 'fix';
    const pieces = row.segments.map(segment => {
      const ids = segment.ids.filter(shown);
      // A segment's tags belong to the quotes whose tag position is its end: usually
      // quotes ending here, or quotes that stopped earlier inside this word.
      const tagNotes = segment.ends.filter(shown).map(id => model.byId.get(id));
      // The last word and its tags never break apart (.mk-end); a very long "word"
      // (a URL) is left free to wrap so it cannot overflow a phone-width line.
      const [, head, last] = segment.text.match(/^([\s\S]*?)(\S{0,24})$/);
      const body = tagNotes.length ? `${escape(head)}<span class="mk-end">${escape(last)}${tagGroupHtml(tagNotes)}</span>` : escape(segment.text);
      // A whitespace-only segment (the gap between two sentences) is never a mark;
      // nor is the rest of a word after a quote that stopped inside it.
      if (!ids.length || !segment.text.trim()) return body;
      const notes = ids.map(id => model.byId.get(id));
      const segmentKinds = [...new Set(notes.map(note => note.kind))];
      segmentKinds.forEach(kind => kinds.add(kind));
      const titles = [...new Set(notes.map(note => note.title))].join('、');
      return `<mark class="mk ${segmentKinds.map(kind => `mk-${kind}`).join(' ')}" data-notes="${ids.join(' ')}" tabindex="0" role="button" aria-describedby="${ids.map(id => `${noteDomId(id)}-d`).join(' ')}" title="回饋：${escape(titles)}（按 Enter 查看）">${body}</mark>`;
    });
    // Punctuation split off after a tag (`glue`, see annotate.js) is kept on the tag's
    // line: the pair sits in a no-wrap .mk-run while the mark inside wraps normally.
    let html = '';
    row.segments.forEach((segment, index) => {
      if (segment.glue) return;
      let run = pieces[index], glued = false;
      for (let next = index + 1; row.segments[next]?.glue; next++) { run += pieces[next]; glued = true; }
      html += glued ? `<span class="mk-run">${run}</span>` : run;
    });
    const rowFixes = fixes.get(row.n) || [];
    const kind = rowFixes.length ? 'fix' : ['warn', 'ok', 'rate'].find(value => kinds.has(value));
    return `<div class="srow${kind ? ` has-${kind}` : ''}" data-s="${row.n}"><span class="gut" data-n="${row.n}" aria-hidden="true"></span><div class="stext">${html}</div>${rowFixes.map(note => correctionDiffHtml(note, entry, row.n)).join('')}</div>`;
  }).join('');
  const hasMarks = model.notes.some(note => !model.missing.includes(note.id) && (corrections || note.kind !== 'fix'));
  const legendHtml = legend && hasMarks ? `<div class="mk-legend" aria-label="標記說明"><span><span class="tag tag-ok" data-tag="優" aria-hidden="true"></span>做得好・實線</span><span><span class="tag tag-warn" data-tag="改" aria-hidden="true"></span>優先改進・波浪線</span><span><span class="tag tag-rate" data-tag="切據構英" aria-hidden="true"></span>評分依據・點線</span>${corrections && model.notes.some(note => note.kind === 'fix') ? '<span><span class="tag tag-fix" data-tag="±" aria-hidden="true"></span>關鍵句修正</span>' : ''}</div>` : '';
  return `${legendHtml}<${tag} class="transcript annotated" lang="en" data-annotation="${escape(key)}">${rows}</${tag}>`;
}
// The "↳ 第 N 句" control that moves to (and highlights) a note's quote; its tooltip
// carries the exact quote. Without a located quote the note shows it as plain text.
function noteRefHtml(note, model) {
  const n = model?.sentenceOf[note.id];
  if (!n) return '';
  return `<button type="button" class="ref" data-jump="${escape(note.id)}" aria-label="在你的回答中標出第 ${n} 句" title="${escape(note.quote)}"><span aria-hidden="true">↳</span> 第 ${n} 句</button>`;
}
const unlinkedQuoteHtml = (note, model) => (!model || model.missing.includes(note.id)) && note.quote ? `<p class="note-quote" lang="en">${escape(note.quote)}</p>` : '';
// A reference to one feedback quote from elsewhere (the revision prompt, the
// focus-progress box): the jump control, or the quote itself if it is not linked.
function quoteRefHtml(key, suffix) {
  if (!annotations.has(key)) return '';
  const model = annotationModel(key);
  const note = model.byId.get(`${key}-${suffix}`);
  return note ? noteRefHtml(note, model) || unlinkedQuoteHtml(note, model) : '';
}
let unlinkedFeedback = 0;
function feedbackHtml(feedback, key) {
  if (!feedback) return '<p class="provider-warning">回饋尚未完成。你的回答已保存，可以重試取得回饋。</p>';
  const bilingual = feedback.strength?.textZh && feedback.priorityImprovement?.textZh && Object.values(feedback.ratings || {}).every(rating => rating.reasonZh);
  const model = key && annotations.has(key) ? annotationModel(key) : null;
  const base = model ? key : `unlinked${++unlinkedFeedback}`;
  const notes = model?.notes || annotationNotes(base, feedback, null);
  const byId = new Map(notes.map(note => [note.id, note]));
  const idFor = suffix => `${base}-${suffix}`;
  const finding = (suffix, item) => {
    const note = byId.get(idFor(suffix));
    return `<article class="note note-${note.kind}" id="${noteDomId(note.id)}" data-note-id="${escape(note.id)}" tabindex="-1">
      <header>${tagHtml(note)}<h3>${escape(note.title)}</h3>${noteRefHtml(note, model)}</header>
      <p id="${noteDomId(note.id)}-d"><span class="visually-hidden">${escape(note.title)}：</span>${escape(item.textZh || '此筆舊紀錄沒有中文說明。')}</p>${unlinkedQuoteHtml(note, model)}
    </article>`;
  };
  const ratings = Object.entries(feedback.ratings || {}).map(([dimension, rating]) => {
    const note = byId.get(idFor(dimension));
    const level = Number(rating.level) || 0;
    return `<details class="rating rate" id="${noteDomId(note.id)}" data-note-id="${escape(note.id)}">
      <summary><span class="rate-name">${tagHtml(note)}<span>${escape(note.title)}</span><small>${escape(levelLabels[level] || '')}</small></span><span class="bar" role="img" aria-label="${level} / 4${levelLabels[level] ? `，${levelLabels[level]}` : ''}">${[1, 2, 3, 4].map(step => `<i class="${step <= level ? 'on' : ''}"></i>`).join('')}</span><span class="rate-num" aria-hidden="true">${escape(rating.level)}<span>/4</span></span><span class="chev" aria-hidden="true"></span></summary>
      <div class="rate-body"><p id="${noteDomId(note.id)}-d"><span class="visually-hidden">${escape(note.title)} ${level} / 4：</span>${escape(rating.reasonZh || '此筆舊紀錄沒有中文評分理由。')}</p>${noteRefHtml(note, model)}</div>${unlinkedQuoteHtml(note, model)}
    </details>`;
  }).join('');
  return `${bilingual ? '' : '<p class="legacy-note">此為舊版紀錄，部分中文說明尚未提供；原始資料保留，未自動重新評估。</p>'}<div class="fb-sec"><p class="fb-label">重點</p>${feedback.strength ? finding('strength', feedback.strength) : ''}${feedback.priorityImprovement ? finding('priority', feedback.priorityImprovement) : ''}</div><div class="fb-sec ratings"><p class="fb-label">四項評分 <span class="meta">點開看理由</span></p><div class="rates">${ratings}</div></div>`;
}
// Key-Sentence Corrections in the feedback pane: one note per correction pointing
// at its sentence, where the inline diff is shown. A correction whose sentence
// cannot be located shows its diff here instead.
function correctionsHtml(result, key) {
  const corrections = result?.corrections || [];
  if (!corrections.length) return '<p class="corrections-none meta">這次沒有需要調整的關鍵句，你的英文已經能清楚表達。</p>';
  const model = key && annotations.has(key) ? annotationModel(key) : null;
  const entry = annotations.get(key);
  const cards = corrections.map((item, index) => {
    const note = model?.byId.get(`${key}-fix${index}`) || {id:`${key || 'unlinked'}-fix${index}`, kind:'fix', tag:'±', title:`關鍵句修正 ${index + 1}`, quote:item.original, correction:item, index};
    const n = model?.endSentenceOf[note.id];
    return `<article class="correction-card note note-fix" id="${noteDomId(note.id)}" data-note-id="${escape(note.id)}" tabindex="-1">
      <header>${tagHtml(note)}<h3>${escape(note.title)}</h3>${noteRefHtml(note, model)}</header>
      ${n ? `<p class="meta">修正直接標在你的回答第 ${n} 句下方，附上理由與朗讀。</p>` : correctionDiffHtml(note, entry, 0)}
    </article>`;
  }).join('');
  return `<p class="fb-label">關鍵句英文修正（${corrections.length}）</p><p class="meta">只列出必要的句子修正，保留你的原意、事實與語氣；這是修正建議，不會算作正式回答。</p>${cards}`;
}
// Mounts read-aloud on correction slots not yet mounted (the rewrite is resolved by
// reference on the server, never taken from the page).
function mountCorrectionSlots(root = document) {
  root.querySelectorAll('[data-correction-slot]:not([data-mounted])').forEach(slot => {
    slot.dataset.mounted = 'true';
    readAloud(slot, {recordId:slot.dataset.recordId, attemptId:slot.dataset.attemptId, correctionIndex:Number(slot.dataset.correctionIndex)}, '朗讀修正句');
  });
}
// Re-renders every copy of one answer's transcript (after its corrections load).
function refreshAnnotatedTranscripts(key) {
  document.querySelectorAll(`[data-annotation="${CSS.escape(key)}"]`).forEach(node => {
    const legend = node.previousElementSibling?.classList.contains('mk-legend') ? node.previousElementSibling : null;
    const holder = document.createElement('div');
    holder.innerHTML = annotatedTranscriptHtml(key, {tag: node.tagName.toLowerCase(), legend: Boolean(legend)});
    legend?.remove();
    node.replaceWith(...holder.childNodes);
  });
  mountCorrectionSlots();
}
function showCorrections(container, result, key) {
  const entry = annotations.get(key);
  const fresh = entry && entry.corrections !== (result?.corrections || null);
  if (entry) entry.corrections = result?.corrections || null;
  container.innerHTML = correctionsHtml(result, key);
  if (fresh) refreshAnnotatedTranscripts(key);
  mountCorrectionSlots();
  updateFeedbackBadge();
}
async function loadCorrections(recordId, attemptId, container) {
  const token = viewToken;
  container.innerHTML = '<p class="meta">正在整理關鍵句修正…</p>';
  try {
    const result = await api(`/records/${recordId}/corrections`, {attemptId});
    if (viewToken !== token || !container.isConnected) return;
    if (workspace.records?.[recordId]) { workspace.records[recordId].corrections ??= {}; workspace.records[recordId].corrections[attemptId] = result; }
    showCorrections(container, result, annotationKey(attemptId));
  } catch (error) {
    if (viewToken !== token || !container.isConnected) return;
    container.innerHTML = '';
    button('重試取得關鍵句修正', () => loadCorrections(recordId, attemptId, container), container, {kind:'ghost'});
    setError(error.message);
  }
}
function setupCorrections(record, attemptId, container, auto) {
  if (!container) return;
  const cached = record.corrections?.[attemptId];
  if (cached) { showCorrections(container, cached, annotationKey(attemptId)); return; }
  if (auto) { loadCorrections(record.id, attemptId, container); return; }
  container.replaceChildren();
  button('看關鍵句英文修正', () => loadCorrections(record.id, attemptId, container), container, {kind:'ghost'});
}

// Before/after comparison of two answers as one inline word diff, with long
// unchanged stretches shortened around the changes.
function changedTextHtml(before, after) {
  return `<p class="meta">刪除線是第一次回答有、這次拿掉的字；底線是這次新加入的字。</p><p class="diff-body compare-diff" lang="en">${diffRunsHtml(elideUnchanged(wordDiff(before, after), 8), {announce:true})}</p>`;
}

// Hovering or focusing a mark or a note highlights both; the state is recomputed
// from whatever is hovered and focused, so leaving one never clears the other.
const linkState = {hover:null, focus:null};
const linkIds = node => !node ? [] : node.dataset.notes ? node.dataset.notes.split(' ') : [node.dataset.noteId];
const linkTarget = node => node?.closest?.('mark[data-notes], [data-note-id]') || null;
function paintLinks() {
  document.querySelectorAll('mark.mk.is-active, .tags.is-active, [data-note-id].is-active').forEach(node => node.classList.remove('is-active'));
  const ids = new Set([linkState.hover, linkState.focus].flatMap(linkIds));
  if (!ids.size) return;
  document.querySelectorAll('mark[data-notes]').forEach(mark => { if (mark.dataset.notes.split(' ').some(id => ids.has(id))) mark.classList.add('is-active'); });
  document.querySelectorAll('.tags[data-tags]').forEach(tags => { if (tags.dataset.tags.split(' ').some(id => ids.has(id))) tags.classList.add('is-active'); });
  document.querySelectorAll('[data-note-id]').forEach(note => { if (ids.has(note.dataset.noteId)) note.classList.add('is-active'); });
}
function pulse(node) { node.classList.remove('pulse'); void node.offsetWidth; node.classList.add('pulse'); }
function openAncestors(node) { for (let parent = node.parentElement?.closest('details'); parent; parent = parent.parentElement?.closest('details')) parent.open = true; }
function jumpToNote(id) {
  const note = document.querySelector(`[data-note-id="${CSS.escape(id)}"]`);
  if (!note) return;
  if (note.closest('#practice .fb-scroll')) showTab('feedback');
  openAncestors(note);
  if (note.tagName === 'DETAILS') note.open = true;
  const target = note.tagName === 'DETAILS' ? note.querySelector('summary') : note;
  requestAnimationFrame(() => { target.focus({preventScroll:true}); note.scrollIntoView({block:'center', behavior:'smooth'}); pulse(note); });
}
function jumpToMark(id) {
  const mark = document.querySelector(`mark[data-notes~="${CSS.escape(id)}"]`);
  if (!mark) return;
  if (mark.closest('#practice .wb-answer')) showTab('answer');
  openAncestors(mark);
  requestAnimationFrame(() => { mark.focus({preventScroll:true}); mark.scrollIntoView({block:'center', behavior:'smooth'}); pulse(mark); });
}
document.addEventListener('pointerover', event => { const node = linkTarget(event.target); if (node !== linkState.hover) { linkState.hover = node; paintLinks(); } });
document.addEventListener('focusin', event => { linkState.focus = linkTarget(event.target); paintLinks(); });
document.addEventListener('focusout', event => { if (!event.relatedTarget) { linkState.focus = null; paintLinks(); } });
document.addEventListener('click', event => {
  const jump = event.target.closest?.('[data-jump]');
  if (jump) { event.preventDefault(); jumpToMark(jump.dataset.jump); return; }
  const mark = event.target.closest?.('mark[data-notes]');
  if (mark) jumpToNote(mark.dataset.notes.split(' ')[0]);
});
document.addEventListener('keydown', event => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches?.('mark[data-notes]')) { event.preventDefault(); jumpToNote(event.target.dataset.notes.split(' ')[0]); }
});
// The 回饋 tab's badge counts the notes shown for the current answer(s): strength,
// priority improvement, the four ratings and each loaded Key-Sentence Correction,
// for the main answer and the current follow-up answer. Notes inside the collapsed
// answer/follow-up history are not counted.
function updateFeedbackBadge() {
  const tab = $('#tab-feedback');
  if (!tab) return;
  const count = [...document.querySelectorAll('#wb-feedback [data-note-id]')].filter(note => !note.closest('#attempt-history, .follow-up-history')).length;
  let badge = tab.querySelector('.count');
  if (!count) { badge?.remove(); tab.removeAttribute('aria-label'); return; }
  if (!badge) { badge = document.createElement('span'); badge.className = 'count'; tab.append(' ', badge); }
  badge.textContent = String(count);
  tab.setAttribute('aria-label', `回饋（${count} 則）`);
}

function guidanceHtml() {
  return `<details class="answer-help">
    <summary>不知道怎麼回答？</summary>
    <div class="answer-help-body">
      <p class="meta">先拿一個提示、用沒有相關經驗的框架回答、看一個假設的示範回答，或把自己的中文想法整理成英文。這些都只是輔助，不會算作正式回答。</p>
      <div class="button-row" id="hint-actions"></div>
      <div id="hint-result" aria-live="polite"></div>
      <div class="ideas-panel">
        <label for="ideas">中文或中英混合的想法</label>
        <textarea id="ideas" rows="4" placeholder="只整理你真的想表達的內容，不需要先寫成完整英文。"></textarea>
        <div id="ideas-actions"></div>
        <div id="ideas-result" aria-live="polite"></div>
      </div>
    </div>
  </details>`;
}

async function showCoaching(record, mode, parent, transcript) {
  const token=viewToken;
  parent.textContent='正在整理適合這一題的建議…';
  try {
    const result=await api(`/records/${record.id}/coaching`, {mode,...(transcript !== undefined ? {transcript} : {})});
    if (viewToken!==token || !parent.isConnected) return;
    const english=['rewrite','ideas','illustrative'].includes(mode);
    const eyebrow=mode==='rewrite'?'英文示範':mode==='ideas'?'想法整理成英文':mode==='gap'?'無相關經驗的回答框架':mode==='illustrative'?'示範回答（假設）':'回答提示';
    parent.innerHTML=`<section class="detail-panel coaching-result"><p class="eyebrow">${eyebrow}</p>${['rewrite','ideas'].includes(mode)?`<details><summary>查看這次整理的原文</summary><blockquote>${escape(transcript ?? record.attempts.at(-1)?.transcript)}</blockquote></details>`:''}${mode==='illustrative'?'<p class="coaching-caveat" role="note">這是假設示範，請替換成你自己的經驗，不要當成你的真實經歷。</p>':''}<p class="coaching-text" lang="${english?'en':'zh-Hant'}">${escape(result.text)}</p>${mode==='illustrative'?'<div id="illustrative-read-aloud"></div>':''}${english?`<p class="meta">${escape(result.explanationZh)}</p>`:''}</section>`;
    if (mode==='illustrative') readAloud($('#illustrative-read-aloud'), {recordId:record.id, coachingId:result.id}, '朗讀示範回答');
  } catch(error) {if(parent.isConnected)parent.textContent='尚未取得建議，可再次按下按鈕重試。';throw error;}
}

// The transcript goes into the normal answer box so it can be submitted in one
// click. Existing typing is never silently overwritten: the learner picks.
async function applyTranscript(session, voiceDraft, {mode = 'replace'} = {}) {
  if (draftSession !== session) return;
  const existing = session.textarea.value;
  session.textarea.value = mode === 'append' && existing.trim() ? `${existing.replace(/\s+$/, '')}\n${voiceDraft.transcript}` : voiceDraft.transcript;
  session.transcriptDraftId = voiceDraft.id;
  session.dirty = true;
  $('#voice-choice')?.remove();
  // Set the status before saving. saveDraft owns the status from here on, so a
  // keystroke landing during the save is not overwritten by a stale "saved" message.
  session.status.textContent = mode === 'append' ? '語音轉錄已接在原本的文字後面，正在存成本機草稿…' : '語音轉錄已放進回答框，可以直接送出或先修改；正在存成本機草稿…';
  const submit = $('#submit-answer');
  if (submit && modelReady()) submit.disabled = false;
  session.textarea.focus({preventScroll:true});
  await saveDraft(session, true).catch(() => {});
}

function renderVoiceChoice(session, voiceDraft) {
  if (draftSession !== session) return;
  $('#voice-choice')?.remove();
  const existing = session.textarea.value;
  if (!existing.trim()) { applyTranscript(session, voiceDraft); return; }
  // Reopening a record whose draft already contains this transcript: nothing to offer.
  if (existing.includes(voiceDraft.transcript)) { session.transcriptDraftId = voiceDraft.id; return; }
  // Text is already there, so nothing is applied until the learner chooses. The choice
  // is an offer, not a gate: submitting the text as it stands stays available.
  const submit = $('#submit-answer');
  const choice = document.createElement('div');
  choice.id = 'voice-choice';
  choice.className = 'provider-warning';
  choice.innerHTML = `<strong>語音已轉成文字</strong><p lang="en">${escape(voiceDraft.transcript)}</p><p>回答框裡已經有文字。要取代它、接在後面，還是保留原本的文字？在你決定前，回答框裡的內容仍然可以直接送出。</p><div class="button-row"></div>`;
  const keep = async () => {
    if (draftSession !== session) return;
    if (session.dirty || session.textarea.value !== session.savedValue) await saveDraft(session, true);
    session.transcriptDraftId = null;
    session.status.textContent = '保留原本的文字草稿；已儲存在本機。';
    choice.remove();
    if (submit && modelReady()) submit.disabled = false;
    session.textarea.focus({preventScroll:true});
  };
  button('取代目前文字', () => applyTranscript(session, voiceDraft, {mode:'replace'}), choice.querySelector('.button-row'), {kind:'secondary'});
  button('接在後面', () => applyTranscript(session, voiceDraft, {mode:'append'}), choice.querySelector('.button-row'), {kind:'secondary'});
  button('保留原本的文字', keep, choice.querySelector('.button-row'), {kind:'ghost'});
  $('#voice-entry').append(choice);
}

function installEditor(record, context) {
  const attemptIndex = record.attempts.length;
  const textarea = $('#answer');
  const status = $('#draft-status');
  const savedDraft = record.writtenDraft?.attemptIndex === attemptIndex ? record.writtenDraft : null;
  const voiceDraft = record.transcriptDraft;
  const ideas = $('#ideas');
  if(ideas) ideas.value = savedDraft?.ideasText || '';
  const fallback = attemptIndex === 1 ? record.attempts[0].transcript : '';
  textarea.value = savedDraft?.transcript ?? fallback;
  const session = {
    recordId:record.id,
    attemptIndex,
    textarea,
    ideas,
    savedIdeas:savedDraft?.ideasText || '',
    status,
    savedValue:savedDraft?.transcript,
    dirty:false,
    queue:Promise.resolve(),
    timer:null,
    submissionId:crypto.randomUUID(),
    transcriptDraftId:null,
    frozen:false
  };
  draftSession = session;
  if (savedDraft) status.textContent = `已儲存草稿 · ${dateLabel(savedDraft.savedAt)}`;
  else if (voiceDraft) status.textContent = '語音已轉成文字；請先選擇要採用語音或保留文字。';
  else if (attemptIndex === 1) status.textContent = '已帶入第一次回答；開始修改後會另存為新草稿。';
  else status.textContent = '輸入後會自動保存在本機。';
  session.inputHandler = () => { if (!session.frozen) { session.dirty = true; scheduleDraftSave(session); } };
  textarea.addEventListener('input', session.inputHandler);
  ideas?.addEventListener('input',session.inputHandler);
  $('#retry-draft')?.addEventListener('click', async () => {
    setError();
    try { await saveDraft(session, true); }
    catch (error) { setError(error.message); }
  });
  $('#submit-answer').addEventListener('click', () => submitAnswer(record, session));
  {
    // Voice is offered with every speech provider; the demonstration one says in the
    // panel that it does not really transcribe, rather than hiding the whole feature.
    const host = $('#voice-entry');
    disposeVoice = mountVoice(host, {
      recordId:record.id,
      api,
      provider:providerInfo.speech,
      beforeTranscription:async () => {
        if (draftSession !== session) throw new Error('練習頁面已切換，未送出這段錄音。');
        session.frozen = true;
        textarea.readOnly = true;
        $('#submit-answer').disabled = true;
        await saveDraft(session, true);
      },
      onTranscript:draft => { if (draftSession === session) renderVoiceChoice(session, draft); },
      onTranscriptionEnd:() => {
        if (draftSession !== session) return;
        session.frozen = false;
        textarea.readOnly = false;
        if (modelReady()) $('#submit-answer').disabled = false;
      },
      onError:error => { if (draftSession === session) setError(localizeError(error.message, error.status || 400)); }
    });
  }
  if (voiceDraft) renderVoiceChoice(session, voiceDraft);
  if (!modelReady()) $('#submit-answer').disabled = true;
  requestAnimationFrame(() => textarea.focus({preventScroll:true}));
  return context;
}

async function submitAnswer(record, session) {
  const control = $('#submit-answer');
  const originToken = viewToken;
  setError();
  if (!modelReady()) { setError('請先到設定完成 Codex 登入與驗證；目前草稿仍保存在本機。'); return; }
  session.frozen = true;
  session.textarea.readOnly = true;
  if (session.timer) clearTimeout(session.timer);
  const transcript = session.textarea.value;
  if (!transcript.trim()) { session.frozen = false; session.textarea.readOnly = false; setError('請先寫下你的英文回答。'); session.textarea.focus(); return; }
  control.disabled = true;
  control.textContent = '正在保存回答…';
  try {
    if (!session.transcriptDraftId || session.dirty) await saveDraft(session, true);
    const input = {transcript, attemptIndex:session.attemptIndex, submissionId:session.submissionId, ...(session.transcriptDraftId ? {transcriptDraftId:session.transcriptDraftId} : {})};
    try { await api(`/records/${record.id}/attempts`, input); }
    catch (error) {
      const latest = await api(`/records/${record.id}`);
      if (!latest.attempts[session.attemptIndex] || latest.attempts[session.attemptIndex].transcript !== transcript) throw error;
    }
    if (draftSession === session) clearDraftSession();
    setNotice('回答已保存。正在取得回饋…');
    control.textContent = '正在取得回饋…';
    await api(`/records/${record.id}/feedback`, {});
    await refreshWorkspace();
    if (currentView === 'practice' && currentRecordId === record.id && viewToken === originToken) {setNotice();await showRecord(record.id, {focusFeedback:true});}
    else setNotice('背景回饋已完成，可從練習紀錄開啟查看。');
  } catch (error) {
    await refreshWorkspace().catch(() => {});
    const latest = workspace.records?.[record.id];
    if (latest?.attempts?.[session.attemptIndex]) {
      if (draftSession === session) clearDraftSession();
      if (currentView === 'practice' && currentRecordId === record.id && viewToken === originToken) {
        await showRecord(record.id);
        setError(`回答已保存，但回饋尚未完成：${error.message}`);
      } else setNotice('背景回饋尚未完成；回答已保存，可從練習紀錄重試。');
    } else {
      session.frozen = false;
      session.textarea.readOnly = false;
      if (control.isConnected) {
        control.disabled = false;
        control.textContent = session.attemptIndex ? '送出修改並取得回饋' : '送出並取得回饋';
        session.textarea.focus({preventScroll:true});
        setError(error.message);
      } else setNotice('送出未完成；本機草稿仍保留在原練習紀錄。');
    }
  }
}

async function requestFeedback(recordId) {
  const originToken = viewToken;
  setError();
  setNotice('回答已保存。正在重新取得回饋…');
  try {
    await api(`/records/${recordId}/feedback`, {});
    await refreshWorkspace();
    if (currentView === 'practice' && currentRecordId === recordId && viewToken === originToken) {setNotice();await showRecord(recordId, {focusFeedback:true});}
    else setNotice('背景回饋已完成，可從練習紀錄開啟查看。');
  } catch (error) {
    await refreshWorkspace().catch(() => {});
    if (currentView === 'practice' && currentRecordId === recordId && viewToken === originToken) {
      await showRecord(recordId);
      setError(`回答仍保存在本機；回饋尚未完成：${error.message}`);
    } else setNotice('背景回饋尚未完成；回答已保存，可從練習紀錄重試。');
  }
}

function followUpHistoryHtml(followUps, corrections = {}) {
  if (followUps.length < 2) return '';
  const previous = followUps[followUps.length - 2];
  const previousCorrections = previous.attempt && corrections[previous.attempt.id];
  const key = previous.attempt && annotationKey(previous.attempt.id);
  return `<details class="follow-up-history"><summary>查看第 ${followUps.length - 1} 次追問與回答</summary>
    <div class="detail-panel">
      <p lang="en"><strong>${escape(previous.question.text)}</strong></p>
      <p class="meaning">${escape(previous.question.meaningZh)}</p>
      ${previous.attempt ? annotatedTranscriptHtml(key, {tag:'blockquote'}) : '<blockquote>尚未作答</blockquote>'}
      ${previous.attempt ? playerHtml(previous.attempt, {label:`回聽第 ${followUps.length - 1} 次追問錄音`}) : ''}
      ${previous.attempt?.feedback ? feedbackHtml(previous.attempt.feedback, key) : ''}
      ${previousCorrections ? `<div class="corrections-area">${correctionsHtml(previousCorrections, key)}</div>` : ''}
    </div>
  </details>`;
}

// A follow-up is split across the workbench: its question and the learner's answer
// belong to the answer pane, its Chinese feedback to the feedback pane. The
// #follow-up-actions row goes wherever its actions act: under the answer box while
// answering, in the feedback pane while feedback is retried, and in the pane footer
// before the first follow-up and after a follow-up's feedback.
function followUpWorkHtml(record, complete) {
  const followUps = Array.isArray(record.followUps) ? record.followUps : [];
  const current = followUps.at(-1);
  if (!current) return '';
  const attempt = current.attempt;
  const feedback = attempt?.feedback;
  let content = '';
  if (!attempt && !complete) {
    content = `<label for="follow-up-answer">你的追問回答</label>
      <textarea id="follow-up-answer" class="transcript-input" rows="6" placeholder="只寫下你想在面試中正式說出的英文回答。">${escape(current.transcriptDraft?.transcript || '')}</textarea>
      <p id="follow-up-draft-status" class="draft-status" aria-live="polite">${current.transcriptDraft ? '已帶入這次的語音轉錄，可以直接送出，或先修改。' : '可以打字，也可以用語音回答。'}</p>
      <div id="follow-up-voice-entry"></div>
      <div id="follow-up-actions" class="button-row"></div>`;
  } else if (!attempt) {
    content = '<p class="meta">這題尚未作答；你已提前結束並保存這次練習。</p>';
  } else {
    content = `<p class="meta">${feedback ? '你的追問回答' : '你的回答已保存'}</p>${annotatedTranscriptHtml(annotationKey(attempt.id), {legend:true})}${playerHtml(attempt,{label:'回聽這次的追問錄音'})}`;
  }
  return `${followUpHistoryHtml(followUps, record.corrections)}<section class="follow-up-flow" aria-labelledby="follow-up-title">
    <div class="follow-up-heading"><p class="eyebrow">追問 ${followUps.length} / 2</p><span class="follow-up-state">${feedback ? '回饋已完成' : attempt ? '等待回饋' : '等待回答'}</span></div>
    <h2 id="follow-up-title" class="follow-up-question" lang="en">${escape(current.question.text)}</h2>
    <div id="follow-up-read-aloud"></div>
    <details open><summary>中文題意</summary><p class="meaning">${escape(current.question.meaningZh)}</p></details>
    ${content}
  </section>`;
}

function followUpFeedbackHtml(record, complete) {
  const followUps = Array.isArray(record.followUps) ? record.followUps : [];
  const current = followUps.at(-1);
  const attempt = current?.attempt;
  if (!attempt) return '';
  if (!attempt.feedback) return `<div class="provider-warning follow-up-pending"><p class="eyebrow">追問 ${followUps.length} / 2</p><p>追問回答已保存，中文回饋尚未完成。請重試取得回饋，再決定要繼續追問或結束；正式回答不會重複保存。</p>${complete ? '' : '<div id="follow-up-actions" class="button-row"></div>'}</div>`;
  return `<section class="follow-up-feedback" aria-labelledby="follow-up-feedback-title"><p class="eyebrow">追問 ${followUps.length} / 2</p><h3 id="follow-up-feedback-title" tabindex="-1">這次追問的中文回饋</h3>${feedbackHtml(attempt.feedback, annotationKey(attempt.id))}<div id="follow-up-corrections" class="corrections-area" aria-live="polite"></div></section>`;
}

async function createFromFocus(sourceId) {
  const originToken = viewToken;
  setNotice('正在用這個重點準備新的同職缺練習…');
  try {
    const record = await api('/records/from-focus', {recordId:sourceId});
    await refreshWorkspace();
    if (viewToken === originToken) { setNotice(); await showRecord(record.id); }
    else setNotice('已依這個重點建立新練習，可從練習紀錄開啟。');
  } catch (error) { setError(error.message); }
}

async function startFollowUp(recordId) {
  const originToken = viewToken;
  setNotice('正在準備下一題追問…');
  await api(`/records/${recordId}/follow-ups`, {});
  await refreshWorkspace();
  if (currentView === 'practice' && currentRecordId === recordId && viewToken === originToken) {
    setNotice();
    await showRecord(recordId);
  } else setNotice('追問題目已準備好，可從練習紀錄繼續。');
}

// The follow-up answer box has no autosaving draft session of its own; the transcript
// draft the server holds for the node is what survives a reload.
const followUpVoice = {draftId: null, dispose: () => {}};
function mountFollowUpVoice(record, followUp) {
  const host = $('#follow-up-voice-entry');
  const textarea = $('#follow-up-answer');
  if (!host || !textarea) return;
  followUpVoice.draftId = followUp.transcriptDraft?.id || null;
  const status = $('#follow-up-draft-status');
  followUpVoice.dispose = mountVoice(host, {
    path: `/records/${record.id}/follow-ups/${followUp.id}/transcription`,
    api,
    provider: providerInfo?.speech,
    beforeTranscription: async () => { textarea.readOnly = true; $('#submit-follow-up').disabled = true; },
    onTranscript: draft => {
      const existing = textarea.value;
      followUpVoice.draftId = draft.id;
      if (!existing.trim() || existing.includes(draft.transcript)) {
        textarea.value = existing.includes(draft.transcript) ? existing : draft.transcript;
        if (status) status.textContent = '語音轉錄已放進回答框，可以直接送出，或先修改。';
        return;
      }
      textarea.value = `${existing.replace(/\s+$/, '')}\n${draft.transcript}`;
      if (status) status.textContent = '語音轉錄已接在原本的文字後面。';
    },
    onTranscriptionEnd: () => { textarea.readOnly = false; if (modelReady()) $('#submit-follow-up').disabled = false; },
    onError: error => setError(localizeError(error.message, error.status || 400))
  });
}

async function submitFollowUp(record, followUp, submissionId) {
  const control = $('#submit-follow-up');
  const textarea = $('#follow-up-answer');
  const actionControls = [...control.parentElement.querySelectorAll('button')];
  const originToken = viewToken;
  const transcript = textarea.value;
  setError();
  if (!transcript.trim()) {
    setError('請先寫下你的英文回答。');
    textarea.focus();
    return;
  }
  textarea.readOnly = true;
  actionControls.forEach(item => { item.disabled = true; });
  control.textContent = '正在保存回答…';
  try {
    try {
      // The transcript draft id marks this as a spoken answer and promotes its recording.
      const draftId = followUpVoice.draftId;
      await api(`/records/${record.id}/follow-ups/${followUp.id}/attempt`, {transcript, submissionId, ...(draftId ? {transcriptDraftId: draftId} : {})});
    } catch (error) {
      const latest = await api(`/records/${record.id}`);
      const saved = (latest.followUps || []).find(item => item.id === followUp.id)?.attempt;
      if (!saved || saved.transcript !== transcript) throw error;
    }
    const stillCurrent = currentView === 'practice' && currentRecordId === record.id && viewToken === originToken;
    const pendingActions = stillCurrent ? $('#follow-up-actions') : null;
    if (pendingActions) {
      pendingActions.replaceChildren();
      const pending = document.createElement('p');
      pending.className = 'draft-status';
      pending.setAttribute('role','status');
      pending.textContent = '追問回答已保存，正在取得中文回饋…';
      pendingActions.append(pending);
    }
    const done = stillCurrent ? $('#complete-practice') : null;
    if (done) {
      // The footer's completion action waits for the follow-up's Chinese feedback.
      const lock = document.createElement('p');
      lock.className = 'completion-lock';
      lock.setAttribute('role','status');
      lock.textContent = '追問回答已保存；完成中文回饋後才能結束練習。';
      done.replaceWith(lock);
    }
    setNotice('追問回答已保存。正在取得中文回饋…');
    control.textContent = '正在取得中文回饋…';
    await api(`/records/${record.id}/follow-ups/${followUp.id}/feedback`, {});
    await refreshWorkspace();
    if (currentView === 'practice' && currentRecordId === record.id && viewToken === originToken) {
      setNotice();
      await showRecord(record.id, {followUpFresh:true});
      $('#follow-up-feedback-title')?.focus({preventScroll:true});
    } else setNotice('追問回饋已完成，可從練習紀錄開啟查看。');
  } catch (error) {
    await refreshWorkspace().catch(() => {});
    const saved = (workspace.records?.[record.id]?.followUps || []).find(item => item.id === followUp.id)?.attempt;
    if (saved) {
      if (currentView === 'practice' && currentRecordId === record.id && viewToken === originToken) {
        await showRecord(record.id);
        setError(`追問回答已保存，但中文回饋尚未完成：${error.message}`);
      } else setNotice('追問回答已保存；回饋可稍後從練習紀錄重試。');
    } else if (control.isConnected) {
      textarea.readOnly = false;
      actionControls.forEach(item => { if (item.isConnected) item.disabled = false; });
      control.textContent = '送出並取得中文回饋';
      textarea.focus({preventScroll:true});
      setError(error.message);
    }
  }
}

async function requestFollowUpFeedback(recordId, followUpId) {
  const originToken = viewToken;
  setNotice('追問回答已保存。正在重新取得中文回饋…');
  try {
    await api(`/records/${recordId}/follow-ups/${followUpId}/feedback`, {});
    await refreshWorkspace();
    if (currentView === 'practice' && currentRecordId === recordId && viewToken === originToken) {
      setNotice();
      await showRecord(recordId, {followUpFresh:true});
      $('#follow-up-feedback-title')?.focus({preventScroll:true});
    } else setNotice('追問回饋已完成，可從練習紀錄開啟查看。');
  } catch (error) {
    await refreshWorkspace().catch(() => {});
    if (currentView === 'practice' && currentRecordId === recordId && viewToken === originToken) {
      await showRecord(recordId);
      setError(`追問回答仍保存在本機；中文回饋尚未完成：${error.message}`);
    } else setNotice('追問回饋尚未完成；正式回答仍保存在本機。');
  }
}

// Practice workbench: ≥1024px the question and answer sit left and the feedback
// pane right, its footer holding the completion action; <1024px 你的回答／回饋 are
// tabs under the question and the footer is docked to the bottom of the viewport.
const narrowLayout = () => window.matchMedia('(max-width: 1023px)').matches;
function showTab(tab, {scroll = false} = {}) {
  const workbench = $('#practice .workbench');
  if (!workbench) return;
  workbench.dataset.tab = tab;
  workbench.querySelectorAll('[role="tab"]').forEach(control => {
    const selected = control.dataset.tab === tab;
    control.setAttribute('aria-selected', String(selected));
    control.tabIndex = selected ? 0 : -1;
  });
  // Switching after scrolling far down one tab starts the other tab at its top.
  const tabs = workbench.querySelector('.wb-tabs');
  if (scroll && narrowLayout() && tabs.getBoundingClientRect().top <= tabs.offsetHeight + $('.topbar').offsetHeight) {
    workbench.querySelector(tab === 'answer' ? '.wb-answer' : '.fb-scroll').scrollIntoView({block:'start'});
  }
}
function setupWorkbench() {
  const workbench = $('#practice .workbench');
  const tabs = [...workbench.querySelectorAll('[role="tab"]')];
  tabs.forEach((control, index) => {
    control.addEventListener('click', () => showTab(control.dataset.tab, {scroll:true}));
    control.addEventListener('keydown', event => {
      const offset = {ArrowRight:1, ArrowLeft:-1}[event.key];
      if (!offset) return;
      event.preventDefault();
      const next = tabs[(index + offset + tabs.length) % tabs.length];
      showTab(next.dataset.tab, {scroll:true});
      next.focus();
    });
  });
  showTab(workbench.dataset.tab);
  document.body.classList.add('workbench-mode');
  syncLayoutMetrics();
}
// Brings a feedback heading into view: the feedback tab on a phone, the feedback
// pane's own scroll on a desktop (so the question and answer stay where they are).
function revealFeedback(target) {
  if (!target) return;
  showTab('feedback');
  const section = target.closest('.follow-up-feedback, .fb-section') || target;
  requestAnimationFrame(() => {
    target.focus({preventScroll:true});
    if (narrowLayout()) { section.scrollIntoView({behavior:'smooth', block:'start'}); return; }
    const pane = target.closest('.fb-scroll');
    if (pane) pane.scrollTo({top:pane.scrollTop + section.getBoundingClientRect().top - pane.getBoundingClientRect().top - 16, behavior:'smooth'});
  });
}

async function showRecord(recordId, {editing=false,feedbackOnly=false,focusFeedback=false,followUpFresh=false} = {}) {
  if (!(await leaveEditor())) return;
  clearDraftSession(); disposeVoice(); followUpVoice.dispose(); followUpVoice.dispose = () => {}; followUpVoice.draftId = null; resetReadAloud(); disposeVoice = () => {}; markView('practice'); currentRecordId = recordId;
  const record = await api(`/records/${recordId}`);
  const snapshot = workspace.snapshots[record.snapshotId] || await api(`/snapshots/${record.snapshotId}`);
  currentSnapshotId = record.snapshotId;
  const last = record.attempts.at(-1);
  const complete = record.status === 'completed';
  const followUps = Array.isArray(record.followUps) ? record.followUps : [];
  const currentFollowUp = followUps.at(-1);
  const followUpFeedbackPending = Boolean(currentFollowUp?.attempt && !currentFollowUp.attempt.feedback);
  annotations.clear();
  for (const attempt of [...record.attempts, ...followUps.map(item => item.attempt)]) registerAttempt(record, attempt);
  const lastKey = last && annotationKey(last.id);
  const editor = !complete && !feedbackOnly && (!last || (last.feedback && record.attempts.length===1 && (editing || record.writtenDraft)));
  const questionHtml = `${record.focusOrigin ? `<div class="focus-origin-banner"><p class="eyebrow">延續練習重點</p><p>這一題延續你上次的練習重點：<strong>${escape(record.focusOrigin.focusPoint.replace(/[。．.!！?？,，、;；\s]+$/u, ''))}</strong>，換一個情境、同一份職缺再練一次。</p></div>` : ''}<section class="question-phase" aria-label="題目"><div class="q-head"><span class="chip">${escape(categories[record.question.category] || record.question.category)}</span></div><h1 class="question-text" lang="en">${escape(record.question.text)}</h1><div id="question-read-aloud"></div><details open><summary>中文題意</summary><p class="meaning">${escape(record.question.meaningZh || '舊版題目未保存中文題意。')}</p></details></section>`;
  let work = '', feedbackPane = '', foot = '', tab = 'answer', step = 1;
  if (last && !last.feedback) {
    step = 2; tab = 'feedback';
    work = `<section class="answer-area"><div class="sec-head"><h2>你的回答已保存</h2></div>${annotatedTranscriptHtml(lastKey)}${playerHtml(last)}</section>`;
    feedbackPane = `<div class="fb-title"><h2>回饋</h2></div><div class="provider-warning"><p>回饋尚未完成，可以重試，不會重複提交回答。</p><div id="feedback-retry-actions"></div></div>`;
  } else if (editor) {
    if(last)work+=`<section class="answer-area revise-target"><div class="sec-head"><h2>這次，試著改這一點</h2>${quoteRefHtml(lastKey, 'priority')}</div><p>${escape(last.feedback.priorityImprovement.textZh || '請選擇一項下次想練習的重點。')}</p><details class="prev-answer"><summary>查看上一次的回答與回饋標記</summary>${annotatedTranscriptHtml(lastKey, {legend:true})}</details></section>`;
    work+=`<section class="answer-area"><h2>${last?'自己再試一次':'先用自己的方式回答'}</h2>${guidanceHtml()}<label for="answer">${last?'修改你的回答':'你的回答'}</label><textarea id="answer" class="transcript-input" rows="7" placeholder="先說出你的想法，不用一次就完美。"></textarea><p id="draft-status" class="draft-status" aria-live="polite"></p><button id="retry-draft" class="ghost" hidden type="button">重試儲存草稿</button><div id="voice-entry"></div><button id="submit-answer" class="primary wide" type="button">${last?'送出修改並取得回饋':'送出並取得回饋'}</button></section>`;
    feedbackPane = last
      ? `<div class="fb-title"><h2>上一次回答的回饋</h2></div><p class="fb-sub">修改時可以對照這份回饋；送出修改後會得到新的回饋。</p>${feedbackHtml(last.feedback, lastKey)}`
      : '<div class="fb-title"><h2>回饋</h2></div><p class="fb-empty">送出回答後，中文回饋會出現在這裡：一項做得好的地方、一項優先改進，以及四項評分，每一點都引用你的原句。</p>';
    if(last)foot='<div id="finish-while-editing" class="foot-actions"></div>';
  } else if(last) {
    step = complete ? 4 : currentFollowUp ? 3 : 2;
    tab = currentFollowUp && !currentFollowUp.attempt && !complete ? 'answer' : 'feedback';
    work+=`<section class="answer-area"><div class="sec-head"><h2>你的回答</h2>${record.attempts.length>1?`<span class="meta">第 ${record.attempts.length} 次回答</span>`:''}</div>${playerHtml(last)}${annotatedTranscriptHtml(lastKey, {legend:true})}<p class="work-note">回饋只引用你說過的英文原句，不翻譯、不改寫；修正建議不會算作正式回答。</p></section>`;
    if(record.attempts.length===2) {
      const first=record.attempts[0];
      const same=first.transcript.trim()===last.transcript.trim();
      work+=`<section class="answer-area"><h2>${same?'這次回答尚未修改':'看看這次的調整'}</h2><p>${same?'兩次內容相同，沒有文字修改可比較。':'先前的練習重點：'+escape(first.feedback.priorityImprovement.textZh || '此筆舊紀錄沒有中文說明。')}</p>${same?'':`<details open><summary>關鍵句前後對照</summary><div class="transcript-diff">${changedTextHtml(first.transcript,last.transcript)}</div></details>`}</section>`;
    }
    if(record.unsubmittedDraft)work+=`<details><summary>未送出的修改草稿（未評分）</summary><blockquote>${escape(record.unsubmittedDraft.transcript)}</blockquote></details>`;
    work+=followUpWorkHtml(record, complete);
    if(complete)feedbackPane+='<div id="practice-complete" class="complete-banner"><strong>今天又多練習了一點。</strong><p>本次回答與回饋已保存。</p></div>';
    feedbackPane+=`<section class="fb-section" aria-labelledby="feedback-heading"><h2 id="feedback-heading" tabindex="-1">給這次回答的一點建議</h2>${feedbackHtml(last.feedback, lastKey)}<div id="corrections" class="corrections-area" aria-live="polite"></div><details id="attempt-history"><summary>查看回答紀錄（${record.attempts.length} 個版本）</summary><label for="attempt-version">選擇回答版本</label><select id="attempt-version">${record.attempts.map((a,i)=>`<option value="${i}" ${i===record.attempts.length-1?'selected':''}>第 ${i+1} 次回答 · ${escape(dateLabel(a.submittedAt))}</option>`).join('')}</select><div id="attempt-detail"></div></details></section>`;
    if(complete && record.focusOrigin){const priority=last.feedback.priorityImprovement;feedbackPane+=`<section class="answer-area focus-progress"><h2>這個重點練得如何？</h2><p class="meta">上次的練習重點</p><blockquote>${escape(record.focusOrigin.focusPoint)}</blockquote><p class="meta">這次回答的優先改進</p><blockquote>${escape(priority.textZh || priority.text || '－')}</blockquote>${priority.quote?`<p class="meta focus-quote">依據你這次的原句 ${quoteRefHtml(lastKey, 'priority')}</p>`:''}<p>對照上次的重點與這次的回饋，由你判斷這個重點是否已改善；系統不會替你宣稱進步。</p></section>`;}
    feedbackPane+=followUpFeedbackHtml(record, complete);
    feedbackPane+=`<div class="optional-actions">${complete?'':'<p class="optional-label">其他選擇</p>'}<div id="feedback-actions" class="button-row"></div><div id="rewrite-result" aria-live="polite"></div></div>`;
    const focus=record.focusPoint || last.feedback.priorityImprovement.textZh || '請選擇一項下次想練習的重點。';
    feedbackPane+=complete
      ?`<div class="focus-box completed"><p class="eyebrow">下次可以接著練</p><p>${escape(focus)}</p></div>`
      :`<div class="focus-box"><p class="eyebrow">完成這次練習</p><label for="focus">下次練習重點（可以修改）</label><textarea id="focus" rows="2" maxlength="500">${escape(focus)}</textarea><p class="meta">確認後按「結束並保存」，這一句就是這次練習存下來的重點。</p></div>`;
    if (complete) foot = '<div id="completed-actions" class="foot-actions"></div>';
    else {
      // #follow-up-actions sits here before the first follow-up and once a follow-up has
      // feedback; then it carries 結束並保存 itself, so #complete-practice is not repeated.
      const footFollowUp = !currentFollowUp || Boolean(currentFollowUp.attempt?.feedback);
      const end = followUpFeedbackPending
        ? '<p class="completion-lock" role="status">追問回答已保存；完成中文回饋後才能結束練習。</p>'
        : currentFollowUp?.attempt?.feedback ? '' : '<button id="complete-practice" class="primary" type="button">結束並保存</button>';
      foot = `<p class="meta foot-note">${currentFollowUp ? '每道主問最多追問兩次；' : '追問可選，每道主問最多兩次；'}隨時可以結束並保存。</p><div class="foot-actions"><div id="revise-actions" class="foot-group"></div>${footFollowUp ? '<div id="follow-up-actions" class="foot-group"></div>' : ''}${end}</div>`;
    }
  }
  const content = `<article class="workbench" data-tab="${tab}">
    <div class="wb-question">${questionHtml}</div>
    <div class="wb-tabs" role="tablist" aria-label="作答與回饋"><button type="button" role="tab" id="tab-answer" aria-controls="wb-answer" data-tab="answer">你的回答</button><button type="button" role="tab" id="tab-feedback" aria-controls="wb-feedback" data-tab="feedback">回饋</button></div>
    <section id="wb-answer" class="wb-answer" role="tabpanel" aria-labelledby="tab-answer">${work}</section>
    <aside class="wb-feedback" aria-label="回饋"><div id="wb-feedback" class="fb-scroll" role="tabpanel" aria-labelledby="tab-feedback">${feedbackPane}</div>${foot ? `<div class="fb-foot">${foot}</div>` : ''}</aside>
  </article>`;
  setJobContext(jobTitle(snapshot));
  setSteps(step);
  $('#practice').innerHTML = content;
  setupWorkbench();
  readAloud($('#question-read-aloud'), {recordId:record.id}, '朗讀題目', questionText($('#question-read-aloud')?.closest('.question-phase')));
  if (currentFollowUp) readAloud($('#follow-up-read-aloud'), {recordId:record.id, followUpId:currentFollowUp.id}, '朗讀追問題目', questionText($('#follow-up-read-aloud')?.closest('.follow-up-flow')));
  // Corrections rendered inside the collapsed follow-up history are static markup, so
  // they need mounting here; the live panels mount through setupCorrections.
  mountCorrectionSlots();
  updateFeedbackBadge();
  if ($('#attempt-version')) {
    const renderAttempt = () => {
      const index=Number($('#attempt-version').value), attempt=record.attempts[index];
      const older=index<record.attempts.length-1;
      // The latest version is already on screen (answer pane and notes), so it is not repeated.
      $('#attempt-detail').innerHTML=`<h3>第 ${index+1} 次回答</h3>${older?annotatedTranscriptHtml(annotationKey(attempt.id),{tag:'blockquote',corrections:false}):''}${playerHtml(attempt,{label:`回聽第 ${index+1} 次回答`})}${older?feedbackHtml(attempt.feedback, annotationKey(attempt.id)):'<p class="meta">此版本的回答與回饋已顯示在上方。</p>'}`;
    };
    $('#attempt-version').addEventListener('change',renderAttempt);
    renderAttempt();
  }
  const finish=async()=>{
    if(!(await leaveEditor()))return;
    const focus=$('#focus')?.value || last.feedback.priorityImprovement.textZh || '請選擇一項下次想練習的重點。';
    await api(`/records/${record.id}/complete`,{focusPoint:focus.slice(0,500)});
    clearDraftSession();await refreshWorkspace();await showRecord(record.id);
  };
  const followUpActions = $('#follow-up-actions');
  if (last?.feedback && !complete && followUpActions) {
    if (!currentFollowUp) {
      const start = button('讓面試官追問',()=>startFollowUp(record.id),followUpActions,{kind:'secondary'});
      start.disabled = !modelReady();
    } else if (!currentFollowUp.attempt) {
      const submissionId = crypto.randomUUID();
      const submit = button('送出並取得中文回饋',()=>submitFollowUp(record,currentFollowUp,submissionId),followUpActions,{id:'submit-follow-up'});
      submit.disabled = !modelReady();
      // 結束並保存 stays in the pane footer (#complete-practice) while answering.
      mountFollowUpVoice(record, currentFollowUp);
      requestAnimationFrame(() => {
        $('#follow-up-answer')?.focus({preventScroll:true});
        $('#practice .follow-up-flow')?.scrollIntoView({behavior:'smooth', block:'start'});
      });
    } else if (!currentFollowUp.attempt.feedback) {
      const retry = button('重試取得中文回饋',()=>requestFollowUpFeedback(record.id,currentFollowUp.id),followUpActions);
      retry.disabled = !modelReady();
    } else {
      if (followUps.length < 2) {
        const next = button('繼續追問',()=>startFollowUp(record.id),followUpActions,{kind:'secondary'});
        next.disabled = !modelReady();
      }
      button('結束並保存',finish,followUpActions);
    }
  }
  if(last&&!last.feedback)button('重試取得回饋',()=>requestFeedback(record.id),$('#feedback-retry-actions'));
  if(editor) {
    installEditor(record, {});
    button('給我一個提示',()=>showCoaching(record,'hint',$('#hint-result')),$('#hint-actions'),{kind:'ghost'});
    button('沒有相關經驗的回答框架',()=>showCoaching(record,'gap',$('#hint-result')),$('#hint-actions'),{kind:'ghost'});
    button('看一個示範回答',()=>showCoaching(record,'illustrative',$('#hint-result')),$('#hint-actions'),{kind:'ghost'});
    button('幫我整理成英文',()=>showCoaching(record,'ideas',$('#ideas-result'),$('#ideas').value),$('#ideas-actions'),{kind:'secondary'});
    if(last){button('回到回饋，先不修改',()=>showRecord(record.id,{feedbackOnly:true}),$('#finish-while-editing'),{kind:'secondary'});button('保存草稿，稍後再練',()=>navigate('home'),$('#finish-while-editing'),{kind:'ghost'});}
    const switcher=document.createElement('div');switcher.className='button-row';$('#wb-answer').append(switcher);
    button('換一題',async()=>{if(!(await leaveEditor()))return;const analysis=await analysisView(record.snapshotId);const index=analysis.questions.findIndex(q=>q.id===record.question.id);await showQuestion(record.snapshotId,analysis.questions[(index+1)%analysis.questions.length].id,analysis);},switcher,{kind:'ghost',id:'next-question'});
    button('查看全部題目',()=>showQuestionList(record.snapshotId),switcher,{kind:'ghost',id:'view-all-questions'});
  } else if(last?.feedback) {
    if(!complete && !followUpFeedbackPending && record.attempts.length<2)button('自己再試一次',()=>showRecord(record.id,{editing:true}),$('#revise-actions'),{kind:'secondary'});
    button('幫我講得更自然',()=>showCoaching(record,'rewrite',$('#rewrite-result')),$('#feedback-actions'),{kind:'secondary'});
    if(!complete) {
      if($('#complete-practice'))$('#complete-practice').addEventListener('click',async event=>{event.currentTarget.disabled=true;try{await finish();}catch(error){setError(error.message);if($('#complete-practice'))$('#complete-practice').disabled=false;}});
    } else {button('針對這個重點再練一次',()=>createFromFocus(record.id),$('#completed-actions'),{kind:'secondary',id:'practice-focus'});button('再練一題',()=>showRecommended(record.snapshotId),$('#completed-actions'));button('回到首頁',()=>navigate('home'),$('#completed-actions'),{kind:'ghost'});}
  }
  if (last?.feedback && $('#corrections')) setupCorrections(record, last.id, $('#corrections'), focusFeedback);
  if (currentFollowUp?.attempt?.feedback && $('#follow-up-corrections')) setupCorrections(record, currentFollowUp.attempt.id, $('#follow-up-corrections'), followUpFresh);
  if (focusFeedback) revealFeedback($('#feedback-heading'));
  if (followUpFresh) revealFeedback($('#follow-up-feedback-title'));
  if (!narrowLayout()) $('#practice .fb-scroll')?.scrollTo({top:0});
  syncLayoutMetrics();
}

// Short Mock Session: three questions in a row, no coaching in between, one overall
// read at the end. It is not a Practice Loop and never produces a Focus Point.
// Every mock screen renders inside one `.room`: the dark interview room (issue
// 0027). The dark tokens are scoped to that element, so no other view turns dark.
let mockVoice = {draftId: null, dispose: () => {}};
function disposeMockVoice() { mockVoice.dispose(); mockVoice = {draftId: null, dispose: () => {}}; }
const mmss = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
// Progress as one segment per question (done / skipped / now) beside the words.
function roomTop(session, label, {current = -1, exit = false} = {}) {
  const dots = session.entries.map((entry, index) => `<i class="${index === current ? 'now' : entry.skipped ? 'skipped' : (entry.answer || index < current || current < 0) ? 'done' : ''}"></i>`).join('');
  return `<header class="room-top"><p class="room-title">三題短場模擬</p><div class="prog"><span class="prog-dots" aria-hidden="true">${dots}</span><p class="mock-progress">${escape(label)}</p></div>${exit ? '<div class="room-exit" id="mock-exit"></div>' : ''}</header>`;
}

async function startMockSession(snapshotId) {
  setError();
  setNotice('正在準備三題短場模擬…');
  try {
    const session = await api('/mock-sessions', {snapshotId});
    setNotice();
    await showMockSession(session.id);
  } catch (error) { setNotice(); setError(error.message); }
}

async function showMockSession(sessionId, {summaryFresh = false} = {}) {
  if (!(await leaveEditor())) return;
  clearDraftSession(); disposeVoice(); disposeMockVoice(); resetReadAloud();
  markView('mock');
  const session = await api(`/mock-sessions/${sessionId}`);
  // Keep the cached workspace current so Records shows this session without a reload.
  await refreshWorkspace().catch(() => {});
  const snapshot = workspace.snapshots[session.snapshotId];
  // The job lives in the topbar breadcrumb, as on the practice screen.
  setJobContext(snapshot ? jobTitle(snapshot) : '');
  const host = $('#mock');
  if (session.status === 'in-progress') {
    const index = session.entries.findIndex(entry => entry.id === session.currentEntryId);
    const entry = session.entries[index];
    const limit = providerInfo?.speech?.recordingLimitSeconds || 180;
    // The resting waveform is a fixed decorative shape; while recording it draws the
    // input level voice.js already measures (see mountRoomRecorder).
    const bars = '<i></i>'.repeat(64);
    host.innerHTML = `<div class="room" data-rec="idle">${roomTop(session, `第 ${session.currentPosition} / ${session.questionCount} 題`, {current: index, exit: true})}<div class="room-body">
      <section class="stage question-phase" aria-labelledby="mock-question">
        <p class="cat"><span class="chip">${escape(categories[entry.question.category] || entry.question.category)}</span><span>第 ${session.currentPosition} 題</span></p>
        <h1 id="mock-question" class="big-q question-text" lang="en">${escape(entry.question.text)}</h1>
        <p class="hidden-q" aria-hidden="true">聽力模式：題目先藏起來，像真的面試一樣用聽的。朗讀結束後不會自動出現，需要時按「顯示題目」。</p>
        <div id="mock-read-aloud" class="stage-tools"></div>
        <details><summary>中文題意</summary><p class="meaning">${escape(entry.question.meaningZh || '舊版題目未保存中文題意。')}</p></details>
      </section>
      <section class="console" aria-label="作答">
        <div class="wave" aria-hidden="true">${bars}</div>
        <div class="console-row">
          <p class="timer"><span class="dot" aria-hidden="true"></span><span class="visually-hidden">錄音時間</span><b id="mock-elapsed">00:00</b><span class="timer-limit">/ ${mmss(limit)}</span></p>
          <button type="button" id="mock-record" class="rec-btn" aria-describedby="mock-record-hint"><span class="rec-icon" aria-hidden="true"></span><span class="rec-text">開始錄音</span></button>
          <p id="mock-record-hint" class="rec-hint">按下錄音開始作答，最多 ${Math.round(limit / 60)} 分鐘。</p>
        </div>
        <p id="mock-record-live" class="visually-hidden" role="status"></p>
        <p class="rec-label">模擬進行中不提供提示、示範或英文協助；整場結束後才會給回饋，也才能請教練幫忙。答不出來可以跳過，不會被當成錯誤答案。</p>
        <div class="answer-box">
          <label for="mock-answer">你的回答</label><textarea id="mock-answer" class="transcript-input" rows="4" placeholder="像面試一樣，先把想說的講出來。錄音轉成的文字也會放在這裡。">${escape(session.transcriptDraft?.entryId === entry.id ? session.transcriptDraft.transcript : '')}</textarea>
          <p id="mock-answer-status" class="draft-status" aria-live="polite">${session.transcriptDraft?.entryId === entry.id ? '已帶入這次的語音轉錄，可以直接送出，或先修改。' : '可以打字，也可以用語音回答。'}</p>
        </div>
        <div class="button-row console-actions" id="mock-actions"></div>
      </section>
      <section id="mock-voice-entry" class="voice-details" aria-label="錄音細節"></section>
    </div></div>`;
    // Inline style attributes are blocked by the CSP; bar heights are set through CSSOM.
    host.querySelectorAll('.wave i').forEach((bar, i) => bar.style.setProperty('--h', `${14 + Math.round(56 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * .37)))}%`));
    readAloud($('#mock-read-aloud'), {snapshotId: session.snapshotId, questionId: entry.question.id}, '朗讀題目', questionText($('#mock .stage')));
    mountMockVoice(session, entry);
    const submissionId = crypto.randomUUID();
    button('跳過這一題', async () => {
      if (!window.confirm('跳過這一題？這一題會記成「跳過」，不會有回饋，也不會被當成錯誤答案。')) return;
      await api(`/mock-sessions/${session.id}/skip`, {entryId: entry.id});
      await advanceMockSession(session.id);
    }, $('#mock-actions'), {kind: 'ghost', id: 'mock-skip'});
    button(session.currentPosition === session.questionCount ? '送出並結束這場模擬' : '送出，下一題', async () => {
      const transcript = $('#mock-answer').value;
      if (!transcript.trim()) { setError('請先寫下你的英文回答，或選擇跳過這一題。'); $('#mock-answer').focus(); return; }
      await api(`/mock-sessions/${session.id}/answer`, {entryId: entry.id, transcript, submissionId, ...(mockVoice.draftId ? {transcriptDraftId: mockVoice.draftId} : {})});
      await advanceMockSession(session.id);
    }, $('#mock-actions'), {id: 'mock-submit'});
    button('先離開，稍後繼續', () => navigate('history'), $('#mock-exit'), {kind: 'ghost'});
    requestAnimationFrame(() => $('#mock-answer')?.focus({preventScroll: true}));
    return;
  }
  if (session.status === 'awaiting-summary') {
    host.innerHTML = `<div class="room">${roomTop(session, '三題都完成了')}<div class="room-body">
      <section class="room-wait"><h1>正在整理整場回饋</h1><p>回答已保存在本機。這一步會用整場的回答產生一項優點與一項優先重點。</p><div class="button-row" id="mock-actions"></div></section></div></div>`;
    const run = async () => { await api(`/mock-sessions/${session.id}/summary`, {}); await showMockSession(session.id, {summaryFresh: true}); };
    button('取得整場回饋', run, $('#mock-actions'));
    button('先離開，稍後再看', () => navigate('history'), $('#mock-actions'), {kind: 'ghost'});
    if (summaryFresh) return;
    run().catch(error => setError(error.message));
    return;
  }
  renderMockSummary(session);
}

// The Session Summary uses the same note pattern as a Feedback Report. Each finding
// quotes one session answer verbatim (checked on the server against the session's
// transcripts), so the quote is shown in the note and also marked in that
// question's answer, linked both ways like any other feedback quote.
function renderMockSummary(session) {
  const nothing = session.summary?.nothingToAssess;
  annotations.clear();
  const quoted = new Map();
  const findings = nothing ? [] : [['strength', 'ok', '優', '整場做得好的地方'], ['priorityImprovement', 'warn', '改', '整場優先改進']].map(([name, kind, tag, title]) => {
    const item = session.summary[name];
    // Anchored at the first answer that contains the quote, as quotes are within one answer.
    const index = session.entries.findIndex(entry => !entry.skipped && entry.answer?.transcript?.includes(item.quote));
    const entry = session.entries[index];
    const key = entry ? annotationKey(`mock-${entry.id}`) : null;
    const note = {id: `${key || 'mock-summary'}-session-${name}`, kind, tag, title, quote: item.quote};
    if (entry) quoted.set(entry.id, [...(quoted.get(entry.id) || []), note]);
    return {item, note, index, key};
  });
  const entries = session.entries.map((entry, index) => {
    const head = `<p class="eyebrow">第 ${index + 1} 題・${escape(categories[entry.question.category] || entry.question.category)}</p><h3 lang="en">${escape(entry.question.text)}</h3>`;
    if (entry.skipped) return `<article class="list-card mock-entry is-skipped"><span class="mock-skipped">已跳過</span>${head}<p class="meta">這一題你選擇跳過，沒有回答，因此沒有評分。</p></article>`;
    const key = registerAnnotation(annotationKey(`mock-${entry.id}`), {transcript: entry.answer.transcript, feedback: entry.feedback, extraNotes: quoted.get(entry.id)});
    return `<article class="list-card mock-entry" data-entry-id="${escape(entry.id)}">${head}<details><summary>查看你的回答</summary>${annotatedTranscriptHtml(key, {tag:'blockquote', legend: true})}${playerHtml(entry.answer, {label: '回聽這一題的錄音'})}</details><div class="mock-entry-feedback" aria-live="polite"></div></article>`;
  }).join('');
  const finding = ({item, note, index, key}) => {
    const n = key ? annotationModel(key).sentenceOf[note.id] : 0;
    const ref = n ? `<button type="button" class="ref" data-jump="${escape(note.id)}" aria-label="在第 ${index + 1} 題的回答中標出第 ${n} 句" title="${escape(note.quote)}"><span aria-hidden="true">↳</span> 第 ${index + 1} 題・第 ${n} 句</button>` : '';
    return `<article class="feedback-card note note-${note.kind}" id="${noteDomId(note.id)}" data-note-id="${escape(note.id)}" tabindex="-1">
      <header>${tagHtml(note)}<h3>${escape(note.title)}</h3>${ref}</header>
      <p id="${noteDomId(note.id)}-d"><span class="visually-hidden">${escape(note.title)}：</span>${escape(item.textZh || item.text)}</p>
      <p class="note-quote" lang="en"><span class="visually-hidden" lang="zh-Hant">你的原句：</span>${escape(item.quote)}</p>
    </article>`;
  };
  const overall = nothing
    ? '<p class="provider-warning">這場模擬三題都跳過了，沒有可以評的內容。下一次挑一題先講三句也好。</p>'
    : `<div class="feedback-feature fb-sec">${findings.map(finding).join('')}</div>`;
  $('#mock').innerHTML = `<div class="room room-summary">${roomTop(session, `已完成 · ${dateLabel(session.completedAt)}`)}<div class="room-body summary-body">
    <section class="summary-overall" aria-labelledby="mock-summary-heading"><h1 id="mock-summary-heading" tabindex="-1">整場回饋</h1><p class="meta">這是整場的一項優點與一項優先重點，不是分數，也不是錄取判斷。逐題回饋要看再展開。</p>${overall}</section>
    <section class="summary-entries" aria-labelledby="mock-entries-heading"><h2 id="mock-entries-heading">逐題</h2>${entries}</section>
    <div class="button-row" id="mock-summary-actions"></div></div></div>`;
  document.querySelectorAll('.mock-entry[data-entry-id]').forEach(card => {
    const panel = card.querySelector('.mock-entry-feedback');
    const entryId = card.dataset.entryId;
    const entry = session.entries.find(item => item.id === entryId);
    const key = annotationKey(`mock-${entry.id}`);
    if (entry.feedback) { panel.innerHTML = feedbackHtml(entry.feedback, key); return; }
    button('看這一題的回饋', async () => {
      panel.innerHTML = '<p class="meta">正在整理這一題的回饋…</p>';
      try { const updated = await api(`/mock-sessions/${session.id}/entries/${entryId}/feedback`, {}); annotations.get(key).feedback = updated.feedback; refreshAnnotatedTranscripts(key); panel.innerHTML = feedbackHtml(updated.feedback, key); }
      catch (error) { panel.replaceChildren(); button('重試取得這一題的回饋', () => {}, panel, {kind: 'ghost'}).remove(); panel.innerHTML = '<p class="meta">尚未取得回饋，可再按一次重試。</p>'; throw error; }
    }, panel, {kind: 'ghost'});
    button('幫我講得更自然', async () => {
      const result = await api(`/mock-sessions/${session.id}/entries/${entryId}/coaching`, {mode: 'rewrite'});
      const box = document.createElement('section');
      box.className = 'detail-panel coaching-result';
      box.innerHTML = `<p class="eyebrow">英文示範</p><p class="coaching-text" lang="en">${escape(result.text)}</p><p class="meta">${escape(result.explanationZh)}</p>`;
      panel.append(box);
    }, panel, {kind: 'ghost'});
  });
  button('回到練習紀錄', () => navigate('history'), $('#mock-summary-actions'), {kind: 'secondary'});
  button('回到首頁', () => navigate('home'), $('#mock-summary-actions'), {kind: 'ghost'});
  requestAnimationFrame(() => $('#mock-summary-heading')?.focus({preventScroll: true}));
}

function mountMockVoice(session, entry) {
  const host = $('#mock-voice-entry');
  const textarea = $('#mock-answer');
  if (!host || !textarea) return;
  mockVoice.draftId = session.transcriptDraft?.entryId === entry.id ? session.transcriptDraft.id : null;
  const status = $('#mock-answer-status');
  const disposePanel = mountVoice(host, {
    path: `/mock-sessions/${session.id}/entries/${entry.id}/transcription`,
    api,
    provider: providerInfo?.speech,
    beforeTranscription: async () => { textarea.readOnly = true; $('#mock-submit').disabled = true; },
    onTranscript: draft => {
      const existing = textarea.value;
      mockVoice.draftId = draft.id;
      if (!existing.trim() || existing.includes(draft.transcript)) {
        textarea.value = existing.includes(draft.transcript) ? existing : draft.transcript;
        if (status) status.textContent = '語音轉錄已放進回答框，可以直接送出，或先修改。';
        return;
      }
      textarea.value = `${existing.replace(/\s+$/, '')}\n${draft.transcript}`;
      if (status) status.textContent = '語音轉錄已接在原本的文字後面。';
    },
    onTranscriptionEnd: () => { textarea.readOnly = false; $('#mock-submit').disabled = false; },
    onError: error => setError(localizeError(error.message, error.status || 400))
  });
  const disposeRecorder = mountRoomRecorder();
  mockVoice.dispose = () => { disposeRecorder(); disposePanel(); };
}

// The room's single record control drives voice.js's own recorder: its start and
// stop buttons stay in the page (hidden inside the room) and do the work, so the
// recording, three-minute cap and transcription are exactly those of every other
// answer path. The room only mirrors their state — the control's name, the elapsed
// time and the input level voice.js already measures — read from the panel's DOM.
function mountRoomRecorder() {
  const room = $('#mock .room'), record = $('#mock-record'), host = $('#mock-voice-entry');
  const panel = host?.querySelector('.voice-panel');
  if (!room || !record || !panel) return () => {};
  const limit = providerInfo?.speech?.recordingLimitSeconds || 180;
  const warnAt = Math.max(5, limit - (providerInfo?.speech?.recordingWarningSeconds || 30));
  const elapsed = $('#mock-elapsed'), hint = $('#mock-record-hint'), live = $('#mock-record-live'), label = record.querySelector('.rec-text');
  const bars = [...room.querySelectorAll('.wave i')];
  const levels = [];
  let state = '', startedAt = 0, frame = 0, lastSample = 0, warned = false, recorded = false;
  const control = name => panel.isConnected ? panel.querySelector(`.voice-${name}`) : null;
  const read = () => {
    if (!panel.isConnected) return 'text';
    if (!control('stop').disabled) return 'recording';
    if (control('start').disabled) return 'busy';
    return control('retry').hidden ? 'idle' : 'failed';
  };
  const paintLevels = () => bars.forEach((bar, i) => {
    const value = levels[levels.length - bars.length + i];
    bar.style.setProperty('--h', `${value === undefined ? 4 : Math.round(6 + value * 94)}%`);
  });
  const tick = now => {
    const seconds = Math.min(limit, (Date.now() - startedAt) / 1000);
    elapsed.textContent = mmss(seconds);
    room.classList.toggle('near-limit', seconds >= warnAt);
    // Announced once, not every second.
    if (seconds >= warnAt && !warned) { warned = true; live.textContent = `快到 ${Math.round(limit / 60)} 分鐘上限了，請開始收尾（剩下約 ${Math.max(0, Math.round(limit - seconds))} 秒）。`; }
    const meter = panel.querySelector('.voice-level');
    const measured = meter && !meter.hidden && !meter.closest('[hidden]');
    room.dataset.level = measured ? 'live' : 'none';
    if (measured && now - lastSample > 80) { lastSample = now; levels.push(Number(meter.value) || 0); if (levels.length > bars.length) levels.shift(); paintLevels(); }
    frame = requestAnimationFrame(tick);
  };
  const sync = () => {
    const next = read();
    if (next === state) return;
    const previous = state;
    state = next;
    room.dataset.rec = next;
    record.setAttribute('aria-disabled', String(next === 'busy'));
    cancelAnimationFrame(frame);
    if (next === 'recording') {
      startedAt = Date.now(); warned = false; recorded = true; levels.length = 0; live.textContent = '';
      paintLevels();
      frame = requestAnimationFrame(tick);
    } else room.classList.remove('near-limit');
    label.textContent = {recording: '停止並轉成文字', busy: previous === 'recording' ? '正在轉成文字…' : '正在開啟麥克風…', failed: '重新錄音'}[next] || '開始錄音';
    hint.textContent = {
      recording: `錄音中。再按一次停止並轉成文字；${Math.round(limit / 60)} 分鐘時會自動停止。`,
      busy: previous === 'recording' ? '正在把錄音轉成文字，完成後會放進回答框。' : '請允許瀏覽器使用麥克風。',
      failed: '轉成文字失敗，錄音還在：可以在下方「錄音細節」重試轉錄，或重新錄音、改用打字。',
      text: '已改用打字作答。',
      idle: recorded ? '已停止。可以送出，或再按一次重新錄音。' : `按下錄音開始作答，最多 ${Math.round(limit / 60)} 分鐘。`
    }[next];
  };
  record.addEventListener('click', () => {
    if (state === 'recording') control('stop')?.click();
    else if (state === 'idle' || state === 'failed') control('start')?.click();
  });
  const observer = new MutationObserver(sync);
  observer.observe(host, {subtree: true, childList: true, attributes: true, attributeFilter: ['disabled', 'hidden']});
  sync();
  return () => { observer.disconnect(); cancelAnimationFrame(frame); };
}

async function advanceMockSession(sessionId) {
  disposeMockVoice();
  await refreshWorkspace();
  await showMockSession(sessionId);
}

async function abandonMockSession(sessionId) {
  if (!window.confirm('放棄這場模擬？這場的回答與錄音會一起刪除，其他練習不受影響。')) return;
  await api(`/mock-sessions/${sessionId}`, undefined, 'DELETE');
  await refreshWorkspace();
  renderHistory();
  setNotice('這場模擬已刪除。');
}

async function deleteRecord(recordId) {
  if (!window.confirm('確定刪除這筆練習與它的文字草稿嗎？')) return;
  clearDraftSession();
  await api(`/records/${recordId}`, undefined, 'DELETE');
  await refreshWorkspace();
  setNotice('練習紀錄與相關草稿已刪除。');
  await navigate('history');
}

function jobTitle(snapshot) { return snapshot?.title || firstLine(snapshot?.text); }
function jobActivity(snapshot, records) {
  const times = [snapshot?.capturedAt, ...records.map(r => r.updatedAt || r.createdAt)].filter(Boolean).map(value => new Date(value).getTime()).filter(value => !Number.isNaN(value));
  return times.length ? Math.max(...times) : 0;
}
async function startJob(snapshotId) {
  if (!workspace.analyses[snapshotId]) { setNotice('正在產生練習題…'); await api(`/snapshots/${snapshotId}/analysis`, {}); await refreshWorkspace(); setNotice(); }
  await showRecommended(snapshotId);
}
async function deleteJob(snapshotId) {
  if (!window.confirm('確定刪除這份職缺、相關練習與草稿嗎？其他職缺不受影響。')) return;
  await api(`/snapshots/${snapshotId}`, undefined, 'DELETE');
  if (historyState.openJob === snapshotId) historyState.openJob = null;
  await refreshWorkspace(); renderHistory(); setNotice('這份職缺與相關練習已刪除，其他資料保留。');
}
// The "⋯" menu on a Records card: a native <details>, closed by Escape (focus returns
// to its summary) or by a click anywhere outside it.
function moreMenu(label) {
  const menu = document.createElement('details'); menu.className = 'more-menu';
  menu.innerHTML = `<summary aria-label="${escape(label)}" title="${escape(label)}"><span aria-hidden="true">⋯</span></summary><div class="more-panel"></div>`;
  return menu;
}
document.addEventListener('click', event => document.querySelectorAll('details.more-menu[open]').forEach(menu => { if (!menu.contains(event.target)) menu.open = false; }));
document.addEventListener('keydown', event => {
  const menu = event.key === 'Escape' && event.target.closest?.('details.more-menu[open]');
  if (menu) { menu.open = false; menu.querySelector('summary').focus(); }
});
const stateChip = (text, kind = '') => `<span class="chip state-chip${kind ? ` ${kind}` : ''}">${escape(text)}</span>`;
function renderJobDetail(container, snapshot) {
  const records = sortRecent(Object.values(workspace.records || {}).filter(r => r.snapshotId === snapshot.id));
  const sessions = sortRecent(Object.values(workspace.mockSessions || {}).filter(s => s.snapshotId === snapshot.id));
  container.replaceChildren();
  container.insertAdjacentHTML('beforeend', `<p class="detail-label">這份職缺的練習（${records.length + sessions.length}）</p>`);
  for (const session of sessions) {
    const done = session.status === 'completed';
    const answered = session.entries.filter(entry => entry.answer).length;
    const card = document.createElement('article'); card.className = 'list-card record-card mock-card'; card.dataset.sessionId = session.id;
    card.innerHTML = `<div class="rec-main"><p class="rec-line">${stateChip('三題短場模擬', 'chip-mock')}${stateChip(done ? '已完成' : '進行中', done ? 'is-done' : 'is-open')}</p><p class="meta">${escape(dateLabel(session.completedAt || session.updatedAt || session.createdAt))} · 已作答 ${answered} / ${session.entries.length} 題${session.entries.some(entry => entry.skipped) ? ' · 有跳過的題目' : ''}</p></div><div class="button-row rec-actions"></div>`;
    const actions = card.querySelector('.button-row');
    button(done ? '查看整場回饋' : '繼續這場模擬', () => showMockSession(session.id), actions, {kind: 'secondary'});
    const menu = moreMenu('更多動作');
    button(done ? '刪除這場模擬' : '放棄這場模擬', () => abandonMockSession(session.id), menu.querySelector('.more-panel'), {kind: 'danger'});
    actions.append(menu);
    container.append(card);
  }
  if (!records.length) { container.insertAdjacentHTML('beforeend', '<p class="empty">這份職缺還沒有單題練習紀錄，可以從上方開始新練習。</p>'); return; }
  for (const record of records) {
    const followUps = Array.isArray(record.followUps) ? record.followUps : [];
    const card = document.createElement('article'); card.className = 'list-card record-card'; card.dataset.recordId = record.id;
    const origin = record.focusOrigin ? `<p class="meta rec-origin">延續重點：${escape(record.focusOrigin.focusPoint)}</p>` : '';
    const followUpNote = followUps.length ? ` · ${followUps.length} 則追問` : '';
    const done = record.status === 'completed';
    card.innerHTML = `<div class="rec-main"><p class="rec-line">${stateChip(recordStates[record.status] || record.status, done ? 'is-done' : 'is-open')}<span class="meta">${escape(dateLabel(record.updatedAt || record.createdAt))}${followUpNote}</span></p><h4 lang="en">${escape(record.question.text)}</h4>${origin}</div><div class="button-row rec-actions"></div>`;
    const actions = card.querySelector('.button-row');
    button(done ? '查看紀錄' : '繼續練習', () => showRecord(record.id), actions, {kind:'secondary'});
    const menu = moreMenu('更多動作');
    button('刪除這筆練習', () => deleteRecord(record.id), menu.querySelector('.more-panel'), {kind:'danger'});
    actions.append(menu);
    container.append(card);
  }
}
// Re-rendering the list replaces its controls, so the control a keyboard user just
// pressed is found again and refocused.
function refocus(selector) { requestAnimationFrame(() => $(selector)?.focus({preventScroll: true})); }
function renderHistory() {
  const host = $('#history'); if (!host) return; host.replaceChildren();
  const snapshots = Object.values(workspace.snapshots || {});
  const allRecords = Object.values(workspace.records || {});
  if (!snapshots.length) { host.innerHTML = '<p class="empty">還沒有練習紀錄。從首頁貼一份職缺就能開始。</p>'; return; }

  const unfinished = sortRecent(allRecords.filter(r => r.status !== 'completed'))[0];
  if (unfinished) {
    const snapshot = workspace.snapshots[unfinished.snapshotId];
    const card = document.createElement('article'); card.className = 'list-card continue-card';
    // Job titles are bounded everywhere (issue 0026): a pasted JD's first line is often a whole sentence.
    card.innerHTML = `<div class="continue-main"><p class="eyebrow">繼續上次練習</p><h3 title="${escape(jobTitle(snapshot))}">${escape(truncate(jobTitle(snapshot)))}</h3><p class="meta">${escape(recordStates[unfinished.status] || unfinished.status)} · <span lang="en">${escape(unfinished.question.text)}</span></p></div><div class="button-row"></div>`;
    button('繼續練習', () => showRecord(unfinished.id), card.querySelector('.button-row'), {kind:'primary'});
    host.append(card);
  }

  const controls = document.createElement('div'); controls.className = 'history-controls';
  controls.innerHTML = `<label for="job-search" class="visually-hidden">搜尋職缺</label><input id="job-search" type="search" placeholder="搜尋職缺名稱或內容" value="${escape(historyState.query)}"><label for="job-filter" class="visually-hidden">篩選</label><select id="job-filter"><option value="all">全部職缺</option><option value="active">有進行中的練習</option><option value="completed">已有完成練習</option></select>`;
  host.append(controls);
  const search = controls.querySelector('#job-search');
  search.addEventListener('input', () => { historyState.query = search.value; historyState.page = 0; renderHistory(); const again = $('#job-search'); if (again) { again.focus(); const end = again.value.length; again.setSelectionRange(end, end); } });
  const filter = controls.querySelector('#job-filter'); filter.value = historyState.filter;
  filter.addEventListener('change', () => { historyState.filter = filter.value; historyState.page = 0; renderHistory(); refocus('#job-filter'); });

  const allSessions = Object.values(workspace.mockSessions || {});
  const jobs = snapshots.map(snapshot => {
    const records = allRecords.filter(r => r.snapshotId === snapshot.id);
    const sessions = allSessions.filter(s => s.snapshotId === snapshot.id);
    // An unfinished session counts as work in progress, never as completed practice.
    return {snapshot, records, sessions, completed: records.filter(r => r.status === 'completed').length, completedSessions: sessions.filter(s => s.status === 'completed').length,
      hasUnfinished: records.some(r => r.status !== 'completed') || sessions.some(s => s.status !== 'completed'), activity: jobActivity(snapshot, [...records, ...sessions]), title: jobTitle(snapshot)};
  });
  const query = historyState.query.trim().toLowerCase();
  const filtered = jobs.filter(job => {
    if (query && !`${job.title} ${job.snapshot.text || ''}`.toLowerCase().includes(query)) return false;
    if (historyState.filter === 'active' && !job.hasUnfinished) return false;
    if (historyState.filter === 'completed' && !job.completed) return false;
    return true;
  }).sort((a, b) => b.activity - a.activity);

  const count = document.createElement('p'); count.className = 'meta list-summary'; count.setAttribute('role', 'status');
  count.textContent = filtered.length === jobs.length ? `共 ${jobs.length} 份職缺` : `符合 ${filtered.length} / ${jobs.length} 份職缺`;
  host.append(count);
  const list = document.createElement('div'); list.className = 'job-list'; host.append(list);
  if (!filtered.length) { list.innerHTML = '<p class="empty">沒有符合的職缺。調整搜尋或篩選條件。</p>'; return; }
  const pageCount = Math.max(1, Math.ceil(filtered.length / JOBS_PER_PAGE));
  historyState.page = Math.min(Math.max(historyState.page, 0), pageCount - 1);
  const pageJobs = filtered.slice(historyState.page * JOBS_PER_PAGE, (historyState.page + 1) * JOBS_PER_PAGE);

  for (const job of pageJobs) {
    const snapshot = job.snapshot;
    const open = historyState.openJob === snapshot.id;
    const renaming = historyState.renaming === snapshot.id;
    const analysed = Boolean(workspace.analyses[snapshot.id]);
    const card = document.createElement('article'); card.className = `list-card job-card${open ? ' is-open' : ''}`; card.dataset.jobId = snapshot.id;
    card.innerHTML = `<div class="job-row"><div class="job-head"></div><div class="button-row job-actions"></div></div>${open ? '<div class="job-detail"></div>' : ''}`;
    const head = card.querySelector('.job-head');
    if (renaming) {
      head.innerHTML = `<label for="rename-input" class="visually-hidden">職缺名稱</label><input id="rename-input" maxlength="120" value="${escape(job.title)}"><div class="button-row rename-actions"></div>`;
      const input = head.querySelector('#rename-input');
      button('儲存名稱', async () => { await api(`/snapshots/${snapshot.id}/title`, {title: input.value}); historyState.renaming = null; await refreshWorkspace(); renderHistory(); setNotice('職缺名稱已更新。'); refocus(`[data-job-id="${CSS.escape(snapshot.id)}"] .more-menu summary`); }, head.querySelector('.rename-actions'), {kind:'secondary'});
      button('取消', () => { historyState.renaming = null; renderHistory(); refocus(`[data-job-id="${CSS.escape(snapshot.id)}"] .more-menu summary`); }, head.querySelector('.rename-actions'), {kind:'ghost'});
    } else {
      // The title is the truncated job title (the learner's rename, or the JD's first
      // line), never the raw JD; the full title is the tooltip. There is no company field.
      const stats = [`最近活動 ${escape(dateLabel(job.activity))}`, `已完成 ${job.completed} 次主練習`, ...(job.completedSessions ? [`${job.completedSessions} 場模擬`] : [])];
      const flags = `${job.hasUnfinished ? stateChip('有進行中的練習', 'is-open') : ''}${analysed ? '' : stateChip('尚未產生題目')}`;
      head.innerHTML = `<h3 title="${escape(job.title)}">${escape(truncate(job.title))}</h3><p class="meta job-stats">${stats.join(' · ')}${flags}</p>`;
    }
    const actions = card.querySelector('.job-actions');
    button(analysed ? '開始新練習' : '產生題目', () => startJob(snapshot.id), actions, {kind:'primary'});
    if (analysed) {
      const running = job.sessions.find(session => session.status !== 'completed');
      button(running ? '繼續三題模擬' : '三題短場模擬', () => running ? showMockSession(running.id) : startMockSession(snapshot.id), actions, {kind:'secondary', id:`mock-${snapshot.id}`});
    }
    const items = job.records.length + job.sessions.length;
    if (items) button(open ? '收合練習' : `查看練習（${items}）`, () => { historyState.openJob = open ? null : snapshot.id; renderHistory(); refocus(`[data-job-id="${CSS.escape(snapshot.id)}"] [aria-expanded]`); }, actions, {kind:'ghost', attributes:{'aria-expanded': String(open)}});
    const menu = moreMenu('更多動作');
    const panel = menu.querySelector('.more-panel');
    button('重新命名', () => { historyState.renaming = snapshot.id; renderHistory(); requestAnimationFrame(() => $('#rename-input')?.focus()); }, panel, {kind:'ghost'});
    button('刪除職缺', () => deleteJob(snapshot.id), panel, {kind:'danger'});
    actions.append(menu);
    if (open) renderJobDetail(card.querySelector('.job-detail'), snapshot);
    list.append(card);
  }

  if (pageCount > 1) {
    const pager = document.createElement('nav'); pager.className = 'button-row pager'; pager.setAttribute('aria-label', '職缺分頁');
    const turn = (offset, id) => { historyState.page += offset; renderHistory(); refocus($(`#${id}`)?.disabled ? '.pager button:not(:disabled)' : `#${id}`); };
    button('上一頁', () => turn(-1, 'history-prev'), pager, {kind:'ghost', id:'history-prev'}).disabled = historyState.page === 0;
    const label = document.createElement('span'); label.className = 'meta'; label.textContent = `第 ${historyState.page + 1} / ${pageCount} 頁`; pager.append(label);
    button('下一頁', () => turn(1, 'history-next'), pager, {kind:'ghost', id:'history-next'}).disabled = historyState.page >= pageCount - 1;
    host.append(pager);
  }
}

// 我的進步: every completed Practice Loop leaves one Focus Point. The same Focus
// Point in two or more loops, or one the learner confirms, is a Recurring Weakness
// whose status (active / improving / resolved) only the learner sets; each item
// links back to the Practice Records it came from. Data: GET /api/progress.
const progressStatus = {active:'需加強', improving:'改善中', resolved:'已解決'};
const progressIcons = {
  active:'<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8"/><path d="M12 8v5M12 16h.01"/></svg>',
  improving:'<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m4 16 5-5 4 4 7-7"/><path d="M15 8h5v5"/></svg>',
  resolved:checkIcon,
  single:'<svg class="i" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"/></svg>'
};
async function decideProgressItem(id, input, focusSelector) {
  await api(`/progress/${id}`, input);
  await renderProgress();
  if (focusSelector) refocus(`[data-progress-id="${CSS.escape(id)}"] ${focusSelector}`);
}
function progressItem(item) {
  const evidence = [...item.evidence].sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
  const latest = evidence[0];
  const status = item.recurring ? item.status : 'single';
  const why = item.recurring ? (item.evidence.length >= 2 ? `出現在 ${item.evidence.length} 次練習` : '你確認會反覆出現') : item.rejected ? '你標記為不是反覆出現的問題' : '目前只出現在 1 次練習';
  const card = document.createElement('article'); card.className = `list-card progress-item is-${status}`; card.dataset.progressId = item.id;
  const label = item.recurring ? progressStatus[item.status] : '單次重點';
  const rows = evidence.map(entry => {
    const snapshot = workspace.snapshots?.[entry.snapshotId];
    return `<li class="ev-row"><span class="ev-body"><span class="ev-q" lang="en" title="${escape(entry.questionText)}">${escape(entry.questionText)}</span><span class="meta"><span class="ev-job" title="${escape(jobTitle(snapshot))}">${escape(truncate(jobTitle(snapshot), 40))}</span> · ${escape(dateLabel(entry.completedAt))}</span></span><button type="button" class="ghost" data-open-record="${escape(entry.recordId)}">回顧練習</button></li>`;
  }).join('');
  card.innerHTML = `<header class="pi-head"><span class="chip status-chip">${progressIcons[status]}${escape(label)}</span><span class="meta">${escape(why)} · 最近 ${escape(dateLabel(latest?.completedAt))}</span></header>
    <p class="pi-focus">${escape(item.focusPoint)}</p>
    ${item.recurring ? `<div class="pi-status"><span class="meta" id="status-label-${escape(item.id)}">狀態由你決定</span><div class="seg" role="group" aria-labelledby="status-label-${escape(item.id)}"></div></div>` : ''}
    <div class="pi-evidence"><p class="detail-label">相關練習（${evidence.length}）</p><ol class="ev-list">${rows}</ol></div>
    <div class="button-row pi-actions"></div>`;
  const seg = card.querySelector('.seg');
  if (seg) for (const [value, text] of Object.entries(progressStatus)) {
    button(text, () => decideProgressItem(item.id, {action:'status', status:value}, `[data-status="${value}"]`), seg, {kind:'seg-btn', attributes:{'aria-pressed': String(item.status === value), 'data-status': value}});
  }
  card.querySelectorAll('[data-open-record]').forEach(control => control.addEventListener('click', () => showRecord(control.dataset.openRecord).catch(error => setError(error.message))));
  const actions = card.querySelector('.pi-actions');
  if (latest && !(item.recurring && item.status === 'resolved')) button('針對這個重點再練一次', () => createFromFocus(latest.recordId), actions, {kind:'secondary'});
  if (!item.recurring) button(item.rejected ? '改回反覆出現的問題' : '標記為反覆出現的問題', () => decideProgressItem(item.id, {action:'confirm'}, '.seg [aria-pressed="true"]'), actions, {kind:'ghost'});
  else button('不是反覆出現的問題', () => decideProgressItem(item.id, {action:'reject'}, '.pi-actions button:last-child'), actions, {kind:'ghost'});
  return card;
}
async function renderProgress() {
  const token = viewToken;
  const host = $('#progress');
  const items = await api('/progress');
  if (viewToken !== token || currentView !== 'progress') return;
  host.replaceChildren();
  if (!items.length) { host.innerHTML = '<p class="empty">完成一次練習後，這裡會留下你的下一步。</p>'; return; }
  const latest = item => Math.max(...item.evidence.map(entry => new Date(entry.completedAt || 0).getTime()));
  const byRecent = list => list.sort((a, b) => latest(b) - latest(a));
  const recurring = byRecent(items.filter(item => item.recurring && item.status !== 'resolved')).sort((a, b) => (a.status === 'improving') - (b.status === 'improving'));
  const single = byRecent(items.filter(item => !item.recurring));
  const resolved = byRecent(items.filter(item => item.recurring && item.status === 'resolved'));
  const counts = [['需加強', recurring.filter(item => item.status === 'active').length], ['改善中', recurring.filter(item => item.status === 'improving').length], ['已解決', resolved.length], ['單次重點', single.length]];
  host.insertAdjacentHTML('beforeend', `<p class="view-lead">每次完成練習都會留下一個「下次練習重點」。同一個重點出現在兩次以上的練習，或你確認它會反覆出現，就列為反覆出現的弱點；它的狀態由你決定，系統不會替你宣稱進步。</p>
    <dl class="stat-strip">${counts.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`);
  const group = (id, title, list, empty) => {
    const section = document.createElement('section'); section.className = 'progress-group'; section.setAttribute('aria-labelledby', id);
    section.innerHTML = `<h2 id="${id}">${title}<span class="count">${list.length}</span></h2>`;
    if (!list.length) section.insertAdjacentHTML('beforeend', `<p class="empty">${empty}</p>`);
    list.forEach(item => section.append(progressItem(item)));
    host.append(section);
  };
  group('progress-recurring', '反覆出現的弱點', recurring, '目前沒有反覆出現的弱點。同一個重點出現在兩次練習，或你把單次重點標記為反覆出現後，會列在這裡。');
  group('progress-single', '單次練習重點', single, '沒有只出現一次的練習重點。');
  if (resolved.length) group('progress-resolved', '已解決', resolved, '');
}

async function renderEvidence({clearText=false}={}) {
  const token=viewToken;
  const parent=$('#evidence');
  parent.textContent='正在讀取履歷…';
  const resume=await api('/resume');
  if(viewToken!==token)return;
  parent.innerHTML=`<section class="settings-section resume-form" aria-labelledby="resume-heading"><header class="section-head"><h2 id="resume-heading">${resume?'目前使用的履歷':'讓問題更貼近你'}</h2>${resume?'<span class="chip chip-accent">新練習預設使用</span>':''}</header><p class="section-lead">上傳一次，之後貼 JD 就會預設搭配這份履歷出題。</p><div class="upload-box"><p class="field-label" id="resume-file-label">上傳 PDF、DOCX 或 TXT（最多 5 MB）</p><div class="file-field"><label class="file-button" for="resume-file">選擇檔案</label><input type="file" id="resume-file" accept=".pdf,.docx,.txt" class="visually-hidden" aria-describedby="resume-file-label"><span id="resume-filename" class="file-name">尚未選擇檔案</span></div><p id="resume-extract-status" class="meta" role="status"></p></div><label for="resume-name">檔名</label><input id="resume-name" value="${escape(resume?.name || '我的履歷')}"><label for="resume-text">履歷內容，可直接貼上或修正辨識結果</label><textarea id="resume-text" rows="14">${escape(resume?.text || '')}</textarea><p class="meta">保存在本機；搭配 JD 產題時才會傳送文字給模型。替換履歷不會改動舊練習。</p><div id="resume-actions" class="button-row"></div></section>`;
  if(clearText)$('#resume-text').value='';
  let extracting=false, extractionId=0;
  $('#resume-file').addEventListener('change',async event=>{
    const file=event.target.files[0];if(!file)return;
    if($('#resume-filename'))$('#resume-filename').textContent=file.name;
    if(file.size>5000000){setError('履歷檔案需小於 5 MB。');return;}
    const extraction=++extractionId;
    extracting=true;$('#save-resume').disabled=true;$('#resume-extract-status').textContent='正在辨識文字…';
    try {
      const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
      const result=await api('/resume/extract',{name:file.name,base64:btoa(binary)});
      if(extraction!==extractionId||viewToken!==token||currentView!=='evidence')return;
      $('#resume-name').value=result.name;$('#resume-text').value=result.text;$('#resume-extract-status').textContent='文字已辨識。可修正後儲存。';
    }catch(error){if(extraction!==extractionId||viewToken!==token)return;setError(error.message);if($('#resume-extract-status'))$('#resume-extract-status').textContent='未替換原有履歷。可改為貼上文字。';}
    finally{if(extraction===extractionId&&viewToken===token){extracting=false;if($('#save-resume'))$('#save-resume').disabled=false;}}
  });
  button('儲存履歷',async()=>{if(extracting)return;await api('/resume',{name:$('#resume-name').value,text:$('#resume-text').value});await refreshWorkspace();setNotice('履歷已儲存，新練習會預設使用。');await renderEvidence({clearText:true});},$('#resume-actions'),{id:'save-resume'});
  if(resume)button('移除目前履歷',async()=>{if(!confirm('移除目前履歷？既有練習保留當時的履歷版本；可在設定刪除全部資料。'))return;await api('/resume',undefined,'DELETE');await refreshWorkspace();await renderEvidence();},$('#resume-actions'),{kind:'ghost'});
}

const searchFieldLabels = {roles:'想找的職務',locations:'地點',seniority:'年資層級',workArrangements:'工作方式',salary:'薪資期待',priorities:'重視條件',exclusions:'排除條件'};

function fillSearchFields(values) {
  for (const field of Object.keys(searchFieldLabels)) {
    const input = $(`#profile-${field}`);
    if (input) input.value = (values[field] || []).join(', ');
  }
}

const locationTags = {taiwan:'台灣在地', 'taiwan-remote':'台灣可做・支援遠端', remote:'遠端（需自行確認可否在台灣受聘）', unknown:'地點未載明'};
const fitParts = {matched:'已符合', transferable:'可轉移', gaps:'需補足', unknown:'職缺未說明'};
const blockingLabels = {roles:'想找的職務', locations:'地點', seniority:'年資層級', workArrangements:'工作方式', exclusions:'排除條件'};

// The shortlist is the coach's reading of public postings: at most five, never padded,
// with the fit split four ways rather than collapsed into a score.
function renderShortlist(run, results, save) {
  results.replaceChildren();
  const failed = (run.sourceStatus || []).filter(status => !status.ok);
  const header = document.createElement('div');
  header.className = 'results-head';
  header.innerHTML = `<p class="meta">查詢時間 ${escape(dateLabel(run.capturedAt))} · 來源 ${escape((run.sourceStatus || []).filter(s => s.ok).map(s => s.source).join('、') || run.source)}</p>
    ${failed.length ? `<p class="meta">${escape(failed.map(s => `${s.source}：${s.error === 'rate-limited' ? '請求過多，稍後重試' : s.error === 'timed-out' ? '逾時' : '暫時無法連線'}`).join('；'))}。其他來源的結果仍然列在下面。</p>` : ''}
    <p class="meta">這是教練依公開職缺內容的判讀，不是雇主的評估，也不是保證錄取；不會替你投遞。${run.resumeUsed ? '適配說明會參考你目前保存的履歷。' : '目前沒有保存履歷，因此只依職缺內容判讀。'}</p>`;
  results.append(header);

  if (!run.shortlist.length) {
    const empty = document.createElement('div');
    empty.className = 'provider-warning';
    empty.innerHTML = run.blocking?.length
      ? `<strong>沒有符合的職缺</strong><p>這些條件排除掉最多職缺：</p><ul class="interpreted-list">${run.blocking.map(item => `<li><strong>${escape(blockingLabels[item.field] || item.field)}</strong>（${escape(item.terms.join('、'))}）排除了 ${item.removed} 筆</li>`).join('')}</ul><div class="button-row" id="relax-actions"></div>`
      : '<strong>沒有符合的職缺</strong><p>這次來源沒有回傳任何可用的職缺。可以稍後重試，或回首頁直接貼上職缺描述。</p><div class="button-row" id="relax-actions"></div>';
    results.append(empty);
    for (const item of run.blocking || []) {
      button(`放寬「${blockingLabels[item.field] || item.field}」`, async () => {
        const input = $(`#profile-${item.field}`);
        if (input) input.value = '';
        await save();
        setNotice(`已清除「${blockingLabels[item.field] || item.field}」條件，可以再搜尋一次。`);
      }, $('#relax-actions'), {kind:'secondary'});
    }
    button('改用貼上職缺描述', () => navigate('home'), $('#relax-actions'), {kind:'ghost'});
    return;
  }

  const count = document.createElement('p');
  count.className = 'eyebrow';
  count.textContent = `精選 ${run.shortlist.length} 筆${run.shortlist.length < 5 ? '（符合的就這些，沒有湊數）' : ''}`;
  results.append(count);

  for (const job of run.shortlist) {
    const card = document.createElement('article'); card.className = 'list-card shortlist-card'; card.dataset.resultId = job.id;
    // Four separate parts, never a score. Each part differs by its glyph (CSS) and
    // border style as well as its label, not by colour alone.
    const parts = Object.entries(fitParts).map(([key, label]) => `<section class="fit-part fit-${key}" aria-label="${escape(label)}（${job[key].length} 項）"><div class="fit-head"><h4>${escape(label)}</h4><span class="fit-n" aria-hidden="true">${job[key].length}</span></div>${job[key].length ? `<ul>${job[key].map(entry => `<li>${escape(entry)}</li>`).join('')}</ul>` : '<p class="meta">—</p>'}</section>`).join('');
    card.innerHTML = `<header class="sl-head"><h3 title="${escape(job.title)}">${escape(truncate(job.title))}</h3>
      <p class="meta">${escape(job.location)} · ${escape(job.source)} · <span class="chip location-tag">${escape(locationTags[job.locationTag] || job.locationTag)}</span></p></header>
      <p class="why-fit">${escape(job.whyFitZh)}</p>
      <p class="detail-label">適配拆解</p>
      <div class="fit-breakdown">${parts}</div>
      <div class="sl-source"><details><summary>查看取得的職缺內容</summary><blockquote>${escape(job.text)}</blockquote></details>
      <a href="${escape(job.sourceUrl)}" target="_blank" rel="noopener noreferrer">查看原始職缺<span class="visually-hidden">（在新分頁開啟）</span></a></div>
      <div class="sl-foot"><label class="check-label"><input type="checkbox" class="shortlist-resume" ${workspace.resume ? 'checked' : 'disabled'}>${workspace.resume ? `搭配履歷：${escape(workspace.resume.name)}` : '尚未保存履歷，將只依職缺出題'}</label>
      <label class="visually-hidden" for="depth-${escape(job.id)}">練習深度</label>
      <select id="depth-${escape(job.id)}" class="shortlist-depth"><option value="standard">依職缺要求</option><option value="easier">簡單一點</option><option value="deeper">深入一點</option></select>
      <div class="button-row"></div></div>`;
    button('保存並產生題目', async () => {
      const snapshot = await api(`/discovery/${run.id}/select`, {resultId: job.id, useResume: card.querySelector('.shortlist-resume').checked, difficulty: card.querySelector('.shortlist-depth').value});
      await refreshWorkspace();
      await api(`/snapshots/${snapshot.id}/analysis`, {});
      await refreshWorkspace();
      await showRecommended(snapshot.id);
    }, card.querySelector('.button-row'));
    results.append(card);
  }
}

async function renderDiscovery() {
  const parent = $('#discovery'); parent.replaceChildren();
  const profile = await api('/job-search-profile');
  // Describe it in your own words; the product proposes criteria and you confirm them.
  const ask = document.createElement('section'); ask.className = 'settings-section search-ask'; ask.setAttribute('aria-labelledby', 'ask-heading');
  ask.innerHTML = `<h2 id="ask-heading">用一句話說你想找什麼</h2><label for="search-request">例如：根據我的履歷，幫我找台灣適合轉職的 AI 職缺，最好能遠端</label>
    <textarea id="search-request" rows="3" placeholder="用中文或英文都可以。"></textarea>
    <p class="meta job-source-note">目前只搜尋 Greenhouse；104、LinkedIn、Cake 的職缺請直接貼上 JD。</p>
    <p class="data-note" id="interpret-disclosure"></p>
    <div class="button-row" id="interpret-actions"></div>
    <div id="interpret-result" aria-live="polite"></div>`;
  const form = document.createElement('section'); form.className = 'settings-section search-profile'; form.setAttribute('aria-labelledby', 'profile-heading');
  form.innerHTML = `<h2 id="profile-heading">搜尋條件</h2>
    <p class="section-lead" id="profile-hint">這些是實際會用來搜尋的條件，你可以直接修改；同一欄有多個條件時以逗號分隔。搜尋只會在你按下按鈕時進行，履歷不會送到職缺板。</p>
    <div class="field-grid"></div><div class="button-row" id="profile-actions"></div>`;
  const labels = searchFieldLabels;
  for (const [field,text] of Object.entries(labels)) form.querySelector('.field-grid').insertAdjacentHTML('beforeend', `<div class="field"><label for="profile-${field}">${escape(text)}</label><input id="profile-${field}" value="${escape((profile[field] || []).join(', '))}" aria-describedby="profile-hint"></div>`);
  const save = () => api('/job-search-profile', Object.fromEntries(Object.keys(labels).map(field => [field,$(`#profile-${field}`).value.split(',').map(value => value.trim()).filter(Boolean)])));
  const results = document.createElement('div'); results.id = 'discovery-results';
  button('搜尋公開職缺', async () => {
    results.innerHTML = '<p class="meta">正在搜尋並整理精選職缺…</p>';
    await save();
    let run;
    try { run = await api('/discovery', {}); }
    catch (error) { results.innerHTML = '<p class="empty">這次搜尋沒有完成，搜尋條件仍保存在本機。可以稍後重試，或回首頁直接貼上職缺描述。</p>'; throw error; }
    renderShortlist(run, results, save);
  }, form.querySelector('#profile-actions'));
  button('儲存搜尋條件', save, form.querySelector('#profile-actions'), {kind:'secondary'});
  const byUrl = document.createElement('section'); byUrl.className = 'settings-section search-url'; byUrl.setAttribute('aria-labelledby', 'url-heading');
  byUrl.innerHTML = '<h2 id="url-heading">已經有職缺網址？</h2><label for="job-url">支援的 Greenhouse 職缺網址</label><input id="job-url" type="url" placeholder="https://job-boards.greenhouse.io/…"><div class="button-row" id="url-actions"></div>';
  button('取得並保存職缺', async () => { const snapshot = await api('/snapshots/from-url', {url:$('#job-url').value}); await refreshWorkspace(); await api(`/snapshots/${snapshot.id}/analysis`, {}); await refreshWorkspace(); await showRecommended(snapshot.id); }, byUrl.querySelector('#url-actions'), {kind:'secondary'});
  parent.append(ask, form, results, byUrl);

  $('#interpret-disclosure').textContent = providerInfo?.languageModel?.external
    ? `你寫的這句話會傳送給 ${providerInfo.languageModel.name} 來整理成搜尋條件。你的履歷不會送到職缺板。`
    : '目前使用本機示範服務，這句話不會傳送到外部；示範服務只會抓出少數明顯的關鍵字。';
  button('整理成搜尋條件', async () => {
    const request = $('#search-request').value;
    if (!request.trim()) { setError('請先用一句話描述你想找的職缺。'); $('#search-request').focus(); return; }
    const panel = $('#interpret-result');
    panel.innerHTML = '<p class="meta">正在整理你說的條件…</p>';
    try {
      const result = await api('/discovery/interpret', {request});
      const stated = Object.entries(searchFieldLabels).filter(([field]) => result.proposal[field]?.length);
      panel.innerHTML = `<div class="callout"><strong>我理解成這些條件</strong>
        ${stated.length ? `<ul class="interpreted-list">${stated.map(([field, label]) => `<li><strong>${escape(label)}</strong>：${escape(result.proposal[field].join('、'))}</li>`).join('')}</ul>` : '<p>你這句話裡沒有明確的條件。你可以直接在下面填寫。</p>'}
        <p class="meta">沒有講到的條件會留空，不會替你猜。確認後才會套用到下面的搜尋條件，也才會儲存。</p>
        <div class="button-row" id="interpret-confirm"></div></div>`;
      button('套用這些條件', async () => {
        fillSearchFields(result.proposal);
        await save();
        setNotice('搜尋條件已更新並儲存。可以再修改，或直接搜尋。');
        panel.replaceChildren();
      }, $('#interpret-confirm'), {kind:'secondary', id:'apply-interpreted'});
      button('不要套用', () => panel.replaceChildren(), $('#interpret-confirm'), {kind:'ghost'});
    } catch (error) { panel.innerHTML = '<p class="meta">沒有整理出條件，你的搜尋條件沒有被改動。可以修改描述後再試一次。</p>'; throw error; }
  }, $('#interpret-actions'), {id:'interpret-request'});
}

function renderSettings() {
  const parent = $('#provider-settings'); parent.replaceChildren();
  const names = {languageModel:'題目與回饋',speech:'語音轉錄與朗讀',jobSource:'公開職缺來源',jobCuration:'精選職缺與適配拆解'};
  for (const [role,info] of Object.entries(providerInfo || {})) {
    const row = document.createElement('div'); row.className = `provider-row${info.external ? ' is-external' : ''}`;
    const access = !info.external ? '' : info.subscription ? '透過你的官方訂閱登入使用；用量依方案計算，不需在本機保存 API 金鑰。' : role === 'jobSource' ? '只讀取你指定的公開職缺板；不需金鑰，也不送出個人資料。' : '使用你在啟動時設定的 API 金鑰；金鑰只從伺服器環境讀取，不會存進本機資料、也不會出現在瀏覽器或畫面上。呼叫可能依供應商方案產生費用。';
    const speechNote = role !== 'speech' ? '' : info.demonstrationSpeech ? '目前的朗讀是本機示意音，不是真人語音。' : info.canSpeak ? '英文題目、示範回答與關鍵句修正可以朗讀；中文說明不會朗讀。' : '這個服務不支援朗讀，畫面上不會出現朗讀按鈕。';
    // Data-flow disclosure: what each configured service may receive, and when.
    const flow = info.external
      ? `<div class="flow-box"><p class="flow-title">可能送出</p><ul class="flow-list">${info.outbound.map(item => `<li>${escape(outboundLabel(item))}</li>`).join('')}</ul></div>`
      : '<p class="meta">本機示範服務，不傳送資料到外部。</p>';
    row.innerHTML = `<div class="pr-role"><h3>${escape(names[role] || role)}</h3><span class="chip${info.external ? ' chip-accent' : ''}">${info.external ? '外部服務' : '只在本機'}</span></div><div class="pr-body"><p class="pr-name">${escape(providerName(info))}</p>${flow}${speechNote ? `<p class="meta">${escape(speechNote)}</p>` : ''}${access ? `<p class="meta">${access}</p>` : ''}</div>`;
    parent.append(row);
  }
  if (providerInfo?.languageModel?.subscription) {
    const status = document.createElement('div'); status.className = languageStatus.ready ? 'callout status-box is-ready' : 'provider-warning status-box'; status.setAttribute('role', 'status'); status.innerHTML = `<strong>${languageStatus.ready ? 'Codex 訂閱服務已可使用' : languageStatus.authenticated ? '已登入，尚未完成本機驗證' : '尚未完成 Codex 登入'}</strong><p>${languageStatus.ready ? '文字題目與回饋會使用你的方案用量。' : '請在專案終端依 README 完成登入與驗證，再回來檢查。已寫的本機草稿不受影響。'}</p>`;
    button('重新檢查狀態', async () => { languageStatus = await api('/providers/language-status'); renderSettings(); refocus('#recheck-status'); }, status, {kind:'secondary', id:'recheck-status'});
    parent.append(status);
  }
  const deletion = $('#delete-workspace'); deletion.replaceChildren();
  deletion.innerHTML = `<p class="meta" id="recording-storage">${escape(recordingBytesLabel())}</p><p>這會刪除所有職缺、題目、練習紀錄、文字草稿、回答錄音與進步項目。若要繼續，請輸入 <strong class="confirm-phrase" lang="en">DELETE ALL LOCAL DATA</strong>。</p><label for="delete-all">確認文字</label><input id="delete-all" autocomplete="off" spellcheck="false">`;
  button('刪除全部本機資料', async () => {
    await api('/workspace/delete', {confirmation:$('#delete-all').value}); clearDraftSession(); disposeVoice(); followUpVoice.dispose(); followUpVoice.dispose = () => {}; followUpVoice.draftId = null; resetReadAloud(); await refreshWorkspace(); setNotice('所有本機資料已刪除。'); await navigate('home');
  }, deletion, {kind:'danger'});
}

async function showOperations() {
  const parent = $('#operations');
  const operations = await api('/operations');
  const visible = [...operations.filter(operation => operation.state === 'pending'), ...operations.filter(operation => ['failed','cancelled'].includes(operation.state)).slice(-2)];
  const signature = JSON.stringify(visible.map(operation => [operation.id,operation.kind,operation.state,operation.retryable,operation.errorCode,operation.errorMessage]));
  if (signature === operationsSignature) return;
  operationsSignature = signature;
  parent.replaceChildren();
  for (const operation of visible) {
    // One compact row per operation: a state glyph (spinner / ! / –) plus the state
    // in words, so a failure never reads by colour alone.
    const row = document.createElement('div'); row.className = `operation-card op-${operation.state}`;
    const state = {pending:'進行中',succeeded:'已完成',failed:'失敗',cancelled:'已取消'}[operation.state] || operation.state;
    row.innerHTML = `<span class="op-icon" aria-hidden="true"></span><p class="op-line"><strong>${escape(operationNames[operation.kind] || operation.kind)}</strong><span class="op-sep" aria-hidden="true">·</span><span class="op-state">${escape(state)}</span>${operation.retryable ? '<span class="op-retry">· 可從原操作重試</span>' : ''}</p>`;
    // "失敗" on its own gives the learner nothing to act on. Show the recorded reason,
    // translated where we recognise it, so retrying is a decision rather than a guess.
    if (operation.errorMessage) {
      const reason = document.createElement('p');
      reason.className = 'meta operation-reason';
      reason.textContent = `原因：${localizeError(operation.errorMessage, undefined, operation.errorMessage)}`;
      row.append(reason);
    }
    if (operation.state === 'pending') button(['feedback','follow-up-feedback'].includes(operation.kind) ? '取消取得回饋' : '取消操作', () => api(`/operations/${operation.id}/cancel`, {}), row, {kind:'ghost'});
    else button('✕ 清除', async () => { await api(`/operations/${operation.id}`, undefined, 'DELETE'); operationsSignature = null; await showOperations(); }, row, {kind:'ghost'});
    parent.append(row);
  }
}

window.addEventListener('beforeunload', event => {
  // A captured-but-unsubmitted recording lives only in this page, so warn before it goes.
  if (draftSession?.dirty || hasPendingRecording()) { event.preventDefault(); event.returnValue = ''; }
  disposeVoice(); followUpVoice.dispose(); followUpVoice.dispose = () => {}; followUpVoice.draftId = null; resetReadAloud();
});

const operationsTimer = setInterval(() => showOperations().catch(() => {}), 800);
window.addEventListener('pagehide', () => clearInterval(operationsTimer));

async function initialize() {
  try {
    providerInfo = await api('/providers');
    if (providerInfo.languageModel.subscription) {
      try { languageStatus = await api('/providers/language-status'); }
      catch { languageStatus = {ready:false,authenticated:false}; }
    }
    const health = await api('/health');
    // Name the speech service in the strip: "why is it only beeping" should be
    // answerable by looking at the page, not by querying the API from a terminal.
    const speech = providerInfo.speech;
    const speechLabel = speech.demonstrationSpeech ? '語音：本機示範（嗶聲，非真人朗讀）' : speech.external ? `語音：${speech.name}` : '語音：本機示範';
    $('#provider').textContent = `${providerName(providerInfo.languageModel)} · ${speechLabel}`;
    await refreshWorkspace();
    renderSettings();
    renderHome();
    await showOperations();
  } catch (error) { setError(`無法開啟工作區：${error.message}`); }
}

renderHomePreview();
await initialize();
