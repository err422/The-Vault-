// The Vault visit tracker
// Counts every real home page load and every SPA navigation that loads the home page.
import * as cloud from '../cloud.js';

(function () {
    'use strict';

    function updateVisitDisplay(count) {
        const display = document.getElementById('visit-count');
        if (display) {
            display.textContent = 'Total visits: ' + count;
        }
    }

    function recordVisit() {
        cloud.recordVisit().then(function (count) {
            window.vaultVisitCount = count;
            updateVisitDisplay(count);
            console.log('[VisitTracker] Visit recorded. Total:', count);
        }).catch(function (error) {
            console.warn('[VisitTracker] Could not record visit:', error && error.message);
        });
    }

    // Make this available to the SPA navigation system.
    window.recordVaultVisit = recordVisit;

    // The initial home page load counts once here.
    recordVisit();
})();
