import { playRecordedAudio } from './audio-recorder.js';
import { playOfficialAudio } from './audio-files.js';
import { toast } from './toast.js';

let arabicVoice = null;
let voicesReady = false;
/** Einmaliger Hinweis pro Sitzung bei Lautschrift-TTS */
let translitTipShown = false;

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

function flashError(button, ms = 2000) {
  setSpeakButtonState(button, 'error');
  setTimeout(() => setSpeakButtonState(button, 'idle'), ms);
}

/**
 * Abspiel-Reihenfolge: eigene Aufnahme → URL/Datei → TTS.
 * Kein Dauer-Toast: Hinweise höchstens einmalig; Fehler nur wenn gar nichts ging.
 */
export async function speakCard(card, options = {}) {
  const { button = null, silent = false } = options;
  const notify = (msg, type = 'info', ms = 3500) => {
    if (!silent && msg) toast(msg, type, ms);
  };

  if (!card) {
    notify('Keine Vokabel zum Abspielen.', 'warn');
    return { ok: false, source: 'none', message: 'Keine Vokabel' };
  }

  setSpeakButtonState(button, 'loading');

  // 1) Eigene Aufnahme (lokal / IndexedDB)
  if (card.audioData) {
    try {
      setSpeakButtonState(button, 'playing');
      await playRecordedAudio(card.audioData);
      setSpeakButtonState(button, 'idle');
      return { ok: true, source: 'recorded', message: null };
    } catch {
      // still leise weiter zu URL / TTS
    }
  }

  // 2) Externe URL / lokale Datei
  const hasExplicitAudio = !!(card.audioUrl?.trim() || card.audioFile?.trim());
  const fileResult = await playOfficialAudio(card, () => setSpeakButtonState(button, 'playing'));
  if (fileResult.ok) {
    setSpeakButtonState(button, 'idle');
    return { ok: true, source: fileResult.source || 'file', message: null };
  }

  // Nur Autoplay ist unmittelbar handlungsrelevant
  if (fileResult.reason === 'autoplay') {
    notify('Browser blockiert Audio – bitte nochmals tippen.', 'warn', 3000);
  }

  // 3) TTS-Fallback (Lautschrift leise, wenn keine Arabisch-Stimme)
  const text = card?.egyptian || card?.text;
  const transliteration = card?.transliteration;
  if (!text && !transliteration) {
    flashError(button);
    notify(
      hasExplicitAudio
        ? 'Sprachdatei nicht abspielbar.'
        : 'Kein Ton – 🎙️ Aufnahme auf der Karte.',
      'error',
      3000,
    );
    return { ok: false, source: 'none', message: 'Kein Text' };
  }

  const tts = await speakArabic(text, transliteration);
  if (tts.ok) {
    setSpeakButtonState(button, 'playing');
    setTimeout(() => setSpeakButtonState(button, 'idle'), Math.max(800, tts.durationMs || 1200));
    // Einmaliger, kurzer Hinweis – kein Dauer-Nörgeln bei jedem Tap
    if (tts.usedTransliteration && !translitTipShown && !silent) {
      translitTipShown = true;
      notify('Lautschrift (Näherung). Besser: 🎙️ Aufnahme auf der Karte.', 'info', 3200);
    }
    return { ok: true, source: 'tts', message: tts.message };
  }

  flashError(button, 2500);
  notify(tts.message || 'Kein Ton möglich – 🎙️ Aufnahme auf der Karte.', 'error', 3500);
  return { ok: false, source: 'none', message: tts.message };
}

export function speakArabic(text, transliteration) {
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
          message: 'Kein Ton möglich – 🎙️ Aufnahme auf der Karte.',
          usedTransliteration: true,
        });
        speechSynthesis.speak(fallback);
        return;
      }
      done({
        ok: false,
        message: arabicVoice
          ? 'Computer-Stimme fehlgeschlagen.'
          : 'Kein Ton möglich – 🎙️ Aufnahme auf der Karte.',
        usedTransliteration: !!useTranslit,
      });
    };

    try {
      speechSynthesis.speak(utter);
      // Manche Browser feuern weder end noch error
      setTimeout(() => {
        if (!settled && speechSynthesis.speaking) return;
        if (!settled) {
          done({
            ok: true,
            message: useTranslit ? 'Lautschrift gesprochen' : null,
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
