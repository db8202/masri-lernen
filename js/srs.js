/** Vereinfachtes SM-2 Spaced Repetition + Gender-Filter */

export function defaultCardProgress() {
  return {
    repetitions: 0,
    easeFactor: 2.5,
    interval: 0,
    nextReview: 0,
    wrongCount: 0,
    correctCount: 0,
    lastReview: 0,
    status: 'new',
  };
}

export function getOrCreateProgress(progressMap, cardId) {
  return progressMap.get(cardId) || { cardId, ...defaultCardProgress() };
}

export function isDue(entry, now = Date.now()) {
  if (!entry || entry.status === 'new') return true;
  return entry.nextReview <= now;
}

export function gradeCard(entry, quality) {
  const now = Date.now();
  const p = { ...getOrCreateProgress(new Map(), entry.cardId), ...entry };

  if (quality === 0) {
    p.repetitions = 0;
    p.interval = 0;
    p.wrongCount += 1;
    p.nextReview = now;
    p.status = 'learning';
    p.easeFactor = Math.max(1.3, p.easeFactor - 0.2);
  } else {
    p.correctCount += 1;
    p.repetitions += 1;
    p.easeFactor = Math.min(3.0, p.easeFactor + (quality === 2 ? 0.1 : 0));
    if (p.repetitions === 1) p.interval = 1;
    else if (p.repetitions === 2) p.interval = 3;
    else p.interval = Math.round(p.interval * p.easeFactor);
    p.nextReview = now + p.interval * 24 * 60 * 60 * 1000;
    p.status = p.repetitions >= 5 && p.wrongCount === 0 ? 'mastered' : 'review';
  }

  p.lastReview = now;
  return p;
}

/** Filter cards by speaker gender preference */
export function filterByGender(cards, speakerGender, strict = false) {
  if (!speakerGender || speakerGender === 'n') return cards;

  const allowed = (card) => {
    if (card.gender === 'n') return true;
    if (card.gender === speakerGender) return true;
    return false;
  };

  const filtered = cards.filter(allowed);
  if (strict) return filtered.length ? filtered : cards;

  // Non-strict: prefer matching gender, demote others
  const preferred = cards.filter((c) => c.gender === speakerGender || c.gender === 'n');
  const other = cards.filter((c) => c.gender !== speakerGender && c.gender !== 'n');
  return preferred.length ? [...preferred, ...other] : cards;
}

export function buildSessionQueue(cards, progressMap, options = {}) {
  const {
    limit = 20,
    category = null,
    type = null,
    dueOnly = false,
    dailyGoal = 10,
    speakerGender = 'n',
    genderStrict = false,
  } = options;
  const now = Date.now();

  let filtered = cards;
  if (options.cardIds?.length) {
    const set = new Set(options.cardIds);
    filtered = filtered.filter((c) => set.has(c.id));
  }
  if (category) filtered = filtered.filter((c) => c.category === category);
  if (type) filtered = filtered.filter((c) => c.type === type);
  if (options.wordsOnly) filtered = filtered.filter((c) => c.type === 'word');
  filtered = filterByGender(filtered, speakerGender, genderStrict);

  const due = [];
  const learning = [];
  const fresh = [];

  for (const card of filtered) {
    const p = getOrCreateProgress(progressMap, card.id);
    if (p.status === 'new') fresh.push({ card, p });
    else if (isDue(p, now)) due.push({ card, p });
    else if (!dueOnly) learning.push({ card, p });
  }

  due.sort((a, b) => b.p.wrongCount - a.p.wrongCount || a.p.nextReview - b.p.nextReview);
  fresh.sort(() => Math.random() - 0.5);

  const queue = [...due, ...fresh.slice(0, Math.max(0, dailyGoal - due.length))];
  if (!dueOnly && queue.length < limit) {
    queue.push(...learning.sort(() => Math.random() - 0.5).slice(0, limit - queue.length));
  }

  return queue.slice(0, limit).map((q) => q.card);
}

export function countDue(cards, progressMap, options = {}) {
  const filtered = filterByGender(cards, options.speakerGender, options.genderStrict);
  const now = Date.now();
  return filtered.filter((c) => {
    const p = getOrCreateProgress(progressMap, c.id);
    return p.status === 'new' || isDue(p, now);
  }).length;
}

export function getStats(cards, progressMap) {
  let learned = 0;
  let mastered = 0;
  const byCategory = {};

  for (const card of cards) {
    const p = getOrCreateProgress(progressMap, card.id);
    if (!byCategory[card.category]) byCategory[card.category] = { total: 0, learned: 0 };
    byCategory[card.category].total += 1;
    if (p.correctCount > 0) {
      learned += 1;
      byCategory[card.category].learned += 1;
    }
    if (p.status === 'mastered') mastered += 1;
  }

  return { total: cards.length, learned, mastered, byCategory };
}

export function getHardWords(cards, progressMap, limit = 10) {
  return cards
    .map((c) => ({ card: c, p: getOrCreateProgress(progressMap, c.id) }))
    .filter(({ p }) => p.wrongCount > 0)
    .sort((a, b) => b.p.wrongCount - a.p.wrongCount || a.p.correctCount - b.p.correctCount)
    .slice(0, limit)
    .map(({ card, p }) => ({ ...card, wrongCount: p.wrongCount }));
}

export function updateStreak(profileId) {
  const key = `streak_${profileId}`;
  const today = new Date().toISOString().slice(0, 10);
  const raw = localStorage.getItem(key);
  const data = raw ? JSON.parse(raw) : { lastDate: null, streak: 0 };
  if (data.lastDate === today) return data.streak;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);

  data.streak = data.lastDate === yStr ? data.streak + 1 : 1;
  data.lastDate = today;
  localStorage.setItem(key, JSON.stringify(data));
  return data.streak;
}

export function getStreak(profileId) {
  const raw = localStorage.getItem(`streak_${profileId}`);
  if (!raw) return 0;
  const data = JSON.parse(raw);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (data.lastDate === today || data.lastDate === yesterday.toISOString().slice(0, 10)) return data.streak;
  return 0;
}

export function getTodayCount(profileId) {
  const raw = localStorage.getItem(`today_${profileId}`);
  if (!raw) return 0;
  const data = JSON.parse(raw);
  const today = new Date().toISOString().slice(0, 10);
  return data.date === today ? data.count : 0;
}

export function incrementTodayCount(profileId) {
  const today = new Date().toISOString().slice(0, 10);
  const raw = localStorage.getItem(`today_${profileId}`);
  const data = raw ? JSON.parse(raw) : { date: today, count: 0 };
  if (data.date !== today) { data.date = today; data.count = 0; }
  data.count += 1;
  localStorage.setItem(`today_${profileId}`, JSON.stringify(data));
  return data.count;
}
