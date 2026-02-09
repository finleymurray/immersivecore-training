const routes = [];
let appEl = null;
let authGuardFn = null;

export function addRoute(pattern, handler, options) {
  const paramNames = [];
  const regexStr = pattern.replace(/:([^/]+)/g, (_, name) => {
    paramNames.push(name);
    return '([^/]+)';
  });
  routes.push({
    regex: new RegExp('^' + regexStr + '$'),
    paramNames,
    handler,
    options: options || {},
  });
}

export function setAuthGuard(fn) {
  authGuardFn = fn;
}

export function navigate(path) {
  window.location.hash = '#' + path;
}

export function initRouter(mountEl) {
  appEl = mountEl;
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

async function handleRoute() {
  const hash = window.location.hash.slice(1) || '/';

  for (const route of routes) {
    const match = hash.match(route.regex);
    if (match) {
      const params = {};
      route.paramNames.forEach((name, i) => {
        params[name] = match[i + 1];
      });

      if (authGuardFn && !route.options.public) {
        const allowed = await authGuardFn(route.options);
        if (!allowed) return;
      }

      try {
        appEl.innerHTML = '<div class="loading">Loading...</div>';
        await route.handler(appEl, params);
      } catch (err) {
        console.error('Route error:', err);
        appEl.innerHTML = `
          <div class="error-banner">
            <h2>Error</h2>
            <p>${escapeHtml(err.message)}</p>
            <a href="#/" class="btn-link">Back to dashboard</a>
          </div>`;
      }
      updateActiveNav(hash);
      return;
    }
  }

  appEl.innerHTML = `
    <div class="error-banner">
      <h2>Page not found</h2>
      <p>The page you requested does not exist.</p>
      <a href="#/" class="btn-link">Back to dashboard</a>
    </div>`;
}

function updateActiveNav(hash) {
  document.querySelectorAll('.nav a').forEach(a => {
    const href = a.getAttribute('href');
    a.classList.toggle('active', href === '#' + hash || (href === '#/' && hash === '/'));
  });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
