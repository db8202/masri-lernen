import { parseCSV } from './import.js';
import { mergeVocabulary, exportBackup, importBackup } from './storage.js';
import { parseSheetId, vocabSignature } from './utils.js';

/** Pull vocabulary from a public Google Sheet (CSV export) */
export async function syncFromGoogleSheet(sheetIdOrUrl) {
  const sheetId = parseSheetId(sheetIdOrUrl);
  if (!sheetId) throw new Error('Ungültige Google-Sheet-ID oder URL.');

  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Sheet nicht erreichbar. Ist es öffentlich freigegeben?');

  const text = await res.text();
  if (text.includes('<!DOCTYPE html') || text.includes('<html')) {
    throw new Error('Kein CSV erhalten. Sheet muss „Jeder mit Link" lesen können.');
  }

  const cards = parseCSV(text);
  if (!cards.length) throw new Error('Sheet enthält keine Vokabeln.');

  return mergeVocabulary(cards, vocabSignature);
}

/** Full bidirectional sync via Google Apps Script Web App */
export async function syncViaWebApp(webAppUrl, passphrase, profileId) {
  if (!webAppUrl?.trim()) throw new Error('Web-App-URL fehlt.');

  const base = webAppUrl.replace(/\/$/, '');
  const backup = await exportBackup();

  const pushRes = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'push', passphrase, profileId, backup }),
  });

  if (!pushRes.ok) throw new Error('Upload fehlgeschlagen: ' + pushRes.status);

  const pullRes = await fetch(`${base}?action=pull&passphrase=${encodeURIComponent(passphrase)}&profileId=${encodeURIComponent(profileId)}`);
  if (!pullRes.ok) throw new Error('Download fehlgeschlagen: ' + pullRes.status);

  const remote = await pullRes.json();
  if (remote?.backup) {
    await importBackup(remote.backup);
    return { mode: 'full', message: 'Vollständiger Sync abgeschlossen.' };
  }

  return { mode: 'push-only', message: 'Daten hochgeladen.' };
}

export async function shareBackup() {
  const backup = await exportBackup();
  const json = JSON.stringify(backup);
  const blob = new Blob([json], { type: 'application/json' });
  const file = new File([blob], `masri-backup-${Date.now()}.json`, { type: 'application/json' });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'Masri Lernen Backup' });
    return 'geteilt';
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
  return 'heruntergeladen';
}
