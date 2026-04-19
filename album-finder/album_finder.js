const PLACEHOLDER = "{{q}}";
const RECORD_STORES_URL = "record_stores.json";
const DEBOUNCE_MS = 320;
const FORMAT_STORAGE_KEY = "albumFinderFormat";
const VALID_FORMATS = new Set(["vinyl", "cd"]);
const FORMAT_PLACEHOLDER_LABEL = "Choose a format...";
const TAB_WINDOW_PREFIX = "album-finder-tab";

let shops = [];
let shopsLoaded = false;
let debounceTimer = null;

function storeCountMetaEl() {
  return document.getElementById("store-count-meta");
}

function setStoreCountMetaFromCount(count) {
  const root = storeCountMetaEl();
  if (!root) {
    return;
  }
  root.replaceChildren();
  const num = document.createElement("strong");
  num.textContent = String(count);
  const suffix = document.createElement("span");
  suffix.className = "store-count-suffix";
  suffix.textContent = count === 1 ? " record store" : " record stores";
  root.append(num, suffix);
}

function setStoreCountMetaFallback() {
  const root = storeCountMetaEl();
  if (!root) {
    return;
  }
  root.textContent = "Record stores";
}

function readStoredFormat() {
  try {
    const v = localStorage.getItem(FORMAT_STORAGE_KEY);
    return VALID_FORMATS.has(v) ? v : null;
  } catch {
    return null;
  }
}

function persistFormat(format) {
  try {
    localStorage.setItem(FORMAT_STORAGE_KEY, format);
  } catch {
    /* ignore quota / private mode */
  }
}

function getFormatFromSelect(formatSelect) {
  const v = formatSelect.value;
  return v === "vinyl" || v === "cd" ? v : null;
}

function applyStoredFormatToSelect(formatSelect) {
  const stored = readStoredFormat();
  if (stored) {
    formatSelect.value = stored;
  }
}

function buildUrl(template, query) {
  const q = encodeURIComponent(query.trim());
  if (!template.includes(PLACEHOLDER)) {
    console.warn("URL template missing {{q}}:", template);
    return template;
  }
  return template.split(PLACEHOLDER).join(q);
}

function templateForShop(shop, format) {
  return format === "cd" ? shop.urlTemplateCd : shop.urlTemplateVinyl;
}

/**
 * Same URL list as link rendering: trimmed query, shops loaded, vinyl/cd format.
 * @param {string} query
 * @param {"vinyl" | "cd" | null} format
 * @returns {{label: string, url: string}[]}
 */
function getStoreEntriesForQuery(query, format) {
  const trimmed = query.trim();
  if (!trimmed || !shopsLoaded || (format !== "vinyl" && format !== "cd")) {
    return [];
  }
  const entries = [];
  for (const shop of shops) {
    entries.push({
      label: shop.label,
      url: buildUrl(templateForShop(shop, format), trimmed),
    });
  }
  return entries;
}

/**
 * Preserves previous API for button state logic.
 * @param {string} query
 * @param {"vinyl" | "cd" | null} format
 * @returns {string[]}
 */
function getStoreUrlsForQuery(query, format) {
  return getStoreEntriesForQuery(query, format).map((entry) => entry.url);
}

/**
 * Opens one URL and reports whether the browser allowed it.
 * @param {string} url
 * @param {string} windowName
 * @returns {boolean}
 */
function openUrlInNamedWindow(url, windowName) {
  // Some browsers return null when noopener is passed, even if the tab opens.
  // Open a named blank tab first so popup success/failure is detectable.
  const w = window.open("", windowName);
  if (!w) {
    return false;
  }
  try {
    w.opener = null;
  } catch {
    /* ignore cross-origin restrictions */
  }
  try {
    w.location.href = url;
  } catch {
    // If assignment fails for any reason, fallback to direct open.
    window.open(url, windowName);
  }
  return true;
}

/**
 * Opens entries in dedicated tabs/windows and returns detailed result.
 * Some browsers allow only one scripted popup per user gesture.
 */
function openEntriesInNewTabs(entries) {
  let opened = 0;
  const blockedEntries = [];
  const token = Date.now();
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const name = `${TAB_WINDOW_PREFIX}-${token}-${i}`;
    if (openUrlInNamedWindow(entry.url, name)) {
      opened += 1;
    } else {
      blockedEntries.push(entry);
    }
  }
  return { opened, blockedEntries };
}

function setOpenAllFeedback(feedbackEl, message, isError) {
  if (!feedbackEl) {
    return;
  }
  feedbackEl.hidden = !message;
  feedbackEl.textContent = message || "";
  feedbackEl.classList.toggle("error", !!isError);
  feedbackEl.classList.toggle("hint", !isError);
}

function renderBlockedEntriesList(listEl, entries) {
  if (!listEl) {
    return;
  }
  listEl.replaceChildren();
  if (!entries.length) {
    return;
  }
  const frag = document.createDocumentFragment();
  for (const entry of entries) {
    const a = document.createElement("a");
    a.href = entry.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "shop-link";
    a.textContent = entry.label;
    frag.appendChild(a);
  }
  listEl.appendChild(frag);
}

function setTabHelperState(helperEl, progressEl, listEl, blockedEntries) {
  if (!helperEl || !progressEl || !listEl) {
    return;
  }
  if (!blockedEntries.length) {
    helperEl.hidden = true;
    progressEl.textContent = "";
    listEl.replaceChildren();
    return;
  }
  helperEl.hidden = false;
  progressEl.textContent = `${blockedEntries.length} blocked ${
    blockedEntries.length === 1 ? "tab remains" : "tabs remain"
  }.`;
  renderBlockedEntriesList(listEl, blockedEntries);
}

async function copyTextToClipboard(text) {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through to legacy fallback */
    }
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  Object.assign(ta.style, {
    position: "fixed",
    left: "-9999px",
    opacity: "0",
  });
  document.body.appendChild(ta);
  ta.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  ta.remove();
  return copied;
}

function placeOpenAllButton(openAllBtn, mobileSlot, desktopSlot) {
  if (!openAllBtn) {
    return;
  }
  const isMobile =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 760px)").matches;
  const target = isMobile ? mobileSlot : desktopSlot;
  if (!target) {
    return;
  }
  if (openAllBtn.parentElement !== target) {
    target.appendChild(openAllBtn);
  }
}

function syncOpenAllButtonSize(openAllBtn, formatSelect) {
  if (!openAllBtn || !formatSelect) {
    return;
  }
  const isMobile =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 760px)").matches;
  if (isMobile) {
    openAllBtn.style.width = "100%";
    return;
  }
  const customSelect = formatSelect.nextElementSibling;
  if (customSelect && customSelect.classList && customSelect.classList.contains("custom-select")) {
    const w = customSelect.getBoundingClientRect().width;
    if (w > 0) {
      openAllBtn.style.width = `${Math.round(w)}px`;
      return;
    }
  }
  openAllBtn.style.removeProperty("width");
}

function syncOpenAllButton(button, query, formatSelect) {
  if (!button) {
    return;
  }
  const format = getFormatFromSelect(formatSelect);
  const urls = getStoreUrlsForQuery(query, format);
  const canOpen = urls.length > 0;
  button.disabled = !canOpen;
  if (canOpen) {
    const n = urls.length;
    const storeWord = n === 1 ? "record store" : "record stores";
    button.setAttribute(
      "aria-label",
      `Open all ${n} ${storeWord} in new tabs`
    );
  } else {
    button.setAttribute("aria-label", "Open all in new tabs");
  }
}

function clearResults(container) {
  container.replaceChildren();
}

function renderLinks(query, container, formatSelect, openAllBtn) {
  clearResults(container);
  try {
    const trimmed = query.trim();
    if (!trimmed) {
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent = shopsLoaded
        ? "Type an artist or album title, choose the format and the shop links will update automatically."
        : "Loading shop list...";
      container.appendChild(hint);
      return;
    }

    if (!shopsLoaded) {
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent = "Loading shop list...";
      container.appendChild(hint);
      return;
    }

    const format = getFormatFromSelect(formatSelect);
    if (!format) {
      const hint = document.createElement("p");
      hint.className = "hint";
      hint.textContent = "Choose a format above to list shop links.";
      container.appendChild(hint);
      return;
    }

    const entries = getStoreEntriesForQuery(trimmed, format);
    for (const entry of entries) {
      const a = document.createElement("a");
      a.href = entry.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = entry.label;
      a.className = "shop-link";
      container.appendChild(a);
    }
  } finally {
    syncOpenAllButton(openAllBtn, query, formatSelect);
  }
}

function setStatus(container, message, isError) {
  clearResults(container);
  const p = document.createElement("p");
  p.className = isError ? "error" : "hint";
  p.textContent = message;
  container.appendChild(p);
}

function normalizeShopsList(list) {
  const out = [];
  for (const s of list) {
    if (!s || !s.label) {
      continue;
    }
    const v = s.urlTemplateVinyl;
    const c = s.urlTemplateCd;
    if (typeof v === "string" && v.trim() && typeof c === "string" && c.trim()) {
      out.push({ label: s.label, urlTemplateVinyl: v.trim(), urlTemplateCd: c.trim() });
    } else {
      console.warn("Shop skipped (needs urlTemplateVinyl and urlTemplateCd):", s.label || s);
    }
  }
  return out;
}

async function loadShops(resultsEl, formatSelect, openAllBtn) {
  shopsLoaded = false;
  setStatus(resultsEl, "Loading shop list...", false);
  syncOpenAllButton(openAllBtn, document.getElementById("query")?.value ?? "", formatSelect);
  try {
    const res = await fetch(RECORD_STORES_URL, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    const list = Array.isArray(data.shops) ? data.shops : data;
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error("record_stores.json has no shops array");
    }
    shops = normalizeShopsList(list);
    if (shops.length === 0) {
      throw new Error("No valid shops (each needs label, urlTemplateVinyl, urlTemplateCd)");
    }
    shopsLoaded = true;
    setStoreCountMetaFromCount(shops.length);
    const input = document.getElementById("query");
    renderLinks(input.value, resultsEl, formatSelect, openAllBtn);
  } catch (e) {
    shopsLoaded = false;
    setStoreCountMetaFallback();
    setStatus(
      resultsEl,
      `Could not load record_stores.json (${e.message}). Use a local server: run "python3 -m http.server 8765" in this folder, then open http://127.0.0.1:8765/`,
      true
    );
    syncOpenAllButton(openAllBtn, document.getElementById("query")?.value ?? "", formatSelect);
  }
}

/**
 * Discogs-style custom dropdown: native <select> stays for value + change events;
 * list shows only Vinyl/CD (placeholder is button label only, not in the list).
 */
function enhanceFormatSelect(selectEl) {
  if (!selectEl || selectEl.dataset.enhanced === "1") {
    return;
  }
  selectEl.dataset.enhanced = "1";
  selectEl.classList.add("select-native", "is-enhanced");

  const host = document.createElement("div");
  host.className = "custom-select";
  host.setAttribute("data-for", selectEl.id || "");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "custom-select-btn";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", "Release format");

  const list = document.createElement("div");
  list.id = "format-listbox";
  list.className = "custom-select-list";
  list.setAttribute("role", "listbox");
  list.hidden = true;
  button.setAttribute("aria-controls", list.id);

  function setCurrentLabel() {
    if (selectEl.value === "") {
      button.textContent = FORMAT_PLACEHOLDER_LABEL;
    } else {
      const opt = selectEl.options[selectEl.selectedIndex];
      button.textContent = (opt && opt.textContent) || FORMAT_PLACEHOLDER_LABEL;
    }
    list.querySelectorAll(".custom-select-option").forEach((optBtn) => {
      const active = optBtn.getAttribute("data-value") === selectEl.value;
      optBtn.classList.toggle("is-active", active);
      optBtn.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function syncFormatSelectWidth() {
    const labels = [FORMAT_PLACEHOLDER_LABEL];
    for (let i = 0; i < selectEl.options.length; i++) {
      const o = selectEl.options[i];
      if (o.value === "") {
        continue;
      }
      labels.push(o.textContent || o.value);
    }
    // The visible button uses width: 100%, so offsetWidth tracks the host width — not the
    // label text. During iOS Safari rubber-band / chrome resize, a transient full-width
    // layout could lock host.style.width to the viewport. Measure with a detached clone
    // that uses width: auto so offsetWidth reflects label content only.
    const restore = button.textContent;
    const clone = button.cloneNode(true);
    clone.removeAttribute("id");
    clone.setAttribute("aria-hidden", "true");
    clone.tabIndex = -1;
    clone.style.cssText =
      "position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;width:auto;max-width:none;min-width:0;";
    document.body.appendChild(clone);
    let max = 0;
    for (const t of labels) {
      clone.textContent = t;
      max = Math.max(max, clone.offsetWidth);
    }
    document.body.removeChild(clone);
    button.textContent = restore;
    setCurrentLabel();
    const cap =
      typeof window !== "undefined" && window.innerWidth > 0
        ? window.innerWidth - 48
        : 520;
    host.style.width = `${Math.min(max, cap)}px`;
  }

  let formatSelectResizeTimer = null;
  function syncFormatSelectWidthDebounced() {
    if (formatSelectResizeTimer !== null) {
      clearTimeout(formatSelectResizeTimer);
    }
    formatSelectResizeTimer = setTimeout(() => {
      formatSelectResizeTimer = null;
      syncFormatSelectWidth();
    }, 150);
  }

  function closeList() {
    host.classList.remove("is-open");
    list.hidden = true;
    button.setAttribute("aria-expanded", "false");
  }

  for (let i = 0; i < selectEl.options.length; i++) {
    const opt = selectEl.options[i];
    if (opt.value === "") {
      continue;
    }
    const optBtn = document.createElement("button");
    optBtn.type = "button";
    optBtn.className = "custom-select-option";
    optBtn.setAttribute("role", "option");
    optBtn.setAttribute("data-value", opt.value);
    optBtn.textContent = opt.textContent;
    optBtn.addEventListener("click", () => {
      if (selectEl.value === opt.value) {
        closeList();
        return;
      }
      selectEl.value = opt.value;
      setCurrentLabel();
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
      closeList();
    });
    list.appendChild(optBtn);
  }

  button.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const willOpen = !host.classList.contains("is-open");
    document.querySelectorAll(".custom-select.is-open").forEach((el) => {
      if (el !== host) {
        el.classList.remove("is-open");
        const l = el.querySelector(".custom-select-list");
        if (l) {
          l.hidden = true;
        }
        const b = el.querySelector(".custom-select-btn");
        if (b) {
          b.setAttribute("aria-expanded", "false");
        }
      }
    });
    host.classList.toggle("is-open", willOpen);
    list.hidden = !willOpen;
    button.setAttribute("aria-expanded", willOpen ? "true" : "false");
  });

  host.appendChild(button);
  host.appendChild(list);
  selectEl.insertAdjacentElement("afterend", host);

  selectEl.addEventListener("change", setCurrentLabel);
  setCurrentLabel();
  syncFormatSelectWidth();
  window.addEventListener("resize", syncFormatSelectWidthDebounced);

  document.addEventListener("click", (ev) => {
    if (!ev.target || !ev.target.closest) {
      return;
    }
    if (!ev.target.closest(".custom-select")) {
      closeList();
    }
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      closeList();
    }
  });
}

function scheduleRender(query, resultsEl, formatSelect, openAllBtn) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    renderLinks(query, resultsEl, formatSelect, openAllBtn);
  }, DEBOUNCE_MS);
}

function main() {
  const input = document.getElementById("query");
  const form = document.getElementById("search-form");
  const formatSelect = document.getElementById("format");
  const resultsEl = document.getElementById("results");
  const openAllBtn = document.getElementById("open-all-tabs");
  const openAllMobileSlot = document.getElementById("open-all-mobile-slot");
  const openAllDesktopSlot = document.getElementById("open-all-desktop-slot");
  const openAllFeedbackEl = document.getElementById("open-all-feedback");
  const tabHelperEl = document.getElementById("tab-helper");
  const tabHelperProgressEl = document.getElementById("tab-helper-progress");
  const tabHelperListEl = document.getElementById("tab-helper-list");
  const openNextTabBtn = document.getElementById("open-next-tab");
  const copyAllUrlsBtn = document.getElementById("copy-all-urls");
  let blockedEntries = [];
  if (!input || !form || !formatSelect || !resultsEl) {
    return;
  }

  applyStoredFormatToSelect(formatSelect);
  enhanceFormatSelect(formatSelect);
  placeOpenAllButton(openAllBtn, openAllMobileSlot, openAllDesktopSlot);
  syncOpenAllButtonSize(openAllBtn, formatSelect);
  loadShops(resultsEl, formatSelect, openAllBtn);

  let openAllPlacementResizeTimer = null;
  window.addEventListener("resize", () => {
    if (openAllPlacementResizeTimer !== null) {
      clearTimeout(openAllPlacementResizeTimer);
    }
    openAllPlacementResizeTimer = setTimeout(() => {
      openAllPlacementResizeTimer = null;
      placeOpenAllButton(openAllBtn, openAllMobileSlot, openAllDesktopSlot);
      syncOpenAllButtonSize(openAllBtn, formatSelect);
    }, 140);
  });

  if (openAllBtn) {
    openAllBtn.addEventListener("click", () => {
      const format = getFormatFromSelect(formatSelect);
      const entries = getStoreEntriesForQuery(input.value, format);
      const { opened, blockedEntries: blocked } = openEntriesInNewTabs(entries);
      blockedEntries = blocked;
      setTabHelperState(tabHelperEl, tabHelperProgressEl, tabHelperListEl, blockedEntries);
      if (opened === 0) {
        setOpenAllFeedback(
          openAllFeedbackEl,
          "No tabs were opened. Allow pop-ups for this site, then try again.",
          true
        );
      } else if (opened < entries.length) {
        setOpenAllFeedback(
          openAllFeedbackEl,
          `Opened ${opened} of ${entries.length}. Browser pop-up policy blocked the rest.`,
          true
        );
      } else {
        setOpenAllFeedback(openAllFeedbackEl, `Opened ${opened} tabs.`, false);
        blockedEntries = [];
        setTabHelperState(tabHelperEl, tabHelperProgressEl, tabHelperListEl, blockedEntries);
      }
    });
  }

  if (openNextTabBtn) {
    openNextTabBtn.addEventListener("click", () => {
      if (!blockedEntries.length) {
        setOpenAllFeedback(openAllFeedbackEl, "No blocked tabs left to open.", false);
        setTabHelperState(tabHelperEl, tabHelperProgressEl, tabHelperListEl, blockedEntries);
        return;
      }
      const next = blockedEntries[0];
      const ok = openUrlInNamedWindow(next.url, `${TAB_WINDOW_PREFIX}-${Date.now()}-manual`);
      if (ok) {
        blockedEntries.shift();
        setOpenAllFeedback(
          openAllFeedbackEl,
          `Opened "${next.label}". ${blockedEntries.length} ${
            blockedEntries.length === 1 ? "tab remains" : "tabs remain"
          }.`,
          false
        );
      } else {
        setOpenAllFeedback(
          openAllFeedbackEl,
          "Still blocked by browser policy. Allow pop-ups for this site and try again.",
          true
        );
      }
      setTabHelperState(tabHelperEl, tabHelperProgressEl, tabHelperListEl, blockedEntries);
    });
  }

  if (copyAllUrlsBtn) {
    copyAllUrlsBtn.addEventListener("click", async () => {
      const format = getFormatFromSelect(formatSelect);
      const entries = blockedEntries.length
        ? blockedEntries
        : getStoreEntriesForQuery(input.value, format);
      if (!entries.length) {
        setOpenAllFeedback(openAllFeedbackEl, "No links available to copy.", true);
        return;
      }
      const text = entries.map((entry) => `${entry.label}: ${entry.url}`).join("\n");
      const copied = await copyTextToClipboard(text);
      if (copied) {
        setOpenAllFeedback(
          openAllFeedbackEl,
          `Copied ${entries.length} ${entries.length === 1 ? "link" : "links"} to clipboard.`,
          false
        );
      } else {
        setOpenAllFeedback(
          openAllFeedbackEl,
          "Could not copy automatically. Select links below and copy manually.",
          true
        );
      }
    });
  }

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    renderLinks(input.value, resultsEl, formatSelect, openAllBtn);
  });

  input.addEventListener("input", () => {
    blockedEntries = [];
    setTabHelperState(tabHelperEl, tabHelperProgressEl, tabHelperListEl, blockedEntries);
    setOpenAllFeedback(openAllFeedbackEl, "", false);
    syncOpenAllButton(openAllBtn, input.value, formatSelect);
    scheduleRender(input.value, resultsEl, formatSelect, openAllBtn);
  });

  input.addEventListener("keydown", (ev) => {
    const isEnter = ev.key === "Enter" || ev.key === "NumpadEnter";
    if (!isEnter || ev.isComposing) {
      return;
    }
    ev.preventDefault();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    renderLinks(input.value, resultsEl, formatSelect, openAllBtn);
  });

  formatSelect.addEventListener("change", () => {
    blockedEntries = [];
    setTabHelperState(tabHelperEl, tabHelperProgressEl, tabHelperListEl, blockedEntries);
    setOpenAllFeedback(openAllFeedbackEl, "", false);
    const fmt = getFormatFromSelect(formatSelect);
    if (fmt) {
      persistFormat(fmt);
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    renderLinks(input.value, resultsEl, formatSelect, openAllBtn);
  });
}

document.addEventListener("DOMContentLoaded", main);
