/**
 * Laya (లయ) — Privacy Consent & Live Telemetry Stream Modals
 */

import { api } from '../core/api.js';

export function setupConsentModal() {
  const backdrop = document.getElementById('modal-consent-backdrop');
  const btnAgree = document.getElementById('btn-agree-consent');
  const hasAgreed = localStorage.getItem('laya_consent_agreed');

  if (!hasAgreed && backdrop) {
    backdrop.hidden = false;
  }

  if (btnAgree && backdrop) {
    btnAgree.addEventListener('click', () => {
      localStorage.setItem('laya_consent_agreed', 'true');
      backdrop.hidden = true;
    });
  }
}

export function setupLiveTelemetryModal(state) {
  const btnOpen = document.getElementById('btn-open-live-telemetry');
  const modal = document.getElementById('modal-telemetry-backdrop');
  const btnClose = document.getElementById('btn-close-telemetry-stream');
  const btnDismiss = document.getElementById('btn-dismiss-telemetry');
  const btnRefresh = document.getElementById('btn-refresh-telemetry');
  const autoCheck = document.getElementById('check-auto-refresh-telemetry');
  const feed = document.getElementById('telemetry-stream-feed');
  const countBadge = document.getElementById('telemetry-count-badge');

  if (!modal) return;

  let pollTimer = null;

  async function fetchStream() {
    if (!feed || modal.hidden) return;
    try {
      const res = await api('/api/v1/telemetry?limit=100', {}, state.token);
      const logs = res.logs || [];
      if (countBadge) countBadge.textContent = `${logs.length} events logged`;

      if (logs.length === 0) {
        feed.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">No events recorded yet. Perform actions or sync from mobile!</div>';
        return;
      }

      feed.innerHTML = logs.map((log) => {
        const time = new Date(log.timestamp || log.receivedAt).toLocaleTimeString();
        const typeColor = log.type === 'error' ? '#F87171' : log.type === 'session' ? '#38BDF8' : '#4ADE80';
        const user = log.userId || 'usr_guest';
        const platform = log.device?.platform || 'client';
        return `
          <div style="padding: 6px 8px; background: rgba(255,255,255,0.03); border-radius: 4px; border: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 2px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: ${typeColor}; font-weight: 600;">[${log.type?.toUpperCase() || 'INFO'}] ${log.name}</span>
              <span style="color: var(--text-muted); font-size: 0.7rem;">${time} • ${platform}</span>
            </div>
            <div style="color: var(--text-muted); font-size: 0.7rem;">
              User: <span style="color: var(--text-main);">${user}</span> | Data: <span style="color: var(--text-subtle);">${JSON.stringify(log.data || {})}</span>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      if (feed) feed.innerHTML = `<div style="color: #F87171; padding: 10px;">Failed to fetch stream: ${err.message}</div>`;
    }
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(() => {
      if (!modal.hidden && autoCheck?.checked) {
        fetchStream();
      }
    }, 10000);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      modal.hidden = false;
      fetchStream();
      startPolling();
    });
  }

  [btnClose, btnDismiss].forEach((btn) => {
    if (btn) {
      btn.addEventListener('click', () => {
        modal.hidden = true;
        stopPolling();
      });
    }
  });

  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => fetchStream());
  }
}

