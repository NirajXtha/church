const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const db = require('./db');

let mainWin;
let presentationWin;
let overlayWin;

function createWindow() {
  mainWin = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'Church Presenter',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWin.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function createPresentationWindow() {
  if (presentationWin && !presentationWin.isDestroyed()) {
    presentationWin.focus();
    return;
  }

  const { screen } = require('electron');
  const displays = screen.getAllDisplays();
  const externalDisplay = displays.find(d => d.bounds.x !== 0 || d.bounds.y !== 0);

  let bounds;
  if (externalDisplay) {
    bounds = externalDisplay.bounds;
  } else {
    bounds = { x: 0, y: 0, width: 1920, height: 1080 };
  }

  presentationWin = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    fullscreen: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  presentationWin.loadFile(path.join(__dirname, 'renderer', 'presentation.html'));

  presentationWin.on('closed', () => {
    presentationWin = null;
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send('presentation-closed');
    }
  });
}

function setupIPC() {
  ipcMain.handle('get-books', (_, lang) => db.getBooks(lang));
  ipcMain.handle('get-verses', (_, bookId, chapter, startVerse, endVerse, lang) => db.getVerses(bookId, chapter, startVerse, endVerse, lang));
  ipcMain.handle('get-chapters', (_, bookId) => db.getChapters(bookId));
  ipcMain.handle('get-chapter-count', (_, bookId) => db.getChapterCount(bookId));
  ipcMain.handle('get-verse-count', (_, bookId, chapter) => db.getVerseCount(bookId, chapter));
  ipcMain.handle('search-verses', (_, keyword, lang) => db.searchVerses(keyword, lang));
  ipcMain.handle('get-chapter-verses', (_, bookId, chapter, lang) => db.getChapterVerses(bookId, chapter, lang));
  ipcMain.handle('get-chapter-verses-dual', (_, bookId, chapter) => db.getChapterVersesDual(bookId, chapter));
  ipcMain.handle('get-verses-dual', (_, bookId, chapter, startVerse, endVerse) => db.getVersesDual(bookId, chapter, startVerse, endVerse));
  ipcMain.handle('search-verses-dual', (_, keyword) => db.searchVersesDual(keyword));
  ipcMain.handle('get-all-songs', () => db.getAllSongs());
  ipcMain.handle('get-song-lyrics', (_, id) => db.getSongLyrics(id));
  ipcMain.handle('add-song', (_, title, lyrics, category, language, author, tags) => db.addSong(title, lyrics, category, language, author, tags));
  ipcMain.handle('delete-song', (_, id) => db.deleteSong(id));
  ipcMain.handle('get-book-names', () => db.getBookNames());

  ipcMain.handle('open-presentation', () => {
    createPresentationWindow();
    return true;
  });

  ipcMain.handle('close-presentation', () => {
    if (presentationWin && !presentationWin.isDestroyed()) {
      presentationWin.close();
    }
    return true;
  });

  ipcMain.handle('send-to-presentation', (_, data) => {
    if (presentationWin && !presentationWin.isDestroyed()) {
      presentationWin.webContents.send('display-content', data);
    }
    return true;
  });

  ipcMain.handle('send-settings-to-presentation', (_, data) => {
    if (presentationWin && !presentationWin.isDestroyed()) {
      presentationWin.webContents.send('update-settings', data);
    }
    return true;
  });

  ipcMain.handle('select-file', async (_, type) => {
    const filters = type === 'video'
      ? [{ name: 'Videos', extensions: ['mp4', 'webm', 'avi', 'mov', 'mkv'] }]
      : [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }];
    const result = await dialog.showOpenDialog(mainWin, {
      properties: ['openFile'],
      filters,
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('get-asset-path', (_, filename) => {
    const isPackaged = app.isPackaged;
    const base = isPackaged ? path.join(process.resourcesPath, 'assets') : path.join(__dirname, 'assets');
    return path.join(base, filename);
  });

  ipcMain.handle('get-presentation-state', () => {
    return {
      isOpen: presentationWin && !presentationWin.isDestroyed(),
    };
  });

  // Overlay window
  ipcMain.handle('open-overlay', () => {
    if (overlayWin && !overlayWin.isDestroyed()) { overlayWin.focus(); return true; }
    overlayWin = new BrowserWindow({
      width: 600,
      height: 100,
      alwaysOnTop: true,
      frame: false,
      transparent: true,
      resizable: false,
      skipTaskbar: true,
      focusable: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    overlayWin.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));
    overlayWin.setAlwaysOnTop(true, 'screen-saver');
    overlayWin.on('closed', () => { overlayWin = null; });
    return true;
  });

  ipcMain.handle('close-overlay', () => {
    if (overlayWin && !overlayWin.isDestroyed()) overlayWin.close();
    return true;
  });

  ipcMain.handle('update-overlay', (_, data) => {
    if (overlayWin && !overlayWin.isDestroyed()) {
      overlayWin.webContents.send('overlay-update', data);
    }
    return true;
  });

  ipcMain.handle('set-overlay-position', (_, pos) => {
    if (overlayWin && !overlayWin.isDestroyed()) {
      const { screen } = require('electron');
      const primary = screen.getPrimaryDisplay();
      const { width: sw, height: sh } = primary.workAreaSize;
      const w = 600, h = 100;
      let x = Math.round((sw - w) / 2);
      let y;
      if (pos === 'top') y = 0;
      else if (pos === 'bottom') y = sh - h;
      else y = Math.round((sh - h) / 2);
      overlayWin.setBounds({ x, y, width: w, height: h });
      if (overlayWin.webContents) overlayWin.webContents.send('overlay-update', { position: pos });
    }
    return true;
  });
}

app.whenReady().then(() => {
  setupIPC();
  createWindow();
});

app.on('window-all-closed', () => {
  if (presentationWin && !presentationWin.isDestroyed()) {
    presentationWin.close();
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
