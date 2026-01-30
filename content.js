(() => {
  chrome.storage.local.get("alwaysActive", (data) => {
    if (data.alwaysActive) {
      injectAntiBlurScript();
    }
  });

  function injectAntiBlurScript() {
    const script = document.createElement("script");
    script.textContent = `
      (() => {
        Object.defineProperty(document, 'visibilityState', {
          get: () => 'visible',
          configurable: true
        });

        Object.defineProperty(document, 'hidden', {
          get: () => false,
          configurable: true
        });

        const originalHasFocus = document.hasFocus;
        document.hasFocus = () => true;

        const blockEvent = (e) => {
          e.stopImmediatePropagation();
          e.stopPropagation();
        };

        window.addEventListener('visibilitychange', blockEvent, true);
        window.addEventListener('webkitvisibilitychange', blockEvent, true);
        window.addEventListener('blur', blockEvent, true);
        window.addEventListener('mouseleave', blockEvent, true);

        console.log('[FlexiClicker] Anti-Blur mode activated.');
      })();
    `;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  let selectionMode = false;
  let running = false;
  let targetElement = null;
  let timerId = null;
  let currentConfig = null; // { mode, interval | min/max, stopCondition? }
  let clickCount = 0;
  let runStartTime = 0;

  let hoverOverlay = null;
  let lastHoveredElement = null;

  let navListenersAdded = false;

  function onNavUnload() {
    stopAll();
  }

  function addNavListeners() {
    if (navListenersAdded) return;
    navListenersAdded = true;
    window.addEventListener("beforeunload", onNavUnload);
    window.addEventListener("pagehide", onNavUnload);
  }

  function removeNavListeners() {
    if (!navListenersAdded) return;
    navListenersAdded = false;
    window.removeEventListener("beforeunload", onNavUnload);
    window.removeEventListener("pagehide", onNavUnload);
  }

  function isLinkTarget(el) {
    if (!el || !(el instanceof Element)) return false;
    const a = el.closest ? el.closest("a[href]") : null;
    if (a) return true;
    return el.tagName === "A" && el.href;
  }

  function ensureOverlay() {
    if (hoverOverlay && hoverOverlay.isConnected) return hoverOverlay;
    hoverOverlay = document.createElement("div");
    hoverOverlay.id = "__flexiclicker_overlay__";
    Object.assign(hoverOverlay.style, {
      position: "absolute",
      pointerEvents: "none",
      border: "2px solid #ef4444",
      borderRadius: "4px",
      boxShadow: "0 0 0 2px rgba(248, 113, 113, 0.4)",
      zIndex: "2147483647",
      transition: "all 0.05s ease",
    });
    document.documentElement.appendChild(hoverOverlay);
    return hoverOverlay;
  }

  function updateOverlayForElement(el) {
    if (!selectionMode) return;
    if (!el || !(el instanceof Element)) return;
    const rect = el.getBoundingClientRect();
    const overlay = ensureOverlay();
    Object.assign(overlay.style, {
      top: `${window.scrollY + rect.top - 2}px`,
      left: `${window.scrollX + rect.left - 2}px`,
      width: `${Math.max(rect.width, 1) + 4}px`,
      height: `${Math.max(rect.height, 1) + 4}px`,
      display: "block",
    });
    lastHoveredElement = el;
  }

  function hideOverlay() {
    if (hoverOverlay) {
      hoverOverlay.style.display = "none";
    }
  }

  function clearOverlay() {
    if (hoverOverlay && hoverOverlay.isConnected) {
      hoverOverlay.remove();
    }
    hoverOverlay = null;
    lastHoveredElement = null;
  }

  function cancelTimer() {
    if (timerId != null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  function stopAll() {
    selectionMode = false;
    running = false;
    targetElement = null;
    currentConfig = null;
    clickCount = 0;
    runStartTime = 0;
    cancelTimer();
    clearOverlay();
    removeNavListeners();
    window.removeEventListener("mouseover", handleMouseOver, true);
    window.removeEventListener("click", handleSelectClick, true);
    sendStatus("idle");
  }

  function checkStopCondition() {
    if (!currentConfig?.stopCondition || currentConfig.stopCondition.type === "none") return false;
    const sc = currentConfig.stopCondition;
    if (sc.type === "count" && typeof sc.count === "number" && sc.count > 0 && clickCount >= sc.count) return true;
    if (sc.type === "time" && typeof sc.minutes === "number" && sc.minutes > 0) {
      const elapsed = (Date.now() - runStartTime) / 60000;
      if (elapsed >= sc.minutes) return true;
    }
    return false;
  }

  function randomInRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function flashElement(el) {
    if (!el || !el.isConnected) return;
    const rect = el.getBoundingClientRect();
    const flash = document.createElement("div");
    flash.className = "__flexiclicker_flash__";
    Object.assign(flash.style, {
      position: "fixed",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${Math.max(rect.width, 1)}px`,
      height: `${Math.max(rect.height, 1)}px`,
      pointerEvents: "none",
      zIndex: "2147483646",
      boxShadow: "inset 0 0 0 2px rgba(34, 211, 238, 0.9), 0 0 20px 4px rgba(34, 211, 238, 0.6)",
      background: "rgba(34, 211, 238, 0.2)",
      borderRadius: "4px",
    });
    document.documentElement.appendChild(flash);
    setTimeout(() => flash.remove(), 120);
  }

  function humanLikeClick(el) {
    if (!el || !el.isConnected) return;
    const rect = el.getBoundingClientRect();
    const w = Math.max(rect.width, 1);
    const h = Math.max(rect.height, 1);
    const marginX = Math.max(1, Math.floor(w * 0.15));
    const marginY = Math.max(1, Math.floor(h * 0.15));
    const cx = rect.left + w / 2;
    const cy = rect.top + h / 2;
    const x = cx + randomInRange(-marginX, marginX);
    const y = cy + randomInRange(-marginY, marginY);
    const base = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y, button: 0 };
    el.dispatchEvent(new MouseEvent("mousedown", { ...base, buttons: 1 }));
    el.dispatchEvent(new MouseEvent("mouseup", { ...base, buttons: 0 }));
    el.dispatchEvent(new MouseEvent("click", { ...base, buttons: 0, detail: 1 }));
  }

  function scheduleNextClick() {
    if (!running || !targetElement || !currentConfig) {
      stopAll();
      return;
    }

    let delaySec;
    if (currentConfig.mode === "fixed") {
      delaySec = currentConfig.interval;
    } else {
      delaySec = randomInRange(currentConfig.min, currentConfig.max);
    }

    const delayMs = delaySec * 1000;
    const linkWarn = clickCount === 0 && isLinkTarget(targetElement);
    sendStatus("running", delaySec, linkWarn ? { linkTargetWarning: true } : {});

    cancelTimer();
    timerId = setTimeout(() => {
      if (!running || !targetElement || !currentConfig) {
        stopAll();
        return;
      }
      if (checkStopCondition()) {
        stopAll();
        return;
      }
      try {
        humanLikeClick(targetElement);
        flashElement(targetElement);
        clickCount += 1;
      } catch (e) {
        console.warn("[FlexiClicker] click error", e);
        stopAll();
        return;
      }
      if (checkStopCondition()) {
        stopAll();
        return;
      }
      scheduleNextClick();
    }, delayMs);
  }

  function sendStatus(state, nextDelaySec, extra = {}) {
    chrome.runtime.sendMessage(
      { type: "statusUpdate", state, nextDelaySec, ...extra },
      () => {
        void chrome.runtime.lastError;
      }
    );
  }

  function handleMouseOver(e) {
    if (!selectionMode) return;
    const el = e.target;
    updateOverlayForElement(el);
  }

  function handleSelectClick(e) {
    if (!selectionMode) return;
    e.preventDefault();
    e.stopPropagation();

    const el = e.target;
    if (!(el instanceof Element)) {
      return;
    }

    selectionMode = false;
    targetElement = el;
    running = true;
    clickCount = 0;
    runStartTime = Date.now();

    window.removeEventListener("mouseover", handleMouseOver, true);
    window.removeEventListener("click", handleSelectClick, true);

    hideOverlay();
    addNavListeners();
    scheduleNextClick();
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== "object") return;

    if (message.type === "startSelection") {
      const payload = message.payload || {};
      const { mode, interval, min, max, stopCondition } = payload;

      if (!(mode === "fixed" || mode === "random")) {
        sendResponse?.({ ok: false });
        return;
      }

      if (mode === "fixed" && !(interval > 0)) {
        sendResponse?.({ ok: false });
        return;
      }
      if (
        mode === "random" &&
        !(min > 0 && max > 0 && min <= max)
      ) {
        sendResponse?.({ ok: false });
        return;
      }

      let sc = { type: "none" };
      if (stopCondition && typeof stopCondition === "object") {
        if (stopCondition.type === "count" && typeof stopCondition.count === "number" && stopCondition.count > 0) {
          sc = { type: "count", count: Math.floor(stopCondition.count) };
        } else if (stopCondition.type === "time" && typeof stopCondition.minutes === "number" && stopCondition.minutes > 0) {
          sc = { type: "time", minutes: stopCondition.minutes };
        }
      }

      cancelTimer();
      selectionMode = true;
      running = false;
      targetElement = null;
      currentConfig =
        mode === "fixed"
          ? { mode, interval: Number(interval), stopCondition: sc }
          : { mode, min: Number(min), max: Number(max), stopCondition: sc };

      window.addEventListener("mouseover", handleMouseOver, true);
      window.addEventListener("click", handleSelectClick, true);

      sendStatus("selecting");
      sendResponse?.({ ok: true });
      return true;
    }

    if (message.type === "stopAutoClick") {
      stopAll();
      sendResponse?.({ ok: true });
      return true;
    }

    if (message.type === "cancelSelection") {
      if (selectionMode) {
        selectionMode = false;
        running = false;
        targetElement = null;
        currentConfig = null;
        cancelTimer();
        clearOverlay();
        removeNavListeners();
        window.removeEventListener("mouseover", handleMouseOver, true);
        window.removeEventListener("click", handleSelectClick, true);
        sendStatus("idle");
      }
      sendResponse?.({ ok: true });
      return true;
    }
  });
})();

