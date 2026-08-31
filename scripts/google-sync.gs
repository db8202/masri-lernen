/**
 * Masri Lernen – Google Apps Script für Geräte-Sync
 *
 * Anleitung (einmalig, kostenlos):
 * 1. Google Sheet erstellen
 * 2. Erweiterungen → Apps Script
 * 3. Diesen Code einfügen → Speichern
 * 4. Bereitstellen → Neue Bereitstellung → Web-App
 *    - Ausführen als: Ich
 *    - Zugriff: Jeder
 * 5. URL in der App unter „Sync Web-App URL" eintragen
 * 6. Passphrase frei wählen (in App + hier gleich)
 */

const STORE_PROP = 'MASRI_SYNC_STORE';

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const action = e.parameter.action || (e.postData ? JSON.parse(e.postData.contents).action : '');
  const store = JSON.parse(PropertiesService.getScriptProperties().getProperty(STORE_PROP) || '{}');

  if (action === 'push') {
    const body = JSON.parse(e.postData.contents);
    const key = body.passphrase + '::' + body.profileId;
    store[key] = { backup: body.backup, updatedAt: new Date().toISOString() };
    PropertiesService.getScriptProperties().setProperty(STORE_PROP, JSON.stringify(store));
    return jsonResponse({ ok: true });
  }

  if (action === 'pull') {
    const key = e.parameter.passphrase + '::' + e.parameter.profileId;
    const entry = store[key];
    return jsonResponse({ backup: entry ? entry.backup : null, updatedAt: entry?.updatedAt });
  }

  return jsonResponse({ error: 'Unknown action' }, 400);
}

function jsonResponse(obj, code) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
