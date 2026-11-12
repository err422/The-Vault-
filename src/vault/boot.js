/**
 * Browser-only entry for The Vault. Loads the Firebase SDK and the shared
 * account/ads scripts in the original order, then boots the WebOS kernel.
 *
 * The shared scripts are classic (non-module) scripts that rely on globals
 * such as `auth` and `database`, so they are injected as plain <script> tags.
 */
import firebaseConfig from './shared/FirebaseConfig.js?raw';
import visitTracker from './shared/VisitTracker.js?raw';
import authCore from './shared/AuthCore.js?raw';
import vaultAds from './shared/VaultAds.js?raw';
import authUI from './shared/AuthUI.js?raw';
import playtime from './shared/PlaytimeConsolidation.js?raw';
import stars from './shared/Stars.js?raw';

const FIREBASE_SDK = [
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js',
];

let started = false;

function loadExternal(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load ' + src));
    document.head.appendChild(s);
  });
}

function runInline(code, name) {
  const s = document.createElement('script');
  s.textContent = code + '\n//# sourceURL=vault/' + name;
  document.body.appendChild(s);
}

function showStartupError(error) {
  console.error('[WebOS] Startup failed:', error);
  const terminal = document.getElementById('boot-terminal-output');
  const prompt = document.getElementById('boot-prompt-bar');
  if (terminal) {
    terminal.innerHTML = '';
    const heading = document.createElement('div');
    heading.textContent = 'WEBOS STARTUP FAILED';
    heading.style.cssText = 'color:#f87171;font-weight:bold;font-size:16px;margin-bottom:12px;';
    const detail = document.createElement('pre');
    detail.textContent = error?.stack || error?.message || String(error);
    detail.style.cssText = 'color:#fecaca;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;';
    terminal.append(heading, detail);
  }
  if (prompt) {
    prompt.textContent = 'Startup error shown above — reload after the fix is deployed.';
    prompt.style.color = '#f87171';
  }
}

export async function startVault() {
  if (started) return;
  started = true;

  // Live Server on 127.0.0.1 → localhost so the proxy's frame-ancestors/postMessage origins match.
  if (window.location.hostname === '127.0.0.1') {
    window.location.replace(window.location.href.replace('//127.0.0.1:', '//localhost:'));
    return;
  }

  try {
    for (const src of FIREBASE_SDK) await loadExternal(src);
    runInline(firebaseConfig, 'FirebaseConfig.js');
    runInline(visitTracker, 'VisitTracker.js');
    runInline(authCore, 'AuthCore.js');
    runInline(vaultAds, 'VaultAds.js');
    runInline(authUI, 'AuthUI.js');
    runInline(playtime, 'PlaytimeConsolidation.js');
    runInline(stars, 'Stars.js');

    // Old bookmarks may still carry ?mode=classic; classic mode no longer exists.
    localStorage.removeItem('vault_view_mode');

    const { boot } = await import('./os/core/Kernel.js');
    document.body.classList.add('vault-os-active');
    await boot();
  } catch (error) {
    showStartupError(error);
  }
}
