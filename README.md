# Church Presenter

An Electron-based presentation tool for churches. Displays Bible verses (Nepali + English) and song lyrics on a fullscreen presentation window with customizable backgrounds, themes, and an always-on-top verse overlay.

## Features

- **Bible Browser** — Browse books/chapters, double-click a verse to present the full chapter, Ctrl+Click to add to stack
- **Stack Mode** — Build a list of verses and present them all together (centered, scrollable)
- **Songs** — Browse, search, add/edit/delete songs; double-click to present
- **Presentation Window** — Fullscreen display with keyboard navigation (Arrow keys, Space, Escape)
- **Custom Backgrounds** — Select images/videos or pick from 12 built-in theme images
- **Random Theme** — Picks a random background image every time you present
- **Background Dim** — Adjustable dim overlay (default 30%)
- **Dual Mode** — Show Nepali + English side by side
- **Verse Overlay** — Always-on-top window showing the current verse (configurable position/font size)
- **Portable EXE** — Standalone Windows executable, no installation needed

## Download

Grab the latest `Church Presenter.exe` from the [Releases page](https://github.com/NirajXtha/church/releases).

> **Windows SmartScreen**: Since the app is not code-signed (common for open-source projects), Windows may show "Windows protected your PC" on first run. Click **More info** → **Run anyway** to proceed. Your songs and data stay safe — the app never phones home beyond checking for updates.

## Development

```bash
npm install
npm run start      # Run in dev mode
npm run build:portable  # Build portable EXE
```

The app uses `bible.sqlite` (Nepali + English Bible + songs) — place it in the project root.

### Project Structure

```
main.js            — Electron main process (windows, IPC)
preload.js         — Context bridge API
db.js              — SQLite queries
renderer/
  index.html       — Control panel UI
  app.js           — UI logic & state
  style.css        — Styles
  presentation.html — Fullscreen display
  overlay.html     — Always-on-top verse overlay
assets/            — Theme background images
```

## License

MIT
