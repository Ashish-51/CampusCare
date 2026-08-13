/* ==========================================================================
   CampusCare - Loading Spinner Utility
   ========================================================================== */

export function showLoader(message = 'Loading...') {
  let overlay = document.querySelector('.spinner-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'spinner-overlay';
    overlay.innerHTML = `
      <div style="text-align:center;">
        <div class="spinner"></div>
        <p style="margin-top:1rem; font-weight:600; color:var(--text-main);">${message}</p>
      </div>
    `;
    document.body.appendChild(overlay);
  }
}

export function hideLoader() {
  const overlay = document.querySelector('.spinner-overlay');
  if (overlay) {
    overlay.remove();
  }
}
