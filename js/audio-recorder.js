let mediaRecorder = null;
let chunks = [];
let stopResolve = null;

export function isRecordingSupported() {
  return !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}

export function startRecording() {
  return new Promise(async (resolve, reject) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      mediaRecorder = new MediaRecorder(stream);
      stopResolve = resolve;

      mediaRecorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const b64 = await blobToBase64(blob);
        stopResolve?.(b64);
        stopResolve = null;
      };
      mediaRecorder.onerror = (e) => reject(e.error || new Error('Aufnahme fehlgeschlagen'));
      mediaRecorder.start();
    } catch (err) {
      reject(err);
    }
  });
}

export function stopRecording() {
  if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
}

function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

export function playRecordedAudio(audioData) {
  if (!audioData) return false;
  new Audio(audioData).play();
  return true;
}
