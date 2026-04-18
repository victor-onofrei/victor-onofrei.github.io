const PLACEHOLDER = "{{q}}";
const RECORD_STORES_URL = "record_stores.json";
const DEBOUNCE_MS = 320;
const FORMAT_STORAGE_KEY = "albumFinderFormat";
const VALID_FORMATS = new Set(["vinyl", "cd"]);
const FORMAT_PLACEHOLDER_LABEL = "Choose a format...";

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

function clearResults(container) {
  container.replaceChildren();
}

function renderLinks(query, container, formatSelect) {
  clearResults(container);
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

  for (const shop of shops) {
    const template = templateForShop(shop, format);
    const url = buildUrl(template, trimmed);
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = shop.label;
    a.className = "shop-link";
    container.appendChild(a);
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

async function loadShops(resultsEl, formatSelect) {
  shopsLoaded = false;
  setStatus(resultsEl, "Loading shop list...", false);
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
    renderLinks(input.value, resultsEl, formatSelect);
  } catch (e) {
    shopsLoaded = false;
    setStoreCountMetaFallback();
    setStatus(
      resultsEl,
      `Could not load record_stores.json (${e.message}). Use a local server: run "python3 -m http.server 8765" in this folder, then open http://127.0.0.1:8765/`,
      true
    );
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
    const restore = button.textContent;
    let max = 0;
    for (const t of labels) {
      button.textContent = t;
      max = Math.max(max, button.offsetWidth);
    }
    button.textContent = restore;
    setCurrentLabel();
    const cap =
      typeof window !== "undefined" && window.innerWidth > 0
        ? window.innerWidth - 48
        : 520;
    host.style.width = `${Math.min(max + 18, cap)}px`;
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
  window.addEventListener("resize", syncFormatSelectWidth);

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

function scheduleRender(query, resultsEl, formatSelect) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    renderLinks(query, resultsEl, formatSelect);
  }, DEBOUNCE_MS);
}

function main() {
  const input = document.getElementById("query");
  const form = document.getElementById("search-form");
  const formatSelect = document.getElementById("format");
  const resultsEl = document.getElementById("results");
  if (!input || !form || !formatSelect || !resultsEl) {
    return;
  }

  applyStoredFormatToSelect(formatSelect);
  enhanceFormatSelect(formatSelect);
  loadShops(resultsEl, formatSelect);

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    renderLinks(input.value, resultsEl, formatSelect);
  });

  input.addEventListener("input", () => {
    scheduleRender(input.value, resultsEl, formatSelect);
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
    renderLinks(input.value, resultsEl, formatSelect);
  });

  formatSelect.addEventListener("change", () => {
    const fmt = getFormatFromSelect(formatSelect);
    if (fmt) {
      persistFormat(fmt);
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    renderLinks(input.value, resultsEl, formatSelect);
  });
}

document.addEventListener("DOMContentLoaded", main);
