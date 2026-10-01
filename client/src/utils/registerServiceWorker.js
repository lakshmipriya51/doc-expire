/**
 * Registers the service worker that makes DocExpire installable and usable
 * offline.
 *
 * Registration is deliberately skipped when:
 *   - the page is served in development, so HMR is never served stale assets
 *   - the app is running inside a native Capacitor shell, which already loads
 *     bundled assets locally and has no service worker of its own
 *   - the browser has no service worker support
 */
export function registerServiceWorker() {
  if (import.meta.env.DEV) return;
  if (!('serviceWorker' in navigator)) return;

  // Capacitor injects this global into its webview.
  if (window.Capacitor?.isNativePlatform?.()) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
      // Never let a caching failure break the app.
      console.warn('[pwa] Service worker registration failed:', error.message);
    });
  });
}