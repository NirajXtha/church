let state = {
  lang: "nepali",
  dualMode: false,
  verseStack: [],
  currentChapter: null,
  chapterVerses: [],
  singleVerseItems: null,
  selectedSongId: null,
  songActive: false,
  songItems: null,
  verseIndex: 0,
  settings: {
    fontSize: 48,
    textColor: "#ffffff",
    textAlign: "center",
    verseSpacing: 24,
    bgType: null,
    bgPath: null,
    bgPaths: [],
    bgFit: "cover",
    textShadow: "medium",
    songFormat: "verses-only",
    theme: "",
    overlayPosition: "bottom",
    overlayFontSize: 20,
    bgDim: 25,
  },
  overlayOpen: false,
  currentPage: "home",
  testament: "all",
  selectedVerseContext: null,
};

let books = [];
let songs = [];
let previewChunks = [];
let previewSongId = null;

const RECENT_KEY = "cp.recent";
const MAX_RECENT = 8;

document.addEventListener("DOMContentLoaded", init);

function init() {
  setupNavigation();
  setupTheme();
  loadBooks();
  loadSongs();
  setupBibleBrowser();
  setupSearch();
  setupSettings();
  setupStackControls();
  setupSongControls();
  setupContextPanel();
  setupHome();
  setupPresentationBar();
  setupModal();
  setupPresentation();
  setupAutoUpdateUI();
  setupSettingsOverlay();
  renderStack();
  updateStackVisibility();
  updateStackBadge();
  renderHome();
  updateDisplay();
  updateAppVersion();
  updateDisplayStatus();
}

/* ============================================================ Navigation */

function setupNavigation() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchPage(btn.dataset.page));
  });
}

function switchPage(page) {
  state.currentPage = page;
  document.querySelectorAll(".nav-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.page === page);
  });
  document.querySelectorAll(".page").forEach((p) => {
    p.classList.toggle("active", p.id === "page-" + page);
  });
  closeBgPopover();
  if (page === "home") updateDisplay();
  if (page === "stack") {
    renderStack();
    updateStackVisibility();
  }
  updateStackBadge();
}

function escapeHtml(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ============================================================ Theme */

function setupTheme() {
  const toggleBtn = document.getElementById("theme-toggle");
  const saved = localStorage.getItem("uiTheme") || "dark";
  applyTheme(saved);

  toggleBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  });

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("uiTheme", theme);
    const isDark = theme === "dark";
    toggleBtn.textContent = isDark ? "\u2600" : "\u263E";
    toggleBtn.title = isDark ? "Switch to light theme" : "Switch to dark theme";
  }
}

/* ============================================================ Auto update */

let updateBarTimer = null;

function setupAutoUpdateUI() {
  const bar = document.getElementById("update-bar");
  const text = document.getElementById("update-bar-text");
  const btn = document.getElementById("update-bar-btn");
  const sideIndicator = document.getElementById("sidebar-update-indicator");
  const FIFTEEN_DAYS = 15 * 24 * 60 * 60 * 1000;

  function hideAfter(ms) {
    clearTimeout(updateBarTimer);
    updateBarTimer = setTimeout(() => bar.classList.add("hidden"), ms);
  }

  function saveCheckTime() {
    localStorage.setItem("lastUpdateCheck", Date.now());
  }

  function showSideIndicator(inline) {
    if (!sideIndicator) return;
    sideIndicator.classList.remove("hidden");
    if (inline) {
      sideIndicator.title = "Update v" + inline + " available";
      sideIndicator.onclick = () => window.api.startUpdateDownload();
    }
  }

  window.api.onUpdateStatus((data) => {
    console.log("[Update]", data);
    clearTimeout(updateBarTimer);
    bar.classList.remove("hidden");
    btn.classList.add("hidden");
    switch (data.status) {
      case "checking":
        text.textContent = "Checking for updates...";
        hideAfter(10000);
        break;
      case "available":
        text.textContent = "Update v" + data.info.version + " available";
        btn.textContent = "Download";
        btn.classList.remove("hidden");
        btn.onclick = () => window.api.startUpdateDownload();
        showSideIndicator(data.info.version);
        hideAfter(15000);
        saveCheckTime();
        break;
      case "downloading":
        const pct = Math.round(data.progress.percent);
        text.textContent = "Downloading update... " + pct + "%";
        break;
      case "downloaded":
        text.textContent = "Update downloaded — restart to install";
        btn.textContent = "Restart & Install";
        btn.classList.remove("hidden");
        btn.onclick = () => window.api.installUpdate();
        hideAfter(20000);
        break;
      case "up-to-date":
        text.textContent = "You are up to date!";
        hideAfter(3000);
        saveCheckTime();
        break;
      case "error":
        text.textContent =
          "Update check failed: " + (data.message || "unknown error");
        hideAfter(10000);
        saveCheckTime();
        break;
    }
  });

  if (sideIndicator) {
    sideIndicator.addEventListener("click", () => window.api.startUpdateDownload());
  }

  const lastCheck = localStorage.getItem("lastUpdateCheck");
  if (!lastCheck || Date.now() - parseInt(lastCheck) >= FIFTEEN_DAYS) {
    window.api.checkForUpdates();
  }
}

document.getElementById("check-updates-btn").addEventListener("click", () => {
  window.api.checkForUpdates();
  localStorage.setItem("lastUpdateCheck", Date.now());
});

async function updateAppVersion() {
  try {
    const v = await window.api.getAppVersion();
    const el = document.getElementById("app-version");
    const se = document.getElementById("settings-version");
    if (el) el.textContent = "v" + v;
    if (se) se.textContent = "v" + v;
  } catch (e) {
    /* ignore */
  }
}

/* ============================================================ Display status */

async function updateDisplayStatus() {
  try {
    const info = await window.api.getDisplayInfo();
    const presenting = info.presenting;
    let text;
    if (presenting) {
      text = info.hasExternal
        ? "Presenting • Secondary Monitor"
        : "Presenting • Primary";
    } else {
      text = info.hasExternal
        ? "Secondary Monitor Ready"
        : "Presentation Ready";
    }
    const st = document.getElementById("status-text");
    const sd = document.getElementById("status-dot");
    const ss = document.getElementById("sidebar-status-text");
    const sdot = document.getElementById("sidebar-status-dot");
    if (st) st.textContent = text;
    if (sd) sd.classList.toggle("online", presenting);
    if (ss) ss.textContent = presenting ? "Presenting" : "Ready";
    if (sdot) sdot.classList.toggle("online", presenting);
  } catch (e) {
    /* ignore */
  }
}

/* ============================================================ Books / Bible */

async function loadBooks() {
  books = await window.api.getBooks();
  renderBookSelect();
}

function renderBookSelect() {
  const select = document.getElementById("book-select");
  const trigger = document.getElementById("book-trigger");
  const options = document.getElementById("book-options");
  select.innerHTML = "";
  options.innerHTML = "";

  const filtered =
    state.testament === "all"
      ? books
      : books.filter((b) => b.testament === state.testament);

  filtered.forEach((b) => {
    const opt = document.createElement("option");
    opt.value = b.id;
    opt.textContent = state.lang === "nepali" ? b.name_nepali : b.name_english;
    select.appendChild(opt);

    const el = document.createElement("div");
    el.className = "select-filter-option";
    el.dataset.id = b.id;
    el.textContent = opt.textContent;
    el.dataset.label = el.textContent.toLowerCase();
    el.dataset.romanji = (b.romanji || "").toLowerCase();
    el.addEventListener("mousedown", (e) => {
      e.preventDefault();
      selectBook(b);
    });
    options.appendChild(el);
  });

  if (filtered.length > 0) selectBook(filtered[0]);
}

function selectBook(book) {
  const select = document.getElementById("book-select");
  const trigger = document.getElementById("book-trigger");
  const dropdown = document.getElementById("book-dropdown");
  const filter = document.getElementById("book-filter");
  select.value = book.id;
  trigger.textContent =
    state.lang === "nepali" ? book.name_nepali : book.name_english;
  dropdown.classList.add("hidden");
  filter.value = "";
  state.currentChapter = {
    ...state.currentChapter,
    bookId: book.id,
    bookName: book,
  };
  updateBibleCurrent();
  loadChapters(book.id);
}

function updateBibleCurrent() {
  const ch = state.currentChapter;
  if (!ch || !ch.bookName) return;
  const bookEl = document.getElementById("bible-current-book");
  const chapEl = document.getElementById("bible-current-chapter");
  bookEl.textContent =
    state.lang === "nepali" ? ch.bookName.name_nepali : ch.bookName.name_english;
  chapEl.textContent = ch.chapter ? "Chapter " + ch.chapter : "Select chapter";
  document.getElementById("book-select").value = ch.bookId;
}

function filterSelectOptions(optionsContainer, query) {
  const q = query.toLowerCase();
  const items = optionsContainer.querySelectorAll(".select-filter-option");
  let firstMatch = null;
  items.forEach((el) => {
    const label = el.dataset.label || "";
    const romanji = el.dataset.romanji || "";
    const matches = !q || label.includes(q) || romanji.includes(q);
    el.style.display = matches ? "" : "none";
    if (matches && !firstMatch) firstMatch = el;
  });
  return firstMatch;
}

async function loadChapters(bookId) {
  const chapters = await window.api.getChapters(bookId);
  const select = document.getElementById("chapter-select");
  const trigger = document.getElementById("chapter-trigger");
  const options = document.getElementById("chapter-options");
  select.innerHTML = "";
  options.innerHTML = "";

  chapters.forEach((ch) => {
    const opt = document.createElement("option");
    opt.value = ch;
    opt.textContent = "Chapter " + ch;
    select.appendChild(opt);

    const el = document.createElement("div");
    el.className = "select-filter-option";
    el.dataset.value = ch;
    el.textContent = opt.textContent;
    el.dataset.label = el.textContent.toLowerCase();
    el.addEventListener("mousedown", (e) => {
      e.preventDefault();
      selectChapter(ch);
    });
    options.appendChild(el);
  });

  if (chapters.length > 0) selectChapter(chapters[0]);
}

function selectChapter(chapter) {
  const select = document.getElementById("chapter-select");
  const trigger = document.getElementById("chapter-trigger");
  const dropdown = document.getElementById("chapter-dropdown");
  const filter = document.getElementById("chapter-filter");
  select.value = chapter;
  trigger.textContent = "Chapter " + chapter;
  dropdown.classList.add("hidden");
  filter.value = "";
  const bookId = state.currentChapter?.bookId;
  const bk = books.find((b) => b.id === bookId);
  state.currentChapter = {
    bookId: bookId,
    bookName: bk,
    chapter: chapter,
  };
  updateBibleCurrent();
  clearOverlaySelection();
  loadBrowserVerses(bookId, chapter);
}

function setupBibleBrowser() {
  const bookTrigger = document.getElementById("book-trigger");
  const bookDropdown = document.getElementById("book-dropdown");
  const bookFilter = document.getElementById("book-filter");
  const bookOptions = document.getElementById("book-options");
  const chapterTrigger = document.getElementById("chapter-trigger");
  const chapterDropdown = document.getElementById("chapter-dropdown");
  const chapterFilter = document.getElementById("chapter-filter");
  const chapterOptions = document.getElementById("chapter-options");

  document.getElementById("testament-filter").addEventListener("change", (e) => {
    state.testament = e.target.value;
    renderBookSelect();
  });

  bookTrigger.addEventListener("click", () => {
    const isOpen = !bookDropdown.classList.contains("hidden");
    closeAllDropdowns();
    if (!isOpen) {
      bookDropdown.classList.remove("hidden");
      bookFilter.value = "";
      filterSelectOptions(bookOptions, "");
      bookFilter.focus();
    }
  });

  bookFilter.addEventListener("input", () => {
    filterSelectOptions(bookOptions, bookFilter.value);
  });

  chapterTrigger.addEventListener("click", () => {
    const isOpen = !chapterDropdown.classList.contains("hidden");
    closeAllDropdowns();
    if (!isOpen) {
      chapterDropdown.classList.remove("hidden");
      chapterFilter.value = "";
      filterSelectOptions(chapterOptions, "");
      chapterFilter.focus();
    }
  });

  chapterFilter.addEventListener("input", () => {
    filterSelectOptions(chapterOptions, chapterFilter.value);
  });

  function closeAllDropdowns() {
    bookDropdown.classList.add("hidden");
    chapterDropdown.classList.add("hidden");
  }

  document.addEventListener("mousedown", (e) => {
    if (!bookTrigger.contains(e.target) && !bookDropdown.contains(e.target)) {
      bookDropdown.classList.add("hidden");
    }
    if (
      !chapterTrigger.contains(e.target) &&
      !chapterDropdown.contains(e.target)
    ) {
      chapterDropdown.classList.add("hidden");
    }
  });

  function getBookLabel(bookId) {
    const b = books.find((bk) => bk.id === bookId);
    return b
      ? state.lang === "nepali"
        ? b.name_nepali
        : b.name_english
      : "";
  }

  async function refreshPresentationVerses() {
    const pState = await window.api.getPresentationState();
    if (
      !pState.isOpen &&
      !state.singleVerseItems &&
      state.verseStack.length === 0
    )
      return;

    if (state.singleVerseItems && state.currentChapter) {
      const { bookId, chapter } = state.currentChapter;
      const bookLabel = getBookLabel(bookId);
      let verses;
      if (state.dualMode) {
        const result = await window.api.getChapterVersesDual(bookId, chapter);
        const maxLen = Math.max(result.nepali.length, result.english.length);
        verses = [];
        for (let i = 0; i < maxLen; i++) {
          const np = result.nepali[i];
          const en = result.english[i];
          verses.push({
            verse: np ? np.verse : en.verse,
            text: np ? np.text : "",
            textEn: en ? en.text : "",
          });
        }
      } else {
        verses = await window.api.getChapterVerses(bookId, chapter, state.lang);
      }
      state.chapterVerses = verses;
      const items = verses.map((v) => ({
        type: "verse",
        reference: `${getBookLabel(bookId)} ${chapter}:${v.verse}`,
        text: v.text || "",
        textEn: state.dualMode ? v.textEn || "" : null,
      }));
      state.singleVerseItems = items;
      if (state.verseIndex >= items.length) state.verseIndex = 0;
      updateDisplay();
      if (pState.isOpen) presentItems(items, false, state.verseIndex);
    }

    if (state.verseStack.length > 0) {
      await refreshStackVerses(pState.isOpen);
    }
  }

  async function refreshStackVerses(presentationOpen) {
    const groups = {};
    state.verseStack.forEach((s) => {
      const key = `${s.bookId}-${s.chapter}`;
      if (!groups[key])
        groups[key] = { bookId: s.bookId, chapter: s.chapter, verses: [] };
      groups[key].verses.push(s.verse);
    });

    const verseTexts = {};
    if (state.dualMode) {
      for (const key of Object.keys(groups)) {
        const g = groups[key];
        const result = await window.api.getChapterVersesDual(
          g.bookId,
          g.chapter,
        );
        (result.nepali || []).forEach((v) => {
          verseTexts[`${g.bookId}-${g.chapter}-${v.verse}`] = {
            text: v.text,
            textEn: "",
          };
        });
        (result.english || []).forEach((v) => {
          const k = `${g.bookId}-${g.chapter}-${v.verse}`;
          if (verseTexts[k]) verseTexts[k].textEn = v.text;
          else verseTexts[k] = { text: "", textEn: v.text };
        });
      }
    } else {
      for (const key of Object.keys(groups)) {
        const g = groups[key];
        const verses = await window.api.getChapterVerses(
          g.bookId,
          g.chapter,
          state.lang,
        );
        verses.forEach((v) => {
          verseTexts[`${g.bookId}-${g.chapter}-${v.verse}`] = {
            text: v.text,
            textEn: null,
          };
        });
      }
    }

    state.verseStack.forEach((s) => {
      const k = `${s.bookId}-${s.chapter}-${s.verse}`;
      const vt = verseTexts[k];
      if (vt) {
        s.text = vt.text || "";
        s.textEn = state.dualMode ? vt.textEn || "" : null;
      }
      s.reference = `${getBookLabel(s.bookId)} ${s.chapter}:${s.verse}`;
    });

    renderStack();
    updateBrowserStackHighlights();
    updateDisplay();
    updateContextPanel();
    if (presentationOpen) presentStack();
  }

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".lang-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.lang = btn.dataset.lang;
      renderBookSelect();
      refreshPresentationVerses();
    });
  });

  document.getElementById("dual-mode").addEventListener("change", (e) => {
    state.dualMode = e.target.checked;
    if (state.currentChapter) {
      loadBrowserVerses(
        state.currentChapter.bookId,
        state.currentChapter.chapter,
      );
    }
    refreshPresentationVerses();
  });
}

async function loadBrowserVerses(bookId, chapter) {
  const container = document.getElementById("verse-browser");
  const bookName = state.currentChapter?.bookName;
  const bookLabel = bookName
    ? state.lang === "nepali"
      ? bookName.name_nepali
      : bookName.name_english
    : "";

  let verses;
  if (state.dualMode) {
    const result = await window.api.getChapterVersesDual(bookId, chapter);
    const maxLen = Math.max(result.nepali.length, result.english.length);
    verses = [];
    for (let i = 0; i < maxLen; i++) {
      const np = result.nepali[i];
      const en = result.english[i];
      verses.push({
        verse: np ? np.verse : en.verse,
        text: np ? np.text : "",
        textEn: en ? en.text : "",
      });
    }
  } else {
    verses = await window.api.getChapterVerses(bookId, chapter, state.lang);
  }

  state.chapterVerses = verses;
  container.innerHTML = "";

  verses.forEach((v, i) => {
    const el = document.createElement("div");
    el.className = "browser-verse";
    el.dataset.index = i;

    const isStacked = state.verseStack.some(
      (s) => s.bookId === bookId && s.chapter === chapter && s.verse === v.verse,
    );
    if (isStacked) el.classList.add("stacked");

    const preview = (v.text || "").substring(0, 70);
    const label = v.textEn
      ? `<span class="verse-num">${v.verse}</span> <span class="verse-np">${preview}</span> <span class="verse-en">${v.textEn.substring(0, 50)}</span>`
      : `<span class="verse-num">${v.verse}</span> <span class="verse-text">${preview}</span>`;

    el.innerHTML = label;
    el.title = `Double-click: show in presentation\nCtrl+Click: add to stack`;

    el.addEventListener("click", (ev) => {
      if (ev.ctrlKey || ev.metaKey) {
        ev.preventDefault();
        toggleStackVerse(bookId, chapter, v, bookLabel);
        return;
      }
      selectVerseForOverlay(bookId, chapter, v, bookLabel, el);
    });

    el.addEventListener("dblclick", () => {
      showSingleVerse(bookId, chapter, v, bookLabel);
    });

    container.appendChild(el);
  });
}

function buildVerseItems(chapter, bookLabel) {
  return state.chapterVerses.map((v) => {
    const base = {
      type: "verse",
      reference: `${bookLabel} ${chapter}:${v.verse}`,
    };
    if (state.dualMode) {
      return { ...base, text: v.text || "", textEn: v.textEn || "" };
    }
    return { ...base, text: v.text, textEn: null };
  });
}

function showSingleVerse(bookId, chapter, verse, bookLabel) {
  state.songActive = false;
  state.selectedSongId = null;

  const items = buildVerseItems(chapter, bookLabel);
  const startIdx = state.chapterVerses.findIndex((v) => v.verse === verse.verse);
  state.verseIndex = startIdx >= 0 ? startIdx : 0;
  state.singleVerseItems = items;

  updateDisplay();
  presentItems(items, false, state.verseIndex);
  recordRecent(
    `${bookLabel} ${chapter}:${verse.verse}`,
    "Bible Verse",
    "verse",
    items,
    false,
    false,
  );
}

function selectVerseForOverlay(bookId, chapter, verse, bookLabel, el) {
  document
    .querySelectorAll(".browser-verse.selected")
    .forEach((e) => e.classList.remove("selected"));
  el.classList.add("selected");

  state.songActive = false;
  state.selectedSongId = null;

  const items = buildVerseItems(chapter, bookLabel);
  const startIdx = state.chapterVerses.findIndex((v) => v.verse === verse.verse);
  state.verseIndex = startIdx >= 0 ? startIdx : 0;
  state.singleVerseItems = items;

  state.selectedVerseContext = { bookId, chapter, verse, bookLabel };
  updateContextPanel();
  updateDisplay();
  document.getElementById("overlay-send-btn").classList.remove("hidden");
  document.getElementById("remove-overlay-btn").classList.add("hidden");
}

/* ============================================================ Context panel */

function setupContextPanel() {
  document.getElementById("panel-present-btn").addEventListener("click", () => {
    const ctx = state.selectedVerseContext;
    if (ctx) showSingleVerse(ctx.bookId, ctx.chapter, ctx.verse, ctx.bookLabel);
  });
  document.getElementById("panel-stack-btn").addEventListener("click", () => {
    const ctx = state.selectedVerseContext;
    if (ctx) toggleStackVerse(ctx.bookId, ctx.chapter, ctx.verse, ctx.bookLabel);
  });
  document.getElementById("panel-overlay-btn").addEventListener("click", () => {
    const ctx = state.selectedVerseContext;
    if (ctx) sendSelectedToOverlay();
  });
}

function updateContextPanel() {
  const refEl = document.getElementById("selected-ref");
  const npEl = document.getElementById("selected-np");
  const enEl = document.getElementById("selected-en");
  const statusEl = document.getElementById("selected-stack-status");
  const presentBtn = document.getElementById("panel-present-btn");
  const stackBtn = document.getElementById("panel-stack-btn");
  const overlayBtn = document.getElementById("panel-overlay-btn");
  const ctx = state.selectedVerseContext;

  if (!ctx || !ctx.verse) {
    refEl.textContent = "No verse selected";
    npEl.textContent = "";
    enEl.textContent = "";
    enEl.classList.add("hidden");
    statusEl.classList.add("hidden");
    presentBtn.disabled = true;
    stackBtn.disabled = true;
    overlayBtn.disabled = true;
    return;
  }

  const { bookId, chapter, verse, bookLabel } = ctx;
  refEl.textContent = `${bookLabel} ${chapter}:${verse.verse}`;
  npEl.textContent = verse.text || verse.textEn || "";
  enEl.textContent = verse.textEn || "";
  enEl.classList.toggle("hidden", !verse.textEn);

  const isStacked = state.verseStack.some(
    (s) =>
      s.bookId === bookId && s.chapter === chapter && s.verse === verse.verse,
  );
  statusEl.classList.toggle("hidden", !isStacked);

  presentBtn.disabled = false;
  stackBtn.disabled = false;
  overlayBtn.disabled = false;
  stackBtn.textContent = isStacked ? "Remove from Stack" : "Add to Stack";
}

async function sendSelectedToOverlay() {
  if (state.singleVerseItems && state.singleVerseItems.length > 0) {
    if (!state.overlayOpen) {
      await window.api.openOverlay();
      await window.api.setOverlayPosition(state.settings.overlayPosition);
      state.overlayOpen = true;
    }
    updateOverlayContent();
  }
  document.getElementById("overlay-send-btn").classList.add("hidden");
  document.getElementById("remove-overlay-btn").classList.remove("hidden");
  document
    .querySelectorAll(".browser-verse.selected")
    .forEach((e) => e.classList.remove("selected"));
}

function clearOverlaySelection() {
  state.selectedVerseContext = null;
  updateContextPanel();
  document.getElementById("overlay-send-btn").classList.add("hidden");
  document
    .querySelectorAll(".browser-verse.selected")
    .forEach((e) => e.classList.remove("selected"));
}

/* ============================================================ Display / preview */

function renderLivePreviewBg() {
  const area = document.getElementById("display-area");
  if (!area) return;
  if (state.settings.bgType === "image" && state.settings.bgPath) {
    const url = "file:///" + state.settings.bgPath.replace(/\\/g, "/");
    area.style.backgroundImage = `url('${url}')`;
  } else {
    area.style.backgroundImage = "";
    area.style.background = "linear-gradient(160deg, #0b0d12, #151a24)";
  }
}

function syncControlBar() {
  const fv = document.getElementById("ctrl-font-value");
  const sv = document.getElementById("ctrl-spacing-value");
  if (fv) fv.textContent = state.settings.fontSize;
  if (sv) sv.textContent = state.settings.verseSpacing;
  document
    .querySelectorAll("#align-group button")
    .forEach((b) => b.classList.toggle("active", b.dataset.align === state.settings.textAlign));
}

function updateDisplay() {
  const area = document.getElementById("display-area");
  if (!area) return;
  area.innerHTML = "";

  if (state.songActive && state.songItems && state.songItems.length > 0) {
    const idx = state.verseIndex;
    const item = state.songItems[idx];
    const div = document.createElement("div");
    div.className = "verse-item";
    div.style.fontSize = Math.round(state.settings.fontSize * 0.6) + "px";
    div.style.color = state.settings.textColor;
    div.style.textAlign = state.settings.textAlign;
    const titleEl = document.createElement("div");
    titleEl.style.cssText =
      "font-size:0.8em;opacity:0.6;margin-bottom:12px;font-weight:600;letter-spacing:1px";
    titleEl.textContent = item.title;
    div.appendChild(titleEl);
    const p = document.createElement("div");
    p.innerHTML = item.text
      .split("\n")
      .map((l) => (l.trim() === "" ? "<br>" : l))
      .join("\n");
    div.appendChild(p);
    area.appendChild(div);
    if (state.songItems.length > 1) {
      const nav = document.createElement("div");
      nav.className = "main-nav-hint";
      nav.textContent = `${idx + 1} / ${state.songItems.length}`;
      area.appendChild(nav);
    }
  } else if (state.singleVerseItems && state.singleVerseItems.length > 0) {
    const idx = state.verseIndex;
    const item = state.singleVerseItems[idx];
    const div = document.createElement("div");
    div.className = "verse-item";
    div.style.fontSize = Math.round(state.settings.fontSize * 0.6) + "px";
    div.style.color = state.settings.textColor;
    div.style.textAlign = state.settings.textAlign;

    if (item.textEn) {
      const dualDiv = document.createElement("div");
      dualDiv.className = "dual-verse";
      const npDiv = document.createElement("div");
      npDiv.className = "dual-np";
      npDiv.textContent = item.text;
      const enDiv = document.createElement("div");
      enDiv.className = "dual-en";
      enDiv.textContent = item.textEn;
      dualDiv.appendChild(npDiv);
      dualDiv.appendChild(enDiv);
      div.appendChild(dualDiv);
    } else {
      const textEl = document.createElement("div");
      textEl.textContent = item.text;
      div.appendChild(textEl);
    }
    const refEl = document.createElement("span");
    refEl.className = "verse-ref";
    refEl.textContent = item.reference;
    div.appendChild(refEl);
    area.appendChild(div);

    if (state.singleVerseItems.length > 1) {
      const nav = document.createElement("div");
      nav.className = "main-nav-hint";
      nav.textContent = `${idx + 1} / ${state.singleVerseItems.length}`;
      area.appendChild(nav);
    }
  } else if (state.verseStack.length > 0) {
    state.verseStack.forEach((item, i) => {
      const div = document.createElement("div");
      div.className = "verse-item";
      div.style.marginBottom =
        i < state.verseStack.length - 1
          ? state.settings.verseSpacing * 1.5 + "px"
          : "0";
      div.style.fontSize = Math.round(state.settings.fontSize * 0.6) + "px";
      div.style.color = state.settings.textColor;
      div.style.textAlign = state.settings.textAlign;
      const textEl = document.createElement("div");
      textEl.textContent = item.text;
      div.appendChild(textEl);
      const refEl = document.createElement("span");
      refEl.className = "verse-ref";
      refEl.textContent = item.reference;
      div.appendChild(refEl);
      area.appendChild(div);
    });
  } else {
    area.innerHTML =
      '<div class="display-empty">Select content to preview</div>';
  }

  const pnav = document.getElementById("preview-nav");
  if (pnav) {
    if (state.singleVerseItems && state.singleVerseItems.length > 1) {
      pnav.textContent = `${state.verseIndex + 1} / ${state.singleVerseItems.length}`;
    } else if (state.songItems && state.songItems.length > 1) {
      pnav.textContent = `${state.verseIndex + 1} / ${state.songItems.length}`;
    } else {
      pnav.textContent = "";
    }
  }
  renderLivePreviewBg();
  syncControlBar();
}

/* ============================================================ Stack */

function updateStackVisibility() {
  const has = state.verseStack.length > 0;
  const section = document.getElementById("stack-section");
  const empty = document.getElementById("stack-empty");
  if (section) section.style.display = has ? "" : "none";
  if (empty) empty.style.display = has ? "none" : "";
}

function updateStackBadge() {
  const badge = document.getElementById("stack-count-dot");
  if (badge) badge.classList.toggle("hidden", state.verseStack.length === 0);
}

function toggleStackVerse(bookId, chapter, verse, bookLabel) {
  const existing = state.verseStack.findIndex(
    (s) => s.bookId === bookId && s.chapter === chapter && s.verse === verse.verse,
  );
  if (existing >= 0) {
    state.verseStack.splice(existing, 1);
  } else {
    state.verseStack.push({
      bookId,
      chapter,
      verse: verse.verse,
      text: verse.text || verse.textEn || "",
      textEn: verse.textEn || null,
      reference: `${bookLabel} ${chapter}:${verse.verse}`,
    });
  }

  state.singleVerseItems = null;
  renderStack();
  updateBrowserStackHighlights();
  updateDisplay();
  updateContextPanel();
  updateStackVisibility();
  updateStackBadge();
}

function updateBrowserStackHighlights() {
  document.querySelectorAll(".browser-verse").forEach((el) => {
    el.classList.remove("stacked");
  });
  if (!state.currentChapter) return;
  const bk = state.currentChapter.bookId;
  const ch = state.currentChapter.chapter;
  state.verseStack.forEach((s) => {
    if (s.bookId === bk && s.chapter === ch) {
      const idx = state.chapterVerses.findIndex((v) => v.verse === s.verse);
      const el = document.querySelector(`.browser-verse[data-index="${idx}"]`);
      if (el) el.classList.add("stacked");
    }
  });
}

function renderStack() {
  const container = document.getElementById("stack-list");
  if (!container) return;
  container.innerHTML = "";

  const countEl = document.getElementById("stack-count");
  if (countEl) {
    countEl.textContent =
      state.verseStack.length +
      (state.verseStack.length === 1 ? " verse" : " verses");
  }

  let dragIndex = null;

  state.verseStack.forEach((item, i) => {
    const el = document.createElement("div");
    el.className = "stack-item";
    el.draggable = true;
    el.dataset.index = i;
    el.innerHTML = `
      <span class="stack-handle" title="Drag to reorder">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="9" cy="6" r="1.2" /><circle cx="15" cy="6" r="1.2" />
          <circle cx="9" cy="12" r="1.2" /><circle cx="15" cy="12" r="1.2" />
          <circle cx="9" cy="18" r="1.2" /><circle cx="15" cy="18" r="1.2" />
        </svg>
      </span>
      <div class="stack-content">
        <div class="stack-ref">${escapeHtml(item.reference || "")}</div>
        <div class="stack-text">${escapeHtml(item.text || item.textEn || "")}</div>
      </div>
      <button class="remove-verse" data-index="${i}">&times;</button>
    `;

    el.querySelector(".remove-verse").addEventListener("click", () => {
      state.verseStack.splice(i, 1);
      renderStack();
      updateBrowserStackHighlights();
      updateDisplay();
      updateContextPanel();
      updateStackVisibility();
      updateStackBadge();
    });

    el.addEventListener("dragstart", (e) => {
      dragIndex = i;
      el.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    el.addEventListener("dragover", (e) => e.preventDefault());
    el.addEventListener("dragend", () => {
      dragIndex = null;
      el.classList.remove("dragging");
    });
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      el.classList.remove("dragging");
      if (dragIndex !== null && dragIndex !== i) {
        const [moved] = state.verseStack.splice(dragIndex, 1);
        state.verseStack.splice(i, 0, moved);
        renderStack();
        updateBrowserStackHighlights();
        updateDisplay();
      }
      dragIndex = null;
    });

    container.appendChild(el);
  });

  updateStackVisibility();
  updateStackBadge();
}

function setupStackControls() {
  document.getElementById("present-stack-btn").addEventListener("click", () => {
    if (state.verseStack.length === 0) return;
    state.songActive = false;
    state.selectedSongId = null;
    state.singleVerseItems = null;
    presentStack();
  });

  document.getElementById("clear-stack-btn").addEventListener("click", () => {
    state.verseStack = [];
    renderStack();
    updateBrowserStackHighlights();
    updateDisplay();
    updateStackVisibility();
    updateStackBadge();
    updateContextPanel();
  });
}

async function presentStack() {
  const items = state.verseStack.map((v) => ({
    type: "verse",
    text: v.text,
    textEn: v.textEn,
    reference: v.reference,
  }));
  state.verseIndex = 0;
  recordRecent(
    "Presentation Stack",
    `${items.length} verse${items.length === 1 ? "" : "s"}`,
    "stack",
    items,
    false,
    true,
  );
  await presentItems(items, false, 0, true);
}

function navigateChapter(direction) {
  if (!state.singleVerseItems || state.singleVerseItems.length < 2) return;
  const newIdx = state.verseIndex + direction;
  if (newIdx < 0 || newIdx >= state.singleVerseItems.length) return;
  state.verseIndex = newIdx;
  clearOverlaySelection();
  updateDisplay();
  presentItems(state.singleVerseItems, false, state.verseIndex, false, true);
}

function navigateSong(direction) {
  if (!state.songItems || state.songItems.length < 2) return;
  const newIdx = state.verseIndex + direction;
  if (newIdx < 0 || newIdx >= state.songItems.length) return;
  state.verseIndex = newIdx;
  clearOverlaySelection();
  updateDisplay();
  presentItems(state.songItems, true, state.verseIndex, false, true);
  highlightSongChunk(newIdx);
}

function pickRandomUserBg() {
  if (state.settings.bgPaths && state.settings.bgPaths.length > 1) {
    const path =
      state.settings.bgPaths[
        Math.floor(Math.random() * state.settings.bgPaths.length)
      ];
    state.settings.bgPath = path;
    state.settings.bgType = "image";
  }
}

async function presentItems(items, isSong, startIndex, isStack, preserveBg) {
  console.info(
    "[presentItems] preserveBg=",
    preserveBg,
    "theme=",
    state.settings.theme,
    "bgPath=",
    state.settings.bgPath,
  );
  const pState = await window.api.getPresentationState();
  if (preserveBg === undefined && pState.isOpen) {
    console.info(
      "[presentItems] !!! preserveBg was UNDEFINED but window ALREADY OPEN -> clamping to NAVIGATION (preserveBg=true)",
    );
    preserveBg = true;
  }
  if (preserveBg === undefined) {
    console.info(
      "[presentItems] preserveBg is UNDEFINED + window closed -> this is a FRESH OPEN, caller stack:\n" +
        new Error().stack.split("\n").slice(1, 5).join("\n"),
    );
  }
  if (!preserveBg) {
    console.info("[presentItems] => re-randomizing background (fresh open only)");
    if (state.settings.theme === "random") {
      await applyThemeBackground("random");
    } else if (!state.settings.theme && state.settings.bgPaths.length > 1) {
      pickRandomUserBg();
    }
  } else {
    console.info("[presentItems] => preserveBg, NOT re-randomizing");
  }
  const data = {
    items: items,
    settings: { ...state.settings },
    bgType: state.settings.bgType,
    bgPath: state.settings.bgPath,
    bgPaths: state.settings.bgPaths,
    bgFit: state.settings.bgFit,
    isSong: isSong || false,
    songActive: state.songActive || false,
    verseIndex: startIndex || 0,
    isStack: isStack || false,
  };
  if (pState.isOpen) {
    await window.api.sendToPresentation(data);
  } else {
    await window.api.openPresentation();
    setTimeout(() => window.api.sendToPresentation(data), 300);
  }
  updateDisplayStatus();
}

/* ============================================================ Search */

function setupSearch() {
  document.getElementById("search-btn").addEventListener("click", async () => {
    const keyword = document.getElementById("bible-search").value.trim();
    if (!keyword) return;
    clearOverlaySelection();

    let results;
    if (state.dualMode) {
      const r = await window.api.searchVersesDual(keyword);
      const map = new Map();
      r.nepali.forEach((v) => {
        const key = v.book + "-" + v.chapter + "-" + v.verse;
        map.set(key, { ...v, textEn: "" });
      });
      r.english.forEach((v) => {
        const key = v.book + "-" + v.chapter + "-" + v.verse;
        const existing = map.get(key);
        if (existing) {
          existing.textEn = v.text;
        } else {
          map.set(key, { ...v, text: "", textEn: v.text });
        }
      });
      results = Array.from(map.values()).map((v) => ({
        type: "verse",
        text: v.text,
        textEn: v.textEn || null,
        book: v.book,
        chapter: v.chapter,
        verse: v.verse,
        book_nepali: v.book_nepali,
        book_english: v.book_english,
        reference: `${state.lang === "nepali" ? v.book_nepali : v.book_english} ${v.chapter}:${v.verse}`,
      }));
    } else {
      const r = await window.api.searchVerses(keyword, state.lang);
      results = r.map((v) => ({
        type: "verse",
        text: v.text,
        textEn: null,
        book: v.book,
        chapter: v.chapter,
        verse: v.verse,
        book_nepali: v.book_nepali,
        book_english: v.book_english,
        reference: `${state.lang === "nepali" ? v.book_nepali : v.book_english} ${v.chapter}:${v.verse}`,
      }));
    }

    const container = document.getElementById("verse-browser");
    container.innerHTML =
      '<div class="search-header">' +
      results.length +
      " results for &quot;" +
      escapeHtml(keyword) +
      '&quot; <button id="clear-search-btn" class="btn-small">Clear</button></div>';

    results.forEach((item, i) => {
      const el = document.createElement("div");
      el.className = "browser-verse";
      el.dataset.index = i;
      const preview = (item.text || "").substring(0, 70);
      const label = item.textEn
        ? `<span class="verse-num">${i + 1}</span> <span class="verse-np">${preview}</span> <span class="verse-en">${item.textEn.substring(0, 50)}</span>`
        : `<span class="verse-num">${i + 1}</span> <span class="verse-text">${preview}</span>`;
      el.innerHTML = label + `<div class="verse-ref">${item.reference}</div>`;
      el.title = "Double-click: show in presentation\nCtrl+Click: add to stack";
      const bookLabel =
        state.lang === "nepali" ? item.book_nepali : item.book_english;
      el.addEventListener("click", (ev) => {
        if (ev.ctrlKey || ev.metaKey) {
          ev.preventDefault();
          toggleStackVerse(item.book, item.chapter, item, bookLabel);
          return;
        }
        selectVerseForOverlay(item.book, item.chapter, item, bookLabel, el);
      });
      el.addEventListener("dblclick", () => {
        state.verseIndex = i;
        updateDisplay();
        presentItems(results, false, state.verseIndex);
        recordRecent(
          item.reference,
          "Bible Verse",
          "verse",
          results,
          false,
          false,
        );
      });
      container.appendChild(el);
    });

    state.singleVerseItems = results;
    state.chapterVerses = results;
    state.verseIndex = 0;
    updateDisplay();

    document
      .getElementById("clear-search-btn")
      .addEventListener("click", () => {
        document.getElementById("bible-search").value = "";
        if (state.currentChapter) {
          loadBrowserVerses(
            state.currentChapter.bookId,
            state.currentChapter.chapter,
          );
        }
      });
  });

  document.getElementById("bible-search").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("search-btn").click();
  });

  document.getElementById("song-search").addEventListener("input", (e) => {
    renderSongList(
      e.target.value,
      document.getElementById("song-category-filter").value,
    );
  });

  document
    .getElementById("song-category-filter")
    .addEventListener("change", (e) => {
      renderSongList(document.getElementById("song-search").value, e.target.value);
    });
}

/* ============================================================ Songs */

async function loadSongs() {
  songs = await window.api.getAllSongs();
  populateCategoryFilter();
  renderSongList();
}

function renderSongList(filter, category) {
  const container = document.getElementById("song-list");
  container.innerHTML = "";
  let list = songs;
  if (category) {
    list = list.filter((s) => s.category === category);
  }
  if (filter) {
    const f = filter.toLowerCase();
    list = list.filter(
      (s) =>
        s.title.toLowerCase().includes(f) ||
        (s.category && s.category.toLowerCase().includes(f)) ||
        (s.tags && s.tags.toLowerCase().includes(f)),
    );
  }
  list.forEach((s) => {
    const el = document.createElement("div");
    el.className =
      "song-item" + (state.selectedSongId === s.id ? " active" : "");
    const tags = s.tags
      ? s.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    const tagsHtml = tags.length
      ? `<div class="song-tags">${tags.map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`).join("")}</div>`
      : "";
    el.innerHTML = `
      <div>
        <div class="song-title">${escapeHtml(s.title)}</div>
        <div class="song-meta">${escapeHtml(s.category || "")}${s.language ? " | " + escapeHtml(s.language) : ""}${s.author ? " | " + escapeHtml(s.author) : ""}</div>
        ${tagsHtml}
      </div>
    `;
    el.addEventListener("click", () => showLyricsPreview(s.id));
    el.addEventListener("dblclick", () => displaySong(s.id));
    container.appendChild(el);
  });
  if (!list.length) {
    container.innerHTML =
      '<div class="lyrics-placeholder" style="padding:16px">No songs match</div>';
  }
}

function populateCategoryFilter() {
  const cats = [
    ...new Set(songs.map((s) => s.category).filter(Boolean)),
  ].sort();
  const sel = document.getElementById("song-category-filter");
  const cur = sel.value;
  sel.innerHTML =
    '<option value="">All</option>' +
    cats.map((c) => `<option value="${c}">${c}</option>`).join("");
  sel.value = cur || "";
  renderSongFilters();
}

function renderSongFilters() {
  const wrap = document.getElementById("song-filters");
  if (!wrap) return;
  const cats = [...new Set(songs.map((s) => s.category).filter(Boolean))].sort();
  const currentCat = document.getElementById("song-category-filter").value;

  const make = (value, label) => {
    const chip = document.createElement("button");
    chip.className = "song-filter-chip" + (currentCat === value ? " active" : "");
    chip.textContent = label;
    chip.addEventListener("click", () => {
      document.getElementById("song-category-filter").value = value;
      renderSongFilters();
      renderSongList(
        document.getElementById("song-search").value,
        value,
      );
    });
    wrap.appendChild(chip);
  };

  make("", "All");
  cats.forEach((c) => make(c, c));

  const select = document.getElementById("song-category-filter");
  select.onchange = () => {
    renderSongFilters();
    renderSongList(document.getElementById("song-search").value, select.value);
  };
}

async function showLyricsPreview(id) {
  state.selectedSongId = id;
  previewSongId = id;
  document.querySelectorAll(".song-item").forEach((el) => el.classList.remove("active"));
  const lyrics = await window.api.getSongLyrics(id);
  previewChunks = lyrics.lyrics.split(/\n\n+/).filter((v) => v.trim());

  const infoPanel = document.getElementById("song-info-panel");
  const infoTitle = document.getElementById("song-info-title");
  const infoCategory = document.getElementById("song-info-category");
  const infoLanguage = document.getElementById("song-info-language");
  const infoAuthor = document.getElementById("song-info-author");
  const infoTags = document.getElementById("song-info-tags");

  infoPanel.classList.remove("hidden");
  infoTitle.textContent = lyrics.title;
  infoCategory.textContent = lyrics.category ? "Category: " + lyrics.category : "";
  infoLanguage.textContent = lyrics.language ? "Language: " + lyrics.language : "";
  infoAuthor.textContent = lyrics.author ? "Author: " + lyrics.author : "";
  infoTags.innerHTML = "";

  const tagList = (lyrics.tags || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  tagList.forEach((t) => {
    const chip = document.createElement("span");
    chip.className = "tag-chip";
    chip.textContent = t;
    infoTags.appendChild(chip);
  });

  const container = document.getElementById("song-lyrics-preview");
  container.innerHTML = "";
  previewChunks.forEach((chunk, i) => {
    const el = document.createElement("div");
    el.className = "lyrics-chunk";
    el.dataset.index = i;
    el.textContent = chunk.trim();
    el.addEventListener("click", () => onChunkClick(i));
    container.appendChild(el);
  });

  document.querySelectorAll(".song-item").forEach((el) => {
    el.classList.toggle(
      "active",
      el.querySelector(".song-title")?.textContent === lyrics.title,
    );
  });
}

function onChunkClick(index) {
  displaySongFromIndex(previewSongId, index);
}

async function displaySongFromIndex(id, startIndex) {
  const data = await window.api.getSongLyrics(id);
  const verses = data.lyrics.split(/\n\n+/).filter((v) => v.trim());
  const items = verses.map((v) => ({
    type: "song",
    text: v.trim(),
    title: data.title,
  }));
  state.songActive = true;
  state.selectedSongId = id;
  state.verseIndex = startIndex;
  state.singleVerseItems = null;
  state.songItems = items;
  updateDisplay();
  presentItems(items, true, startIndex);
  highlightSongChunk(startIndex);
}

function highlightSongChunk(index) {
  document.querySelectorAll(".lyrics-chunk").forEach((el, i) => {
    el.classList.toggle("active", i === index);
  });
}

async function displaySong(id) {
  const data = await window.api.getSongLyrics(id);
  const verses = data.lyrics.split(/\n\n+/).filter((v) => v.trim());
  const items = verses.map((v) => ({
    type: "song",
    text: v.trim(),
    title: data.title,
  }));
  state.songActive = true;
  state.selectedSongId = id;
  state.verseIndex = 0;
  state.singleVerseItems = null;
  state.songItems = items;
  updateDisplay();
  presentItems(items, true, 0);
  highlightSongChunk(0);
  recordRecent(data.title, "Song", "song", items, true, false);
}

/* ============================================================ Settings */

function setupSettings() {
  const fontSize = document.getElementById("font-size");
  const fontSizeLabel = document.getElementById("font-size-label");
  fontSize.addEventListener("input", () => {
    state.settings.fontSize = parseInt(fontSize.value);
    fontSizeLabel.textContent = state.settings.fontSize + "px";
    updateDisplay();
    sendSettings();
  });

  const textColor = document.getElementById("text-color");
  textColor.addEventListener("input", () => {
    state.settings.textColor = textColor.value;
    updateDisplay();
    sendSettings();
  });

  const textAlign = document.getElementById("text-align");
  textAlign.addEventListener("change", () => {
    state.settings.textAlign = textAlign.value;
    updateDisplay();
    sendSettings();
  });

  const verseSpacing = document.getElementById("verse-spacing");
  const verseSpacingLabel = document.getElementById("verse-spacing-label");
  verseSpacing.addEventListener("input", () => {
    state.settings.verseSpacing = parseInt(verseSpacing.value);
    verseSpacingLabel.textContent = state.settings.verseSpacing + "px";
    updateDisplay();
    sendSettings();
  });

  const textShadow = document.getElementById("text-shadow");
  textShadow.addEventListener("change", () => {
    state.settings.textShadow = textShadow.value;
    sendSettings();
  });

  document
    .getElementById("select-image-btn")
    .addEventListener("click", selectImageDialog);
  document
    .getElementById("select-video-btn")
    .addEventListener("click", selectVideoDialog);
  document
    .getElementById("clear-bg-btn")
    .addEventListener("click", clearBackground);

  document.getElementById("bg-fit").addEventListener("change", (e) => {
    state.settings.bgFit = e.target.value;
    sendSettings();
  });

  document.getElementById("song-format").addEventListener("change", (e) => {
    state.settings.songFormat = e.target.value;
    sendSettings();
  });

  const bgDim = document.getElementById("bg-dim");
  const bgDimLabel = document.getElementById("bg-dim-label");
  bgDim.addEventListener("input", () => {
    state.settings.bgDim = parseInt(bgDim.value);
    bgDimLabel.textContent = state.settings.bgDim + "%";
    resendToPresentation();
  });

  document.getElementById("theme-select").addEventListener("change", async (e) => {
    state.settings.theme = e.target.value;
    if (state.settings.theme !== "random") {
      await applyThemeBackground(state.settings.theme);
    }
    resendToPresentation();
  });

  document.getElementById("overlay-position").addEventListener("change", async (e) => {
    state.settings.overlayPosition = e.target.value;
    await window.api.setOverlayPosition(e.target.value);
  });

  const ofs = document.getElementById("overlay-font-size");
  const ofsLabel = document.getElementById("overlay-font-size-label");
  ofs.addEventListener("input", async () => {
    state.settings.overlayFontSize = parseInt(ofs.value);
    ofsLabel.textContent = state.settings.overlayFontSize + "px";
    await window.api.updateOverlay({
      fontSize: state.settings.overlayFontSize,
    });
  });

  document
    .getElementById("overlay-send-btn")
    .addEventListener("click", sendSelectedToOverlay);

  document
    .getElementById("remove-overlay-btn")
    .addEventListener("click", async () => {
      if (state.overlayOpen) {
        await window.api.closeOverlay();
        state.overlayOpen = false;
        document.getElementById("remove-overlay-btn").classList.add("hidden");
      }
    });

  // Data transfer handlers
  const showStatus = (msg, isError = false) => {
    const el = document.getElementById("transfer-status");
    el.textContent = msg;
    el.className = "transfer-status " + (isError ? "error" : "success");
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 5000);
  };

  document.getElementById("export-songs-btn").addEventListener("click", async () => {
    try {
      const data = await window.api.exportSongs();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `songs-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showStatus(`Exported ${data.songs.length} songs`);
    } catch (e) {
      showStatus("Export failed: " + e.message, true);
    }
  });

  document.getElementById("import-songs-btn").addEventListener("click", async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const result = await window.api.importSongs(data);
        if (result.success) {
          showStatus(`Imported ${result.count} songs`);
          updateDisplay();
          sendSettings();
        } else {
          showStatus("Import failed: " + result.error, true);
        }
      } catch (e) {
        showStatus("Import failed: " + e.message, true);
      }
    };
    input.click();
  });

  document.getElementById("export-db-btn").addEventListener("click", async () => {
    try {
      const data = await window.api.exportDatabase();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `database-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showStatus("Exported full database");
    } catch (e) {
      showStatus("Export failed: " + e.message, true);
    }
  });

  document.getElementById("import-db-btn").addEventListener("click", async () => {
    if (!confirm("This will REPLACE all data (songs, settings, recent, stack). Continue?")) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const result = await window.api.importDatabase(data);
        if (result.success) {
          showStatus("Database imported successfully - reloading...");
          setTimeout(() => location.reload(), 1500);
        } else {
          showStatus("Import failed: " + result.error, true);
        }
      } catch (e) {
        showStatus("Import failed: " + e.message, true);
      }
    };
    input.click();
  });
}

function setupSettingsOverlay() {
  const show = document.getElementById("settings-overlay-btn");
  if (show) {
    show.addEventListener("click", () => {
      if (!state.overlayOpen) {
        window.api.openOverlay().then(() => {
          window.api.setOverlayPosition(state.settings.overlayPosition);
          state.overlayOpen = true;
          updateOverlayContent();
        });
      } else {
        updateOverlayContent();
      }
    });
  }
  const close = document.getElementById("settings-overlay-close-btn");
  if (close) {
    close.addEventListener("click", async () => {
      if (state.overlayOpen) {
        await window.api.closeOverlay();
        state.overlayOpen = false;
      }
    });
  }
}

async function selectImageDialog() {
  const paths = await window.api.selectFile("image");
  if (paths && paths.length > 0) {
    state.settings.theme = "";
    document.getElementById("theme-select").value = "";
    state.settings.bgType = "image";
    state.settings.bgPaths = paths;
    state.settings.bgPath = paths[Math.floor(Math.random() * paths.length)];
    updateBgPreview();
    resendToPresentation();
  }
}

async function selectVideoDialog() {
  const path = await window.api.selectFile("video");
  if (path) {
    state.settings.theme = "";
    document.getElementById("theme-select").value = "";
    state.settings.bgType = "video";
    state.settings.bgPath = path;
    updateBgPreview();
    resendToPresentation();
  }
}

function clearBackground() {
  state.settings.theme = "";
  state.settings.bgType = null;
  state.settings.bgPath = null;
  state.settings.bgPaths = [];
  document.getElementById("theme-select").value = "";
  updateBgPreview();
  resendToPresentation();
}

function updateBgPreview() {
  const preview = document.getElementById("bg-preview");
  if (!preview) return;
  preview.style.backgroundImage = "";
  preview.classList.remove("has-bg");
  preview.textContent = "";
  if (state.settings.bgType === "image" && state.settings.bgPath) {
    const fileUrl = "file:///" + state.settings.bgPath.replace(/\\/g, "/");
    preview.style.backgroundImage = `url('${fileUrl}')`;
    preview.classList.add("has-bg");
    preview.textContent =
      state.settings.bgPaths.length > 1
        ? state.settings.bgPaths.length + " images"
        : "";
  } else if (state.settings.bgType === "video" && state.settings.bgPath) {
    const fileUrl = "file:///" + state.settings.bgPath.replace(/\\/g, "/");
    preview.innerHTML = "";
    preview.style.background = "#1d2330";
    preview.classList.add("has-bg");
    const vid = document.createElement("video");
    vid.src = fileUrl;
    vid.muted = true;
    vid.loop = true;
    vid.autoplay = true;
    vid.playsInline = true;
    vid.style.width = "100%";
    vid.style.height = "100%";
    vid.style.objectFit = "cover";
    preview.appendChild(vid);
  }
}

const THEME_ENTRIES = [
  { id: "christmas", file: "Christmas.jpg", label: "Christmas" },
  { id: "book-ring", file: "book-ring.jpg", label: "Book Ring" },
  { id: "book", file: "book.jpg", label: "Book" },
  { id: "candle", file: "candle.png", label: "Candle" },
  { id: "cross-sky", file: "cross-sky.jpg", label: "Cross Sky" },
  { id: "cross", file: "cross.jpg", label: "Cross" },
  { id: "dark", file: "dark.jpg", label: "Dark" },
  { id: "flowers", file: "flowers.jpg", label: "Flowers" },
  { id: "man-standing", file: "man-standing.jpg", label: "Man Standing" },
  { id: "ribbon", file: "ribbon.jpg", label: "Ribbon" },
  { id: "rose", file: "rose.jpg", label: "Rose" },
  { id: "sunset-cross", file: "sunset-cross.jpg", label: "Sunset Cross" },
];

function getThemeFile(theme) {
  if (!theme || theme === "") return null;
  if (theme === "random") {
    const idx = Math.floor(Math.random() * THEME_ENTRIES.length);
    return THEME_ENTRIES[idx].file;
  }
  const entry = THEME_ENTRIES.find((e) => e.id === theme);
  return entry ? entry.file : null;
}

async function applyThemeBackground(theme) {
  const file = getThemeFile(theme);
  if (file) {
    state.settings.bgType = "image";
    state.settings.bgPath = await window.api.getAssetPath(file);
    updateBgPreview();
  } else {
    document.getElementById("theme-select").value = "";
    if (!state.settings.bgPath) {
      updateBgPreview();
    }
  }
}

async function updateOverlayContent() {
  let text = "";
  let reference = "";
  if (state.singleVerseItems && state.singleVerseItems.length > 0) {
    const item = state.singleVerseItems[state.verseIndex];
    text = item.textEn ? `${item.text} / ${item.textEn}` : item.text;
    reference = item.reference;
  } else if (state.verseStack.length > 0) {
    text = state.verseStack.map((v) => v.text).join(" | ");
    reference = state.verseStack.map((v) => v.reference).join(", ");
  }
  await window.api.updateOverlay({
    text,
    reference,
    position: state.settings.overlayPosition,
    fontSize: state.settings.overlayFontSize,
  });
}

/* ============================================================ Song controls / CRUD */

function setupSongControls() {
  document
    .getElementById("display-song-btn")
    .addEventListener("click", async () => {
      if (state.selectedSongId) displaySong(state.selectedSongId);
    });

  document
    .getElementById("song-lyrics-preview")
    .addEventListener("dblclick", async () => {
      if (state.selectedSongId) displaySong(state.selectedSongId);
    });

  document.getElementById("edit-song-btn").addEventListener("click", () => {
    openSongEditModal(state.selectedSongId);
  });
}

async function openSongEditModal(id) {
  if (!id) return;
  const modal = document.getElementById("song-modal");
  const deleteBtn = document.getElementById("song-delete-btn");
  const data = await window.api.getSongLyrics(id);
  document.getElementById("song-title").value = data.title;
  document.getElementById("song-lyrics").value = data.lyrics;
  document.getElementById("song-category").value = data.category || "";
  document.getElementById("song-language").value = data.language || "";
  document.getElementById("song-author").value = data.author || "";
  document.getElementById("song-tags").value = data.tags || "";
  deleteBtn.classList.remove("hidden");
  document.getElementById("song-delete-btn").dataset.id = id;
  modal.classList.remove("hidden");
}

function setupModal() {
  const modal = document.getElementById("song-modal");
  const openBtn = document.getElementById("new-song-btn");
  const closeBtn = modal.querySelector(".close-btn");
  const saveBtn = document.getElementById("song-save-btn");
  const deleteBtn = document.getElementById("song-delete-btn");

  openBtn.addEventListener("click", () => {
    document.getElementById("song-title").value = "";
    document.getElementById("song-lyrics").value = "";
    document.getElementById("song-category").value = "";
    document.getElementById("song-language").value = "";
    document.getElementById("song-author").value = "";
    document.getElementById("song-tags").value = "";
    deleteBtn.classList.add("hidden");
    modal.classList.remove("hidden");
  });

  closeBtn.addEventListener("click", () => modal.classList.add("hidden"));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.add("hidden");
  });

  saveBtn.addEventListener("click", async () => {
    const title = document.getElementById("song-title").value.trim();
    const lyrics = document.getElementById("song-lyrics").value.trim();
    if (!title || !lyrics) {
      alert("Title and lyrics are required");
      return;
    }
    const category = document.getElementById("song-category").value.trim();
    const language = document.getElementById("song-language").value.trim();
    const author = document.getElementById("song-author").value.trim();
    const tags = document.getElementById("song-tags").value.trim();
    await window.api.addSong(title, lyrics, category, language, author, tags);
    modal.classList.add("hidden");
    songs = await window.api.getAllSongs();
    renderSongList();
  });

  deleteBtn.addEventListener("click", async () => {
    if (confirm("Delete this song?")) {
      await window.api.deleteSong(parseInt(deleteBtn.dataset.id));
      modal.classList.add("hidden");
      songs = await window.api.getAllSongs();
      renderSongList();
    }
  });
}

/* ============================================================ Home */

function setupHome() {
  document
    .getElementById("browse-bible-card")
    .addEventListener("click", () => switchPage("bible"));
  document
    .getElementById("browse-songs-card")
    .addEventListener("click", () => switchPage("songs"));
  document
    .getElementById("stack-mode-card")
    .addEventListener("click", () => switchPage("stack"));
  document
    .getElementById("quick-present-card")
    .addEventListener("click", quickPresent);
}

function renderHome() {
  renderRecent();
}

function getRecent() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveRecent(list) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
}

function recordRecent(label, sub, type, items, isSong, isStack) {
  const list = getRecent().filter(
    (r) => !(r.label === label && r.type === type),
  );
  list.unshift({ label, sub, type, items, isSong: !!isSong, isStack: !!isStack, ts: Date.now() });
  saveRecent(list);
  renderRecent();
}

function renderRecent() {
  const wrap = document.getElementById("recent-list");
  if (!wrap) return;
  const list = getRecent();
  if (!list.length) {
    wrap.innerHTML = '<div class="recent-empty">Nothing presented yet</div>';
    return;
  }
  wrap.innerHTML = "";
  list.forEach((r) => {
    const row = document.createElement("button");
    row.className = "recent-item";
    const icon =
      r.type === "song" ? "&#9834;" : r.type === "stack" ? "&#8801;" : "&#182;";
    const sub =
      r.sub ||
      (r.type === "song" ? "Song" : r.type === "stack" ? "Stack" : "Bible Verse");
    row.innerHTML = `<span class="rx ${escapeHtml(r.type)}">${icon}</span>
      <span class="rt"><strong>${escapeHtml(r.label)}</strong><small>${escapeHtml(sub)}</small></span>`;
    row.addEventListener("click", () => presentRecent(r));
    wrap.appendChild(row);
  });
}

function presentRecent(r) {
  if (r.items && r.items.length) {
    if (r.type === "song") {
      presentItems(r.items, true, 0);
    } else {
      presentItems(r.items, false, 0, r.isStack);
    }
  } else if (r.type === "stack") {
    presentStack();
  }
}

function quickPresent() {
  if (state.verseStack.length > 0) {
    presentStack();
  } else if (state.singleVerseItems && state.singleVerseItems.length) {
    presentItems(state.singleVerseItems, false, state.verseIndex);
  } else if (state.songActive && state.songItems && state.songItems.length) {
    presentItems(state.songItems, true, state.verseIndex);
  } else {
    const list = getRecent();
    if (list.length) {
      presentRecent(list[0]);
    } else {
      window.api.openPresentation();
      updateDisplayStatus();
    }
  }
}

/* ============================================================ Presentation bar */

function setupPresentationBar() {
  const bgBtn = document.getElementById("ctrl-bg-btn");
  const popover = document.getElementById("bg-popover");

  bgBtn.addEventListener("click", () => popover.classList.toggle("hidden"));
  document.addEventListener("mousedown", (e) => {
    const wrap = document.getElementById("ctrl-bg-wrap");
    if (wrap && !wrap.contains(e.target)) closeBgPopover();
  });

  popover.addEventListener("click", async (e) => {
    const item = e.target.closest(".bar-pop-item");
    if (!item) return;
    if (item.dataset.bgAction === "image") {
      selectImageDialog();
    } else if (item.dataset.bgAction === "video") {
      selectVideoDialog();
    } else if (item.dataset.bgAction === "none") {
      clearBackground();
    } else if (item.dataset.theme) {
      state.settings.theme = item.dataset.theme;
      document.getElementById("theme-select").value = item.dataset.theme;
      if (state.settings.theme !== "random") {
        await applyThemeBackground(state.settings.theme);
      }
      resendToPresentation();
    }
    closeBgPopover();
  });

  document.getElementById("ctrl-font-minus").addEventListener("click", () => adjustFontSize(-2));
  document.getElementById("ctrl-font-plus").addEventListener("click", () => adjustFontSize(2));

  document.querySelectorAll("#align-group button").forEach((b) => {
    b.addEventListener("click", () => {
      state.settings.textAlign = b.dataset.align;
      const sel = document.getElementById("text-align");
      if (sel) sel.value = state.settings.textAlign;
      updateDisplay();
      sendSettings();
    });
  });

  document.getElementById("ctrl-spacing-minus").addEventListener("click", () => adjustSpacing(-2));
  document.getElementById("ctrl-spacing-plus").addEventListener("click", () => adjustSpacing(2));

  document.getElementById("present-btn").addEventListener("click", presentCurrentContent);
}

function closeBgPopover() {
  const pop = document.getElementById("bg-popover");
  if (pop) pop.classList.add("hidden");
}

function adjustFontSize(delta) {
  state.settings.fontSize = Math.max(
    24,
    Math.min(120, state.settings.fontSize + delta),
  );
  const lbl = document.getElementById("font-size-label");
  const inp = document.getElementById("font-size");
  if (lbl) lbl.textContent = state.settings.fontSize + "px";
  if (inp) inp.value = state.settings.fontSize;
  updateDisplay();
  sendSettings();
}

function adjustSpacing(delta) {
  state.settings.verseSpacing = Math.max(
    8,
    Math.min(80, state.settings.verseSpacing + delta),
  );
  const lbl = document.getElementById("verse-spacing-label");
  const inp = document.getElementById("verse-spacing");
  if (lbl) lbl.textContent = state.settings.verseSpacing + "px";
  if (inp) inp.value = state.settings.verseSpacing;
  updateDisplay();
  sendSettings();
}

async function presentCurrentContent() {
  const doPresent = async () => {
    if (state.singleVerseItems && state.singleVerseItems.length) {
      presentItems(state.singleVerseItems, false, state.verseIndex);
    } else if (state.verseStack.length > 0) {
      presentStack();
    } else if (state.songActive && state.songItems && state.songItems.length) {
      presentItems(state.songItems, true, state.verseIndex);
    } else {
      window.api.openPresentation();
    }
    updateDisplayStatus();
  };
  const pState = await window.api.getPresentationState();
  if (!pState.isOpen) {
    await window.api.openPresentation();
    setTimeout(doPresent, 300);
  } else {
    doPresent();
  }
}

/* ============================================================ Keyboard / presentation window */

function setupPresentation() {
  function isEditing() {
    const el = document.activeElement;
    return (
      el &&
      (el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT" ||
        el.isContentEditable)
    );
  }

  document.addEventListener("keydown", async (e) => {
    if (e.key === "F5" || (e.ctrlKey && e.key === "Enter")) {
      e.preventDefault();
      const pState = await window.api.getPresentationState();
      if (!pState.isOpen) {
        await window.api.openPresentation();
      }
      if (state.singleVerseItems) {
        presentItems(state.singleVerseItems, false, state.verseIndex);
      } else if (state.verseStack.length > 0) {
        presentStack();
      }
      updateDisplayStatus();
      return;
    }
    if (e.key === "Escape") {
      if (isEditing()) return;
      await window.api.closePresentation();
      updateDisplayStatus();
      return;
    }
    if (isEditing()) return;
    if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
      if (state.songActive && state.songItems) {
        e.preventDefault();
        navigateSong(1);
      } else if (state.singleVerseItems) {
        e.preventDefault();
        navigateChapter(1);
      }
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "Backspace") {
      if (state.songActive && state.songItems) {
        e.preventDefault();
        navigateSong(-1);
      } else if (state.singleVerseItems) {
        e.preventDefault();
        navigateChapter(-1);
      }
      return;
    }
  });

  window.api.onPresentationClosed(() => {
    updateDisplayStatus();
  });

  const mainArea = document.getElementById("display-area");
  mainArea.addEventListener("dblclick", async () => {
    const pState = await window.api.getPresentationState();
    if (state.singleVerseItems) {
      if (!pState.isOpen) {
        await window.api.openPresentation();
        setTimeout(
          () => presentItems(state.singleVerseItems, false, state.verseIndex),
          300,
        );
      } else {
        presentItems(state.singleVerseItems, false, state.verseIndex);
      }
    } else if (state.verseStack.length > 0) {
      if (!pState.isOpen) {
        await window.api.openPresentation();
        setTimeout(() => presentStack(), 300);
      } else {
        presentStack();
      }
    }
    updateDisplayStatus();
  });
}

function sendSettings() {
  window.api.sendSettingsToPresentation({
    ...state.settings,
    verseIndex: state.verseIndex,
  });
}

async function resendToPresentation() {
  const pState = await window.api.getPresentationState();
  if (pState.isOpen) {
    if (state.singleVerseItems) {
      presentItems(state.singleVerseItems, false, state.verseIndex);
    } else if (state.verseStack.length > 0) {
      presentStack();
    }
  }
}