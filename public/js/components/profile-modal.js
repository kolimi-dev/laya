/**
 * Laya (లయ) — User Profile & OAuth Providers Drawer
 * Manages Display Name, Phone, Kolimi ID, and Linked Identities
 */

import { saveAuthSession, saveUserProfile } from '../core/state.js';

export function updateUserBadge(state) {
  const displayEl = document.getElementById('active-user-display');
  const avatarEl = document.getElementById('navbar-user-avatar');
  if (!displayEl) return;

  if (state.isAuthenticated && state.email) {
    displayEl.textContent = state.name || state.email.split('@')[0];
    displayEl.title = `Signed in as ${state.email} (${state.userId})`;
    if (avatarEl) avatarEl.textContent = (state.name || state.email)[0].toUpperCase();
  } else if (state.isGuest) {
    displayEl.textContent = 'Guest (Offline)';
    displayEl.title = 'Running in offline guest mode';
    if (avatarEl) avatarEl.textContent = '👤';
  } else {
    displayEl.textContent = 'Sign In';
    displayEl.title = 'Sign in with Kolimi ID';
    if (avatarEl) avatarEl.textContent = '👤';
  }
}

export function setupProfileModal(state, onSignOut) {
  const modalProfile = document.getElementById('modal-profile-backdrop');
  const btnClose = document.getElementById('btn-close-profile-modal');
  const userBadge = document.getElementById('user-badge');
  const headlineName = document.getElementById('profile-headline-name');
  const chipId = document.getElementById('profile-user-id-chip');
  const btnCopyId = document.getElementById('btn-copy-user-id');
  const inputName = document.getElementById('profile-name-input');
  const inputEmail = document.getElementById('profile-email-input');
  const inputPhone = document.getElementById('profile-phone-input');
  const providerEmail = document.getElementById('profile-provider-email');
  const btnSave = document.getElementById('btn-save-profile');
  const btnSignOut = document.getElementById('btn-profile-signout');
  const feedbackBox = document.getElementById('profile-feedback-box');
  const modalAuth = document.getElementById('modal-auth-backdrop');

  if (!modalProfile) return;

  function populateProfile() {
    if (headlineName) headlineName.textContent = state.name || state.email || 'Guest User';
    if (chipId) chipId.textContent = state.userId || 'usr_guest';
    if (inputName) inputName.value = state.name || '';
    if (inputEmail) inputEmail.value = state.email || 'guest@local.offline';
    if (inputPhone) inputPhone.value = state.phone || '';
    if (providerEmail) providerEmail.textContent = state.email || 'Guest Mode (No Kolimi ID)';
    if (feedbackBox) feedbackBox.hidden = true;
  }

  if (userBadge) {
    userBadge.addEventListener('click', () => {
      if (!state.isAuthenticated && !state.isGuest) {
        if (modalAuth) modalAuth.hidden = false;
      } else {
        populateProfile();
        modalProfile.hidden = false;
      }
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      modalProfile.hidden = true;
    });
  }

  if (btnCopyId) {
    btnCopyId.addEventListener('click', () => {
      if (state.userId) {
        navigator.clipboard.writeText(state.userId);
        btnCopyId.textContent = 'Copied!';
        setTimeout(() => {
          btnCopyId.textContent = 'Copy';
        }, 2000);
      }
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', () => {
      const name = (inputName?.value || '').trim();
      const phone = (inputPhone?.value || '').trim();

      state.name = name;
      state.phone = phone;
      saveUserProfile({ name, phone });

      updateUserBadge(state);
      if (headlineName) headlineName.textContent = state.name || state.email || 'Guest User';

      if (feedbackBox) {
        feedbackBox.hidden = false;
        feedbackBox.className = 'profile-feedback-box success';
        feedbackBox.textContent = 'Profile details saved.';
        setTimeout(() => {
          if (feedbackBox) feedbackBox.hidden = true;
        }, 2500);
      }
    });
  }

  if (btnSignOut) {
    btnSignOut.addEventListener('click', () => {
      saveAuthSession(null);
      localStorage.removeItem('laya_guest_mode');

      state.isAuthenticated = false;
      state.isGuest = false;
      state.userId = null;
      state.token = null;
      state.email = null;
      state.name = 'Guest';
      state.phone = '';

      updateUserBadge(state);
      modalProfile.hidden = true;

      if (modalAuth) modalAuth.hidden = false;
      if (typeof onSignOut === 'function') onSignOut();
    });
  }
}
