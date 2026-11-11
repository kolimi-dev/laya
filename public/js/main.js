/**
 * Laya (లయ) — Master Application Coordinator
 * Enforces Shell-First Progressive Loading (Stage 1 DOM -> Stage 2 Local Cache -> Stage 3 Network)
 * Keeps code strictly modular with < 200 lines per module
 */

import { api, logEvent, setupNetworkMonitor } from './core/api.js';
import { createInitialState, saveCachedChecklist, savePinnedCharts } from './core/state.js';
import { updateViewTabBadges, switchView, updateOperationalDate, initThemeToggle } from './components/header-shell.js';
import { renderGroupTabs, populateGroupSelects } from './components/group-tabs.js';
import { renderTodayChecklist } from './components/task-card.js';
import { setupTaskModal, applyFeaturesToUi } from './components/task-modal.js';
import { renderChartsView, setupChartBlockEvents, populateAddChartTaskSelect } from './components/chart-block.js';
import {
  setupModalClosers,
  setupCreateGroupModal,
  setupCapabilitiesModal,
  setupOtpPurgeModal,
  setupDataPortability,
  setupFeedbackModal,
  setupConsentModal,
  seedSampleHabits,
} from './components/system-modals.js';
import { logTelemetry, setupGlobalErrorLogger } from './core/logger.js';

// Central Reactive State
const state = createInitialState();

// DOM Element Registry
const el = {
  dateText: document.getElementById('operational-date-text'),
  networkBadge: document.getElementById('network-badge'),

  btnViewTasks: document.getElementById('btn-view-tasks'),
  btnViewCharts: document.getElementById('btn-view-charts'),
  sectionTasksView: document.getElementById('section-tasks-view'),
  sectionChartsView: document.getElementById('section-charts-view'),
  badgeRemainingCount: document.getElementById('badge-remaining-count'),
  badgeChartsCount: document.getElementById('badge-charts-count'),

  groupTabsContainer: document.getElementById('group-tabs-container'),
  feedRemaining: document.getElementById('feed-remaining'),
  feedCompleted: document.getElementById('feed-completed'),
  headerRemainingCount: document.getElementById('header-remaining-count'),
  headerCompletedCount: document.getElementById('header-completed-count'),

  timeFilterButtons: document.getElementById('time-filter-buttons'),
  customDateInputs: document.getElementById('custom-date-inputs'),
  chartDateFrom: document.getElementById('chart-date-from'),
  chartDateTo: document.getElementById('chart-date-to'),
  btnApplyCustomDate: document.getElementById('btn-apply-custom-date'),
  btnOpenAddChart: document.getElementById('btn-open-add-chart'),
  taskChartsGrid: document.getElementById('task-charts-grid'),

  modalTask: document.getElementById('modal-task-backdrop'),
  taskGroupSelect: document.getElementById('task-group-select'),
  taskTypeSelect: document.getElementById('task-type-select'),
  milestonesGroup: document.getElementById('milestones-input-group'),
  percentageGroup: document.getElementById('percentage-input-group'),
  recurrenceSelect: document.getElementById('task-recurrence-select'),
  cycleDaysGroup: document.getElementById('cycle-days-group'),
  milestonesBuilderList: document.getElementById('milestones-builder-list'),
  daysPickerPills: document.getElementById('days-picker-pills'),

  modalGroup: document.getElementById('modal-group-backdrop'),
  modalCapabilities: document.getElementById('modal-capabilities-backdrop'),
  modalOnboarding: document.getElementById('modal-onboarding-backdrop'),
  modalSponsor: document.getElementById('modal-sponsor-backdrop'),
  modalFeedback: document.getElementById('modal-feedback-backdrop'),
  modalData: document.getElementById('modal-data-backdrop'),
  modalOtp: document.getElementById('modal-otp-backdrop'),

  modalAddChart: document.getElementById('modal-add-chart-backdrop'),
  selectChartTask: document.getElementById('select-chart-task'),
  selectChartType: document.getElementById('select-chart-type'),
  formAddChart: document.getElementById('form-add-chart'),

  otpExpectedCode: document.getElementById('otp-expected-code'),
  otpInputField: document.getElementById('otp-input-field'),
  btnConfirmPurge: document.getElementById('btn-confirm-purge'),
  otpErrorMsg: document.getElementById('otp-error-msg'),

  toggleFeatMilestones: document.getElementById('toggle-feat-milestones'),
  toggleFeatQuantified: document.getElementById('toggle-feat-quantified'),
  toggleFeatRadialDial: document.getElementById('toggle-feat-radial-dial'),
  toggleFeatMicronotes: document.getElementById('toggle-feat-micronotes'),
  toggleFeatSchedules: document.getElementById('toggle-feat-schedules'),
};

async function refreshAllData() {
  try {
    const asOf = new Date().toISOString();
    const [groupsRes, checklistRes, tasksRes] = await Promise.all([
      api('/api/v1/groups', {}, state.token).catch(() => ({ groups: [] })),
      api(`/api/v1/tasks/active?asOf=${asOf}&dayCutoffHour=3`, {}, state.token).catch(() => null),
      api('/api/v1/tasks', {}, state.token).catch(() => ({ tasks: [] })),
    ]);

    state.groups = groupsRes.groups || [];
    if (checklistRes && checklistRes.checklist) {
      state.checklist = checklistRes.checklist;
      saveCachedChecklist(state.checklist);
      updateOperationalDate(el.dateText, state.checklist.operationalDate);
    }
    state.allTasks = (tasksRes.tasks || []).map((t) => ({ ...t.task, milestones: t.milestones }));

    populateGroupSelects(el.taskGroupSelect, state.groups);
    populateAddChartTaskSelect(el.selectChartTask, state);
    renderGroupTabs(el.groupTabsContainer, state.groups, state.selectedGroupId);
    renderTodayChecklist(state, el);

    if (state.activeView === 'charts') {
      await renderChartsView(el, state);
    }
    updateViewTabBadges(state, el);
  } catch (err) {
    console.error('Data refresh error:', err);
  }
}

function setupTaskViewInteractions() {
  if (!el.sectionTasksView) return;

  el.sectionTasksView.addEventListener('click', async (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const taskId = target.dataset.taskId;
    logTelemetry('action', action, { taskId });

    if (action === 'toggle-check') {
      const isChecked = target.classList.contains('checked');
      await logEvent(taskId, { status: isChecked ? 'pending' : 'done' }, state.token);
      await refreshAllData();
    } else if (action === 'toggle-milestone') {
      const milestoneId = target.dataset.milestoneId;
      await logEvent(taskId, { status: 'done', milestoneId }, state.token);
      await refreshAllData();
    } else if (action === 'set-pct') {
      const pct = parseFloat(target.dataset.pct);
      const status = pct >= 100 ? 'done' : pct > 0 ? 'in_progress' : 'pending';
      await logEvent(taskId, { status, progressPercentage: pct }, state.token);
      await refreshAllData();
    } else if (action === 'ignore') {
      await logEvent(taskId, { status: 'ignored', notes: 'Intentional rest day / pause' }, state.token);
      await refreshAllData();
    } else if (action === 'toggle-chart-pin') {
      const existingIdx = state.pinnedCharts.findIndex((c) => c.taskId === taskId);
      if (existingIdx >= 0) {
        state.pinnedCharts.splice(existingIdx, 1);
      } else {
        state.pinnedCharts.push({ taskId, chartType: 'auto' });
      }
      savePinnedCharts(state.pinnedCharts);
      renderTodayChecklist(state, el);
      updateViewTabBadges(state, el);
    }
  });

  el.sectionTasksView.addEventListener('change', async (e) => {
    if (e.target.dataset.action === 'input-quantified') {
      const taskId = e.target.dataset.taskId;
      const targetVal = parseFloat(e.target.dataset.target);
      const enteredVal = parseFloat(e.target.value);
      if (isNaN(enteredVal) || enteredVal < 0 || !targetVal) return;

      const calculatedPct = Math.min(100, Math.max(0, (enteredVal / targetVal) * 100));
      const status = calculatedPct >= 100 ? 'done' : calculatedPct > 0 ? 'in_progress' : 'pending';
      await logEvent(taskId, { status, progressPercentage: Math.round(calculatedPct * 100) / 100 }, state.token);
      await refreshAllData();
    }

    if (e.target.classList.contains('note-input')) {
      const taskId = e.target.dataset.taskId;
      const note = e.target.value.trim();
      if (!note) return;
      await logEvent(taskId, { status: 'in_progress', notes: note }, state.token);
      await refreshAllData();
    }
  });
}

function init() {
  setupGlobalErrorLogger();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // STAGE 1: Immediate Shell & Monitor Setup (0ms)
  setupNetworkMonitor(el.networkBadge);
  initThemeToggle();
  setupModalClosers([
    ['btn-close-task-modal', el.modalTask],
    ['btn-cancel-task', el.modalTask],
    ['btn-close-group-modal', el.modalGroup],
    ['btn-cancel-group', el.modalGroup],
    ['btn-close-capabilities', el.modalCapabilities],
    ['btn-close-onboarding', el.modalOnboarding],
    ['btn-close-sponsor', el.modalSponsor],
    ['btn-dismiss-sponsor', el.modalSponsor],
    ['btn-close-feedback', el.modalFeedback],
    ['btn-cancel-feedback', el.modalFeedback],
    ['btn-close-data', el.modalData],
    ['btn-dismiss-data', el.modalData],
    ['btn-close-otp', el.modalOtp],
    ['btn-cancel-otp', el.modalOtp],
    ['btn-close-add-chart', el.modalAddChart],
    ['btn-cancel-add-chart', el.modalAddChart],
  ]);

  if (el.btnViewTasks) {
    el.btnViewTasks.addEventListener('click', () => switchView('tasks', state, el, () => renderTodayChecklist(state, el), null));
  }
  if (el.btnViewCharts) {
    el.btnViewCharts.addEventListener('click', () => switchView('charts', state, el, null, () => renderChartsView(el, state)));
  }

  if (el.groupTabsContainer) {
    el.groupTabsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.group-tab');
      if (!btn) return;
      state.selectedGroupId = btn.dataset.groupId;
      renderGroupTabs(el.groupTabsContainer, state.groups, state.selectedGroupId);
      renderTodayChecklist(state, el);
    });
  }

  setupTaskViewInteractions();
  setupTaskModal(el, state, refreshAllData);
  setupChartBlockEvents(el, state, () => {
    renderTodayChecklist(state, el);
    updateViewTabBadges(state, el);
  });
  setupCreateGroupModal(el, state, refreshAllData);
  setupCapabilitiesModal(el, state, () => {
    applyFeaturesToUi(el, state);
    renderTodayChecklist(state, el);
  });
  setupOtpPurgeModal(el, state);
  setupDataPortability(el, state, refreshAllData);
  setupFeedbackModal(el, state);
  setupConsentModal();

  const btnOnboarding = document.getElementById('btn-onboarding');
  if (btnOnboarding && el.modalOnboarding) {
    btnOnboarding.addEventListener('click', () => { el.modalOnboarding.hidden = false; });
  }
  const btnSponsor = document.getElementById('btn-sponsor');
  if (btnSponsor && el.modalSponsor) {
    btnSponsor.addEventListener('click', () => { el.modalSponsor.hidden = false; });
  }

  // STAGE 2: Hydrate Local Cache Instantly (< 10ms)
  applyFeaturesToUi(el, state);
  if (state.checklist) {
    updateOperationalDate(el.dateText, state.checklist.operationalDate);
    renderTodayChecklist(state, el);
  }
  updateViewTabBadges(state, el);

  // STAGE 3: Revalidate in Background
  refreshAllData().then(async () => {
    if (!state.checklist || state.checklist.items.length === 0) {
      await seedSampleHabits(state.token);
      await refreshAllData();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

