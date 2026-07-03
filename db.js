const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

let db;

function getDB() {
  if (!db) {
    const dbPath = app.isPackaged
      ? path.join(process.resourcesPath, 'bible.sqlite')
      : path.join(__dirname, 'bible.sqlite');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

function getBooks(lang) {
  const d = getDB();
  return d.prepare('SELECT id, name_nepali, name_english, testament FROM books ORDER BY id').all();
}

function getVerses(bookId, chapter, startVerse, endVerse, lang = 'nepali') {
  const d = getDB();
  const table = lang === 'nepali' ? 'verses' : 'en_verses';
  if (endVerse) {
    return d.prepare(`SELECT verse, text FROM ${table} WHERE book = ? AND chapter = ? AND verse BETWEEN ? AND ? ORDER BY verse`).all(bookId, chapter, startVerse, endVerse);
  }
  return d.prepare(`SELECT verse, text FROM ${table} WHERE book = ? AND chapter = ? AND verse = ? ORDER BY verse`).all(bookId, chapter, startVerse);
}

function getChapterCount(bookId) {
  const d = getDB();
  const row = d.prepare('SELECT MAX(chapter) as count FROM verses WHERE book = ?').get(bookId);
  return row ? row.count : 0;
}

function getVerseCount(bookId, chapter) {
  const d = getDB();
  const row = d.prepare('SELECT MAX(verse) as count FROM verses WHERE book = ? AND chapter = ?').get(bookId, chapter);
  return row ? row.count : 0;
}

function searchVerses(keyword, lang = 'nepali') {
  const d = getDB();
  const table = lang === 'nepali' ? 'verses' : 'en_verses';
  return d.prepare(`SELECT v.verse, v.text, v.chapter, v.book, b.name_nepali as book_nepali, b.name_english as book_english FROM ${table} v JOIN books b ON v.book = b.id WHERE v.text LIKE ? LIMIT 50`).all(`%${keyword}%`);
}

function getChapters(bookId) {
  const d = getDB();
  return d.prepare('SELECT DISTINCT chapter FROM verses WHERE book = ? ORDER BY chapter').all(bookId).map(r => r.chapter);
}

function getAllSongs() {
  const d = getDB();
  return d.prepare('SELECT id, title, category, language FROM songs ORDER BY title').all();
}

function getSongLyrics(id) {
  const d = getDB();
  return d.prepare('SELECT * FROM songs WHERE id = ?').get(id);
}

function addSong(title, lyrics, category, language, author, tags) {
  const d = getDB();
  const existing = d.prepare('SELECT id FROM songs WHERE title = ?').get(title);
  if (existing) {
    d.prepare('UPDATE songs SET lyrics = ?, category = ?, language = ?, author = ?, tags = ? WHERE id = ?').run(lyrics, category, language, author, tags, existing.id);
    return existing.id;
  }
  const result = d.prepare('INSERT INTO songs (title, lyrics, category, language, author, tags) VALUES (?, ?, ?, ?, ?, ?)').run(title, lyrics, category, language, author, tags);
  return result.lastInsertRowid;
}

function deleteSong(id) {
  const d = getDB();
  d.prepare('DELETE FROM songs WHERE id = ?').run(id);
}

function getBookNames() {
  const d = getDB();
  return d.prepare('SELECT id, name_nepali, name_english FROM books ORDER BY id').all();
}

function getChapterVerses(bookId, chapter, lang = 'nepali') {
  const d = getDB();
  const table = lang === 'nepali' ? 'verses' : 'en_verses';
  return d.prepare(`SELECT verse, text FROM ${table} WHERE book = ? AND chapter = ? ORDER BY verse`).all(bookId, chapter);
}

function getChapterVersesDual(bookId, chapter) {
  const d = getDB();
  const nepali = d.prepare(`SELECT verse, text FROM verses WHERE book = ? AND chapter = ? ORDER BY verse`).all(bookId, chapter);
  const english = d.prepare(`SELECT verse, text FROM en_verses WHERE book = ? AND chapter = ? ORDER BY verse`).all(bookId, chapter);
  return { nepali, english };
}

function getVersesDual(bookId, chapter, startVerse, endVerse) {
  const d = getDB();
  const nepali = d.prepare(`SELECT verse, text FROM verses WHERE book = ? AND chapter = ? AND verse BETWEEN ? AND ? ORDER BY verse`).all(bookId, chapter, startVerse, endVerse || startVerse);
  const english = d.prepare(`SELECT verse, text FROM en_verses WHERE book = ? AND chapter = ? AND verse BETWEEN ? AND ? ORDER BY verse`).all(bookId, chapter, startVerse, endVerse || startVerse);
  return { nepali, english };
}

function searchVersesDual(keyword) {
  const d = getDB();
  const results = d.prepare(`SELECT v.verse, v.text, v.chapter, v.book, b.name_nepali as book_nepali, b.name_english as book_english FROM verses v JOIN books b ON v.book = b.id WHERE v.text LIKE ? LIMIT 30`).all(`%${keyword}%`);
  const enResults = d.prepare(`SELECT v.verse, v.text, v.chapter, v.book, b.name_nepali as book_nepali, b.name_english as book_english FROM en_verses v JOIN books b ON v.book = b.id WHERE v.text LIKE ? LIMIT 30`).all(`%${keyword}%`);
  return { nepali: results, english: enResults };
}

module.exports = { getBooks, getVerses, getChapterVerses, getChapterVersesDual, getVersesDual, getChapterCount, getVerseCount, searchVerses, searchVersesDual, getChapters, getAllSongs, getSongLyrics, addSong, deleteSong, getBookNames };
