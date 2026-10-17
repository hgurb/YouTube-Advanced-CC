"use strict";
document.querySelector(".changelog-link").addEventListener("click", event => {
  event.preventDefault();
  const changelog = document.querySelector("#changelog");
  changelog.open = true;
  changelog.querySelector("summary").focus({ preventScroll: true });
  changelog.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
});
const form = document.querySelector("form");
const toolbar = document.querySelector(".toolbar");
new ResizeObserver(() => {
  document.documentElement.style.setProperty("--toolbar-height", `${toolbar.getBoundingClientRect().height}px`);
}).observe(toolbar);
// Correct size bounds before native validation can block a submit (including Enter).
// Other fields still use reportValidity() below.
form.noValidate = true;
const minimum = document.querySelector("#min");
const maximum = document.querySelector("#max");
function correctBound(input) {
  const number = input.valueAsNumber;
  if (!Number.isInteger(number) || number < Number(input.min) || number > Number(input.max)) {
    input.value = input === minimum ? "10" : "500";
  }
}
for (const input of [minimum, maximum]) {
  input.addEventListener("blur", () => {
    correctBound(input);
    if (minimum.valueAsNumber >= maximum.valueAsNumber) input.value = input === minimum ? "10" : "500";
    update();
  });
}
const fields = document.querySelector("fieldset");
const inputs = [...form.querySelectorAll('input[type="number"], input[type="checkbox"]')];
const modes = [...form.querySelectorAll('[name="sizing-mode"]')];
const customInput = document.querySelector("#custom-sizes");
function correctCustomSizes() {
  const sizes = YTCCSettings.parseSizes(customInput.value, true);
  if (sizes) customInput.value = sizes.join(", ");
}
customInput.addEventListener("blur", () => { correctCustomSizes(); update(); });
const currentMode = () => modes.find(input => input.checked).value;
const languageList = document.querySelector("#languages-list");
const addLanguage = document.querySelector("#add-language");
function addLanguageRow(text = "", focus = false) {
  const row = document.createElement("div");
  row.className = "language-row";
  const input = document.createElement("input");
  input.type = "text"; input.maxLength = 60; input.required = true;
  input.value = text;
  input.setAttribute("aria-label", "Preferred language or keyword");
  input.setAttribute("aria-describedby", "languages-help");
  const remove = document.createElement("button");
  remove.type = "button"; remove.textContent = "Remove";
  remove.addEventListener("click", () => { row.remove(); update(); addLanguage.focus(); });
  const arrows = document.createElement("div");
  arrows.className = "language-arrows";
  for (const direction of ["up", "down"]) {
    const button = document.createElement("button");
    button.type = "button"; button.dataset.direction = direction;
    button.textContent = direction === "up" ? "↑" : "↓";
    button.addEventListener("click", () => {
      const sibling = direction === "up" ? row.previousElementSibling : row.nextElementSibling;
      if (!sibling) return;
      if (direction === "up") languageList.insertBefore(row, sibling);
      else languageList.insertBefore(sibling, row);
      update();
      if (button.disabled) input.focus();
      else button.focus();
    });
    arrows.append(button);
  }
  row.append(input, arrows, remove); languageList.append(row);
  if (focus) input.focus();
}
addLanguage.addEventListener("click", () => { if (languageList.children.length < 20) { addLanguageRow("", true); update(); } });
const status = document.querySelector("#status");
const save = document.querySelector("#save");
const discard = document.querySelector("#discard");
const importSave = document.querySelector("#import-save");
const transferText = document.querySelector("#transfer-text");
const transferStatus = document.querySelector("#transfer-status");
const copyButton = document.querySelector("#copy-transfer");
let copying = false;
let copyFeedback;
function updateCopyButton() { copyButton.disabled = copying || !transferText.value; }
copyButton.addEventListener("click", async () => {
  const text = transferText.value;
  if (!text || copying) return;
  copying = true;
  updateCopyButton();
  try {
    await navigator.clipboard.writeText(text);
    transferStatus.textContent = "Copied to clipboard.";
    copyFeedback?.cancel();
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    copyFeedback = transferStatus.animate([
      { color: "var(--copy-confirmation-color)", textShadow: reducedMotion ? "none" : "0 0 8px var(--copy-confirmation-color)" },
      { color: getComputedStyle(transferStatus).color, textShadow: "none" }
    ], { duration: 800, easing: "ease-out" });
  } catch {
    if (transferText.value === text) { transferText.focus(); transferText.select(); }
    transferStatus.textContent = "Clipboard access failed. Copy the text manually or try again.";
  } finally { copying = false; updateCopyButton(); }
});
transferText.addEventListener("input", updateCopyButton);
const importNotice = document.querySelector("#import-notice");
let importReady = false;
let saving = false;
let extraSettings = {};
function clearImport() {
  importReady = false;
  importNotice.hidden = true;
  transferStatus.textContent = "";
}
const draftSignature = () => JSON.stringify([inputs.map(input => [input.value, input.checked]),
  currentMode(), customInput.value, [...languageList.querySelectorAll("input")].map(input => input.value), extraSettings]);
let saved;
const read = () => ({ ...extraSettings, ...Object.fromEntries(inputs.map(input => [input.name, input.type === "checkbox" ? input.checked : input.valueAsNumber])),
  mode: currentMode(), customSizes: YTCCSettings.parseSizes(customInput.value) ?? [],
  languages: YTCCSettings.languages([...languageList.querySelectorAll("input")].map(input => input.value)) });
function render(value) {
  extraSettings = YTCCTransfer.extras(value);
  for (const mode of modes) mode.checked = mode.value === value.mode;
  customInput.value = value.customSizes.join(", ");
  for (const input of inputs) {
    if (input.type === "checkbox") input.checked = value[input.name];
    else input.value = value[input.name];
  }
  languageList.replaceChildren();
  for (const language of value.languages) addLanguageRow(language);
  update();
}
function update() {
  const custom = currentMode() === "custom";
  document.querySelector("#fixed-controls").hidden = custom;
  document.querySelector("#custom-controls").hidden = !custom;
  for (const input of [minimum, maximum, document.querySelector("#increment")]) input.disabled = custom;
  customInput.disabled = !custom;
  const customError = custom && !YTCCSettings.parseSizes(customInput.value)
    ? "Enter 2–100 different whole numbers between 10 and 500, separated by commas." : "";
  customInput.setCustomValidity(customError);
  document.querySelector("#custom-error").textContent = customError;
  const rows = [...languageList.children];
  rows.forEach((row, index) => {
    const name = row.querySelector("input").value.trim() || `entry ${index + 1}`;
    for (const button of row.querySelectorAll("[data-direction]")) {
      const direction = button.dataset.direction;
      button.disabled = direction === "up" ? index === 0 : index === rows.length - 1;
      button.setAttribute("aria-label", `Move ${name} ${direction}`);
      button.title = `Move ${direction}`;
    }
  });
  addLanguage.disabled = languageList.children.length >= 20;
  for (const input of languageList.querySelectorAll("input")) input.setCustomValidity(input.value.trim() ? "" : "Enter a language or remove this entry.");
  const value = read();
  const draftLanguages = [...languageList.querySelectorAll("input")].map(input => input.value);
  const keys = ["min", "max", "increment", "mode", "customSizes", "cogMenu", "languages"];
  const dirty = JSON.stringify(value, keys) !== JSON.stringify(saved, keys) || JSON.stringify(draftLanguages) !== JSON.stringify(saved?.languages) || customInput.value !== (saved?.customSizes ?? []).join(", ");
  document.querySelector("#max").setCustomValidity(!custom && value.min >= value.max ? "Maximum must be greater than minimum." : "");
  document.querySelector("#options-save-notice").hidden = !saved || (!dirty && !importReady);
  save.disabled = saving || !saved || (!dirty && !importReady);
  importSave.disabled = saving || !saved || !importReady;
  discard.disabled = !saved || !dirty;
  status.textContent = dirty ? "Unsaved changes" : "All changes saved";
  document.querySelector("#example").textContent = custom
    ? (value.customSizes.length >= 2 ? `Scroll through: ${value.customSizes.map(size => `${size}%`).join(" → ")}` : "Add your preferred subtitle sizes above.")
    : YTCCSettings.valid(value)
    ? `${value.min}%–${value.max}% · ${value.increment} percentage points per scroll. For example: ${value.min}% → ${Math.min(value.max, value.min + value.increment)}% → ${Math.min(value.max, value.min + value.increment * 2)}%.`
    : "Enter whole numbers within the allowed ranges, with minimum below maximum.";
}
form.addEventListener("input", update);
discard.addEventListener("click", () => { clearImport(); render(saved); });
document.querySelector("#defaults").addEventListener("click", () => { clearImport(); render(YTCCSettings.defaults); });
form.addEventListener("submit", async event => {
  event.preventDefault();
  if (saving || (event.submitter === importSave && !importReady)) return;
  correctCustomSizes();
  correctBound(minimum);
  correctBound(maximum);
  if (minimum.valueAsNumber >= maximum.valueAsNumber) {
    minimum.value = "10";
    maximum.value = "500";
  }
  update();
  const value = read();
  if (!form.reportValidity() || !YTCCSettings.valid(value)) return;
  const signature = draftSignature();
  const imported = importReady;
  saving = true;
  update();
  let failure;
  try {
    await chrome.storage.local.set({ subtitleSizing: value });
    saved = value;
    if (draftSignature() === signature) {
      clearImport();
      if (imported) transferStatus.textContent = "Imported settings saved.";
      render(saved);
    }
  } catch { failure = "Could not save. Your changes are still here; try again."; }
  finally { saving = false; update(); if (failure) status.textContent = failure; }
});
function prepareExport() {
  correctCustomSizes(); correctBound(minimum); correctBound(maximum); update();
  if (!form.reportValidity()) throw new Error("Check your settings above before exporting.");
  return YTCCTransfer.exportSettings(read());
}
transferText.addEventListener("input", () => { clearImport(); update(); });
document.querySelector("#export").addEventListener("click", async () => {
  if (!saved || saving) return;
  try { transferText.value = prepareExport(); updateCopyButton(); clearImport(); update(); }
  catch (error) { transferStatus.textContent = error.message; return; }
  try {
    await navigator.clipboard.writeText(transferText.value);
    transferStatus.textContent = "Export generated and copied to the clipboard.";
  } catch {
    transferText.focus(); transferText.select();
    transferStatus.textContent = "Export generated. Copy the selected text manually.";
  }
});
document.querySelector("#import").addEventListener("click", () => {
  if (!saved || saving) return;
  clearImport();
  let value;
  try { value = YTCCTransfer.importSettings(transferText.value); }
  catch (error) { transferStatus.textContent = error.message; update(); return; }
  importReady = true;
  render(value);
  importNotice.hidden = false;
  transferStatus.textContent = "Settings loaded for review. Save to apply, or Discard to undo.";
});
async function load() {
  try {
    const result = await chrome.storage.local.get("subtitleSizing");
    saved = { ...YTCCTransfer.extras(result.subtitleSizing), ...YTCCSettings.normalize(result.subtitleSizing) };
    render(saved);
    fields.disabled = false;
  } catch { status.textContent = "Could not load settings. Reopen this page to retry."; }
}
void load();
