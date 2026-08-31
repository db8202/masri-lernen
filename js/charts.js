import { esc } from './utils.js';

/** Render SVG bar chart for daily stats – no external deps */
export function renderProgressChart(container, history) {
  if (!history.length) {
    container.innerHTML = '<p class="hint">Noch keine Verlaufsdaten. Lerne ein paar Tage!</p>';
    return;
  }

  const max = Math.max(1, ...history.map((d) => d.correct + d.wrong));
  const w = 320;
  const h = 140;
  const barW = Math.min(24, Math.floor(w / history.length) - 4);
  const gap = 4;
  const startX = 10;

  const bars = history.map((d, i) => {
    const total = d.correct + d.wrong;
    const barH = Math.round((total / max) * (h - 30));
    const correctH = total ? Math.round((d.correct / total) * barH) : 0;
    const x = startX + i * (barW + gap);
    const y = h - 20 - barH;
    const label = d.date.slice(5);
    return `
      <g class="chart-bar-group">
        <rect x="${x}" y="${y + barH - correctH}" width="${barW}" height="${correctH}" class="chart-bar-correct" rx="3"/>
        <rect x="${x}" y="${y}" width="${barW}" height="${barH - correctH}" class="chart-bar-wrong" rx="3"/>
        <text x="${x + barW / 2}" y="${h - 4}" class="chart-label" text-anchor="middle">${esc(label)}</text>
      </g>`;
  }).join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" class="progress-chart" role="img" aria-label="Lernverlauf">
      ${bars}
    </svg>
    <div class="chart-legend">
      <span><i class="legend-dot correct"></i> Richtig</span>
      <span><i class="legend-dot wrong"></i> Falsch</span>
    </div>`;
}
