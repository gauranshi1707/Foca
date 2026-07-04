// popup.js - Interactive logic for Foca's popup interface

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // 1. FOCUS MODE SELECTOR LOGIC
  // ==========================================
  const modeBtns = document.querySelectorAll('#focaModeSelector .pill-btn');
  const statusText = document.getElementById('statusText');

  function updateModeUI(mode) {
    modeBtns.forEach(btn => {
      const btnMode = btn.getAttribute('data-mode');
      if (btnMode === 'off' && mode === 'off') {
        btn.classList.add('active');
      } else if (btnMode === 'on' && mode !== 'off') {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (mode === 'off') {
      statusText.textContent = 'Foca is Off';
      statusText.classList.remove('active');
    } else {
      statusText.textContent = 'Foca is On';
      statusText.classList.add('active');
    }
  }

  // Quick Break State Elements
  const quickBreakSection = document.getElementById('quickBreakSection');
  const activeBreakSection = document.getElementById('activeBreakSection');
  const breakTimeLeft = document.getElementById('breakTimeLeft');
  const breakBtns = document.querySelectorAll('.break-btn');
  const endBreakBtn = document.getElementById('endBreakBtn');
  let breakInterval = null;

  function updateBreakUI(mode, breakEndTime) {
    if (breakInterval) {
      clearInterval(breakInterval);
      breakInterval = null;
    }

    if (mode === 'off') {
      quickBreakSection.style.display = 'none';
      activeBreakSection.style.display = 'none';
      return;
    }

    if (breakEndTime && breakEndTime > Date.now()) {
      quickBreakSection.style.display = 'none';
      activeBreakSection.style.display = 'flex';
      statusText.textContent = 'On Break';
      statusText.classList.remove('active');

      const updateClock = () => {
        const remaining = breakEndTime - Date.now();
        if (remaining <= 0) {
          clearInterval(breakInterval);
          updateBreakUI(mode, null);
        } else {
          const m = Math.floor(remaining / 60000);
          const s = Math.floor((remaining % 60000) / 1000);
          breakTimeLeft.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
      };

      updateClock();
      breakInterval = setInterval(updateClock, 1000);
    } else {
      quickBreakSection.style.display = 'block';
      activeBreakSection.style.display = 'none';
    }
  }

  // Load initial mode state
  chrome.storage.local.get(['focaMode', 'quickBreakEndTime'], (result) => {
    const mode = result.focaMode || 'off';
    updateModeUI(mode);
    updateBreakUI(mode, result.quickBreakEndTime);
  });

  // Mode toggle click
  modeBtns.forEach(btn => {
    btn.addEventListener('click', (event) => {
      const selectedMode = event.target.getAttribute('data-mode');
      const targetMode = selectedMode === 'on' ? 'deep' : 'off';
      chrome.storage.local.set({ focaMode: targetMode, quickBreakEndTime: null }, () => {
        updateModeUI(targetMode);
        updateBreakUI(targetMode, null);
      });
    });
  });

  // Quick Break pill clicks
  breakBtns.forEach(btn => {
    btn.addEventListener('click', (event) => {
      const mins = parseInt(event.target.getAttribute('data-break'), 10);
      const endTime = Date.now() + mins * 60000;
      chrome.storage.local.set({ quickBreakEndTime: endTime }, () => {
        chrome.storage.local.get(['focaMode'], (res) => {
          updateBreakUI(res.focaMode || 'off', endTime);
        });
      });
    });
  });

  if (endBreakBtn) {
    endBreakBtn.addEventListener('click', () => {
      chrome.storage.local.set({ quickBreakEndTime: null }, () => {
        chrome.storage.local.get(['focaMode'], (res) => {
          const mode = res.focaMode || 'off';
          updateModeUI(mode);
          updateBreakUI(mode, null);
        });
      });
    });
  }

  // ==========================================
  // 2. FOCUS POMODORO TIMER LOGIC
  // ==========================================
  const timerDisplay    = document.getElementById('timerDisplay');
  const timerControlBtn = document.getElementById('timerControlBtn');  // Start button in setup card
  const timerControlBtn2 = document.getElementById('timerControlBtn2'); // End Session button in active card
  const sessionGoalInput   = document.getElementById('sessionGoalInput');
  const activeSessionGoalText = document.getElementById('activeSessionGoalText');

  // Layout cards
  const sessionSetupCard  = document.getElementById('sessionSetupCard');
  const activeSessionCard = document.getElementById('activeSessionCard');

  // Duration controls
  const timerDurationSlider  = document.getElementById('timerDurationSlider');
  const timerDurationInput   = document.getElementById('timerDurationInput');
  const timerDecrementBtn    = document.getElementById('timerDecrementBtn');
  const timerIncrementBtn    = document.getElementById('timerIncrementBtn');

  let selectedDuration = 25;
  let timerInterval = null;

  function updateCustomDurationUI(minutes) {
    const clamped = Math.max(1, Math.min(180, minutes));
    selectedDuration = clamped;
    if (timerDurationSlider) timerDurationSlider.value = clamped;
    if (timerDurationInput)  timerDurationInput.value  = clamped;
    // Only update display when no session is running
    if (!timerInterval && timerDisplay) {
      timerDisplay.textContent = `${String(clamped).padStart(2, '0')}:00`;
    }
    chrome.storage.local.set({ timerDuration: clamped });
  }

  // Show the setup card (before a session starts)
  function showSetupCard() {
    if (sessionSetupCard)  sessionSetupCard.style.display  = '';
    if (activeSessionCard) activeSessionCard.style.display = 'none';
  }

  // Show the active session card (during a running session)
  function showActiveCard(goal) {
    if (sessionSetupCard)  sessionSetupCard.style.display  = 'none';
    if (activeSessionCard) activeSessionCard.style.display = 'flex';
    if (activeSessionGoalText) {
      activeSessionGoalText.textContent = goal || 'No goal set';
    }
  }

  function resetTimerUI() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;

    if (timerDisplay) {
      timerDisplay.classList.remove('ticking');
      timerDisplay.textContent = `${String(selectedDuration).padStart(2, '0')}:00`;
    }

    // Re-enable duration controls
    if (timerDurationSlider) timerDurationSlider.disabled = false;
    if (timerDurationInput)  timerDurationInput.disabled  = false;
    if (timerDecrementBtn)   timerDecrementBtn.disabled   = false;
    if (timerIncrementBtn)   timerIncrementBtn.disabled   = false;

    showSetupCard();
  }

  function startLocalTimer(endTime, goal = '') {
    if (timerInterval) clearInterval(timerInterval);

    showActiveCard(goal);

    if (timerDisplay) timerDisplay.classList.add('ticking');

    // Disable duration controls
    if (timerDurationSlider) timerDurationSlider.disabled = true;
    if (timerDurationInput)  timerDurationInput.disabled  = true;
    if (timerDecrementBtn)   timerDecrementBtn.disabled   = true;
    if (timerIncrementBtn)   timerIncrementBtn.disabled   = true;

    function updateCountdown() {
      const timeLeft = endTime - Date.now();
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        timerInterval = null;
        showSessionCompleteCard(selectedDuration, goal);
        return;
      }
      const minutes = Math.floor(timeLeft / 1000 / 60);
      const seconds = Math.floor((timeLeft / 1000) % 60);
      if (timerDisplay) {
        timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
    }

    updateCountdown();
    timerInterval = setInterval(updateCountdown, 1000);
  }

  // ==========================================
  // SESSION COMPLETE CARD
  // ==========================================
  function showSessionCompleteCard(duration, goal) {
    chrome.storage.local.get(['completedSessions', 'currentStreak'], (result) => {
      const completed = result.completedSessions || 0;
      const streak    = result.currentStreak    || 0;

      const completeCard = document.createElement('div');
      completeCard.id = 'sessionCompleteCard';
      completeCard.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:10px;padding:16px 0;width:100%;';

      const goalLine = goal
        ? `<div style="font-size:11px;color:var(--muted);font-family:var(--font-ui);font-style:italic;text-align:center;max-width:240px;">"${goal}"</div>`
        : '';

      completeCard.innerHTML = `
        <div style="font-size:28px;line-height:1;">🎉</div>
        <div style="font-family:var(--font-heading);font-size:16px;font-weight:600;color:var(--accent);letter-spacing:0.04em;">Great Work!</div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:var(--muted);font-family:var(--font-ui);">Session Complete · ${duration}m</div>
        ${goalLine}
        <div style="display:flex;flex-direction:column;gap:3px;width:100%;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:7px;padding:8px 10px;font-size:11px;color:var(--muted);font-family:var(--font-ui);">
          <div style="display:flex;justify-content:space-between;"><span>Sessions today:</span><span style="color:var(--text);font-weight:600;">${completed}</span></div>
          <div style="display:flex;justify-content:space-between;"><span>Current streak:</span><span style="color:var(--accent);font-weight:600;">${streak}d</span></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;width:100%;">
          <button id="completeStartAnotherBtn" style="width:100%;padding:9px;background:var(--accent);border:none;border-radius:7px;color:var(--bg);font-family:var(--font-ui);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;cursor:pointer;">Start Another</button>
          <button id="completeTakeBreakBtn" style="width:100%;padding:9px;background:transparent;border:1px solid var(--border);border-radius:7px;color:var(--text);font-family:var(--font-ui);font-size:12px;font-weight:600;cursor:pointer;">Take 5 Minute Break</button>
          <button id="completeCloseBtn" style="width:100%;padding:7px;background:transparent;border:none;color:var(--muted);font-family:var(--font-ui);font-size:11px;cursor:pointer;text-decoration:underline;">Close</button>
        </div>
      `;

      // Replace the active session card contents with the complete card
      if (activeSessionCard) {
        activeSessionCard.innerHTML = '';
        activeSessionCard.appendChild(completeCard);
        activeSessionCard.style.display = 'flex';
      }

      loadFocusStats();

      const anotherBtn = completeCard.querySelector('#completeStartAnotherBtn');
      if (anotherBtn) {
        anotherBtn.addEventListener('click', () => {
          resetTimerUI();
        });
      }

      const breakBtn = completeCard.querySelector('#completeTakeBreakBtn');
      if (breakBtn) {
        breakBtn.addEventListener('click', () => {
          const breakTime = Date.now() + 5 * 60000;
          chrome.storage.local.set({ quickBreakEndTime: breakTime }, () => {
            resetTimerUI();
            chrome.storage.local.get(['focaMode'], (res) => {
              updateBreakUI(res.focaMode || 'off', breakTime);
            });
          });
        });
      }

      const closeBtn = completeCard.querySelector('#completeCloseBtn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => { window.close(); });
      }
    });
  }

  // Slider sync
  if (timerDurationSlider) {
    timerDurationSlider.addEventListener('input', (event) => {
      updateCustomDurationUI(parseInt(event.target.value, 10));
    });
  }

  // Number input sync
  if (timerDurationInput) {
    timerDurationInput.addEventListener('input', (event) => {
      const parsed = parseInt(event.target.value, 10);
      if (!isNaN(parsed)) updateCustomDurationUI(parsed);
    });
    timerDurationInput.addEventListener('blur', (event) => {
      let parsed = parseInt(event.target.value, 10);
      if (isNaN(parsed) || parsed < 1) parsed = 25;
      else if (parsed > 180) parsed = 180;
      updateCustomDurationUI(parsed);
    });
  }

  if (timerDecrementBtn) {
    timerDecrementBtn.addEventListener('click', () => updateCustomDurationUI(selectedDuration - 1));
  }
  if (timerIncrementBtn) {
    timerIncrementBtn.addEventListener('click', () => updateCustomDurationUI(selectedDuration + 1));
  }

  function logInterruptedSession(callback) {
    chrome.storage.local.get([
      'timerStartTime', 'timerDuration', 'currentSessionGoal', 'focaMode', 'sessionHistory'
    ], (result) => {
      const startTime = result.timerStartTime || Date.now();
      const endTime   = Date.now();
      const elapsedMs  = endTime - startTime;
      const elapsedMin = Math.max(0, Math.round(elapsedMs / 60000));

      const tzOffset   = new Date().getTimezoneOffset() * 60000;
      const localDateStr = new Date(endTime - tzOffset).toISOString().split('T')[0];

      const mode = result.focaMode || 'ON';
      const platformMode = (mode !== 'off') ? 'ON' : 'OFF';

      function formatLocalTime(timestamp) {
        const date = new Date(timestamp);
        return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
      }

      const sessionRecord = {
        date: localDateStr,
        startTime: formatLocalTime(startTime),
        endTime: formatLocalTime(endTime),
        duration: elapsedMin,
        goal: result.currentSessionGoal || '',
        platformMode,
        status: 'Interrupted'
      };

      const history = Array.isArray(result.sessionHistory) ? result.sessionHistory : [];
      history.push(sessionRecord);
      if (history.length > 50) history.splice(0, history.length - 50);
      chrome.storage.local.set({ sessionHistory: history }, callback);
    });
  }

  // Start button
  if (timerControlBtn) {
    timerControlBtn.addEventListener('click', () => {
      const goal = sessionGoalInput ? sessionGoalInput.value.trim() : '';

      // Soft nudge on empty goal
      if (!goal && sessionGoalInput) {
        sessionGoalInput.style.borderColor = 'var(--accent)';
        sessionGoalInput.style.boxShadow   = '0 0 0 2px var(--accent-glow)';
        sessionGoalInput.placeholder = 'What are you working on?';
        setTimeout(() => {
          if (sessionGoalInput) {
            sessionGoalInput.style.borderColor = '';
            sessionGoalInput.style.boxShadow   = '';
            sessionGoalInput.placeholder = 'What are you working on?';
          }
        }, 2000);
      }

      const durationMs = selectedDuration * 60 * 1000;
      const endTime    = Date.now() + durationMs;

      chrome.storage.local.set({
        timerStartTime: Date.now(),
        timerEndTime:   endTime,
        timerDuration:  selectedDuration,
        currentSessionGoal: goal
      }, () => {
        chrome.alarms.create('foca-timer', { when: endTime });
        startLocalTimer(endTime, goal);
        console.log(`Foca Timer: Focus session started for ${selectedDuration} minutes. Goal: "${goal}"`);
      });
    });
  }

  // End Session button (inside active card)
  if (timerControlBtn2) {
    timerControlBtn2.addEventListener('click', () => {
      chrome.alarms.clear('foca-timer');
      logInterruptedSession(() => {
        chrome.storage.local.remove(['timerStartTime', 'timerEndTime', 'timerDuration', 'currentSessionGoal'], () => {
          resetTimerUI();
        });
      });
    });
  }

  // ==========================================
  // 3. FOCUS STATISTICS LOGIC
  // ==========================================
  function loadFocusStats() {
    chrome.storage.local.get([
      'todayFocusTime', 'weeklyFocusTime', 'weeklySessionCount', 'monthlyFocusTime',
      'completedSessions', 'currentStreak', 'longestStreak', 'longestSession',
      'lastActiveDate', 'weekStartDate', 'sessionHistory'
    ], (result) => {
      const now = new Date();
      const tzOffset = now.getTimezoneOffset() * 60000;
      const localDateStr = new Date(now.getTime() - tzOffset).toISOString().split('T')[0];

      let todayFocus = result.todayFocusTime || 0;
      if (result.lastActiveDate !== localDateStr) todayFocus = 0;

      let weeklyFocus = result.weeklyFocusTime || 0;
      let weeklyCount = result.weeklySessionCount || 0;
      const weekStart = result.weekStartDate || null;

      function getDaysDifference(d1, d2) {
        if (!d1 || !d2) return 99;
        return Math.floor(Math.abs(new Date(d1+'T00:00:00') - new Date(d2+'T00:00:00')) / 86400000);
      }

      const daysDiff    = getDaysDifference(localDateStr, weekStart);
      const lastWeekDate = weekStart ? new Date(weekStart + 'T00:00:00') : null;
      if (!weekStart || daysDiff >= 7 || (lastWeekDate && now.getDay() < lastWeekDate.getDay())) {
        weeklyFocus = 0;
        weeklyCount = 0;
      }

      let streak = result.currentStreak || 0;
      if (result.lastActiveDate) {
        const yesterday    = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = new Date(yesterday.getTime() - tzOffset).toISOString().split('T')[0];
        if (result.lastActiveDate !== localDateStr && result.lastActiveDate !== yesterdayStr) {
          streak = 0;
        }
      }

      const completed      = result.completedSessions  || 0;
      const longestSession = result.longestSession      || 0;
      const longestStreak  = result.longestStreak       || 0;
      const monthlyFocus   = result.monthlyFocusTime    || 0;
      const avgSession     = weeklyCount > 0 ? Math.round(weeklyFocus / weeklyCount) : 0;

      const el = (id) => document.getElementById(id);
      if (el('statToday'))         el('statToday').textContent         = todayFocus    + 'm';
      if (el('statWeek'))          el('statWeek').textContent          = weeklyFocus   + 'm';
      if (el('statSessions'))      el('statSessions').textContent      = completed;
      if (el('statStreak'))        el('statStreak').textContent        = streak        + 'd';
      if (el('statLongest'))       el('statLongest').textContent       = longestSession + 'm';
      if (el('statAvg'))           el('statAvg').textContent           = avgSession    + 'm';
      if (el('statMonthly'))       el('statMonthly').textContent       = monthlyFocus  + 'm';
      if (el('statLongestStreak')) el('statLongestStreak').textContent = longestStreak + 'd';

      const dailyGoal = 120;
      const pct   = Math.min(100, Math.round((todayFocus / dailyGoal) * 100));
      const bar   = el('statDailyGoalBar');
      const label = el('statDailyGoalLabel');
      if (bar)   bar.style.width    = pct + '%';
      if (label) label.textContent  = todayFocus + ' / ' + dailyGoal + ' min';

      const historyList  = el('sessionHistoryList');
      const historyEmpty = el('sessionHistoryEmpty');
      if (historyList) {
        const history = Array.isArray(result.sessionHistory) ? result.sessionHistory : [];
        const recent  = history.slice().reverse().slice(0, 10);

        if (recent.length === 0) {
          historyList.style.display  = 'none';
          if (historyEmpty) historyEmpty.style.display = 'block';
        } else {
          historyList.style.display  = 'flex';
          if (historyEmpty) historyEmpty.style.display = 'none';
          historyList.innerHTML = recent.map(s => {
            const isToday     = s.date === localDateStr;
            const dateLabel   = isToday ? 'Today' : s.date;
            const goalText    = s.goal ? s.goal : '—';
            const timeRange   = (s.startTime && s.endTime) ? ` (${s.startTime}–${s.endTime})` : '';
            const statusLabel = s.status || (s.completed ? 'Completed' : 'Interrupted');
            const statusColor = statusLabel === 'Completed' ? 'var(--accent)' : '#ff6b6b';
            const statusSym   = statusLabel === 'Completed' ? '✓' : '✗';
            const platformText = s.platformMode ? `Mode: ${s.platformMode}` : 'Mode: ON';

            return (
              '<div style="display:flex;flex-direction:column;padding:7px 10px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:7px;gap:3px;">' +
                '<div style="display:flex;align-items:center;justify-content:space-between;">' +
                  '<span style="font-size:10px;color:var(--muted);font-family:var(--font-ui);">' + dateLabel + timeRange + '</span>' +
                  '<span style="font-size:10px;font-weight:600;color:' + statusColor + ';font-family:var(--font-ui);">' + statusLabel + '</span>' +
                '</div>' +
                '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">' +
                  '<span style="font-size:11px;color:var(--text);font-family:var(--font-ui);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;" title="' + goalText + '">' + goalText + '</span>' +
                  '<div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">' +
                    '<span style="font-size:10px;color:var(--muted);font-family:var(--font-ui);">' + platformText + '</span>' +
                    '<span style="font-size:11px;font-weight:600;color:var(--accent);font-family:var(--font-ui);">' + s.duration + 'm</span>' +
                    '<span style="font-size:12px;font-weight:bold;color:' + statusColor + ';">' + statusSym + '</span>' +
                  '</div>' +
                '</div>' +
              '</div>'
            );
          }).join('');
        }
      }
    });
  }

  // Session History toggle icon
  const historyDetails = document.getElementById('sessionHistoryDetails');
  if (historyDetails) {
    historyDetails.addEventListener('toggle', () => {
      const icon = document.getElementById('historyToggleIcon');
      if (icon) icon.textContent = historyDetails.open ? '▲' : '▼';
    });
  }

  // Live stat updates from background
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (
        changes.completedSessions || changes.todayFocusTime  ||
        changes.weeklyFocusTime   || changes.monthlyFocusTime ||
        changes.sessionHistory    || changes.currentStreak   ||
        changes.longestSession
      ) {
        loadFocusStats();
      }
    }
  });

  // ==========================================
  // 4. SETTINGS CONTROL LOGIC
  // ==========================================
  const settingsKeys = {
    ytLockHomepage: 'ytLockHomepage',
    ytHideComments: 'ytHideComments',
    genEnableTimer: 'enableTimer',
    genSoundType:   'timerSound',
    genShowCards:   'showQuotes',
    genAutoEnable:  'autoEnable'
  };

  const defaultSettings = {
    ytLockHomepage: true,
    ytHideComments: true,
    enableTimer:    true,
    timerSound:     'chime',
    showQuotes:     true,
    autoEnable:     false
  };

  function toggleTimerCardVisibility(show) {
    // The timer/setup card is always shown in the new layout;
    // this setting now only affects content scripts — keep storage intact.
    const setupCard = document.getElementById('sessionSetupCard');
    if (setupCard && !timerInterval) {
      setupCard.style.display = show ? '' : 'none';
    }
  }

  chrome.storage.local.get(Object.values(settingsKeys), (result) => {
    Object.keys(settingsKeys).forEach((id) => {
      const key = settingsKeys[id];
      const val = result[key] !== undefined ? result[key] : defaultSettings[key];
      const el  = document.getElementById(id);
      if (el) {
        if (el.type === 'checkbox') { el.checked = val; }
        else { el.value = val; }
        if (key === 'enableTimer') toggleTimerCardVisibility(val);
      }
    });
  });

  Object.keys(settingsKeys).forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', (event) => {
        const key = settingsKeys[id];
        const val = el.type === 'checkbox' ? event.target.checked : event.target.value;
        chrome.storage.local.set({ [key]: val }, () => {
          console.log(`Foca Settings: Saved ${key} = ${val}`);
          if (key === 'enableTimer') toggleTimerCardVisibility(val);
        });
      });
    }
  });

  // ==========================================
  // INSTAGRAM MODE — Radio group (igMode)
  // ==========================================
  const igRadios = document.querySelectorAll('input[name="igMode"]');

  chrome.storage.local.get('igMode', (result) => {
    const saved = result.igMode || 'messages';
    igRadios.forEach(radio => { radio.checked = (radio.value === saved); });
  });

  igRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        chrome.storage.local.set({ igMode: radio.value }, () => {
          console.log(`Foca Settings: Saved igMode = ${radio.value}`);
        });
      }
    });
  });

  // Sound Preview Button
  const previewSoundBtn = document.getElementById('previewSoundBtn');
  if (previewSoundBtn) {
    previewSoundBtn.addEventListener('click', () => {
      const soundType = document.getElementById('genSoundType').value;
      chrome.runtime.sendMessage({ action: 'preview-sound', soundType });
    });
  }

  // ==========================================
  // INITIALIZATION ON POPUP OPEN
  // ==========================================
  loadFocusStats();

  chrome.storage.local.get(['timerEndTime', 'timerDuration', 'currentSessionGoal'], (result) => {
    if (result.currentSessionGoal && sessionGoalInput) {
      sessionGoalInput.value = result.currentSessionGoal;
    }

    const savedDuration = result.timerDuration || 25;
    updateCustomDurationUI(savedDuration);

    if (result.timerEndTime) {
      const remainingTime = result.timerEndTime - Date.now();
      if (remainingTime > 0) {
        selectedDuration = savedDuration;
        startLocalTimer(result.timerEndTime, result.currentSessionGoal || '');
      } else {
        resetTimerUI();
      }
    } else {
      resetTimerUI();
    }
  });
});
