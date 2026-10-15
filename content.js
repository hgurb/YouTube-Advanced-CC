(() => {
  "use strict";
  const instanceKey = Symbol.for("youtube-native-cc-menu.initialized");
  if (window[instanceKey]) return;
  window[instanceKey] = true;

  const buttonSelector = ".ytp-subtitles-button";
  const playerSelector = ".html5-video-player";
  const sizePercentages = [50, 75, 100, 150, 200, 300, 400];
  const errors = new WeakMap();
  const states = new WeakMap();
  let refreshTimer;

  function updateLabel(button, player) {
    const state = states.get(button);
    if (!state) return;
    // YouTube can redraw a button's contents without replacing the button.
    if (state.label.parentNode !== button) button.append(state.label);
    let size;
    try {
      const settings = player.getSubtitlesUserSettings?.();
      if (settings) size = sizePercentages[(settings.fontSizeIncrement ?? 0) + 2];
    } catch { /* Captions may still be loading. */ }
    const text = `Size (${size ? `${size}%` : "—"})`;
    if (state.label.textContent !== text) state.label.textContent = text;
  }
  function reportError(player, text) {
    // Failures go to the console without visual popups.
    errors.set(player, text);
    console.warn(`[YouTube Native CC] ${text}`);
  }

  function resetSubtitles(player) {
    errors.delete(player);
    // This is YouTube's native reset: it restores the current defaults,
    // persists them, redraws captions, and notifies the settings menu.
    // Calling setOption("captions", "fontSize", 0) would only reset size.
    if (typeof player.resetSubtitlesUserSettings !== "function") {
      reportError(player, "Subtitle reset is unavailable. Refresh YouTube and try again.");
      return;
    }

    try {
      if (
        typeof player.getSubtitlesUserSettings === "function" &&
        player.getSubtitlesUserSettings() == null
      ) {
        reportError(player, "Turn CC on for this video, then try resetting again.");
        return;
      }

      player.resetSubtitlesUserSettings();
    } catch (error) {
      // A player can exist before its captions module has finished loading.
      console.warn("[YouTube Native CC] The player could not reset subtitles.", error);
      reportError(player, "Captions aren't ready. Turn CC on and try again.");
    }
  }

  function resizeSubtitles(player, direction) {
    errors.delete(player);
    try {
      if (
        typeof player.getSubtitlesUserSettings !== "function" ||
        typeof player.updateSubtitlesUserSettings !== "function"
      ) {
        reportError(player, "Subtitle sizing is unavailable. Refresh YouTube and try again.");
        return;
      }
      const settings = player.getSubtitlesUserSettings();
      if (!settings) {
        reportError(player, "Turn CC on for this video, then try resizing again.");
        return;
      }
      const current = settings.fontSizeIncrement ?? 0;
      if (!Number.isFinite(current)) throw new Error("Unknown subtitle size");
      const step = direction > 0 ? Math.floor(current) + 1 : Math.ceil(current) - 1;
      const next = Math.max(-2, Math.min(4, step));
      if (next !== current) {
        // Same native update as the Font size menu: preserve other appearance
        // settings, redraw captions, and let YouTube persist the change.
        player.updateSubtitlesUserSettings({ fontSizeIncrement: next });
        if (player.getSubtitlesUserSettings()?.fontSizeIncrement !== next) {
          throw new Error("YouTube did not apply the subtitle size");
        }
      }
    } catch (error) {
      console.warn("[YouTube Native CC] The player could not resize subtitles.", error);
      reportError(player, "Couldn't resize subtitles. Wait for CC to load and try again.");
    }
  }

  function enhanceButton(button) {
    const player = button.closest(playerSelector);
    if (!player) return;
    if (states.has(button)) {
      updateLabel(button, player);
      return;
    }
    const label = document.createElement("span");
    label.className = "ytcc-native-size-label";
    label.setAttribute("aria-hidden", "true");
    const state = { label, delta: 0, time: 0 };
    states.set(button, state);
    button.classList.add("ytcc-native-control");
    button.append(label);
    const clearWheel = () => { state.delta = 0; state.time = 0; };
    button.addEventListener("pointerenter", () => updateLabel(button, player));
    button.addEventListener("focus", () => updateLabel(button, player));
    button.addEventListener("pointerleave", clearWheel);
    button.addEventListener("blur", clearWheel);
    // No click or keyboard interception: YouTube owns toggling and its icon.
    updateLabel(button, player);
  }

  function targetButton(event) {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest(buttonSelector);
    if (!button?.closest(playerSelector)) return;
    // Also handle newly replaced controls before the observer has refreshed.
    enhanceButton(button);
    return button;
  }

  // Intercept before Enhancer's player-level capture handlers. Events anywhere
  // other than the native CC button continue to behave normally.
  window.addEventListener("wheel", (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey ||
        event.altKey || event.shiftKey || !event.deltaY ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const button = targetButton(event);
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (button.disabled || button.getAttribute("aria-disabled") === "true") return;
    const state = states.get(button);
    const delta = event.deltaY * (event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? 120 : 1);
    if (event.timeStamp - state.time > 250 || Math.sign(delta) !== Math.sign(state.delta)) state.delta = 0;
    state.time = event.timeStamp;
    state.delta += delta;
    if (Math.abs(state.delta) < 40) return;
    const player = button.closest(playerSelector);
    resizeSubtitles(player, state.delta < 0 ? 1 : -1);
    state.delta = 0;
    updateLabel(button, player);
  }, { capture: true, passive: false });

  const menuSessions = new WeakMap();
  const openingMenus = new WeakSet();
  const normalize = text => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/ı/g, "i").replace(/\s+/g, " ").trim();
  const isCaptionTitle = text => /^(subtitles(?:\s*\/\s*cc)?|captions|altyazilar(?:\s*\/\s*cc)?)(?:\s|$|\()/.test(normalize(text));
  const visible = element => Boolean(element?.isConnected && element.getClientRects().length && getComputedStyle(element).visibility !== "hidden");
  function menuFor(player) {
    return [...player.querySelectorAll(".ytp-settings-menu")].find(visible);
  }
  function captionPanel(menu) {
    return [...menu.querySelectorAll(".ytp-panel")].find(panel => {
      if (!visible(panel)) return false;
      const title = panel.querySelector(".ytp-panel-title")?.textContent || "";
      return isCaptionTitle(title) || /^(auto-translate|auto translate|otomatik ceviri)$/.test(normalize(title));
    });
  }
  function sortLanguages(menu) {
    const panel = captionPanel(menu);
    const list = panel?.querySelector(".ytp-panel-menu");
    if (!list) return;
    const rows = [...list.children].filter(row => row.matches(".ytp-menuitem"));
    const bucket = row => {
      const text = normalize(row.querySelector(".ytp-menuitem-label")?.textContent || row.textContent);
      if (/^(off|kapali)$/.test(text)) return 0;
      return /english|ingilizce|turkish|turkce/.test(text) ? 1 : 2;
    };
    const ordered = [...rows].sort((a, b) => bucket(a) - bucket(b));
    if (ordered.every((row, index) => row === rows[index])) return;
    const focused = document.activeElement;
    // Move the original nodes so their native selection handlers stay attached.
    let cursor = list.firstElementChild;
    for (const row of ordered) {
      if (row !== cursor) {
        if (typeof list.moveBefore === "function") list.moveBefore(row, cursor);
        else list.insertBefore(row, cursor);
      }
      cursor = row.nextElementSibling;
    }
    if (focused instanceof HTMLElement && list.contains(focused) && document.activeElement !== focused) focused.focus({preventScroll:true});
  }
  function watchMenu(player, menu) {
    menuSessions.get(player)?.();
    let frame;
    const stop = () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      document.removeEventListener("yt-navigate-finish", stop);
      if (menuSessions.get(player) === stop) menuSessions.delete(player);
    };
    const update = () => {
      frame = undefined;
      if (!visible(menu)) { stop(); return; }
      sortLanguages(menu);
    };
    const observer = new MutationObserver(() => {
      if (frame === undefined) frame = requestAnimationFrame(update);
    });
    menuSessions.set(player, stop);
    observer.observe(menu, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:["style", "hidden", "aria-hidden"]});
    document.addEventListener("yt-navigate-finish", stop);
    sortLanguages(menu);
  }
  function waitForMenu(player, predicate) {
    return new Promise(resolve => {
      let timer;
      const finish = value => { clearTimeout(timer); observer.disconnect(); resolve(value); };
      const check = () => {
        const menu = menuFor(player);
        if (menu && predicate(menu)) finish(menu);
      };
      const observer = new MutationObserver(check);
      observer.observe(player, {childList:true, subtree:true, attributes:true, attributeFilter:["style", "hidden", "aria-hidden"]});
      timer = setTimeout(() => finish(null), 1200);
      check();
    });
  }
  async function openCaptionMenu(player) {
    if (openingMenus.has(player)) return;
    openingMenus.add(player);
    try {
      const settings = player.querySelector(".ytp-settings-button");
      if (!settings || settings.disabled) throw new Error("Settings button unavailable");
      let menu = menuFor(player);
      if (!menu) {
        settings.click();
        menu = await waitForMenu(player, () => true);
      }
      for (let depth = 0; menu && depth < 5; depth++) {
        if (captionPanel(menu)) {
          watchMenu(player, menu);
          const panel = captionPanel(menu);
          panel.scrollTop = 0;
          const list = panel.querySelector(".ytp-panel-menu");
          if (list) list.scrollTop = 0;
          menu.scrollTop = 0;
          return;
        }
        const row = [...menu.querySelectorAll(".ytp-menuitem")].find(row => visible(row) && isCaptionTitle(row.querySelector(".ytp-menuitem-label")?.textContent || ""));
        if (row) {
          row.click();
          menu = await waitForMenu(player, candidate => Boolean(captionPanel(candidate)));
        } else {
          const back = [...menu.querySelectorAll(".ytp-panel-back-button")].find(visible);
          if (!back) break;
          const oldPanel = back.closest(".ytp-panel");
          back.click();
          menu = await waitForMenu(player, candidate => Boolean(captionPanel(candidate)) || !visible(oldPanel) || [...candidate.querySelectorAll(".ytp-menuitem-label")].some(label => visible(label) && isCaptionTitle(label.textContent)));
        }
      }
      throw new Error("Subtitles/CC menu unavailable for this video");
    } catch (error) {
      console.warn("[YouTube CC Menu] Could not open subtitles menu.", error);
    } finally {
      openingMenus.delete(player);
    }
  }

  window.addEventListener("contextmenu", (event) => {
    if (!(event.target instanceof Element)) return;
    const settings = event.target.closest(".ytp-settings-button");
    const settingsPlayer = settings?.closest(playerSelector);
    if (settingsPlayer) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!settings.disabled && settings.getAttribute("aria-disabled") !== "true") {
        void openCaptionMenu(settingsPlayer);
      }
      return;
    }
    const button = targetButton(event);
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const state = states.get(button);
    state.delta = 0;
    state.time = 0;
    if (button.disabled || button.getAttribute("aria-disabled") === "true") return;
    const player = button.closest(playerSelector);
    resetSubtitles(player);
    updateLabel(button, player);
  }, { capture: true });
  function refresh() {
    refreshTimer = undefined;
    document.querySelectorAll(buttonSelector).forEach(enhanceButton);
  }
  function scheduleRefresh() {
    if (refreshTimer === undefined) refreshTimer = setTimeout(refresh, 100);
  }
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") {
        if (record.target.matches(buttonSelector)) enhanceButton(record.target);
        continue;
      }
      if (record.target instanceof Element && record.target.matches(buttonSelector)) {
        scheduleRefresh();
        return;
      }
      for (const node of [...record.addedNodes, ...record.removedNodes]) {
        if (node instanceof Element && (node.matches(buttonSelector) || node.querySelector(buttonSelector))) {
          scheduleRefresh();
          return;
        }
      }
    }
  });
  observer.observe(document.documentElement, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ["aria-pressed", "aria-disabled", "disabled"]
  });
  document.addEventListener("yt-navigate-finish", scheduleRefresh);
  document.addEventListener("yt-player-updated", scheduleRefresh);
  window.addEventListener("pageshow", scheduleRefresh);
  refresh();
})();