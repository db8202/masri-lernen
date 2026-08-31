const DB_NAME = 'masri-lernen';
const DB_VERSION = 3;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('vocabulary')) {
        db.createObjectStore('vocabulary', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('profiles')) {
        db.createObjectStore('profiles', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('progress')) {
        const store = db.createObjectStore('progress', { keyPath: ['profileId', 'cardId'] });
        store.createIndex('profileId', 'profileId', { unique: false });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'profileId' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('dailyStats')) {
        const ds = db.createObjectStore('dailyStats', { keyPath: ['profileId', 'date'] });
        ds.createIndex('profileId', 'profileId', { unique: false });
      }
      if (!db.objectStoreNames.contains('playlists')) {
        db.createObjectStore('playlists', { keyPath: 'id' });
      }
    };
  });
}

async function tx(storeNames, mode, fn) {
  const db = await openDB();
  const names = Array.isArray(storeNames) ? storeNames : [storeNames];
  const transaction = db.transaction(names, mode);
  const stores = names.map((n) => transaction.objectStore(n));
  const result = await fn(...stores);
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
  });
}

function uid() {
  return crypto.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultSettings() {
  return {
    dailyGoal: 10,
    direction: 'de-eg',
    wordsOnly: false,
    studyMode: 'flashcard',
    speakerGender: 'n',
    genderStrict: false,
    reminderEnabled: false,
    reminderTime: '18:00',
    googleSheetId: '',
    syncWebAppUrl: '',
    syncPassphrase: '',
  };
}

export async function getMeta(key) {
  return tx('meta', 'readonly', (store) => new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result?.value ?? null);
    req.onerror = () => reject(req.error);
  }));
}

export async function setMeta(key, value) {
  return tx('meta', 'readwrite', (store) => { store.put({ key, value }); });
}

export async function getAllVocabulary() {
  return tx('vocabulary', 'readonly', (store) => new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));
}

export async function getVocabularyById(id) {
  return tx('vocabulary', 'readonly', (store) => new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  }));
}

export async function saveVocabulary(items) {
  return tx('vocabulary', 'readwrite', (store) => {
    store.clear();
    for (const item of items) store.put(item);
    return items.length;
  });
}

export async function upsertVocabularyItem(item) {
  return tx('vocabulary', 'readwrite', (store) => {
    store.put(item);
    return item;
  });
}

export async function deleteVocabularyItem(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['vocabulary', 'playlists'], 'readwrite');
    tx.objectStore('vocabulary').delete(id);
    const pStore = tx.objectStore('playlists');
    const req = pStore.getAll();
    req.onsuccess = () => {
      for (const pl of req.result || []) {
        if (pl.cardIds?.includes(id)) {
          pl.cardIds = pl.cardIds.filter((x) => x !== id);
          pStore.put(pl);
        }
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllPlaylists() {
  return tx('playlists', 'readonly', (store) => new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));
}

export async function savePlaylist(playlist) {
  return tx('playlists', 'readwrite', (store) => { store.put(playlist); return playlist; });
}

export async function deletePlaylist(id) {
  return tx('playlists', 'readwrite', (store) => { store.delete(id); });
}

export async function upsertPlaylist(data) {
  const playlist = {
    id: data.id || uid(),
    name: data.name.trim(),
    cardIds: data.cardIds || [],
    createdAt: data.createdAt || Date.now(),
    color: data.color || '#14b8a6',
  };
  await savePlaylist(playlist);
  return playlist;
}

export async function mergeVocabulary(items, signatureFn) {
  const existing = await getAllVocabulary();
  const byId = new Map(existing.map((v) => [v.id, v]));
  const bySig = new Map(existing.map((v) => [signatureFn(v), v]));

  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const sig = signatureFn(item);
    const match = bySig.get(sig);
    if (match) {
      byId.set(match.id, { ...match, ...item, id: match.id });
      updated++;
    } else if (item.id && byId.has(item.id)) {
      byId.set(item.id, { ...byId.get(item.id), ...item });
      updated++;
    } else {
      const id = item.id || uid();
      const card = { ...item, id };
      byId.set(id, card);
      bySig.set(sig, card);
      added++;
    }
  }

  const merged = [...byId.values()];
  await saveVocabulary(merged);
  return { merged, added, updated, skipped, total: merged.length };
}

export async function getProfiles() {
  return tx('profiles', 'readonly', (store) => new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));
}

export async function saveProfile(profile) {
  return tx('profiles', 'readwrite', (store) => { store.put(profile); return profile; });
}

export async function getActiveProfileId() {
  return getMeta('activeProfileId');
}

export async function setActiveProfileId(id) {
  return setMeta('activeProfileId', id);
}

export async function createProfile(name) {
  const colors = ['#14b8a6', '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6', '#ef4444'];
  const profiles = await getProfiles();
  const profile = { id: uid(), name, color: colors[profiles.length % colors.length], createdAt: Date.now() };
  await saveProfile(profile);
  await saveSettings(profile.id, defaultSettings());
  if (profiles.length === 0) await setActiveProfileId(profile.id);
  return profile;
}

export async function getSettings(profileId) {
  return tx('settings', 'readonly', (store) => new Promise((resolve, reject) => {
    const req = store.get(profileId);
    req.onsuccess = () => {
      const row = req.result;
      resolve({ profileId, ...defaultSettings(), ...row });
    };
    req.onerror = () => reject(req.error);
  }));
}

export async function saveSettings(profileId, settings) {
  return tx('settings', 'readwrite', (store) => {
    store.put({ profileId, ...settings });
  });
}

export async function getGlobalSettings() {
  const raw = await getMeta('globalSettings');
  return { ...defaultSettings(), ...raw };
}

export async function saveGlobalSettings(settings) {
  return setMeta('globalSettings', settings);
}

export async function getProgress(profileId) {
  return tx('progress', 'readonly', (store) => new Promise((resolve, reject) => {
    const idx = store.index('profileId');
    const req = idx.getAll(profileId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }));
}

export async function getProgressMap(profileId) {
  const rows = await getProgress(profileId);
  return new Map(rows.map((r) => [r.cardId, r]));
}

export async function saveProgressEntry(profileId, cardId, data) {
  return tx('progress', 'readwrite', (store) => {
    store.put({ profileId, cardId, ...data });
  });
}

export async function resetProgress(profileId) {
  const rows = await getProgress(profileId);
  return tx('progress', 'readwrite', (store) => {
    for (const row of rows) store.delete([profileId, row.cardId]);
  });
}

export async function recordDailyStats(profileId, { correct = 0, wrong = 0 } = {}) {
  const date = new Date().toISOString().slice(0, 10);
  return tx('dailyStats', 'readwrite', (store) => new Promise((resolve, reject) => {
    const req = store.get([profileId, date]);
    req.onsuccess = () => {
      const prev = req.result || { profileId, date, correct: 0, wrong: 0, sessions: 0 };
      const next = {
        ...prev,
        correct: prev.correct + correct,
        wrong: prev.wrong + wrong,
        sessions: prev.sessions + 1,
      };
      store.put(next);
      resolve(next);
    };
    req.onerror = () => reject(req.error);
  }));
}

export async function getDailyStatsHistory(profileId, days = 14) {
  return tx('dailyStats', 'readonly', (store) => new Promise((resolve, reject) => {
    const idx = store.index('profileId');
    const req = idx.getAll(profileId);
    req.onsuccess = () => {
      const all = (req.result || []).sort((a, b) => a.date.localeCompare(b.date));
      resolve(all.slice(-days));
    };
    req.onerror = () => reject(req.error);
  }));
}

export async function initDefaultData(defaultVocab) {
  const existing = await getAllVocabulary();
  if (existing.length === 0) await saveVocabulary(defaultVocab);
  const profiles = await getProfiles();
  if (profiles.length === 0) await createProfile('Ich');
  if (!(await getMeta('initialized'))) await setMeta('initialized', true);
}

export async function exportBackup() {
  const [vocabulary, profiles, settingsList, progressList, dailyStats, playlists] = await Promise.all([
    getAllVocabulary(),
    getProfiles(),
    tx('settings', 'readonly', (s) => new Promise((res, rej) => {
      const r = s.getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    })),
    tx('progress', 'readonly', (s) => new Promise((res, rej) => {
      const r = s.getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    })),
    tx('dailyStats', 'readonly', (s) => new Promise((res, rej) => {
      const r = s.getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    })),
    getAllPlaylists(),
  ]);
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    vocabulary,
    profiles,
    settings: settingsList,
    progress: progressList,
    dailyStats,
    playlists,
    activeProfileId: await getActiveProfileId(),
    globalSettings: await getGlobalSettings(),
  };
}

export async function importBackup(data) {
  if (data.vocabulary) await saveVocabulary(data.vocabulary);
  if (data.profiles) {
    await tx('profiles', 'readwrite', (store) => {
      store.clear();
      for (const p of data.profiles) store.put(p);
    });
  }
  if (data.settings) {
    await tx('settings', 'readwrite', (store) => {
      for (const s of data.settings) store.put(s);
    });
  }
  if (data.progress) {
    await tx('progress', 'readwrite', (store) => {
      store.clear();
      for (const p of data.progress) store.put(p);
    });
  }
  if (data.dailyStats) {
    await tx('dailyStats', 'readwrite', (store) => {
      store.clear();
      for (const d of data.dailyStats) store.put(d);
    });
  }
  if (data.playlists) {
    await tx('playlists', 'readwrite', (store) => {
      store.clear();
      for (const p of data.playlists) store.put(p);
    });
  }
  if (data.globalSettings) await saveGlobalSettings(data.globalSettings);
  if (data.activeProfileId) await setActiveProfileId(data.activeProfileId);
}

export { uid };
