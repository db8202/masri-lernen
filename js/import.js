import { uid, mergeVocabulary } from './storage.js';
import { vocabSignature } from './utils.js';

const COLUMN_MAP = {
  kategorie: 'category', category: 'category',
  deutsch: 'german', german: 'german',
  aegyptisch: 'egyptian', egyptian: 'egyptian', arabisch: 'egyptian',
  aussprache: 'transliteration', transliteration: 'transliteration', lautschrift: 'transliteration',
  geschlecht: 'gender', gender: 'gender',
  typ: 'type', type: 'type',
  notiz: 'note', note: 'note',
  audio_datei: 'audioFile', audiofile: 'audioFile', audio: 'audioFile',
  audiourl: 'audioUrl', audio_url: 'audioUrl',
};

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase().replace(/\s+/g, '');
}

export function normalizeGender(g) {
  const v = String(g || 'n').trim().toLowerCase();
  if (['m', 'mann', 'male', 'männlich'].includes(v)) return 'm';
  if (['w', 'f', 'frau', 'female', 'weiblich'].includes(v)) return 'w';
  return 'n';
}

export function normalizeType(t) {
  const v = String(t || 'word').trim().toLowerCase();
  return v === 'sentence' || v === 'satz' || v === 'sätze' ? 'sentence' : 'word';
}

function rowToCard(row, headers) {
  const obj = {};
  headers.forEach((h, i) => {
    const key = COLUMN_MAP[normalizeHeader(h)];
    if (key) obj[key] = row[i] != null ? String(row[i]).trim() : '';
  });
  if (!obj.german && !obj.egyptian) return null;
  return {
    id: uid(),
    category: obj.category || 'Sonstiges',
    german: obj.german || '',
    egyptian: obj.egyptian || '',
    transliteration: obj.transliteration || '',
    gender: normalizeGender(obj.gender),
    type: normalizeType(obj.type),
    note: obj.note || '',
    audioFile: obj.audioFile || '',
    audioUrl: obj.audioUrl || '',
    audioData: null,
  };
}

export function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delimiter).map((h) => h.replace(/^"|"$/g, '').trim());
  const cards = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.replace(/^"|"$/g, '').trim());
    const card = rowToCard(cols, headers);
    if (card) cards.push(card);
  }
  return cards;
}

export function parseExcel(arrayBuffer) {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rows.length < 2) return [];
  const headers = rows[0].map(String);
  const cards = [];
  for (let i = 1; i < rows.length; i++) {
    const card = rowToCard(rows[i].map(String), headers);
    if (card) cards.push(card);
  }
  return cards;
}

export async function importFile(file) {
  const name = file.name.toLowerCase();
  let cards = [];
  if (name.endsWith('.csv')) cards = parseCSV(await file.text());
  else if (name.endsWith('.xlsx') || name.endsWith('.xls')) cards = parseExcel(await file.arrayBuffer());
  else throw new Error('Nur .csv, .xlsx oder .xls werden unterstützt.');
  if (!cards.length) throw new Error('Keine Vokabeln gefunden. Prüfe die Spaltenüberschriften.');

  const { added, updated, total } = await mergeVocabulary(cards, vocabSignature);
  return { imported: cards.length, added, updated, duplicates: updated, total };
}

export function downloadTemplate() {
  const a = document.createElement('a');
  a.href = './data/vokabeln.xlsx';
  a.download = 'vokabeln_vorlage.xlsx';
  a.click();
}
