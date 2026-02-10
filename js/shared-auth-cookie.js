// shared-auth-cookie.js
// Cross-subdomain cookie containing only the refresh_token.
// Scoped to .immersivecore.network so all apps share the same session.

const COOKIE_NAME = 'ic_rt';
const COOKIE_DOMAIN = '.immersivecore.network';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function setSharedRefreshToken(refreshToken) {
  if (!refreshToken) return;
  document.cookie = [
    `${COOKIE_NAME}=${encodeURIComponent(refreshToken)}`,
    `domain=${COOKIE_DOMAIN}`,
    `path=/`,
    `max-age=${COOKIE_MAX_AGE}`,
    `secure`,
    `samesite=lax`,
  ].join('; ');
}

export function getSharedRefreshToken() {
  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  return decodeURIComponent(match.split('=')[1]);
}

export function clearSharedRefreshToken() {
  document.cookie = [
    `${COOKIE_NAME}=`,
    `domain=${COOKIE_DOMAIN}`,
    `path=/`,
    `max-age=0`,
    `secure`,
    `samesite=lax`,
  ].join('; ');
}
