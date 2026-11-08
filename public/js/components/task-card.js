/**
 * Laya (లయ) — Task Card Renderers & Daily Bucket Splitter
 * Renders Standard Checklist, Discrete Milestones, Quantified Targets, Rest, and Micro-notes
 */

import { escapeHtml } from '../core/api.js';

export function renderTodayChecklist(state, el) {
  const items = state.checklist?.items || [];

  // Filter by group if not 'all'
  let filtered = items;
  if (state.selectedGroupId !== 'all') {
    filtered = filtered.filter((i) => i.task.groupId === state.selectedGroupId);
  }

  // Split strictly into 2 buckets: Remaining vs Completed & Rested
  const remainingItems = [];
  const completedItems = [];

  filtered.forEach((item) => {
    const isDone = item.evaluation.status === 'done';
    const isIgnored = item.evaluation.isIgnored;
    if (isDone || isIgnored) {
      completedItems.push(item);
    } else {
      remainingItems.push(item);
    }
  });

  // Update Headers
  if (el.headerRemainingCount) {
    el.headerRemainingCount.textContent = `${remainingItems.length} task${remainingItems.length === 1 ? '' : 's'}`;
  }
  if (el.headerCompletedCount) {
    el.headerCompletedCount.textContent = `${completedItems.length} task${completedItems.length === 1 ? '' : 's'}`;
  }

  // 1. Render Remaining Tasks (Top)
  if (el.feedRemaining) {
    if (remainingItems.length === 0) {
      el.feedRemaining.innerHTML = `
        <div class="empty-state" style="padding: 32px 16px;">
          <p style="font-size: 1rem; color: var(--color-done); font-weight: 500;">
            🎉 All remaining tasks completed for today! Take time to rest.
          </p>
        </div>
      `;
    } else {
      el.feedRemaining.innerHTML = remainingItems.map((item) => renderTaskCard(item, state)).join('');
    }
  }

  // 2. Render Completed & Rested Tasks (Below)
  if (el.feedCompleted) {
    if (completedItems.length === 0) {
      el.feedCompleted.innerHTML = `
        <div class="empty-state" style="padding: 20px;">
          <p style="font-size: 0.8rem; color: var(--text-subtle);">No tasks checked off or rested yet today.</p>
        </div>
      `;
    } else {
      el.feedCompleted.innerHTML = completedItems.map((item) => renderTaskCard(item, state)).join('');
    }
  }
}

export function renderTaskCard(item, state) {
  const { task, group, milestones, evaluation } = item;
  const isDone = evaluation.status === 'done';
  const isIgnored = evaluation.isIgnored;
  const statusClass = isIgnored ? 'status-ignored' : isDone ? 'status-done' : evaluation.status === 'in_progress' ? 'status-in_progress' : '';

  const groupColor = group?.color || '#8B5CF6';
  const groupName = group?.name || 'Personal';

  // Micro-notes if present and enabled
  const existingNote = evaluation.notes && evaluation.notes.length > 0 ? evaluation.notes[evaluation.notes.length - 1] : '';
  const showNotes = state.features.micronotes;

  const isPinned = state.pinnedCharts.some((c) => c.taskId === task.id);

  return `
    <article class="task-card ${statusClass}" data-task-id="${task.id}" id="card-${task.id}">
      <div class="task-card-main">
        <div class="task-identity">
          <span class="task-type-badge">${task.taskType === 'percentage' ? 'Quantified' : task.taskType}</span>
          <div>
            <h3 class="task-title">${escapeHtml(task.title)}</h3>
            <div class="task-group-tag">
              <span class="task-tag-dot" style="background: ${groupColor}"></span>
              <span>${escapeHtml(groupName)}</span>
              ${task.targetValue && task.unit ? `<span>• Goal: ${Number(task.targetValue)} ${escapeHtml(task.unit)}</span>` : task.unit ? `<span>• Unit: ${escapeHtml(task.unit)}</span>` : ''}
            </div>
          </div>
        </div>

        <div class="task-controls">
          ${renderTaskInteractiveControls(task, milestones, evaluation)}

          <!-- Pin/Toggle Chart Button -->
          <button class="btn-pin-chart ${isPinned ? 'pinned' : ''}" 
                  data-action="toggle-chart-pin" 
                  data-task-id="${task.id}" 
                  title="${isPinned ? 'Chart pinned in Task Charts view' : 'Pin a dedicated chart for this task'}">
            <span>📊</span>
            <span>${isPinned ? 'Pinned' : 'Chart'}</span>
          </button>

          ${task.recurrence !== 'anytime' ? `
          <!-- Guilt-Free Ignore / Rest Action -->
          <button class="btn-ignore ${isIgnored ? 'ignored' : ''}" 
                  data-action="ignore" 
                  data-task-id="${task.id}"
                  title="Mark as intentional rest/pause (subtracted from denominator without guilt or penalty)">
            <span>🌙</span>
            <span>${isIgnored ? 'Resting (Exempt)' : 'Rest / Skip'}</span>
          </button>
          ` : ''}
        </div>
      </div>

      ${showNotes ? `
      <!-- Micro-Notes Row -->
      <div class="task-notes-row">
        <span style="font-size: 0.8rem; color: var(--text-subtle);">💬 Note:</span>
        <input type="text" class="note-input" data-task-id="${task.id}" 
               value="${escapeHtml(existingNote)}" 
               placeholder="Optional context (e.g. fever rest, read ch. 3, did extra reps)..." maxlength="280">
      </div>
      ` : ''}
    </article>
  `;
}

export function renderTaskInteractiveControls(task, milestones, evaluation) {
  // 1. Discrete Milestones (Checkpoints)
  if (task.taskType === 'milestone') {
    const completedSet = new Set(evaluation.completedMilestoneIds || []);
    const pills = (milestones || []).map((m) => {
      const isComp = completedSet.has(m.id);
      return `
        <button class="milestone-pill-btn ${isComp ? 'completed' : ''}" 
                data-action="toggle-milestone" 
                data-task-id="${task.id}" 
                data-milestone-id="${m.id}">
          ${escapeHtml(m.label)} ${isComp ? '✓' : ''}
        </button>
      `;
    }).join('');

    return `<div class="milestones-pills-row">${pills}</div>`;
  }

  // 2. Quantified Target / Continuous Percentage
  if (task.taskType === 'percentage') {
    const currentPct = Math.round(evaluation.progressPercentage || 0);
    const targetVal = task.targetValue ? Number(task.targetValue) : null;
    const unit = task.unit || '';

    if (targetVal) {
      const currentAmount = Math.round((currentPct / 100) * targetVal * 10) / 10;
      return `
        <div class="quantified-control-wrap">
          <span class="quantified-pill-target" title="Logged ${currentAmount} of ${targetVal} ${escapeHtml(unit)}">
            ${currentAmount} / ${targetVal} ${escapeHtml(unit)} (${currentPct}%)
          </span>
          <button class="quantified-quick-btn ${currentPct === 25 ? 'active' : ''}" data-action="set-pct" data-task-id="${task.id}" data-pct="25">25%</button>
          <button class="quantified-quick-btn ${currentPct === 50 ? 'active' : ''}" data-action="set-pct" data-task-id="${task.id}" data-pct="50">50%</button>
          <button class="quantified-quick-btn ${currentPct === 75 ? 'active' : ''}" data-action="set-pct" data-task-id="${task.id}" data-pct="75">75%</button>
          <button class="quantified-quick-btn ${currentPct === 100 ? 'active' : ''}" data-action="set-pct" data-task-id="${task.id}" data-pct="100">100%</button>
          <input type="number" class="quantified-direct-input" 
                 data-action="input-quantified" 
                 data-task-id="${task.id}" 
                 data-target="${targetVal}"
                 value="${currentAmount}" 
                 step="any" 
                 min="0" 
                 max="${targetVal}" 
                 title="Enter exact ${escapeHtml(unit)} logged">
        </div>
      `;
    }

    return `
      <div class="percentage-control-wrap">
        <button class="percentage-btn ${currentPct === 25 ? 'active' : ''}" data-action="set-pct" data-task-id="${task.id}" data-pct="25">25%</button>
        <button class="percentage-btn ${currentPct === 50 ? 'active' : ''}" data-action="set-pct" data-task-id="${task.id}" data-pct="50">50%</button>
        <button class="percentage-btn ${currentPct === 75 ? 'active' : ''}" data-action="set-pct" data-task-id="${task.id}" data-pct="75">75%</button>
        <button class="percentage-btn ${currentPct === 100 ? 'active' : ''}" data-action="set-pct" data-task-id="${task.id}" data-pct="100">100%</button>
        <span style="font-size: 0.8rem; font-weight: 600; color: var(--color-progress); min-width: 36px;">${currentPct}%</span>
      </div>
    `;
  }

  // 3. Standard Checklist (Binary Checkmark)
  const isChecked = evaluation.status === 'done';
  return `
    <button class="btn-check-toggle ${isChecked ? 'checked' : ''}" 
            data-action="toggle-check" 
            data-task-id="${task.id}" 
            title="Toggle Complete">
      <svg viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
      </svg>
    </button>
  `;
}

