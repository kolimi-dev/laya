/**
 * Laya (లయ) — Per-Task Custom Charts Component & Visual Rhythm Matrix
 * Zero charts by default; user adds only what they want to see
 */

import { api, escapeHtml } from '../core/api.js';
import { savePinnedCharts } from '../core/state.js';
import { updateViewTabBadges } from './header-shell.js';
import { generateTaskChartSvg } from './chart-svg.js';

export function computeTimeWindowDates(range, customRange = { from: null, to: null }) {
  const now = new Date();
  const to = now.toISOString();
  let from;

  if (range === 'week') {
    from = new Date(now.getTime() - 7 * 86400000).toISOString();
  } else if (range === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  } else if (range === '30d') {
    from = new Date(now.getTime() - 30 * 86400000).toISOString();
  } else if (range === '90d') {
    from = new Date(now.getTime() - 90 * 86400000).toISOString();
  } else if (range === '1y') {
    from = new Date(now.getTime() - 365 * 86400000).toISOString();
  } else if (range === 'custom') {
    from = customRange.from ? new Date(customRange.from).toISOString() : new Date(now.getTime() - 30 * 86400000).toISOString();
    return { from, to: customRange.to ? new Date(customRange.to).toISOString() : to };
  } else {
    from = new Date(now.getTime() - 30 * 86400000).toISOString();
  }

  return { from, to };
}

export function populateAddChartTaskSelect(selectEl, state) {
  if (!selectEl) return;
  selectEl.innerHTML = '';
  const tasks = state.allTasks.length > 0 ? state.allTasks : (state.checklist?.items || []).map((i) => i.task);

  if (tasks.length === 0) {
    selectEl.innerHTML = '<option value="">(No tasks created yet)</option>';
    return;
  }

  tasks.forEach((t) => {
    const typeLabel = t.taskType === 'percentage' && t.unit ? `${t.targetValue || ''} ${t.unit}` : t.taskType;
    selectEl.innerHTML += `<option value="${t.id}">${escapeHtml(t.title)} (${typeLabel})</option>`;
  });
}

export async function renderChartsView(el, state) {
  const grid = el.taskChartsGrid;
  if (!grid) return;
  updateViewTabBadges(state, el);

  if (state.pinnedCharts.length === 0) {
    grid.innerHTML = `
      <div class="chart-empty-state">
        <span class="chart-empty-icon">📊</span>
        <h3>No Task Charts Pinned Yet</h3>
        <p>
          By default, your dashboard stays calm and focused directly on today's remaining tasks. 
          Pin a dedicated chart block for any task you wish to visualize over time — like <em>Drinking Water</em> (daily volume), 
          <em>Exercise</em> (activity rhythm matrix), or <em>Reading</em> (pages trend).
        </p>
        <button class="primary-btn" id="btn-empty-add-chart">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
          <span>+ Choose Task to Chart</span>
        </button>
      </div>
    `;

    const emptyBtn = document.getElementById('btn-empty-add-chart');
    if (emptyBtn) {
      emptyBtn.addEventListener('click', () => {
        populateAddChartTaskSelect(el.selectChartTask, state);
        if (el.modalAddChart) el.modalAddChart.hidden = false;
      });
    }
    return;
  }

  const windowDates = computeTimeWindowDates(state.chartTimeRange, state.customRange);
  grid.innerHTML = '<div class="spinner"></div>';
  const blocksHtml = [];

  for (const pinned of state.pinnedCharts) {
    let task = state.allTasks.find((t) => t.id === pinned.taskId);
    if (!task && state.checklist) {
      const item = state.checklist.items.find((i) => i.task.id === pinned.taskId);
      if (item) task = item.task;
    }
    if (!task) continue;

    const group = state.groups.find((g) => g.id === task.groupId);
    const groupName = group?.name || 'General';
    const groupColor = group?.color || '#8B5CF6';

    let events = [];
    try {
      const queryParams = new URLSearchParams();
      if (windowDates.from) queryParams.set('from', windowDates.from);
      if (windowDates.to) queryParams.set('to', windowDates.to);
      const data = await api(`/api/v1/tasks/${task.id}/events?${queryParams.toString()}`, {}, state.token);
      events = data.events || [];
    } catch (e) {
      console.warn(`Could not fetch events for task ${task.id}:`, e);
    }

    let activeStyle = pinned.chartType;
    if (!activeStyle || activeStyle === 'auto') {
      activeStyle = task.taskType === 'percentage' ? 'volume_bar' : 'rhythm_matrix';
    }

    const { svgHtml, summaryHtml } = generateTaskChartSvg(task, events, activeStyle, windowDates);

    blocksHtml.push(`
      <div class="task-chart-block" data-task-id="${task.id}">
        <div class="chart-block-header">
          <div class="chart-block-title-wrap">
            <h3 class="chart-block-title">${escapeHtml(task.title)}</h3>
            <div class="chart-block-meta">
              <span class="task-tag-dot" style="background: ${groupColor}"></span>
              <span>${escapeHtml(groupName)}</span>
              ${task.targetValue && task.unit ? `<span>• Target: ${Number(task.targetValue)} ${escapeHtml(task.unit)}</span>` : ''}
            </div>
          </div>
          <div class="chart-block-actions">
            <button class="btn-order-chart" data-action="move-chart-up" data-task-id="${task.id}" title="Move Chart Up">▲</button>
            <button class="btn-order-chart" data-action="move-chart-down" data-task-id="${task.id}" title="Move Chart Down">▼</button>
            <select class="chart-block-type-select" data-action="change-chart-style" data-task-id="${task.id}">
              <option value="volume_bar" ${activeStyle === 'volume_bar' ? 'selected' : ''}>Daily Volume Bars</option>
              <option value="rhythm_matrix" ${activeStyle === 'rhythm_matrix' ? 'selected' : ''}>Rhythm Matrix</option>
              <option value="trend_line" ${activeStyle === 'trend_line' ? 'selected' : ''}>Progress Trend Line</option>
            </select>
            <button class="btn-remove-chart" data-action="remove-chart" data-task-id="${task.id}" title="Remove this chart block">✕</button>
          </div>
        </div>
        <div class="chart-canvas-wrap">${svgHtml}</div>
        <div class="chart-summary-stat">${summaryHtml}</div>
      </div>
    `);
  }

  grid.innerHTML = blocksHtml.join('');
}

export function setupChartBlockEvents(el, state, onChartsChanged) {
  if (el.timeFilterButtons) {
    el.timeFilterButtons.addEventListener('click', (e) => {
      const chip = e.target.closest('.time-chip');
      if (!chip) return;
      const range = chip.dataset.range;
      state.chartTimeRange = range;

      document.querySelectorAll('.time-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');

      if (el.customDateInputs) el.customDateInputs.hidden = range !== 'custom';
      if (range !== 'custom') renderChartsView(el, state);
    });
  }

  if (el.btnApplyCustomDate) {
    el.btnApplyCustomDate.addEventListener('click', () => {
      state.customRange.from = el.chartDateFrom?.value || null;
      state.customRange.to = el.chartDateTo?.value || null;
      renderChartsView(el, state);
    });
  }

  if (el.taskChartsGrid) {
    el.taskChartsGrid.addEventListener('click', (e) => {
      const moveUpBtn = e.target.closest('[data-action="move-chart-up"]');
      if (moveUpBtn) {
        const taskId = moveUpBtn.dataset.taskId;
        const idx = state.pinnedCharts.findIndex((c) => c.taskId === taskId);
        if (idx > 0) {
          const item = state.pinnedCharts.splice(idx, 1)[0];
          state.pinnedCharts.splice(idx - 1, 0, item);
          savePinnedCharts(state.pinnedCharts);
          renderChartsView(el, state);
          if (typeof onChartsChanged === 'function') onChartsChanged();
        }
        return;
      }

      const moveDownBtn = e.target.closest('[data-action="move-chart-down"]');
      if (moveDownBtn) {
        const taskId = moveDownBtn.dataset.taskId;
        const idx = state.pinnedCharts.findIndex((c) => c.taskId === taskId);
        if (idx >= 0 && idx < state.pinnedCharts.length - 1) {
          const item = state.pinnedCharts.splice(idx, 1)[0];
          state.pinnedCharts.splice(idx + 1, 0, item);
          savePinnedCharts(state.pinnedCharts);
          renderChartsView(el, state);
          if (typeof onChartsChanged === 'function') onChartsChanged();
        }
        return;
      }

      const btn = e.target.closest('[data-action="remove-chart"]');
      if (!btn) return;
      const taskId = btn.dataset.taskId;
      state.pinnedCharts = state.pinnedCharts.filter((c) => c.taskId !== taskId);
      savePinnedCharts(state.pinnedCharts);
      renderChartsView(el, state);
      if (typeof onChartsChanged === 'function') onChartsChanged();
    });

    el.taskChartsGrid.addEventListener('change', (e) => {
      if (e.target.dataset.action === 'change-chart-style') {
        const taskId = e.target.dataset.taskId;
        const newStyle = e.target.value;
        const found = state.pinnedCharts.find((c) => c.taskId === taskId);
        if (found) {
          found.chartType = newStyle;
          savePinnedCharts(state.pinnedCharts);
          renderChartsView(el, state);
        }
      }
    });
  }

  if (el.btnOpenAddChart) {
    el.btnOpenAddChart.addEventListener('click', () => {
      populateAddChartTaskSelect(el.selectChartTask, state);
      if (el.modalAddChart) el.modalAddChart.hidden = false;
    });
  }

  if (el.formAddChart) {
    el.formAddChart.addEventListener('submit', (e) => {
      e.preventDefault();
      const taskId = el.selectChartTask?.value;
      const chartType = el.selectChartType?.value || 'auto';
      if (!taskId) return;

      if (!state.pinnedCharts.some((c) => c.taskId === taskId)) {
        state.pinnedCharts.push({ taskId, chartType });
        savePinnedCharts(state.pinnedCharts);
      }

      if (el.modalAddChart) el.modalAddChart.hidden = true;
      renderChartsView(el, state);
      if (typeof onChartsChanged === 'function') onChartsChanged();
    });
  }
}
