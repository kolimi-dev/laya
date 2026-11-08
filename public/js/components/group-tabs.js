/**
 * Laya (లయ) — Group Filter Tabs & Group Select Population
 */

import { escapeHtml } from '../core/api.js';

export function renderGroupTabs(container, groups, selectedGroupId) {
  if (!container) return;
  const currentActive = selectedGroupId || 'all';

  let html = `<button class="group-tab ${currentActive === 'all' ? 'active' : ''}" data-group-id="all">All Groups</button>`;

  (groups || []).forEach((g) => {
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

export function populateGroupSelects(selectEl, groups) {
  if (!selectEl) return;
  selectEl.innerHTML = '';
  if (!groups || groups.length === 0) {
    selectEl.innerHTML = '<option value="">(No groups created)</option>';
    return;
  }
  groups.forEach((g) => {
    selectEl.innerHTML += `<option value="${g.id}">${escapeHtml(g.name)}</option>`;
  });
}
