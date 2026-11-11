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


