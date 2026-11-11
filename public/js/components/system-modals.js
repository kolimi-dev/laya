/**
 * Laya (లయ) — System Modals, Portability, OTP Purge Challenge & Sample Data Seeder
 */

import { api } from '../core/api.js';
import { saveFeatures } from '../core/state.js';
import { exportTelemetryFile, parseTelemetryLogFile } from '../core/logger.js';

export function setupModalClosers(modalPairs) {
  modalPairs.forEach(([btnId, modal]) => {
    const btn = document.getElementById(btnId);
    if (btn && modal) {
      btn.addEventListener('click', () => {
        modal.hidden = true;
      });
    }
  });
}

export function setupCreateGroupModal(el, state, refreshAllDataFn) {
  const btnOpen = document.getElementById('btn-create-group-modal');
  if (btnOpen && el.modalGroup) {
    btnOpen.addEventListener('click', () => {
      el.modalGroup.hidden = false;
    });
  }

  const form = document.getElementById('form-create-group');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (document.getElementById('group-name-input')?.value || '').trim();
    const color = document.getElementById('group-color-input')?.value || '#8B5CF6';
    const sortOrder = parseInt(document.getElementById('group-sort-input')?.value, 10) || 1;

    try {
      await api('/api/v1/groups', {
        method: 'POST',
        body: JSON.stringify({ name, color, sortOrder }),
      }, state.token);

      if (el.modalGroup) el.modalGroup.hidden = true;
      form.reset();
      if (typeof refreshAllDataFn === 'function') await refreshAllDataFn();
    } catch (err) {
      alert(`Failed to create group: ${err.message}`);
    }
  });
}

export function setupCapabilitiesModal(el, state, onFeaturesSaved) {
  const btnOpen = document.getElementById('btn-capabilities');
  if (btnOpen && el.modalCapabilities) {
    btnOpen.addEventListener('click', () => {
      if (el.toggleFeatMilestones) el.toggleFeatMilestones.checked = !!state.features.milestones;
      if (el.toggleFeatQuantified) el.toggleFeatQuantified.checked = !!state.features.quantified;
      if (el.toggleFeatRadialDial) el.toggleFeatRadialDial.checked = !!state.features.radialDial;
      if (el.toggleFeatMicronotes) el.toggleFeatMicronotes.checked = !!state.features.micronotes;
      if (el.toggleFeatSchedules) el.toggleFeatSchedules.checked = !!state.features.schedules;
      el.modalCapabilities.hidden = false;
    });
  }

  const btnSave = document.getElementById('btn-save-capabilities');
  if (btnSave) {
    btnSave.addEventListener('click', () => {
      state.features = {
        milestones: !!el.toggleFeatMilestones?.checked,
        quantified: !!el.toggleFeatQuantified?.checked,
        radialDial: !!el.toggleFeatRadialDial?.checked,
        micronotes: !!el.toggleFeatMicronotes?.checked,
        schedules: !!el.toggleFeatSchedules?.checked,
      };

      saveFeatures(state.features);
      if (typeof onFeaturesSaved === 'function') onFeaturesSaved();
      if (el.modalCapabilities) el.modalCapabilities.hidden = true;
    });
  }
}

export function setupOtpPurgeModal(el, state) {
  const btnTrigger = document.getElementById('btn-trigger-otp-purge');
  if (btnTrigger && el.modalOtp) {
    btnTrigger.addEventListener('click', () => {
      state.currentOtp = String(Math.floor(100000 + Math.random() * 900000));
      if (el.otpExpectedCode) el.otpExpectedCode.textContent = state.currentOtp;
      if (el.otpInputField) el.otpInputField.value = '';
      if (el.btnConfirmPurge) el.btnConfirmPurge.disabled = true;
      if (el.otpErrorMsg) el.otpErrorMsg.hidden = true;
      el.modalOtp.hidden = false;
    });
  }

  if (el.otpInputField) {
    el.otpInputField.addEventListener('input', (e) => {
      const entered = e.target.value.trim();
      const isMatch = entered === state.currentOtp;
      if (el.btnConfirmPurge) el.btnConfirmPurge.disabled = !isMatch;
      if (el.otpErrorMsg) el.otpErrorMsg.hidden = !entered || entered.length < 6 || isMatch;
    });
  }

  if (el.btnConfirmPurge) {
    el.btnConfirmPurge.addEventListener('click', () => {
      if (el.otpInputField?.value.trim() === state.currentOtp) {
        localStorage.clear();
        alert('Local tracker cache cleared.');
        location.reload();
      }
    });
  }
}

export function setupDataPortability(el, state, refreshAllDataFn) {
  const btnOpen = document.getElementById('btn-data-portability');
  if (btnOpen && el.modalData) {
    btnOpen.addEventListener('click', () => {
      el.modalData.hidden = false;
    });
  }

  const btnExport = document.getElementById('btn-export-json');
  if (btnExport) {
    btnExport.addEventListener('click', async () => {
      try {
        const res = await api('/api/v1/data/export', {}, state.token);
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
  }

  const importInput = document.getElementById('import-json-file');
  if (importInput) {
    importInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          await api('/api/v1/data/import', {
            method: 'POST',
            body: JSON.stringify(parsed),
          }, state.token);

          alert('Backup restored successfully!');
          if (el.modalData) el.modalData.hidden = true;
          if (typeof refreshAllDataFn === 'function') await refreshAllDataFn();
        } catch (err) {
          alert(`Invalid backup JSON file: ${err.message}`);
        }
      };
      reader.readAsText(file);
    });
  }

  const btnExportTelemetry = document.getElementById('btn-export-telemetry');
  if (btnExportTelemetry) {
    btnExportTelemetry.addEventListener('click', () => {
      exportTelemetryFile(state.userId);
    });
  }

  const importTelemetryInput = document.getElementById('import-telemetry-file');
  if (importTelemetryInput) {
    importTelemetryInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const summary = await parseTelemetryLogFile(file);
        const actionDetails = Object.entries(summary.actionBreakdown)
          .map(([k, v]) => `• ${k}: ${v}`)
          .join('\n');
        alert(
          `Friend's Beta Telemetry Analyzed!\n\nUser: ${summary.userId}\nTotal Events: ${summary.totalEvents}\nScreen: ${summary.device.screen || 'unknown'}\nErrors Caught: ${summary.errorCount}\n\nKey Actions:\n${actionDetails || '(None recorded)'}`
        );
      } catch (err) {
        alert(`Could not parse telemetry log: ${err.message}`);
      }
    });
  }
}

export function setupFeedbackModal(el, state) {
  const btnOpen = document.getElementById('btn-feedback');
  if (btnOpen && el.modalFeedback) {
    btnOpen.addEventListener('click', () => {
      el.modalFeedback.hidden = false;
    });
  }

  const form = document.getElementById('form-feedback');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const category = document.getElementById('feedback-category')?.value || 'general';
    const message = (document.getElementById('feedback-message')?.value || '').trim();

    try {
      await api('/api/v1/feedback', {
        method: 'POST',
        body: JSON.stringify({ category, message }),
      }, state.token);

      alert('Thank you! Your feedback was directly submitted.');
      if (el.modalFeedback) el.modalFeedback.hidden = true;
      form.reset();
    } catch (err) {
      alert(`Failed to submit feedback: ${err.message}`);
    }
  });
}

export async function seedSampleHabits(token) {
  const personalGroup = await api('/api/v1/groups', {
    method: 'POST',
    body: JSON.stringify({ name: 'Personal', color: '#8B5CF6', sortOrder: 1 }),
  }, token).catch(() => null);

  await api('/api/v1/groups', {
    method: 'POST',
    body: JSON.stringify({ name: 'Work', color: '#06B6D4', sortOrder: 2 }),
  }, token).catch(() => null);

  const waterTaskRes = await api('/api/v1/tasks', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Drink Water Throughout Day',
      groupId: personalGroup?.group?.id,
      taskType: 'percentage',
      recurrence: 'daily',
      targetValue: 3,
      unit: 'L',
    }),
  }, token).catch(() => null);

  const readTaskRes = await api('/api/v1/tasks', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Deep Focus Reading',
      groupId: personalGroup?.group?.id,
      taskType: 'percentage',
      recurrence: 'daily',
      targetValue: 50,
      unit: 'pages',
    }),
  }, token).catch(() => null);

  const pushupTaskRes = await api('/api/v1/tasks', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Morning Pushups & Mobility Stretch',
      groupId: personalGroup?.group?.id,
      taskType: 'checklist',
      recurrence: 'daily',
    }),
  }, token).catch(() => null);

  const now = new Date();
  const waterId = waterTaskRes?.task?.id;
  const readId = readTaskRes?.task?.id;
  const pushupId = pushupTaskRes?.task?.id;

  for (let i = 21; i >= 1; i--) {
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
      }, token).catch(() => null);
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
      }, token).catch(() => null);
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
      }, token).catch(() => null);
    }
  }
}

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


