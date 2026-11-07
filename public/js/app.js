/**
 * Laya (లయ) — Frontend Application Controller
 * Pressure-Free Consistency & Natural Cadence Engine
 * Human-First Tasks & Per-Task Custom Charts
 */

(function () {
  'use strict';

  // ==========================================================================
  // Progressive Disclosure, Features & Pinned Charts Storage
  // ==========================================================================
  const DEFAULT_FEATURES = {
    milestones: true,
    quantified: true,
    radialDial: false, // Default off to eliminate AI dashboard clutter
    micronotes: true,
    schedules: true,
  };

  function loadFeatures() {
    try {
      const saved = localStorage.getItem('laya_features');
      if (saved) return { ...DEFAULT_FEATURES, ...JSON.parse(saved) };
    } catch (_) {}
    return { ...DEFAULT_FEATURES };
  }

  function saveFeatures(features) {
    try {
      localStorage.setItem('laya_features', JSON.stringify(features));
    } catch (_) {}
  }

  // Pinned Charts: EMPTY by default ("by default no charts are visible, user adds only what they want")
  function loadPinnedCharts() {
    try {
      const saved = localStorage.getItem('laya_pinned_charts');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [];
  }

  function savePinnedCharts(pinned) {
    try {
      localStorage.setItem('laya_pinned_charts', JSON.stringify(pinned));
    } catch (_) {}
  }

  // ==========================================================================
  // Application State
  // ==========================================================================
  const state = {
    userId: 'usr_alice_123',
    token: 'token_for_alice', // Accepted in development mode
    activeView: 'tasks', // 'tasks' or 'charts'
    selectedGroupId: 'all',
    chartTimeRange: '30d', // 'week', 'month', '30d', '90d', '1y', 'custom'
    customRange: { from: null, to: null },
    groups: [],
    checklist: null,
    allTasks: [],
    pinnedCharts: loadPinnedCharts(),
    features: loadFeatures(),
    currentOtp: '',
    taskEventsCache: new Map(),
  };

  // ==========================================================================
  // DOM Elements
  // ==========================================================================
  const el = {
    dateText: document.getElementById('operational-date-text'),
    networkBadge: document.getElementById('network-badge'),

    // View Navigation & Views
    btnViewTasks: document.getElementById('btn-view-tasks'),
    btnViewCharts: document.getElementById('btn-view-charts'),
    sectionTasksView: document.getElementById('section-tasks-view'),
    sectionChartsView: document.getElementById('section-charts-view'),
    badgeRemainingCount: document.getElementById('badge-remaining-count'),
    badgeChartsCount: document.getElementById('badge-charts-count'),

    // Today's Tasks View
    groupTabsContainer: document.getElementById('group-tabs-container'),
    feedRemaining: document.getElementById('feed-remaining'),
    feedCompleted: document.getElementById('feed-completed'),
    headerRemainingCount: document.getElementById('header-remaining-count'),
    headerCompletedCount: document.getElementById('header-completed-count'),

    // Task Charts View
    timeFilterButtons: document.getElementById('time-filter-buttons'),
    customDateInputs: document.getElementById('custom-date-inputs'),
    chartDateFrom: document.getElementById('chart-date-from'),
    chartDateTo: document.getElementById('chart-date-to'),
    btnApplyCustomDate: document.getElementById('btn-apply-custom-date'),
    btnOpenAddChart: document.getElementById('btn-open-add-chart'),
    taskChartsGrid: document.getElementById('task-charts-grid'),

    // Modals
    modalTask: document.getElementById('modal-task-backdrop'),
    taskGroupSelect: document.getElementById('task-group-select'),
    taskTypeSelect: document.getElementById('task-type-select'),
    milestonesGroup: document.getElementById('milestones-input-group'),
    percentageGroup: document.getElementById('percentage-input-group'),
    recurrenceSelect: document.getElementById('task-recurrence-select'),
    cycleDaysGroup: document.getElementById('cycle-days-group'),

    modalGroup: document.getElementById('modal-group-backdrop'),
    modalCapabilities: document.getElementById('modal-capabilities-backdrop'),
    modalOnboarding: document.getElementById('modal-onboarding-backdrop'),
    modalSponsor: document.getElementById('modal-sponsor-backdrop'),
    modalFeedback: document.getElementById('modal-feedback-backdrop'),
    modalData: document.getElementById('modal-data-backdrop'),
    modalOtp: document.getElementById('modal-otp-backdrop'),

    // Add Chart Modal
    modalAddChart: document.getElementById('modal-add-chart-backdrop'),
    selectChartTask: document.getElementById('select-chart-task'),
    selectChartType: document.getElementById('select-chart-type'),
    formAddChart: document.getElementById('form-add-chart'),
    btnCancelAddChart: document.getElementById('btn-cancel-add-chart'),
    btnCloseAddChart: document.getElementById('btn-close-add-chart'),

    // OTP Elements
    otpExpectedCode: document.getElementById('otp-expected-code'),
    otpInputField: document.getElementById('otp-input-field'),
    btnConfirmPurge: document.getElementById('btn-confirm-purge'),
    otpErrorMsg: document.getElementById('otp-error-msg'),

    // Capability toggles
    toggleFeatMilestones: document.getElementById('toggle-feat-milestones'),
    toggleFeatQuantified: document.getElementById('toggle-feat-quantified'),
    toggleFeatRadialDial: document.getElementById('toggle-feat-radial-dial'),
    toggleFeatMicronotes: document.getElementById('toggle-feat-micronotes'),
    toggleFeatSchedules: document.getElementById('toggle-feat-schedules'),
  };

  // ==========================================================================
  // API Fetch Helper
  // ==========================================================================
  async function api(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${state.token}`,
      ...(options.headers || {}),
    };

    try {
      const response = await fetch(path, { ...options, headers });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || error.message || `HTTP ${response.status}`);
      }
      if (response.status === 204) return null;
      return await response.json();
    } catch (err) {
      console.warn(`[API] ${path} error:`, err);
      throw err;
    }
  }

  // ==========================================================================
  // Initialization & Refresh
  // ==========================================================================
  async function init() {
    setupEventListeners();
    setupNetworkMonitor();
    applyFeaturesToUi();
    updateViewTabBadges();

    try {
      await refreshAllData();
      if (!state.checklist || state.checklist.items.length === 0) {
        await seedSampleHabits();
        await refreshAllData();
      }
    } catch (err) {
      console.error('Initialization error:', err);
    }
  }

  async function refreshAllData() {
    await Promise.all([
      fetchGroups(),
      fetchActiveChecklist(),
      fetchAllTasks(),
    ]);

    renderGroupTabs();
    renderTodayChecklist();
    if (state.activeView === 'charts') {
      await renderChartsView();
    }
    updateViewTabBadges();
  }

  async function fetchGroups() {
    try {
      const data = await api('/api/v1/groups');
      state.groups = data.groups || [];
      populateGroupSelects();
    } catch (e) {
      console.warn('Failed to load groups:', e);
    }
  }

  async function fetchAllTasks() {
    try {
      const data = await api('/api/v1/tasks');
      state.allTasks = (data.tasks || []).map((t) => t.task);
      populateAddChartTaskSelect();
    } catch (e) {
      console.warn('Failed to load all tasks:', e);
    }
  }

  async function fetchActiveChecklist() {
    try {
      const asOf = new Date().toISOString();
      const data = await api(`/api/v1/tasks/active?asOf=${asOf}&dayCutoffHour=3`);
      state.checklist = data.checklist;

      if (state.checklist && state.checklist.operationalDate) {
        const d = new Date(state.checklist.operationalDate);
        el.dateText.textContent = `Today's Rhythm • ${d.toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}`;
      }
    } catch (e) {
      console.warn('Failed to load active checklist:', e);
    }
  }

  // ==========================================================================
  // View Switcher (Today's Tasks vs Task Charts)
  // ==========================================================================
  function switchView(viewName) {
    state.activeView = viewName;
    el.btnViewTasks.classList.toggle('active', viewName === 'tasks');
    el.btnViewCharts.classList.toggle('active', viewName === 'charts');
    el.sectionTasksView.hidden = viewName !== 'tasks';
    el.sectionChartsView.hidden = viewName !== 'charts';

    if (viewName === 'charts') {
      renderChartsView();
    } else {
      renderTodayChecklist();
    }
    updateViewTabBadges();
  }

  function updateViewTabBadges() {
    const items = state.checklist?.items || [];
    let remaining = 0;
    items.forEach((i) => {
      if (!i.evaluation.isIgnored && i.evaluation.status !== 'done') remaining++;
    });

    el.badgeRemainingCount.textContent = remaining;
    el.badgeChartsCount.textContent = state.pinnedCharts.length;
  }

  // ==========================================================================
  // TODAY'S TASKS: Remaining Tasks on Top, Completed/Rest Below
  // ==========================================================================
  function renderTodayChecklist() {
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
    el.headerRemainingCount.textContent = `${remainingItems.length} task${remainingItems.length === 1 ? '' : 's'}`;
    el.headerCompletedCount.textContent = `${completedItems.length} task${completedItems.length === 1 ? '' : 's'}`;
    updateViewTabBadges();

    // 1. Render Remaining Tasks (Top)
    if (remainingItems.length === 0) {
      el.feedRemaining.innerHTML = `
        <div class="empty-state" style="padding: 32px 16px;">
          <p style="font-size: 1rem; color: var(--color-done); font-weight: 500;">
            🎉 All remaining tasks completed for today! Take time to rest.
          </p>
        </div>
      `;
    } else {
      el.feedRemaining.innerHTML = remainingItems.map((item) => renderTaskCard(item)).join('');
    }

    // 2. Render Completed & Rested Tasks (Below)
    if (completedItems.length === 0) {
      el.feedCompleted.innerHTML = `
        <div class="empty-state" style="padding: 20px;">
          <p style="font-size: 0.8rem; color: var(--text-subtle);">No tasks checked off or rested yet today.</p>
        </div>
      `;
    } else {
      el.feedCompleted.innerHTML = completedItems.map((item) => renderTaskCard(item)).join('');
    }
  }

  function renderTaskCard(item) {
    const { task, group, milestones, evaluation } = item;
    const isDone = evaluation.status === 'done';
    const isIgnored = evaluation.isIgnored;
    const statusClass = isIgnored ? 'status-ignored' : isDone ? 'status-done' : evaluation.status === 'in_progress' ? 'status-in_progress' : '';

    const groupColor = group?.color || '#8B5CF6';
    const groupName = group?.name || 'General';

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

            <!-- Guilt-Free Ignore / Rest Action -->
            <button class="btn-ignore ${isIgnored ? 'ignored' : ''}" 
                    data-action="ignore" 
                    data-task-id="${task.id}"
                    title="Mark as intentional rest/pause (subtracted from denominator without guilt or penalty)">
              <span>🌙</span>
              <span>${isIgnored ? 'Resting (Exempt)' : 'Rest / Skip'}</span>
            </button>
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

  function renderTaskInteractiveControls(task, milestones, evaluation) {
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

  // ==========================================================================
  // TASK CHARTS VIEW: 1 Block Per Task, Default Empty, Time Filter
  // ==========================================================================
  async function renderChartsView() {
    const grid = el.taskChartsGrid;
    updateViewTabBadges();

    // 1. By default, no charts are visible! Show empty state
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
          populateAddChartTaskSelect();
          el.modalAddChart.hidden = false;
        });
      }
      return;
    }

    // 2. User has pinned chart blocks. Compute time filter window
    const windowDates = computeTimeWindowDates(state.chartTimeRange);
    grid.innerHTML = '<div class="spinner"></div>';

    // Fetch events for each pinned task
    const blocksHtml = [];

    for (const pinned of state.pinnedCharts) {
      // Find task metadata
      let task = state.allTasks.find((t) => t.id === pinned.taskId);
      if (!task && state.checklist) {
        const item = state.checklist.items.find((i) => i.task.id === pinned.taskId);
        if (item) task = item.task;
      }
      if (!task) continue;

      const group = state.groups.find((g) => g.id === task.groupId);
      const groupName = group?.name || 'General';
      const groupColor = group?.color || '#8B5CF6';

      // Fetch events in time window
      let events = [];
      try {
        const queryParams = new URLSearchParams();
        if (windowDates.from) queryParams.set('from', windowDates.from);
        if (windowDates.to) queryParams.set('to', windowDates.to);

        const data = await api(`/api/v1/tasks/${task.id}/events?${queryParams.toString()}`);
        events = data.events || [];
      } catch (e) {
        console.warn(`Could not fetch events for task ${task.id}:`, e);
      }

      // Determine smart chart style if set to 'auto'
      let activeStyle = pinned.chartType;
      if (!activeStyle || activeStyle === 'auto') {
        activeStyle = task.taskType === 'percentage' ? 'volume_bar' : 'rhythm_matrix';
      }

      // Generate SVG Chart & Summary
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
              <select class="chart-block-type-select" data-action="change-chart-style" data-task-id="${task.id}">
                <option value="volume_bar" ${activeStyle === 'volume_bar' ? 'selected' : ''}>Daily Volume Bars</option>
                <option value="rhythm_matrix" ${activeStyle === 'rhythm_matrix' ? 'selected' : ''}>Rhythm Matrix</option>
                <option value="trend_line" ${activeStyle === 'trend_line' ? 'selected' : ''}>Progress Trend Line</option>
              </select>
              <button class="btn-remove-chart" data-action="remove-chart" data-task-id="${task.id}" title="Remove this chart block">✕</button>
            </div>
          </div>

          <div class="chart-canvas-wrap">
            ${svgHtml}
          </div>

          <div class="chart-summary-stat">
            ${summaryHtml}
          </div>
        </div>
      `);
    }

    grid.innerHTML = blocksHtml.join('');
  }

  function computeTimeWindowDates(range) {
    const now = new Date();
    const to = now.toISOString();
    let from;

    if (range === 'week') {
      const d = new Date(now.getTime() - 7 * 86400000);
      from = d.toISOString();
    } else if (range === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      from = d.toISOString();
    } else if (range === '30d') {
      const d = new Date(now.getTime() - 30 * 86400000);
      from = d.toISOString();
    } else if (range === '90d') {
      const d = new Date(now.getTime() - 90 * 86400000);
      from = d.toISOString();
    } else if (range === '1y') {
      const d = new Date(now.getTime() - 365 * 86400000);
      from = d.toISOString();
    } else if (range === 'custom') {
      from = state.customRange.from ? new Date(state.customRange.from).toISOString() : new Date(now.getTime() - 30 * 86400000).toISOString();
      return {
        from,
        to: state.customRange.to ? new Date(state.customRange.to).toISOString() : to,
      };
    } else {
      const d = new Date(now.getTime() - 30 * 86400000);
      from = d.toISOString();
    }

    return { from, to };
  }

  // ==========================================================================
  // SVG Chart Generators for Different Task Types
  // ==========================================================================
  function generateTaskChartSvg(task, events, chartType, windowDates) {
    const startDate = new Date(windowDates.from);
    const endDate = new Date(windowDates.to);
    const dayCount = Math.max(7, Math.min(60, Math.ceil((endDate - startDate) / 86400000)));

    // Group events by YYYY-MM-DD
    const dayMap = new Map();
    events.forEach((ev) => {
      const dayStr = ev.occurredAt.slice(0, 10);
      const list = dayMap.get(dayStr) || [];
      list.push(ev);
      dayMap.set(dayStr, list);
    });

    const targetVal = task.targetValue ? Number(task.targetValue) : 100;
    const unit = task.unit || (task.taskType === 'percentage' ? '%' : 'pts');

    let totalAmount = 0;
    let completedDays = 0;
    let ignoredDays = 0;

    // Collect daily data points
    const dailyPoints = [];
    for (let i = dayCount - 1; i >= 0; i--) {
      const d = new Date(endDate.getTime() - i * 86400000);
      const dayKey = d.toISOString().slice(0, 10);
      const dayEvs = dayMap.get(dayKey) || [];

      let isDone = false;
      let isIgnored = false;
      let dayVal = 0;

      dayEvs.forEach((ev) => {
        if (ev.status === 'ignored') isIgnored = true;
        if (ev.status === 'done') isDone = true;

        if (ev.progressPercentage !== undefined && ev.progressPercentage !== null) {
          const val = (ev.progressPercentage / 100) * targetVal;
          if (val > dayVal) dayVal = val;
        } else if (ev.status === 'done') {
          dayVal = targetVal;
        }
      });

      if (isIgnored) ignoredDays++;
      if (isDone || dayVal >= targetVal) completedDays++;
      totalAmount += dayVal;

      dailyPoints.push({
        date: d,
        dayKey,
        value: dayVal,
        isDone,
        isIgnored,
        label: d.toLocaleDateString(undefined, { weekday: 'narrow', month: 'numeric', day: 'numeric' }),
      });
    }

    const avg = dailyPoints.length > 0 ? (totalAmount / dailyPoints.length) : 0;

    // CHART STYLE 1: Volume Bar Chart (e.g. 1.5L, 2.5L, 3L or 50 pages)
    if (chartType === 'volume_bar') {
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
          <!-- Target Threshold Line -->
          <line x1="${padL}" y1="${targetY}" x2="${svgW - padR}" y2="${targetY}" stroke="rgba(6, 182, 212, 0.4)" stroke-dasharray="4,4" stroke-width="1.5" />
          <text x="${svgW - padR}" y="${targetY - 4}" fill="#06B6D4" font-size="10" text-anchor="end" font-weight="600">Goal: ${targetVal} ${escapeHtml(unit)}</text>
          
          <!-- Baseline -->
          <line x1="${padL}" y1="${padT + plotH}" x2="${svgW - padR}" y2="${padT + plotH}" stroke="rgba(255,255,255,0.1)" stroke-width="1" />
          
          <!-- Bars -->
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

    // CHART STYLE 2: Rhythm Matrix (Heatmap Day Blocks)
    if (chartType === 'rhythm_matrix') {
      const blockSize = 14;
      const gap = 4;
      const cols = Math.min(dailyPoints.length, 30);
      const startIdx = Math.max(0, dailyPoints.length - cols);
      const slice = dailyPoints.slice(startIdx);

      let blocksSvg = '';
      slice.forEach((p, idx) => {
        const x = 30 + idx * (blockSize + gap);
        const y = 50;
        let fill = 'rgba(255,255,255,0.06)';
        if (p.isIgnored) fill = '#64748B'; // Serene slate
        else if (p.isDone || p.value >= targetVal) fill = '#10B981'; // Emerald
        else if (p.value > 0) fill = '#06B6D4'; // Cyan progress

        blocksSvg += `
          <rect x="${x}" y="${y}" width="${blockSize}" height="${blockSize}" rx="3" fill="${fill}">
            <title>${p.dayKey}: ${p.isIgnored ? 'Rest Day (Exempt)' : p.isDone ? 'Completed' : p.value > 0 ? `${Math.round(p.value)} ${escapeHtml(unit)}` : 'Open'}</title>
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

    // CHART STYLE 3: Cumulative Progress Trend Line
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

  // ==========================================================================
  // Sample Data Seed with 21-Day Authentic Event History
  // ==========================================================================
  async function seedSampleHabits() {
    // 1. Create default groups
    const healthGroup = await api('/api/v1/groups', {
      method: 'POST',
      body: JSON.stringify({ name: 'Health & Vitality', color: '#10B981', sortOrder: 1 }),
    }).catch(() => null);

    const workGroup = await api('/api/v1/groups', {
      method: 'POST',
      body: JSON.stringify({ name: 'Deep Work & Office', color: '#06B6D4', sortOrder: 2 }),
    }).catch(() => null);

    const personalGroup = await api('/api/v1/groups', {
      method: 'POST',
      body: JSON.stringify({ name: 'Personal & Mind', color: '#8B5CF6', sortOrder: 3 }),
    }).catch(() => null);

    // 2. Create Multi-Flavor Tasks
    // Task A: Drinking Water (Quantified 3 Liters)
    const waterTaskRes = await api('/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Drink Water Throughout Day',
        groupId: healthGroup?.group?.id,
        taskType: 'percentage',
        recurrence: 'daily',
        targetValue: 3,
        unit: 'L',
      }),
    }).catch(() => null);

    // Task B: Reading (Quantified 50 pages)
    const readTaskRes = await api('/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Deep Focus Reading',
        groupId: workGroup?.group?.id,
        taskType: 'percentage',
        recurrence: 'daily',
        targetValue: 50,
        unit: 'pages',
      }),
    }).catch(() => null);

    // Task C: Pushups (Binary Checklist)
    const pushupTaskRes = await api('/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Morning Pushups & Mobility Stretch',
        groupId: personalGroup?.group?.id,
        taskType: 'checklist',
        recurrence: 'daily',
      }),
    }).catch(() => null);

    // 3. Seed 21 Days of History so Charts show realistic data
    const now = new Date();
    const waterId = waterTaskRes?.task?.id;
    const readId = readTaskRes?.task?.id;
    const pushupId = pushupTaskRes?.task?.id;

    const sampleDays = 21;
    for (let i = sampleDays; i >= 1; i--) {
      const pastDate = new Date(now.getTime() - i * 86400000).toISOString();

      if (waterId) {
        const liters = (i % 7 === 0) ? 1.5 : (i % 3 === 0) ? 3.0 : 2.5;
        await api(`/api/v1/tasks/${waterId}/events`, {
          method: 'POST',
          body: JSON.stringify({
            id: `evt_w_${i}_${Date.now()}`,
            occurredAt: pastDate,
            status: liters >= 3 ? 'done' : 'in_progress',
            progressPercentage: Math.round((liters / 3) * 100),
          }),
        }).catch(() => null);
      }

      if (readId && i % 2 === 0) {
        const pages = 30 + (i % 5) * 6;
        await api(`/api/v1/tasks/${readId}/events`, {
          method: 'POST',
          body: JSON.stringify({
            id: `evt_r_${i}_${Date.now()}`,
            occurredAt: pastDate,
            status: pages >= 50 ? 'done' : 'in_progress',
            progressPercentage: Math.round((pages / 50) * 100),
          }),
        }).catch(() => null);
      }

      if (pushupId) {
        const isRest = i % 6 === 0;
        await api(`/api/v1/tasks/${pushupId}/events`, {
          method: 'POST',
          body: JSON.stringify({
            id: `evt_p_${i}_${Date.now()}`,
            occurredAt: pastDate,
            status: isRest ? 'ignored' : 'done',
            notes: isRest ? 'Intentional rest day' : undefined,
          }),
        }).catch(() => null);
      }
    }
  }

  // ==========================================================================
  // Progressive Disclosure: Apply Features to UI
  // ==========================================================================
  function applyFeaturesToUi() {
    const currentVal = el.taskTypeSelect.value;
    let typeOptionsHtml = '<option value="checklist">Standard Checklist (Yes/No)</option>';

    if (state.features.milestones) {
      typeOptionsHtml += '<option value="milestone">Discrete Milestones (1L, 2L, 3L)</option>';
    }
    if (state.features.quantified) {
      typeOptionsHtml += '<option value="percentage">Quantified Target (e.g. 10 min, 40 g, 3 L)</option>';
    }

    el.taskTypeSelect.innerHTML = typeOptionsHtml;

    const options = Array.from(el.taskTypeSelect.options).map((o) => o.value);
    if (options.includes(currentVal)) {
      el.taskTypeSelect.value = currentVal;
    } else {
      el.taskTypeSelect.value = 'checklist';
    }
    syncTaskTypeFormFields();

    const currentRec = el.recurrenceSelect.value;
    let recOptionsHtml = `
      <option value="daily">Daily (Appears every day)</option>
      <option value="anytime">Anytime Backlog (No fixed deadline)</option>
    `;
    if (state.features.schedules) {
      recOptionsHtml += `
        <option value="workweek">Standard Workweek (Mon–Fri)</option>
        <option value="custom">Custom Interval (e.g. every 5 days)</option>
      `;
    }
    el.recurrenceSelect.innerHTML = recOptionsHtml;
    const recOptions = Array.from(el.recurrenceSelect.options).map((o) => o.value);
    if (recOptions.includes(currentRec)) {
      el.recurrenceSelect.value = currentRec;
    } else {
      el.recurrenceSelect.value = 'daily';
    }
    el.cycleDaysGroup.hidden = el.recurrenceSelect.value !== 'custom';
  }

  function syncTaskTypeFormFields() {
    const selectedType = el.taskTypeSelect.value;
    el.milestonesGroup.hidden = selectedType !== 'milestone';
    el.percentageGroup.hidden = selectedType !== 'percentage';
  }

  function populateAddChartTaskSelect() {
    const select = el.selectChartTask;
    if (!select) return;

    select.innerHTML = '';
    const tasks = state.allTasks.length > 0 ? state.allTasks : (state.checklist?.items || []).map((i) => i.task);

    if (tasks.length === 0) {
      select.innerHTML = '<option value="">(No tasks created yet)</option>';
      return;
    }

    tasks.forEach((t) => {
      const typeLabel = t.taskType === 'percentage' && t.unit ? `${t.targetValue || ''} ${t.unit}` : t.taskType;
      select.innerHTML += `<option value="${t.id}">${escapeHtml(t.title)} (${typeLabel})</option>`;
    });
  }

  function renderGroupTabs() {
    const container = el.groupTabsContainer;
    const currentActive = state.selectedGroupId;

    let html = `<button class="group-tab ${currentActive === 'all' ? 'active' : ''}" data-group-id="all">All Groups</button>`;

    state.groups.forEach((g) => {
      const isActive = currentActive === g.id ? 'active' : '';
      const dot = g.color ? `<span class="task-tag-dot" style="background:${g.color}"></span>` : '';
      html += `
        <button class="group-tab ${isActive}" data-group-id="${g.id}">
          ${dot} ${escapeHtml(g.name)}
        </button>
      `;
    });

    container.innerHTML = html;
  }

  function populateGroupSelects() {
    const select = el.taskGroupSelect;
    select.innerHTML = '<option value="">(Unassigned / General)</option>';
    state.groups.forEach((g) => {
      select.innerHTML += `<option value="${g.id}">${escapeHtml(g.name)}</option>`;
    });
  }

  // ==========================================================================
  // Event Actions & Handlers
  // ==========================================================================
  function setupEventListeners() {
    // 1. View Switcher Tabs
    el.btnViewTasks.addEventListener('click', () => switchView('tasks'));
    el.btnViewCharts.addEventListener('click', () => switchView('charts'));

    // 2. Group Tab Click
    el.groupTabsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.group-tab');
      if (!btn) return;
      state.selectedGroupId = btn.dataset.groupId;
      renderGroupTabs();
      renderTodayChecklist();
    });

    // 3. Task Interactive Actions (Delegation on main tasks view)
    el.sectionTasksView.addEventListener('click', async (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      const taskId = target.dataset.taskId;

      if (action === 'toggle-check') {
        const isChecked = target.classList.contains('checked');
        const nextStatus = isChecked ? 'pending' : 'done';
        await logEvent(taskId, { status: nextStatus });
      } else if (action === 'toggle-milestone') {
        const milestoneId = target.dataset.milestoneId;
        await logEvent(taskId, { status: 'done', milestoneId });
      } else if (action === 'set-pct') {
        const pct = parseFloat(target.dataset.pct);
        const status = pct >= 100 ? 'done' : pct > 0 ? 'in_progress' : 'pending';
        await logEvent(taskId, { status, progressPercentage: pct });
      } else if (action === 'ignore') {
        await logEvent(taskId, {
          status: 'ignored',
          notes: 'Intentional rest day / pause',
        });
      } else if (action === 'toggle-chart-pin') {
        // Toggle pinned chart for this task
        const existingIdx = state.pinnedCharts.findIndex((c) => c.taskId === taskId);
        if (existingIdx >= 0) {
          state.pinnedCharts.splice(existingIdx, 1);
        } else {
          state.pinnedCharts.push({ taskId, chartType: 'auto' });
        }
        savePinnedCharts(state.pinnedCharts);
        renderTodayChecklist();
        updateViewTabBadges();
      }
    });

    // 4. Quantified Direct Input & Micro-Notes in Task Feed
    el.sectionTasksView.addEventListener('change', async (e) => {
      if (e.target.dataset.action === 'input-quantified') {
        const taskId = e.target.dataset.taskId;
        const targetVal = parseFloat(e.target.dataset.target);
        const enteredVal = parseFloat(e.target.value);

        if (isNaN(enteredVal) || enteredVal < 0 || !targetVal) return;

        const calculatedPct = Math.min(100, Math.max(0, (enteredVal / targetVal) * 100));
        const status = calculatedPct >= 100 ? 'done' : calculatedPct > 0 ? 'in_progress' : 'pending';

        await logEvent(taskId, {
          status,
          progressPercentage: Math.round(calculatedPct * 100) / 100,
        });
      }

      if (e.target.classList.contains('note-input')) {
        const taskId = e.target.dataset.taskId;
        const note = e.target.value.trim();
        if (!note) return;

        await logEvent(taskId, {
          status: 'in_progress',
          notes: note,
        });
      }
    });

    // 5. Time Filter Buttons on Task Charts View
    el.timeFilterButtons.addEventListener('click', (e) => {
      const chip = e.target.closest('.time-chip');
      if (!chip) return;

      const range = chip.dataset.range;
      state.chartTimeRange = range;

      document.querySelectorAll('.time-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');

      el.customDateInputs.hidden = range !== 'custom';
      if (range !== 'custom') {
        renderChartsView();
      }
    });

    el.btnApplyCustomDate.addEventListener('click', () => {
      state.customRange.from = el.chartDateFrom.value || null;
      state.customRange.to = el.chartDateTo.value || null;
      renderChartsView();
    });

    // 6. Chart Block Events: Remove Block & Change Chart Type
    el.taskChartsGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="remove-chart"]');
      if (!btn) return;
      const taskId = btn.dataset.taskId;
      state.pinnedCharts = state.pinnedCharts.filter((c) => c.taskId !== taskId);
      savePinnedCharts(state.pinnedCharts);
      renderChartsView();
      renderTodayChecklist();
      updateViewTabBadges();
    });

    el.taskChartsGrid.addEventListener('change', (e) => {
      if (e.target.dataset.action === 'change-chart-style') {
        const taskId = e.target.dataset.taskId;
        const newStyle = e.target.value;
        const found = state.pinnedCharts.find((c) => c.taskId === taskId);
        if (found) {
          found.chartType = newStyle;
          savePinnedCharts(state.pinnedCharts);
          renderChartsView();
        }
      }
    });

    // 7. Add Chart Modal Open & Submit
    el.btnOpenAddChart.addEventListener('click', () => {
      populateAddChartTaskSelect();
      el.modalAddChart.hidden = false;
    });

    el.formAddChart.addEventListener('submit', (e) => {
      e.preventDefault();
      const taskId = el.selectChartTask.value;
      const chartType = el.selectChartType.value;
      if (!taskId) return;

      // Add if not already pinned
      if (!state.pinnedCharts.some((c) => c.taskId === taskId)) {
        state.pinnedCharts.push({ taskId, chartType });
        savePinnedCharts(state.pinnedCharts);
      }

      el.modalAddChart.hidden = true;
      renderChartsView();
      renderTodayChecklist();
      updateViewTabBadges();
    });

    // 8. Other Modals
    document.getElementById('btn-create-task-modal').addEventListener('click', () => {
      syncTaskTypeFormFields();
      el.modalTask.hidden = false;
    });

    document.getElementById('btn-create-group-modal').addEventListener('click', () => {
      el.modalGroup.hidden = false;
    });

    document.getElementById('btn-onboarding').addEventListener('click', () => {
      el.modalOnboarding.hidden = false;
    });

    document.getElementById('btn-capabilities').addEventListener('click', () => {
      el.toggleFeatMilestones.checked = !!state.features.milestones;
      el.toggleFeatQuantified.checked = !!state.features.quantified;
      el.toggleFeatRadialDial.checked = !!state.features.radialDial;
      el.toggleFeatMicronotes.checked = !!state.features.micronotes;
      el.toggleFeatSchedules.checked = !!state.features.schedules;
      el.modalCapabilities.hidden = false;
    });

    document.getElementById('btn-sponsor').addEventListener('click', () => {
      el.modalSponsor.hidden = false;
    });

    document.getElementById('btn-feedback').addEventListener('click', () => {
      el.modalFeedback.hidden = false;
    });

    document.getElementById('btn-data-portability').addEventListener('click', () => {
      el.modalData.hidden = false;
    });

    // OTP Purge Challenge Trigger
    document.getElementById('btn-trigger-otp-purge').addEventListener('click', () => {
      state.currentOtp = String(Math.floor(100000 + Math.random() * 900000));
      el.otpExpectedCode.textContent = state.currentOtp;
      el.otpInputField.value = '';
      el.btnConfirmPurge.disabled = true;
      el.otpErrorMsg.hidden = true;
      el.modalOtp.hidden = false;
    });

    el.otpInputField.addEventListener('input', (e) => {
      const entered = e.target.value.trim();
      const isMatch = entered === state.currentOtp;
      el.btnConfirmPurge.disabled = !isMatch;
      el.otpErrorMsg.hidden = !entered || entered.length < 6 || isMatch;
    });

    el.btnConfirmPurge.addEventListener('click', () => {
      if (el.otpInputField.value.trim() === state.currentOtp) {
        localStorage.clear();
        alert('Local tracker cache cleared.');
        location.reload();
      }
    });

    setupModalClosers();
    setupFormSubmissions();
  }

  async function logEvent(taskId, payload) {
    const eventId = `evt_${crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Date.now()}`;
    try {
      await api(`/api/v1/tasks/${taskId}/events`, {
        method: 'POST',
        body: JSON.stringify({
          id: eventId,
          occurredAt: new Date().toISOString(),
          ...payload,
        }),
      });
      await refreshAllData();
    } catch (err) {
      alert(`Could not log progress: ${err.message}`);
    }
  }

  function setupFormSubmissions() {
    // 1. Create Task Form
    document.getElementById('form-create-task').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('task-title-input').value.trim();
      const groupId = document.getElementById('task-group-select').value || null;
      const taskType = document.getElementById('task-type-select').value;
      const recurrence = document.getElementById('task-recurrence-select').value;

      let targetValue = null;
      let unit = null;
      let milestones = null;

      if (taskType === 'percentage') {
        const rawTarget = document.getElementById('task-target-val').value;
        const rawUnit = document.getElementById('task-unit-input').value.trim();
        targetValue = rawTarget ? parseFloat(rawTarget) : 100;
        unit = rawUnit || 'units';
      }

      if (taskType === 'milestone') {
        const rawSteps = document.getElementById('task-milestones-input').value;
        milestones = rawSteps.split(',').map((s) => s.trim()).filter(Boolean);
      }

      let cycleDays;
      if (recurrence === 'custom') {
        cycleDays = parseInt(document.getElementById('task-cycle-days').value, 10);
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
            targetValue,
            unit,
            milestones,
          }),
        });

        el.modalTask.hidden = true;
        e.target.reset();
        await refreshAllData();
      } catch (err) {
        alert(`Failed to create task: ${err.message}`);
      }
    });

    // 2. Create Group Form
    document.getElementById('form-create-group').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('group-name-input').value.trim();
      const color = document.getElementById('group-color-input').value;
      const sortOrder = parseInt(document.getElementById('group-sort-input').value, 10);

      try {
        await api('/api/v1/groups', {
          method: 'POST',
          body: JSON.stringify({ name, color, sortOrder }),
        });

        el.modalGroup.hidden = true;
        e.target.reset();
        await refreshAllData();
      } catch (err) {
        alert(`Failed to create group: ${err.message}`);
      }
    });

    // 3. Save Capabilities
    document.getElementById('btn-save-capabilities').addEventListener('click', () => {
      state.features = {
        milestones: el.toggleFeatMilestones.checked,
        quantified: el.toggleFeatQuantified.checked,
        radialDial: el.toggleFeatRadialDial.checked,
        micronotes: el.toggleFeatMicronotes.checked,
        schedules: el.toggleFeatSchedules.checked,
      };

      saveFeatures(state.features);
      applyFeaturesToUi();
      renderTodayChecklist();
      el.modalCapabilities.hidden = true;
    });

    // 4. Feedback Form
    document.getElementById('form-feedback').addEventListener('submit', async (e) => {
      e.preventDefault();
      const category = document.getElementById('feedback-category').value;
      const message = document.getElementById('feedback-message').value.trim();

      try {
        await api('/api/v1/feedback', {
          method: 'POST',
          body: JSON.stringify({ category, message }),
        });

        alert('Thank you! Your feedback was directly submitted.');
        el.modalFeedback.hidden = true;
        e.target.reset();
      } catch (err) {
        alert(`Failed to submit feedback: ${err.message}`);
      }
    });

    // 5. Export JSON Backup
    document.getElementById('btn-export-json').addEventListener('click', async () => {
      try {
        const res = await api('/api/v1/data/export');
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.data, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', dataStr);
        downloadAnchor.setAttribute('download', `laya-backup-${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
      } catch (err) {
        alert(`Export failed: ${err.message}`);
      }
    });

    // 6. Restore JSON Backup
    document.getElementById('import-json-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          await api('/api/v1/data/import', {
            method: 'POST',
            body: JSON.stringify(parsed),
          });

          alert('Backup restored successfully!');
          el.modalData.hidden = true;
          await refreshAllData();
        } catch (err) {
          alert(`Invalid backup JSON file: ${err.message}`);
        }
      };
      reader.readAsText(file);
    });
  }

  function setupModalClosers() {
    const pairs = [
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
    ];

    pairs.forEach(([btnId, modal]) => {
      const btn = document.getElementById(btnId);
      if (btn) btn.addEventListener('click', () => { modal.hidden = true; });
    });
  }

  function setupNetworkMonitor() {
    function updateOnlineStatus() {
      const isOnline = navigator.onLine;
      el.networkBadge.classList.toggle('online', isOnline);
      el.networkBadge.classList.toggle('offline', !isOnline);
      el.networkBadge.querySelector('.status-text').textContent = isOnline ? 'Online' : 'Offline (Syncing)';
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
