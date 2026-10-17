(() => {
  "use strict";
  // This script runs in Chrome's isolated world. Keep it self-contained:
  // a page-world helper is not an initialization dependency here.
  function normalize(value) {
    const customSizes = Array.isArray(value?.customSizes) && value.customSizes.length <= 100 &&
      value.customSizes.every(size => Number.isInteger(size) && size >= 10 && size <= 500)
      ? [...new Set(value.customSizes)].sort((a,b) => a-b) : [];
    const seen = new Set();
    const languages = Array.isArray(value?.languages) ? value.languages.filter(item => typeof item === "string")
      .map(item => item.trim().slice(0, 60)).filter(item => {
        const key = item.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/ı/g, "i");
        if (!key || seen.has(key)) return false;
        seen.add(key); return true;
      }).slice(0, 20) : ["English"];
    return value && [value.min, value.max, value.increment].every(Number.isInteger) &&
      value.min >= 10 && value.max <= 500 && value.min < value.max &&
      value.increment >= 1 && value.increment <= 100
      ? { min: value.min, max: value.max, increment: value.increment,
        mode: value.mode === "custom" && customSizes.length >= 2 ? "custom" : "fixed",
        customSizes, cogMenu: value.cogMenu !== false, languages }
      : { min: 50, max: 400, increment: 10, mode: "fixed", customSizes: [], cogMenu: true, languages: ["English"] };
  }
  let settings = normalize();
  let revision = 0;
  const publish = () => window.dispatchEvent(new CustomEvent("ytcc-settings", { detail: JSON.stringify(settings) }));
  window.addEventListener("ytcc-settings-ready", publish);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.subtitleSizing) {
      revision++;
      settings = normalize(changes.subtitleSizing.newValue);
      publish();
    }
  });
  async function load() {
    try {
      const beforeRead = revision;
      const result = await chrome.storage.local.get("subtitleSizing");
      if (revision === beforeRead) settings = normalize(result.subtitleSizing);
      publish();
    } catch (error) { console.warn("[YouTube Advanced CC] Could not load settings.", error); }
  }
  void load();
})();
