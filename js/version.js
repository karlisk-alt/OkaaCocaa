// Bump this string whenever you deploy a new version to GitHub Pages.
const APP_VERSION = '2.0.0';

(function ensureFreshDeployment() {
  const VERSION_KEY = 'blockrunner_app_version';
  const DATA_COOKIE = 'blockrunner_data';
  const LEGACY_COOKIE = 'blockrunner_highscore';
  const RELOAD_KEY = 'blockrunner_version_reload';

  function clearGameCookies() {
    const names = [DATA_COOKIE, LEGACY_COOKIE];
    const paths = new Set(['/']);
    const base = location.pathname.replace(/\/[^/]*$/, '') || '';
    if (base) paths.add(base.endsWith('/') ? base : `${base}/`);
    if (location.pathname.includes('/')) paths.add('/');

    names.forEach((name) => {
      paths.forEach((path) => {
        document.cookie = `${name}=; max-age=0; path=${path}; SameSite=Lax`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}; SameSite=Lax`;
      });
      document.cookie = `${name}=; max-age=0; path=/; domain=${location.hostname}; SameSite=Lax`;
    });
  }

  function urlHasCurrentVersion() {
    return new URLSearchParams(location.search).get('v') === APP_VERSION;
  }

  function reloadWithVersion() {
    const url = new URL(location.href);
    url.searchParams.set('v', APP_VERSION);
    url.searchParams.delete('_');
    location.replace(url.toString());
  }

  const storedVersion = localStorage.getItem(VERSION_KEY);
  const versionChanged = storedVersion !== APP_VERSION;

  if (versionChanged) {
    clearGameCookies();

    try {
      localStorage.setItem(VERSION_KEY, APP_VERSION);
    } catch (_) {}

    if (!sessionStorage.getItem(RELOAD_KEY) && !urlHasCurrentVersion()) {
      sessionStorage.setItem(RELOAD_KEY, '1');
      reloadWithVersion();
      return;
    }
    sessionStorage.removeItem(RELOAD_KEY);
  } else if (!urlHasCurrentVersion() && location.search.includes('v=')) {
    reloadWithVersion();
    return;
  }

  window.APP_VERSION = APP_VERSION;
})();