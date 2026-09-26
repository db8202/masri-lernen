/** Aufräumen: englisches Gratis-Paket (arabic-vocab-api) entfernen — App nur DE↔Masri */

import { getAllVocabulary, deleteVocabularyByIds } from './storage.js';

function isEnglishPackCard(card) {
  const note = String(card?.note || '');
  if (note.includes('Paket-Import')) return true;
  const url = String(card?.audioUrl || '');
  if (url.includes('arabic-vocab-api')) return true;
  return false;
}

/**
 * Entfernt Karten aus dem früheren EN→Masri-Paket-Import.
 * Starter-Vokabeln (vocabulary.json) und manuelle/Excel-Importe bleiben.
 */
export async function cleanupEnglishPackImports() {
  const all = await getAllVocabulary();
  const ids = all.filter(isEnglishPackCard).map((c) => c.id);
  if (!ids.length) return { removed: 0 };
  await deleteVocabularyByIds(ids);
  return { removed: ids.length };
}
