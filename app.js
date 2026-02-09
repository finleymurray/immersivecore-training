import { addRoute, setAuthGuard, navigate, initRouter } from './js/router.js';
import { getSession, getUserProfile, isManager, onAuthStateChange, clearProfileCache } from './js/services/auth-service.js';

// ---- Auth guard — all routes require manager role ----
setAuthGuard(async (routeOptions) => {
  const session = await getSession();
  if (!session) {
    navigate('/login');
    return false;
  }
  const manager = await isManager();
  if (!manager) {
    navigate('/login');
    return false;
  }
  return true;
});

// ---- Routes ----
addRoute('/login', async (el) => {
  const session = await getSession();
  if (session) {
    const manager = await isManager();
    if (manager) { navigate('/'); return; }
  }
  const { render } = await import('./js/views/login.js');
  await render(el);
}, { public: true });

addRoute('/', async (el) => {
  const { render } = await import('./js/views/dashboard.js?v=2');
  await render(el);
});

addRoute('/modules', async (el) => {
  const { render } = await import('./js/views/modules-list.js?v=2');
  await render(el);
});

addRoute('/modules/new', async (el) => {
  const { render } = await import('./js/views/module-form.js?v=2');
  await render(el);
});

addRoute('/modules/:id', async (el, params) => {
  if (params.id === 'new') {
    const { render } = await import('./js/views/module-form.js?v=2');
    await render(el);
    return;
  }
  const { render } = await import('./js/views/module-detail.js?v=2');
  await render(el, params.id);
});

addRoute('/modules/:id/edit', async (el, params) => {
  const { render } = await import('./js/views/module-form.js?v=2');
  await render(el, params.id);
});

addRoute('/session/new', async (el) => {
  const { render } = await import('./js/views/session-form.js?v=2');
  await render(el);
});

addRoute('/session/:id', async (el, params) => {
  const { render } = await import('./js/views/session-detail.js?v=2');
  await render(el, params.id);
});

addRoute('/assessment/new', async (el) => {
  const { render } = await import('./js/views/assessment-form.js?v=2');
  await render(el);
});

addRoute('/assessment/:id', async (el, params) => {
  const { render } = await import('./js/views/assessment-detail.js?v=2');
  await render(el, params.id);
});

addRoute('/employee/:id', async (el, params) => {
  const { render } = await import('./js/views/employee-training.js?v=2');
  await render(el, params.id);
});

// ---- Nav auth state ----
async function updateNavAuth(session) {
  const userInfoEl = document.getElementById('user-info');
  if (!userInfoEl) return;

  if (session) {
    try {
      const profile = await getUserProfile();
      userInfoEl.innerHTML = `
        <span class="user-name">${escapeHtml(profile?.full_name || session.user.email)}</span>
        <button type="button" class="btn-sign-out" id="sign-out-btn">Sign out</button>
      `;
      userInfoEl.style.display = 'flex';

      const signOutBtn = document.getElementById('sign-out-btn');
      if (signOutBtn) {
        signOutBtn.addEventListener('click', async () => {
          const { signOut } = await import('./js/services/auth-service.js');
          await signOut();
          navigate('/login');
        });
      }
    } catch (err) {
      console.error('Failed to load profile for nav:', err);
    }
  } else {
    userInfoEl.innerHTML = '';
    userInfoEl.style.display = 'none';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

onAuthStateChange((event, session) => {
  clearProfileCache();
  updateNavAuth(session);
});

getSession().then(session => updateNavAuth(session));

initRouter(document.getElementById('app'));
