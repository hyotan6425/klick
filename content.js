(() => {
  // --- A. Injection Phase (Inject Phase) ---
  chrome.storage.local.get(["alwaysActive", "userAgent"], (data) => {
    if (data.alwaysActive || (data.userAgent && data.userAgent !== "default")) {
      injectStealthScript(data.alwaysActive, data.userAgent);
    }
  });

  function injectStealthScript(antiBlur, userAgent) {
    const script = document.createElement("script");
    let code = `(() => {`;

    // 1. Anti-Blur (Always Active)
    if (antiBlur) {
      code += `
        const overwriteProp = (obj, prop, value) => {
          Object.defineProperty(obj, prop, { get: () => value, configurable: true });
        };
        overwriteProp(document, 'visibilityState', 'visible');
        overwriteProp(document, 'hidden', false);
        document.hasFocus = () => true;

        const blockEvent = (e) => { e.stopImmediatePropagation(); e.stopPropagation(); };
        ['visibilitychange', 'webkitvisibilitychange', 'blur', 'mouseleave'].forEach(evt => {
          window.addEventListener(evt, blockEvent, true);
        });
        console.log('[FlexiClicker] Anti-Blur activated.');
      `;
    }

    // 2. UA Spoofing
    if (userAgent && userAgent !== "default") {
      let ua = "", platform = "", maxTouchPoints = 0;
      if (userAgent === "iphone") {
        ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";
        platform = "iPhone";
        maxTouchPoints = 5;
      } else if (userAgent === "android") {
        ua = "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36";
        platform = "Linux armv8l"; // Typical for Android
        maxTouchPoints = 5;
      }

      if (ua) {
        code += `
          Object.defineProperty(navigator, 'userAgent', { get: () => '${ua}', configurable: true });
          Object.defineProperty(navigator, 'platform', { get: () => '${platform}', configurable: true });
          Object.defineProperty(navigator, 'maxTouchPoints', { get: () => ${maxTouchPoints}, configurable: true });
          console.log('[FlexiClicker] UA spoofed to ${userAgent}.');
        `;
      }
    }

    code += `})();`;
    script.textContent = code;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  // --- Runtime Variables ---
  let selectionMode = false;
  let running = false;

  let targetElement = null;
  let clickTimerId = null;
  let jigglerTimerId = null;
  let scrollTimerId = null;
  let safetyTimerId = null;

  // Current Configuration
  let currentConfig = null;
  /*
    currentConfig structure:
    {
      mode: 'fixed'|'random',
      interval, min, max,
      stopCondition: { type, count, minutes },
      stealth: { mouseJiggler, autoScroll },
      safety: { captchaAlert, captchaSound }
    }
  */

  let clickCount = 0;
  let runStartTime = 0;

  // Visual Overlays
  let hoverOverlay = null;

  // --- Helper Functions ---

  function stopAll() {
    selectionMode = false;
    running = false;
    targetElement = null;
    currentConfig = null;
    clickCount = 0;
    runStartTime = 0;

    // Clear all timers
    if (clickTimerId) { clearTimeout(clickTimerId); clickTimerId = null; }
    if (jigglerTimerId) { clearInterval(jigglerTimerId); jigglerTimerId = null; }
    if (scrollTimerId) { clearInterval(scrollTimerId); scrollTimerId = null; }
    if (safetyTimerId) { clearInterval(safetyTimerId); safetyTimerId = null; }

    clearOverlay();
    removeNavListeners();
    window.removeEventListener("mouseover", handleMouseOver, true);
    window.removeEventListener("click", handleSelectClick, true);

    sendStatus("idle");
  }

  function sendStatus(state, nextDelaySec, extra = {}) {
    chrome.runtime.sendMessage(
      { type: "statusUpdate", state, nextDelaySec, ...extra },
      () => void chrome.runtime.lastError
    );
  }

  function randomInRange(min, max) {
    return min + Math.random() * (max - min);
  }

  // --- B. Runtime Loop Phase (Runtime Loop) ---

  // 1. Click Logic
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

    // Throttle status updates to prevent message flooding on fast intervals
    if (delayMs > 100 || clickCount % 10 === 0) {
        const linkWarn = clickCount === 0 && isLinkTarget(targetElement);
        sendStatus("running", delaySec, linkWarn ? { linkTargetWarning: true } : {});
    }

    if (clickTimerId) clearTimeout(clickTimerId);

    // For extremely fast intervals, we use a more direct approach to minimize overhead
    clickTimerId = setTimeout(performClick, delayMs);
  }

  function performClick() {
    if (!running || !targetElement) return;

    // Lightweight checks for speed
    // Only check safety here if interval is long enough, otherwise rely on the independent watcher
    // But safety first? No, for speed, rely on the 500ms watcher loop.

    if (checkStopCondition()) {
      stopAll();
      return;
    }

    try {
      // Direct click for speed if interval is super short (< 10ms)
      if (currentConfig.mode === "fixed" && currentConfig.interval < 0.01) {
          targetElement.click();
      } else {
          humanLikeClick(targetElement);
      }

      // Reduce visual overhead for fast clicking
      if (currentConfig.mode !== "fixed" || currentConfig.interval >= 0.05) {
          flashElement(targetElement);
      }

      clickCount += 1;
    } catch (e) {
      console.warn("[FlexiClicker] Click failed", e);
      stopAll();
      return;
    }

    if (checkStopCondition()) {
      stopAll();
      return;
    }

    scheduleNextClick();
  }

  function humanLikeClick(el) {
    if (!el || !el.isConnected) return;
    const rect = el.getBoundingClientRect();
    const w = Math.max(rect.width, 1);
    const h = Math.max(rect.height, 1);
    // Slight randomness in click position
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

  function checkStopCondition() {
    const sc = currentConfig.stopCondition;
    if (!sc || sc.type === "none") return false;

    if (sc.type === "count" && sc.count > 0 && clickCount >= sc.count) return true;
    if (sc.type === "time" && sc.minutes > 0) {
      const elapsed = (Date.now() - runStartTime) / 60000;
      if (elapsed >= sc.minutes) return true;
    }
    return false;
  }

  function isLinkTarget(el) {
    if (!el) return false;
    return (el.tagName === "A" && el.href) || !!el.closest("a[href]");
  }

  // 2. Mouse Jiggler
  function startJiggler() {
    if (jigglerTimerId) return;
    jigglerTimerId = setInterval(() => {
      // Dispatch random mousemove
      const x = window.innerWidth / 2 + (Math.random() * 20 - 10);
      const y = window.innerHeight / 2 + (Math.random() * 20 - 10);
      document.dispatchEvent(new MouseEvent('mousemove', {
        view: window, bubbles: true, cancelable: true, clientX: x, clientY: y
      }));
    }, 2000 + Math.random() * 8000); // 2~10s random
  }

  // 3. Human-like Scroll
  function startAutoScroll() {
    if (scrollTimerId) return;
    scrollTimerId = setInterval(() => {
      // Scroll by small random amount
      const dy = Math.floor(Math.random() * 300) - 100; // mostly down (-100 to +200)
      window.scrollBy({ top: dy, behavior: 'smooth' });
    }, 5000 + Math.random() * 15000); // 5~20s random
  }

  // --- C. Watcher Phase (Safety Watcher) ---

  function checkSafety() {
    const dangerSelectors = [
      'iframe[src*="recaptcha"]',
      'iframe[src*="turnstile"]',
      'iframe[src*="hcaptcha"]',
      '#captcha-box',
      '.g-recaptcha',
      '.h-captcha' // Added from common knowledge
    ];

    let detected = false;
    for (const sel of dangerSelectors) {
      if (document.querySelector(sel)) {
        detected = true;
        break;
      }
    }

    if (detected) {
      console.warn("[FlexiClicker] CAPTCHA DETECTED! Stopping.");
      const soundEnabled = currentConfig.safety?.captchaSound !== false; // Default true
      stopAll();
      if (soundEnabled) playAlertSound();
      alert("⚠️ CAPTCHA DETECTED! Stopping auto-clicker.");
      return true;
    }
    return false;
  }

  // Also run safety check periodically independent of clicks
  function startSafetyWatcher() {
    if (safetyTimerId) return;
    // Check more frequently (500ms) to stop immediately upon detection
    safetyTimerId = setInterval(() => {
      checkSafety();
    }, 500);
  }

  function playAlertSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) { console.error(e); }
  }


  // --- Event & Interaction Handling ---

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
    if (!selectionMode || !el) return;
    const rect = el.getBoundingClientRect();
    const overlay = ensureOverlay();
    Object.assign(overlay.style, {
      top: `${window.scrollY + rect.top - 2}px`,
      left: `${window.scrollX + rect.left - 2}px`,
      width: `${Math.max(rect.width, 1) + 4}px`,
      height: `${Math.max(rect.height, 1) + 4}px`,
      display: "block",
    });
  }

  function hideOverlay() {
    if (hoverOverlay) hoverOverlay.style.display = "none";
  }

  function clearOverlay() {
    if (hoverOverlay) hoverOverlay.remove();
    hoverOverlay = null;
  }

  function handleMouseOver(e) {
    if (!selectionMode) return;
    updateOverlayForElement(e.target);
  }

  function handleSelectClick(e) {
    if (!selectionMode) return;
    e.preventDefault();
    e.stopPropagation();

    const el = e.target;
    if (!(el instanceof Element)) return;

    selectionMode = false;
    targetElement = el;
    clickCount = 0;
    runStartTime = Date.now();

    window.removeEventListener("mouseover", handleMouseOver, true);
    window.removeEventListener("click", handleSelectClick, true);
    hideOverlay();
    addNavListeners();

    running = true;

    // Start Extras
    if (currentConfig.stealth?.mouseJiggler) startJiggler();
    if (currentConfig.stealth?.autoScroll) startAutoScroll();
    if (currentConfig.safety?.captchaAlert) startSafetyWatcher();

    scheduleNextClick();
  }

  // Navigation listener to stop on unload
  let navListenersAdded = false;
  function onNavUnload() { stopAll(); }
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

  // --- Message Listener ---
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== "object") return;

    if (message.type === "startSelection") {
      const payload = message.payload || {};
      // Validate minimal payload
      if (!payload.mode) {
        sendResponse?.({ ok: false });
        return;
      }

      stopAll(); // Ensure clean state

      currentConfig = {
        mode: payload.mode,
        interval: payload.interval,
        min: payload.min,
        max: payload.max,
        stopCondition: payload.stopCondition,
        stealth: payload.stealth, // { mouseJiggler, autoScroll }
        safety: payload.safety    // { captchaAlert, captchaSound }
      };

      selectionMode = true;
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
      stopAll();
      sendResponse?.({ ok: true });
      return true;
    }

    // --- 新規: パニックリセット対応 ---
    if (message.type === "panicClean") {
      stopAll(); // まず動作を停止
      console.log("[FlexiClicker] PANIC RESET: Reloading to clear traces...");

      // 非同期で少し待ってからリロード (処理落ち防止)
      setTimeout(() => {
        location.reload();
      }, 50);

      sendResponse?.({ ok: true });
      return true;
    }
  });

})();
