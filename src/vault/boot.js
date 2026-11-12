/**
 * Browser-only entry for The Vault. Loads the shared account/ads scripts in the
 * original order, then boots the WebOS kernel (or classic mode).
 */
import './shared/VisitTracker.js';
import './shared/AuthCore.js';
import './shared/VaultAds.js';
import './shared/AuthUI.js';
import './shared/PlaytimeConsolidation.js';
import './shared/Stars.js';

let started = false;

function injectBuyMeACoffee() {
  const host = document.getElementById('bmc-home-button');
  if (!host || host.querySelector('script')) return;
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = 'https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js';
  const attrs = {
    'data-name': 'bmc-button', 'data-slug': 'TheVault_', 'data-color': '#FFDD00', 'data-emoji': '☕',
    'data-font': 'Cookie', 'data-text': 'Buy me a coffee', 'data-outline-color': '#000000',
    'data-font-color': '#000000', 'data-coffee-color': '#ffffff'
  };
  Object.entries(attrs).forEach(([k, v]) => script.setAttribute(k, v));
  host.appendChild(script);
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
    const { boot } = await import('./os/core/Kernel.js');
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    const savedMode = localStorage.getItem('vault_view_mode');
    const isClassic = modeParam === 'classic' || (savedMode === 'classic' && modeParam !== 'webos');

    if (!isClassic) {
      document.body.classList.add('vault-os-active');
      await boot();
    } else {
      document.body.classList.add('vault-classic-active');
      document.getElementById('retro-boot-screen')?.remove();
      injectBuyMeACoffee();
    }

    const webosBtn = document.getElementById('webos-toggle-btn');
    if (webosBtn) {
      webosBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        localStorage.setItem('vault_view_mode', 'webos');
        window.location.href = '/?mode=webos';
      });
    }
  } catch (error) {
    showStartupError(error);
  }
}
