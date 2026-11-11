/**
 * Laya (లయ) — Milestone Builder Helper
 * Handles dynamic row addition, removal, and value extraction for milestone habits.
 */

import { escapeHtml } from '../core/api.js';

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
