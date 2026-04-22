// Content script - injects blocking overlay when time limit exceeded

(async function() {
  const domain = window.location.hostname;
  if (!domain) return;

  await checkAndBlock();
  await checkFocusBlock();

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'BLOCK_DOMAIN' && message.domain === domain) {
      showBlockOverlay();
    }
    if (message.type === 'CHECK_BLOCK') {
      checkAndBlock();
    }
    if (message.type === 'POMODORO_FOCUS_BLOCK') {
      showFocusOverlay(message.remainingSeconds);
    }
    if (message.type === 'POMODORO_FOCUS_UNBLOCK') {
      removeFocusOverlay();
    }
  });

  let focusObserver = null;

  async function checkFocusBlock() {
    try {
      // Check if this domain was already justified this session
      const result = await chrome.storage.local.get(['pomodoroState', 'pomodoroAllowed']);
      const state = result.pomodoroState;
      const allowed = result.pomodoroAllowed || [];

      if (state && state.status === 'running' && state.sessionType === 'work') {
        if (allowed.includes(domain)) return; // already justified
        const remaining = Math.max(0, state.totalSeconds - Math.floor((Date.now() - state.startedAt) / 1000));
        showFocusOverlay(remaining);
      }
    } catch (e) {
      // silently fail
    }
  }

  function showFocusOverlay(remainingSeconds) {
    if (document.getElementById('foxhole-focus-overlay')) {
      // Update remaining time
      const timeEl = document.querySelector('.foxhole-focus-remaining');
      if (timeEl) {
        const m = Math.floor(remainingSeconds / 60);
        timeEl.textContent = `${m}m remaining`;
      }
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'foxhole-focus-overlay';

    let fontUrl = '';
    try {
      fontUrl = chrome.runtime.getURL('fonts/0xProto-Regular.ttf');
    } catch (e) {
      // fallback
    }

    const m = Math.floor(remainingSeconds / 60);

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
        #foxhole-focus-overlay {
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
        #foxhole-focus-overlay * {
          box-sizing: border-box !important;
        }
        .foxhole-focus-title {
          font-size: 20px !important;
          font-weight: 400 !important;
          color: #ebdbb2 !important;
          margin: 0 0 12px 0 !important;
        }
        .foxhole-focus-remaining {
          font-size: 16px !important;
          color: #a89984 !important;
          margin: 0 0 32px 0 !important;
        }
        .foxhole-focus-justify-link {
          background: none !important;
          border: none !important;
          color: #a89984 !important;
          font-size: 12px !important;
          font-family: '0xProto', monospace !important;
          cursor: pointer !important;
          opacity: 0.5 !important;
          padding: 8px !important;
          text-transform: lowercase !important;
        }
        .foxhole-focus-justify-link:hover {
          opacity: 1 !important;
        }
        .foxhole-focus-justify-form {
          display: none;
          flex-direction: column !important;
          align-items: center !important;
          gap: 12px !important;
          margin-top: 16px !important;
          max-width: 320px !important;
          width: 100% !important;
        }
        .foxhole-focus-justify-form.show {
          display: flex !important;
        }
        .foxhole-focus-justify-form input {
          width: 100% !important;
          padding: 8px 12px !important;
          background: #504945 !important;
          border: 1px solid #504945 !important;
          border-radius: 2px !important;
          color: #d5c4a1 !important;
          font-size: 14px !important;
          font-family: '0xProto', monospace !important;
          text-align: center !important;
        }
        .foxhole-focus-justify-form input:focus {
          outline: none !important;
          border-color: #ebdbb2 !important;
        }
        .foxhole-focus-justify-form input::placeholder {
          color: #a89984 !important;
          opacity: 0.6 !important;
        }
        .foxhole-focus-justify-submit {
          background: none !important;
          border: 1px solid #ebdbb2 !important;
          border-radius: 2px !important;
          color: #ebdbb2 !important;
          font-size: 14px !important;
          font-family: '0xProto', monospace !important;
          padding: 8px 24px !important;
          cursor: pointer !important;
          text-transform: lowercase !important;
        }
        .foxhole-focus-justify-submit:hover {
          opacity: 0.9 !important;
        }
        .foxhole-focus-domain {
          font-size: 12px !important;
          color: #504945 !important;
          margin: 0 0 4px 0 !important;
        }
      </style>

      <h1 class="foxhole-focus-title">focus mode active.</h1>
      <p class="foxhole-focus-domain">${domain}</p>
      <p class="foxhole-focus-remaining">${m}m remaining</p>

      <button class="foxhole-focus-justify-link" id="foxhole-justify-link">i need this site</button>

      <div class="foxhole-focus-justify-form" id="foxhole-justify-form">
        <input type="text" id="foxhole-justify-input" placeholder="why? (e.g., docs, research)" maxlength="80" autocomplete="off">
        <button class="foxhole-focus-justify-submit" id="foxhole-justify-submit">mark as productive & continue</button>
      </div>
    `;

    if (document.body) {
      document.body.appendChild(overlay);
    } else {
      document.documentElement.appendChild(overlay);
    }

    // Bind justify flow
    const justifyLink = overlay.querySelector('#foxhole-justify-link');
    const justifyForm = overlay.querySelector('#foxhole-justify-form');
    const justifyInput = overlay.querySelector('#foxhole-justify-input');
    const justifySubmit = overlay.querySelector('#foxhole-justify-submit');

    justifyLink.addEventListener('click', () => {
      justifyForm.classList.add('show');
      justifyLink.style.display = 'none';
      justifyInput.focus();
    });

    const handleJustify = async () => {
      const reason = justifyInput.value.trim();
      if (!reason) {
        justifyInput.style.borderColor = '#d65d0e';
        return;
      }

      try {
        // Add domain to productivity category and allowed list
        const result = await chrome.storage.local.get(['websiteSettings', 'pomodoroAllowed']);
        const settings = result.websiteSettings || {};
        const allowed = result.pomodoroAllowed || [];

        // Set category to Productivity (cat-1)
        settings[domain] = {
          ...settings[domain],
          categoryId: 'cat-1',
          justification: reason
        };

        // Add to session allowed list
        if (!allowed.includes(domain)) {
          allowed.push(domain);
        }

        await chrome.storage.local.set({
          websiteSettings: settings,
          pomodoroAllowed: allowed
        });

        // Remove overlay
        removeFocusOverlay();
      } catch (e) {
        // fallback — just remove overlay
        removeFocusOverlay();
      }
    };

    justifySubmit.addEventListener('click', handleJustify);
    justifyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleJustify();
      }
      // Allow typing in the input
      e.stopPropagation();
    });

    // Prevent removal via MutationObserver — scope to the overlay's parent only
    // so we don't fire on every mutation across the whole page.
    focusObserver = new MutationObserver(() => {
      if (!document.getElementById('foxhole-focus-overlay')) {
        const parent = document.body || document.documentElement;
        parent.appendChild(overlay);
      }
    });
    focusObserver.observe(overlay.parentNode, { childList: true });

    document.documentElement.style.overflow = 'hidden';
    if (document.body) document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', blockKeyboard, true);
  }

  function removeFocusOverlay() {
    // Disconnect observer first so removal sticks
    if (focusObserver) {
      focusObserver.disconnect();
      focusObserver = null;
    }

    const overlay = document.getElementById('foxhole-focus-overlay');
    if (overlay) {
      overlay.remove();
      document.documentElement.style.overflow = '';
      if (document.body) document.body.style.overflow = '';
      document.removeEventListener('keydown', blockKeyboard, true);
    }
  }

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

    // Prevent removal — scope to the overlay's parent only
    const observer = new MutationObserver(() => {
      if (!document.getElementById('foxhole-block-overlay')) {
        const parent = document.body || document.documentElement;
        parent.appendChild(overlay);
      }
    });
    observer.observe(overlay.parentNode, { childList: true });

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
