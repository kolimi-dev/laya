/**
 * Laya (లయ) — Central Reactive State & Local Persistence Store
 */

export const DEFAULT_FEATURES = {
  milestones: true,
  quantified: true,
  radialDial: false, // Default off to eliminate AI dashboard clutter
  micronotes: true,
  schedules: true,
};

export function loadFeatures() {
  try {
    const saved = localStorage.getItem('laya_features');
    if (saved) return { ...DEFAULT_FEATURES, ...JSON.parse(saved) };
  } catch (_) {}
  return { ...DEFAULT_FEATURES };
}

export function saveFeatures(features) {
  try {
    localStorage.setItem('laya_features', JSON.stringify(features));
  } catch (_) {}
}

export function loadPinnedCharts() {
  try {
    const saved = localStorage.getItem('laya_pinned_charts');
    if (saved) return JSON.parse(saved);
  } catch (_) {}
  return [];
}

export function savePinnedCharts(pinned) {
  try {
    localStorage.setItem('laya_pinned_charts', JSON.stringify(pinned));
  } catch (_) {}
}

export function loadCachedChecklist() {
  try {
    const saved = localStorage.getItem('laya_cached_checklist');
    if (saved) return JSON.parse(saved);
  } catch (_) {}
  return null;
}

export function saveCachedChecklist(checklist) {
  try {
    localStorage.setItem('laya_cached_checklist', JSON.stringify(checklist));
  } catch (_) {}
}

export function loadAuthSession() {
  try {
    const saved = localStorage.getItem('laya_auth_session');
    if (saved) return JSON.parse(saved);
  } catch (_) {}
  return null;
}

export function saveAuthSession(session) {
  try {
    if (session) {
      localStorage.setItem('laya_auth_session', JSON.stringify(session));
    } else {
      localStorage.removeItem('laya_auth_session');
    }
  } catch (_) {}
}

export function loadUserProfile() {
  try {
    const saved = localStorage.getItem('laya_user_profile');
    if (saved) return JSON.parse(saved);
  } catch (_) {}
  return { name: '', phone: '' };
}

export function saveUserProfile(profile) {
  try {
    localStorage.setItem('laya_user_profile', JSON.stringify(profile));
  } catch (_) {}
}

export function createInitialState() {
  const session = loadAuthSession();
  const profile = loadUserProfile();
  const isGuest = localStorage.getItem('laya_guest_mode') === 'true';

  let userId = null;
  let token = null;
  let email = null;

  if (session && session.user && session.session) {
    userId = session.user.id;
    token = session.session.accessToken;
    email = session.user.email;
  } else if (isGuest) {
    userId = 'usr_guest';
    token = 'token_for_guest';
  }

  return {
    userId,
    token,
    email,
    name: profile.name || (email ? email.split('@')[0] : 'Guest'),
    phone: profile.phone || '',
    isAuthenticated: !!session,
    isGuest,
    activeView: 'tasks', // 'tasks' or 'charts'
    selectedGroupId: 'all',
    chartTimeRange: '30d', // 'week', 'month', '30d', '90d', '1y', 'custom'
    customRange: { from: null, to: null },
    groups: [],
    checklist: loadCachedChecklist(),
    allTasks: [],
    pinnedCharts: loadPinnedCharts(),
    features: loadFeatures(),
    currentOtp: '',
    taskEventsCache: new Map(),
  };
}

