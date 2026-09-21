// Read-aloud playback. One reading plays at a time, the chosen speed follows the
// learner across controls, and nothing ever starts without a click.
const speedLabels = {slow: '慢速', normal: '正常', fast: '快速'};
let readAloudSpeed = 'normal';
let playing = null;
const mountedReadAloud = new Set();

export function stopReadAloud() {
  if (!playing) return;
  const audio = playing;
  playing = null;
  audio.pause();
  audio.currentTime = 0;
}
export function resetReadAloud() {
  stopReadAloud();
  for (const dispose of [...mountedReadAloud]) dispose();
}

export function mountReadAloud(parent, reference, {api, provider, label = '朗讀英文', onError} = {}) {
  if (!parent || !provider?.canSpeak) return () => {};
  const box = document.createElement('div');
  box.className = 'read-aloud';
  const play = document.createElement('button'); play.type = 'button'; play.className = 'ghost read-aloud-play'; play.textContent = label;
  const replay = document.createElement('button'); replay.type = 'button'; replay.className = 'ghost read-aloud-replay'; replay.textContent = '重播'; replay.hidden = true;
  const speed = document.createElement('select'); speed.className = 'read-aloud-speed'; speed.setAttribute('aria-label', '朗讀速度');
  for (const [value, text] of Object.entries(speedLabels)) { const option = document.createElement('option'); option.value = value; option.textContent = text; speed.append(option); }
  speed.value = readAloudSpeed;
  const status = document.createElement('span'); status.className = 'meta read-aloud-status'; status.setAttribute('role', 'status');
  box.append(play, replay, speed, status);
  if (provider.demonstrationSpeech) { const note = document.createElement('span'); note.className = 'meta'; note.textContent = '目前是本機示範服務，只會播放示意音，不是真人朗讀。'; box.append(note); }
  parent.append(box);

  const cache = new Map();
  let audio = null, disposed = false, loading = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    mountedReadAloud.delete(dispose);
    if (audio && playing === audio) stopReadAloud();
    for (const url of cache.values()) URL.revokeObjectURL(url);
    cache.clear();
    box.remove();
  };
  mountedReadAloud.add(dispose);

  const idle = () => { play.textContent = label; play.disabled = loading; replay.disabled = loading; };
  async function sourceFor(choice) {
    if (cache.has(choice)) return cache.get(choice);
    const result = await api('/speech', {...reference, speed: choice});
    const bytes = Uint8Array.from(atob(result.audio), character => character.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], {type: result.mimeType}));
    // A concurrent fetch for the same speed would otherwise leak the loser's URL.
    if (cache.has(choice)) { URL.revokeObjectURL(url); return cache.get(choice); }
    cache.set(choice, url);
    return url;
  }
  // `loading` is the single reentrancy guard: every control that could start a second
  // playback consults it, so two readings can never overlap.
  async function start() {
    if (loading) return;
    if (audio && playing === audio) { stopReadAloud(); idle(); status.textContent = ''; return; }
    stopReadAloud();
    loading = true;
    play.disabled = true;
    replay.disabled = true;
    status.textContent = '正在準備朗讀…';
    try {
      const url = await sourceFor(speed.value);
      if (disposed) return;
      audio = new Audio(url);
      audio.onended = () => { if (playing === audio) playing = null; idle(); status.textContent = ''; };
      playing = audio;
      play.textContent = '停止';
      replay.hidden = false;
      status.textContent = '正在朗讀…';
      await audio.play();
    } catch (error) {
      if (disposed) return;
      if (playing === audio) playing = null;
      status.textContent = '朗讀失敗，可再試一次。';
      onError?.(error);
    } finally {
      loading = false;
      if (!disposed && !(audio && playing === audio)) idle();
      else if (!disposed) { play.disabled = false; replay.disabled = false; }
    }
  }
  play.addEventListener('click', () => { start(); });
  replay.addEventListener('click', () => { if (!loading) { stopReadAloud(); start(); } });
  speed.addEventListener('change', () => {
    readAloudSpeed = speed.value;
    // Only this control's own playback is affected; another control keeps playing.
    if (audio && playing === audio) stopReadAloud();
    if (!loading) { idle(); status.textContent = ''; }
  });
  return dispose;
}

// A recording that has been captured but not yet submitted lives only in this page.
// The count lets the page warn before a reload throws it away.
let pendingRecordings = 0;
export function hasPendingRecording() { return pendingRecordings > 0; }
const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

// Audio remains in memory only while recording or awaiting a retry.
export function mountVoice(parent, {recordId, path, api, provider, beforeTranscription, onTranscript, onTranscriptionEnd, onError}) {
  const limit = provider?.recordingLimitSeconds || 180;
  const warnAt = Math.max(5, limit - (provider?.recordingWarningSeconds || 30));
  const maxBytes = provider?.recordingMaxBytes || 10_000_000;
  const endpoint = path || `/records/${recordId}/transcription`;
  const panel = document.createElement('section');
  panel.className = 'voice-panel';
  const service = provider?.external ? `音訊會傳送給 ${provider.name}，服務端保存方式依你的帳號設定而定` : '目前使用本機示範服務，不會把音訊傳送到外部，也不會真的辨識你說的話';
  panel.innerHTML = `<h3>用語音回答</h3><p class="meta">最多錄音 ${Math.round(limit / 60)} 分鐘，到時會自動停止並轉成文字，已錄的內容不會丟掉。${service}。轉錄完成後文字會放進上面的回答框，你可以直接送出，需要時再修改或重錄。回饋只看你說的內容與英文表達，不評發音或口音。</p><p class="meta">尚未送出的錄音只留在這個頁面，重新整理會失去；轉錄出來的文字會自動存成本機草稿。</p>`;
  parent.append(panel);
  let stream, recorder, audio, limitTimer, tick, disposed = false, recordingFailed = false, held = false, chunks = [];
  const elapsed = document.createElement('p'); elapsed.className = 'recording-clock'; elapsed.hidden = true;
  const status = document.createElement('p'); status.className = 'meta'; status.setAttribute('role', 'status');
  const start = document.createElement('button'); start.textContent = '開始錄音'; start.className = 'secondary';
  const stop = document.createElement('button'); stop.textContent = '停止並轉成文字'; stop.className = 'secondary'; stop.disabled = true;
  const retry = document.createElement('button'); retry.textContent = '重試語音轉錄'; retry.className = 'secondary'; retry.hidden = true;
  const discard = document.createElement('button'); discard.textContent = '捨棄錄音，改用文字'; discard.className = 'ghost';
  panel.append(start, stop, retry, discard, elapsed, status);
  const holdAudio = value => { if (value && !held) { held = true; pendingRecordings += 1; } else if (!value && held) { held = false; pendingRecordings -= 1; } audio = value; };
  function release() { clearTimeout(limitTimer); clearInterval(tick); tick = null; elapsed.hidden = true; stream?.getTracks().forEach(track => track.stop()); stream = null; }
  async function transcribe() {
    if (!audio || disposed) return;
    start.disabled = true; retry.disabled = true; status.textContent = '正在轉成文字…';
    try {
      await beforeTranscription?.();
      const bytes = new Uint8Array(await audio.arrayBuffer());
      if (bytes.length > maxBytes) throw Error(`錄音超過 ${Math.round(maxBytes / 1_000_000)} MB，請縮短回答或改用文字。`);
      let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
      const draft = await api(endpoint, {audio: btoa(binary), mimeType: audio.type.split(';')[0]});
      holdAudio(null); chunks = []; retry.hidden = true; status.textContent = '已轉成文字，請看上面的回答框。';
      if (!disposed) await onTranscript(draft, panel);
    } catch (e) { if (!disposed) {status.textContent = '語音轉錄失敗。錄音還在，你可以重試、重新錄音或改用文字。'; retry.hidden = false; onError(e);} }
    finally { if (!disposed) await onTranscriptionEnd?.(); start.disabled = false; retry.disabled = false; }
  }
  start.onclick = async () => {
    try {
      stopReadAloud();
      if (audio && !window.confirm('重新錄音會蓋掉目前這段還沒送出的錄音，確定要重錄嗎？')) return;
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw Error('這個瀏覽器無法錄音，請改用文字回答。');
      start.disabled = true; recordingFailed = false; holdAudio(null); chunks = []; retry.hidden = true;
      stream = await navigator.mediaDevices.getUserMedia({audio: true});
      if (disposed) {release();return;}
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(type => MediaRecorder.isTypeSupported(type));
      recorder = new MediaRecorder(stream, mimeType ? {mimeType} : undefined);
      recorder.ondataavailable = e => { if (!disposed && e.data.size) chunks.push(e.data); };
      recorder.onerror = () => {recordingFailed=true;release();start.disabled=false;stop.disabled=true;chunks=[];status.textContent='';onError(Error('錄音失敗，請重新錄音或改用文字。'));};
      recorder.onstop = async () => {
        release(); stop.disabled = true; start.disabled = false;
        if (disposed || recordingFailed) return;
        const captured = new Blob(chunks, {type: recorder.mimeType}); chunks = [];
        if (!captured.size) { status.textContent = '這次沒有錄到聲音，請再錄一次或改用文字。'; onError(Error('這次沒有錄到聲音，請確認麥克風後再試，或改用文字。')); return; }
        holdAudio(captured);
        await transcribe();
      };
      recorder.start(); start.disabled = true; stop.disabled = false; status.textContent = '正在錄音…';
      const startedAt = Date.now();
      elapsed.hidden = false; elapsed.textContent = `已錄 0:00 / ${clock(limit)}`;
      tick = setInterval(() => {
        const seconds = Math.min(limit, (Date.now() - startedAt) / 1000);
        elapsed.textContent = `已錄 ${clock(seconds)} / ${clock(limit)}`;
        const near = seconds >= warnAt;
        elapsed.classList.toggle('near-limit', near);
        if (near) elapsed.textContent += `　快到上限了，請開始收尾（剩下約 ${Math.max(0, Math.round(limit - seconds))} 秒）`;
      }, 250);
      limitTimer = setTimeout(() => {if (recorder.state === 'recording') {status.textContent = `已達 ${Math.round(limit / 60)} 分鐘上限，正在把已錄的內容轉成文字。`; recorder.stop();}}, limit * 1000);
    } catch (e) {release();start.disabled=false;onError(e);}
  };
  stop.onclick = () => {if (recorder?.state === 'recording') recorder.stop();};
  retry.onclick = transcribe;
  discard.onclick = async () => {disposed=true;if(recorder?.state==='recording')recorder.stop();release();holdAudio(null);chunks=[];await onTranscriptionEnd?.();panel.remove();};
  return () => {disposed=true;if(recorder?.state==='recording')recorder.stop();release();holdAudio(null);chunks=[];};
}
