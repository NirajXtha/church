# Release Notes - v1.0.17

## New Features

### Chunked Song Lyrics Preview
- Song lyrics are now shown split into chunks (separated by blank lines) in the preview
- The chunk currently being presented is highlighted
- Click any chunk to jump straight to that part of the song on the big screen

### Automatic Song Migration
- New songs added to the bundled database are automatically merged into existing users' databases on update
- User-added songs are never overwritten or deleted
- Only songs with new titles are inserted — no duplicates

### Searchable Book & Chapter Dropdowns
- Book and chapter selectors now have a search input at the top of the dropdown
- Type to instantly filter the list
- Book search supports **Nepali**, **English**, and **Romanji** (romanized Nepali) names when in Nepali mode

### Romanji Book Names
- Added `romanji` column to the books database with romanized Nepali names for all 66 Bible books
- Automatically migrated on first launch — no data loss

### Enhanced Verse Search
- Bible verse search now also matches against book names
- In Nepali mode: searches verse text, Nepali book names, and Romanji book names

## Upgrade Notes
- Existing users: the romanji column and any new songs are automatically added on first launch. Your existing songs and data are preserved.

