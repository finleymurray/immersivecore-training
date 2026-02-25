import { signIn, isStaffOrManager, checkMFA, verifyMFA } from '../services/auth-service.js';
import { navigate } from '../router.js';

export async function render(el) {
  el.innerHTML = `
    <div class="login-container">
      <div class="login-card">
        <img src="2.png" alt="ImmersiveCore" class="login-logo">
        <h2>Training &amp; Compliance Portal</h2>
        <p class="login-subtitle">Sign in with your account</p>

        <div id="login-error" class="login-error" style="display:none;"></div>

        <form id="login-form" novalidate>
          <div class="form-group">
            <label for="login-email">Email address</label>
            <input type="email" id="login-email" name="email" autocomplete="email" required>
          </div>

          <div class="form-group">
            <label for="login-password">Password</label>
            <input type="password" id="login-password" name="password" autocomplete="current-password" required>
          </div>

          <button type="submit" class="btn btn-primary login-btn" id="login-btn">Sign in</button>
        </form>
        <p style="margin-top:16px;font-size:12px;color:#666;text-align:center;">
          <a href="https://immersivecore.network/privacy-policy.html" target="_blank" style="color:#888;text-decoration:none;">Privacy Policy</a>
        </p>
      </div>
    </div>
  `;

  const form = el.querySelector('#login-form');
  const errorEl = el.querySelector('#login-error');
  const btn = el.querySelector('#login-btn');

  function showMFAChallenge(factorId) {
    const card = el.querySelector('.login-card');
    card.innerHTML = `
      <img src="2.png" alt="ImmersiveCore" class="login-logo">
      <h2>Verification Required</h2>
      <p class="login-subtitle">Enter the 6-digit code from your authenticator app</p>
      <div id="mfa-error" class="login-error" style="display:none;"></div>
      <form id="mfa-form" novalidate>
        <div class="form-group">
          <label for="mfa-code">Verification code</label>
          <input type="text" id="mfa-code" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code" required style="text-align:center;font-size:20px;letter-spacing:6px;">
        </div>
        <button type="submit" class="btn btn-primary login-btn" id="mfa-btn">Verify</button>
      </form>
    `;
    el.querySelector('#mfa-code').focus();
    el.querySelector('#mfa-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const code = el.querySelector('#mfa-code').value.trim();
      const mfaError = el.querySelector('#mfa-error');
      const mfaBtn = el.querySelector('#mfa-btn');
      mfaError.style.display = 'none';
      mfaBtn.disabled = true;
      mfaBtn.textContent = 'Verifying\u2026';
      try {
        await verifyMFA(factorId, code);
        navigate('/');
      } catch (err) {
        mfaError.textContent = 'Invalid code. Try again.';
        mfaError.style.display = 'block';
        mfaBtn.disabled = false;
        mfaBtn.textContent = 'Verify';
        el.querySelector('#mfa-code').value = '';
        el.querySelector('#mfa-code').focus();
      }
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';

    const email = el.querySelector('#login-email').value.trim();
    const password = el.querySelector('#login-password').value;

    if (!email || !password) {
      errorEl.textContent = 'Please enter your email and password.';
      errorEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Signing in\u2026';

    try {
      await signIn(email, password);
      const allowed = await isStaffOrManager();
      if (!allowed) {
        errorEl.textContent = 'Access denied. You do not have permission to use this portal.';
        errorEl.style.display = 'block';
        const { signOut } = await import('../services/auth-service.js');
        await signOut();
        btn.disabled = false;
        btn.textContent = 'Sign in';
        return;
      }
      const mfa = await checkMFA();
      if (mfa.required) {
        showMFAChallenge(mfa.factorId);
        return;
      }
      navigate('/');
    } catch (err) {
      errorEl.textContent = 'Invalid email or password.';
      errorEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Sign in';
      try {
        const { getSupabase } = await import('../supabase-client.js');
        await getSupabase().rpc('log_failed_login', { attempted_email: email, error_msg: err.message || 'unknown' });
      } catch (_) { /* best-effort logging */ }
    }
  });
}
