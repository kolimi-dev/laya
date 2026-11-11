/**
 * Laya (లయ) — Kolimi ID Auth Gate (Email OTP)
 * Universal Passwordless Authentication (auth@kolimi.dev)
 */

import { api } from '../core/api.js';
import { saveAuthSession, loadUserProfile } from '../core/state.js';
import { updateUserBadge } from './profile-modal.js';

export function setupAuthModal(state, onLoginSuccess) {
  const modalAuth = document.getElementById('modal-auth-backdrop');
  const btnClose = document.getElementById('btn-close-auth-modal');
  const inputEmail = document.getElementById('auth-email-input');
  const btnSendCode = document.getElementById('btn-send-auth-code');
  const stepEmail = document.getElementById('auth-step-email');
  const stepOtp = document.getElementById('auth-step-otp');
  const inputCode = document.getElementById('auth-code-input');
  const btnVerify = document.getElementById('btn-verify-auth-code');
  const btnChangeEmail = document.getElementById('btn-change-auth-email');
  const btnGuest = document.getElementById('btn-auth-guest-mode');
  const feedbackBox = document.getElementById('auth-feedback-box');
  const hintTarget = document.getElementById('auth-otp-target-hint');

  if (!modalAuth) return;

  function showFeedback(msg, isError = false) {
    if (!feedbackBox) return;
    feedbackBox.hidden = false;
    feedbackBox.className = `auth-feedback-box ${isError ? 'error' : 'success'}`;
    feedbackBox.textContent = msg;
  }

  function clearFeedback() {
    if (feedbackBox) feedbackBox.hidden = true;
  }

  // Auto-prompt if unauthenticated and not in guest mode
  if (!state.isAuthenticated && !state.isGuest) {
    modalAuth.hidden = false;
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      modalAuth.hidden = true;
    });
  }

  let pendingEmail = '';

  if (btnSendCode) {
    btnSendCode.addEventListener('click', async () => {
      clearFeedback();
      const email = (inputEmail?.value || '').trim();
      if (!email || !email.includes('@')) {
        showFeedback('Please enter a valid email address.', true);
        return;
      }

      btnSendCode.disabled = true;
      btnSendCode.textContent = 'Sending code...';

      try {
        await api('/api/v1/auth/email/send-otp', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });

        pendingEmail = email;
        if (hintTarget) hintTarget.textContent = `Enter the 6-digit code sent to ${email}`;
        if (stepEmail) stepEmail.hidden = true;
        if (stepOtp) stepOtp.hidden = false;
        if (inputCode) {
          inputCode.value = '';
          inputCode.focus();
        }
        showFeedback(`Verification code dispatched to ${email}`);
      } catch (err) {
        showFeedback(err.message || 'Failed to send verification code.', true);
      } finally {
        btnSendCode.disabled = false;
        btnSendCode.textContent = 'Send Verification Code';
      }
    });
  }

  if (btnChangeEmail) {
    btnChangeEmail.addEventListener('click', () => {
      clearFeedback();
      if (stepOtp) stepOtp.hidden = true;
      if (stepEmail) stepEmail.hidden = false;
      if (inputEmail) inputEmail.focus();
    });
  }

  if (btnVerify) {
    btnVerify.addEventListener('click', async () => {
      clearFeedback();
      const otpCode = (inputCode?.value || '').trim();
      if (otpCode.length !== 6) {
        showFeedback('Please enter the complete 6-digit code.', true);
        return;
      }

      btnVerify.disabled = true;
      btnVerify.textContent = 'Verifying...';

      try {
        const res = await api('/api/v1/auth/email/verify-otp', {
          method: 'POST',
          body: JSON.stringify({ email: pendingEmail, otpCode }),
        });

        saveAuthSession(res);
        localStorage.removeItem('laya_guest_mode');

        state.userId = res.user.id;
        state.token = res.session.accessToken;
        state.email = res.user.email;
        state.isAuthenticated = true;
        state.isGuest = false;

        const profile = loadUserProfile();
        state.name = profile.name || state.email.split('@')[0];
        state.phone = profile.phone || '';

        updateUserBadge(state);
        modalAuth.hidden = true;

        if (typeof onLoginSuccess === 'function') onLoginSuccess();
      } catch (err) {
        showFeedback(err.message || 'Incorrect verification code.', true);
      } finally {
        btnVerify.disabled = false;
        btnVerify.textContent = 'Verify & Sign In';
      }
    });
  }

  if (btnGuest) {
    btnGuest.addEventListener('click', () => {
      localStorage.setItem('laya_guest_mode', 'true');
      state.isGuest = true;
      state.isAuthenticated = false;
      state.userId = 'usr_guest';
      state.token = 'token_for_guest';
      state.email = null;
      state.name = 'Guest';

      updateUserBadge(state);
      modalAuth.hidden = true;

      if (typeof onLoginSuccess === 'function') onLoginSuccess();
    });
  }
}

