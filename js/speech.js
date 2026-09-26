import { playRecordedAudio } from './audio-recorder.js';
import { playOfficialAudio } from './audio-files.js';
import { toast } from './toast.js';

let arabicVoice = null;
let voicesReady = false;

function loadVoices() {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) { resolve(null); return; }
    const pick = () => {
      const voices = speechSynthesis.getVoices();
      arabicVoice =
        voices.find((v) => v.lang.startsWith('ar-EG')) ||
        voices.find((v) => v.lang.startsWith('ar')) ||
        voices.find((v) => v.lang.includes('Arabic')) || null;
      voicesReady = voices.length > 0;
      resolve(arabicVoice);
    };
    pick();
    speechSynthesis.onvoiceschanged = pick;
  });
}

export async function initSpeech() {
  return loadVoices();
}

export function hasArabicVoice() {
  return !!arabicVoice;
}

/** Button-Zustände: idle | loading | playing | error */
export function setSpeakButtonState(btn, state, label) {
  if (!btn) return;
  if (!btn.dataset.idleLabel) btn.dataset.idleLabel = btn.textContent.trim() || '🔊';
  btn.dataset.audioState = state;
  btn.classList.toggle('is-loading', state === 'loading');
  btn.classList.toggle('is-playing', state === 'playing');
  btn.classList.toggle('is-error', state === 'error');
  btn.disabled = state === 'loading' || state === 'playing';
  if (label) btn.textContent = label;
  else if (state === 'loading') btn.textContent = '…';
  else if (state === 'playing') btn.textContent = '▶';
  else if (state === 'error') btn.textContent = '!';
  else btn.textContent = btn.dataset.idleLabel;
}

/**
 * Abspiel-Reihenfolge: eigene Aufnahme → Paket/URL → lokal → TTS.
 * Liefert { ok, source, message } und zeigt Toasts bei Fallbacks/Fehlern.
 */
export async function speakCard(card, options = {}) {
  const { button = null, silent = false } = options;
  const notify = (msg, type = 'info') => { if (!silent && msg) toast(msg, type, 4000); };

  if (!card) {
    notify('Keine Vokabel zum Abspielen.', 'warn');
    return { ok: false, source: 'none', message: 'Keine Vokabel' };
  }

  setSpeakButtonState(button, 'loading');

  // 1) Eigene Aufnahme
  if (card.audioData) {
    try {
      setSpeakButtonState(button, 'playing');
      await playRecordedAudio(card.audioData);
      setSpeakButtonState(button, 'idle');
      return { ok: true, source: 'recorded', message: null };
    } catch {
      notify('Eigene Aufnahme fehlgeschlagen – versuche andere Quelle…', 'warn');
    }
  }

  // 2) Offizielle URL / lokales audio/
  const fileResult = await playOfficialAudio(card, () => setSpeakButtonState(button, 'playing'));
  if (fileResult.ok) {
    setSpeakButtonState(button, 'idle');
    return { ok: true, source: fileResult.source || 'file', message: null };
  }

  // 3) TTS-Fallback
  const text = card?.egyptian || card?.text;
  const transliteration = card?.transliteration;
  if (!text && !transliteration) {
    setSpeakButtonState(button, 'error');
    notify('Keine Sprachdatei und kein Text zum Vorlesen.', 'error');
    setTimeout(() => setSpeakButtonState(button, 'idle'), 2000);
    return { ok: false, source: 'none', message: 'Kein Text' };
  }

  const tts = await speakArabic(text, transliteration, { notify: !silent });
  if (tts.ok) {
    setSpeakButtonState(button, 'playing');
    setTimeout(() => setSpeakButtonState(button, 'idle'), Math.max(800, (tts.durationMs || 1200)));
    if (tts.usedTransliteration) {
      notify('Keine Arabisch-Stimme – Lautschrift wird gesprochen. Bessere Aussprache: Aufnahme oder Offline-Paket.', 'warn');
    } else if (fileResult.tried) {
      notify('Keine Sprachdatei – Computer-Stimme.', 'info');
    }
    return { ok: true, source: 'tts', message: tts.message };
  }

  setSpeakButtonState(button, 'error');
  notify(tts.message || 'Auf diesem Gerät keine Aussprache möglich.', 'error');
  setTimeout(() => setSpeakButtonState(button, 'idle'), 2500);
  return { ok: false, source: 'none', message: tts.message };
}

export function speakArabic(text, transliteration, options = {}) {
  const { notify = false } = options;
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve({ ok: false, message: 'Dieses Gerät unterstützt keine Computer-Stimme.', usedTransliteration: false });
      return;
    }

    // Stimmen ggf. nochmals laden (manche Browser liefern sie verzögert)
    if (!voicesReady) loadVoices();

    const useTranslit = !arabicVoice && transliteration;
    const speakText = useTranslit ? transliteration : (text || transliteration);

    if (!speakText) {
      resolve({ ok: false, message: 'Kein Text zum Vorlesen.', usedTransliteration: false });
      return;
    }

    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(speakText);
    utter.rate = useTranslit ? 0.75 : 0.85;

    if (arabicVoice) {
      utter.voice = arabicVoice;
      utter.lang = arabicVoice.lang || 'ar-EG';
    } else if (useTranslit) {
      utter.lang = 'de-DE';
    } else {
      utter.lang = 'ar-EG';
    }

    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    utter.onend = () => done({
      ok: true,
      message: useTranslit ? 'Lautschrift gesprochen' : null,
      usedTransliteration: !!useTranslit,
      durationMs: Math.min(4000, speakText.length * 80),
    });

    utter.onerror = () => {
      if (transliteration && transliteration !== speakText) {
        const fallback = new SpeechSynthesisUtterance(transliteration);
        fallback.lang = 'de-DE';
        fallback.rate = 0.75;
        fallback.onend = () => done({
          ok: true,
          message: 'Lautschrift gesprochen',
          usedTransliteration: true,
          durationMs: Math.min(4000, transliteration.length * 80),
        });
        fallback.onerror = () => done({
          ok: false,
          message: 'Auf diesem Handy keine Arabisch-Stimme.',
          usedTransliteration: true,
        });
        speechSynthesis.speak(fallback);
        return;
      }
      done({
        ok: false,
        message: arabicVoice
          ? 'Computer-Stimme fehlgeschlagen.'
          : 'Auf diesem Handy keine Arabisch-Stimme.',
        usedTransliteration: !!useTranslit,
      });
    };

    try {
      speechSynthesis.speak(utter);
      // Manche Browser feuern weder end noch error bei leerer Stimme
      setTimeout(() => {
        if (!settled && speechSynthesis.speaking) return;
        if (!settled) {
          done({
            ok: !useTranslit || !!transliteration,
            message: useTranslit
              ? 'Lautschrift (Näherung) – bessere Aussprache per Aufnahme.'
              : null,
            usedTransliteration: !!useTranslit,
            durationMs: 1500,
          });
        }
      }, 2500);
    } catch {
      done({
        ok: false,
        message: 'Aussprache konnte nicht gestartet werden.',
        usedTransliteration: false,
      });
    }

    if (notify && useTranslit) {
      // Toast kommt aus speakCard – hier nur Flag
    }
  });
}

/** Fester Test mit Beispielwort „Brot / عيش" */
export async function speakTestSample(button) {
  const sample = {
    german: 'Brot',
    egyptian: 'عيش',
    transliteration: 'Aisch',
  };
  return speakCard(sample, { button });
}

export function isSpeechSupported() {
  return 'speechSynthesis' in window;
}
