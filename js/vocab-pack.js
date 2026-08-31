/** Gratis Vokabel-Paket: ~6.300 ägyptische Wörter mit Lingualism-Audio */

import { mergeVocabulary, uid } from './storage.js';
import { vocabSignature } from './utils.js';

const PACK_BASE = 'https://raw.githubusercontent.com/aramb-dev/arabic-vocab-api/main/csv-v2/egyptian/json/';
const MANIFEST_URL = './data/egyptian-pack-sections.json';

const SECTION_LABELS = {
  adjectives: 'Adjektive',
  adverbs: 'Adverbien',
  animals: 'Tiere',
  around_the_house: 'Zuhause',
  cars_and_other_transportation: 'Transport',
  city_and_transportation: 'Stadt & Verkehr',
  clothing: 'Kleidung',
  clothing_jewelry_and_accessories: 'Kleidung & Schmuck',
  colors: 'Farben',
  crime_and_punishment: 'Recht & Verbrechen',
  education: 'Bildung',
  emotions__and__personality_traits: 'Gefühle & Charakter',
  family: 'Familie',
  food: 'Essen',
  food_and_drink: 'Essen & Trinken',
  geography: 'Geografie',
  government_and_politics: 'Politik',
  health_and_medicine: 'Gesundheit',
  human_body: 'Körper',
  language: 'Sprache',
  life_and_death: 'Leben & Tod',
  mankind_and_kinship: 'Mensch & Verwandtschaft',
  media: 'Medien',
  media_2: 'Medien 2',
  media_3: 'Medien 3',
  media_and_the_arts: 'Kunst & Medien',
  medicine: 'Medizin',
  nature__and__weather: 'Natur & Wetter',
  numbers: 'Zahlen',
  recreation_and_relaxation: 'Freizeit',
  religion: 'Religion',
  school_and_education: 'Schule',
  sports__and__hobbies: 'Sport & Hobbies',
  technology: 'Technologie',
  time: 'Zeit',
  verbs: 'Verben',
  vocabulary_from_around_the_house: 'Haushalt',
  war: 'Krieg',
  weather: 'Wetter',
  work_and_money: 'Arbeit & Geld',
  work_and_professions: 'Berufe',
};

function sectionLabel(filename) {
  const base = filename.replace(/\.json$/i, '');
  if (SECTION_LABELS[base]) return SECTION_LABELS[base];
  return base.replace(/__/g, ' & ').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function audioFilename(url) {
  if (!url) return '';
  try {
    const name = new URL(url).pathname.split('/').pop();
    return name || '';
  } catch {
    const parts = String(url).split('/');
    return parts[parts.length - 1] || '';
  }
}

function entryToCard(entry, category) {
  if (!entry?.arabic || !entry?.english) return null;
  if (entry.english === 'English' || entry.arabic === 'Arabic') return null;
  const file = audioFilename(entry.audioUrl);
  return {
    id: uid(),
    category,
    german: entry.english,
    egyptian: entry.arabic,
    transliteration: entry.transliteration || '',
    gender: 'n',
    type: 'word',
    note: 'Paket-Import · Deutsche Übersetzung optional ergänzen',
    audioFile: file,
    audioUrl: entry.audioUrl || '',
    audioData: null,
  };
}

export async function fetchPackSections() {
  const res = await fetch(MANIFEST_URL);
  if (!res.ok) throw new Error('Paket-Liste nicht gefunden.');
  return res.json();
}

export async function importEgyptianPack(onProgress) {
  const sections = await fetchPackSections();
  const allCards = [];
  let done = 0;

  for (const file of sections) {
    onProgress?.({ phase: 'fetch', done, total: sections.length, file });
    const res = await fetch(`${PACK_BASE}${file}`);
    if (!res.ok) { done++; continue; }
    const entries = await res.json();
    const category = sectionLabel(file);
    for (const entry of entries) {
      const card = entryToCard(entry, category);
      if (card) allCards.push(card);
    }
    done++;
    onProgress?.({ phase: 'fetch', done, total: sections.length, file, words: allCards.length });
  }

  onProgress?.({ phase: 'merge', words: allCards.length });
  const result = await mergeVocabulary(allCards, vocabSignature);
  return { ...result, imported: allCards.length };
}
