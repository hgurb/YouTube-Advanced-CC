(() => {
  "use strict";
  // The format version is independent of the extension's release version.
  const prefix = "YTADVCC:v1:";
  const known = Object.keys(YTCCSettings.defaults);
  function extras(value) {
    return Object.fromEntries(Object.entries(value ?? {}).filter(([key]) =>
      !known.includes(key) && !["__proto__", "constructor", "prototype"].includes(key)));
  }
  function validate(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("The text must contain a settings object.");
    // Older backups may omit settings introduced later. Use today's defaults.
    const value = { ...YTCCSettings.defaults, ...input };
    if (!YTCCSettings.valid(value)) throw new Error("The export contains invalid subtitle size settings.");
    if (!["fixed", "custom"].includes(value.mode) || typeof value.cogMenu !== "boolean") throw new Error("The export contains an invalid sizing mode or cog shortcut setting.");
    if (!Array.isArray(value.customSizes) || value.customSizes.length > 100 ||
        value.customSizes.some(size => !Number.isInteger(size) || size < 10 || size > 500) ||
        (value.customSizes.length && new Set(value.customSizes).size < 2)) throw new Error("The export contains an invalid custom size list.");
    if (!Array.isArray(value.languages) || value.languages.length > 20 ||
        value.languages.some(item => typeof item !== "string" || !item.trim() || item.length > 60)) throw new Error("The export contains an invalid preferred-language list.");
    return { ...extras(input), ...YTCCSettings.normalize(value) };
  }
  function exportSettings(value) {
    return prefix + JSON.stringify({ settings: validate(value) });
  }
  function importSettings(text) {
    const value = text.trim();
    if (value.length > 100000) throw new Error("The export text is too large.");
    if (!value.startsWith(prefix)) throw new Error("Paste a complete YouTube Advanced CC export string (format v1). Newer formats may require an extension update.");
    let data;
    try { data = JSON.parse(value.slice(prefix.length)); }
    catch { throw new Error("The export text is incomplete or invalid. Copy it again and retry."); }
    return validate(data?.settings);
  }
  globalThis.YTCCTransfer = Object.freeze({ exportSettings, importSettings, extras });
})();
