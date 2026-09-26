/** Audio abspielen, Offline-Einbettung (CORS-Proxy) & Import */

import { slugify } from './utils.js';

const AUDIO_CACHE = 'masri-audio-v3';
/** Max. Größe pro Datei für IndexedDB-Einbettung (data URL) */
const MAX_EMBED_BYTES = 800 * 1024;

const CORS_PROXIES = [
  (url) => 'https://corsproxy.io/?' + encodeURIComponent(url),
  (url) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
];

/** Alle möglichen Pfade für eine Vokabel – in Prioritäts-Reihenfolge */
export function getAudioCandidates(card) {
  if (!card) return [];
  const out = [];

  if (card.audioUrl?.trim()) {
    const u = card.audioUrl.trim();
    out.push(u.startsWith('http') || u.startsWith('./') || u.startsWith('/') ? u : './audio/' + u);
  }
  if (card.audioFile?.trim()) out.push('./audio/' + card.audioFile.trim());

  const slug = slugify(card.german);
  if (slug) {
    out.push('./audio/' + slug + '.mp3', './audio/' + slug + '.ogg');
  }
  if (card.id) {
    out.push('./audio/' + card.id + '.mp3', './audio/' + card.id + '.ogg');
  }

  return [...new Set(out)];
}

export function resolveAudioUrl(card) {
  return getAudioCandidates(card)[0] || null;
}

export function hasAudioSource(card) {
  return !!(card?.audioData || getAudioCandidates(card).length);
}

export function isExternalAudioUrl(url) {
  return /^https?:\/\//i.test(url || '');
}

export function needsOfflineEmbed(card) {
  if (!card || card.audioData) return false;
  const url = card.audioUrl?.trim();
  return !!(url && isExternalAudioUrl(url));
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
  return slug ? slug + '.mp3' : '';
}

function playBlob(blob, onStart) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    const cleanup = () => {
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    };
    audio.onended = () => { cleanup(); resolve(); };
    audio.onerror = () => { cleanup(); reject(new Error('Abspielen fehlgeschlagen')); };
    audio.play().then(() => {
      onStart?.();
    }).catch((err) => {
      cleanup();
      reject(err);
    });
  });
}

/**
 * Direkt abspielen via HTMLAudioElement – kein fetch, daher kein CORS-Block
 * für die reine Wiedergabe (typisch bei CDN-/http(s)-Links).
 */
function playUrlDirect(url, onStart) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    let settled = false;
    let started = false;
    const done = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      audio.onended = null;
      audio.onerror = null;
      fn(arg);
    };
    const watchdog = setTimeout(() => {
      if (!started) done(reject, new Error('timeout'));
    }, 12000);
    audio.preload = 'auto';
    audio.onended = () => done(resolve);
    audio.onerror = () => done(reject, new Error('Abspielen fehlgeschlagen'));
    audio.src = url;
    // play() im Tap-Kontext starten – zuverlässiger als erst auf canplay zu warten
    const p = audio.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        started = true;
        onStart?.();
      }).catch((err) => done(reject, err));
    } else {
      started = true;
      onStart?.();
    }
  });
}

function urlsForDirectPlay(url) {
  if (url.startsWith('http://')) {
    return ['https://' + url.slice(7), url];
  }
  return [url];
}

/**
 * Versucht alle Kandidaten.
 * Externe http(s): direkt new Audio(url).play() – kein fetch/CORS.
 * Lokal ./audio/: Cache API + fetch + blob; bei Fehlschlag noch Direct-Play.
 */
export async function playOfficialAudio(card, onStart) {
  const candidates = getAudioCandidates(card);
  if (!candidates.length) {
    return { ok: false, tried: false, reason: 'no-candidates' };
  }

  let lastReason = 'not-found';
  let triedExplicit = false;

  for (const url of candidates) {
    const explicit = isExternalAudioUrl(url) ||
      (card.audioUrl?.trim() && url.includes(card.audioUrl.trim())) ||
      (card.audioFile?.trim() && url.endsWith(card.audioFile.trim()));

    if (isExternalAudioUrl(url)) {
      triedExplicit = true;
      for (const tryUrl of urlsForDirectPlay(url)) {
        try {
          await playUrlDirect(tryUrl, onStart);
          return { ok: true, source: 'url', tried: true };
        } catch (err) {
          const msg = String(err?.message || err || '');
          if (/NotAllowedError|interact/i.test(msg)) lastReason = 'autoplay';
          else lastReason = 'play-error';
        }
      }
      continue;
    }

    /* same-origin / relative */
    try {
      let response = null;
      if ('caches' in window) {
        try {
          const cached = await caches.open(AUDIO_CACHE);
          const hit = await cached.match(url);
          if (hit?.ok) response = hit;
        } catch { /* cache unavailable */ }
      }

      if (!response) {
        response = await fetch(url, { mode: 'cors' });
        if (!response?.ok) {
          if (explicit) {
            triedExplicit = true;
            lastReason = 'http-' + (response?.status || 0);
          }
          continue;
        }
        if ('caches' in window) {
          try {
            const cached = await caches.open(AUDIO_CACHE);
            cached.put(url, response.clone());
          } catch { /* ignore cache write */ }
        }
      }

      if (explicit) triedExplicit = true;
      const blob = await response.blob();
      if (!blob || blob.size < 64) {
        lastReason = 'empty';
        continue;
      }
      await playBlob(blob, onStart);
      return { ok: true, source: 'local', tried: true };
    } catch (err) {
      const msg = String(err?.message || err || '');
      if (explicit) triedExplicit = true;
      if (/cors|network|failed to fetch/i.test(msg)) {
        // Fetch blockiert → trotzdem Direct-Play versuchen
        try {
          await playUrlDirect(url, onStart);
          return { ok: true, source: 'local', tried: true };
        } catch {
          lastReason = 'cors';
        }
      } else if (/NotAllowedError|interact/i.test(msg)) {
        lastReason = 'autoplay';
      } else {
        lastReason = 'play-error';
      }
    }
  }

  return { ok: false, tried: triedExplicit, reason: lastReason };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function fetchBlobDirect(url) {
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error('http-' + res.status);
  return res.blob();
}

async function fetchBlobViaProxy(url) {
  let lastErr = null;
  for (const build of CORS_PROXIES) {
    try {
      const res = await fetch(build(url), { mode: 'cors' });
      if (!res.ok) {
        lastErr = new Error('proxy-http-' + res.status);
        continue;
      }
      const blob = await res.blob();
      if (!blob || blob.size < 64) {
        lastErr = new Error('proxy-empty');
        continue;
      }
      return blob;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('proxy-failed');
}

/**
 * Lädt externe Audio-URL als Blob (direkt, sonst CORS-Proxy).
 * Versucht bei http:// auch https://.
 */
export async function fetchExternalAudioBlob(url) {
  const variants = urlsForDirectPlay(url);
  let lastErr = null;

  for (const u of variants) {
    try {
      return await fetchBlobDirect(u);
    } catch (err) {
      lastErr = err;
    }
  }
  for (const u of variants) {
    try {
      return await fetchBlobViaProxy(u);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('fetch-failed');
}

/**
 * Embeddet externe audioUrls als audioData in die Vokabeln (IndexedDB).
 * Online-Play funktioniert trotzdem ohne Embedding.
 * onProgress(done, total, { embedded, onlineOnly, skipped })
 * onBatch(updatedVocabulary) – optional, zum Zwischen-Speichern
 */
export async function embedExternalAudio(vocabulary, onProgress, onBatch) {
  const updated = vocabulary.map((v) => ({ ...v }));
  const pending = updated.filter(needsOfflineEmbed);
  let done = 0;
  let embedded = 0;
  let onlineOnly = 0;
  let skipped = 0;
  let batchCount = 0;

  const report = () => {
    onProgress?.(done, pending.length, { embedded, onlineOnly, skipped });
  };

  if (!pending.length) {
    report();
    return { updated, embedded: 0, onlineOnly: 0, skipped: 0, total: 0 };
  }

  for (const card of pending) {
    const url = card.audioUrl.trim();
    try {
      const blob = await fetchExternalAudioBlob(url);
      if (blob.size > MAX_EMBED_BYTES) {
        skipped++;
        onlineOnly++;
        card.audioOffline = 'too-large';
      } else {
        const type = blob.type && blob.type.startsWith('audio/')
          ? blob.type
          : 'audio/mpeg';
        const dataUrl = await blobToDataUrl(new Blob([blob], { type }));
        card.audioData = dataUrl;
        card.audioOffline = 'embedded';
        embedded++;
      }
    } catch {
      onlineOnly++;
      card.audioOffline = 'online-only';
    }

    done++;
    batchCount++;
    report();

    if (onBatch && batchCount >= 20) {
      const slice = pending.slice(Math.max(0, done - batchCount), done);
      await onBatch(slice);
      batchCount = 0;
    }
  }

  if (onBatch && batchCount > 0) {
    await onBatch(pending.slice(pending.length - batchCount));
  }

  return { updated, embedded, onlineOnly, skipped, total: pending.length };
}

/**
 * Offline-Paket: externe URLs → audioData + lokale ./audio/ in Cache API.
 */
export async function cacheAllAudio(vocabulary, onProgress, onBatch) {
  const localUrls = [...new Set(
    vocabulary.flatMap(getAudioCandidates).filter((u) => !isExternalAudioUrl(u)),
  )];

  let localCached = 0;
  let localDone = 0;

  if ('caches' in window && localUrls.length) {
    const cache = await caches.open(AUDIO_CACHE);
    for (const url of localUrls) {
      try {
        const existing = await cache.match(url);
        if (!existing) {
          const res = await fetch(url);
          if (res.ok) {
            await cache.put(url, res);
            localCached++;
          }
        } else localCached++;
      } catch { /* fehlt */ }
      localDone++;
      onProgress?.(localDone, localUrls.length + 1, localCached, 'local');
    }
  }

  const embed = await embedExternalAudio(
    vocabulary,
    (done, total, stats) => {
      onProgress?.(done, total, stats.embedded, 'embed', stats);
    },
    onBatch,
  );

  return {
    total: embed.total + localUrls.length,
    cached: embed.embedded + localCached,
    embedded: embed.embedded,
    onlineOnly: embed.onlineOnly,
    skipped: embed.skipped,
    updated: embed.updated,
  };
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
