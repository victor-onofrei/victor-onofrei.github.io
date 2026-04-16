const PLACEHOLDER = "{{q}}";
const SHOPS_URL = "shops.json";
const DEBOUNCE_MS = 320;

let shops = [];
let debounceTimer = null;

function buildUrl(template, query) {
  const q = encodeURIComponent(query.trim());
  if (!template.includes(PLACEHOLDER)) {
    console.warn("urlTemplate missing {{q}}:", template);
    return template;
  }
  return template.split(PLACEHOLDER).join(q);
}

function clearResults(container) {
  container.replaceChildren();
}

function renderLinks(query, container) {
  clearResults(container);
  const trimmed = query.trim();
  if (!trimmed) {
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "Type an artist or title, then search.";
    container.appendChild(hint);
    return;
  }

  for (const shop of shops) {
    const url = buildUrl(shop.urlTemplate, trimmed);
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

async function loadShops(resultsEl) {
  setStatus(resultsEl, "Loading shop list...", false);
  try {
    const res = await fetch(SHOPS_URL, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    const list = Array.isArray(data.shops) ? data.shops : data;
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error("shops.json has no shops array");
    }
    shops = list.filter((s) => s && s.label && s.urlTemplate);
    const input = document.getElementById("query");
    renderLinks(input.value, resultsEl);
  } catch (e) {
    setStatus(
      resultsEl,
      `Could not load shops.json (${e.message}). Use a local server: run "python3 -m http.server 8765" in this folder, then open http://127.0.0.1:8765/`,
      true
    );
  }
}

function scheduleRender(query, resultsEl) {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    renderLinks(query, resultsEl);
  }, DEBOUNCE_MS);
}

function main() {
  const input = document.getElementById("query");
  const form = document.getElementById("search-form");
  const resultsEl = document.getElementById("results");
  if (!input || !form || !resultsEl) {
    return;
  }

  loadShops(resultsEl);

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    renderLinks(input.value, resultsEl);
  });

  input.addEventListener("input", () => {
    scheduleRender(input.value, resultsEl);
  });
}

document.addEventListener("DOMContentLoaded", main);
