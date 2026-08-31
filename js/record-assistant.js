/** Aufnahme-Assistent: fehlende Sprachdateien der Reihe nach aufnehmen */

export function hasStoredAudio(card) {
  return !!(card?.audioData || card?.audioUrl?.trim());
}

export function getMissingAudioCards(vocabulary) {
  return vocabulary.filter((v) => !hasStoredAudio(v));
}

export function countMissingAudio(vocabulary) {
  return getMissingAudioCards(vocabulary).length;
}
