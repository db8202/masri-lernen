/** Shared utilities */

export function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

export function $(sel, root = document) {
  return root.querySelector(sel);
}

export function $$(sel, root = document) {
  return root.querySelectorAll(sel);
}

export function vocabSignature(card) {
  const g = (card.german || '').trim().toLowerCase();
  const e = (card.egyptian || '').trim();
  const gender = card.gender || 'n';
  return `${g}|${e}|${gender}`;
}

export function normalizeAnswer(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[?!.,;:'"«»]/g, '')
    .replace(/\s+/g, ' ');
}

export function answersMatch(userAnswer, card, direction) {
  const user = normalizeAnswer(userAnswer);
  if (!user) return false;

  const targets = direction === 'de-eg'
    ? [card.egyptian, card.transliteration]
    : [card.german];

  return targets.some((t) => {
    const target = normalizeAnswer(t);
    if (!target) return false;
    if (user === target) return true;
    // Transliteration: ignore punctuation differences
    if (direction === 'de-eg' && t === card.transliteration) {
      const simplified = (s) => s.replace(/[-'`]/g, '');
      return simplified(user) === simplified(target);
    }
    return false;
  });
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function genderLabel(g) {
  if (g === 'm') return '♂ männlich';
  if (g === 'w') return '♀ weiblich';
  return '';
}

export function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function suggestAudioFilename(german, id) {
  const slug = slugify(german);
  if (slug) return `${slug}.mp3`;
  if (id) return `${id}.mp3`;
  return '';
}

export function parseSheetId(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  const m = raw.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(raw)) return raw;
  return null;
}
