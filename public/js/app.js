/**
 * Laya (లయ) — Frontend Application Controller
 * Pressure-Free Consistency & Natural Cadence Engine
 */

(function () {
  'use strict';

  // ==========================================================================
  // Progressive Disclosure & Feature Toggles
  // ==========================================================================
  const DEFAULT_FEATURES = {
    milestones: true,
    quantified: true,
    radialDial: true,
    micronotes: true,
    schedules: true,
  };

  function loadFeatures() {
    try {
      const saved = localStorage.getItem('laya_features');
      if (saved) {
        return { ...DEFAULT_FEATURES, ...JSON.parse(saved) };
      }
    } catch (_) {}
    return { ...DEFAULT_FEATURES };
  }

  function saveFeatures(features) {
    try {
      localStorage.setItem('laya_features', JSON.stringify(features));
    } catch (_) {}
  }

  // ==========================================================================
  // State
  // ==========================================================================
  const state = {
    userId: 'usr_alice_123',
    token: 'token_for_alice', // In test/dev, Fastify mock verifier accepts this token
    selectedGroupId: 'all',
    selectedStatus: 'all',
    groups: [],
    checklist: null,
    summary: null,
    onboardingSlide: 1,
    features: loadFeatures(),
    currentOtp: '',
  };

  // ==========================================================================
  // DOM Elements
  // ==========================================================================
  const el = {
    dateText: document.getElementById('operational-date-text'),
    feed: document.getElementById('task-feed'),
    groupTabsContainer: document.getElementById('group-tabs-container'),
    statusFilters: document.getElementById('status-filters'),
    taskGroupSelect: document.getElementById('task-group-select'),
    taskTypeSelect: document.getElementById('task-type-select'),
    milestonesGroup: document.getElementById('milestones-input-group'),
    percentageGroup: document.getElementById('percentage-input-group'),
    recurrenceSelect: document.getElementById('task-recurrence-select'),
    cycleDaysGroup: document.getElementById('cycle-days-group'),
    networkBadge: document.getElementById('network-badge'),

    // Radial Dial
    dialCardContainer: document.getElementById('dial-card-container'),
    svgDial: document.getElementById('rhythm-svg-dial'),
    dialPercentage: document.getElementById('dial-center-percentage'),
    dialLegend: document.getElementById('dial-legend'),

    // Math metrics
    metricScheduled: document.getElementById('metric-scheduled'),
    metricCompleted: document.getElementById('metric-completed'),
    metricIgnored: document.getElementById('metric-ignored'),
    metricDenominator: document.getElementById('metric-denominator'),

    // Counts
    countAll: document.getElementById('count-all'),
    countPending: document.getElementById('count-pending'),
    countDone: document.getElementById('count-done'),
    countIgnored: document.getElementById('count-ignored'),

    // Modals
    modalTask: document.getElementById('modal-task-backdrop'),
    modalGroup: document.getElementById('modal-group-backdrop'),
    modalOnboarding: document.getElementById('modal-onboarding-backdrop'),
    modalCapabilities: document.getElementById('modal-capabilities-backdrop'),
    modalSponsor: document.getElementById('modal-sponsor-backdrop'),
    modalFeedback: document.getElementById('modal-feedback-backdrop'),
    modalData: document.getElementById('modal-data-backdrop'),
    modalOtp: document.getElementById('modal-otp-backdrop'),

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
  // Initialization & Data Loading
  // ==========================================================================
  async function init() {
    setupEventListeners();
    setupNetworkMonitor();
    applyFeaturesToUi();

    try {
      await refreshAllData();
      // If user has 0 tasks, seed initial sample habits so they can test immediately
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
      fetchConsistencySummary(),
    ]);

    renderDial();
    renderMathMetrics();
    renderGroupTabs();
    renderChecklist();
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

  async function fetchConsistencySummary() {
    try {
      const data = await api('/api/v1/consistency/summary');
      state.summary = data;
    } catch (e) {
      console.warn('Failed to load summary:', e);
    }
  }

  // ==========================================================================
  // Sample Data Seed Helper (Rich first experience)
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
    // Flavor A: Milestone Task
    await api('/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Drink Water Throughout Day',
        groupId: healthGroup?.group?.id,
        taskType: 'milestone',
        recurrence: 'daily',
        unit: 'L',
        milestones: ['1 Liter', '2 Liters', '3 Liters'],
      }),
    }).catch(() => null);

    // Flavor B: Quantified Target Task (e.g. 10 min, 40 g, 1 kg, 3 L, 50 pages)
    await api('/api/v1/tasks', {
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

    // Flavor C: Binary Checklist Task
    await api('/api/v1/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Morning Pushups & Mobility Stretch',
        groupId: personalGroup?.group?.id,
        taskType: 'checklist',
        recurrence: 'daily',
      }),
    }).catch(() => null);
  }

  // ==========================================================================
  // Progressive Disclosure: Apply Features to UI (Forward-Only Guarantee)
  // ==========================================================================
  function applyFeaturesToUi() {
    // 1. Dynamic Task Creation Type Dropdown (affects NEW tasks only)
    const currentVal = el.taskTypeSelect.value;
    let typeOptionsHtml = '<option value="checklist">Standard Checklist (Yes/No)</option>';

    if (state.features.milestones) {
      typeOptionsHtml += '<option value="milestone">Discrete Milestones (1L, 2L, 3L)</option>';
    }
    if (state.features.quantified) {
      typeOptionsHtml += '<option value="percentage">Quantified Target (e.g. 10 min, 40 g, 3 L)</option>';
    }

    el.taskTypeSelect.innerHTML = typeOptionsHtml;

    // Preserve selection if valid, otherwise fallback to checklist
    const options = Array.from(el.taskTypeSelect.options).map((o) => o.value);
    if (options.includes(currentVal)) {
      el.taskTypeSelect.value = currentVal;
    } else {
      el.taskTypeSelect.value = 'checklist';
    }
    syncTaskTypeFormFields();

    // 2. Schedule Cadence Dropdown (affects NEW tasks only)
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

    // 3. Radial Rhythm Dial Card visibility
    if (el.dialCardContainer) {
      el.dialCardContainer.hidden = !state.features.radialDial;
    }
  }

  function syncTaskTypeFormFields() {
    const selectedType = el.taskTypeSelect.value;
    el.milestonesGroup.hidden = selectedType !== 'milestone';
    el.percentageGroup.hidden = selectedType !== 'percentage';
  }

  // ==========================================================================
  // Concentric Radial Rhythm Dial Rendering
  // ==========================================================================
  function renderDial() {
    if (!state.features.radialDial || !el.svgDial) return;

    const svg = el.svgDial;
    svg.innerHTML = '';

    const overallScore = state.checklist?.overallConsistency?.consistencyPercentage ?? 0;
    el.dialPercentage.textContent = `${Math.round(overallScore)}%`;

    const groups = state.checklist?.groupBreakdowns || [];
    const defaultColors = ['#10B981', '#06B6D4', '#8B5CF6', '#F59E0B'];

    // Radii for concentric rings: Outer (105), Middle (85), Inner (65), Deep (45)
    const baseRadii = [105, 85, 65, 45];
    const legendItems = [];

    const ringsToRender = groups.length > 0
      ? groups.slice(0, 4)
      : [{ groupName: 'Overall Rhythm', consistencyPercentage: overallScore, color: '#8B5CF6' }];

    ringsToRender.forEach((grp, idx) => {
      const radius = baseRadii[idx] || (45 - idx * 15);
      const circumference = 2 * Math.PI * radius;
      const color = grp.color || defaultColors[idx % defaultColors.length];
      const percent = Math.min(100, Math.max(0, grp.consistencyPercentage || 0));
      const strokeDashoffset = circumference - (percent / 100) * circumference;

      // 1. Background Track
      const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      bgCircle.setAttribute('class', 'rhythm-ring-bg');
      bgCircle.setAttribute('cx', '140');
      bgCircle.setAttribute('cy', '140');
      bgCircle.setAttribute('r', String(radius));
      bgCircle.setAttribute('stroke-width', '10');
      svg.appendChild(bgCircle);

      // 2. Animated Progress Ring
      const fgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      fgCircle.setAttribute('class', 'rhythm-ring-fg');
      fgCircle.setAttribute('cx', '140');
      fgCircle.setAttribute('cy', '140');
      fgCircle.setAttribute('r', String(radius));
      fgCircle.setAttribute('stroke', color);
      fgCircle.setAttribute('stroke-width', '10');
      fgCircle.setAttribute('stroke-dasharray', String(circumference));
      fgCircle.setAttribute('stroke-dashoffset', String(strokeDashoffset));
      svg.appendChild(fgCircle);

      legendItems.push(`
        <div class="legend-item">
          <span class="legend-color-dot" style="background: ${color}"></span>
          <span>${escapeHtml(grp.groupName || 'Unassigned')}: <strong>${Math.round(percent)}%</strong></span>
        </div>
      `);
    });

    el.dialLegend.innerHTML = legendItems.join('');
  }

  // ==========================================================================
  // Guilt-Free Mathematics Card Rendering
  // ==========================================================================
  function renderMathMetrics() {
    const summary = state.checklist?.overallConsistency;
    if (!summary) return;

    el.metricScheduled.textContent = Number(summary.totalScheduledPoints).toFixed(1);
    el.metricCompleted.textContent = Number(summary.totalCompletedPoints).toFixed(1);
    el.metricIgnored.textContent = Number(summary.totalIgnoredPoints).toFixed(1);
    el.metricDenominator.textContent = Number(summary.effectiveDenominator).toFixed(1);
  }

  // ==========================================================================
  // Group Tabs & Populators
  // ==========================================================================
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
  // Checklist Feed Rendering (Rule 3: Forward-Only Guarantee Honored)
  // ==========================================================================
  function renderChecklist() {
    const feed = el.feed;
    const items = state.checklist?.items || [];

    // Filter by group
    let filtered = items;
    if (state.selectedGroupId !== 'all') {
      filtered = filtered.filter((i) => i.task.groupId === state.selectedGroupId);
    }

    // Filter by status
    if (state.selectedStatus === 'pending') {
      filtered = filtered.filter((i) => !i.evaluation.isIgnored && i.evaluation.status === 'pending');
    } else if (state.selectedStatus === 'done') {
      filtered = filtered.filter((i) => !i.evaluation.isIgnored && i.evaluation.status === 'done');
    } else if (state.selectedStatus === 'ignored') {
      filtered = filtered.filter((i) => i.evaluation.isIgnored);
    }

    // Update Counts
    const counts = { all: items.length, pending: 0, done: 0, ignored: 0 };
    items.forEach((i) => {
      if (i.evaluation.isIgnored) counts.ignored++;
      else if (i.evaluation.status === 'done') counts.done++;
      else counts.pending++;
    });

    el.countAll.textContent = counts.all;
    el.countPending.textContent = counts.pending;
    el.countDone.textContent = counts.done;
    el.countIgnored.textContent = counts.ignored;

    if (filtered.length === 0) {
      feed.innerHTML = `
        <div class="empty-state">
          <p>✨ No tasks due in this view. Enjoy your natural cadence!</p>
        </div>
      `;
      return;
    }

    feed.innerHTML = filtered.map((item) => renderTaskCard(item)).join('');
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

            <!-- The Guilt-Free Ignore Action -->
            <button class="btn-ignore ${isIgnored ? 'ignored' : ''}" 
                    data-action="ignore" 
                    data-task-id="${task.id}"
                    title="Mark as intentional rest/pause (subtracted from denominator without score penalty)">
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
    // 1. Discrete Milestones Flavor (Forward-Only: always preserved if task was created as milestone)
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

    // 2. Quantified Target / Continuous Percentage Flavor (Forward-Only)
    if (task.taskType === 'percentage') {
      const currentPct = Math.round(evaluation.progressPercentage || 0);
      const targetVal = task.targetValue ? Number(task.targetValue) : null;
      const unit = task.unit || '';

      if (targetVal) {
        // Quantified task with concrete amount and unit (e.g. 10 min, 40 g, 1 kg, 3 L, 50 pages)
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

      // Fallback abstract percentage
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

    // 3. Standard Checklist Flavor (Binary Checkmark)
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
  // Event Actions & Handlers
  // ==========================================================================
  function setupEventListeners() {
    // 1. Group Tab Click
    el.groupTabsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.group-tab');
      if (!btn) return;
      state.selectedGroupId = btn.dataset.groupId;
      renderGroupTabs();
      renderChecklist();
    });

    // 2. Status Chip Click
    el.statusFilters.addEventListener('click', (e) => {
      const chip = e.target.closest('.status-chip');
      if (!chip) return;
      state.selectedStatus = chip.dataset.status;
      document.querySelectorAll('.status-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      renderChecklist();
    });

    // 3. Interactive Checklist Actions (Click)
    el.feed.addEventListener('click', async (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      const taskId = target.dataset.taskId;

      if (action === 'toggle-check') {
        const isChecked = target.classList.contains('checked');
        const nextStatus = isChecked ? 'pending' : 'done';
        await logEvent(taskId, {
          status: nextStatus,
        });
      } else if (action === 'toggle-milestone') {
        const milestoneId = target.dataset.milestoneId;
        await logEvent(taskId, {
          status: 'done',
          milestoneId,
        });
      } else if (action === 'set-pct') {
        const pct = parseFloat(target.dataset.pct);
        const status = pct >= 100 ? 'done' : pct > 0 ? 'in_progress' : 'pending';
        await logEvent(taskId, {
          status,
          progressPercentage: pct,
        });
      } else if (action === 'ignore') {
        await logEvent(taskId, {
          status: 'ignored',
          notes: 'Intentional rest day / pause',
        });
      }
    });

    // 4. Quantified Direct Numeric Input
    el.feed.addEventListener('change', async (e) => {
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
    });

    // 5. Micro-Note Save on Enter / Blur
    el.feed.addEventListener('change', async (e) => {
      if (!e.target.classList.contains('note-input')) return;
      const taskId = e.target.dataset.taskId;
      const note = e.target.value.trim();
      if (!note) return;

      await logEvent(taskId, {
        status: 'in_progress',
        notes: note,
      });
    });

    // 6. Task Creation Dynamic Flavor Conditional Inputs
    el.taskTypeSelect.addEventListener('change', () => {
      syncTaskTypeFormFields();
    });

    // 7. Recurrence Conditional Inputs
    el.recurrenceSelect.addEventListener('change', (e) => {
      el.cycleDaysGroup.hidden = e.target.value !== 'custom';
    });

    // 8. Modal Openers
    document.getElementById('btn-create-task-modal').addEventListener('click', () => {
      syncTaskTypeFormFields();
      el.modalTask.hidden = false;
    });

    document.getElementById('btn-create-group-modal').addEventListener('click', () => {
      el.modalGroup.hidden = false;
    });

    document.getElementById('btn-onboarding').addEventListener('click', () => {
      state.onboardingSlide = 1;
      updateOnboardingSlide();
      el.modalOnboarding.hidden = false;
    });

    // Cadence Modules / Feature Toggles Modal Opener
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

    // 9. OTP Data Purge Modal Trigger
    document.getElementById('btn-trigger-otp-purge').addEventListener('click', () => {
      // Generate 6-digit confirmation code
      state.currentOtp = String(Math.floor(100000 + Math.random() * 900000));
      el.otpExpectedCode.textContent = state.currentOtp;
      el.otpInputField.value = '';
      el.btnConfirmPurge.disabled = true;
      el.otpErrorMsg.hidden = true;
      el.modalOtp.hidden = false;
    });

    // OTP Input validation
    el.otpInputField.addEventListener('input', (e) => {
      const entered = e.target.value.trim();
      const isMatch = entered === state.currentOtp;
      el.btnConfirmPurge.disabled = !isMatch;
      el.otpErrorMsg.hidden = !entered || entered.length < 6 || isMatch;
    });

    // OTP Purge Execution
    el.btnConfirmPurge.addEventListener('click', () => {
      if (el.otpInputField.value.trim() === state.currentOtp) {
        localStorage.clear();
        alert('Local tracker cache successfully cleared.');
        location.reload();
      }
    });

    // Modal Closers
    setupModalClosers();

    // Form Submissions
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
    // 1. Create Task Form (Dynamic based on selected type)
    document.getElementById('form-create-task').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('task-title-input').value.trim();
      const groupId = document.getElementById('task-group-select').value || null;
      const taskType = document.getElementById('task-type-select').value;
      const recurrence = document.getElementById('task-recurrence-select').value;

      let targetValue = null;
      let unit = null;
      let milestones = null;

      // Handle Quantified Target fields
      if (taskType === 'percentage') {
        const rawTarget = document.getElementById('task-target-val').value;
        const rawUnit = document.getElementById('task-unit-input').value.trim();
        targetValue = rawTarget ? parseFloat(rawTarget) : 100;
        unit = rawUnit || 'units';
      }

      // Handle Milestones fields
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

    // 3. Save Capabilities & Feature Preferences
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
      renderDial();
      renderChecklist();
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
    ];

    pairs.forEach(([btnId, modal]) => {
      const btn = document.getElementById(btnId);
      if (btn) btn.addEventListener('click', () => { modal.hidden = true; });
    });

    // Carousel slides navigation
    const prevBtn = document.getElementById('btn-prev-slide');
    const nextBtn = document.getElementById('btn-next-slide');

    prevBtn.addEventListener('click', () => {
      if (state.onboardingSlide > 1) {
        state.onboardingSlide--;
        updateOnboardingSlide();
      }
    });

    nextBtn.addEventListener('click', () => {
      if (state.onboardingSlide < 3) {
        state.onboardingSlide++;
        updateOnboardingSlide();
      } else {
        el.modalOnboarding.hidden = true;
      }
    });
  }

  function updateOnboardingSlide() {
    const slides = document.querySelectorAll('.carousel-slide');
    const dots = document.querySelectorAll('.carousel-dots .dot');
    const prevBtn = document.getElementById('btn-prev-slide');
    const nextBtn = document.getElementById('btn-next-slide');

    slides.forEach((s) => {
      s.hidden = parseInt(s.dataset.slide, 10) !== state.onboardingSlide;
    });

    dots.forEach((d) => {
      d.classList.toggle('active', parseInt(d.dataset.index, 10) === state.onboardingSlide);
    });

    prevBtn.disabled = state.onboardingSlide === 1;
    nextBtn.textContent = state.onboardingSlide === 3 ? 'Get Started' : 'Next';
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

  // Launch on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
