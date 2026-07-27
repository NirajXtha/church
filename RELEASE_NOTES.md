# Release Notes - v1.0.14

## New Features

### Searchable Book & Chapter Dropdowns
- Book and chapter selectors are now filterable text inputs instead of dropdowns
- Type to instantly filter the list — no more scrolling through 66 books
- Book search supports **Nepali**, **English**, and **Romanji** (romanized Nepali) names when in Nepali mode
- Keyboard navigation: Arrow keys to move, Enter to select, Escape to close

### Romanji Book Names
- Added `romanji` column to the books database with romanized Nepali names for all 66 Bible books
- Example: उत्पत्ति → Utpatti, निर्गमन → Prasthan, यूहन्ना → Yahunna
- Existing databases are auto-migrated on first launch — no data loss

### Enhanced Verse Search
- Bible verse search now also matches against book names
- In Nepali mode: searches verse text, Nepali book names, and Romanji book names
- In English mode: searches verse text and English book names
- Search "Utpatti" or "Prakash" to find all verses from that book

## Bug Fixes
- None

## Upgrade Notes
- Existing users: the romanji column is automatically added to your local database on first launch. Your songs and other data are preserved.
