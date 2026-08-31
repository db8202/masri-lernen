import {
  initDefaultData, getAllVocabulary, getProfiles, getActiveProfileId, setActiveProfileId,
  createProfile, getSettings, saveSettings, getProgressMap, saveProgressEntry, resetProgress,
  exportBackup, importBackup, upsertVocabularyItem, deleteVocabularyItem, recordDailyStats,
  getDailyStatsHistory, uid, saveVocabulary, getAllPlaylists, upsertPlaylist, deletePlaylist,
} from './storage.js';
import {
  buildSessionQueue, countDue, getStats, getHardWords, gradeCard, getOrCreateProgress,
  updateStreak, getStreak, getTodayCount, incrementTodayCount,
} from './srs.js';
import { initSpeech, speakCard } from './speech.js';
import { importFile, downloadTemplate, normalizeGender, normalizeType } from './import.js';
import { syncFromGoogleSheet, syncViaWebApp, shareBackup } from './sync.js';
import { initNotifications, requestNotificationPermission, scheduleReminderCheck } from './notifications.js';
import { buildMCOptions, renderMCOptions, getPromptText, getTypePrompt } from './quiz.js';
import { renderProgressChart } from './charts.js';
import { isRecordingSupported, startRecording, stopRecording } from './audio-recorder.js';
import { cacheAllAudio, importAudioFiles, fileToAudioData, autoAudioFilename, hasAudioSource } from './audio-files.js';
import { esc, $, $$, genderLabel, answersMatch, suggestAudioFilename } from './utils.js';
import { toast, confirmDialog } from './toast.js';
import { HELP, showHelpDialog, maybeShowWelcome } from './help.js';
import { importEgyptianPack } from './vocab-pack.js';
import { listCategories, renameCategory, mergeCategories, deleteCategory } from './categories.js';
import { getMissingAudioCards, countMissingAudio } from './record-assistant.js';

const state = {
  vocabulary: [], profiles: [], playlists: [], activeProfileId: null, settings: null,
  progressMap: new Map(), grammar: [],
  session: { queue: [], index: 0, correct: 0, wrong: 0, recordAssistant: false },
  flipped: false, recording: false, recordingCardId: null,
  deferredInstall: null, selectedMode: 'flashcard',
  editingPlaylistIds: new Set(),
};

async function boot() {
  const [vocabRes, grammarRes] = await Promise.all([
    fetch('./data/vocabulary.json'), fetch('./data/grammar.json'),
  ]);
  await initDefaultData(await vocabRes.json());
  state.grammar = await grammarRes.json();
  await initSpeech();
  await refreshState();
  bindUI();
  registerSW();
  setupInstallPrompt();
  renderAll();
  initNotifications(state.settings, state.activeProfileId, state.settings?.dailyGoal);
  maybeShowWelcome();
  renderHelpTab();
}

async function refreshState() {
  state.vocabulary = await getAllVocabulary();
  state.playlists = await getAllPlaylists();
  state.profiles = await getProfiles();
  state.activeProfileId = await getActiveProfileId();
  if (!state.activeProfileId && state.profiles[0]) {
    state.activeProfileId = state.profiles[0].id;
    await setActiveProfileId(state.activeProfileId);
  }
  state.settings = await getSettings(state.activeProfileId);
  state.progressMap = await getProgressMap(state.activeProfileId);
  state.selectedMode = state.settings?.studyMode || 'flashcard';
}

function sessionOptions(opts = {}) {
  const s = state.settings || {};
  return {
    limit: opts.limit || s.dailyGoal || 10,
    category: opts.category || null,
    type: opts.type || null,
    dueOnly: opts.dueOnly || false,
    dailyGoal: s.dailyGoal || 10,
    wordsOnly: s.wordsOnly && !opts.type,
    speakerGender: s.speakerGender || 'n',
    genderStrict: s.genderStrict || false,
    cardIds: opts.cardIds || null,
  };
}

function bindUI() {
  $$('.tab').forEach((t) => t.addEventListener('click', () => switchView(t.dataset.view)));
  $('#btn-help').addEventListener('click', () => switchView('help'));
  $('#btn-profile').addEventListener('click', openProfileDialog);
  $$('[data-help]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.help;
      const titles = { audio: 'Sprachdateien', offline: 'Offline', excel: 'Excel', modes: 'Lernmodi', profiles: 'Profile', playlists: 'Listen', pack: 'Vokabel-Paket' };
      showHelpDialog(titles[key] || 'Hilfe', HELP[key] || '');
    });
  });
  $('#vocab-german').addEventListener('input', updateAudioHint);
  $('#profile-form').addEventListener('submit', onCreateProfile);
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => $(`#${b.dataset.close}`).close()));

  $('#btn-start-daily').addEventListener('click', () => startSession({}));
  $('#btn-review-due').addEventListener('click', () => startSession({ dueOnly: true }));
  $('#btn-all-words').addEventListener('click', () => startSession({ limit: 30 }));
  $('#btn-sentences').addEventListener('click', () => startSession({ type: 'sentence' }));
  $('#btn-record-assistant').addEventListener('click', startRecordAssistant);
  $('#btn-record-assistant-data').addEventListener('click', startRecordAssistant);
  $('#btn-new-playlist').addEventListener('click', () => openPlaylistDialog());
  $('#btn-new-playlist-data').addEventListener('click', () => openPlaylistDialog());
  $('#playlist-form').addEventListener('submit', onPlaylistSave);
  $('#btn-delete-playlist').addEventListener('click', onDeletePlaylist);
  $('#playlist-word-search').addEventListener('input', renderPlaylistPicker);
  $('#btn-import-pack').addEventListener('click', onImportPack);
  $('#btn-record-skip').addEventListener('click', () => advanceRecordAssistant(false));
  $('#btn-record-done').addEventListener('click', () => advanceRecordAssistant(true));

  $$('.mode-btn').forEach((btn) => btn.addEventListener('click', () => {
    $$('.mode-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.selectedMode = btn.dataset.mode;
    if (state.settings) {
      state.settings.studyMode = btn.dataset.mode;
      saveSettings(state.activeProfileId, state.settings);
    }
  }));

  $('#flashcard').addEventListener('click', onCardTap);
  $('#btn-wrong').addEventListener('click', () => completeCard(0));
  $('#btn-correct').addEventListener('click', () => completeCard(2));
  $('#btn-speak').addEventListener('click', (e) => { e.stopPropagation(); speakCurrent(); });
  $('#btn-record').addEventListener('click', (e) => { e.stopPropagation(); toggleRecording(); });
  $('#btn-back-learn').addEventListener('click', () => switchView('home'));
  $('#btn-finished-home').addEventListener('click', () => switchView('home'));
  $('#btn-type-check').addEventListener('click', checkTypedAnswer);
  $('#type-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') checkTypedAnswer(); });

  ['input-daily-goal', 'select-direction', 'select-study-mode', 'select-speaker-gender',
    'check-gender-strict', 'check-words-only', 'check-reminder', 'input-reminder-time',
    'input-sheet-id', 'input-sync-url', 'input-sync-pass'].forEach((id) => {
    $(`#${id}`)?.addEventListener('change', onSettingsChange);
  });
  $('#btn-enable-notifications').addEventListener('click', async () => {
    const p = await requestNotificationPermission();
    toast(p === 'granted' ? 'Benachrichtigungen aktiviert!' : 'In Browser-Einstellungen erlauben.', p === 'granted' ? 'success' : 'warn');
  });

  const uploadZone = $('#upload-zone');
  uploadZone.addEventListener('click', () => $('#file-input').click());
  uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault(); uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleImport(e.dataTransfer.files[0]);
  });
  $('#file-input').addEventListener('change', (e) => { if (e.target.files[0]) handleImport(e.target.files[0]); e.target.value = ''; });

  $('#vocab-form').addEventListener('submit', onVocabSave);
  $('#vocab-clear').addEventListener('click', clearVocabForm);
  $('#btn-export').addEventListener('click', onExport);
  $('#btn-import-backup').addEventListener('click', () => $('#backup-input').click());
  $('#backup-input').addEventListener('change', onImportBackup);
  $('#btn-share-backup').addEventListener('click', () => shareBackup().then((m) => toast(`Backup ${m}!`, 'success')).catch((e) => toast(e.message, 'error')));
  $('#btn-download-template').addEventListener('click', downloadTemplate);
  $('#btn-reset-progress').addEventListener('click', onResetProgress);
  $('#btn-sync-sheet').addEventListener('click', onSyncSheet);
  $('#btn-cloud-sync').addEventListener('click', onCloudSync);
  $('#btn-offline-pack').addEventListener('click', onOfflinePack);
  $('#audio-upload-zone').addEventListener('click', () => $('#audio-file-input').click());
  $('#audio-file-input').addEventListener('change', onAudioBulkImport);
  $('#vocab-search').addEventListener('input', renderVocabList);
  $('#btn-install')?.addEventListener('click', async () => { if (state.deferredInstall) { await state.deferredInstall.prompt(); $('#install-banner').classList.add('hidden'); } });
  $('#btn-dismiss-install')?.addEventListener('click', () => { $('#install-banner').classList.add('hidden'); localStorage.setItem('installDismissed', '1'); });
}

function switchView(name) {
  $$('.view').forEach((v) => v.classList.remove('active'));
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
  $(`#view-${name}`)?.classList.add('active');
  if (['home', 'stats', 'data', 'grammar', 'help'].includes(name)) renderAll();
  if (name === 'learn') resetLearnUI();
}

async function onSettingsChange() {
  state.settings = {
    ...state.settings,
    dailyGoal: parseInt($('#input-daily-goal').value, 10) || 10,
    direction: $('#select-direction').value,
    studyMode: $('#select-study-mode').value,
    speakerGender: $('#select-speaker-gender').value,
    genderStrict: $('#check-gender-strict').checked,
    wordsOnly: $('#check-words-only').checked,
    reminderEnabled: $('#check-reminder').checked,
    reminderTime: $('#input-reminder-time').value || '18:00',
    googleSheetId: $('#input-sheet-id')?.value?.trim() || '',
    syncWebAppUrl: $('#input-sync-url')?.value?.trim() || '',
    syncPassphrase: $('#input-sync-pass')?.value?.trim() || '',
  };
  state.selectedMode = state.settings.studyMode;
  await saveSettings(state.activeProfileId, state.settings);
  scheduleReminderCheck(state.settings, state.activeProfileId, state.settings.dailyGoal);
  renderHome(); renderStats();
}

function renderAll() {
  renderHome();
  renderStats();
  renderData();
  renderGrammar();
  renderProfileGreeting();
  renderPlaylists();
  renderCategoryManager();
  updateMissingAudioCounts();
}

function updateMissingAudioCounts() {
  const n = countMissingAudio(state.vocabulary);
  if ($('#missing-audio-count')) $('#missing-audio-count').textContent = n;
  if ($('#missing-audio-count-data')) $('#missing-audio-count-data').textContent = n;
}

function renderPlaylists() {
  const grid = $('#playlist-grid');
  const list = $('#playlist-list');
  if (!grid && !list) return;

  const html = (pl) => {
    const total = pl.cardIds?.length || 0;
    const learned = pl.cardIds?.filter((id) => getOrCreateProgress(state.progressMap, id).correctCount > 0).length || 0;
    return `<div class="playlist-item">
      <button class="playlist-btn" data-playlist="${pl.id}" style="--pl-color:${pl.color}">
        <strong>${esc(pl.name)}</strong><small>${learned}/${total} Wörter</small>
      </button>
      <button class="btn-icon edit-playlist" data-id="${pl.id}" title="Bearbeiten">✏️</button>
    </div>`;
  };

  const bind = (root) => {
    root.querySelectorAll('.playlist-btn').forEach((btn) => {
      btn.addEventListener('click', () => startSession({ playlistId: btn.dataset.playlist, limit: 999 }));
    });
    root.querySelectorAll('.edit-playlist').forEach((btn) => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); openPlaylistDialog(btn.dataset.id); });
    });
  };

  if (grid) {
    grid.innerHTML = state.playlists.length
      ? state.playlists.map(html).join('')
      : '<p class="hint">Noch keine Listen — tippe „+ Neue Liste"</p>';
    bind(grid);
  }
  if (list) {
    list.innerHTML = state.playlists.length
      ? state.playlists.map(html).join('')
      : '<p class="hint">Noch keine Listen angelegt.</p>';
    bind(list);
  }
}

function renderCategoryManager() {
  const el = $('#category-manager');
  if (!el) return;
  const cats = listCategories(state.vocabulary);
  if (!cats.length) {
    el.innerHTML = '<p class="hint">Noch keine Kategorien.</p>';
    return;
  }
  el.innerHTML = cats.map(([name, count]) => `
    <div class="cat-manage-row" data-cat="${encodeURIComponent(name)}">
      <span><strong>${esc(name)}</strong> <small>(${count})</small></span>
      <div class="cat-manage-actions">
        <button class="btn-icon cat-rename" title="Umbenennen">✏️</button>
        <button class="btn-icon cat-merge" title="Zusammenführen">🔀</button>
        <button class="btn-icon cat-delete" title="Auflösen">🗑️</button>
      </div>
    </div>`).join('');

  el.querySelectorAll('.cat-rename').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const oldName = decodeURIComponent(btn.closest('.cat-manage-row').dataset.cat);
      const neu = prompt(`Kategorie „${oldName}" umbenennen in:`, oldName);
      if (!neu || neu === oldName) return;
      const n = await renameCategory(oldName, neu);
      state.vocabulary = await getAllVocabulary();
      toast(`${n} Wörter umbenannt`, 'success');
      renderAll();
    });
  });

  el.querySelectorAll('.cat-merge').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const from = decodeURIComponent(btn.closest('.cat-manage-row').dataset.cat);
      const target = prompt(`„${from}" zusammenführen mit Kategorie:`, 'Sonstiges');
      if (!target) return;
      const n = await mergeCategories(from, target);
      state.vocabulary = await getAllVocabulary();
      toast(`${n} Wörter → „${target}"`, 'success');
      renderAll();
    });
  });

  el.querySelectorAll('.cat-delete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const name = decodeURIComponent(btn.closest('.cat-manage-row').dataset.cat);
      if (!confirmDialog(`Kategorie „${name}" auflösen? Wörter wandern nach „Sonstiges".`)) return;
      const n = await deleteCategory(name);
      state.vocabulary = await getAllVocabulary();
      toast(`${n} Wörter verschoben`, 'success');
      renderAll();
    });
  });
}

function openPlaylistDialog(id = null) {
  const pl = id ? state.playlists.find((p) => p.id === id) : null;
  $('#playlist-id').value = pl?.id || '';
  $('#playlist-name').value = pl?.name || '';
  $('#playlist-dialog-title').textContent = pl ? 'Liste bearbeiten' : 'Neue Liste';
  $('#btn-delete-playlist').classList.toggle('hidden', !pl);
  state.editingPlaylistIds = new Set(pl?.cardIds || []);
  renderPlaylistPicker();
  $('#playlist-dialog').showModal();
}

function renderPlaylistPicker() {
  const q = ($('#playlist-word-search')?.value || '').toLowerCase();
  const items = state.vocabulary.filter((v) => !q || [v.german, v.egyptian, v.category].some((x) => String(x).toLowerCase().includes(q)));
  const picker = $('#playlist-word-picker');
  if (!picker) return;
  picker.innerHTML = items.slice(0, 120).map((v) => {
    const checked = state.editingPlaylistIds.has(v.id) ? 'checked' : '';
    return `<label class="picker-row"><input type="checkbox" data-id="${v.id}" ${checked}>
      <span>${esc(v.german)} → <span dir="rtl">${esc(v.egyptian)}</span> <small>(${esc(v.category)})</small></span></label>`;
  }).join('');
  picker.querySelectorAll('input[type=checkbox]').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) state.editingPlaylistIds.add(cb.dataset.id);
      else state.editingPlaylistIds.delete(cb.dataset.id);
    });
  });
}

async function onPlaylistSave(e) {
  e.preventDefault();
  const name = $('#playlist-name').value.trim();
  if (!name) return;
  const colors = ['#14b8a6', '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6'];
  const id = $('#playlist-id').value;
  const existing = id ? state.playlists.find((p) => p.id === id) : null;
  await upsertPlaylist({
    id: id || undefined,
    name,
    cardIds: [...state.editingPlaylistIds],
    color: existing?.color || colors[state.playlists.length % colors.length],
    createdAt: existing?.createdAt,
  });
  state.playlists = await getAllPlaylists();
  $('#playlist-dialog').close();
  toast('Liste gespeichert!', 'success');
  renderPlaylists();
}

async function onDeletePlaylist() {
  const id = $('#playlist-id').value;
  if (!id || !confirmDialog('Liste wirklich löschen?')) return;
  await deletePlaylist(id);
  state.playlists = await getAllPlaylists();
  $('#playlist-dialog').close();
  toast('Liste gelöscht', 'success');
  renderPlaylists();
}

async function onImportPack() {
  const btn = $('#btn-import-pack');
  const status = $('#pack-import-status');
  if (!confirmDialog('~6.300 Wörter mit Audio laden? Das kann 1–2 Minuten dauern und braucht Internet.')) return;
  btn.disabled = true;
  try {
    const r = await importEgyptianPack((p) => {
      if (p.phase === 'fetch') {
        status.textContent = `Lade ${p.done}/${p.total}… (${p.words || 0} Wörter)`;
      } else {
        status.textContent = 'Speichere in App…';
      }
    });
    state.vocabulary = await getAllVocabulary();
    status.textContent = `✅ Fertig: ${r.added} neu, ${r.updated} aktualisiert · ${r.total} gesamt`;
    toast(`Paket importiert: ${r.added} neue Wörter!`, 'success');
    renderAll();
  } catch (err) {
    status.textContent = '';
    toast(err.message, 'error');
  }
  btn.disabled = false;
}

function startRecordAssistant() {
  const missing = getMissingAudioCards(state.vocabulary);
  if (!missing.length) { toast('Alle Wörter haben Audio! 🎉', 'success'); return; }
  state.session = {
    queue: missing,
    index: 0,
    correct: 0,
    wrong: 0,
    studyMode: 'flashcard',
    recordAssistant: true,
  };
  switchView('learn');
  showCurrentItem();
}

function advanceRecordAssistant() {
  state.session.index += 1;
  showCurrentItem();
}

function renderHelpTab() {
  const el = $('#help-audio-text');
  if (el) el.textContent = HELP.audio.split('\n').slice(0, 6).join('\n') + '\n…';
}

function updateAudioHint() {
  const german = $('#vocab-german').value.trim();
  const id = $('#vocab-id').value;
  const suggested = suggestAudioFilename(german, id);
  const hint = $('#vocab-audio-hint');
  const field = $('#vocab-audio-file');
  if (!german) { hint.textContent = ''; return; }
  if (!field.value.trim()) field.placeholder = suggested;
  hint.textContent = suggested
    ? `💡 Die App sucht automatisch: audio/${suggested}`
    : '';
}

function audioBadge(v) {
  if (v.audioData) return ' 🎙️';
  if (v.audioFile || v.german) return ' 🔊';
  return '';
}

function renderProfileGreeting() {
  const p = state.profiles.find((x) => x.id === state.activeProfileId);
  $('#profile-greeting').textContent = p ? `Hallo ${p.name}! · Masri ↔ Deutsch` : 'Masri ↔ Deutsch';
}

function renderHome() {
  const goal = state.settings?.dailyGoal || 10;
  const today = getTodayCount(state.activeProfileId);
  const due = countDue(state.vocabulary, state.progressMap, sessionOptions());
  $('#daily-count').textContent = today;
  $('#daily-goal').textContent = goal;
  $('#daily-ring').style.setProperty('--pct', `${Math.min(100, Math.round((today / goal) * 100))}%`);
  $('#daily-message').textContent = today >= goal ? '🎉 Tagesziel erreicht!' : `${goal - today} bis Ziel · ${due} fällig`;
  $('#due-count').textContent = due;
  $$('.mode-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === state.selectedMode));
  const categories = [...new Set(state.vocabulary.map((v) => v.category))].sort();
  $('#category-grid').innerHTML = categories.map((cat) => {
    const total = state.vocabulary.filter((v) => v.category === cat).length;
    const learned = state.vocabulary.filter((v) => v.category === cat && getOrCreateProgress(state.progressMap, v.id).correctCount > 0).length;
    return `<button class="category-btn" data-category="${esc(cat)}"><strong>${esc(cat)}</strong><small>${learned}/${total}</small></button>`;
  }).join('');
  $('#category-grid').querySelectorAll('.category-btn').forEach((btn) => {
    btn.addEventListener('click', () => startSession({ category: btn.dataset.category }));
  });
}

async function renderStats() {
  const stats = getStats(state.vocabulary, state.progressMap);
  $('#stat-total').textContent = stats.total;
  $('#stat-learned').textContent = stats.learned;
  $('#stat-streak').textContent = getStreak(state.activeProfileId);
  $('#stat-today').textContent = getTodayCount(state.activeProfileId);
  const s = state.settings || {};
  $('#input-daily-goal').value = s.dailyGoal || 10;
  $('#select-direction').value = s.direction || 'de-eg';
  $('#select-study-mode').value = s.studyMode || 'flashcard';
  $('#select-speaker-gender').value = s.speakerGender || 'n';
  $('#check-gender-strict').checked = !!s.genderStrict;
  $('#check-words-only').checked = !!s.wordsOnly;
  $('#check-reminder').checked = !!s.reminderEnabled;
  $('#input-reminder-time').value = s.reminderTime || '18:00';
  if ($('#input-sheet-id')) $('#input-sheet-id').value = s.googleSheetId || '';
  if ($('#input-sync-url')) $('#input-sync-url').value = s.syncWebAppUrl || '';
  if ($('#input-sync-pass')) $('#input-sync-pass').value = s.syncPassphrase || '';
  $('#category-stats').innerHTML = Object.entries(stats.byCategory).map(([cat, d]) => {
    const pct = d.total ? Math.round((d.learned / d.total) * 100) : 0;
    return `<div class="cat-stat-row"><span>${esc(cat)}</span><span>${d.learned}/${d.total}</span></div><div class="cat-stat-bar"><div class="cat-stat-fill" style="width:${pct}%"></div></div>`;
  }).join('');
  const hard = getHardWords(state.vocabulary, state.progressMap);
  $('#hard-list').innerHTML = hard.length ? hard.map((w) => `<li>${esc(w.german)} → <span dir="rtl">${esc(w.egyptian)}</span></li>`).join('') : '<li>Noch keine schwierigen Wörter 🎉</li>';
  renderProgressChart($('#progress-chart'), await getDailyStatsHistory(state.activeProfileId, 14));
}

function renderGrammar() {
  $('#grammar-list').innerHTML = state.grammar.map((g) =>
    `<article class="card grammar-card"><h2>${esc(g.title)}</h2><p class="hint">${esc(g.summary)}</p><ul class="grammar-points">${g.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></article>`
  ).join('');
}

function renderData() {
  $('#vocab-count').textContent = state.vocabulary.length;
  $('#category-suggestions').innerHTML = [...new Set(state.vocabulary.map((v) => v.category))].map((c) => `<option value="${esc(c)}">`).join('');
  renderVocabList();
}

function renderVocabList() {
  const q = ($('#vocab-search').value || '').toLowerCase();
  const items = state.vocabulary.filter((v) => !q || [v.german, v.egyptian, v.transliteration, v.category].some((x) => String(x).toLowerCase().includes(q)));
  $('#vocab-list').innerHTML = items.slice(0, 80).map((v) =>
    `<div class="vocab-item"><div><strong>${esc(v.category)}</strong> · ${esc(v.german)} → <span dir="rtl">${esc(v.egyptian)}</span>${audioBadge(v)}</div>
    <div class="vocab-item-actions"><button class="btn-icon edit-vocab" data-id="${v.id}">✏️</button><button class="btn-icon delete-vocab" data-id="${v.id}">🗑️</button></div></div>`
  ).join('');
  $('#vocab-list').querySelectorAll('.edit-vocab').forEach((b) => b.addEventListener('click', () => loadVocabToForm(b.dataset.id)));
  $('#vocab-list').querySelectorAll('.delete-vocab').forEach((b) => b.addEventListener('click', () => onDeleteVocab(b.dataset.id)));
}

function loadVocabToForm(id) {
  const v = state.vocabulary.find((x) => x.id === id);
  if (!v) return;
  $('#vocab-id').value = v.id;
  $('#vocab-category').value = v.category;
  $('#vocab-german').value = v.german;
  $('#vocab-egyptian').value = v.egyptian;
  $('#vocab-translit').value = v.transliteration;
  $('#vocab-gender').value = v.gender;
  $('#vocab-type').value = v.type;
  $('#vocab-note').value = v.note || '';
  $('#vocab-audio-file').value = v.audioFile || '';
  switchView('data');
}

function clearVocabForm() { $('#vocab-form').reset(); $('#vocab-id').value = ''; }

async function onVocabSave(e) {
  e.preventDefault();
  const id = $('#vocab-id').value || uid();
  const existing = state.vocabulary.find((v) => v.id === id);
  let audioData = existing?.audioData || null;
  const upload = $('#vocab-audio-upload').files[0];
  if (upload) audioData = await fileToAudioData(upload);

  const german = $('#vocab-german').value.trim();
  let audioFile = $('#vocab-audio-file').value.trim();
  if (!audioFile && !audioData) audioFile = autoAudioFilename({ german, id });

  await upsertVocabularyItem({
    id, category: $('#vocab-category').value.trim(), german,
    egyptian: $('#vocab-egyptian').value.trim(), transliteration: $('#vocab-translit').value.trim(),
    gender: normalizeGender($('#vocab-gender').value), type: normalizeType($('#vocab-type').value),
    note: $('#vocab-note').value.trim(),
    audioFile,
    audioUrl: '',
    audioData,
  });
  state.vocabulary = await getAllVocabulary();
  clearVocabForm();
  toast('Vokabel gespeichert!', 'success');
  renderData(); renderHome();
}

async function onDeleteVocab(id) {
  if (!confirmDialog('Vokabel löschen?')) return;
  await deleteVocabularyItem(id);
  state.vocabulary = await getAllVocabulary();
  renderData();
}

function startSession(opts = {}) {
  const mode = state.selectedMode || state.settings?.studyMode || 'flashcard';
  let optsMerged = { ...opts };

  if (opts.playlistId) {
    const pl = state.playlists.find((p) => p.id === opts.playlistId);
    if (!pl?.cardIds?.length) { toast('Liste ist leer.', 'warn'); return; }
    optsMerged = { ...optsMerged, cardIds: pl.cardIds, limit: pl.cardIds.length };
  }

  const queue = buildSessionQueue(state.vocabulary, state.progressMap, sessionOptions(optsMerged));
  if (!queue.length) { toast('Keine Vokabeln für diese Auswahl.', 'warn'); return; }
  const dir = state.settings?.direction || 'de-eg';
  state.session = {
    queue: queue.map((c) => ({ ...c, _direction: dir === 'mixed' ? (Math.random() > 0.5 ? 'de-eg' : 'eg-de') : dir })),
    index: 0, correct: 0, wrong: 0, studyMode: mode, recordAssistant: false,
  };
  switchView('learn');
  showCurrentItem();
}

function resetLearnUI() {
  $('#learn-actions').classList.add('hidden');
  $('#record-assistant-actions')?.classList.add('hidden');
  $('#record-assistant-banner')?.classList.add('hidden');
  $('#learn-finished').classList.add('hidden');
  ['panel-flashcard', 'panel-mc', 'panel-type'].forEach((id) => $(`#${id}`)?.classList.add('hidden'));
  state.flipped = false;
}

function showCurrentItem() {
  const { queue, index, studyMode, recordAssistant } = state.session;
  if (index >= queue.length) { finishSession(); return; }
  const mode = recordAssistant ? 'flashcard' : (studyMode || 'flashcard');
  ['panel-flashcard', 'panel-mc', 'panel-type'].forEach((id) => $(`#${id}`)?.classList.toggle('hidden', id !== `panel-${mode}`));
  $('#learn-finished').classList.add('hidden');
  $('#record-assistant-banner')?.classList.toggle('hidden', !recordAssistant);
  $('#record-assistant-actions')?.classList.toggle('hidden', !recordAssistant);
  if (recordAssistant) $('#learn-actions')?.classList.add('hidden');

  const labels = { flashcard: recordAssistant ? 'Aufnahme-Assistent' : 'Karteikarten', mc: 'Auswahl-Quiz', type: 'Eingabe-Quiz' };
  $('#learn-mode-label').textContent = labels[mode];
  $('#learn-counter').textContent = `${index + 1} / ${queue.length}`;
  if (recordAssistant && $('#record-assistant-hint')) {
    $('#record-assistant-hint').textContent = 'Tippe 🎙️ Aufnahme, sprich das Wort, stoppe — dann „Fertig → Weiter".';
  }
  const card = queue[index];
  if (mode === 'flashcard') showFlashcard(card);
  else if (mode === 'mc') showMC(card);
  else showType(card);
}

function showFlashcard(card) {
  const dir = card._direction || 'de-eg';
  const ra = state.session.recordAssistant;
  $('#card-type-badge').textContent = card.type === 'sentence' ? 'Satz' : 'Wort';
  $('#card-category').textContent = card.category;
  $('#card-front-text').textContent = dir === 'de-eg' ? card.german : card.egyptian;
  $('#card-front-text').dir = dir === 'eg-de' ? 'rtl' : 'ltr';
  $('#card-arabic').textContent = dir === 'de-eg' ? card.egyptian : card.german;
  $('#card-arabic').dir = dir === 'de-eg' ? 'rtl' : 'ltr';
  $('#card-translit').textContent = card.transliteration || '';
  $('#card-note').textContent = [genderLabel(card.gender), card.note].filter(Boolean).join(' · ');
  $('#btn-record').classList.toggle('hidden', !isRecordingSupported());
  state.flipped = !!ra;
  $('#flashcard').classList.toggle('flipped', !!ra);
  $('#learn-actions').classList.toggle('hidden', ra || !state.flipped);
}

function showMC(card) {
  const dir = card._direction || 'de-eg';
  const prompt = getPromptText(card, dir);
  const correct = dir === 'de-eg' ? card.egyptian : card.german;
  $('#mc-category').textContent = card.category;
  $('#mc-prompt').textContent = prompt.text;
  $('#mc-prompt').dir = prompt.dir;
  $('#mc-hint').textContent = prompt.hint;
  const container = $('#mc-options');
  container.dataset.locked = '';
  renderMCOptions(container, buildMCOptions(card, state.vocabulary, dir), correct, (q) => completeCard(q));
}

function showType(card) {
  const dir = card._direction || 'de-eg';
  const prompt = getTypePrompt(card, dir);
  $('#type-category').textContent = card.category;
  $('#type-prompt').textContent = prompt.text;
  $('#type-prompt').dir = prompt.dir;
  $('#type-input').value = '';
  $('#type-input').placeholder = prompt.placeholder;
  $('#type-feedback').classList.add('hidden');
}

function checkTypedAnswer() {
  const card = state.session.queue[state.session.index];
  const ok = answersMatch($('#type-input').value, card, card._direction || 'de-eg');
  const fb = $('#type-feedback');
  fb.classList.remove('hidden');
  if (ok) { fb.textContent = '✓ Richtig!'; fb.className = 'type-feedback correct'; setTimeout(() => completeCard(2), 600); }
  else {
    const dir = card._direction || 'de-eg';
    fb.textContent = `✗ Richtig: ${dir === 'de-eg' ? card.egyptian : card.german}`;
    fb.className = 'type-feedback wrong';
    setTimeout(() => completeCard(0), 1400);
  }
}

function onCardTap(e) {
  if (e.target.closest('.btn-audio') || state.flipped) return;
  state.flipped = true;
  $('#flashcard').classList.add('flipped');
  $('#learn-actions').classList.remove('hidden');
}

function speakCurrent() { speakCard(state.session.queue[state.session.index]).catch(() => {}); }

async function toggleRecording() {
  const btn = $('#btn-record');
  const card = state.session.queue[state.session.index];
  if (!card || !isRecordingSupported()) return;
  if (!state.recording) {
    try {
      state.recordingPromise = startRecording();
      state.recording = true;
      state.recordingCardId = card.id;
      btn.textContent = '⏹️ Stoppen';
      btn.classList.add('recording');
    } catch { toast('Mikrofon verweigert.', 'error'); }
  } else {
    stopRecording();
    btn.textContent = '🎙️ Aufnahme';
    btn.classList.remove('recording');
    state.recording = false;
    try {
      const audioData = await state.recordingPromise;
      if (audioData && state.recordingCardId) {
        const updated = { ...card, audioData };
        await upsertVocabularyItem(updated);
        state.session.queue[state.session.index] = updated;
        state.vocabulary = await getAllVocabulary();
        toast('Aufnahme gespeichert!', 'success');
        updateMissingAudioCounts();
        if (state.session.recordAssistant) advanceRecordAssistant();
      }
    } catch { /* cancelled */ }
  }
}

async function completeCard(quality) {
  const card = state.session.queue[state.session.index];
  const updated = gradeCard(getOrCreateProgress(state.progressMap, card.id), quality);
  await saveProgressEntry(state.activeProfileId, card.id, updated);
  state.progressMap.set(card.id, updated);
  if (quality === 0) state.session.wrong += 1; else state.session.correct += 1;
  incrementTodayCount(state.activeProfileId);
  updateStreak(state.activeProfileId);
  state.session.index += 1;
  showCurrentItem();
}

async function finishSession() {
  ['panel-flashcard', 'panel-mc', 'panel-type'].forEach((id) => $(`#${id}`)?.classList.add('hidden'));
  $('#record-assistant-banner')?.classList.add('hidden');
  $('#record-assistant-actions')?.classList.add('hidden');
  $('#learn-finished').classList.remove('hidden');
  const { correct, wrong, queue, recordAssistant } = state.session;
  if (recordAssistant) {
    $('#finished-summary').textContent = `🎙️ ${queue.length} Wörter durchgegangen — Aufnahmen gespeichert!`;
  } else {
    $('#finished-summary').textContent = `${correct} richtig, ${wrong} falsch · ${queue.length} Karten`;
    await recordDailyStats(state.activeProfileId, { correct, wrong });
  }
}

async function openProfileDialog() {
  $('#profile-list').innerHTML = state.profiles.map((p) =>
    `<div class="profile-item ${p.id === state.activeProfileId ? 'active' : ''}" data-id="${p.id}"><div class="profile-avatar" style="background:${p.color}">${p.name.charAt(0).toUpperCase()}</div><span>${esc(p.name)}</span></div>`
  ).join('');
  $('#profile-list').querySelectorAll('.profile-item').forEach((el) => {
    el.addEventListener('click', async () => { await setActiveProfileId(el.dataset.id); await refreshState(); $('#profile-dialog').close(); renderAll(); });
  });
  $('#profile-dialog').showModal();
}

async function onCreateProfile(e) {
  e.preventDefault();
  const name = $('#new-profile-name').value.trim();
  if (!name) return;
  await createProfile(name);
  await refreshState();
  $('#new-profile-name').value = '';
  $('#profile-dialog').close();
  renderAll();
}

async function handleImport(file) {
  try {
    const r = await importFile(file);
    state.vocabulary = await getAllVocabulary();
    toast(`${r.added} neu, ${r.updated} aktualisiert`, 'success');
    renderAll();
  } catch (err) { toast(err.message, 'error'); }
}

async function onImportBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  try { await importBackup(JSON.parse(await file.text())); await refreshState(); toast('Backup OK!', 'success'); renderAll(); }
  catch (err) { toast(err.message, 'error'); }
  e.target.value = '';
}

async function onExport() {
  const blob = new Blob([JSON.stringify(await exportBackup(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `masri-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}

async function onResetProgress() {
  if (!confirmDialog('Fortschritt zurücksetzen?')) return;
  await resetProgress(state.activeProfileId);
  state.progressMap = new Map();
  renderAll();
}

async function onSyncSheet() {
  const sheetId = $('#input-sheet-id').value.trim();
  if (!sheetId) { toast('Sheet-ID fehlt.', 'warn'); return; }
  try {
    const r = await syncFromGoogleSheet(sheetId);
    state.settings.googleSheetId = sheetId;
    await saveSettings(state.activeProfileId, state.settings);
    state.vocabulary = r.merged;
    toast(`Sync: ${r.added} neu, ${r.updated} aktualisiert`, 'success');
    renderAll();
  } catch (err) { toast(err.message, 'error'); }
}

async function onCloudSync() {
  const url = $('#input-sync-url').value.trim();
  const pass = $('#input-sync-pass').value.trim();
  if (!url || !pass) { toast('URL + Passphrase nötig.', 'warn'); return; }
  try {
    const r = await syncViaWebApp(url, pass, state.activeProfileId);
    await refreshState();
    toast(r.message, 'success');
    renderAll();
  } catch (err) { toast(err.message, 'error'); }
}

async function onOfflinePack() {
  const btn = $('#btn-offline-pack');
  const status = $('#offline-status');
  btn.disabled = true;
  status.textContent = 'Lade Offline-Paket… (einmal online nötig)';
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.update();
    }
    const r = await cacheAllAudio(state.vocabulary, (done, total, saved) => {
      status.textContent = `Audio: ${done}/${total} (${saved} gespeichert)`;
    });
    status.textContent = `✅ Offline bereit: ${r.cached} Sprachdateien + App gecacht. Flugmodus testen!`;
    toast('Offline-Paket geladen!', 'success');
  } catch (err) {
    status.textContent = '';
    toast(err.message, 'error');
  }
  btn.disabled = false;
}

async function onAudioBulkImport(e) {
  const files = [...e.target.files];
  if (!files.length) return;
  try {
    const { updated, matched, unmatched } = await importAudioFiles(files, state.vocabulary);
    await saveVocabulary(updated);
    state.vocabulary = updated;
    toast(`${matched} Sprachdateien zugeordnet${unmatched.length ? `, ${unmatched.length} nicht erkannt` : ''}`, matched ? 'success' : 'warn');
    if (unmatched.length) toast(`Nicht erkannt: ${unmatched.slice(0, 3).join(', ')}${unmatched.length > 3 ? '…' : ''}`, 'warn', 5000);
    renderData();
  } catch (err) { toast(err.message, 'error'); }
  e.target.value = '';
}

function registerSW() { if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {}); }

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); state.deferredInstall = e;
    if (!localStorage.getItem('installDismissed')) $('#install-banner').classList.remove('hidden');
  });
}

boot().catch((err) => { document.body.innerHTML = `<div style="padding:2rem;color:#fff;text-align:center"><h2>Fehler</h2><p>${esc(err.message)}</p></div>`; });
