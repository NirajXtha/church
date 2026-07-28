const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const { app } = require("electron");

let db;

const ROMANJI_DATA = [
  { id: 1, romanji: "Utpatti" },
  { id: 2, romanji: "Prasthan" },
  { id: 3, romanji: "Levi" },
  { id: 4, romanji: "Ganti" },
  { id: 5, romanji: "Byawastha" },
  { id: 6, romanji: "Yahasu" },
  { id: 7, romanji: "Nyayakarta" },
  { id: 8, romanji: "Ruth" },
  { id: 9, romanji: "1 Samuel" },
  { id: 10, romanji: "2 Samuel" },
  { id: 11, romanji: "1 Raja" },
  { id: 12, romanji: "2 Raja" },
  { id: 13, romanji: "1 Itihas" },
  { id: 14, romanji: "2 Itihas" },
  { id: 15, romanji: "Ezra" },
  { id: 16, romanji: "Nehemiah" },
  { id: 17, romanji: "Esther" },
  { id: 18, romanji: "Aayub" },
  { id: 19, romanji: "Bhajansangrah" },
  { id: 20, romanji: "Hitopadesh" },
  { id: 21, romanji: "Upadeshak" },
  { id: 22, romanji: "Shresthageet" },
  { id: 23, romanji: "Isaiah" },
  { id: 24, romanji: "Jeremiah" },
  { id: 25, romanji: "Bilap" },
  { id: 26, romanji: "Ezekiel" },
  { id: 27, romanji: "Daniel" },
  { id: 28, romanji: "Hosea" },
  { id: 29, romanji: "Joel" },
  { id: 30, romanji: "Amos" },
  { id: 31, romanji: "Obadiah" },
  { id: 32, romanji: "Jonah" },
  { id: 33, romanji: "Micah" },
  { id: 34, romanji: "Nahum" },
  { id: 35, romanji: "Habakkuk" },
  { id: 36, romanji: "Zephaniah" },
  { id: 37, romanji: "Haggai" },
  { id: 38, romanji: "Zechariah" },
  { id: 39, romanji: "Malachi" },
  { id: 40, romanji: "Mati" },
  { id: 41, romanji: "Markus" },
  { id: 42, romanji: "Luka" },
  { id: 43, romanji: "Yahunna" },
  { id: 44, romanji: "Prerit" },
  { id: 45, romanji: "Romi" },
  { id: 46, romanji: "1 Coranthi" },
  { id: 47, romanji: "2 Coranthi" },
  { id: 48, romanji: "Galati" },
  { id: 49, romanji: "Ephesi" },
  { id: 50, romanji: "Philipi" },
  { id: 51, romanji: "Colossi" },
  { id: 52, romanji: "1 Thessalonikki" },
  { id: 53, romanji: "2 Thessalonikki" },
  { id: 54, romanji: "1 Timothy" },
  { id: 55, romanji: "2 Timothy" },
  { id: 56, romanji: "Titus" },
  { id: 57, romanji: "Philemo" },
  { id: 58, romanji: "Hebrews" },
  { id: 59, romanji: "Yakub" },
  { id: 60, romanji: "1 Patrus" },
  { id: 61, romanji: "2 Patrus" },
  { id: 62, romanji: "1 Yuhanna" },
  { id: 63, romanji: "2 Yuhanna" },
  { id: 64, romanji: "3 Yuhanna" },
  { id: 65, romanji: "Yahuda" },
  { id: 66, romanji: "Prakash" },
];

function getDB() {
  if (!db) {
    const userDataPath = path.join(app.getPath("userData"), "bible.sqlite");
    if (!fs.existsSync(userDataPath)) {
      const bundledPath = app.isPackaged
        ? path.join(process.resourcesPath, "bible.sqlite")
        : path.join(__dirname, "bible.sqlite");
      fs.copyFileSync(bundledPath, userDataPath);
    }
    db = new Database(userDataPath);
    db.pragma("journal_mode = WAL");
    migrateRomanji(db);
    migrateSongs(db);
  }
  return db;
}

function migrateRomanji(database) {
  const cols = database.prepare("PRAGMA table_info(books)").all();
  if (!cols.some((c) => c.name === "romanji")) {
    database.prepare("ALTER TABLE books ADD COLUMN romanji NVARCHAR(255)").run();
    const upd = database.prepare("UPDATE books SET romanji = ? WHERE id = ?");
    const tx = database.transaction(() => {
      for (const r of ROMANJI_DATA) upd.run(r.romanji, r.id);
    });
    tx();
  }
}

function migrateSongs(database) {
  const bundledPath = app.isPackaged
    ? path.join(process.resourcesPath, "bible.sqlite")
    : path.join(__dirname, "bible.sqlite");
  if (!fs.existsSync(bundledPath)) return;

  const bundled = new Database(bundledPath, { readonly: true });
  let bundledSongs;
  try {
    bundledSongs = bundled.prepare("SELECT title, lyrics, category, language, author, tags FROM songs").all();
  } catch {
    bundled.close();
    return;
  }
  bundled.close();

  if (!bundledSongs.length) return;

  const existing = new Set(
    database.prepare("SELECT title FROM songs").all().map((r) => r.title),
  );
  const toInsert = bundledSongs.filter((s) => !existing.has(s.title));
  if (!toInsert.length) return;

  const ins = database.prepare(
    "INSERT INTO songs (title, lyrics, category, language, author, tags) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const tx = database.transaction(() => {
    for (const s of toInsert) {
      ins.run(s.title, s.lyrics, s.category || "", s.language || "", s.author || "", s.tags || "");
    }
  });
  tx();
}

function getBooks(lang) {
  const d = getDB();
  return d
    .prepare(
      "SELECT id, name_nepali, name_english, romanji, testament FROM books ORDER BY id",
    )
    .all();
}

function getVerses(bookId, chapter, startVerse, endVerse, lang = "nepali") {
  const d = getDB();
  const table = lang === "nepali" ? "verses" : "en_verses";
  if (endVerse) {
    return d
      .prepare(
        `SELECT verse, text FROM ${table} WHERE book = ? AND chapter = ? AND verse BETWEEN ? AND ? ORDER BY verse`,
      )
      .all(bookId, chapter, startVerse, endVerse);
  }
  return d
    .prepare(
      `SELECT verse, text FROM ${table} WHERE book = ? AND chapter = ? AND verse = ? ORDER BY verse`,
    )
    .all(bookId, chapter, startVerse);
}

function getChapterCount(bookId) {
  const d = getDB();
  const row = d
    .prepare("SELECT MAX(chapter) as count FROM verses WHERE book = ?")
    .get(bookId);
  return row ? row.count : 0;
}

function getVerseCount(bookId, chapter) {
  const d = getDB();
  const row = d
    .prepare(
      "SELECT MAX(verse) as count FROM verses WHERE book = ? AND chapter = ?",
    )
    .get(bookId, chapter);
  return row ? row.count : 0;
}

function searchVerses(keyword, lang = "nepali") {
  const d = getDB();
  const table = lang === "nepali" ? "verses" : "en_verses";
  if (lang === "nepali") {
    return d
      .prepare(
        `SELECT v.verse, v.text, v.chapter, v.book, b.name_nepali as book_nepali, b.name_english as book_english FROM ${table} v JOIN books b ON v.book = b.id WHERE v.text LIKE ? OR b.name_nepali LIKE ? OR b.romanji LIKE ? LIMIT 50`,
      )
      .all(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  return d
    .prepare(
      `SELECT v.verse, v.text, v.chapter, v.book, b.name_nepali as book_nepali, b.name_english as book_english FROM ${table} v JOIN books b ON v.book = b.id WHERE v.text LIKE ? OR b.name_english LIKE ? LIMIT 50`,
    )
    .all(`%${keyword}%`, `%${keyword}%`);
}

function getChapters(bookId) {
  const d = getDB();
  return d
    .prepare(
      "SELECT DISTINCT chapter FROM verses WHERE book = ? ORDER BY chapter",
    )
    .all(bookId)
    .map((r) => r.chapter);
}

function getAllSongs() {
  const d = getDB();
  return d
    .prepare("SELECT id, title, category, language, tags FROM songs ORDER BY title")
    .all();
}

function getSongLyrics(id) {
  const d = getDB();
  return d.prepare("SELECT * FROM songs WHERE id = ?").get(id);
}

function addSong(title, lyrics, category, language, author, tags) {
  const d = getDB();
  const existing = d.prepare("SELECT id FROM songs WHERE title = ?").get(title);
  if (existing) {
    d.prepare(
      "UPDATE songs SET lyrics = ?, category = ?, language = ?, author = ?, tags = ? WHERE id = ?",
    ).run(lyrics, category, language, author, tags, existing.id);
    return existing.id;
  }
  const result = d
    .prepare(
      "INSERT INTO songs (title, lyrics, category, language, author, tags) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(title, lyrics, category, language, author, tags);
  return result.lastInsertRowid;
}

function deleteSong(id) {
  const d = getDB();
  d.prepare("DELETE FROM songs WHERE id = ?").run(id);
}

function getBookNames() {
  const d = getDB();
  return d
    .prepare("SELECT id, name_nepali, name_english, romanji FROM books ORDER BY id")
    .all();
}

function getChapterVerses(bookId, chapter, lang = "nepali") {
  const d = getDB();
  const table = lang === "nepali" ? "verses" : "en_verses";
  return d
    .prepare(
      `SELECT verse, text FROM ${table} WHERE book = ? AND chapter = ? ORDER BY verse`,
    )
    .all(bookId, chapter);
}

function getChapterVersesDual(bookId, chapter) {
  const d = getDB();
  const nepali = d
    .prepare(
      `SELECT verse, text FROM verses WHERE book = ? AND chapter = ? ORDER BY verse`,
    )
    .all(bookId, chapter);
  const english = d
    .prepare(
      `SELECT verse, text FROM en_verses WHERE book = ? AND chapter = ? ORDER BY verse`,
    )
    .all(bookId, chapter);
  return { nepali, english };
}

function getVersesDual(bookId, chapter, startVerse, endVerse) {
  const d = getDB();
  const nepali = d
    .prepare(
      `SELECT verse, text FROM verses WHERE book = ? AND chapter = ? AND verse BETWEEN ? AND ? ORDER BY verse`,
    )
    .all(bookId, chapter, startVerse, endVerse || startVerse);
  const english = d
    .prepare(
      `SELECT verse, text FROM en_verses WHERE book = ? AND chapter = ? AND verse BETWEEN ? AND ? ORDER BY verse`,
    )
    .all(bookId, chapter, startVerse, endVerse || startVerse);
  return { nepali, english };
}

function searchVersesDual(keyword) {
  const d = getDB();
  const results = d
    .prepare(
      `SELECT v.verse, v.text, v.chapter, v.book, b.name_nepali as book_nepali, b.name_english as book_english FROM verses v JOIN books b ON v.book = b.id WHERE v.text LIKE ? OR b.name_nepali LIKE ? OR b.romanji LIKE ? LIMIT 30`,
    )
    .all(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  const enResults = d
    .prepare(
      `SELECT v.verse, v.text, v.chapter, v.book, b.name_nepali as book_nepali, b.name_english as book_english FROM en_verses v JOIN books b ON v.book = b.id WHERE v.text LIKE ? OR b.name_english LIKE ? LIMIT 30`,
    )
    .all(`%${keyword}%`, `%${keyword}%`);
  return { nepali: results, english: enResults };
}

module.exports = {
  getBooks,
  getVerses,
  getChapterVerses,
  getChapterVersesDual,
  getVersesDual,
  getChapterCount,
  getVerseCount,
  searchVerses,
  searchVersesDual,
  getChapters,
  getAllSongs,
  getSongLyrics,
  addSong,
  deleteSong,
  getBookNames,
};
