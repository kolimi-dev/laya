/**
 * Laya (లయ) — Header, Navigation Shell & View Switcher
 */

export function updateViewTabBadges(state, el) {
  const items = state.checklist?.items || [];
  let remaining = 0;
  items.forEach((i) => {
    if (!i.evaluation.isIgnored && i.evaluation.status !== 'done') remaining++;
  });

  if (el.badgeRemainingCount) el.badgeRemainingCount.textContent = remaining;
  if (el.badgeChartsCount) el.badgeChartsCount.textContent = state.pinnedCharts.length;
}

export function switchView(viewName, state, el, onTasksView, onChartsView) {
  state.activeView = viewName;
  if (el.btnViewTasks) el.btnViewTasks.classList.toggle('active', viewName === 'tasks');
  if (el.btnViewCharts) el.btnViewCharts.classList.toggle('active', viewName === 'charts');
  if (el.sectionTasksView) el.sectionTasksView.hidden = viewName !== 'tasks';
  if (el.sectionChartsView) el.sectionChartsView.hidden = viewName !== 'charts';

  if (viewName === 'charts') {
    if (typeof onChartsView === 'function') onChartsView();
  } else {
    if (typeof onTasksView === 'function') onTasksView();
  }
  updateViewTabBadges(state, el);
}

export function updateOperationalDate(dateTextEl, operationalDate) {
  if (!dateTextEl || !operationalDate) return;
  const d = new Date(operationalDate);
  dateTextEl.textContent = `Today's Rhythm • ${d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;
}
