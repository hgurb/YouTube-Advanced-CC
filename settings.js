(() => {
  "use strict";
  const defaults = Object.freeze({ min: 50, max: 400, increment: 10, mode: "fixed", customSizes: Object.freeze([]), cogMenu: true, languages: Object.freeze(["English"]) });
  function parseSizes(text, clamp = false) {
    const parts = text.split(",").map(part => part.trim());
    if (parts.length > 100 || parts.some(part => !/^-?\d+$/.test(part))) return null;
    const values = parts.map(part => clamp ? Math.max(10, Math.min(500, Number(part))) : Number(part));
    if (values.some(value => value < 10 || value > 500)) return null;
    const unique = [...new Set(values)].sort((a, b) => a - b);
    return clamp || unique.length >= 2 ? unique : null;
  }
  function customValid(values) {
    return Array.isArray(values) && values.length >= 2 && values.length <= 100 &&
      values.every(value => Number.isInteger(value) && value >= 10 && value <= 500) && new Set(values).size >= 2;
  }
  const fold = text => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/ı/g, "i").trim();
  function languages(value) {
    if (!Array.isArray(value)) return ["English"];
    const seen = new Set();
    return value.filter(item => typeof item === "string").map(item => item.trim().slice(0, 60)).filter(item => {
      const key = fold(item);
      if (!key || seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, 20);
  }
  function matchesLanguage(label, keywords) {
    const text = fold(label);
    return keywords.some(keyword => {
      const key = fold(keyword);
      const aliases = ["english", "ingilizce"].includes(key) ? ["english", "ingilizce"]
        : ["turkish", "turkce"].includes(key) ? ["turkish", "turkce"] : [key];
      return aliases.some(alias => alias && text.includes(alias));
    });
  }
  function valid(value) {
    return value && [value.min, value.max, value.increment].every(Number.isInteger) &&
      value.min >= 10 && value.max <= 500 && value.min < value.max &&
      value.increment >= 1 && value.increment <= 100 &&
      (value.mode !== "custom" || customValid(value.customSizes));
  }
  function normalize(value) {
    return valid(value) ? { min: value.min, max: value.max, increment: value.increment,
      mode: value.mode === "custom" ? "custom" : "fixed",
      customSizes: customValid(value.customSizes) ? [...new Set(value.customSizes)].sort((a,b) => a-b) : [],
      cogMenu: value.cogMenu !== false, languages: languages(value.languages) } : { ...defaults, customSizes: [], languages: ["English"] };
  }
  globalThis.YTCCSettings = Object.freeze({ defaults, valid, normalize, languages, matchesLanguage, parseSizes,
    next: (current, direction, config) => {
      if (config.mode === "custom" && customValid(config.customSizes)) {
        const sizes = [...new Set(config.customSizes)].sort((a,b) => a-b);
        return direction > 0 ? sizes.find(size => size > current) ?? sizes.at(-1)
          : sizes.findLast(size => size < current) ?? sizes[0];
      }
      return Math.max(config.min, Math.min(config.max, Math.round(current + direction * config.increment)));
    },
    // YouTube's caption renderer uses scale = 1 + 0.25 * fontSizeIncrement.
    toNative: percent => (percent - 100) / 25,
    fromNative: value => Math.round((1 + value * 0.25) * 100)
  });
})();
