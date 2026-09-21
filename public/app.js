import {mountVoice, mountReadAloud, resetReadAloud, hasPendingRecording} from './voice.js';

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

function localizeError(message, status) {
  const rules = [
    [/Paste a job description/i, '請先貼上職缺描述。'],
    [/Operation cancelled|cancelled or superseded/i, '操作已取消；先前保存的內容仍在本機。'],
    [/Operation already pending for this practice/i, '這筆練習的操作仍在進行，請等待或取消後再試。'],
    [/timed out/i, '服務等待逾時。已保存的內容不受影響，請重試原操作。'],
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
  return '目前的輸入或操作狀態無法接受，請檢查畫面提示後重試。';
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
function readAloud(parent, reference, label) {
  return mountReadAloud(parent, reference, {api, provider:providerInfo?.speech, label, onError:error => setError(error.message)});
}
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

function mountCorrectionReadAloud(container, recordId, attemptId) {
  container?.querySelectorAll('[data-correction-index]').forEach(slot => readAloud(slot, {recordId, attemptId, correctionIndex:Number(slot.dataset.correctionIndex)}, '朗讀修正句'));
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

function markView(name) {
  viewToken += 1;
  currentView = name;
  document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.id === `${name}-view`));
  document.querySelectorAll('[data-view]').forEach(control => {
    if (control.closest('nav')) {
      if (control.dataset.view === name) control.setAttribute('aria-current', 'page');
      else control.removeAttribute('aria-current');
    }
  });
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

function stepper(stage) {
  const labels = ['選擇職缺', '選一題', '試著回答', '回饋與收穫'];
  return `<ol class="stepper">${labels.map((label,index) => `<li class="${index < stage ? 'done' : index === stage ? 'current' : ''}"${index === stage ? ' aria-current="step"' : ''}><span>${escape(label)}</span></li>`).join('')}</ol>`;
}
function truncate(text, max = 60) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim();
  return value.length > max ? value.slice(0, max).trimEnd() + '…' : value;
}
function practiceFrame({stage=1, snapshot, content}) {
  const jobLine = snapshot ? `<div class="job-line"><span class="job-label">職缺：</span><span class="job-title">${escape(truncate(firstLine(snapshot.text)))}</span></div>` : '';
  return `<article class="practice-shell"><header class="practice-header">${stepper(stage)}</header>${jobLine}<div class="practice-body">${content}</div></article>`;
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
    card.innerHTML = `<p class="eyebrow">繼續上次練習</p><h2>${escape(firstLine(snapshot?.text))}</h2><p>${escape(recordStates[unfinished.status] || unfinished.status)} · ${escape(unfinished.question.text)}</p><div class="actions"></div>`;
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
  $('#practice').innerHTML = practiceFrame({stage:1, snapshot, content:`<div class="provider-warning"><h2>職缺已保存，題目尚未產生</h2><p>${escape(error.message)}</p><p>你不需要重新貼上職缺。可以直接重試這一步。</p><div id="analysis-retry"></div></div>`});
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
  const content = `<div id="recommended-question" class="question-phase"><p class="question-kicker">${recommended ? '建議先練' : '目前選擇'}｜${escape(categories[question.category] || question.category)}</p><h1 class="question-text" lang="en">${escape(question.text)}</h1><div id="question-read-aloud"></div><details open><summary>查看中文題意</summary><div class="detail-panel"><p>${escape(meaning)}</p></div></details>${providerGate}<div class="button-row" id="question-actions"></div></div>`;
  $('#practice').innerHTML = practiceFrame({stage:1, snapshot, content});
  readAloud($('#question-read-aloud'), {snapshotId, questionId:question.id}, '朗讀題目');
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
  const groups = Object.entries(categories).map(([category,label]) => {
    const questions = analysis.questions.filter(question => question.category === category);
    return `<section class="category-group"><h2>${escape(label)}</h2>${questions.map(question => {
      const records = (analysis.history?.[question.id] || []).map(item => workspace.records?.[item.recordId]).filter(Boolean);
      const answered = records.filter(record => record.attempts?.length > 0).length;
      const hasDraft = records.some(record => record.attempts?.length === 0 && record.writtenDraft);
      const progress = answered ? `已作答 ${answered} 次${hasDraft ? ' · 另有未送出草稿' : ''}` : hasDraft ? '有未送出草稿' : '尚未作答';
      return `<article class="question-card ${answered || hasDraft ? 'practised' : ''}" data-question-id="${escape(question.id)}"><p class="english" lang="en">${escape(question.text)}</p><p class="meta">${progress}${question.id === analysis.recommendation.questionId ? ' · 本次推薦' : ''}</p><button type="button" class="secondary">選這一題</button></article>`;
    }).join('')}</section>`;
  }).join('');
  const content = `<p class="eyebrow">完整題組</p><h1>選一題來練習</h1><p>題目依類型整理；切換題目不會重新呼叫模型。</p><div class="button-row" id="question-list-actions"></div><div id="question-list" class="question-list">${groups}</div>`;
  $('#practice').innerHTML = practiceFrame({stage:1, snapshot, content});
  button('回到推薦題', () => showRecommended(snapshotId), $('#question-list-actions'), {kind:'ghost'});
  if (analysis.questions.length < 40) button('另外新增四題', async () => {
    await api(`/snapshots/${snapshotId}/questions`, {});
    await refreshWorkspace();
    await showQuestionList(snapshotId);
  }, $('#question-list-actions'), {kind:'ghost'});
  document.querySelectorAll('[data-question-id] button').forEach(control => control.addEventListener('click', () => showQuestion(snapshotId, control.closest('[data-question-id]').dataset.questionId, analysis)));
}

function feedbackHtml(feedback, prefix = '') {
  if (!feedback) return '<p class="provider-warning">回饋尚未完成。你的回答已保存，可以重試取得回饋。</p>';
  const bilingual = feedback.strength?.textZh && feedback.priorityImprovement?.textZh && Object.values(feedback.ratings || {}).every(rating => rating.reasonZh);
  const finding = (title, item, kind) => `<article class="feedback-card ${kind}"><h3>${escape(title)}</h3><p>${escape(item.textZh || '此筆舊紀錄沒有中文說明。')}</p><blockquote><strong>你的原句</strong><br>${escape(item.quote)}</blockquote></article>`;
  const shownQuotes = new Set([feedback.strength?.quote, feedback.priorityImprovement?.quote].filter(Boolean));
  const ratings = Object.entries(feedback.ratings || {}).map(([dimension,rating]) => {
    const showQuote = rating.quote && !shownQuotes.has(rating.quote);
    if (rating.quote) shownQuotes.add(rating.quote);
    return `<div class="rating"><div class="rating-head"><strong>${escape(dimensions[dimension] || dimension)}</strong><span class="rating-level">${escape(rating.level)} / 4</span></div><p>${escape(rating.reasonZh || '此筆舊紀錄沒有中文評分理由。')}</p>${showQuote ? `<blockquote><strong>評分依據原句</strong><br>${escape(rating.quote)}</blockquote>` : ''}</div>`;
  }).join('');
  return `${bilingual ? '' : '<p class="legacy-note">此為舊版紀錄，部分中文說明尚未提供；原始資料保留，未自動重新評估。</p>'}<div class="feedback-feature">${finding('本次做得好的地方', feedback.strength, 'strength')}${finding('這次優先改進', feedback.priorityImprovement, 'priority')}</div><details class="ratings"><summary>查看四項評分與理由</summary><div class="detail-panel">${ratings}</div></details>${prefix}`;
}

function correctionsHtml(result) {
  const corrections = result?.corrections || [];
  if (!corrections.length) return '<p class="corrections-none meta">這次沒有需要調整的關鍵句，你的英文已經能清楚表達。</p>';
  return `<p class="eyebrow">關鍵句英文修正（${corrections.length}）</p><p class="meta">只列出必要的句子修正，保留你的原意、事實與語氣；這是修正建議，不會算作正式回答。</p>${corrections.map((item, index) => `<article class="correction-card"><p class="meta">你的原句</p><blockquote lang="en">${escape(item.original)}</blockquote><p class="meta">建議的英文表達</p><blockquote class="correction-rewrite" lang="en">${escape(item.rewrite)}</blockquote><div data-correction-index="${index}"></div><p class="correction-reason">${escape(item.reasonZh)}</p></article>`).join('')}`;
}
async function loadCorrections(recordId, attemptId, container) {
  const token = viewToken;
  container.innerHTML = '<p class="meta">正在整理關鍵句修正…</p>';
  try {
    const result = await api(`/records/${recordId}/corrections`, {attemptId});
    if (viewToken !== token || !container.isConnected) return;
    if (workspace.records?.[recordId]) { workspace.records[recordId].corrections ??= {}; workspace.records[recordId].corrections[attemptId] = result; }
    container.innerHTML = correctionsHtml(result);
    mountCorrectionReadAloud(container, recordId, attemptId);
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
  if (cached) { container.innerHTML = correctionsHtml(cached); mountCorrectionReadAloud(container, record.id, attemptId); return; }
  if (auto) { loadCorrections(record.id, attemptId, container); return; }
  container.replaceChildren();
  button('看關鍵句英文修正', () => loadCorrections(record.id, attemptId, container), container, {kind:'ghost'});
}

function changedTextHtml(before,after) {
  let start=0,end=0;
  while(start<before.length && start<after.length && before[start]===after[start])start++;
  while(end<before.length-start && end<after.length-start && before[before.length-1-end]===after[after.length-1-end])end++;
  const excerpt=value=>`${start>60?'…':''}${escape(value.slice(Math.max(0,start-60),start))}<mark>${escape(value.slice(start,value.length-end)) || '（已移除）'}</mark>${escape(value.slice(value.length-end,value.length-end+60))}${end>60?'…':''}`;
  return `<p class="meta">修改前</p><blockquote>${excerpt(before)}</blockquote><p class="meta">修改後</p><blockquote>${excerpt(after)}</blockquote>`;
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
  return `<details class="follow-up-history"><summary>查看第 ${followUps.length - 1} 次追問與回答</summary>
    <div class="detail-panel">
      <p lang="en"><strong>${escape(previous.question.text)}</strong></p>
      <p class="meaning">${escape(previous.question.meaningZh)}</p>
      <blockquote lang="en">${escape(previous.attempt?.transcript || '尚未作答')}</blockquote>
      ${previous.attempt ? playerHtml(previous.attempt, {label:`回聽第 ${followUps.length - 1} 次追問錄音`}) : ''}
      ${previous.attempt?.feedback ? feedbackHtml(previous.attempt.feedback) : ''}
      ${previousCorrections ? `<div class="corrections-area" data-history-attempt="${escape(previous.attempt.id)}">${correctionsHtml(previousCorrections)}</div>` : ''}
    </div>
  </details>`;
}

function followUpHtml(record, complete) {
  const followUps = Array.isArray(record.followUps) ? record.followUps : [];
  const current = followUps.at(-1);
  if (!current) {
    if (complete) return '';
    return `<div class="follow-up-flow follow-up-invitation" aria-labelledby="follow-up-title">
      <h3 id="follow-up-title">想練面試官接著會問什麼？</h3>
      <p class="meta">依你剛才保存的正式回答產生一題追問，每道主問最多兩次。</p>
      <div id="follow-up-actions" class="button-row"></div>
    </div>`;
  }
  const number = followUps.length;
  const attempt = current.attempt;
  const feedback = attempt?.feedback;
  let content = '';
  if (!attempt && !complete) {
    content = `<label for="follow-up-answer">你的追問回答</label>
      <textarea id="follow-up-answer" rows="6" placeholder="只寫下你想在面試中正式說出的英文回答。">${escape(current.transcriptDraft?.transcript || '')}</textarea>
      <p id="follow-up-draft-status" class="draft-status" aria-live="polite">${current.transcriptDraft ? '已帶入這次的語音轉錄，可以直接送出，或先修改。' : '可以打字，也可以用語音回答。'}</p>
      <div id="follow-up-voice-entry"></div>
      <div id="follow-up-actions" class="button-row"></div>`;
  } else if (!attempt) {
    content = '<p class="meta">這題尚未作答；你已提前結束並保存這次練習。</p>';
  } else if (!feedback) {
    content = `<h3>你的回答已保存</h3><blockquote lang="en">${escape(attempt.transcript)}</blockquote>
      <p>中文回饋尚未完成。請重試取得回饋，再決定要繼續追問或結束；正式回答不會重複保存。</p>
      ${complete ? '' : '<div id="follow-up-actions" class="button-row"></div>'}`;
  } else {
    content = `<details><summary>查看你的追問回答</summary><blockquote lang="en">${escape(attempt.transcript)}</blockquote></details>${playerHtml(attempt,{label:'回聽這次的追問錄音'})}
      <section class="follow-up-feedback" aria-labelledby="follow-up-feedback-title"><h3 id="follow-up-feedback-title" tabindex="-1">這次追問的中文回饋</h3>${feedbackHtml(feedback)}<div id="follow-up-corrections" class="corrections-area" aria-live="polite"></div></section>
      ${complete ? '' : '<div id="follow-up-actions" class="button-row"></div>'}`;
  }
  return `${followUpHistoryHtml(followUps, record.corrections)}<section class="follow-up-flow" aria-labelledby="follow-up-title">
    <div class="follow-up-heading"><p class="eyebrow">追問 ${number} / 2</p><span class="follow-up-state">${feedback ? '回饋已完成' : attempt ? '等待回饋' : '等待回答'}</span></div>
    <h2 id="follow-up-title" class="follow-up-question" lang="en">${escape(current.question.text)}</h2>
    <div id="follow-up-read-aloud"></div>
    <details open><summary>中文題意</summary><p class="meaning">${escape(current.question.meaningZh)}</p></details>
    ${content}
  </section>`;
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
    if (stillCurrent) {
      $('#complete-practice')?.remove();
      const focusBox = $('#focus')?.closest('.focus-box');
      if (focusBox && !focusBox.querySelector('.completion-lock')) {
        const lock = document.createElement('p');
        lock.className = 'completion-lock';
        lock.setAttribute('role','status');
        lock.textContent = '追問回答已保存；完成中文回饋後才能結束練習。';
        focusBox.append(lock);
      }
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
  const editor = !complete && !feedbackOnly && (!last || (last.feedback && record.attempts.length===1 && (editing || record.writtenDraft)));
  let body = `${record.focusOrigin ? `<div class="focus-origin-banner"><p class="eyebrow">延續練習重點</p><p>這一題延續你上次的練習重點：<strong>${escape(record.focusOrigin.focusPoint.replace(/[。．.!！?？,，、;；\s]+$/u, ''))}</strong>，換一個情境、同一份職缺再練一次。</p></div>` : ''}<section class="question-phase"><p class="question-kicker">${escape(categories[record.question.category] || record.question.category)}</p><h1 class="question-text" lang="en">${escape(record.question.text)}</h1><div id="question-read-aloud"></div><details open><summary>中文題意</summary><p class="meaning">${escape(record.question.meaningZh || '舊版題目未保存中文題意。')}</p></details></section>`;
  if (last && !last.feedback) {
    body += `<section class="answer-area"><h2>你的回答已保存</h2><details><summary>查看回答</summary><blockquote>${escape(last.transcript)}</blockquote></details>${playerHtml(last)}<p>回饋尚未完成，可以重試，不會重複提交回答。</p><div id="feedback-retry-actions"></div></section>`;
  } else if (editor) {
    if(last)body+=`<section class="answer-area"><h2>這次，試著改這一點</h2><p>${escape(last.feedback.priorityImprovement.textZh || '請選擇一項下次想練習的重點。')}</p><blockquote>${escape(last.feedback.priorityImprovement.quote)}</blockquote></section>`;
    body+=`<section class="answer-area"><h2>${last?'自己再試一次':'先用自己的方式回答'}</h2>${guidanceHtml()}<label for="answer">${last?'修改你的回答':'你的回答'}</label><textarea id="answer" rows="7" placeholder="先說出你的想法，不用一次就完美。"></textarea><p id="draft-status" class="draft-status" aria-live="polite"></p><button id="retry-draft" class="ghost" hidden type="button">重試儲存草稿</button><div id="voice-entry"></div><button id="submit-answer" class="primary wide" type="button">${last?'送出修改並取得回饋':'送出並取得回饋'}</button></section>`;
    if(last)body+='<div id="finish-while-editing"></div>';
  } else if(last) {
    if(complete)body+='<div id="practice-complete" class="complete-banner"><strong>今天又多練習了一點。</strong><p>本次回答與回饋已保存。</p></div>';
    if(record.attempts.length===2) {
      const first=record.attempts[0];
      const same=first.transcript.trim()===last.transcript.trim();
      body+=`<section class="answer-area"><h2>${same?'這次回答尚未修改':'看看這次的調整'}</h2><p>${same?'兩次內容相同，沒有文字修改可比較。':'先前的練習重點：'+escape(first.feedback.priorityImprovement.textZh || '此筆舊紀錄沒有中文說明。')}</p>${same?'':`<details open><summary>關鍵句前後對照</summary>${changedTextHtml(first.transcript,last.transcript)}</details>`}</section>`;
    }
    body+=`<section class="answer-area"><h2 id="feedback-heading" tabindex="-1">給這次回答的一點建議</h2>${playerHtml(last)}${feedbackHtml(last.feedback)}<div id="corrections" class="corrections-area" aria-live="polite"></div><details id="attempt-history"><summary>查看回答紀錄（${record.attempts.length} 個版本）</summary><label for="attempt-version">選擇回答版本</label><select id="attempt-version">${record.attempts.map((a,i)=>`<option value="${i}" ${i===record.attempts.length-1?'selected':''}>第 ${i+1} 次回答 · ${escape(dateLabel(a.submittedAt))}</option>`).join('')}</select><div id="attempt-detail"></div></details></section>`;
    if(complete && record.focusOrigin){const priority=last.feedback.priorityImprovement;body+=`<section class="answer-area focus-progress"><h2>這個重點練得如何？</h2><p class="meta">上次的練習重點</p><blockquote>${escape(record.focusOrigin.focusPoint)}</blockquote><p class="meta">這次回答的優先改進</p><blockquote>${escape(priority.textZh || priority.text || '－')}</blockquote>${priority.quote?`<p class="meta">依據你這次的原句</p><blockquote lang="en">${escape(priority.quote)}</blockquote>`:''}<p>對照上次的重點與這次的回饋，由你判斷這個重點是否已改善；系統不會替你宣稱進步。</p></section>`;}
    if(record.unsubmittedDraft)body+=`<details><summary>未送出的修改草稿（未評分）</summary><blockquote>${escape(record.unsubmittedDraft.transcript)}</blockquote></details>`;
    const focus=record.focusPoint || last.feedback.priorityImprovement.textZh || '請選擇一項下次想練習的重點。';
    const optional=`<div class="optional-actions">${complete?'':'<p class="optional-label">其他選擇</p>'}<div id="feedback-actions" class="button-row"></div><div id="rewrite-result" aria-live="polite"></div></div>`;
    const completion=complete
      ?`<div class="focus-box completed"><p class="eyebrow">下次可以接著練</p><p>${escape(focus)}</p><div id="completed-actions"></div></div>`
      :`<div class="focus-box"><p class="eyebrow">完成這次練習</p><label for="focus">下次練習重點（可以修改）</label><textarea id="focus" rows="2" maxlength="500">${escape(focus)}</textarea>${followUpFeedbackPending?'<p class="completion-lock" role="status">追問回答已保存；完成中文回饋後才能結束練習。</p>':'<button id="complete-practice" class="primary" type="button">結束並保存</button>'}</div>`;
    body+=`<section class="next-steps"><p class="eyebrow next-steps-title">接下來</p>${followUpHtml(record,complete)}${optional}${completion}</section>`;
  }
  $('#practice').innerHTML = practiceFrame({stage:last?.feedback?3:2,snapshot,content:body});
  readAloud($('#question-read-aloud'), {recordId:record.id}, '朗讀題目');
  if (currentFollowUp) readAloud($('#follow-up-read-aloud'), {recordId:record.id, followUpId:currentFollowUp.id}, '朗讀追問題目');
  // Corrections rendered inside the collapsed follow-up history are static markup, so
  // they need mounting here; the live panels mount through setupCorrections.
  document.querySelectorAll('[data-history-attempt]').forEach(area => mountCorrectionReadAloud(area, record.id, area.dataset.historyAttempt));
  if ($('#attempt-version')) {
    const renderAttempt = () => {
      const index=Number($('#attempt-version').value), attempt=record.attempts[index];
      $('#attempt-detail').innerHTML=`<h3>第 ${index+1} 次回答</h3><blockquote lang="en">${escape(attempt.transcript)}</blockquote>${playerHtml(attempt,{label:`回聽第 ${index+1} 次回答`})}${index<record.attempts.length-1?feedbackHtml(attempt.feedback):'<p class="meta">此版本的回饋已顯示在上方。</p>'}`;
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
      const start = button('讓面試官追問',()=>startFollowUp(record.id),followUpActions);
      start.disabled = !modelReady();
    } else if (!currentFollowUp.attempt) {
      const submissionId = crypto.randomUUID();
      const submit = button('送出並取得中文回饋',()=>submitFollowUp(record,currentFollowUp,submissionId),followUpActions,{id:'submit-follow-up'});
      submit.disabled = !modelReady();
      button('結束並保存',finish,followUpActions,{kind:'ghost'});
      mountFollowUpVoice(record, currentFollowUp);
      requestAnimationFrame(() => $('#follow-up-answer')?.focus({preventScroll:true}));
    } else if (!currentFollowUp.attempt.feedback) {
      const retry = button('重試取得中文回饋',()=>requestFollowUpFeedback(record.id,currentFollowUp.id),followUpActions);
      retry.disabled = !modelReady();
    } else {
      if (followUps.length < 2) {
        const next = button('繼續追問',()=>startFollowUp(record.id),followUpActions);
        next.disabled = !modelReady();
      }
      button('結束並保存',finish,followUpActions,{kind:followUps.length < 2?'secondary':'primary'});
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
    const switcher=document.createElement('div');switcher.className='button-row';$('#practice .practice-body').append(switcher);
    button('換一題',async()=>{if(!(await leaveEditor()))return;const analysis=await analysisView(record.snapshotId);const index=analysis.questions.findIndex(q=>q.id===record.question.id);await showQuestion(record.snapshotId,analysis.questions[(index+1)%analysis.questions.length].id,analysis);},switcher,{kind:'ghost',id:'next-question'});
    button('查看全部題目',()=>showQuestionList(record.snapshotId),switcher,{kind:'ghost',id:'view-all-questions'});
  } else if(last?.feedback) {
    if(!complete && !followUpFeedbackPending && record.attempts.length<2)button('自己再試一次',()=>showRecord(record.id,{editing:true}),$('#feedback-actions'));
    button('幫我講得更自然',()=>showCoaching(record,'rewrite',$('#rewrite-result')),$('#feedback-actions'),{kind:'secondary'});
    if(!complete) {
      if($('#complete-practice'))$('#complete-practice').addEventListener('click',async event=>{event.currentTarget.disabled=true;try{await finish();}catch(error){setError(error.message);if($('#complete-practice'))$('#complete-practice').disabled=false;}});
    } else {button('針對這個重點再練一次',()=>createFromFocus(record.id),$('#completed-actions'),{kind:'secondary',id:'practice-focus'});button('再練一題',()=>showRecommended(record.snapshotId),$('#completed-actions'));button('回到首頁',()=>navigate('home'),$('#completed-actions'),{kind:'ghost'});}
  }
  if (last?.feedback && $('#corrections')) setupCorrections(record, last.id, $('#corrections'), focusFeedback);
  if (currentFollowUp?.attempt?.feedback && $('#follow-up-corrections')) setupCorrections(record, currentFollowUp.attempt.id, $('#follow-up-corrections'), followUpFresh);
  if (focusFeedback) { const heading = $('#feedback-heading'); if (heading) requestAnimationFrame(() => { heading.scrollIntoView({behavior:'smooth', block:'start'}); heading.focus({preventScroll:true}); }); }
}

// Short Mock Session: three questions in a row, no coaching in between, one overall
// read at the end. It is not a Practice Loop and never produces a Focus Point.
let mockVoice = {draftId: null, dispose: () => {}};
function disposeMockVoice() { mockVoice.dispose(); mockVoice = {draftId: null, dispose: () => {}}; }

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
  const jobLine = snapshot ? `<div class="job-line"><span class="job-label">職缺：</span><span class="job-title">${escape(truncate(jobTitle(snapshot)))}</span></div>` : '';
  const host = $('#mock');
  if (session.status === 'in-progress') {
    const index = session.entries.findIndex(entry => entry.id === session.currentEntryId);
    const entry = session.entries[index];
    host.innerHTML = `<article class="practice-shell"><header class="practice-header"><p class="eyebrow">三題短場模擬</p><p class="mock-progress">第 ${session.currentPosition} / ${session.questionCount} 題</p></header>${jobLine}<div class="practice-body">
      <section class="question-phase"><p class="question-kicker">${escape(categories[entry.question.category] || entry.question.category)}</p><h1 class="question-text" lang="en">${escape(entry.question.text)}</h1><div id="question-read-aloud"></div><details open><summary>中文題意</summary><p class="meaning">${escape(entry.question.meaningZh || '舊版題目未保存中文題意。')}</p></details></section>
      <section class="answer-area"><p class="meta">模擬進行中不提供提示、示範或英文協助；整場結束後才會給回饋，也才能請教練幫忙。答不出來可以跳過，不會被當成錯誤答案。</p>
        <label for="mock-answer">你的回答</label><textarea id="mock-answer" rows="7" placeholder="像面試一樣，先把想說的講出來。">${escape(session.transcriptDraft?.entryId === entry.id ? session.transcriptDraft.transcript : '')}</textarea>
        <p id="mock-answer-status" class="draft-status" aria-live="polite">${session.transcriptDraft?.entryId === entry.id ? '已帶入這次的語音轉錄，可以直接送出，或先修改。' : '可以打字，也可以用語音回答。'}</p>
        <div id="mock-voice-entry"></div>
        <div class="button-row" id="mock-actions"></div>
      </section></div></article>`;
    readAloud($('#question-read-aloud'), {snapshotId: session.snapshotId, questionId: entry.question.id}, '朗讀題目');
    mountMockVoice(session, entry);
    const submissionId = crypto.randomUUID();
    button(session.currentPosition === session.questionCount ? '送出並結束這場模擬' : '送出，下一題', async () => {
      const transcript = $('#mock-answer').value;
      if (!transcript.trim()) { setError('請先寫下你的英文回答，或選擇跳過這一題。'); $('#mock-answer').focus(); return; }
      await api(`/mock-sessions/${session.id}/answer`, {entryId: entry.id, transcript, submissionId, ...(mockVoice.draftId ? {transcriptDraftId: mockVoice.draftId} : {})});
      await advanceMockSession(session.id);
    }, $('#mock-actions'), {id: 'mock-submit'});
    button('跳過這一題', async () => {
      if (!window.confirm('跳過這一題？這一題會記成「跳過」，不會有回饋，也不會被當成錯誤答案。')) return;
      await api(`/mock-sessions/${session.id}/skip`, {entryId: entry.id});
      await advanceMockSession(session.id);
    }, $('#mock-actions'), {kind: 'secondary', id: 'mock-skip'});
    button('先離開，稍後繼續', () => navigate('history'), $('#mock-actions'), {kind: 'ghost'});
    requestAnimationFrame(() => $('#mock-answer')?.focus({preventScroll: true}));
    return;
  }
  if (session.status === 'awaiting-summary') {
    host.innerHTML = `<article class="practice-shell"><header class="practice-header"><p class="eyebrow">三題短場模擬</p><p class="mock-progress">三題都完成了</p></header>${jobLine}<div class="practice-body">
      <section class="answer-area"><h1>正在整理整場回饋</h1><p>回答已保存在本機。這一步會用整場的回答產生一項優點與一項優先重點。</p><div class="button-row" id="mock-actions"></div></section></div></article>`;
    const run = async () => { await api(`/mock-sessions/${session.id}/summary`, {}); await showMockSession(session.id, {summaryFresh: true}); };
    button('取得整場回饋', run, $('#mock-actions'));
    button('先離開，稍後再看', () => navigate('history'), $('#mock-actions'), {kind: 'ghost'});
    if (summaryFresh) return;
    run().catch(error => setError(error.message));
    return;
  }
  renderMockSummary(session, jobLine);
}

function renderMockSummary(session, jobLine) {
  const nothing = session.summary?.nothingToAssess;
  const finding = (title, item, kind) => `<article class="feedback-card ${kind}"><h3>${escape(title)}</h3><p>${escape(item.textZh)}</p><blockquote><strong>你的原句</strong><br>${escape(item.quote)}</blockquote></article>`;
  const overall = nothing
    ? '<p class="provider-warning">這場模擬三題都跳過了，沒有可以評的內容。下一次挑一題先講三句也好。</p>'
    : `<div class="feedback-feature">${finding('整場做得好的地方', session.summary.strength, 'strength')}${finding('整場優先改進', session.summary.priorityImprovement, 'priority')}</div>`;
  const entries = session.entries.map((entry, index) => {
    const head = `<p class="eyebrow">第 ${index + 1} 題・${escape(categories[entry.question.category] || entry.question.category)}</p><h3 lang="en">${escape(entry.question.text)}</h3>`;
    if (entry.skipped) return `<article class="list-card mock-entry"><span class="mock-skipped">已跳過</span>${head}<p class="meta">這一題你選擇跳過，沒有回答，因此沒有評分。</p></article>`;
    return `<article class="list-card mock-entry" data-entry-id="${escape(entry.id)}">${head}<details><summary>查看你的回答</summary><blockquote lang="en">${escape(entry.answer.transcript)}</blockquote>${playerHtml(entry.answer, {label: '回聽這一題的錄音'})}</details><div class="mock-entry-feedback" aria-live="polite"></div></article>`;
  }).join('');
  $('#mock').innerHTML = `<article class="practice-shell"><header class="practice-header"><p class="eyebrow">三題短場模擬</p><p class="mock-progress">已完成 · ${escape(dateLabel(session.completedAt))}</p></header>${jobLine}<div class="practice-body">
    <section class="answer-area"><h1 id="mock-summary-heading" tabindex="-1">整場回饋</h1><p class="meta">這是整場的一項優點與一項優先重點，不是分數，也不是錄取判斷。逐題回饋要看再展開。</p>${overall}</section>
    <section class="answer-area"><h2>逐題</h2>${entries}</section>
    <div class="button-row" id="mock-summary-actions"></div></div></article>`;
  document.querySelectorAll('.mock-entry[data-entry-id]').forEach(card => {
    const panel = card.querySelector('.mock-entry-feedback');
    const entryId = card.dataset.entryId;
    const entry = session.entries.find(item => item.id === entryId);
    if (entry.feedback) { panel.innerHTML = feedbackHtml(entry.feedback); return; }
    button('看這一題的回饋', async () => {
      panel.innerHTML = '<p class="meta">正在整理這一題的回饋…</p>';
      try { const updated = await api(`/mock-sessions/${session.id}/entries/${entryId}/feedback`, {}); panel.innerHTML = feedbackHtml(updated.feedback); }
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
  mockVoice.dispose = mountVoice(host, {
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
function renderJobDetail(container, snapshot) {
  const records = sortRecent(Object.values(workspace.records || {}).filter(r => r.snapshotId === snapshot.id));
  const sessions = sortRecent(Object.values(workspace.mockSessions || {}).filter(s => s.snapshotId === snapshot.id));
  container.replaceChildren();
  for (const session of sessions) {
    const done = session.status === 'completed';
    const answered = session.entries.filter(entry => entry.answer).length;
    const card = document.createElement('article'); card.className = 'list-card record-card mock-card'; card.dataset.sessionId = session.id;
    card.innerHTML = `<p class="eyebrow">三題短場模擬 · ${done ? '已完成' : '進行中'}</p><p class="meta">${escape(dateLabel(session.completedAt || session.updatedAt || session.createdAt))} · 已作答 ${answered} / ${session.entries.length} 題${session.entries.some(entry => entry.skipped) ? ' · 有跳過的題目' : ''}</p><div class="button-row"></div>`;
    const actions = card.querySelector('.button-row');
    button(done ? '查看整場回饋' : '繼續這場模擬', () => showMockSession(session.id), actions, {kind: 'secondary'});
    const menu = document.createElement('details'); menu.className = 'more-menu';
    menu.innerHTML = '<summary aria-label="更多動作">⋯</summary><div class="more-panel"></div>';
    button(done ? '刪除這場模擬' : '放棄這場模擬', () => abandonMockSession(session.id), menu.querySelector('.more-panel'), {kind: 'danger'});
    actions.append(menu);
    container.append(card);
  }
  if (!records.length) { container.insertAdjacentHTML('beforeend', '<p class="empty">這份職缺還沒有單題練習紀錄，可以從上方開始新練習。</p>'); return; }
  for (const record of records) {
    const followUps = Array.isArray(record.followUps) ? record.followUps : [];
    const card = document.createElement('article'); card.className = 'list-card record-card'; card.dataset.recordId = record.id;
    const origin = record.focusOrigin ? ` · 延續重點：${escape(record.focusOrigin.focusPoint)}` : '';
    const followUpNote = followUps.length ? ` · ${followUps.length} 則追問` : '';
    card.innerHTML = `<p class="eyebrow">${escape(recordStates[record.status] || record.status)}</p><h4 lang="en">${escape(record.question.text)}</h4><p class="meta">${escape(dateLabel(record.updatedAt || record.createdAt))}${followUpNote}${origin}</p><div class="button-row"></div>`;
    const actions = card.querySelector('.button-row');
    button(record.status === 'completed' ? '查看紀錄' : '繼續練習', () => showRecord(record.id), actions, {kind:'secondary'});
    const menu = document.createElement('details'); menu.className = 'more-menu';
    menu.innerHTML = '<summary aria-label="更多動作">⋯</summary><div class="more-panel"></div>';
    button('刪除這筆練習', () => deleteRecord(record.id), menu.querySelector('.more-panel'), {kind:'danger'});
    actions.append(menu);
    container.append(card);
  }
}
function renderHistory() {
  const host = $('#history'); if (!host) return; host.replaceChildren();
  const snapshots = Object.values(workspace.snapshots || {});
  const allRecords = Object.values(workspace.records || {});
  if (!snapshots.length) { host.innerHTML = '<p class="empty">還沒有練習紀錄。從首頁貼一份職缺就能開始。</p>'; return; }

  const unfinished = sortRecent(allRecords.filter(r => r.status !== 'completed'))[0];
  if (unfinished) {
    const snapshot = workspace.snapshots[unfinished.snapshotId];
    const card = document.createElement('article'); card.className = 'list-card continue-card';
    card.innerHTML = `<p class="eyebrow">繼續上次練習</p><h3>${escape(jobTitle(snapshot))}</h3><p class="meta">${escape(recordStates[unfinished.status] || unfinished.status)} · ${escape(unfinished.question.text)}</p><div class="button-row"></div>`;
    button('繼續練習', () => showRecord(unfinished.id), card.querySelector('.button-row'), {kind:'primary'});
    host.append(card);
  }

  const controls = document.createElement('div'); controls.className = 'history-controls';
  controls.innerHTML = `<label for="job-search" class="visually-hidden">搜尋職缺</label><input id="job-search" type="search" placeholder="搜尋職缺名稱或內容" value="${escape(historyState.query)}"><label for="job-filter" class="visually-hidden">篩選</label><select id="job-filter"><option value="all">全部職缺</option><option value="active">有進行中的練習</option><option value="completed">已有完成練習</option></select>`;
  host.append(controls);
  const search = controls.querySelector('#job-search');
  search.addEventListener('input', () => { historyState.query = search.value; historyState.page = 0; renderHistory(); const again = $('#job-search'); if (again) { again.focus(); const end = again.value.length; again.setSelectionRange(end, end); } });
  const filter = controls.querySelector('#job-filter'); filter.value = historyState.filter;
  filter.addEventListener('change', () => { historyState.filter = filter.value; historyState.page = 0; renderHistory(); });

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

  const list = document.createElement('div'); list.className = 'job-list'; host.append(list);
  if (!filtered.length) { list.innerHTML = '<p class="empty">沒有符合的職缺。調整搜尋或篩選條件。</p>'; return; }
  const pageCount = Math.max(1, Math.ceil(filtered.length / JOBS_PER_PAGE));
  historyState.page = Math.min(Math.max(historyState.page, 0), pageCount - 1);
  const pageJobs = filtered.slice(historyState.page * JOBS_PER_PAGE, (historyState.page + 1) * JOBS_PER_PAGE);

  for (const job of pageJobs) {
    const snapshot = job.snapshot;
    const open = historyState.openJob === snapshot.id;
    const renaming = historyState.renaming === snapshot.id;
    const card = document.createElement('article'); card.className = 'list-card job-card'; card.dataset.jobId = snapshot.id;
    card.innerHTML = `<div class="job-head"></div><div class="button-row job-actions"></div>${open ? '<div class="job-detail"></div>' : ''}`;
    const head = card.querySelector('.job-head');
    if (renaming) {
      head.innerHTML = `<label for="rename-input" class="visually-hidden">職缺名稱</label><input id="rename-input" maxlength="120" value="${escape(job.title)}"><div class="button-row rename-actions"></div>`;
      const input = head.querySelector('#rename-input');
      button('儲存名稱', async () => { await api(`/snapshots/${snapshot.id}/title`, {title: input.value}); historyState.renaming = null; await refreshWorkspace(); renderHistory(); setNotice('職缺名稱已更新。'); }, head.querySelector('.rename-actions'), {kind:'secondary'});
      button('取消', () => { historyState.renaming = null; renderHistory(); }, head.querySelector('.rename-actions'), {kind:'ghost'});
    } else {
      head.innerHTML = `<h3>${escape(job.title)}</h3><p class="meta">最近活動 ${escape(dateLabel(job.activity))} · 已完成 ${job.completed} 次主練習${job.completedSessions ? ` · ${job.completedSessions} 場模擬` : ''}${job.hasUnfinished ? ' · 有進行中的練習' : ''}</p>`;
    }
    const actions = card.querySelector('.job-actions');
    button(workspace.analyses[snapshot.id] ? '開始新練習' : '產生題目', () => startJob(snapshot.id), actions, {kind:'primary'});
    if (workspace.analyses[snapshot.id]) {
      const running = job.sessions.find(session => session.status !== 'completed');
      button(running ? '繼續三題模擬' : '三題短場模擬', () => running ? showMockSession(running.id) : startMockSession(snapshot.id), actions, {kind:'secondary', id:`mock-${snapshot.id}`});
    }
    const items = job.records.length + job.sessions.length;
    if (items) button(open ? '收合練習' : `查看練習（${items}）`, () => { historyState.openJob = open ? null : snapshot.id; renderHistory(); }, actions, {kind:'secondary', attributes:{'aria-expanded': String(open)}});
    const menu = document.createElement('details'); menu.className = 'more-menu'; menu.innerHTML = '<summary aria-label="更多動作">⋯</summary><div class="more-panel"></div>';
    const panel = menu.querySelector('.more-panel');
    button('重新命名', () => { historyState.renaming = snapshot.id; renderHistory(); requestAnimationFrame(() => $('#rename-input')?.focus()); }, panel, {kind:'ghost'});
    button('刪除職缺', () => deleteJob(snapshot.id), panel, {kind:'danger'});
    actions.append(menu);
    if (open) renderJobDetail(card.querySelector('.job-detail'), snapshot);
    list.append(card);
  }

  if (pageCount > 1) {
    const pager = document.createElement('div'); pager.className = 'button-row pager';
    button('上一頁', () => { historyState.page -= 1; renderHistory(); }, pager, {kind:'ghost'}).disabled = historyState.page === 0;
    const label = document.createElement('span'); label.className = 'meta'; label.textContent = `第 ${historyState.page + 1} / ${pageCount} 頁`; pager.append(label);
    button('下一頁', () => { historyState.page += 1; renderHistory(); }, pager, {kind:'ghost'}).disabled = historyState.page >= pageCount - 1;
    host.append(pager);
  }
}

async function renderProgress() {
  const records=sortRecent(Object.values(workspace.records).filter(r=>r.status==='completed'));
  $('#progress').innerHTML=records.length?records.map(r=>`<article class="list-card"><p>${escape(r.focusPoint)}</p><p class="meta">${escape(dateLabel(r.completedAt))}</p></article>`).join(''):'<p>完成一次練習後，這裡會留下你的下一步。</p>';
}

async function renderEvidence({clearText=false}={}) {
  const token=viewToken;
  const parent=$('#evidence');
  parent.textContent='正在讀取履歷…';
  const resume=await api('/resume');
  if(viewToken!==token)return;
  parent.innerHTML=`<section class="settings-section"><h2>${resume?'目前使用的履歷':'讓問題更貼近你'}</h2><p>上傳一次，之後貼 JD 就會預設搭配這份履歷出題。</p><label class="field-label">上傳 PDF、DOCX 或 TXT（最多 5 MB）</label><div class="file-field"><label class="file-button" for="resume-file">選擇檔案</label><input type="file" id="resume-file" accept=".pdf,.docx,.txt" class="visually-hidden"><span id="resume-filename" class="file-name">尚未選擇檔案</span></div><p id="resume-extract-status" role="status"></p><label for="resume-name">檔名</label><input id="resume-name" value="${escape(resume?.name || '我的履歷')}"><label for="resume-text">履歷內容，可直接貼上或修正辨識結果</label><textarea id="resume-text" rows="14">${escape(resume?.text || '')}</textarea><p class="meta">保存在本機；搭配 JD 產題時才會傳送文字給模型。替換履歷不會改動舊練習。</p><div id="resume-actions"></div></section>`;
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

async function renderDiscovery() {
  const parent = $('#discovery'); parent.replaceChildren();
  const profile = await api('/job-search-profile');
  const form = document.createElement('section'); form.className = 'settings-section';
  // Describe it in your own words; the product proposes criteria and you confirm them.
  form.innerHTML = `<h2>用一句話說你想找什麼</h2><label for="search-request">例如：根據我的履歷，幫我找台灣適合轉職的 AI 職缺，最好能遠端</label>
    <textarea id="search-request" rows="3" placeholder="用中文或英文都可以。"></textarea>
    <p class="data-note" id="interpret-disclosure"></p>
    <div class="button-row" id="interpret-actions"></div>
    <div id="interpret-result" aria-live="polite"></div>
    <hr>
    <h2>搜尋條件</h2>
    <p>這些是實際會用來搜尋的條件，你可以直接修改。搜尋只會在你按下按鈕時進行，履歷不會送到職缺板。</p>`;
  const labels = searchFieldLabels;
  for (const [field,text] of Object.entries(labels)) form.insertAdjacentHTML('beforeend', `<label for="profile-${field}">${escape(text)}（以逗號分隔）</label><input id="profile-${field}" value="${escape((profile[field] || []).join(', '))}">`);
  const save = () => api('/job-search-profile', Object.fromEntries(Object.keys(labels).map(field => [field,$(`#profile-${field}`).value.split(',').map(value => value.trim()).filter(Boolean)])));
  button('儲存搜尋條件', save, form, {kind:'secondary'});
  const results = document.createElement('div'); results.id = 'discovery-results';
  button('搜尋公開職缺', async () => {
    await save(); const run = await api('/discovery', {}); results.replaceChildren();
    if (!run.results.length) results.innerHTML = '<p class="empty">沒有符合結果。調整條件，或回首頁直接貼上職缺描述。</p>';
    for (const job of run.results) {
      const card = document.createElement('article'); card.className = 'list-card'; card.innerHTML = `<h3>${escape(job.title)}</h3><p>${escape(job.location)} · ${escape(job.source)}</p><p class="meta">${escape(job.reasons.join('；'))}</p><details><summary>查看取得的職缺內容</summary><blockquote>${escape(job.text)}</blockquote></details><div class="button-row"></div>`;
      button('保存並產生題目', async () => { const snapshot = await api(`/discovery/${run.id}/select`, {resultId:job.id}); await refreshWorkspace(); await api(`/snapshots/${snapshot.id}/analysis`, {}); await refreshWorkspace(); await showRecommended(snapshot.id); }, card.querySelector('.button-row'));
      results.append(card);
    }
  }, form);
  form.insertAdjacentHTML('beforeend', '<hr><label for="job-url">支援的 Greenhouse 職缺網址</label><input id="job-url" type="url" placeholder="https://job-boards.greenhouse.io/…">');
  button('取得並保存職缺', async () => { const snapshot = await api('/snapshots/from-url', {url:$('#job-url').value}); await refreshWorkspace(); await api(`/snapshots/${snapshot.id}/analysis`, {}); await refreshWorkspace(); await showRecommended(snapshot.id); }, form, {kind:'secondary'});
  parent.append(form, results);

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
      panel.innerHTML = `<div class="provider-warning"><strong>我理解成這些條件</strong>
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
  const names = {languageModel:'題目與回饋',speech:'語音轉錄與朗讀',jobSource:'公開職缺來源'};
  for (const [role,info] of Object.entries(providerInfo || {})) {
    const row = document.createElement('div'); row.className = 'provider-row';
    const access = !info.external ? '' : info.subscription ? '透過你的官方訂閱登入使用；用量依方案計算，不需在本機保存 API 金鑰。' : role === 'jobSource' ? '只讀取你指定的公開職缺板；不需金鑰，也不送出個人資料。' : '使用你在啟動時設定的 API 金鑰；金鑰只從伺服器環境讀取，不會存進本機資料、也不會出現在瀏覽器或畫面上。呼叫可能依供應商方案產生費用。';
    const speechNote = role !== 'speech' ? '' : info.demonstrationSpeech ? '目前的朗讀是本機示意音，不是真人語音。' : info.canSpeak ? '英文題目、示範回答與關鍵句修正可以朗讀；中文說明不會朗讀。' : '這個服務不支援朗讀，畫面上不會出現朗讀按鈕。';
    row.innerHTML = `<h3>${escape(names[role] || role)}</h3><p>${escape(providerName(info))}</p><p class="meta">${info.external ? `可能送出：${escape(info.outbound.map(outboundLabel).join('；'))}` : '本機示範服務，不傳送資料到外部。'}</p>${speechNote ? `<p class="meta">${escape(speechNote)}</p>` : ''}${access ? `<p class="meta">${access}</p>` : ''}`;
    parent.append(row);
  }
  if (providerInfo?.languageModel?.subscription) {
    const status = document.createElement('div'); status.className = `provider-warning`; status.innerHTML = `<strong>${languageStatus.ready ? 'Codex 訂閱服務已可使用' : languageStatus.authenticated ? '已登入，尚未完成本機驗證' : '尚未完成 Codex 登入'}</strong><p>${languageStatus.ready ? '文字題目與回饋會使用你的方案用量。' : '請在專案終端依 README 完成登入與驗證，再回來檢查。已寫的本機草稿不受影響。'}</p>`;
    button('重新檢查狀態', async () => { languageStatus = await api('/providers/language-status'); renderSettings(); }, status, {kind:'secondary'});
    parent.append(status);
  }
  const deletion = $('#delete-workspace'); deletion.replaceChildren();
  deletion.innerHTML = `<p class="meta" id="recording-storage">${escape(recordingBytesLabel())}</p><p>這會刪除所有職缺、題目、練習紀錄、文字草稿、回答錄音與進步項目。若要繼續，請輸入 <strong>DELETE ALL LOCAL DATA</strong>。</p><label for="delete-all">確認文字</label><input id="delete-all" autocomplete="off">`;
  button('刪除全部本機資料', async () => {
    await api('/workspace/delete', {confirmation:$('#delete-all').value}); clearDraftSession(); disposeVoice(); followUpVoice.dispose(); followUpVoice.dispose = () => {}; followUpVoice.draftId = null; resetReadAloud(); await refreshWorkspace(); setNotice('所有本機資料已刪除。'); await navigate('home');
  }, deletion, {kind:'danger'});
}

async function showOperations() {
  const parent = $('#operations');
  const operations = await api('/operations');
  const visible = [...operations.filter(operation => operation.state === 'pending'), ...operations.filter(operation => ['failed','cancelled'].includes(operation.state)).slice(-2)];
  const signature = JSON.stringify(visible.map(operation => [operation.id,operation.kind,operation.state,operation.retryable,operation.errorCode]));
  if (signature === operationsSignature) return;
  operationsSignature = signature;
  parent.replaceChildren();
  for (const operation of visible) {
    const row = document.createElement('div'); row.className = 'operation-card';
    const state = {pending:'進行中',succeeded:'已完成',failed:'失敗',cancelled:'已取消'}[operation.state] || operation.state;
    row.innerHTML = `<p><strong>${escape(operationNames[operation.kind] || operation.kind)}</strong> · ${escape(state)}${operation.retryable ? ' · 可從原操作重試' : ''}</p>`;
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
    $('#provider').textContent = `${providerName(providerInfo.languageModel)} · ${providerInfo.speech.external ? '語音已配置' : '文字練習'}`;
    await refreshWorkspace();
    renderSettings();
    renderHome();
    await showOperations();
  } catch (error) { setError(`無法開啟工作區：${error.message}`); }
}

await initialize();
