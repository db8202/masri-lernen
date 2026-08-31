/** Kategorien umbenennen, zusammenführen, löschen */

import { getAllVocabulary, saveVocabulary } from './storage.js';

export function listCategories(vocabulary) {
  const map = new Map();
  for (const v of vocabulary) {
    const cat = v.category || 'Sonstiges';
    map.set(cat, (map.get(cat) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'de'));
}

export async function renameCategory(oldName, newName) {
  const trimmed = newName.trim();
  if (!trimmed || trimmed === oldName) return 0;
  const vocab = await getAllVocabulary();
  let count = 0;
  for (const v of vocab) {
    if (v.category === oldName) { v.category = trimmed; count++; }
  }
  if (count) await saveVocabulary(vocab);
  return count;
}

export async function mergeCategories(fromName, toName) {
  const target = toName.trim();
  if (!target || fromName === target) return 0;
  const vocab = await getAllVocabulary();
  let count = 0;
  for (const v of vocab) {
    if (v.category === fromName) { v.category = target; count++; }
  }
  if (count) await saveVocabulary(vocab);
  return count;
}

export async function deleteCategory(name, { moveTo = 'Sonstiges' } = {}) {
  const vocab = await getAllVocabulary();
  let count = 0;
  for (const v of vocab) {
    if (v.category === name) { v.category = moveTo; count++; }
  }
  if (count) await saveVocabulary(vocab);
  return count;
}
