/**
 * Laya (లయ) — Core API Transport & Network Services
 * Adheres to RFC 7807 error formats and Bearer token auth
 */

/**
 * Universal JSON fetch helper with Bearer token injection and error parsing
 */
export async function api(path, options = {}, token = 'token_for_alice') {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
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

/**
 * Logs an event (completion, milestone, progress percentage, rest/ignore, notes)
 */
export async function logEvent(taskId, payload, token) {
  const eventId = `evt_${crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Date.now()}`;
  return api(`/api/v1/tasks/${taskId}/events`, {
    method: 'POST',
    body: JSON.stringify({
      id: eventId,
      occurredAt: new Date().toISOString(),
      ...payload,
    }),
  }, token);
}

/**
 * Monitors online / offline connectivity status
 */
export function setupNetworkMonitor(networkBadge) {
  if (!networkBadge) return;

  function updateOnlineStatus() {
    const isOnline = navigator.onLine;
    networkBadge.classList.toggle('online', isOnline);
    networkBadge.classList.toggle('offline', !isOnline);
    const textSpan = networkBadge.querySelector('.status-text');
    if (textSpan) {
      textSpan.textContent = isOnline ? 'Online' : 'Offline (Syncing)';
    }
  }

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();
}

/**
 * Universal HTML entity escaping for XSS prevention
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

