// VaultAds.js - Central membership-aware advertising gate.
import * as cloud from '../cloud.js';

(function () {
  let ready = false;
  let adFree = false;
  let adsLoaded = false;
  let stopMembershipWatch = null;
  let hasMembershipSnapshot = false;

  function syncUI() {
    document.body.classList.toggle('vault-plus-active', ready && adFree);
    window.dispatchEvent(new CustomEvent('vaultMembershipChanged', {
      detail: { ready, adFree }
    }));
  }

  function injectScript(src, attributes = {}) {
    if (document.querySelector('script[src="' + src + '"]')) return;
    const script = document.createElement('script');
    script.src = src;
    Object.entries(attributes).forEach(([key, value]) => script.setAttribute(key, value));
    document.head.appendChild(script);
  }

  function loadAds() {
    if (adsLoaded || adFree || !ready) return;
    adsLoaded = true;

    // AdSense Auto Ads
    injectScript(
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1639294484325644',
      { async: '', crossorigin: 'anonymous' }
    );

    // Monetization / pop-under provider. Never loaded for Vault+ accounts.
    injectScript('https://bauval.org/14/8c0b873d66a359e0f25e1402357679d4', {
      'data-cfasync': 'false'
    });
  }

  function applyMembership(membership, signedIn) {
    adFree = !!signedIn &&
      membership?.plan === 'vault_plus' &&
      membership?.active === true;

    ready = true;
    hasMembershipSnapshot = true;
    window.VaultAds.ready = true;
    syncUI();

    // If membership is inactive, load ads normally. If it is active, keep
    // the ad loader stopped and hide all Vault-controlled ad placements.
    if (!adFree) loadAds();
  }

  function watchMembership(user, initialMembership) {
    if (stopMembershipWatch) {
      stopMembershipWatch();
      stopMembershipWatch = null;
    }
    hasMembershipSnapshot = false;

    if (!user) {
      applyMembership(null, false);
      return;
    }

    // The profile snapshot gives us an immediate initial value. The live
    // listener then catches admin activation/deactivation while the user is online.
    applyMembership(initialMembership, true);
    stopMembershipWatch = cloud.watchMembership(user.uid, (membership) => {
      applyMembership(membership, true);
    });
  }

  window.VaultAds = {
    ready: false,
    isAdFree: () => ready && adFree,
    canShowAds: () => ready && !adFree,
    refresh: () => {
      const auth = window.AuthCore;
      if (auth?.profileReady) applyMembership(auth.currentMembership, !!auth.currentUser);
    }
  };

  window.addEventListener('authProfileReady', (event) => {
    const detail = event.detail || {};
    watchMembership(detail.user, detail.membership);
  });

  // AuthCore may have finished before this script was evaluated.
  if (window.AuthCore?.profileReady) {
    watchMembership(window.AuthCore.currentUser, window.AuthCore.currentMembership);
  }

  const style = document.createElement('style');
  style.textContent = `
    body.vault-plus-active #bmc-home-button,
    body.vault-plus-active .vault-plus-promo {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
})();
