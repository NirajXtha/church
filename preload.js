const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getBooks: (lang) => ipcRenderer.invoke("get-books", lang),
  getVerses: (bookId, chapter, startVerse, endVerse, lang) =>
    ipcRenderer.invoke(
      "get-verses",
      bookId,
      chapter,
      startVerse,
      endVerse,
      lang,
    ),
  getChapters: (bookId) => ipcRenderer.invoke("get-chapters", bookId),
  getChapterCount: (bookId) => ipcRenderer.invoke("get-chapter-count", bookId),
  getVerseCount: (bookId, chapter) =>
    ipcRenderer.invoke("get-verse-count", bookId, chapter),
  searchVerses: (keyword, lang) =>
    ipcRenderer.invoke("search-verses", keyword, lang),
  getChapterVerses: (bookId, chapter, lang) =>
    ipcRenderer.invoke("get-chapter-verses", bookId, chapter, lang),
  getChapterVersesDual: (bookId, chapter) =>
    ipcRenderer.invoke("get-chapter-verses-dual", bookId, chapter),
  getVersesDual: (bookId, chapter, startVerse, endVerse) =>
    ipcRenderer.invoke(
      "get-verses-dual",
      bookId,
      chapter,
      startVerse,
      endVerse,
    ),
  searchVersesDual: (keyword) =>
    ipcRenderer.invoke("search-verses-dual", keyword),
  getAllSongs: () => ipcRenderer.invoke("get-all-songs"),
  getSongLyrics: (id) => ipcRenderer.invoke("get-song-lyrics", id),
  addSong: (title, lyrics, category, language, author, tags) =>
    ipcRenderer.invoke(
      "add-song",
      title,
      lyrics,
      category,
      language,
      author,
      tags,
    ),
  deleteSong: (id) => ipcRenderer.invoke("delete-song", id),
  getBookNames: () => ipcRenderer.invoke("get-book-names"),
  getAssetPath: (filename) => ipcRenderer.invoke("get-asset-path", filename),
  getRandomThemePath: () => ipcRenderer.invoke("get-random-theme-path"),

  openPresentation: () => ipcRenderer.invoke("open-presentation"),
  closePresentation: () => ipcRenderer.invoke("close-presentation"),
  sendToPresentation: (data) =>
    ipcRenderer.invoke("send-to-presentation", data),
  sendSettingsToPresentation: (data) =>
    ipcRenderer.invoke("send-settings-to-presentation", data),
  selectFile: (type) => ipcRenderer.invoke("select-file", type),
  getPresentationState: () => ipcRenderer.invoke("get-presentation-state"),

  onPresentationClosed: (callback) =>
    ipcRenderer.on("presentation-closed", callback),
  onDisplayContent: (callback) =>
    ipcRenderer.on("display-content", (_, data) => callback(data)),
  onUpdateSettings: (callback) =>
    ipcRenderer.on("update-settings", (_, data) => callback(data)),

  // Presentation window only
  onDisplayContentPres: (callback) =>
    ipcRenderer.on("display-content", (_, data) => callback(data)),
  onUpdateSettingsPres: (callback) =>
    ipcRenderer.on("update-settings", (_, data) => callback(data)),
  closePresentationPres: () => ipcRenderer.invoke("close-presentation"),

  // Overlay
  openOverlay: () => ipcRenderer.invoke("open-overlay"),
  closeOverlay: () => ipcRenderer.invoke("close-overlay"),
  updateOverlay: (data) => ipcRenderer.invoke("update-overlay", data),
  setOverlayPosition: (pos) => ipcRenderer.invoke("set-overlay-position", pos),
  onOverlayUpdate: (callback) =>
    ipcRenderer.on("overlay-update", (_, data) => callback(data)),

  // Auto-update
  onUpdateStatus: (callback) =>
    ipcRenderer.on("update-status", (_, data) => callback(data)),
  startUpdateDownload: () => ipcRenderer.invoke("start-update-download"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
});
