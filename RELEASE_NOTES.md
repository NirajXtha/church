## Release Notes v1.2.0

### New Features
- **Import/Export Data** — Transfer songs and full database between installations via JSON files
  - Export/Import songs only (great for sharing song libraries)
  - Export/Import full database (songs, settings, recent items, verse stack)
  - Accessible from Settings → Data Transfer

### Fixes
- **Fixed background video replay** — Video no longer restarts when navigating verses/songs with keyboard (Space, Enter, Arrow keys) while controller is focused
- **Fixed video URL encoding mismatch** — Fixed spaces in video filenames causing guard comparison to fail

### Improvements
- Video background now plays infinitely without restart on navigation
- Current verse highlight persists when navigating with keyboard