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

  // Stealth
  const alwaysActiveCheck = document.getElementById("always-active-check");
  const mouseJigglerCheck = document.getElementById("mouse-jiggler-check");
  const autoScrollCheck = document.getElementById("auto-scroll-check");
  const userAgentSelect = document.getElementById("user-agent-select");

  // Safety
  const captchaAlertCheck = document.getElementById("captcha-alert-check");
  const captchaSoundCheck = document.getElementById("captcha-sound-check");
  const captchaSoundField = document.getElementById("captcha-sound-field");

  // Elements (新規追加: 緊急ボタン)
  const globalStopBtn = document.getElementById("global-stop-btn");
  const panicResetBtn = document.getElementById("panic-reset-btn");

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

  function updateSafetyVisibility() {
    captchaSoundField.style.display = captchaAlertCheck.checked ? "block" : "none";
    debouncedSave();
  }

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
        "autoScroll",
        "userAgent",
        "captchaAlert",
        "captchaSound"
      ],
      (data) => {
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

        // Stealth
        if (data.alwaysActive === true) alwaysActiveCheck.checked = true;
        if (data.mouseJiggler === true) mouseJigglerCheck.checked = true;
        if (data.autoScroll === true) autoScrollCheck.checked = true;
        if (data.userAgent) userAgentSelect.value = data.userAgent;

        // Safety
        if (data.captchaAlert === true) captchaAlertCheck.checked = true;
        if (data.captchaSound === false) captchaSoundCheck.checked = false; // Default true, so check explicit false

        updateModeVisibility();
        updateStopVisibility();
        updateSafetyVisibility();
        validateInputs();
      }
    );
  }

  function saveSettings(mode, interval, min, max, stopType, stopCount, stopMinutes, alwaysActive, mouseJiggler, autoScroll, userAgent, captchaAlert, captchaSound) {
    const o = { mode };
    if (mode === "fixed") o.fixedInterval = interval;
    else {
      o.randomMin = min;
      o.randomMax = max;
    }
    o.stopType = stopType ?? "none";
    if (stopType === "count" && typeof stopCount === "number") o.stopCount = stopCount;
    if (stopType === "time" && typeof stopMinutes === "number") o.stopMinutes = stopMinutes;

    // Stealth
    o.alwaysActive = alwaysActive;
    o.mouseJiggler = mouseJiggler;
    o.autoScroll = autoScroll;
    o.userAgent = userAgent;

    // Safety
    o.captchaAlert = captchaAlert;
    o.captchaSound = captchaSound;

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
    const autoScroll = autoScrollCheck.checked;
    const userAgent = userAgentSelect.value;

    const captchaAlert = captchaAlertCheck.checked;
    const captchaSound = captchaSoundCheck.checked;

    saveSettings(mode, interval, min, max, stopType, stopCount, stopMinutes, alwaysActive, mouseJiggler, autoScroll, userAgent, captchaAlert, captchaSound);
  }

  let saveDebounceId = null;
  function debouncedSave() {
    if (saveDebounceId) clearTimeout(saveDebounceId);
    saveDebounceId = setTimeout(() => {
      saveDebounceId = null;
      saveSettingsFromForm();
    }, 300);
  }

  // Event Listeners
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
  autoScrollCheck.addEventListener("change", debouncedSave);
  userAgentSelect.addEventListener("change", debouncedSave);

  captchaAlertCheck.addEventListener("change", updateSafetyVisibility);
  captchaSoundCheck.addEventListener("change", debouncedSave);

  // --- イベントリスナー (新規: 緊急停止ボタン) ---

  // A. 全タブ停止 (Stop All Tabs)
  globalStopBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "globalStop" });
    setState("idle");
    statusText.textContent = "ステータス: 全タブ停止信号を送信しました";
  });

  // B. パニック・リセット (Panic Reset)
  panicResetBtn.addEventListener("click", () => {
    if (!confirm("【警告】\n全設定をOFFにして全ページをリロードしますか？\n偽装スクリプト等の痕跡が消去されます。")) {
      return;
    }

    // UIを即座にOFF状態にする
    alwaysActiveCheck.checked = false;
    mouseJigglerCheck.checked = false;
    autoScrollCheck.checked = false;
    userAgentSelect.value = "default";

    // Backgroundへ指令 (Background側でstorageクリアとリロード指令を行う)
    chrome.runtime.sendMessage({ type: "globalPanic" });

    setState("idle");
    statusText.textContent = "ステータス: 完全リセットを実行しました";
  });


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

    // Pass Stealth & Safety settings
    payload.stealth = {
      mouseJiggler: mouseJigglerCheck.checked,
      autoScroll: autoScrollCheck.checked
    };
    payload.safety = {
      captchaAlert: captchaAlertCheck.checked,
      captchaSound: captchaSoundCheck.checked
    };

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
    }
  });

  // Init
  updateModeVisibility();
  updateStopVisibility();
  updateSafetyVisibility();
  loadSavedSettings();
})();
