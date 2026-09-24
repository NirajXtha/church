const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getBooks: () => ipcRenderer.invoke("get-books"),
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
  exportDatabase: () => ipcRenderer.invoke("export-database"),
  importDatabase: (jsonData) => ipcRenderer.invoke("import-database", jsonData),
  exportSongs: () => ipcRenderer.invoke("export-songs"),
  importSongs: (jsonData) => ipcRenderer.invoke("import-songs", jsonData),
  getAssetPath: (filename) => ipcRenderer.invoke("get-asset-path", filename),

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
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  startUpdateDownload: () => ipcRenderer.invoke("start-update-download"),
  installUpdate: () => ipcRenderer.invoke("install-update"),

  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getDisplayInfo: () => ipcRenderer.invoke("get-display-info"),
});
