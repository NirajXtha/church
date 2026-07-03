let state = {
  lang: 'nepali',
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
    textColor: '#ffffff',
    textAlign: 'center',
    verseSpacing: 24,
    bgType: null,
    bgPath: null,
    bgFit: 'cover',
    textShadow: 'medium',
    songFormat: 'verses-only',
    stackVerses: false,
    theme: '',
    overlayEnabled: false,
    overlayPosition: 'center',
    overlayFontSize: 20,
  },
  currentSongId: null,
};

let books = [];
let songs = [];

document.addEventListener('DOMContentLoaded', init);

function init() {
  setupTabs();
  loadBooks();
  loadSongs();
  setupBibleBrowser();
  setupSearch();
  setupSettings();
  setupStackControls();
  setupSongControls();
  setupModal();
  setupPresentation();
  setupAutoUpdateUI();
  updateDisplay();
}

function setupAutoUpdateUI() {
  const bar = document.getElementById('update-bar');
  const text = document.getElementById('update-bar-text');
  const btn = document.getElementById('update-bar-btn');

  window.api.onUpdateStatus((data) => {
    bar.classList.remove('hidden');
    btn.classList.add('hidden');
    switch (data.status) {
      case 'checking':
        text.textContent = 'Checking for updates...';
        break;
      case 'available':
        text.textContent = 'Update v' + data.info.version + ' available';
        btn.textContent = 'Download';
        btn.classList.remove('hidden');
        btn.onclick = () => window.api.startUpdateDownload();
        break;
      case 'downloading':
        const pct = Math.round(data.progress.percent);
        text.textContent = 'Downloading update... ' + pct + '%';
        break;
      case 'downloaded':
        text.textContent = 'Update downloaded — restart to install';
        btn.textContent = 'Restart & Install';
        btn.classList.remove('hidden');
        btn.onclick = () => window.api.installUpdate();
        break;
      case 'error':
        text.textContent = 'Update check failed: ' + (data.message || 'unknown error');
        setTimeout(() => bar.classList.add('hidden'), 6000);
        break;
    }
  });
}

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });
}

async function loadBooks() {
  books = await window.api.getBooks();
  renderBookSelect();
}

function renderBookSelect() {
  const select = document.getElementById('book-select');
  select.innerHTML = '';
  books.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = state.lang === 'nepali' ? b.name_nepali : b.name_english;
    select.appendChild(opt);
  });
  if (books.length > 0) loadChapters(books[0].id);
}

async function loadChapters(bookId) {
  const chapters = await window.api.getChapters(bookId);
  const select = document.getElementById('chapter-select');
  select.innerHTML = '';
  chapters.forEach(ch => {
    const opt = document.createElement('option');
    opt.value = ch;
    opt.textContent = 'Chapter ' + ch;
    select.appendChild(opt);
  });
  if (chapters.length > 0) {
    const bk = books.find(b => b.id === parseInt(bookId));
    state.currentChapter = { bookId: parseInt(bookId), bookName: bk, chapter: chapters[0] };
    loadBrowserVerses(parseInt(bookId), chapters[0]);
  }
}

function setupBibleBrowser() {
  document.getElementById('book-select').addEventListener('change', (e) => {
    const bk = books.find(b => b.id === parseInt(e.target.value));
    state.currentChapter = { ...state.currentChapter, bookId: parseInt(e.target.value), bookName: bk };
    loadChapters(parseInt(e.target.value));
  });
  document.getElementById('chapter-select').addEventListener('change', (e) => {
    const bookId = parseInt(document.getElementById('book-select').value);
    const bk = books.find(b => b.id === bookId);
    state.currentChapter = { bookId, bookName: bk, chapter: parseInt(e.target.value) };
    loadBrowserVerses(bookId, parseInt(e.target.value));
  });

  function getBookLabel(bookId) {
    const b = books.find(bk => bk.id === bookId);
    return b ? (state.lang === 'nepali' ? b.name_nepali : b.name_english) : '';
  }

  async function refreshPresentationVerses() {
    const pState = await window.api.getPresentationState();
    if (!pState.isOpen && !state.singleVerseItems && state.verseStack.length === 0) return;

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
          verses.push({ verse: np ? np.verse : en.verse, text: np ? np.text : '', textEn: en ? en.text : '' });
        }
      } else {
        verses = await window.api.getChapterVerses(bookId, chapter, state.lang);
      }
      state.chapterVerses = verses;
      const items = verses.map(v => ({
        type: 'verse',
        reference: `${bookLabel} ${chapter}:${v.verse}`,
        text: v.text || '',
        textEn: state.dualMode ? (v.textEn || '') : null,
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
    state.verseStack.forEach(s => {
      const key = `${s.bookId}-${s.chapter}`;
      if (!groups[key]) groups[key] = { bookId: s.bookId, chapter: s.chapter, verses: [] };
      groups[key].verses.push(s.verse);
    });

    const verseTexts = {};
    if (state.dualMode) {
      for (const key of Object.keys(groups)) {
        const g = groups[key];
        const result = await window.api.getChapterVersesDual(g.bookId, g.chapter);
        (result.nepali || []).forEach(v => { verseTexts[`${g.bookId}-${g.chapter}-${v.verse}`] = { text: v.text, textEn: '' }; });
        (result.english || []).forEach(v => {
          const k = `${g.bookId}-${g.chapter}-${v.verse}`;
          if (verseTexts[k]) verseTexts[k].textEn = v.text;
          else verseTexts[k] = { text: '', textEn: v.text };
        });
      }
    } else {
      for (const key of Object.keys(groups)) {
        const g = groups[key];
        const verses = await window.api.getChapterVerses(g.bookId, g.chapter, state.lang);
        verses.forEach(v => { verseTexts[`${g.bookId}-${g.chapter}-${v.verse}`] = { text: v.text, textEn: null }; });
      }
    }

    state.verseStack.forEach(s => {
      const k = `${s.bookId}-${s.chapter}-${s.verse}`;
      const vt = verseTexts[k];
      if (vt) {
        s.text = vt.text || '';
        s.textEn = state.dualMode ? (vt.textEn || '') : null;
      }
      s.reference = `${getBookLabel(s.bookId)} ${s.chapter}:${s.verse}`;
    });

    renderStack();
    updateBrowserStackHighlights();
    updateDisplay();
    if (presentationOpen) presentStack();
  }

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.lang = btn.dataset.lang;
      renderBookSelect();
      refreshPresentationVerses();
    });
  });

  document.getElementById('dual-mode').addEventListener('change', (e) => {
    state.dualMode = e.target.checked;
    if (state.currentChapter) {
      loadBrowserVerses(state.currentChapter.bookId, state.currentChapter.chapter);
    }
    refreshPresentationVerses();
  });
}

async function loadBrowserVerses(bookId, chapter) {
  const container = document.getElementById('verse-browser');
  const bookName = state.currentChapter?.bookName;
  const bookLabel = bookName ? (state.lang === 'nepali' ? bookName.name_nepali : bookName.name_english) : '';

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
        text: np ? np.text : '',
        textEn: en ? en.text : '',
      });
    }
  } else {
    verses = await window.api.getChapterVerses(bookId, chapter, state.lang);
  }

  state.chapterVerses = verses;
  container.innerHTML = '';

  verses.forEach((v, i) => {
    const el = document.createElement('div');
    el.className = 'browser-verse';
    el.dataset.index = i;

    const isStacked = state.verseStack.some(s => s.bookId === bookId && s.chapter === chapter && s.verse === v.verse);
    if (isStacked) el.classList.add('stacked');

    const preview = (v.text || '').substring(0, 70);
    const label = v.textEn
      ? `<span class="verse-num">${v.verse}</span> <span class="verse-np">${preview}</span> <span class="verse-en">${v.textEn.substring(0, 50)}</span>`
      : `<span class="verse-num">${v.verse}</span> <span class="verse-text">${preview}</span>`;

    el.innerHTML = label;
    el.title = `Double-click: show in presentation\nCtrl+Click: add to stack`;

    el.addEventListener('click', (ev) => {
      if (ev.ctrlKey || ev.metaKey) {
        ev.preventDefault();
        toggleStackVerse(bookId, chapter, v, bookLabel);
      }
    });

    el.addEventListener('dblclick', () => {
      showSingleVerse(bookId, chapter, v, bookLabel);
    });

    container.appendChild(el);
  });
}

function showSingleVerse(bookId, chapter, verse, bookLabel) {
  state.songActive = false;
  state.selectedSongId = null;

  const items = state.chapterVerses.map(v => {
    const base = {
      type: 'verse',
      reference: `${bookLabel} ${chapter}:${v.verse}`,
    };
    if (state.dualMode) {
      return { ...base, text: v.text || '', textEn: v.textEn || '' };
    }
    return { ...base, text: v.text, textEn: null };
  });

  const startIdx = state.chapterVerses.findIndex(v => v.verse === verse.verse);
  state.verseIndex = startIdx >= 0 ? startIdx : 0;
  state.singleVerseItems = items;

  updateDisplay();
  presentItems(items, false, state.verseIndex);
  updateOverlayContent();
}

function updateDisplay() {
  const area = document.getElementById('display-area');
  area.innerHTML = '';

  if (state.songActive && state.songItems && state.songItems.length > 0) {
    const idx = state.verseIndex;
    const item = state.songItems[idx];
    const div = document.createElement('div');
    div.className = 'verse-item';
    div.style.fontSize = Math.round(state.settings.fontSize * 0.6) + 'px';
    div.style.color = state.settings.textColor;
    div.style.textAlign = state.settings.textAlign;
    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-size:0.8em;opacity:0.6;margin-bottom:12px;font-weight:600;letter-spacing:1px';
    titleEl.textContent = item.title;
    div.appendChild(titleEl);
    const p = document.createElement('div');
    p.innerHTML = item.text.split('\n').map(l => l.trim() === '' ? '<br>' : l).join('\n');
    div.appendChild(p);
    area.appendChild(div);
    if (state.songItems.length > 1) {
      const nav = document.createElement('div');
      nav.className = 'main-nav-hint';
      nav.textContent = `${idx + 1} / ${state.songItems.length}`;
      area.appendChild(nav);
    }
  } else if (state.singleVerseItems && state.singleVerseItems.length > 0) {
    const idx = state.verseIndex;
    const item = state.singleVerseItems[idx];
    const div = document.createElement('div');
    div.className = 'verse-item';
    div.style.fontSize = Math.round(state.settings.fontSize * 0.6) + 'px';
    div.style.color = state.settings.textColor;
    div.style.textAlign = state.settings.textAlign;

    if (item.textEn) {
      const dualDiv = document.createElement('div');
      dualDiv.className = 'dual-verse';
      const npDiv = document.createElement('div');
      npDiv.className = 'dual-np';
      npDiv.textContent = item.text;
      const enDiv = document.createElement('div');
      enDiv.className = 'dual-en';
      enDiv.textContent = item.textEn;
      dualDiv.appendChild(npDiv);
      dualDiv.appendChild(enDiv);
      div.appendChild(dualDiv);
    } else {
      const textEl = document.createElement('div');
      textEl.textContent = item.text;
      div.appendChild(textEl);
    }
    const refEl = document.createElement('span');
    refEl.className = 'verse-ref';
    refEl.textContent = item.reference;
    div.appendChild(refEl);
    area.appendChild(div);

    if (state.singleVerseItems.length > 1) {
      const nav = document.createElement('div');
      nav.className = 'main-nav-hint';
      nav.textContent = `${idx + 1} / ${state.singleVerseItems.length}`;
      area.appendChild(nav);
    }
  } else if (state.verseStack.length > 0) {
    state.verseStack.forEach((item, i) => {
      const div = document.createElement('div');
      div.className = 'verse-item';
      div.style.marginBottom = i < state.verseStack.length - 1 ? state.settings.verseSpacing * 1.5 + 'px' : '0';
      div.style.fontSize = Math.round(state.settings.fontSize * 0.6) + 'px';
      div.style.color = state.settings.textColor;
      div.style.textAlign = state.settings.textAlign;
      const textEl = document.createElement('div');
      textEl.textContent = item.text;
      div.appendChild(textEl);
      const refEl = document.createElement('span');
      refEl.className = 'verse-ref';
      refEl.textContent = item.reference;
      div.appendChild(refEl);
      area.appendChild(div);
    });
  } else {
    area.innerHTML = '<div class="display-empty">Double-click a verse or present stack</div>';
  }
}

function toggleStackVerse(bookId, chapter, verse, bookLabel) {
  const existing = state.verseStack.findIndex(s => s.bookId === bookId && s.chapter === chapter && s.verse === verse.verse);
  if (existing >= 0) {
    state.verseStack.splice(existing, 1);
  } else {
    state.verseStack.push({
      bookId,
      chapter,
      verse: verse.verse,
      text: verse.text || verse.textEn || '',
      textEn: verse.textEn || null,
      reference: `${bookLabel} ${chapter}:${verse.verse}`,
    });
  }

  state.singleVerseItems = null;
  renderStack();
  updateBrowserStackHighlights();
  updateDisplay();

  if (state.verseStack.length > 0) {
    document.getElementById('stack-section').style.display = 'block';
  } else {
    document.getElementById('stack-section').style.display = 'none';
  }
}

function updateBrowserStackHighlights() {
  document.querySelectorAll('.browser-verse').forEach(el => {
    el.classList.remove('stacked');
  });
  if (!state.currentChapter) return;
  const bk = state.currentChapter.bookId;
  const ch = state.currentChapter.chapter;
  state.verseStack.forEach(s => {
    if (s.bookId === bk && s.chapter === ch) {
      const idx = state.chapterVerses.findIndex(v => v.verse === s.verse);
      const el = document.querySelector(`.browser-verse[data-index="${idx}"]`);
      if (el) el.classList.add('stacked');
    }
  });
}

function renderStack() {
  const container = document.getElementById('stack-list');
  container.innerHTML = '';
  state.verseStack.forEach((item, i) => {
    const chip = document.createElement('div');
    chip.className = 'verse-chip';
    chip.innerHTML = `
      <div>
        <div class="verse-text">${item.text}</div>
        <div class="verse-ref">${item.reference}</div>
      </div>
      <button class="remove-verse" data-index="${i}">&times;</button>
    `;
    chip.querySelector('.remove-verse').addEventListener('click', () => {
      state.verseStack.splice(i, 1);
      renderStack();
      updateBrowserStackHighlights();
      updateDisplay();
      if (state.verseStack.length === 0) {
        document.getElementById('stack-section').style.display = 'none';
      }
    });
    container.appendChild(chip);
  });
}

function setupStackControls() {
  document.getElementById('present-stack-btn').addEventListener('click', () => {
    if (state.verseStack.length === 0) return;
    state.songActive = false;
    state.selectedSongId = null;
    state.singleVerseItems = null;
    presentStack();
  });

  document.getElementById('clear-stack-btn').addEventListener('click', () => {
    state.verseStack = [];
    renderStack();
    updateBrowserStackHighlights();
    updateDisplay();
    document.getElementById('stack-section').style.display = 'none';
  });
}

async function presentStack() {
  const items = state.verseStack.map(v => ({
    type: 'verse',
    text: v.text,
    textEn: v.textEn,
    reference: v.reference,
  }));
  state.verseIndex = 0;
  await presentItems(items, false, 0, true);
}

function navigateChapter(direction) {
  if (!state.singleVerseItems || state.singleVerseItems.length < 2) return;
  const newIdx = state.verseIndex + direction;
  if (newIdx < 0 || newIdx >= state.singleVerseItems.length) return;
  state.verseIndex = newIdx;
  updateDisplay();
  presentItems(state.singleVerseItems, false, state.verseIndex);
  updateOverlayContent();
}

function navigateSong(direction) {
  if (!state.songItems || state.songItems.length < 2) return;
  const newIdx = state.verseIndex + direction;
  if (newIdx < 0 || newIdx >= state.songItems.length) return;
  state.verseIndex = newIdx;
  updateDisplay();
  presentItems(state.songItems, true, state.verseIndex);
  updateOverlayContent();
}

async function presentItems(items, isSong, startIndex, isStack) {
  if (state.settings.theme === 'random') {
    await applyThemeBackground('random');
  }
  const pState = await window.api.getPresentationState();
  const data = {
    items: items,
    settings: { ...state.settings },
    bgType: state.settings.bgType,
    bgPath: state.settings.bgPath,
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
}

function setupSearch() {
  document.getElementById('search-btn').addEventListener('click', async () => {
    const keyword = document.getElementById('bible-search').value.trim();
    if (!keyword) return;

    let results;
    if (state.dualMode) {
      const r = await window.api.searchVersesDual(keyword);
      const map = new Map();
      r.nepali.forEach(v => {
        const key = v.book + '-' + v.chapter + '-' + v.verse;
        map.set(key, { ...v, textEn: '' });
      });
      r.english.forEach(v => {
        const key = v.book + '-' + v.chapter + '-' + v.verse;
        const existing = map.get(key);
        if (existing) {
          existing.textEn = v.text;
        } else {
          map.set(key, { ...v, text: '', textEn: v.text });
        }
      });
      results = Array.from(map.values()).map(v => ({
        type: 'verse',
        text: v.text,
        textEn: v.textEn || null,
        book: v.book,
        chapter: v.chapter,
        verse: v.verse,
        book_nepali: v.book_nepali,
        book_english: v.book_english,
        reference: `${state.lang === 'nepali' ? v.book_nepali : v.book_english} ${v.chapter}:${v.verse}`,
      }));
    } else {
      const r = await window.api.searchVerses(keyword, state.lang);
      results = r.map(v => ({
        type: 'verse',
        text: v.text,
        textEn: null,
        book: v.book,
        chapter: v.chapter,
        verse: v.verse,
        book_nepali: v.book_nepali,
        book_english: v.book_english,
        reference: `${state.lang === 'nepali' ? v.book_nepali : v.book_english} ${v.chapter}:${v.verse}`,
      }));
    }

    // Show results in the browser area
    const container = document.getElementById('verse-browser');
    container.innerHTML = '<div class="search-header">Search results for "' + keyword + '" <button id="clear-search-btn" class="btn-small">Clear</button></div>';
    results.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = 'browser-verse';
      el.dataset.index = i;
      const preview = (item.text || '').substring(0, 70);
      const label = item.textEn
        ? `<span class="verse-num">${i + 1}</span> <span class="verse-np">${preview}</span> <span class="verse-en">${item.textEn.substring(0, 50)}</span>`
        : `<span class="verse-num">${i + 1}</span> <span class="verse-text">${preview}</span>`;
      el.innerHTML = label + `<div class="verse-ref">${item.reference}</div>`;
      el.title = 'Double-click: show in presentation\nCtrl+Click: add to stack';
      const bookLabel = state.lang === 'nepali' ? item.book_nepali : item.book_english;
      el.addEventListener('click', (ev) => {
        if (ev.ctrlKey || ev.metaKey) {
          ev.preventDefault();
          toggleStackVerse(item.book, item.chapter, item, bookLabel);
        }
      });
      el.addEventListener('dblclick', () => {
        state.verseIndex = i;
        updateDisplay();
        presentItems(results, false, state.verseIndex);
        updateOverlayContent();
      });
      container.appendChild(el);
    });

    state.singleVerseItems = results;
    state.chapterVerses = results;
    state.verseIndex = 0;
    updateDisplay();

    document.getElementById('clear-search-btn').addEventListener('click', () => {
      document.getElementById('bible-search').value = '';
      if (state.currentChapter) {
        loadBrowserVerses(state.currentChapter.bookId, state.currentChapter.chapter);
      }
    });
  });

  document.getElementById('bible-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('search-btn').click();
  });

  document.getElementById('song-search').addEventListener('input', (e) => {
    renderSongList(e.target.value);
  });
}

async function loadSongs() {
  songs = await window.api.getAllSongs();
  renderSongList();
}

function renderSongList(filter) {
  const container = document.getElementById('song-list');
  container.innerHTML = '';
  let list = songs;
  if (filter) {
    const f = filter.toLowerCase();
    list = songs.filter(s => s.title.toLowerCase().includes(f) || (s.category && s.category.toLowerCase().includes(f)));
  }
  list.forEach(s => {
    const el = document.createElement('div');
    el.className = 'song-item' + (state.selectedSongId === s.id ? ' active' : '');
    el.innerHTML = `
      <div>
        <div class="song-title">${s.title}</div>
        <div class="song-meta">${s.category || ''} ${s.language ? '| ' + s.language : ''}</div>
      </div>
    `;
    el.addEventListener('click', () => showLyricsPreview(s.id));
    el.addEventListener('dblclick', () => displaySong(s.id));
    container.appendChild(el);
  });
}

async function showLyricsPreview(id) {
  state.selectedSongId = id;
  document.querySelectorAll('.song-item').forEach(el => el.classList.remove('active'));
  const lyrics = await window.api.getSongLyrics(id);
  document.getElementById('song-lyrics-preview').innerHTML = lyrics.lyrics.replace(/\n/g, '<br>');
  document.querySelectorAll('.song-item').forEach(el => {
    el.classList.toggle('active', el.querySelector('.song-title')?.textContent === lyrics.title);
  });
  state.currentSongId = id;
}

async function displaySong(id) {
  const data = await window.api.getSongLyrics(id);
  const verses = data.lyrics.split(/\n\n+/).filter(v => v.trim());
  const items = verses.map(v => ({
    type: 'song',
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
  updateOverlayContent();
}

function setupSettings() {
  const fontSize = document.getElementById('font-size');
  const fontSizeLabel = document.getElementById('font-size-label');
  fontSize.addEventListener('input', () => {
    state.settings.fontSize = parseInt(fontSize.value);
    fontSizeLabel.textContent = state.settings.fontSize + 'px';
    updateDisplay();
    sendSettings();
  });

  const textColor = document.getElementById('text-color');
  textColor.addEventListener('input', () => {
    state.settings.textColor = textColor.value;
    updateDisplay();
    sendSettings();
  });

  const textAlign = document.getElementById('text-align');
  textAlign.addEventListener('change', () => {
    state.settings.textAlign = textAlign.value;
    updateDisplay();
    sendSettings();
  });

  const verseSpacing = document.getElementById('verse-spacing');
  const verseSpacingLabel = document.getElementById('verse-spacing-label');
  verseSpacing.addEventListener('input', () => {
    state.settings.verseSpacing = parseInt(verseSpacing.value);
    verseSpacingLabel.textContent = state.settings.verseSpacing + 'px';
    updateDisplay();
    sendSettings();
  });

  const textShadow = document.getElementById('text-shadow');
  textShadow.addEventListener('change', () => {
    state.settings.textShadow = textShadow.value;
    sendSettings();
  });

  document.getElementById('select-image-btn').addEventListener('click', async () => {
    const path = await window.api.selectFile('image');
    if (path) {
      state.settings.theme = '';
      document.getElementById('theme-select').value = '';
      state.settings.bgType = 'image';
      state.settings.bgPath = path;
      const fileUrl = 'file:///' + path.replace(/\\/g, '/');
      document.getElementById('bg-preview').style.backgroundImage = `url('${fileUrl}')`;
      document.getElementById('bg-preview').classList.add('has-bg');
      document.getElementById('bg-preview').textContent = '';
      resendToPresentation();
    }
  });

  document.getElementById('select-video-btn').addEventListener('click', async () => {
    const path = await window.api.selectFile('video');
    if (path) {
      state.settings.theme = '';
      document.getElementById('theme-select').value = '';
      state.settings.bgType = 'video';
      state.settings.bgPath = path;
      document.getElementById('bg-preview').style.background = '#0f3460';
      document.getElementById('bg-preview').classList.add('has-bg');
      document.getElementById('bg-preview').textContent = 'Video selected';
      resendToPresentation();
    }
  });

  document.getElementById('clear-bg-btn').addEventListener('click', () => {
    state.settings.theme = '';
    state.settings.bgType = null;
    state.settings.bgPath = null;
    document.getElementById('theme-select').value = '';
    document.getElementById('bg-preview').style.backgroundImage = '';
    document.getElementById('bg-preview').classList.remove('has-bg');
    document.getElementById('bg-preview').textContent = '';
    resendToPresentation();
  });

  document.getElementById('bg-fit').addEventListener('change', (e) => {
    state.settings.bgFit = e.target.value;
    sendSettings();
  });

  document.getElementById('song-format').addEventListener('change', (e) => {
    state.settings.songFormat = e.target.value;
    sendSettings();
  });

  const bgDim = document.getElementById('bg-dim');
  const bgDimLabel = document.getElementById('bg-dim-label');
  bgDim.addEventListener('input', () => {
    state.settings.bgDim = parseInt(bgDim.value);
    bgDimLabel.textContent = state.settings.bgDim + '%';
    resendToPresentation();
  });

  document.getElementById('theme-select').addEventListener('change', async (e) => {
    state.settings.theme = e.target.value;
    if (state.settings.theme !== 'random') {
      await applyThemeBackground(state.settings.theme);
    }
    resendToPresentation();
  });

  document.getElementById('overlay-enable').addEventListener('change', async (e) => {
    state.settings.overlayEnabled = e.target.checked;
    if (e.target.checked) {
      await window.api.openOverlay();
      await window.api.setOverlayPosition(state.settings.overlayPosition);
      updateOverlayContent();
    } else {
      await window.api.closeOverlay();
    }
  });

  document.getElementById('overlay-position').addEventListener('change', async (e) => {
    state.settings.overlayPosition = e.target.value;
    if (state.settings.overlayEnabled) {
      await window.api.setOverlayPosition(e.target.value);
    }
  });

  const ofs = document.getElementById('overlay-font-size');
  const ofsLabel = document.getElementById('overlay-font-size-label');
  ofs.addEventListener('input', async () => {
    state.settings.overlayFontSize = parseInt(ofs.value);
    ofsLabel.textContent = state.settings.overlayFontSize + 'px';
    if (state.settings.overlayEnabled) {
      await window.api.updateOverlay({ fontSize: state.settings.overlayFontSize });
    }
  });
}

const THEME_ENTRIES = [
  { id: 'christmas', file: 'Christmas.jpg', label: 'Christmas' },
  { id: 'book-ring', file: 'book-ring.jpg', label: 'Book Ring' },
  { id: 'book', file: 'book.jpg', label: 'Book' },
  { id: 'candle', file: 'candle.png', label: 'Candle' },
  { id: 'cross-sky', file: 'cross-sky.jpg', label: 'Cross Sky' },
  { id: 'cross', file: 'cross.jpg', label: 'Cross' },
  { id: 'dark', file: 'dark.jpg', label: 'Dark' },
  { id: 'flowers', file: 'flowers.jpg', label: 'Flowers' },
  { id: 'man-standing', file: 'man-standing.jpg', label: 'Man Standing' },
  { id: 'ribbon', file: 'ribbon.jpg', label: 'Ribbon' },
  { id: 'rose', file: 'rose.jpg', label: 'Rose' },
  { id: 'sunset-cross', file: 'sunset-cross.jpg', label: 'Sunset Cross' },
];

function getThemeFile(theme) {
  if (!theme || theme === '') return null;
  if (theme === 'random') {
    const idx = Math.floor(Math.random() * THEME_ENTRIES.length);
    return THEME_ENTRIES[idx].file;
  }
  const entry = THEME_ENTRIES.find(e => e.id === theme);
  return entry ? entry.file : null;
}

async function applyThemeBackground(theme) {
  const file = getThemeFile(theme);
  const preview = document.getElementById('bg-preview');
  if (file) {
    state.settings.bgType = 'image';
    state.settings.bgPath = await window.api.getAssetPath(file);
    const fileUrl = 'file:///' + state.settings.bgPath.replace(/\\/g, '/');
    preview.style.backgroundImage = `url('${fileUrl}')`;
    preview.classList.add('has-bg');
    preview.textContent = '';
  } else {
    document.getElementById('theme-select').value = '';
    if (!state.settings.bgPath) {
      preview.style.backgroundImage = '';
      preview.classList.remove('has-bg');
      preview.textContent = '';
    }
  }
}

async function updateOverlayContent() {
  if (!state.settings.overlayEnabled) return;
  let text = '';
  let reference = '';
  if (state.singleVerseItems && state.singleVerseItems.length > 0) {
    const item = state.singleVerseItems[state.verseIndex];
    text = item.textEn ? `${item.text} / ${item.textEn}` : item.text;
    reference = item.reference;
  } else if (state.verseStack.length > 0) {
    text = state.verseStack.map(v => v.text).join(' | ');
    reference = state.verseStack.map(v => v.reference).join(', ');
  }
  await window.api.updateOverlay({
    text,
    reference,
    position: state.settings.overlayPosition,
    fontSize: state.settings.overlayFontSize,
  });
}

function setupSongControls() {
  document.getElementById('display-song-btn').addEventListener('click', async () => {
    if (state.selectedSongId) displaySong(state.selectedSongId);
  });

  document.getElementById('song-lyrics-preview').addEventListener('dblclick', async () => {
    if (state.selectedSongId) displaySong(state.selectedSongId);
  });

  document.getElementById('edit-song-btn').addEventListener('click', () => {
    openSongEditModal(state.selectedSongId);
  });
}

function setupModal() {
  const modal = document.getElementById('song-modal');
  const openBtn = document.getElementById('new-song-btn');
  const closeBtn = modal.querySelector('.close-btn');
  const saveBtn = document.getElementById('song-save-btn');
  const deleteBtn = document.getElementById('song-delete-btn');

  openBtn.addEventListener('click', () => {
    document.getElementById('song-title').value = '';
    document.getElementById('song-lyrics').value = '';
    document.getElementById('song-category').value = '';
    document.getElementById('song-language').value = '';
    document.getElementById('song-author').value = '';
    document.getElementById('song-tags').value = '';
    deleteBtn.classList.add('hidden');
    modal.classList.remove('hidden');
  });

  closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  saveBtn.addEventListener('click', async () => {
    const title = document.getElementById('song-title').value.trim();
    const lyrics = document.getElementById('song-lyrics').value.trim();
    if (!title || !lyrics) { alert('Title and lyrics are required'); return; }
    const category = document.getElementById('song-category').value.trim();
    const language = document.getElementById('song-language').value.trim();
    const author = document.getElementById('song-author').value.trim();
    const tags = document.getElementById('song-tags').value.trim();
    await window.api.addSong(title, lyrics, category, language, author, tags);
    modal.classList.add('hidden');
    songs = await window.api.getAllSongs();
    renderSongList();
  });

  async function openSongEditModal(id) {
    if (!id) return;
    const data = await window.api.getSongLyrics(id);
    document.getElementById('song-title').value = data.title;
    document.getElementById('song-lyrics').value = data.lyrics;
    document.getElementById('song-category').value = data.category || '';
    document.getElementById('song-language').value = data.language || '';
    document.getElementById('song-author').value = data.author || '';
    document.getElementById('song-tags').value = data.tags || '';
    deleteBtn.classList.remove('hidden');
    document.getElementById('song-delete-btn').dataset.id = id;
    modal.classList.remove('hidden');
  }

  deleteBtn.addEventListener('click', async () => {
    if (confirm('Delete this song?')) {
      await window.api.deleteSong(parseInt(deleteBtn.dataset.id));
      modal.classList.add('hidden');
      songs = await window.api.getAllSongs();
      renderSongList();
    }
  });
}

function setupPresentation() {
  function isEditing() {
    const el = document.activeElement;
    return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
  }

  document.addEventListener('keydown', async (e) => {
    if (e.key === 'F5' || (e.ctrlKey && e.key === 'Enter')) {
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
      return;
    }
    if (e.key === 'Escape') {
      if (isEditing()) return;
      await window.api.closePresentation();
      return;
    }
    if (isEditing()) return;
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
      if (state.songActive && state.songItems) {
        e.preventDefault();
        navigateSong(1);
      } else if (state.singleVerseItems) {
        e.preventDefault();
        navigateChapter(1);
      }
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
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

  window.api.onPresentationClosed(() => {});

  const mainArea = document.getElementById('display-area');
  mainArea.addEventListener('dblclick', async () => {
    const pState = await window.api.getPresentationState();
    if (state.singleVerseItems) {
      if (!pState.isOpen) {
        await window.api.openPresentation();
        setTimeout(() => presentItems(state.singleVerseItems, false, state.verseIndex), 300);
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
  });
}

function sendSettings() {
  window.api.sendSettingsToPresentation({ ...state.settings, verseIndex: state.verseIndex });
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
  updateOverlayContent();
}
