# CLAUDE.md — Foxhole Extension

## Project Overview

Chrome extension (Manifest V3) that replaces the new tab page with a habit tracker and website time tracker. Single-column brutalist layout using the gruvbox color palette and 0xProto monospace font. Part of the Foxhole monorepo.

## Design System

- **Colors:** 6 gruvbox colors only — `#282828` (bg), `#3c3836` (surface), `#504945` (elevated/border), `#ebdbb2` (text primary), `#d5c4a1` (text body), `#a89984` (text muted), `#d65d0e` (accent, sparingly)
- **Font:** 0xProto monospace, 3 sizes: 20px heading, 16px body, 12px label
- **Rules:** All lowercase text. No shadows, no gradients, no animations except `opacity 0.1s`. Border-radius 2px max.

## Development

**Load extension for testing:**
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this directory
4. Open a new tab to see the extension

**No build step required** - vanilla JavaScript, direct browser loading.

## Architecture

```
newtab.html          Entry point, single-column layout, loads JS in order
fonts/0xProto-Regular.ttf  Monospace font (loaded via @font-face)
css/styles.css       Gruvbox brutalist stylesheet (~400 lines)
js/storage.js        Data layer using chrome.storage.local
js/habits.js         Habit logic (create, streak calculation, monochrome colors)
js/chart.js          SVG year chart rendering (monochrome)
js/websites.js       Website utilities (time formatting, categories, trends)
js/website-chart.js  Weekly/monthly trend chart SVGs (monochrome)
js/a11y.js           Accessibility utilities (focus trap, screen reader)
js/toast.js          Toast notifications + confirm dialogs
js/app.js            UI controller, event binding, render orchestration
js/background.js     Service worker for website time tracking
js/content.js        Blocking overlay (minimal text, no breathing exercise)
js/blocked.js        Blocked page domain/limit display
blocked.html         Static blocked page (gruvbox styled)
```

**Data flow:**
- Habits: `Storage` → `Habits` (logic) → `Chart` (visualization) → `App` (orchestration)
- Websites: `background.js` (tracking) → `Storage` → `Websites` (utilities) → `App` (display)
- Blocking: `background.js` (limit check) → `content.js` (overlay injection)

**Key globals:** `Storage`, `Habits`, `Chart`, `Websites`, `WebsiteChart`, `App`, `Toast`, `Confirm`, `A11y` - all defined on window, loaded sequentially.

## Data Model

```javascript
// Habit
{ id, name, type: 'binary'|'count', target, createdAt: 'YYYY-MM-DD' }

// Habit Entry (per date, per habit)
{ completed: boolean, value: number }

// Streak Freezes (per habit)
{ habitId: ['YYYY-MM-DD', ...] }  // dates where streak is protected

// Website Entry (per date, per domain)
{ totalSeconds: number, favicon: string }

// Website Settings (per domain)
{ dailyLimitSeconds: number|null, categoryId: string|null, customName: string|null }

// Website Category
{ id: string, name: string, color: string }
```

## Features

### Habit Tracking
- Binary (done/not done) and count-based habits
- Year-at-a-glance monochrome visualization (7 columns x 53 rows)
- Streak calculation (displayed as plain numbers, e.g. "7d")
- Maximum 5 habits
- Habit editing, templates, backfill entries, streak freeze

### Website Time Tracking
- Automatic tracking via background service worker
- Idle detection (pauses after 60s of inactivity)
- Per-domain daily time limits
- Category assignment (text labels, no color rendering)
- Weekly/monthly monochrome trend charts

### Blocking System
- Content script injects full-page overlay when daily limit exceeded
- Minimal text: "time's up." + domain name + limit info
- Gruvbox styled (#282828 bg, 0xProto font)
- Irrevocable (MutationObserver prevents removal, keyboard blocked)
- Blocks reset at midnight

## Security

**XSS Prevention:** All user-provided data uses safe DOM methods (`textContent`, `createElement`). `Storage.sanitizeString()` for import validation.

**Permissions:** `storage`, `tabs`, `idle`, `alarms`, host permissions for http/https only.

## Constraints

- Maximum 5 habits (enforced in `Storage.saveHabit()`)
- Date format: `YYYY-MM-DD` throughout
- Website tracking only for http/https URLs
- Content script runs at `document_start` for early blocking
- Website data retained 90 days, habit data 400 days
