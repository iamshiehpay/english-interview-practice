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

// Listening mode: a display preference, not practice data, so it lives in this
// browser only. Storage can be refused or cleared, in which case the mode is simply
// off and everything else still works.
const LISTENING_KEY = 'coach.listeningMode';
let listeningMode = (() => { try { return localStorage.getItem(LISTENING_KEY) === 'on'; } catch { return false; } })();
const listeningListeners = new Set();
function setListeningMode(on) {
  listeningMode = on;
  try { localStorage.setItem(LISTENING_KEY, on ? 'on' : 'off'); } catch { /* per-viewer convenience only */ }
  for (const listener of [...listeningListeners]) listener(on);
}

// `hideable` is the element holding the question text and its Chinese meaning. It is
// removed from the accessibility tree, not just painted over, so a screen-reader user
// gets the same experience rather than a silently different one.
export function mountReadAloud(parent, reference, {api, provider, label = '朗讀英文', onError, hideable} = {}) {
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

  // Listening mode is offered only where there is question text to hide.
  const reveal = document.createElement('button'); reveal.type = 'button'; reveal.className = 'ghost read-aloud-reveal'; reveal.textContent = '顯示題目'; reveal.hidden = true;
  const toggleLabel = document.createElement('label'); toggleLabel.className = 'check-label listening-toggle';
  const toggle = document.createElement('input'); toggle.type = 'checkbox'; toggle.className = 'listening-mode';
  toggleLabel.append(toggle, document.createTextNode('聽力模式：朗讀時先不看題目'));
  // Several elements can make up the question (the text and its Chinese meaning sit
  // either side of this control), so accept a list and keep the control itself visible.
  const hidden = [hideable].flat().filter(Boolean);
  const showText = () => { if (!hidden.length) return; for (const node of hidden) node.hidden = false; reveal.hidden = true; status.textContent = ''; };
  const hideText = () => { if (!hidden.length || !toggle.checked) return; for (const node of hidden) node.hidden = true; reveal.hidden = false; };
  if (hidden.length) {
    toggle.checked = listeningMode;
    box.append(toggleLabel, reveal);
    toggle.addEventListener('change', () => { setListeningMode(toggle.checked); if (!toggle.checked) showText(); });
    // The reveal button hides itself, so focus moves to the question it just showed
    // (the first hideable element) instead of falling back to the page body.
    reveal.addEventListener('click', () => {
      showText();
      const question = hidden[0];
      if (!question.hasAttribute('tabindex')) question.setAttribute('tabindex', '-1');
      question.focus();
    });
    const follow = on => { if (toggle.checked !== on) { toggle.checked = on; if (!on) showText(); } };
    listeningListeners.add(follow);
    box.dataset.listening = 'available';
    box._unfollow = () => listeningListeners.delete(follow);
  }
  if (provider.demonstrationSpeech) { const note = document.createElement('span'); note.className = 'meta'; note.textContent = '目前是本機示範服務，只會播放示意音，不是真人朗讀。'; box.append(note); }
  parent.append(box);

  const cache = new Map();
  let audio = null, disposed = false, loading = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    mountedReadAloud.delete(dispose);
    box._unfollow?.();
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
    // Hide before the request so the learner cannot read ahead while it loads.
    hideText();
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
      // Never leave the learner unable to both hear and read the question.
      showText();
      status.textContent = '朗讀失敗，已顯示題目，可再試一次。';
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

// Audio remains in memory only while recording or while its unsubmitted transcript
// is being reviewed. The local preview is diagnostic: it never scores speech.
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
  let audioContext, audioSource, levelFrame, previewUrl, recordingStartedAt, observedLevel = null;
  const elapsed = document.createElement('p'); elapsed.className = 'recording-clock'; elapsed.hidden = true;
  const status = document.createElement('p'); status.className = 'meta'; status.setAttribute('role', 'status');
  const start = document.createElement('button'); start.textContent = '開始錄音'; start.className = 'secondary voice-start';
  const stop = document.createElement('button'); stop.textContent = '停止並轉成文字'; stop.className = 'secondary voice-stop'; stop.disabled = true;
  const retry = document.createElement('button'); retry.textContent = '重試語音轉錄'; retry.className = 'secondary voice-retry'; retry.hidden = true;
  const discard = document.createElement('button'); discard.textContent = '捨棄錄音，改用文字'; discard.className = 'ghost';
  const inputLabel = document.createElement('p'); inputLabel.className = 'meta voice-input-label'; inputLabel.textContent = '麥克風：開始錄音後顯示目前輸入來源。';
  const levelBox = document.createElement('div'); levelBox.className = 'voice-level-box'; levelBox.hidden = true;
  const levelLabel = document.createElement('label'); levelLabel.textContent = '目前輸入音量 ';
  const level = document.createElement('progress'); level.className = 'voice-level'; level.max = 1; level.value = 0; level.setAttribute('aria-label', '目前麥克風輸入音量');
  const levelNote = document.createElement('p'); levelNote.className = 'meta voice-level-note'; levelNote.textContent = '這只顯示麥克風輸入強弱，不能判斷是否有說話或能否辨識。';
  levelLabel.append(level); levelBox.append(levelLabel, levelNote);
  const summary = document.createElement('p'); summary.className = 'meta voice-recording-summary'; summary.hidden = true;
  const preview = document.createElement('div'); preview.className = 'voice-preview'; preview.hidden = true;
  const previewLabel = document.createElement('p'); previewLabel.className = 'meta'; previewLabel.textContent = '先播放這次錄音，確認麥克風是否錄到你預期的內容：';
  const previewPlayer = document.createElement('audio'); previewPlayer.controls = true; previewPlayer.preload = 'metadata'; previewPlayer.setAttribute('aria-label', '播放這次尚未送出的錄音');
  preview.append(previewLabel, previewPlayer);
  panel.append(inputLabel, start, stop, retry, discard, elapsed, levelBox, summary, preview, status);
  // Two separate facts. `audio` is the blob this panel can still preview or retry;
  // `held` is whether this page holds the only copy, which is what the reload warning
  // is about. A transcribed recording is retained on the server, so the local copy
  // stops being the only one even though the preview keeps working.
  const setHeld = value => { if (value && !held) { held = true; pendingRecordings += 1; } else if (!value && held) { held = false; pendingRecordings -= 1; } };
  const holdAudio = value => { setHeld(!!value); audio = value; };
  const closeAudioContext = () => {
    if (levelFrame) window.cancelAnimationFrame?.(levelFrame);
    levelFrame = null;
    try { audioSource?.disconnect(); } catch { /* already disconnected */ }
    audioSource = null;
    const context = audioContext; audioContext = null;
    if (context && context.state !== 'closed') Promise.resolve(context.close?.()).catch(() => {});
    levelBox.hidden = true; level.value = 0;
  };
  const clearPreview = () => {
    previewPlayer.pause();
    previewPlayer.removeAttribute('src');
    if (typeof previewPlayer.load === 'function') previewPlayer.load();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null; preview.hidden = true; summary.hidden = true;
  };
  const clearCapturedAudio = () => { clearPreview(); holdAudio(null); };
  const showPreview = captured => {
    clearPreview();
    try {
      previewUrl = URL.createObjectURL(captured);
      previewPlayer.src = previewUrl;
      preview.hidden = false;
    } catch { /* Recording can still be transcribed when local URL playback is unavailable. */ }
  };
  const formatBytes = bytes => bytes < 1_000 ? `${bytes} B` : bytes < 1_000_000 ? `${(bytes / 1_000).toFixed(1)} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`;
  const showSummary = (captured, durationSeconds) => {
    const duration = durationSeconds < 10 ? `${durationSeconds.toFixed(1)} 秒` : `${Math.round(durationSeconds)} 秒`;
    const levelSummary = observedLevel === null
      ? '即時輸入音量未能量測'
      : `觀察到的最高輸入音量 ${Math.round(observedLevel * 100)}%`;
    summary.textContent = `這次錄音：${duration}、${formatBytes(captured.size)}；${levelSummary}。音量只代表輸入強弱，不能證明是否有說話。`;
    summary.hidden = false;
  };
  const showSelectedInput = currentStream => {
    const tracks = currentStream?.getAudioTracks?.() || currentStream?.getTracks?.() || [];
    const track = tracks.find?.(item => item.kind === 'audio') || tracks[0];
    inputLabel.textContent = `麥克風：${track?.label || '瀏覽器目前選擇的輸入來源'}`;
  };
  const startLevelMeter = currentStream => {
    closeAudioContext();
    observedLevel = null;
    levelBox.hidden = false;
    level.hidden = false;
    levelNote.textContent = '這只顯示麥克風輸入強弱，不能判斷是否有說話或能否辨識。';
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      level.hidden = true;
      levelNote.textContent = '這個瀏覽器無法顯示即時輸入音量；錄音仍可繼續。';
      return;
    }
    try {
      audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.7;
      audioSource = audioContext.createMediaStreamSource(currentStream);
      audioSource.connect(analyser); // Deliberately not connected to destination/speakers.
      const samples = new Uint8Array(analyser.fftSize);
      observedLevel = 0;
      const update = () => {
        if (!audioContext || disposed || recorder?.state !== 'recording') return;
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const sample of samples) { const centered = (sample - 128) / 128; sum += centered * centered; }
        const visibleLevel = Math.min(1, Math.sqrt(sum / samples.length) * 4);
        observedLevel = Math.max(observedLevel, visibleLevel);
        level.value = visibleLevel;
        levelFrame = requestAnimationFrame(update);
      };
      update();
    } catch {
      closeAudioContext();
      levelBox.hidden = false;
      level.hidden = true;
      levelNote.textContent = '目前無法顯示即時輸入音量；錄音仍可繼續。';
      observedLevel = null;
    }
  };
  function release() {
    clearTimeout(limitTimer); clearInterval(tick); tick = null; elapsed.hidden = true;
    closeAudioContext();
    stream?.getTracks?.().forEach(track => track.stop()); stream = null;
  }
  async function transcribe() {
    if (!audio || disposed) return;
    start.disabled = true; retry.disabled = true; status.textContent = '正在轉成文字…';
    try {
      await beforeTranscription?.();
      const bytes = new Uint8Array(await audio.arrayBuffer());
      if (bytes.length > maxBytes) throw Error(`錄音超過 ${Math.round(maxBytes / 1_000_000)} MB，請縮短回答或改用文字。`);
      let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
      const draft = await api(endpoint, {audio: btoa(binary), mimeType: audio.type.split(';')[0]});
      setHeld(false); chunks = []; retry.hidden = true; status.textContent = '已轉成文字，請看上面的回答框；這段錄音仍可在這裡播放。';
      if (!disposed) await onTranscript(draft, panel);
    } catch (e) {
      if (!disposed) {
        // A no-text result says what the model returned, not whether the microphone
        // definitely captured silence. The preview and meter summary give the learner
        // local evidence without pretending to detect speech.
        const noSpeech = /No speech was detected|沒有辨識到(?:說話)?內容/.test(e?.message || '');
        status.textContent = noSpeech
          ? '模型沒有從這段錄音回傳文字。請先播放錄音並查看輸入音量，再選擇重試轉錄、重新錄音或改用文字。'
          : '語音轉錄失敗。錄音還在，你可以重試、重新錄音或改用文字。';
        retry.hidden = false;
        onError?.(noSpeech ? Error('模型沒有從這段錄音回傳文字。請播放錄音、查看麥克風輸入，再決定要重試轉錄、重新錄音或改用文字。') : e);
      }
    }
    finally { if (!disposed) await onTranscriptionEnd?.(); start.disabled = false; retry.disabled = false; }
  }
  start.onclick = async () => {
    try {
      stopReadAloud();
      // Only an unsubmitted recording is at risk. Once transcribed it is retained on
      // the server, so keeping it previewable here must not start nagging about loss.
      if (held && !window.confirm('重新錄音會蓋掉目前這段還沒送出的錄音，確定要重錄嗎？')) return;
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw Error('這個瀏覽器無法錄音，請改用文字回答。');
      start.disabled = true; recordingFailed = false; chunks = [];
      stream = await navigator.mediaDevices.getUserMedia({audio: true});
      if (disposed) {release();return;}
      showSelectedInput(stream);
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(type => MediaRecorder.isTypeSupported(type));
      recorder = new MediaRecorder(stream, mimeType ? {mimeType} : undefined);
      clearCapturedAudio();
      retry.hidden = true;
      recorder.ondataavailable = e => { if (!disposed && e.data.size) chunks.push(e.data); };
      recorder.onerror = () => {recordingFailed=true;release();start.disabled=false;stop.disabled=true;chunks=[];status.textContent='';onError?.(Error('錄音失敗，請重新錄音或改用文字。'));};
      recorder.onstop = async () => {
        const durationSeconds = Math.max(0, (Date.now() - recordingStartedAt) / 1000);
        release(); stop.disabled = true; start.disabled = false;
        if (disposed || recordingFailed) return;
        const captured = new Blob(chunks, {type: recorder.mimeType}); chunks = [];
        if (!captured.size) { status.textContent = '這次沒有產生可播放的錄音檔，請確認麥克風後再試，或改用文字。'; onError?.(Error('這次沒有產生錄音檔，請確認麥克風後再試，或改用文字。')); return; }
        holdAudio(captured);
        showPreview(captured);
        showSummary(captured, durationSeconds);
        await transcribe();
      };
      recorder.start(); recordingStartedAt = Date.now(); start.disabled = true; stop.disabled = false; status.textContent = '正在錄音…';
      startLevelMeter(stream);
      elapsed.hidden = false; elapsed.textContent = `已錄 0:00 / ${clock(limit)}`;
      tick = setInterval(() => {
        const seconds = Math.min(limit, (Date.now() - recordingStartedAt) / 1000);
        elapsed.textContent = `已錄 ${clock(seconds)} / ${clock(limit)}`;
        const near = seconds >= warnAt;
        elapsed.classList.toggle('near-limit', near);
        if (near) elapsed.textContent += `　快到上限了，請開始收尾（剩下約 ${Math.max(0, Math.round(limit - seconds))} 秒）`;
      }, 250);
      limitTimer = setTimeout(() => {if (recorder.state === 'recording') {status.textContent = `已達 ${Math.round(limit / 60)} 分鐘上限，正在把已錄的內容轉成文字。`; recorder.stop();}}, limit * 1000);
    } catch (e) {release();start.disabled=false;stop.disabled=true;onError?.(e);}
  };
  stop.onclick = () => {if (recorder?.state === 'recording') recorder.stop();};
  retry.onclick = transcribe;
  discard.onclick = async () => {disposed=true;if(recorder?.state==='recording')recorder.stop();release();clearCapturedAudio();chunks=[];await onTranscriptionEnd?.();panel.remove();};
  return () => {disposed=true;if(recorder?.state==='recording')recorder.stop();release();clearCapturedAudio();chunks=[];};
}
