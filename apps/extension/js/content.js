// Content script - injects blocking overlay when time limit exceeded

(async function() {
  const domain = window.location.hostname;
  if (!domain) return;

  await checkAndBlock();

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'BLOCK_DOMAIN' && message.domain === domain) {
      showBlockOverlay();
    }
    if (message.type === 'CHECK_BLOCK') {
      checkAndBlock();
    }
  });

  async function checkAndBlock() {
    try {
      const result = await chrome.storage.local.get(['websiteSettings', 'websiteEntries']);
      const settings = result.websiteSettings || {};
      const entries = result.websiteEntries || {};

      const domainSettings = settings[domain];
      if (!domainSettings?.dailyLimitSeconds) return;

      const today = formatDate(new Date());
      const todayEntry = entries[today]?.[domain];
      const usedSeconds = todayEntry?.totalSeconds || 0;

      if (usedSeconds >= domainSettings.dailyLimitSeconds) {
        showBlockOverlay();
      }
    } catch (e) {
      // silently fail
    }
  }

  function showBlockOverlay() {
    if (document.getElementById('foxhole-block-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'foxhole-block-overlay';

    // Load 0xProto font from extension
    let fontUrl = '';
    try {
      fontUrl = chrome.runtime.getURL('fonts/0xProto-Regular.ttf');
    } catch (e) {
      // fallback to system monospace
    }

    overlay.innerHTML = `
      <style>
        ${fontUrl ? `
        @font-face {
          font-family: '0xProto';
          src: url('${fontUrl}') format('truetype');
          font-weight: 400;
          font-display: swap;
        }
        ` : ''}
        #foxhole-block-overlay {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          background: #282828 !important;
          z-index: 2147483647 !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          font-family: '0xProto', monospace !important;
          color: #ebdbb2 !important;
          text-align: center !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
        }
        #foxhole-block-overlay * {
          box-sizing: border-box !important;
        }
        .foxhole-block-title {
          font-size: 20px !important;
          font-weight: 400 !important;
          color: #ebdbb2 !important;
          margin: 0 0 12px 0 !important;
        }
        .foxhole-block-domain {
          font-size: 16px !important;
          color: #d65d0e !important;
          margin: 0 0 24px 0 !important;
        }
        .foxhole-block-limit {
          font-size: 12px !important;
          color: #a89984 !important;
          margin: 0 !important;
        }
      </style>

      <h1 class="foxhole-block-title">time's up.</h1>
      <p class="foxhole-block-domain" id="foxhole-block-domain">${domain}</p>
      <p class="foxhole-block-limit">you've reached your daily limit for this site.</p>
    `;

    if (document.body) {
      document.body.appendChild(overlay);
    } else {
      document.documentElement.appendChild(overlay);
    }

    // Prevent removal
    const observer = new MutationObserver(() => {
      if (!document.getElementById('foxhole-block-overlay')) {
        if (document.body) {
          document.body.appendChild(overlay);
        } else {
          document.documentElement.appendChild(overlay);
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // Prevent scrolling
    document.documentElement.style.overflow = 'hidden';
    if (document.body) document.body.style.overflow = 'hidden';

    // Block keyboard shortcuts
    document.addEventListener('keydown', blockKeyboard, true);
  }

  function blockKeyboard(e) {
    if (e.key === 'Escape' ||
        (e.ctrlKey && e.key === 'w') ||
        (e.ctrlKey && e.key === 'W') ||
        (e.key === 'F5') ||
        (e.ctrlKey && e.key === 'r')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
})();
