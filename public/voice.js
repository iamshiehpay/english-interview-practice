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
  let audio = null, disposed = false;
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

  const idle = () => { play.textContent = label; play.disabled = false; };
  async function sourceFor(choice) {
    if (cache.has(choice)) return cache.get(choice);
    const result = await api('/speech', {...reference, speed: choice});
    const bytes = Uint8Array.from(atob(result.audio), character => character.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], {type: result.mimeType}));
    cache.set(choice, url);
    return url;
  }
  async function start() {
    if (playing === audio && audio) { stopReadAloud(); idle(); status.textContent = ''; return; }
    stopReadAloud();
    play.disabled = true;
    status.textContent = '正在準備朗讀…';
    try {
      const url = await sourceFor(speed.value);
      if (disposed) return;
      audio = new Audio(url);
      audio.onended = () => { if (playing === audio) playing = null; idle(); status.textContent = ''; };
      playing = audio;
      play.textContent = '停止';
      play.disabled = false;
      replay.hidden = false;
      status.textContent = '正在朗讀…';
      await audio.play();
    } catch (error) {
      if (disposed) return;
      if (playing === audio) playing = null;
      idle();
      status.textContent = '朗讀失敗，可再試一次。';
      onError?.(error);
    }
  }
  play.addEventListener('click', () => { start(); });
  replay.addEventListener('click', () => { stopReadAloud(); start(); });
  speed.addEventListener('change', () => { readAloudSpeed = speed.value; stopReadAloud(); idle(); status.textContent = ''; });
  return dispose;
}

// Audio remains in memory only while recording or awaiting a retry.
export function mountVoice(parent, {recordId, api, provider, beforeTranscription, onTranscript, onTranscriptionEnd, onError}) {
  const panel = document.createElement('section');
  panel.innerHTML = '<h3>用語音回答</h3><p class="meta">最多錄音 90 秒。語音會傳送給已配置的轉錄服務；請先檢查並修改轉錄文字，再送出正式回答。本機暫存音檔會在轉錄後刪除。</p>';
  if(provider?.external){const note=panel.querySelector('p');note.textContent=`最多錄音 90 秒。音訊會傳送給 ${provider.name}；請先檢查並修改轉錄文字，再送出正式回答。本機暫存音檔會在轉錄後刪除，服務端保存方式依你的帳號設定而定。`;}
  parent.append(panel);
  let stream, recorder, audio, timer, disposed = false, recordingFailed = false, chunks = [];
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  const start = document.createElement('button'); start.textContent = '開始錄音'; start.className = 'secondary';
  const stop = document.createElement('button'); stop.textContent = '停止並轉成文字'; stop.className = 'secondary'; stop.disabled = true;
  const retry = document.createElement('button'); retry.textContent = '重試語音轉錄'; retry.className = 'secondary'; retry.hidden = true;
  const discard = document.createElement('button'); discard.textContent = '捨棄錄音，改用文字'; discard.className = 'ghost';
  panel.append(start, stop, retry, discard, status);
  function release() { clearTimeout(timer); stream?.getTracks().forEach(track => track.stop()); stream = null; }
  async function transcribe() {
    if (!audio || disposed) return;
    start.disabled = true; retry.disabled = true; status.textContent = '正在轉成文字…';
    try {
      await beforeTranscription?.();
      const bytes = new Uint8Array(await audio.arrayBuffer());
      if (bytes.length > 6_000_000) throw Error('錄音超過 6 MB，請縮短回答或改用文字。');
      let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
      const draft = await api(`/records/${recordId}/transcription`, {audio: btoa(binary), mimeType: audio.type.split(';')[0]});
      audio = null; chunks = []; retry.hidden = true;
      if (!disposed) await onTranscript(draft, panel);
    } catch (e) { if (!disposed) {status.textContent = '語音轉錄失敗。你可以重試、重新錄音或改用文字。'; retry.hidden = false; onError(e);} }
    finally { if (!disposed) await onTranscriptionEnd?.(); start.disabled = false; retry.disabled = false; }
  }
  start.onclick = async () => {
    try {
      stopReadAloud();
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw Error('這個瀏覽器無法錄音，請改用文字回答。');
      start.disabled = true; recordingFailed = false; audio = null; chunks = []; retry.hidden = true;
      stream = await navigator.mediaDevices.getUserMedia({audio: true});
      if (disposed) {release();return;}
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(type => MediaRecorder.isTypeSupported(type));
      recorder = new MediaRecorder(stream, mimeType ? {mimeType} : undefined);
      recorder.ondataavailable = e => { if (!disposed && e.data.size) chunks.push(e.data); };
      recorder.onerror = () => {recordingFailed=true;release();start.disabled=false;stop.disabled=true;chunks=[];onError(Error('錄音失敗，請重新錄音或改用文字。'));};
      recorder.onstop = async () => {
        release(); stop.disabled = true; start.disabled = false;
        if (disposed || recordingFailed) return;
        audio = new Blob(chunks, {type: recorder.mimeType}); chunks = [];
        await transcribe();
      };
      recorder.start(); start.disabled = true; stop.disabled = false; status.textContent = '正在錄音…';
      timer = setTimeout(() => {if (recorder.state === 'recording') recorder.stop();}, 90000);
    } catch (e) {release();start.disabled=false;onError(e);}
  };
  stop.onclick = () => {if (recorder?.state === 'recording') recorder.stop();};
  retry.onclick = transcribe;
  discard.onclick = async () => {disposed=true;if(recorder?.state==='recording')recorder.stop();release();audio=null;chunks=[];await onTranscriptionEnd?.();panel.remove();};
  return () => {disposed=true;if(recorder?.state==='recording')recorder.stop();release();audio=null;chunks=[];};
}
