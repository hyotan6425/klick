(() => {
  // Elements
  const modeFixedRadio = document.getElementById("mode-fixed");
  const modeRandomRadio = document.getElementById("mode-random");
  const fixedField = document.getElementById("fixed-field");
  const randomMinField = document.getElementById("random-min-field");
  const randomMaxField = document.getElementById("random-max-field");
  const fixedInput = document.getElementById("fixed-interval");
  const randomMinInput = document.getElementById("random-min");
  const randomMaxInput = document.getElementById("random-max");

  const stopNoneRadio = document.getElementById("stop-none");
  const stopCountRadio = document.getElementById("stop-count");
  const stopTimeRadio = document.getElementById("stop-time");
  const stopCountField = document.getElementById("stop-count-field");
  const stopTimeField = document.getElementById("stop-time-field");
  const stopCountInput = document.getElementById("stop-count-input");
  const stopTimeInput = document.getElementById("stop-time-input");

  const alwaysActiveCheck = document.getElementById("always-active-check");
  const mouseJigglerCheck = document.getElementById("mouse-jiggler-check");

  const scheduledStartCheck = document.getElementById("scheduled-start-check");
  const scheduledStartField = document.getElementById("scheduled-start-field");
  const scheduledStartTimeInput = document.getElementById("scheduled-start-time");
  const scheduleMessage = document.getElementById("schedule-message");

  const validationMessage = document.getElementById("validation-message");
  const startSelectBtn = document.getElementById("start-select-btn");
  const stopBtn = document.getElementById("stop-btn");
  const cancelBtn = document.getElementById("cancel-btn");
  const statusText = document.getElementById("status-text");
  const linkWarn = document.getElementById("link-warn");

  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  let currentState = "idle"; // idle | selecting | running

  // Tab Logic
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      // Remove active class from all
      tabBtns.forEach(b => b.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));
      // Add active to clicked
      btn.classList.add("active");
      const targetId = btn.getAttribute("data-tab");
      document.getElementById(targetId).classList.add("active");
    });
  });

  function updateModeVisibility() {
    const isFixed = modeFixedRadio.checked;
    fixedField.style.display = isFixed ? "block" : "none";
    randomMinField.style.display = isFixed ? "none" : "block";
    randomMaxField.style.display = isFixed ? "none" : "block";
    validateInputs();
  }

  function updateStopVisibility() {
    const stop = stopCountRadio.checked ? "count" : stopTimeRadio.checked ? "time" : "none";
    stopCountField.style.display = stop === "count" ? "block" : "none";
    stopTimeField.style.display = stop === "time" ? "block" : "none";
    validateInputs();
  }

  function updateStartVisibility() {
    scheduledStartField.style.display = scheduledStartCheck.checked ? "block" : "none";
    updateScheduleMessage();
    validateInputs();
  }

  function updateScheduleMessage() {
    if (!scheduledStartCheck.checked) {
      scheduleMessage.textContent = "";
      return;
    }
    const val = scheduledStartTimeInput.value;
    if (!val) {
      scheduleMessage.textContent = "";
      return;
    }

    // Calculate time until next occurrence
    const now = new Date();
    const [h, m] = val.split(":").map(Number);
    let target = new Date(now);
    target.setHours(h, m, 0, 0);

    if (target <= now) {
      // If time has passed today, schedule for tomorrow
      target.setDate(target.getDate() + 1);
    }

    const diffMs = target - now;
    const diffMin = Math.floor(diffMs / 60000);
    const diffSec = Math.floor((diffMs % 60000) / 1000);

    if (diffMin > 0) {
      scheduleMessage.textContent = `開始まで約 ${diffMin}分 ${diffSec}秒`;
    } else {
      scheduleMessage.textContent = `開始まで約 ${diffSec}秒`;
    }
  }

  // Timer to update schedule message every second if visible
  setInterval(updateScheduleMessage, 1000);


  function validateInputs() {
    validationMessage.textContent = "";

    let valid = true;
    let mode = modeFixedRadio.checked ? "fixed" : "random";

    if (mode === "fixed") {
      const v = Number(fixedInput.value);
      if (!(v > 0)) {
        valid = false;
        validationMessage.textContent = "間隔は 0 より大きい値を入力してください。";
      }
    } else {
      const min = Number(randomMinInput.value);
      const max = Number(randomMaxInput.value);

      if (!(min > 0 && max > 0)) {
        valid = false;
        validationMessage.textContent = "最小・最大とも 0 より大きい値を入力してください。";
      } else if (min > max) {
        valid = false;
        validationMessage.textContent = "最小間隔は最大間隔以下の値にしてください。";
      }
    }

    const stop = stopCountRadio.checked ? "count" : stopTimeRadio.checked ? "time" : "none";
    if (stop === "count") {
      const n = Number(stopCountInput.value);
      if (!(Number.isInteger(n) && n >= 1)) {
        valid = false;
        if (!validationMessage.textContent)
          validationMessage.textContent = "回数は 1 以上の整数を入力してください。";
      }
    } else if (stop === "time") {
      const t = Number(stopTimeInput.value);
      if (!(t > 0)) {
        valid = false;
        if (!validationMessage.textContent)
          validationMessage.textContent = "時間は 0 より大きい値を入力してください。";
      }
    }

    if (scheduledStartCheck.checked) {
      if (!scheduledStartTimeInput.value) {
        valid = false;
        if (!validationMessage.textContent)
          validationMessage.textContent = "開始時刻を入力してください。";
      }
    }

    startSelectBtn.disabled = !valid || currentState !== "idle";
    return valid;
  }

  function setState(nextState, nextDelaySec) {
    currentState = nextState;
    if (nextState === "idle") {
      statusText.textContent = "ステータス: 待機中";
      stopBtn.classList.add("hidden");
      cancelBtn.classList.add("hidden");
      linkWarn.classList.add("hidden");
      validateInputs();
    } else if (nextState === "selecting") {
      statusText.textContent = "ステータス: 選択中（ページ上の要素をクリック）";
      startSelectBtn.disabled = true;
      stopBtn.classList.add("hidden");
      cancelBtn.classList.remove("hidden");
    } else if (nextState === "running") {
      const sec = typeof nextDelaySec === "number" ? ` (次まで ${nextDelaySec.toFixed(1)}秒)` : "";
      statusText.textContent = `ステータス: 実行中${sec}`;
      cancelBtn.classList.add("hidden");
      stopBtn.classList.remove("hidden");
      startSelectBtn.disabled = true;
    } else if (nextState === "scheduled") {
      statusText.textContent = "ステータス: 開始待ち...";
      startSelectBtn.disabled = true;
      cancelBtn.classList.add("hidden");
      stopBtn.classList.remove("hidden"); // Allow cancelling schedule
    }
  }

  function updateRunningStatus(nextDelaySec) {
    if (currentState !== "running") return;
    const sec = typeof nextDelaySec === "number" ? ` (次まで ${nextDelaySec.toFixed(1)}秒)` : "";
    statusText.textContent = `ステータス: 実行中${sec}`;
  }

  function loadSavedSettings() {
    chrome.storage.local.get(
      [
        "mode",
        "fixedInterval",
        "randomMin",
        "randomMax",
        "stopType",
        "stopCount",
        "stopMinutes",
        "alwaysActive",
        "mouseJiggler",
        "scheduledStart",
        "scheduledStartTime"
      ],
      (data) => {
        if (data.alwaysActive === true) alwaysActiveCheck.checked = true;
        if (data.mouseJiggler === true) mouseJigglerCheck.checked = true;

        if (data.mode === "random") {
          modeRandomRadio.checked = true;
          if (typeof data.randomMin === "number" && data.randomMin > 0) randomMinInput.value = data.randomMin;
          if (typeof data.randomMax === "number" && data.randomMax > 0) randomMaxInput.value = data.randomMax;
        } else {
          modeFixedRadio.checked = true;
          if (typeof data.fixedInterval === "number" && data.fixedInterval > 0) fixedInput.value = data.fixedInterval;
        }

        if (data.stopType === "count") {
          stopCountRadio.checked = true;
          if (typeof data.stopCount === "number" && data.stopCount >= 1) stopCountInput.value = Math.floor(data.stopCount);
        } else if (data.stopType === "time") {
          stopTimeRadio.checked = true;
          if (typeof data.stopMinutes === "number" && data.stopMinutes > 0) stopTimeInput.value = data.stopMinutes;
        } else {
          stopNoneRadio.checked = true;
        }

        if (data.scheduledStart === true) {
          scheduledStartCheck.checked = true;
          if (data.scheduledStartTime) scheduledStartTimeInput.value = data.scheduledStartTime;
        }

        updateModeVisibility();
        updateStopVisibility();
        updateStartVisibility();
        validateInputs();
      }
    );
  }

  function saveSettings(mode, interval, min, max, stopType, stopCount, stopMinutes, alwaysActive, mouseJiggler, scheduledStart, scheduledStartTime) {
    const o = { mode };
    if (mode === "fixed") o.fixedInterval = interval;
    else {
      o.randomMin = min;
      o.randomMax = max;
    }
    o.stopType = stopType ?? "none";
    if (stopType === "count" && typeof stopCount === "number") o.stopCount = stopCount;
    if (stopType === "time" && typeof stopMinutes === "number") o.stopMinutes = stopMinutes;
    o.alwaysActive = alwaysActive;
    o.mouseJiggler = mouseJiggler;
    o.scheduledStart = scheduledStart;
    o.scheduledStartTime = scheduledStartTime;
    chrome.storage.local.set(o);
  }

  function saveSettingsFromForm() {
    const mode = modeFixedRadio.checked ? "fixed" : "random";
    const interval = Number(fixedInput.value);
    const min = Number(randomMinInput.value);
    const max = Number(randomMaxInput.value);
    const stopType = stopCountRadio.checked ? "count" : stopTimeRadio.checked ? "time" : "none";
    const stopCount = Number(stopCountInput.value);
    const stopMinutes = Number(stopTimeInput.value);
    const alwaysActive = alwaysActiveCheck.checked;
    const mouseJiggler = mouseJigglerCheck.checked;
    const scheduledStart = scheduledStartCheck.checked;
    const scheduledStartTime = scheduledStartTimeInput.value;

    saveSettings(mode, interval, min, max, stopType, stopCount, stopMinutes, alwaysActive, mouseJiggler, scheduledStart, scheduledStartTime);
  }

  let saveDebounceId = null;
  function debouncedSave() {
    if (saveDebounceId) clearTimeout(saveDebounceId);
    saveDebounceId = setTimeout(() => {
      saveDebounceId = null;
      saveSettingsFromForm();
    }, 300);
  }

  modeFixedRadio.addEventListener("change", () => { updateModeVisibility(); debouncedSave(); });
  modeRandomRadio.addEventListener("change", () => { updateModeVisibility(); debouncedSave(); });

  [fixedInput, randomMinInput, randomMaxInput].forEach((el) => {
    el.addEventListener("input", () => { validateInputs(); debouncedSave(); });
    el.addEventListener("change", debouncedSave);
  });

  [stopNoneRadio, stopCountRadio, stopTimeRadio].forEach((r) => {
    r.addEventListener("change", () => { updateStopVisibility(); debouncedSave(); });
  });
  [stopCountInput, stopTimeInput].forEach((el) => {
    el.addEventListener("input", () => { validateInputs(); debouncedSave(); });
    el.addEventListener("change", debouncedSave);
  });

  alwaysActiveCheck.addEventListener("change", debouncedSave);
  mouseJigglerCheck.addEventListener("change", debouncedSave);

  scheduledStartCheck.addEventListener("change", () => { updateStartVisibility(); debouncedSave(); });
  scheduledStartTimeInput.addEventListener("input", () => { updateStartVisibility(); debouncedSave(); });


  startSelectBtn.addEventListener("click", () => {
    if (!validateInputs()) return;

    saveSettingsFromForm();

    const mode = modeFixedRadio.checked ? "fixed" : "random";
    const interval = Number(fixedInput.value);
    const min = Number(randomMinInput.value);
    const max = Number(randomMaxInput.value);

    const payload = { mode };
    if (mode === "fixed") payload.interval = interval;
    else {
      payload.min = min;
      payload.max = max;
    }
    const stopType = stopCountRadio.checked ? "count" : stopTimeRadio.checked ? "time" : "none";
    if (stopType === "count") {
      payload.stopCondition = { type: "count", count: Math.floor(Number(stopCountInput.value)) };
    } else if (stopType === "time") {
      payload.stopCondition = { type: "time", minutes: Number(stopTimeInput.value) };
    } else {
      payload.stopCondition = { type: "none" };
    }

    // Pass Mouse Jiggler setting
    payload.mouseJiggler = mouseJigglerCheck.checked;

    // Handle Scheduled Start
    if (scheduledStartCheck.checked && scheduledStartTimeInput.value) {
      const now = new Date();
      const [h, m] = scheduledStartTimeInput.value.split(":").map(Number);
      let target = new Date(now);
      target.setHours(h, m, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);

      payload.scheduledStartTimestamp = target.getTime();
      // We don't set state to "scheduled" here yet, because we still need to SELECT the target.
      // After selection, content.js will tell us it is "scheduled" (waiting).
      // However, visually we might want to indicate...
      // Actually, standard flow: "Selecting" -> (Click) -> "Scheduled/Waiting" -> "Running"
    }

    setState("selecting");

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        setState("idle");
        return;
      }
      chrome.tabs.sendMessage(
        tab.id,
        { type: "startSelection", payload },
        (response) => {
          if (chrome.runtime.lastError) {
            statusText.textContent = "ステータス: エラー（このタブでは動作しない可能性があります）";
            cancelBtn.classList.remove("hidden");
            return;
          }
          // if scheduled, content script will handle waiting?
          // Actually, content script logic for selection should probably be immediate,
          // and then it waits to CLICK.
          // BUT, if we want to "Schedule Start", usually we want to "Select Target NOW"
          // and then "Start Clicking LATER".
          // So "Selecting" state happens first. Then "Running" (or "Waiting to Run").
        }
      );
    });
  });

  stopBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        setState("idle");
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: "stopAutoClick" });
    });
    setState("idle");
  });

  cancelBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        setState("idle");
        return;
      }
      chrome.tabs.sendMessage(tab.id, { type: "cancelSelection" });
    });
    setState("idle");
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "statusUpdate") return;
    const { state, nextDelaySec, linkTargetWarning } = message;

    // state from content: "idle", "selecting", "running", "scheduled"

    if (state === "running") {
      if (currentState === "running") {
        updateRunningStatus(nextDelaySec);
      } else {
        setState("running", nextDelaySec);
      }
      if (linkTargetWarning) linkWarn.classList.remove("hidden");
    } else if (state === "idle") {
      setState("idle");
    } else if (state === "selecting") {
      setState("selecting");
    } else if (state === "scheduled") {
       setState("scheduled");
       // Update text with remaining time if provided?
       if (typeof nextDelaySec === 'number') {
         const sec = Math.ceil(nextDelaySec);
         statusText.textContent = `ステータス: 開始待ち... (あと${sec}秒)`;
       }
    }
  });

  // Init
  updateModeVisibility();
  updateStopVisibility();
  updateStartVisibility();
  loadSavedSettings();
})();
