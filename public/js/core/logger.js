/**
 * Laya (లయ) — Closed-Beta Client Telemetry & Usage Logger
 * Captures user habits, interactions, UI flows, and errors for dogfooding research
 */

const STORAGE_KEY = 'laya_client_telemetry';
const MAX_EVENTS = 500;

function getStoredLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function saveLogs(logs) {
  try {
    const trimmed = logs.slice(-MAX_EVENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (_) {}
}

export function logTelemetry(type, name, data = {}) {
  const logEvent = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    type, // 'action' | 'navigation' | 'error' | 'session'
    name,
    data,
    device: {
      screen: `${window.innerWidth}x${window.innerHeight}`,
      pixelRatio: window.devicePixelRatio || 1,
      isStandalone: window.matchMedia('(display-mode: standalone)').matches || !!navigator.standalone,
      platform: navigator.platform || 'unknown',
    },
  };

  const logs = getStoredLogs();
  logs.push(logEvent);
  saveLogs(logs);

  return logEvent;
}

export function exportTelemetryFile(userId = 'beta_user') {
  const logs = getStoredLogs();
  const payload = {
    exportedAt: new Date().toISOString(),
    userId,
    appVersion: '0.1.0-beta',
    totalEvents: logs.length,
    deviceSummary: {
      userAgent: navigator.userAgent,
      screen: `${window.innerWidth}x${window.innerHeight}`,
      isStandalone: window.matchMedia('(display-mode: standalone)').matches || !!navigator.standalone,
    },
    logs,
  };

  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
  const anchor = document.createElement('a');
  anchor.setAttribute('href', dataStr);
  anchor.setAttribute('download', `laya-beta-logs-${userId}-${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export async function parseTelemetryLogFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const logs = parsed.logs || [];
        const actions = {};
        const errors = [];

        logs.forEach((item) => {
          actions[item.name] = (actions[item.name] || 0) + 1;
          if (item.type === 'error' || item.name.includes('error')) {
            errors.push(item);
          }
        });

        resolve({
          userId: parsed.userId || 'unknown',
          totalEvents: logs.length,
          device: parsed.deviceSummary || {},
          actionBreakdown: actions,
          errorCount: errors.length,
          raw: parsed,
        });
      } catch (err) {
        reject(new Error('Invalid telemetry JSON log file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function setupGlobalErrorLogger() {
  window.addEventListener('error', (event) => {
    logTelemetry('error', 'uncaught_exception', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    logTelemetry('error', 'unhandled_promise_rejection', {
      reason: String(event.reason?.message || event.reason),
    });
  });

  logTelemetry('session', 'session_start', {
    url: window.location.href,
    referrer: document.referrer || null,
  });
}
