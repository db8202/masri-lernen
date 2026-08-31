import { shuffle, esc } from './utils.js';

/** Build 4 multiple-choice options for a card */
export function buildMCOptions(card, allCards, direction) {
  const correct = direction === 'de-eg'
    ? card.egyptian
    : card.german;

  const pool = allCards
    .filter((c) => c.id !== card.id)
    .map((c) => (direction === 'de-eg' ? c.egyptian : c.german))
    .filter((t) => t && t !== correct);

  const distractors = shuffle([...new Set(pool)]).slice(0, 3);
  while (distractors.length < 3) {
    distractors.push(distractors.length ? distractors[0] + '…' : '—');
  }

  return shuffle([correct, ...distractors.slice(0, 3)]);
}

export function renderMCOptions(container, options, correctValue, onSelect) {
  const correctIdx = options.indexOf(correctValue);
  container.dataset.correctIdx = correctIdx;
  container.innerHTML = options.map((opt, i) =>
    `<button class="mc-option" data-idx="${i}" dir="auto">${esc(opt)}</button>`
  ).join('');

  container.querySelectorAll('.mc-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (container.dataset.locked) return;
      container.dataset.locked = '1';
      const idx = parseInt(btn.dataset.idx, 10);
      const isCorrect = idx === correctIdx;
      btn.classList.add(isCorrect ? 'mc-correct' : 'mc-wrong');
      if (!isCorrect) {
        container.querySelector(`[data-idx="${correctIdx}"]`)?.classList.add('mc-correct');
      }
      setTimeout(() => onSelect(isCorrect ? 2 : 0), 700);
    });
  });
}

export function getPromptText(card, direction) {
  if (direction === 'de-eg') return { text: card.german, dir: 'ltr', hint: 'Wähle die richtige Übersetzung:' };
  return { text: card.egyptian, dir: 'rtl', hint: 'Was bedeutet das auf Deutsch?' };
}

export function getTypePrompt(card, direction) {
  if (direction === 'de-eg') {
    return { text: card.german, dir: 'ltr', placeholder: 'Antwort auf Ägyptisch (Schrift oder Lautschrift)…' };
  }
  return { text: card.egyptian, dir: 'rtl', placeholder: 'Antwort auf Deutsch…' };
}
