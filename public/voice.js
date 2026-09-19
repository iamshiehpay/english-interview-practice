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
