import { playRecordedAudio } from './audio-recorder.js';
import { playOfficialAudio } from './audio-files.js';

let arabicVoice = null;

function loadVoices() {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) { resolve(null); return; }
    const pick = () => {
      const voices = speechSynthesis.getVoices();
      arabicVoice =
        voices.find((v) => v.lang.startsWith('ar-EG')) ||
        voices.find((v) => v.lang.startsWith('ar')) ||
        voices.find((v) => v.lang.includes('Arabic')) || null;
      resolve(arabicVoice);
    };
    pick();
    speechSynthesis.onvoiceschanged = pick;
  });
}

export async function initSpeech() {
  return loadVoices();
}

export async function speakCard(card) {
  if (await playOfficialAudio(card)) return;
  if (card?.audioData && playRecordedAudio(card.audioData)) return;

  const text = card?.egyptian || card?.text;
  const transliteration = card?.transliteration;
  speakArabic(text, transliteration);
}

export function speakArabic(text, transliteration) {
  if (!('speechSynthesis' in window)) return;

  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text || transliteration);
  utter.lang = 'ar-EG';
  utter.rate = 0.85;
  if (arabicVoice) utter.voice = arabicVoice;

  utter.onerror = () => {
    if (transliteration && transliteration !== text) {
      const fallback = new SpeechSynthesisUtterance(transliteration);
      fallback.lang = 'ar-SA';
      fallback.rate = 0.75;
      speechSynthesis.speak(fallback);
    }
  };

  speechSynthesis.speak(utter);
}

export function isSpeechSupported() {
  return 'speechSynthesis' in window;
}
