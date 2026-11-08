/**
 * Laya (లయ) — SVG Chart Rendering Engines
 * High-performance vector charts: Volume Bar, Rhythm Matrix, Cumulative Trend Line
 */

import { escapeHtml } from '../core/api.js';

export function generateTaskChartSvg(task, events, chartType, windowDates) {
  const startDate = new Date(windowDates.from);
  const endDate = new Date(windowDates.to);
  const dayCount = Math.max(7, Math.min(60, Math.ceil((endDate - startDate) / 86400000)));

  const dayMap = new Map();
  events.forEach((ev) => {
    const dayStr = ev.occurredAt.slice(0, 10);
    const list = dayMap.get(dayStr) || [];
    list.push(ev);
    dayMap.set(dayStr, list);
  });

  const targetVal = task.targetValue ? Number(task.targetValue) : 100;
  const unit = task.unit || (task.taskType === 'percentage' ? '%' : 'pts');
  const totalMilestones = (task.milestones && task.milestones.length > 0) ? task.milestones.length : 4;

  let totalAmount = 0;
  let completedDays = 0;
  let ignoredDays = 0;
  const dailyPoints = [];

  for (let i = dayCount - 1; i >= 0; i--) {
    const d = new Date(endDate.getTime() - i * 86400000);
    const dayKey = d.toISOString().slice(0, 10);
    const dayEvs = dayMap.get(dayKey) || [];

    let isDone = false;
    let isIgnored = false;
    let dayVal = 0;
    let dayPct = 0;
    const completedMilestones = new Set();

    dayEvs.forEach((ev) => {
      if (ev.status === 'ignored') isIgnored = true;
      if (ev.status === 'done') {
        if (ev.milestoneId) {
          completedMilestones.add(ev.milestoneId);
        } else {
          isDone = true;
        }
      }
      if (ev.progressPercentage !== undefined && ev.progressPercentage !== null) {
        if (ev.progressPercentage > dayPct) dayPct = ev.progressPercentage;
        const val = (ev.progressPercentage / 100) * targetVal;
        if (val > dayVal) dayVal = val;
      }
    });

    if (task.taskType === 'milestone') {
      if (completedMilestones.size > 0) {
        const mPct = Math.round((completedMilestones.size / totalMilestones) * 100);
        if (mPct > dayPct) dayPct = mPct;
        if (completedMilestones.size >= totalMilestones) isDone = true;
      }
      if (isDone) dayPct = 100;
      dayVal = (dayPct / 100) * targetVal;
    } else if (task.taskType === 'percentage') {
      if (isDone) {
        dayPct = 100;
        dayVal = targetVal;
      } else if (targetVal > 0) {
        dayPct = Math.min(100, Math.round((dayVal / targetVal) * 100));
      }
    } else {
      if (isDone) {
        dayPct = 100;
        dayVal = targetVal;
      }
    }

    if (isIgnored) ignoredDays++;
    if (isDone || dayPct >= 100 || dayVal >= targetVal) completedDays++;
    totalAmount += dayVal;

    dailyPoints.push({
      date: d,
      dayKey,
      value: dayVal,
      pct: dayPct,
      isDone: isDone || dayPct >= 100,
      isIgnored,
      label: d.toLocaleDateString(undefined, { weekday: 'narrow', month: 'numeric', day: 'numeric' }),
    });
  }

  const avg = dailyPoints.length > 0 ? (totalAmount / dailyPoints.length) : 0;

  if (chartType === 'volume_bar') {
    return renderVolumeBarSvg(dailyPoints, targetVal, unit, totalAmount, avg, completedDays, ignoredDays);
  }
  if (chartType === 'rhythm_matrix') {
    return renderRhythmMatrixSvg(dailyPoints, targetVal, unit, completedDays, ignoredDays);
  }
  return renderTrendLineSvg(dailyPoints, targetVal, unit, totalAmount, avg);
}

function renderVolumeBarSvg(dailyPoints, targetVal, unit, totalAmount, avg, completedDays, ignoredDays) {
  const maxVal = Math.max(targetVal * 1.2, ...dailyPoints.map((p) => p.value), 1);
  const svgW = 460;
  const svgH = 170;
  const padL = 35;
  const padR = 15;
  const padT = 20;
  const padB = 25;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;
  const barWidth = Math.max(4, Math.min(18, (plotW / dailyPoints.length) - 3));
  const targetY = padT + plotH - (targetVal / maxVal) * plotH;

  let barsSvg = '';
  dailyPoints.forEach((p, idx) => {
    const x = padL + (idx * (plotW / dailyPoints.length)) + ((plotW / dailyPoints.length) - barWidth) / 2;
    const bH = Math.max(2, (p.value / maxVal) * plotH);
    const y = padT + plotH - bH;
    const color = p.isIgnored ? '#64748B' : p.value >= targetVal ? '#10B981' : p.value > 0 ? '#06B6D4' : 'rgba(255,255,255,0.06)';

    barsSvg += `
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth}" height="${bH.toFixed(1)}" rx="3" fill="${color}">
        <title>${p.dayKey}: ${Math.round(p.value * 10) / 10} ${escapeHtml(unit)} ${p.isIgnored ? '(Rest Day)' : ''}</title>
      </rect>
    `;
  });

  const svgHtml = `
    <svg class="chart-svg" viewBox="0 0 ${svgW} ${svgH}">
      <line x1="${padL}" y1="${targetY}" x2="${svgW - padR}" y2="${targetY}" stroke="rgba(6, 182, 212, 0.4)" stroke-dasharray="4,4" stroke-width="1.5" />
      <text x="${svgW - padR}" y="${targetY - 4}" fill="#06B6D4" font-size="10" text-anchor="end" font-weight="600">Goal: ${targetVal} ${escapeHtml(unit)}</text>
      <line x1="${padL}" y1="${padT + plotH}" x2="${svgW - padR}" y2="${padT + plotH}" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
      ${barsSvg}
    </svg>
  `;

  const summaryHtml = `
    <span class="chart-stat-item">Total: <strong>${Math.round(totalAmount * 10) / 10} ${escapeHtml(unit)}</strong></span>
    <span class="chart-stat-item">Daily Avg: <strong>${Math.round(avg * 10) / 10} ${escapeHtml(unit)}</strong></span>
    <span class="chart-stat-item">Target Met: <strong>${completedDays} days</strong></span>
    ${ignoredDays > 0 ? `<span class="chart-stat-item" style="color:var(--color-ignored);">Rest: <strong>${ignoredDays} days</strong></span>` : ''}
  `;
  return { svgHtml, summaryHtml };
}

function renderRhythmMatrixSvg(dailyPoints, targetVal, unit, completedDays, ignoredDays) {
  const blockSize = 14;
  const gap = 4;
  const cols = Math.min(dailyPoints.length, 30);
  const startIdx = Math.max(0, dailyPoints.length - cols);
  const slice = dailyPoints.slice(startIdx);

  let blocksSvg = '';
  slice.forEach((p, idx) => {
    const x = 30 + idx * (blockSize + gap);
    const y = 50;

    // GitHub-style contribution squares reflecting completion intensity (0%, 25%, 50%, 75%, 100%)
    let fill = 'rgba(255, 255, 255, 0.06)'; // Level 0: 0% completion
    let intensity = 0;

    if (p.isIgnored) {
      fill = '#64748B'; // Rest / Exempt
      intensity = -1;
    } else if (p.pct >= 100 || p.isDone || p.value >= targetVal) {
      fill = '#10B981'; // Level 4: 100% intensity (Full emerald)
      intensity = 4;
    } else if (p.pct >= 75) {
      fill = '#059669'; // Level 3: 75% intensity
      intensity = 3;
    } else if (p.pct >= 50) {
      fill = '#047857'; // Level 2: 50% intensity
      intensity = 2;
    } else if (p.pct >= 25 || p.pct > 0 || p.value > 0) {
      fill = '#064e3b'; // Level 1: 25% intensity
      intensity = 1;
    }

    const intensityLabel = p.isIgnored ? 'Rest Day (Exempt)' : `${p.pct || 0}% Completed`;

    blocksSvg += `
      <rect x="${x}" y="${y}" width="${blockSize}" height="${blockSize}" rx="3" fill="${fill}" data-intensity="${intensity}" data-pct="${p.pct || 0}">
        <title>${p.dayKey}: ${intensityLabel}</title>
      </rect>
      ${idx % 5 === 0 ? `<text x="${x}" y="${y + blockSize + 16}" fill="rgba(255,255,255,0.4)" font-size="9">${p.date.getDate()}/${p.date.getMonth() + 1}</text>` : ''}
    `;
  });

  const svgHtml = `
    <svg class="chart-svg" viewBox="0 0 540 140">
      <text x="30" y="30" fill="rgba(255,255,255,0.6)" font-size="11" font-weight="500">Daily Rhythm Matrix (Last ${slice.length} Days)</text>
      ${blocksSvg}
    </svg>
  `;

  const summaryHtml = `
    <span class="chart-stat-item"><span style="color:#10B981;">■</span> Done: <strong>${completedDays}</strong></span>
    <span class="chart-stat-item"><span style="color:#64748B;">■</span> Rest/Exempt: <strong>${ignoredDays}</strong></span>
    <span class="chart-stat-item">Active Days: <strong>${completedDays + ignoredDays}</strong></span>
  `;
  return { svgHtml, summaryHtml };
}

function renderTrendLineSvg(dailyPoints, targetVal, unit, totalAmount, avg) {
  let cumulative = 0;
  const trendPoints = dailyPoints.map((p) => {
    cumulative += p.value;
    return { ...p, cum: cumulative };
  });

  const maxCum = Math.max(1, cumulative);
  const svgW = 460;
  const svgH = 170;
  const padL = 35;
  const padR = 15;
  const padT = 20;
  const padB = 25;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const pointsStr = trendPoints.map((p, idx) => {
    const x = padL + (idx / (trendPoints.length - 1)) * plotW;
    const y = padT + plotH - (p.cum / maxCum) * plotH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const svgHtml = `
    <svg class="chart-svg" viewBox="0 0 ${svgW} ${svgH}">
      <line x1="${padL}" y1="${padT + plotH}" x2="${svgW - padR}" y2="${padT + plotH}" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
      <polyline fill="none" stroke="#8B5CF6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${pointsStr}" />
    </svg>
  `;

  const summaryHtml = `
    <span class="chart-stat-item">Cumulative: <strong>${Math.round(cumulative * 10) / 10} ${escapeHtml(unit)}</strong></span>
    <span class="chart-stat-item">Daily Pace: <strong>${Math.round(avg * 10) / 10} ${escapeHtml(unit)}/day</strong></span>
  `;
  return { svgHtml, summaryHtml };
}

