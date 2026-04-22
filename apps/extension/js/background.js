// Background service worker for website time tracking and pomodoro timer

importScripts('pomodoro.js');

const formatDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const generateId = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// ============ Pomodoro Timer ============

const PomodoroTimer = {
  state: null,
  tickAlarmName: 'pomodoroTick',

  async init() {
    await this.restoreState();
    if (this.state && this.state.status === 'running') {
      this.startTickAlarm();
    }
  },

  async restoreState() {
    try {
      const result = await chrome.storage.local.get(['pomodoroState']);
      this.state = result.pomodoroState || null;
    } catch (e) {
      this.state = null;
    }
  },

  async persistState() {
    try {
      await chrome.storage.local.set({ pomodoroState: this.state });
    } catch (e) {
      // silently fail
    }
  },

  startTickAlarm() {
    chrome.alarms.create(this.tickAlarmName, { periodInMinutes: 0.5 });
  },

  stopTickAlarm() {
    chrome.alarms.clear(this.tickAlarmName);
  },

  async start(preset) {
    if (this.state && this.state.status === 'running') return;

    this.state = Pomodoro.createInitialState(preset);
    this.state.startedAt = Date.now();
    await this.persistState();
    this.startTickAlarm();
    await this.broadcastState();
  },

  async pause() {
    if (!this.state || this.state.status !== 'running') return;

    const elapsed = Math.floor((Date.now() - this.state.startedAt) / 1000);
    this.state.remainingSeconds = Math.max(0, this.state.totalSeconds - elapsed);
    this.state.status = 'paused';
    this.state.pausedAt = Date.now();
    this.stopTickAlarm();
    await this.persistState();
    await this.broadcastState();
  },

  async resume() {
    if (!this.state || this.state.status !== 'paused') return;

    this.state.status = 'running';
    this.state.startedAt = Date.now();
    this.state.totalSeconds = this.state.remainingSeconds;
    this.state.pausedAt = null;
    await this.persistState();
    this.startTickAlarm();
    await this.broadcastState();
  },

  async skip() {
    if (!this.state || this.state.status === 'idle') return;

    const wasWork = this.state.sessionType === 'work';
    await this.logSession(false, true);

    this.state = Pomodoro.skip(this.state, this.state.preset);
    this.state.startedAt = Date.now();
    await this.persistState();
    this.startTickAlarm();
    await this.broadcastState();

    if (wasWork) {
      await this.broadcastFocusUnblock();
    }
  },

  async abandon() {
    if (!this.state || this.state.status === 'idle') return;

    const wasWork = this.state.sessionType === 'work';
    await this.logSession(false, false);

    this.state = null;
    this.stopTickAlarm();
    await chrome.storage.local.remove(['pomodoroState', 'pomodoroAllowed']);
    await this.broadcastState();

    if (wasWork) {
      await this.broadcastFocusUnblock();
    }
  },

  async handleTick() {
    if (!this.state || this.state.status !== 'running') {
      this.stopTickAlarm();
      return;
    }

    const elapsed = Math.floor((Date.now() - this.state.startedAt) / 1000);
    const remaining = Math.max(0, this.state.totalSeconds - elapsed);
    this.state.remainingSeconds = remaining;

    if (remaining <= 0) {
      await this.handleSessionComplete();
      return;
    }

    // Don't persist every tick — remaining is derived from startedAt/totalSeconds.
    // Persistence happens on state transitions (start/pause/resume/skip/complete).
    await this.broadcastState();
  },

  async handleSessionComplete() {
    const previousType = this.state.sessionType;
    const wasWork = previousType === 'work';

    await this.logSession(true, false);

    // Compute next session
    this.state = Pomodoro.complete(this.state, this.state.preset);
    this.state.startedAt = Date.now();
    await this.persistState();
    await this.broadcastState();

    // Notify user
    const nextLabel = Pomodoro.formatSessionType(this.state.sessionType);
    const nextMin = Math.floor(this.state.totalSeconds / 60);
    const title = wasWork ? 'session complete' : 'break over';
    const body = wasWork
      ? `take a ${nextLabel}. ${nextMin}m.`
      : `time to focus. ${nextMin}m.`;

    try {
      chrome.notifications.create(`pomo-${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: title,
        message: body,
        silent: false
      });
    } catch (e) {
      // notifications might not be available
    }

    // Unblock sites when work ends, block when work starts
    if (wasWork) {
      // Clear justified domains when work session ends
      await chrome.storage.local.remove('pomodoroAllowed');
      await this.broadcastFocusUnblock();
    } else {
      await this.broadcastFocusBlock();
    }
  },

  async logSession(wasCompleted, wasSkipped) {
    if (!this.state) return;

    const today = formatDate(new Date());
    const session = {
      id: generateId('pomo'),
      sessionType: this.state.sessionType,
      presetName: this.state.presetName,
      durationSeconds: this.state.totalSeconds,
      completedAt: Date.now(),
      wasCompleted: wasCompleted,
      wasSkipped: wasSkipped
    };

    try {
      const result = await chrome.storage.local.get(['pomodoroSessions']);
      const sessions = result.pomodoroSessions || {};
      if (!sessions[today]) sessions[today] = [];
      sessions[today].push(session);
      await chrome.storage.local.set({ pomodoroSessions: sessions });
    } catch (e) {
      // silently fail
    }
  },

  async broadcastState() {
    const state = this.state;
    try {
      chrome.runtime.sendMessage({
        type: 'POMODORO_STATE',
        state: state
      }).catch(() => {});
    } catch (e) {
      // no listeners
    }
  },

  async broadcastFocusBlock() {
    if (!this.state) return;
    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'POMODORO_FOCUS_BLOCK',
            remainingSeconds: this.state.remainingSeconds
          }).catch(() => {});
        }
      }
    } catch (e) {
      // ignore
    }
  },

  async broadcastFocusUnblock() {
    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'POMODORO_FOCUS_UNBLOCK'
          }).catch(() => {});
        }
      }
    } catch (e) {
      // ignore
    }
  },

  async getState() {
    if (this.state && this.state.status === 'running') {
      const elapsed = Math.floor((Date.now() - this.state.startedAt) / 1000);
      this.state.remainingSeconds = Math.max(0, this.state.totalSeconds - elapsed);
    }
    return this.state;
  }
};

// ============ Website Tracker ============

const WebsiteTracker = {
  currentDomain: null,
  currentFavicon: null,
  trackingStartTime: null,
  isUserActive: true,
  SAVE_INTERVAL: 30000,
  IDLE_THRESHOLD: 60,
  blockedDomains: new Set(),

  async init() {
    chrome.idle.setDetectionInterval(this.IDLE_THRESHOLD);
    await this.restoreBlockedState();
    this.initBlockingSystem();

    chrome.idle.onStateChanged.addListener((state) => {
      this.handleIdleStateChange(state);
    });

    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.handleTabActivated(activeInfo);
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdated(tabId, changeInfo, tab);
    });

    chrome.windows.onFocusChanged.addListener((windowId) => {
      this.handleWindowFocusChanged(windowId);
    });

    this.startAlarms();
    this.initCurrentTab();
  },

  async initCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        this.startTracking(tab.url, tab.favIconUrl);
      }
    } catch (e) {
      // ignore
    }
  },

  handleIdleStateChange(state) {
    if (state === 'active') {
      this.isUserActive = true;
      if (this.currentDomain && !this.trackingStartTime) {
        this.trackingStartTime = Date.now();
      }
    } else {
      this.isUserActive = false;
      this.saveCurrentTime();
      this.trackingStartTime = null;
    }
  },

  async handleTabActivated(activeInfo) {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      if (tab && tab.url) {
        this.switchToUrl(tab.url, tab.favIconUrl);
      }
    } catch (e) {
      // ignore
    }
  },

  handleTabUpdated(tabId, changeInfo, tab) {
    if (changeInfo.url && tab.active) {
      this.switchToUrl(changeInfo.url, tab.favIconUrl);
    }
    if (changeInfo.favIconUrl && tab.active && this.currentDomain) {
      const domain = this.extractDomain(tab.url);
      if (domain === this.currentDomain) {
        this.currentFavicon = changeInfo.favIconUrl;
      }
    }
  },

  async handleWindowFocusChanged(windowId) {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      this.saveCurrentTime();
      this.trackingStartTime = null;
    } else {
      try {
        const [tab] = await chrome.tabs.query({ active: true, windowId });
        if (tab && tab.url) {
          this.switchToUrl(tab.url, tab.favIconUrl);
        }
      } catch (e) {
        // ignore
      }
    }
  },

  switchToUrl(url, faviconUrl) {
    const domain = this.extractDomain(url);
    if (!domain) {
      this.saveCurrentTime();
      this.currentDomain = null;
      this.currentFavicon = null;
      this.trackingStartTime = null;
      return;
    }
    if (domain !== this.currentDomain) {
      this.saveCurrentTime();
      this.startTracking(url, faviconUrl);
    }
  },

  startTracking(url, faviconUrl) {
    const domain = this.extractDomain(url);
    if (!domain) return;
    this.currentDomain = domain;
    this.currentFavicon = faviconUrl || this.getFaviconUrl(domain);
    this.trackingStartTime = this.isUserActive ? Date.now() : null;
  },

  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      if (!urlObj.protocol.startsWith('http')) return null;
      return urlObj.hostname;
    } catch (e) {
      return null;
    }
  },

  getFaviconUrl(domain) {
    return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
  },

  async saveCurrentTime() {
    if (!this.currentDomain || !this.trackingStartTime) return;

    const elapsedSeconds = Math.floor((Date.now() - this.trackingStartTime) / 1000);
    if (elapsedSeconds < 1) return;

    const today = formatDate(new Date());

    try {
      const result = await chrome.storage.local.get(['websiteEntries']);
      const websiteEntries = result.websiteEntries || {};

      if (!websiteEntries[today]) websiteEntries[today] = {};
      if (!websiteEntries[today][this.currentDomain]) {
        websiteEntries[today][this.currentDomain] = { totalSeconds: 0, favicon: this.currentFavicon };
      }

      websiteEntries[today][this.currentDomain].totalSeconds += elapsedSeconds;
      if (this.currentFavicon) {
        websiteEntries[today][this.currentDomain].favicon = this.currentFavicon;
      }

      await chrome.storage.local.set({ websiteEntries });

      const exceeded = await this.checkTimeLimit(this.currentDomain);
      if (exceeded) await this.addBlockRule(this.currentDomain);

      this.trackingStartTime = this.isUserActive ? Date.now() : null;
    } catch (e) {
      // ignore
    }
  },

  startAlarms() {
    chrome.alarms.create('saveWebsiteTime', { periodInMinutes: 0.5 });
    chrome.alarms.create('storageCleanup', { periodInMinutes: 24 * 60 });
  },

  async runStorageCleanup() {
    try {
      const result = await chrome.storage.local.get(['websiteEntries', 'entries']);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);
      const websiteCutoff = formatDate(cutoffDate);

      cutoffDate.setDate(cutoffDate.getDate() - 310);
      const habitCutoff = formatDate(cutoffDate);

      const websiteEntries = result.websiteEntries || {};
      const cleanedWebsiteEntries = {};
      for (const [date, entries] of Object.entries(websiteEntries)) {
        if (date >= websiteCutoff) cleanedWebsiteEntries[date] = entries;
      }

      const habitEntries = result.entries || {};
      const cleanedHabitEntries = {};
      for (const [date, entries] of Object.entries(habitEntries)) {
        if (date >= habitCutoff) cleanedHabitEntries[date] = entries;
      }

      await chrome.storage.local.set({
        websiteEntries: cleanedWebsiteEntries,
        entries: cleanedHabitEntries
      });
    } catch (e) {
      // ignore
    }
  },

  async initBlockingSystem() {
    await this.clearAllBlockRules();
    await this.checkAllTimeLimits();
    this.setupDailyReset();
  },

  async checkTimeLimit(domain) {
    const today = formatDate(new Date());
    const result = await chrome.storage.local.get(['websiteSettings', 'websiteEntries']);
    const settings = result.websiteSettings || {};
    const entries = result.websiteEntries || {};
    const domainSettings = settings[domain];
    if (!domainSettings?.dailyLimitSeconds) return false;
    const usedSeconds = entries[today]?.[domain]?.totalSeconds || 0;
    return usedSeconds >= domainSettings.dailyLimitSeconds;
  },

  async persistBlockedState() {
    try {
      await chrome.storage.session.set({ blockedDomains: Array.from(this.blockedDomains) });
    } catch (e) {
      // ignore
    }
  },

  async restoreBlockedState() {
    try {
      const { blockedDomains } = await chrome.storage.session.get(['blockedDomains']);
      this.blockedDomains = new Set(blockedDomains || []);
      await this.checkAllTimeLimits();
    } catch (e) {
      this.blockedDomains = new Set();
    }
  },

  async addBlockRule(domain) {
    if (this.blockedDomains.has(domain)) return;
    const result = await chrome.storage.local.get(['websiteSettings']);
    const limit = result.websiteSettings?.[domain]?.dailyLimitSeconds || 0;
    this.blockedDomains.add(domain);
    await this.persistBlockedState();

    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.url) {
          const tabDomain = this.extractDomain(tab.url);
          if (tabDomain === domain) {
            chrome.tabs.sendMessage(tab.id, {
              type: 'BLOCK_DOMAIN',
              domain: domain,
              limit: limit
            }).catch(() => {});
          }
        }
      }
    } catch (e) {
      // ignore
    }
  },

  async removeBlockRule(domain) {
    this.blockedDomains.delete(domain);
    await this.persistBlockedState();
  },

  async clearAllBlockRules() {
    this.blockedDomains.clear();
    await this.persistBlockedState();
  },

  async checkAllTimeLimits() {
    const result = await chrome.storage.local.get(['websiteSettings', 'websiteEntries']);
    const settings = result.websiteSettings || {};
    const entries = result.websiteEntries || {};
    const today = formatDate(new Date());
    const todayEntries = entries[today] || {};

    for (const [domain, domainSettings] of Object.entries(settings)) {
      if (domainSettings.dailyLimitSeconds) {
        const usedSeconds = todayEntries[domain]?.totalSeconds || 0;
        if (usedSeconds >= domainSettings.dailyLimitSeconds) {
          await this.addBlockRule(domain);
        }
      }
    }
  },

  setupDailyReset() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    chrome.alarms.create('dailyLimitReset', {
      when: Date.now() + (midnight.getTime() - now.getTime()),
      periodInMinutes: 24 * 60
    });
  }
};

// ============ Unified Alarm Dispatcher ============

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'saveWebsiteTime') WebsiteTracker.saveCurrentTime();
  if (alarm.name === 'dailyLimitReset') WebsiteTracker.clearAllBlockRules();
  if (alarm.name === 'storageCleanup') WebsiteTracker.runStorageCleanup();
  if (alarm.name === 'pomodoroTick') PomodoroTimer.handleTick();
});

// ============ Message Handler ============

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_POMODORO') {
    PomodoroTimer.start(message.preset || Pomodoro.DEFAULT_PRESET)
      .then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === 'PAUSE_POMODORO') {
    PomodoroTimer.pause().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === 'RESUME_POMODORO') {
    PomodoroTimer.resume().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === 'SKIP_POMODORO') {
    PomodoroTimer.skip().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === 'ABANDON_POMODORO') {
    PomodoroTimer.abandon().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === 'GET_POMODORO_STATE') {
    PomodoroTimer.getState().then(state => sendResponse({ state }));
    return true;
  }
});

// ============ Initialize ============

WebsiteTracker.init();
PomodoroTimer.init();
