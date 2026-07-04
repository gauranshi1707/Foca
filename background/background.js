// background.js - Background service worker for Foca

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-study-mode') {
    chrome.storage.local.get(['focaMode'], (result) => {
      const currentMode = result.focaMode || 'off';
      const newState = currentMode === 'off' ? 'deep' : 'off';
      chrome.storage.local.set({ focaMode: newState }, () => {
        console.log(`Foca: Study Mode toggled via keyboard shortcut → ${newState}`);
      });
    });
  }
});

// --- HANDLE MESSAGES FROM POPUP & CONTENT SCRIPTS ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'preview-sound') {
    playAlarmChime(message.soundType);
    sendResponse({ success: true });
  } else if (message.action === 'close-current-tab') {
    if (sender.tab && sender.tab.id) {
      const tabId = sender.tab.id;
      chrome.tabs.remove(tabId, () => {
        if (chrome.runtime.lastError) {
          chrome.tabs.update(tabId, { url: 'chrome://newtab' }, () => {
            if (chrome.runtime.lastError) {
              chrome.tabs.update(tabId, { url: 'about:blank' }, () => {
                if (chrome.runtime.lastError) {
                  chrome.tabs.update(tabId, { url: 'https://www.google.com' });
                }
              });
            }
          });
        }
      });
      sendResponse({ success: true });
    }
  } else if (message.action === 'open-new-tab') {
    if (sender.tab && sender.tab.id) {
      chrome.tabs.update(sender.tab.id, { url: message.url || 'chrome://newtab/' });
      sendResponse({ success: true });
    }
  }
});

// Handle Chrome alarms (wakes up even if background page is sleeping)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'foca-timer') {
    handleTimerCompletion();
  } else if (alarm.name === 'foca-break-timer') {
    chrome.storage.local.set({ quickBreakEndTime: null }, () => {
      chrome.storage.local.get(['timerSound'], (result) => {
        const soundType = result.timerSound || 'chime';
        playAlarmChime(soundType);
      });
      chrome.notifications.create('foca-break-notification', {
        type: 'basic',
        iconUrl: '../icons/icon-128.png',
        title: 'Break Over',
        message: 'Your quick break has ended. Focus mode resumed!',
        priority: 2
      });
    });
  }
});

// Watch for break timer creation
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.quickBreakEndTime) {
    const newVal = changes.quickBreakEndTime.newValue;
    if (newVal) {
      const delayMs = newVal - Date.now();
      if (delayMs > 0) {
        chrome.alarms.create('foca-break-timer', { when: newVal });
      }
    } else {
      chrome.alarms.clear('foca-break-timer');
    }
  }
});

/**
 * Executes operations when the focus timer completes.
 */
function handleTimerCompletion() {
  // 1. Send desktop notification
  chrome.notifications.create('foca-timer-notification', {
    type: 'basic',
    iconUrl: '../icons/icon-128.png',
    title: 'Session Completed',
    message: 'Time is up! Take a moment to rest and breathe.',
    priority: 2
  });

  // 2. Play alarm chime sound using an offscreen document
  chrome.storage.local.get(['timerSound'], (result) => {
    const soundType = result.timerSound || 'chime';
    playAlarmChime(soundType);
  });

  // 3. Update Statistics in Storage
  updateFocusStatistics();
}

/**
 * Updates completed sessions, daily streaks, and accumulated focus times.
 */
function formatLocalTime(timestamp) {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function getDaysDifference(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return 99;
  const d1 = new Date(dateStr1 + 'T00:00:00');
  const d2 = new Date(dateStr2 + 'T00:00:00');
  const diffMs = Math.abs(d1 - d2);
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Updates completed sessions, daily streaks, and accumulated focus times.
 */
function updateFocusStatistics() {
  // Query storage for current metrics
  chrome.storage.local.get([
    'timerDuration',
    'timerStartTime',
    'focaMode',
    'currentSessionGoal',
    'sessionHistory',
    'todayFocusTime',
    'weeklyFocusTime',
    'weeklySessionCount',
    'monthlyFocusTime',
    'completedSessions',
    'currentStreak',
    'longestStreak',
    'longestSession',
    'lastActiveDate',
    'weekStartDate',
    'monthStartDate'
  ], (result) => {
    const duration = result.timerDuration || 25;

    // Calculate timezone-adjusted local date string (YYYY-MM-DD)
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localDateStr = new Date(now.getTime() - tzOffset).toISOString().split('T')[0];

    // --- 1. Daily Reset / Focus Time Accumulator ---
    let todayFocus = result.todayFocusTime || 0;
    const lastActive = result.lastActiveDate || null;

    if (lastActive !== localDateStr) {
      todayFocus = 0;
    }
    todayFocus += duration;

    // --- 2. Weekly Reset / Focus Time + Session Count Accumulator ---
    let weeklyFocus = result.weeklyFocusTime || 0;
    let weeklySessionCount = result.weeklySessionCount || 0;
    let weekStart = result.weekStartDate || null;

    const daysDiff = getDaysDifference(localDateStr, weekStart);
    const lastWeekDate = weekStart ? new Date(weekStart + 'T00:00:00') : null;

    if (!weekStart || daysDiff >= 7 || (lastWeekDate && now.getDay() < lastWeekDate.getDay())) {
      weeklyFocus = 0;
      weeklySessionCount = 0;
      weekStart = localDateStr;
    }
    weeklyFocus += duration;
    weeklySessionCount += 1;

    // --- 3. Monthly Reset / Focus Time Accumulator ---
    let monthlyFocus = result.monthlyFocusTime || 0;
    let monthStart = result.monthStartDate || null;

    const currentMonth = localDateStr.substring(0, 7); // YYYY-MM
    const storedMonth = monthStart ? monthStart.substring(0, 7) : null;

    if (!storedMonth || storedMonth !== currentMonth) {
      monthlyFocus = 0;
      monthStart = localDateStr;
    }
    monthlyFocus += duration;

    // --- 4. Longest Session ---
    const longestSession = Math.max(result.longestSession || 0, duration);

    // --- 5. Streak Calculations ---
    let streak = result.currentStreak || 0;
    let maxStreak = result.longestStreak || 0;

    if (lastActive === null) {
      streak = 1;
    } else if (lastActive === localDateStr) {
      // Already completed a session today: streak unchanged
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayDateStr = new Date(yesterday.getTime() - tzOffset).toISOString().split('T')[0];
      streak = (lastActive === yesterdayDateStr) ? streak + 1 : 1;
    }

    if (streak > maxStreak) maxStreak = streak;

    const completed = (result.completedSessions || 0) + 1;

    // Build a complete session history record
    const startTimeStamp = result.timerStartTime || (Date.now() - duration * 60 * 1000);
    const endTimeStamp = Date.now();
    const mode = result.focaMode || 'ON';
    const platformMode = (mode !== 'off') ? 'ON' : 'OFF';

    const sessionRecord = {
      date: localDateStr,
      startTime: formatLocalTime(startTimeStamp),
      endTime: formatLocalTime(endTimeStamp),
      duration: duration,
      goal: result.currentSessionGoal || '',
      platformMode: platformMode,
      status: 'Completed'
    };

    const history = Array.isArray(result.sessionHistory) ? result.sessionHistory : [];
    history.push(sessionRecord);
    if (history.length > 50) history.splice(0, history.length - 50);

    // Save all updated metrics and clean up active session keys
    chrome.storage.local.set({
      todayFocusTime: todayFocus,
      weeklyFocusTime: weeklyFocus,
      weeklySessionCount: weeklySessionCount,
      monthlyFocusTime: monthlyFocus,
      completedSessions: completed,
      currentStreak: streak,
      longestStreak: maxStreak,
      longestSession: longestSession,
      lastActiveDate: localDateStr,
      weekStartDate: weekStart || localDateStr,
      monthStartDate: monthStart || localDateStr,
      sessionHistory: history
    }, () => {
      chrome.storage.local.remove(['timerStartTime', 'timerEndTime', 'timerDuration', 'currentSessionGoal'], () => {
        console.log(`Foca Background: Session ${completed} completed. Goal: "${sessionRecord.goal}".`);
      });
    });
  });
}

/**
 * Creates an offscreen document to play the synthesized sound chime,
 * then destroys the document to save memory.
 */
async function playAlarmChime(soundType) {
  try {
    await chrome.offscreen.createDocument({
      url: 'background/offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play synthesized alarm chime when timer ends'
    });

    chrome.runtime.sendMessage({ action: 'play-chime', soundType });

    // Allow long-decay sounds to fully play before closing the document
    const longDecaySounds = new Set(['bowl', 'temple-bell', 'wind-chime', 'calm-piano']);
    const timeoutDuration = longDecaySounds.has(soundType) ? 6000 : 2000;
    
    setTimeout(() => {
      chrome.offscreen.closeDocument().catch(() => {});
    }, timeoutDuration);
  } catch (error) {
    console.error('Foca Background: Error playing alarm sound via Offscreen Document', error);
  }
}

// --- AUTO-ENABLE STUDY MODE ON STARTUP ---
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(['autoEnable'], (result) => {
    if (result.autoEnable) {
      chrome.storage.local.set({ focaMode: 'deep' }, () => {
        console.log('Foca Background: Deep Focus auto-enabled on browser startup.');
      });
    }
  });
});
