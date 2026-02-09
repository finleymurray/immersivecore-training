import { signIn, isManager } from '../services/auth-service.js';
import { navigate } from '../router.js';

export async function render(el) {
  el.innerHTML = `
    <div class="login-container">
      <div class="login-card">
        <img src="2.png" alt="ImmersiveCore" class="login-logo">
        <h2>Training &amp; Compliance Portal</h2>
        <p class="login-subtitle">Sign in with your manager account</p>

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
      </div>
    </div>
  `;

  const form = el.querySelector('#login-form');
  const errorEl = el.querySelector('#login-error');
  const btn = el.querySelector('#login-btn');

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
      const manager = await isManager();
      if (!manager) {
        errorEl.textContent = 'Access denied. This portal is for managers only.';
        errorEl.style.display = 'block';
        const { signOut } = await import('../services/auth-service.js');
        await signOut();
        btn.disabled = false;
        btn.textContent = 'Sign in';
        return;
      }
      navigate('/');
    } catch (err) {
      errorEl.textContent = err.message || 'Sign in failed. Please check your credentials.';
      errorEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  });
}
