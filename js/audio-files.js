/** Audio abspielen, automatisch zuordnen & Offline-Cache */

import { slugify } from './utils.js';

const AUDIO_CACHE = 'masri-audio-v3';

/** Alle möglichen Pfade für eine Vokabel – in Prioritäts-Reihenfolge */
export function getAudioCandidates(card) {
  if (!card) return [];
  const out = [];

  if (card.audioUrl?.trim()) {
    const u = card.audioUrl.trim();
    out.push(u.startsWith('http') || u.startsWith('./') || u.startsWith('/') ? u : `./audio/${u}`);
  }
  if (card.audioFile?.trim()) out.push(`./audio/${card.audioFile.trim()}`);

  const slug = slugify(card.german);
  if (slug) {
    out.push(`./audio/${slug}.mp3`, `./audio/${slug}.ogg`);
  }
  if (card.id) {
    out.push(`./audio/${card.id}.mp3`, `./audio/${card.id}.ogg`);
  }

  return [...new Set(out)];
}

export function resolveAudioUrl(card) {
  return getAudioCandidates(card)[0] || null;
}

export function hasAudioSource(card) {
  return !!(card?.audioData || getAudioCandidates(card).length);
}

export async function probeAudioUrl(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

/** Beim Speichern: passenden Dateinamen vorschlagen */
export function autoAudioFilename(card) {
  if (card.audioFile?.trim()) return card.audioFile.trim();
  const slug = slugify(card.german);
  return slug ? `${slug}.mp3` : '';
}

export async function playOfficialAudio(card) {
  for (const url of getAudioCandidates(card)) {
    try {
      const cached = await caches.open(AUDIO_CACHE);
      const hit = await cached.match(url);
      const response = hit || await fetch(url);
      if (!response?.ok) continue;
      if (!hit) cached.put(url, response.clone());
      const blob = await response.blob();
      await new Audio(URL.createObjectURL(blob)).play();
      return true;
    } catch { /* nächster Kandidat */ }
  }
  return false;
}

export async function cacheAllAudio(vocabulary, onProgress) {
  if (!('caches' in window)) throw new Error('Offline-Cache nicht unterstützt.');
  const cache = await caches.open(AUDIO_CACHE);
  const urls = [...new Set(vocabulary.flatMap(getAudioCandidates))];
  let done = 0;
  let saved = 0;

  for (const url of urls) {
    try {
      const existing = await cache.match(url);
      if (!existing) {
        const res = await fetch(url);
        if (res.ok) { await cache.put(url, res); saved++; }
      } else saved++;
    } catch { /* fehlt */ }
    done++;
    onProgress?.(done, urls.length, saved);
  }
  return { total: urls.length, cached: saved };
}

export async function fileToAudioData(file) {
  if (!file || !file.type.startsWith('audio/')) throw new Error('Bitte MP3 oder OGG wählen.');
  if (file.size > 2 * 1024 * 1024) throw new Error('Datei zu groß (max. 2 MB).');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function findCardForFile(base, map) {
  if (map.has(base)) return map.get(base);
  return [...map.values()].find((v) => {
    const slug = slugify(v.german);
    return slug === base ||
      v.audioFile?.replace(/\.(mp3|ogg|wav|m4a)$/i, '').toLowerCase() === base ||
      v.id?.toLowerCase() === base;
  });
}

export async function importAudioFiles(fileList, vocabulary) {
  const map = new Map(vocabulary.map((v) => [v.id, { ...v }]));
  let matched = 0;
  const unmatched = [];

  for (const file of fileList) {
    const base = file.name.replace(/\.(mp3|ogg|wav|m4a)$/i, '').toLowerCase();
    const card = findCardForFile(base, map);
    if (card) {
      card.audioData = await fileToAudioData(file);
      card.audioFile = file.name;
      matched++;
    } else {
      unmatched.push(file.name);
    }
  }
  return { updated: [...map.values()], matched, unmatched };
}
