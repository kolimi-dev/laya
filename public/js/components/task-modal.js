/**
 * Laya (లయ) — Task Creation Modal & Dynamic Field Isolators
 * Enforces strict isolation: Milestone vs Quantified vs Checklist
 * Isolates recurrence subgroups (days_of_week, monthly, quarterly, yearly, custom)
 */

import { api, escapeHtml } from '../core/api.js';

export function addMilestoneRow(listEl, value = '') {
  if (!listEl) return;

  const row = document.createElement('div');
  row.className = 'milestone-builder-row';
  row.innerHTML = `
    <span class="milestone-drag-handle">≡</span>
    <input type="text" class="milestone-builder-input" placeholder="e.g. 1L, 2L, 3L or Step 1..." value="${escapeHtml(value)}">
    <button type="button" class="btn-remove-milestone-row" title="Remove checkpoint">✕</button>
  `;

  row.querySelector('.btn-remove-milestone-row').addEventListener('click', () => {
    row.remove();
  });

  listEl.appendChild(row);
  const input = row.querySelector('.milestone-builder-input');
  if (input && !value) input.focus();
}

export function getMilestoneValues() {
  const inputs = document.querySelectorAll('#milestones-builder-list .milestone-builder-input');
  return Array.from(inputs).map((input) => input.value.trim()).filter(Boolean);
}

export function initDefaultMilestoneRows(listEl) {
  if (!listEl) return;
  if (listEl.children.length === 0) {
    addMilestoneRow(listEl, '1L');
    addMilestoneRow(listEl, '2L');
    addMilestoneRow(listEl, '3L');
  }
}

export function syncTaskTypeFormFields(el) {
  if (!el.taskTypeSelect) return;
  const selectedType = el.taskTypeSelect.value;
  const isMilestone = selectedType === 'milestone';
  const isQuantified = selectedType === 'percentage';

  // Strict isolation: only show groups belonging to active task type
  if (el.milestonesGroup) el.milestonesGroup.hidden = !isMilestone;
  if (el.percentageGroup) el.percentageGroup.hidden = !isQuantified;

  const targetInput = document.getElementById('task-target-val');
  const unitInput = document.getElementById('task-unit-input');

  if (isQuantified) {
    if (targetInput) targetInput.required = true;
    if (unitInput) unitInput.required = true;
  } else {
    if (targetInput) {
      targetInput.required = false;
      targetInput.value = '';
    }
    if (unitInput) {
      unitInput.required = false;
      unitInput.value = '';
    }
  }

  if (isMilestone) {
    initDefaultMilestoneRows(el.milestonesBuilderList);
    document.querySelectorAll('#milestones-builder-list .milestone-builder-input').forEach((input) => {
      input.required = true;
    });
  } else {
    document.querySelectorAll('#milestones-builder-list .milestone-builder-input').forEach((input) => {
      input.required = false;
    });
  }
}

export function syncRecurrenceFormFields(el) {
  if (!el.recurrenceSelect) return;
  const rec = el.recurrenceSelect.value;
  const daysOfWeekGroup = document.getElementById('freq-days-of-week-group');
  const monthlyGroup = document.getElementById('freq-monthly-group');
  const quarterlyGroup = document.getElementById('freq-quarterly-group');
  const yearlyGroup = document.getElementById('freq-yearly-group');
  const cycleDaysGroup = document.getElementById('cycle-days-group');

  if (daysOfWeekGroup) daysOfWeekGroup.hidden = rec !== 'days_of_week';
  if (monthlyGroup) monthlyGroup.hidden = rec !== 'monthly';
  if (quarterlyGroup) quarterlyGroup.hidden = rec !== 'quarterly';
  if (yearlyGroup) yearlyGroup.hidden = rec !== 'yearly';
  if (cycleDaysGroup) cycleDaysGroup.hidden = rec !== 'custom';
}

export function applyFeaturesToUi(el, state) {
  if (!el.taskTypeSelect || !el.recurrenceSelect) return;

  const currentVal = el.taskTypeSelect.value;
  let typeOptionsHtml = '<option value="checklist">Standard Checklist (Yes/No)</option>';

  if (state.features.milestones) {
    typeOptionsHtml += '<option value="milestone">Discrete Milestones (Checkpoints)</option>';
  }
  if (state.features.quantified) {
    typeOptionsHtml += '<option value="percentage">Quantified Target (Amount & Unit)</option>';
  }

  el.taskTypeSelect.innerHTML = typeOptionsHtml;
  const options = Array.from(el.taskTypeSelect.options).map((o) => o.value);
  el.taskTypeSelect.value = options.includes(currentVal) ? currentVal : 'checklist';
  syncTaskTypeFormFields(el);

  const currentRec = el.recurrenceSelect.value;
  let recOptionsHtml = `
    <option value="daily">Every Day</option>
    <option value="anytime">Flexible / Anytime (No fixed date)</option>
  `;
  if (state.features.schedules) {
    recOptionsHtml = `
      <option value="daily">Every Day</option>
      <option value="days_of_week">Specific Days of Week</option>
      <option value="monthly">Monthly (Specific day of month)</option>
      <option value="quarterly">Quarterly (Every 3 months)</option>
      <option value="yearly">Yearly (Annual date)</option>
      <option value="custom">Custom Gap (Every N days)</option>
      <option value="anytime">Flexible / Anytime (No fixed date)</option>
    `;
  }
  el.recurrenceSelect.innerHTML = recOptionsHtml;
  const recOptions = Array.from(el.recurrenceSelect.options).map((o) => o.value);
  el.recurrenceSelect.value = recOptions.includes(currentRec) ? currentRec : 'daily';
  syncRecurrenceFormFields(el);
}

export function setupTaskModal(el, state, refreshAllDataFn) {
  if (el.taskTypeSelect) {
    el.taskTypeSelect.addEventListener('change', () => syncTaskTypeFormFields(el));
  }
  if (el.recurrenceSelect) {
    el.recurrenceSelect.addEventListener('change', () => syncRecurrenceFormFields(el));
  }

  const btnAddMilestone = document.getElementById('btn-add-milestone-row');
  if (btnAddMilestone) {
    btnAddMilestone.addEventListener('click', () => addMilestoneRow(el.milestonesBuilderList));
  }

  const daysPicker = document.getElementById('days-picker-pills');
  if (daysPicker) {
    daysPicker.addEventListener('click', (e) => {
      const pill = e.target.closest('.day-pill');
      if (!pill) return;
      pill.classList.toggle('active');
      const activeCount = daysPicker.querySelectorAll('.day-pill.active').length;
      if (activeCount === 0) pill.classList.add('active');
    });
  }

  const btnOpenModal = document.getElementById('btn-create-task-modal');
  if (btnOpenModal) {
    btnOpenModal.addEventListener('click', () => {
      syncTaskTypeFormFields(el);
      syncRecurrenceFormFields(el);
      if (el.modalTask) el.modalTask.hidden = false;
    });
  }

  const form = document.getElementById('form-create-task');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = (document.getElementById('task-title-input')?.value || '').trim();
    const groupId = document.getElementById('task-group-select')?.value || null;
    const taskType = document.getElementById('task-type-select')?.value || 'checklist';
    const recurrenceChoice = document.getElementById('task-recurrence-select')?.value || 'daily';

    let targetValue = null;
    let unit = null;
    let milestones = null;

    if (taskType === 'percentage') {
      const rawTarget = document.getElementById('task-target-val')?.value;
      const rawUnit = document.getElementById('task-unit-input')?.value.trim();
      targetValue = rawTarget ? parseFloat(rawTarget) : null;
      unit = rawUnit || null;
    }

    if (taskType === 'milestone') {
      milestones = getMilestoneValues();
      if (milestones.length === 0) {
        alert('Please enter at least one milestone checkpoint.');
        return;
      }
    }

    let recurrence = recurrenceChoice;
    let schedule;
    let cycleDays;

    if (recurrenceChoice === 'days_of_week') {
      const activeDays = Array.from(document.querySelectorAll('#days-picker-pills .day-pill.active'))
        .map((p) => p.dataset.day);
      if (activeDays.length === 0) {
        alert('Please select at least one day of the week.');
        return;
      }
      schedule = { cadence: { type: 'day_mask', days: activeDays } };
    } else if (recurrenceChoice === 'monthly') {
      const dayOfMonth = parseInt(document.getElementById('task-month-day')?.value, 10) || 1;
      schedule = { cadence: { type: 'monthly', dayOfMonth } };
    } else if (recurrenceChoice === 'quarterly') {
      const dayOfMonth = parseInt(document.getElementById('task-quarter-day')?.value, 10) || 1;
      schedule = { cadence: { type: 'quarterly', dayOfMonth } };
    } else if (recurrenceChoice === 'yearly') {
      const month = parseInt(document.getElementById('task-yearly-month')?.value, 10) || 1;
      const dayOfMonth = parseInt(document.getElementById('task-yearly-day')?.value, 10) || 1;
      schedule = { cadence: { type: 'yearly', month, dayOfMonth } };
    } else if (recurrenceChoice === 'custom') {
      cycleDays = parseInt(document.getElementById('task-cycle-days')?.value, 10) || 5;
    }

    try {
      await api('/api/v1/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title,
          groupId,
          taskType,
          recurrence,
          cycleDays,
          schedule,
          targetValue,
          unit,
          milestones,
        }),
      }, state.token);

      if (el.modalTask) el.modalTask.hidden = true;
      form.reset();
      syncTaskTypeFormFields(el);
      syncRecurrenceFormFields(el);
      if (typeof refreshAllDataFn === 'function') await refreshAllDataFn();
    } catch (err) {
      alert(`Failed to create task: ${err.message}`);
    }
  });
}
